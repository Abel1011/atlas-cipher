import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import db, { LEGACY_GAME_SESSION_PLAYER_ID } from './db';
import { createCaseFromSeedTemplate } from './services/case-generator';
import { hasImageGenerationConfig } from './services/ai';
import { generateWitnessPortrait, generateCityPanorama, generateCityScene } from './services/image-generator';
import { generateCityAmbientSound } from './services/sound-effects';
import { generateNarration } from './services/tts';
import { createHandlerAgent, syncHandlerAgent, ensureWitnessAgentId, syncWitnessAgent, ensureBoardHandlerAgent } from './services/agent-creator';
import { createElevenLabsClient, hasElevenLabsApiKey } from './services/elevenlabs';
import { listHandlerCallMemory, saveHandlerCallMemory, type HandlerMemoryTranscriptEntry } from './services/handler-memory';
import {
  getPlayerMissionSnapshot,
  listPlayerMissionSnapshots,
  listPlayerMissionStatuses,
  recordMissionSnapshot,
  recordMissionStatus,
} from './services/mission-history';
import { listWitnessCallMemory, saveWitnessCallMemory } from './services/witness-memory';
import { getHiddenSeedMissionCount, getSeedMissionOffers } from './services/seed-case-pool';
import { getPlayerProgress, recordAbandonedCase, recordFailedCase, recordSolvedCase, setPlayerDisplayName } from './services/player-progress';
import type { AgentConfig, City, ClueKind, GameState, HandlerState, MissionBoard, MissionOfferStatus, MissionResources, WarrantState } from './types';

const PLAYER_ID_HEADER = 'x-player-id';
const FALLBACK_PLAYER_ID = 'anonymous-player';
const TRAVEL_SHORT_MAX_KM = 1500;
const TRAVEL_REGIONAL_MAX_KM = 5000;
const CLUE_LOG_COST_HOURS = 2;
const MISSION_NOTES_MAX_CHARS = 20_000;
const HANDLER_SUPPORT_REASON = 'Vivienne has no remaining support windows on this case.';
const CASE_CLOSED_REASON = 'This case is already closed.';
const FAILED_HANDLER_DEBRIEF_REASON = 'Mission failed. Live handler support is closed for this file.';
const SOLVED_HANDLER_REVIEW_REASON = 'Mission solved. This file is now in review mode.';
const ABANDONED_HANDLER_REVIEW_REASON = 'Mission abandoned. Live handler support is closed for this file.';
const FAILED_WITNESS_CHANNEL_REASON = 'Mission failed. Witness channels are sealed for this case.';
const SOLVED_WITNESS_CHANNEL_REASON = 'Mission solved. Witness channels are archived for this case.';
const ABANDONED_WITNESS_CHANNEL_REASON = 'Mission abandoned. Witness channels are archived for this case.';
const WITNESS_REVISIT_REASON = 'You already spoke with this witness on this visit. Leave the city and come back for another call.';
const STRANDED_WARRANT_REASON = 'No further travel or witness calls are available. You may issue a warrant with the intel you have.';

export function registerRoutes(app: Hono): void {
  app.use('/api/*', cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'X-Player-Id'],
  }));

  app.get('/api/player/profile', (c) => {
    const playerId = getPlayerId(c);
    return c.json(getPlayerProgress(playerId));
  });

  app.post('/api/player/profile', async (c) => {
    try {
      const body = await c.req.json();
      const rawName = typeof body?.displayName === 'string' ? body.displayName : '';
      const playerId = getPlayerId(c);
      const player = setPlayerDisplayName(playerId, rawName);
      return c.json(player);
    } catch (err: any) {
      console.error('Failed to update player profile:', err);
      return c.json({ error: 'Failed to update profile' }, 500);
    }
  });

  app.get('/api/game/offers', (c) => {
    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);

    if (session?.status === 'active') {
      return c.json({ error: 'Finish or abandon the active case before selecting another mission.' }, 409);
    }

    if (session) {
      const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(session.case_id) as any;
      const templateId = resolveCaseTemplateId(caseRow);
      const archivedStatus = normalizeClosedMissionStatus(session.status);
      if (templateId && archivedStatus) {
        recordMissionSnapshot(playerId, buildMissionSnapshot(session, templateId, archivedStatus));
      }
      db.prepare('DELETE FROM game_session WHERE user_id = ?').run(playerId);
    }

    const player = getPlayerProgress(playerId);
    const playerMissionStatuses = listPlayerMissionStatuses(playerId);
    const playerMissionSnapshots = listPlayerMissionSnapshots(playerId);
    const missionBoard: MissionBoard = {
      player,
      offers: getSeedMissionOffers(player.level, 3).map(offer => ({
        ...offer,
        playerStatus: playerMissionStatuses[offer.templateId] ?? null,
        hasDetail: !!playerMissionSnapshots[offer.templateId],
      })),
      hiddenOfferCount: getHiddenSeedMissionCount(player.level),
    };

    return c.json(missionBoard);
  });

  app.get('/api/game/history/:templateId', (c) => {
    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (session?.status === 'active') {
      return c.json({ error: 'Finish or abandon the active case before opening an archived file.' }, 409);
    }

    const templateId = c.req.param('templateId')?.trim() || '';
    if (!templateId) {
      return c.json({ error: 'templateId is required' }, 400);
    }

    const snapshot = getPlayerMissionSnapshot(playerId, templateId);
    if (!snapshot) {
      return c.json({ error: 'Archived mission detail not found for this file.' }, 404);
    }

    const archivedState = buildArchivedGameState(playerId, snapshot);
    if (!archivedState) {
      return c.json({ error: 'Archived mission file could not be reconstructed.' }, 404);
    }

    return c.json(archivedState);
  });

  // POST /api/game/new
  app.post('/api/game/new', async (c) => {
    try {
      const playerId = getPlayerId(c);
      const session = getPlayerSession(playerId);
      if (session?.status === 'active') {
        return c.json({ error: 'Finish or abandon the active case before selecting another mission.' }, 409);
      }

      const player = getPlayerProgress(playerId);
      const firstOffer = getSeedMissionOffers(player.level, 1)[0];
      if (!firstOffer) {
        return c.json({ error: 'No mission offers available for the current player level.' }, 404);
      }

      const caseId = createCaseFromSeedTemplate(firstOffer.templateId, player.level);
      if (!caseId) {
        return c.json({ error: 'The selected mission could not be activated.' }, 404);
      }

      return c.json(startCaseSession(playerId, caseId));
    } catch (err: any) {
      console.error('Failed to create new game:', err);
      return c.json({ error: 'Failed to generate case' }, 500);
    }
  });

  app.post('/api/game/accept', async (c) => {
    try {
      const body = await c.req.json();
      const templateId = typeof body?.templateId === 'string' ? body.templateId.trim() : '';
      if (!templateId) {
        return c.json({ error: 'templateId is required' }, 400);
      }

      const playerId = getPlayerId(c);
      const session = getPlayerSession(playerId);
      if (session?.status === 'active') {
        return c.json({ error: 'Finish or abandon the active case before selecting another mission.' }, 409);
      }

      if (session) {
        db.prepare('DELETE FROM game_session WHERE user_id = ?').run(playerId);
      }

      const player = getPlayerProgress(playerId);
      const caseId = createCaseFromSeedTemplate(templateId, player.level);
      if (!caseId) {
        return c.json({ error: 'Mission unavailable for the current player level.' }, 404);
      }

      return c.json(startCaseSession(playerId, caseId));
    } catch (err: any) {
      console.error('Failed to accept mission:', err);
      return c.json({ error: 'Failed to accept mission' }, 500);
    }
  });

  app.post('/api/game/abandon', (c) => {
    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (!session) {
      return c.json({ ok: true, player: getPlayerProgress(playerId) });
    }

    if (session.status === 'active') {
      const caseRow = db.prepare('SELECT template_id FROM cases WHERE id = ?').get(session.case_id) as any;
      const templateId = resolveCaseTemplateId(caseRow);
      recordAbandonedCase(playerId);
      recordMissionStatus(playerId, templateId, 'abandoned');
      if (templateId) {
        recordMissionSnapshot(playerId, buildMissionSnapshot(session, templateId, 'abandoned'));
      }
    }

    db.prepare('DELETE FROM game_session WHERE user_id = ?').run(playerId);
    return c.json({ ok: true, player: getPlayerProgress(playerId) });
  });

  // POST /api/game/reset — clears the current session and returns to landing
  app.post('/api/game/reset', (c) => {
    const playerId = getPlayerId(c);
    db.prepare('DELETE FROM game_session WHERE user_id = ?').run(playerId);
    return c.json({ ok: true });
  });

  // GET /api/game/state
  app.get('/api/game/state', (c) => {
    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (!session) {
      return c.json({ error: 'No active game session' }, 404);
    }

    const gameState = buildGameState(session);
    if (!gameState) {
      return c.json({ error: 'Case not found' }, 404);
    }

    return c.json(gameState);
  });

  app.post('/api/game/notes', async (c) => {
    try {
      const playerId = getPlayerId(c);
      const session = getPlayerSession(playerId);
      if (!session) {
        return c.json({ error: 'No active game session' }, 404);
      }

      const body = await c.req.json();
      const content = normalizeMissionNotesContent(body?.content);
      if (!content.trim()) {
        return c.json({ error: 'Note content is required' }, 400);
      }
      const context = resolveNoteContext(body, session);
      const id = `mn_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

      db.prepare(
        `INSERT INTO mission_note_entries (id, user_id, case_id, context_type, context_id, context_label, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).run(id, playerId, session.case_id, context.contextType, context.contextId, context.contextLabel, content);

      return c.json({ ok: true, entry: getNoteEntry(id) });
    } catch (err: any) {
      console.error('Failed to persist mission note:', err);
      return c.json({ error: err?.message || 'Failed to persist mission note' }, 500);
    }
  });

  app.patch('/api/game/notes/:id', async (c) => {
    try {
      const playerId = getPlayerId(c);
      const session = getPlayerSession(playerId);
      if (!session) {
        return c.json({ error: 'No active game session' }, 404);
      }

      const id = c.req.param('id');
      const body = await c.req.json();
      const content = normalizeMissionNotesContent(body?.content);
      if (!content.trim()) {
        return c.json({ error: 'Note content is required' }, 400);
      }

      const result = db.prepare(
        `UPDATE mission_note_entries
         SET content = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ? AND case_id = ?`
      ).run(content, id, playerId, session.case_id);

      if (result.changes === 0) {
        return c.json({ error: 'Note not found' }, 404);
      }

      return c.json({ ok: true, entry: getNoteEntry(id) });
    } catch (err: any) {
      console.error('Failed to update mission note:', err);
      return c.json({ error: err?.message || 'Failed to update mission note' }, 500);
    }
  });

  app.delete('/api/game/notes/:id', async (c) => {
    try {
      const playerId = getPlayerId(c);
      const session = getPlayerSession(playerId);
      if (!session) {
        return c.json({ error: 'No active game session' }, 404);
      }

      const id = c.req.param('id');
      const result = db.prepare(
        'DELETE FROM mission_note_entries WHERE id = ? AND user_id = ? AND case_id = ?'
      ).run(id, playerId, session.case_id);

      if (result.changes === 0) {
        return c.json({ error: 'Note not found' }, 404);
      }
      return c.json({ ok: true });
    } catch (err: any) {
      console.error('Failed to delete mission note:', err);
      return c.json({ error: err?.message || 'Failed to delete mission note' }, 500);
    }
  });

  // POST /api/game/travel
  app.post('/api/game/travel', async (c) => {
    const body = await c.req.json();
    const { cityId } = body;

    if (!cityId) {
      return c.json({ error: 'cityId is required' }, 400);
    }

    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (!session) {
      return c.json({ error: 'No active game session' }, 404);
    }
    if (session.status !== 'active') {
      return c.json({ error: CASE_CLOSED_REASON }, 409);
    }

    const currentCity = session.current_city_id
      ? db.prepare('SELECT * FROM cities WHERE id = ? AND case_id = ?').get(session.current_city_id, session.case_id) as any
      : null;
    const city = db.prepare('SELECT * FROM cities WHERE id = ? AND case_id = ?').get(cityId, session.case_id) as any;
    if (!city) {
      return c.json({ error: 'City not found' }, 404);
    }
    if (city.id === session.current_city_id) {
      return c.json({ ok: true, city: buildCityResponse(city) });
    }
    if (city.unlocked !== 1) {
      return c.json({ error: 'This city is still sealed. Recover a route clue first.' }, 403);
    }

    const travelCost = calculateTravelCost(currentCity, city);
    if (Number(session.remaining_hours || 0) < travelCost.hours) {
      return c.json({ error: 'You do not have enough case time left to make this trip.' }, 409);
    }
    if (Number(session.remaining_credits || 0) < travelCost.credits) {
      return c.json({ error: 'You do not have enough agency credits left to fund this trip.' }, 409);
    }

    db.prepare('UPDATE cities SET visited = 1, unlocked = 1 WHERE id = ?').run(cityId);
    db.prepare(
      `UPDATE game_session
       SET current_city_id = ?, remaining_hours = remaining_hours - ?, remaining_credits = remaining_credits - ?, city_visit_token = city_visit_token + 1, updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(cityId, travelCost.hours, travelCost.credits, playerId);

    return c.json({ ok: true, travelCost, city: buildCityResponse(city) });
  });

  // POST /api/game/clue
  app.post('/api/game/clue', async (c) => {
    const body = await c.req.json();
    const { clueId } = body;

    if (!clueId) {
      return c.json({ error: 'clueId is required' }, 400);
    }

    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (!session) {
      return c.json({ error: 'No active game session' }, 404);
    }
    if (session.status !== 'active') {
      return c.json({ error: CASE_CLOSED_REASON }, 409);
    }

    const clue = db.prepare('SELECT * FROM clues WHERE id = ? AND case_id = ?').get(clueId, session.case_id) as any;
    if (!clue) {
      return c.json({ error: 'Clue not found' }, 404);
    }

    if (clue.discovered) {
      return c.json({ message: 'Clue already discovered' });
    }

    if (Number(session.remaining_hours || 0) < CLUE_LOG_COST_HOURS) {
      return c.json({ error: 'You do not have enough case time left to log more field intel.' }, 409);
    }

    if (clue.witness_id) {
      const witness = db.prepare('SELECT city_id FROM witnesses WHERE id = ? AND case_id = ?').get(clue.witness_id, session.case_id) as { city_id: string } | undefined;
      if (!witness || witness.city_id !== session.current_city_id) {
        return c.json({ error: 'You can only log intel from the witness currently in front of you.' }, 403);
      }
    }

    db.prepare("UPDATE clues SET discovered = 1, discovered_at = datetime('now') WHERE id = ?").run(clueId);
    if (clue.points_to_city_id) {
      db.prepare('UPDATE cities SET unlocked = 1 WHERE id = ? AND case_id = ?').run(clue.points_to_city_id, session.case_id);
    }
    db.prepare(
      `UPDATE game_session
       SET remaining_hours = remaining_hours - ?, updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(CLUE_LOG_COST_HOURS, playerId);

    return c.json({ message: 'Clue recorded', clueId, unlockedCityId: clue.points_to_city_id ?? null });
  });

  // POST /api/game/arrest
  app.post('/api/game/arrest', async (c) => {
    const body = await c.req.json();
    const { suspectId } = body;

    if (!suspectId) {
      return c.json({ error: 'suspectId is required' }, 400);
    }

    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (!session) {
      return c.json({ error: 'No active game session' }, 404);
    }

    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(session.case_id) as any;
    if (!caseRow) {
      return c.json({ error: 'Case not found' }, 404);
    }

    const discoveredClues = db.prepare('SELECT * FROM clues WHERE case_id = ? AND discovered = 1').all(session.case_id) as any[];
    const cities = db.prepare('SELECT * FROM cities WHERE case_id = ? ORDER BY visit_order').all(session.case_id) as any[];
    const witnesses = db.prepare('SELECT * FROM witnesses WHERE case_id = ?').all(session.case_id) as any[];
    const contactedWitnessIds = getWitnessContactedSet(
      session.case_id,
      playerId,
      getSessionCityVisitToken(session),
    );
    const warrantState = buildWarrantState(discoveredClues, {
      suspectId,
      strandedOverride: shouldAllowStrandedWarrant(session, cities, witnesses, contactedWitnessIds),
    });
    if (!warrantState.ready) {
      return c.json({ error: warrantState.reason || 'The warrant does not meet the current evidence threshold.' }, 409);
    }

    const isCorrect = suspectId === caseRow.correct_suspect_id;
    const caseDifficulty = normalizeCaseDifficulty(caseRow?.difficulty);
    const templateId = resolveCaseTemplateId(caseRow);

    if (isCorrect) {
      db.prepare("UPDATE game_session SET status = 'solved', updated_at = datetime('now') WHERE user_id = ?").run(playerId);
      recordSolvedCase(playerId, caseDifficulty);
      recordMissionStatus(playerId, templateId, 'solved');
      if (templateId) {
        recordMissionSnapshot(playerId, buildMissionSnapshot(session, templateId, 'solved'));
      }
    } else {
      db.prepare("UPDATE game_session SET status = 'failed', updated_at = datetime('now') WHERE user_id = ?").run(playerId);
      recordFailedCase(playerId);
      recordMissionStatus(playerId, templateId, 'failed');
      if (templateId) {
        recordMissionSnapshot(playerId, buildMissionSnapshot(session, templateId, 'failed'));
      }
    }

    // Generate TTS narration for case summary
    let narrationUrl: string | null = null;
    const suspect = db.prepare('SELECT * FROM suspects WHERE id = ?').get(suspectId) as any;
    const summaryText = isCorrect
      ? `Case closed. ${suspect?.name || 'The suspect'} has been apprehended. Excellent detective work.`
      : `Wrong suspect. ${suspect?.name || 'This person'} is not the culprit. The case is lost.`;

    const narrationId = await generateNarration(summaryText);
    if (narrationId) {
      narrationUrl = `/api/assets/sound/${narrationId}`;
    }

    return c.json({
      correct: isCorrect,
      suspectName: suspect?.name || null,
      narrationUrl,
      message: isCorrect ? 'Case solved!' : 'Wrong suspect. Case failed.',
    });
  });

  // GET /api/game/witness/:id
  app.get('/api/game/witness/:id', async (c) => {
    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (!session) {
      return c.json({ error: 'No active game session' }, 404);
    }

    const witnessId = c.req.param('id');
    const witness = db.prepare('SELECT * FROM witnesses WHERE id = ? AND case_id = ?').get(witnessId, session.case_id) as any;

    if (!witness) {
      return c.json({ error: 'Witness not found' }, 404);
    }
    if (witness.city_id !== session.current_city_id) {
      return c.json({ error: 'Travel to this city before opening the witness file.' }, 403);
    }

    const leadCount = db.prepare(
      'SELECT COUNT(*) as count FROM clues WHERE case_id = ? AND witness_id = ?'
    ).get(session.case_id, witnessId) as { count: number };
    const hasTalkedThisVisit = hasWitnessContactedThisVisit(
      session.case_id,
      playerId,
      witnessId,
      getSessionCityVisitToken(session),
    );

    return c.json({
      id: witness.id,
      name: witness.name,
      personality: witness.personality,
      backstory: witness.backstory,
      voiceDescription: witness.voice_description,
      portraitImageUrl: witness.portrait_image_id ? `/api/assets/image/${witness.portrait_image_id}` : null,
      leadCount: leadCount.count,
      hasTalkedThisVisit,
      talkLockedReason: hasTalkedThisVisit ? WITNESS_REVISIT_REASON : null,
    });
  });

  // GET /api/game/witness/:id/voice-config — ConvAI signed URL + agent for the witness
  app.get('/api/game/witness/:id/voice-config', async (c) => {
    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (!session) return c.json({ error: 'No active game session' }, 404);
    if (session.status !== 'active') {
      return c.json({ error: getClosedWitnessReason(session.status) }, 409);
    }

    const witnessId = c.req.param('id');
    const witness = db
      .prepare('SELECT id, name, city_id FROM witnesses WHERE id = ? AND case_id = ?')
      .get(witnessId, session.case_id) as { id: string; name: string; city_id: string } | undefined;
    if (!witness) return c.json({ error: 'Witness not found' }, 404);
    if (witness.city_id !== session.current_city_id) {
      return c.json({ error: 'Travel to this city before opening a live witness channel.' }, 403);
    }
    if (hasWitnessContactedThisVisit(session.case_id, playerId, witnessId, getSessionCityVisitToken(session))) {
      return c.json({ error: WITNESS_REVISIT_REASON }, 409);
    }

    try {
      const agentId = await ensureWitnessAgentId(witnessId);
      if (!agentId) {
        return c.json({ error: 'Witness agent could not be provisioned. Check ELEVENLABS_API_KEY on the server.' }, 500);
      }
      // Keep the agent in sync with the latest prompt/voice in case it has changed.
      void syncWitnessAgent(witnessId, agentId).catch(() => undefined);

      const signedUrl = await getSignedConversationUrl(agentId);
      const config: AgentConfig = {
        agentId,
        signedUrl,
        characterName: witness.name,
        characterRole: 'witness',
      };
      const dynamicVariables = buildWitnessDynamicVariables(playerId, session, witness);
      return c.json({
        ...config,
        dynamicVariables,
      });
    } catch (err: any) {
      console.error('Failed to build witness voice config:', err);
      return c.json({ error: err?.message || 'Failed to provision witness' }, 500);
    }
  });

  app.post('/api/game/witness/:id/memory', async (c) => {
    try {
      const playerId = getPlayerId(c);
      const session = getPlayerSession(playerId);
      if (!session) {
        return c.json({ error: 'No active game session' }, 404);
      }

      const witnessId = c.req.param('id');
      const witness = db
        .prepare('SELECT id, name, city_id FROM witnesses WHERE id = ? AND case_id = ?')
        .get(witnessId, session.case_id) as { id: string; name: string; city_id: string } | undefined;

      if (!witness) {
        return c.json({ error: 'Witness not found' }, 404);
      }
      if (witness.city_id !== session.current_city_id) {
        return c.json({ error: 'Travel to this city before logging witness intel.' }, 403);
      }

      const body = await c.req.json();
      const transcript: HandlerMemoryTranscriptEntry[] = Array.isArray(body?.transcript)
        ? body.transcript.filter(isHandlerMemoryTranscriptEntry)
        : [];
      const hasWitnessReply = transcript.some(entry => entry.role === 'agent' && entry.text.trim().length > 0);
      if (!hasWitnessReply) {
        return c.json({ ok: true, saved: false, note: null, confirmedClues: 0, unlockedCityIds: [] });
      }

      const cityVisitToken = getSessionCityVisitToken(session);
      if (hasWitnessContactedThisVisit(session.case_id, playerId, witnessId, cityVisitToken)) {
        return c.json({ ok: true, saved: false, note: null, confirmedClues: 0, unlockedCityIds: [], alreadyContacted: true });
      }

      const note = await saveWitnessCallMemory(session.case_id, playerId, witnessId, witness.name, transcript);
      const { confirmedClues, unlockedCityIds } = confirmWitnessConversation(
        session.case_id,
        playerId,
        witnessId,
        cityVisitToken,
      );

      return c.json({
        ok: true,
        saved: !!note,
        note,
        confirmedClues,
        unlockedCityIds,
      });
    } catch (err: any) {
      console.error('Failed to persist witness memory:', err);
      return c.json({ error: err?.message || 'Failed to persist witness memory' }, 500);
    }
  });

  // GET /api/game/handler-config/board
  app.get('/api/game/handler-config/board', async (c) => {
    const playerId = getPlayerId(c);
    const player = getPlayerProgress(playerId);
    const offers = getSeedMissionOffers(player.level, 3);
    const hiddenOfferCount = getHiddenSeedMissionCount(player.level);

    const agentId = await ensureBoardHandlerAgent();
    const signedUrl = await getSignedConversationUrl(agentId);

    const codename = (player.displayName ?? '').trim() || 'Cipher';
    const missionSummaries = offers.length > 0
      ? offers.map(offer => {
        const jurisdictions = offer.countryCount === 1 ? 'single jurisdiction' : `${offer.countryCount} jurisdictions`;
        return `[${offer.title}] difficulty ${offer.difficulty}/5, ${offer.suspectCount} suspects, ${getStartingHours(offer.difficulty)} hours, ${getStartingCredits(offer.difficulty)} travel credits, ${jurisdictions} — ${offer.summary}`;
      }).join(' || ')
      : 'No dossiers are open on the desk right now.';

    const dynamicVariables: Record<string, string> = {
      detective_codename: codename,
      player_solved: String(player.solvedCases),
      mission_summaries: missionSummaries,
      hidden_offer_count: String(hiddenOfferCount),
    };

    const config: AgentConfig = {
      agentId: agentId || '',
      signedUrl,
      characterName: 'Vivienne',
      characterRole: 'handler',
    };

    return c.json({
      ...config,
      mode: 'board',
      dynamicVariables,
      offers,
      hiddenOfferCount,
      player,
    });
  });

  // GET /api/game/handler-config
  app.get('/api/game/handler-config', async (c) => {
    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (!session) {
      return c.json({ error: 'No active game session' }, 404);
    }
    if (session.status === 'failed') {
      return c.json({ error: FAILED_HANDLER_DEBRIEF_REASON }, 409);
    }
    if (session.status !== 'active') {
      return c.json({ error: CASE_CLOSED_REASON }, 409);
    }
    if (Number(session.support_calls_remaining || 0) <= 0) {
      return c.json({ error: HANDLER_SUPPORT_REASON }, 409);
    }

    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(session.case_id) as any;
    if (!caseRow) {
      return c.json({ error: 'Case not found' }, 404);
    }

    const agentId = await ensureHandlerAgentId(session.case_id);

    const config: AgentConfig = {
      agentId: agentId || '',
      signedUrl: await getSignedConversationUrl(agentId || null),
      characterName: 'Vivienne',
      characterRole: 'handler',
    };

    db.prepare(
      `UPDATE game_session
       SET support_calls_remaining = support_calls_remaining - 1, updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(playerId);

    const refreshedSession = getPlayerSession(playerId);

    const dynamicVariables = buildMissionHandlerDynamicVariables(playerId, refreshedSession, caseRow);

    return c.json({
      ...config,
      systemPrompt: caseRow.handler_system_prompt,
      dynamicVariables,
      supportCallsRemaining: Math.max(0, Number(refreshedSession?.support_calls_remaining || 0)),
    });
  });

  app.get('/api/game/handler-config/failure', async (c) => {
    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (!session) {
      return c.json({ error: 'No active game session' }, 404);
    }
    if (session.status !== 'failed') {
      return c.json({ error: 'This debrief channel is only available after a failed warrant.' }, 409);
    }

    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(session.case_id) as any;
    if (!caseRow) {
      return c.json({ error: 'Case not found' }, 404);
    }

    const discoveredClueRows = db.prepare('SELECT * FROM clues WHERE case_id = ?').all(session.case_id) as any[];
    const failedWarrant = buildWarrantState(discoveredClueRows);
    const player = getPlayerProgress(playerId);
    const codename = (player.displayName ?? '').trim() || 'Cipher';

    const agentId = await ensureHandlerAgentId(session.case_id);

    const config: AgentConfig = {
      agentId: agentId || '',
      signedUrl: await getSignedConversationUrl(agentId || null),
      characterName: 'Vivienne',
      characterRole: 'handler',
    };

    const dynamicVariables = {
      ...buildMissionHandlerDynamicVariables(playerId, session, caseRow),
      case_status: 'failed',
      handler_mode: 'post_failure_debrief',
      handler_opening_line: `Agent ${codename}. Unpleasant outcome. I didn't expect someone of your caliber to miss on a case this simple, but here we are. The file is closed. If you have something to say, say it now.`,
      opening_brief: `Let's keep this clean, Agent ${codename}. You moved on ${failedWarrant.routeClues} route lead${failedWarrant.routeClues === 1 ? '' : 's'}, ${failedWarrant.suspectClues} direct suspect lead${failedWarrant.suspectClues === 1 ? '' : 's'}, and ${failedWarrant.corroboratingClues} corroborating piece${failedWarrant.corroboratingClues === 1 ? '' : 's'} of intel. Start by separating movement from identification: route evidence can move the file, but it cannot name the culprit. Review what was verified, what was only suggestive, and why the suspect line never actually closed.`,
      current_objective: 'Debrief the failed warrant. Explain why the mission is closed and answer questions using only the evidence already on file.',
    };

    return c.json({
      ...config,
      systemPrompt: caseRow.handler_system_prompt,
      dynamicVariables,
      supportCallsRemaining: Math.max(0, Number(session?.support_calls_remaining || 0)),
    });
  });

  app.get('/api/game/handler-config/victory', async (c) => {
    const playerId = getPlayerId(c);
    const session = getPlayerSession(playerId);
    if (!session) {
      return c.json({ error: 'No active game session' }, 404);
    }
    if (session.status !== 'solved') {
      return c.json({ error: 'This wrap-up channel is only available after a successful warrant.' }, 409);
    }

    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(session.case_id) as any;
    if (!caseRow) {
      return c.json({ error: 'Case not found' }, 404);
    }

    const discoveredClueRows = db.prepare('SELECT * FROM clues WHERE case_id = ?').all(session.case_id) as any[];
    const closedWarrant = buildWarrantState(discoveredClueRows);
    const player = getPlayerProgress(playerId);
    const codename = (player.displayName ?? '').trim() || 'Cipher';

    const culprit = db.prepare('SELECT name FROM suspects WHERE id = ?').get(caseRow.correct_suspect_id) as any;
    const culpritName = culprit?.name || 'the target';

    const agentId = await ensureHandlerAgentId(session.case_id);

    const config: AgentConfig = {
      agentId: agentId || '',
      signedUrl: await getSignedConversationUrl(agentId || null),
      characterName: 'Vivienne',
      characterRole: 'handler',
    };

    const dynamicVariables = {
      ...buildMissionHandlerDynamicVariables(playerId, session, caseRow),
      case_status: 'solved',
      handler_mode: 'post_victory_debrief',
      warrant_status: 'solved',
      handler_opening_line: `Agent ${codename}. Clean work. ${culpritName} is in custody and the file is sealed. Take the win — and tell me how you read the case.`,
      opening_brief: `Good close, Agent ${codename}. You landed the warrant on ${culpritName} with ${closedWarrant.routeClues} route lead${closedWarrant.routeClues === 1 ? '' : 's'}, ${closedWarrant.suspectClues} direct suspect lead${closedWarrant.suspectClues === 1 ? '' : 's'}, and ${closedWarrant.corroboratingClues} corroborating piece${closedWarrant.corroboratingClues === 1 ? '' : 's'} of intel on file. The case is closed — this channel is for the wrap-up, not new moves. Walk me through what tipped you, what nearly threw you, and where you'd sharpen the read next time.`,
      current_objective: 'Run the victory wrap-up. Acknowledge the close, reflect on the read of the evidence, and stay in past tense — no new investigative actions.',
    };

    return c.json({
      ...config,
      systemPrompt: caseRow.handler_system_prompt,
      dynamicVariables,
      supportCallsRemaining: Math.max(0, Number(session?.support_calls_remaining || 0)),
    });
  });

  app.post('/api/game/handler-memory', async (c) => {
    try {
      const playerId = getPlayerId(c);
      const session = getPlayerSession(playerId);
      if (!session) {
        return c.json({ error: 'No active game session' }, 404);
      }

      const body = await c.req.json();
      const transcript = Array.isArray(body?.transcript)
        ? body.transcript.filter(isHandlerMemoryTranscriptEntry)
        : [];

      if (transcript.length === 0) {
        return c.json({ ok: true, saved: false, note: null });
      }

      const note = await saveHandlerCallMemory(session.case_id, playerId, transcript);
      return c.json({ ok: true, saved: !!note, note });
    } catch (err: any) {
      console.error('Failed to persist handler memory:', err);
      return c.json({ error: err?.message || 'Failed to persist handler memory' }, 500);
    }
  });

  // GET /api/assets/image/:id
  app.get('/api/assets/image/:id', (c) => {
    const assetId = c.req.param('id');
    const asset = db.prepare('SELECT data, mime_type FROM generated_assets WHERE id = ?').get(assetId) as any;

    if (!asset) {
      return c.json({ error: 'Asset not found' }, 404);
    }

    return new Response(asset.data, {
      headers: { 'Content-Type': asset.mime_type },
    });
  });

  // GET /api/assets/sound/:id
  app.get('/api/assets/sound/:id', (c) => {
    const assetId = c.req.param('id');
    const asset = db.prepare('SELECT data, mime_type FROM generated_assets WHERE id = ?').get(assetId) as any;

    if (!asset) {
      return c.json({ error: 'Asset not found' }, 404);
    }

    return new Response(asset.data, {
      headers: { 'Content-Type': asset.mime_type },
    });
  });
}

// Helper functions

function getPlayerId(c: Context): string {
  const headerValue = c.req.header(PLAYER_ID_HEADER)?.trim();
  return headerValue || FALLBACK_PLAYER_ID;
}

function getPlayerSession(playerId: string): any | null {
  const session = db.prepare('SELECT * FROM game_session WHERE user_id = ?').get(playerId) as any;
  if (session) return session;
  if (playerId === FALLBACK_PLAYER_ID) return null;

  const legacySession = db.prepare('SELECT * FROM game_session WHERE user_id = ?').get(LEGACY_GAME_SESSION_PLAYER_ID) as any;
  if (!legacySession) return null;

  db.prepare("UPDATE game_session SET user_id = ?, updated_at = datetime('now') WHERE user_id = ?")
    .run(playerId, LEGACY_GAME_SESSION_PLAYER_ID);

  return db.prepare('SELECT * FROM game_session WHERE user_id = ?').get(playerId) as any;
}

function queueCaseProvisioning(caseId: string, caseSource: 'seed' | 'ai', cities: any[], witnesses: any[]): void {
  const tasks: Promise<unknown>[] = [];
  const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
  const allowSeedImages = process.env.ENABLE_SEED_IMAGE_GENERATION === 'true';
  const shouldGenerateImages = hasImageGenerationConfig() && (caseSource === 'ai' || allowSeedImages);

  if (shouldGenerateImages) {
    for (const witness of witnesses) {
      tasks.push(generateWitnessPortrait(witness.id, witness.name, witness.personality));
    }

    for (const city of cities) {
      tasks.push(generateCityScene(city.id, city.name, city.country));
      tasks.push(generateCityPanorama(city.id, city.name, city.country));
    }
  }

  if (hasElevenLabsKey) {
    for (const city of cities) {
      tasks.push(generateCityAmbientSound(city.id, city.name, city.country));
    }

    /* Witness voices are designed lazily on first call so the description
       (gender, accent, tone) actually drives the synthesis. */

    tasks.push(createHandlerAgent(caseId));
  }

  if (tasks.length === 0) return;

  void Promise.allSettled(tasks).then(results => {
    const failedTasks = results.filter(result => result.status === 'rejected').length;
    if (failedTasks > 0) {
      console.warn(`Case provisioning finished with ${failedTasks} rejected tasks for ${caseId}`);
    }
  });
}

function buildCityResponse(city: any) {
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    lat: city.latitude,
    lng: city.longitude,
    sceneImageUrl: city.scene_image_id ? `/api/assets/image/${city.scene_image_id}` : null,
    panorama360Url: city.panorama_image_id ? `/api/assets/image/${city.panorama_image_id}` : null,
    ambientSoundUrl: city.ambient_sound_id ? `/api/assets/sound/${city.ambient_sound_id}` : null,
    visitOrder: city.visit_order,
    unlocked: city.unlocked === 1,
    visited: city.visited === 1,
  };
}

function startCaseSession(playerId: string, caseId: string) {
  const cities = db.prepare('SELECT * FROM cities WHERE case_id = ?').all(caseId) as any[];
  const witnesses = db.prepare('SELECT * FROM witnesses WHERE case_id = ?').all(caseId) as any[];
  const firstCity = cities.find((ci: any) => ci.visit_order === 1);
  const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as any;
  const caseDifficulty = normalizeCaseDifficulty(caseRow?.difficulty);
  const totalHours = getStartingHours(caseDifficulty);
  const totalCredits = getStartingCredits(caseDifficulty);
  const supportCalls = getSupportCalls(caseDifficulty);

  db.prepare('DELETE FROM game_session WHERE user_id = ?').run(playerId);
  db.prepare(
    `INSERT INTO game_session (
      user_id,
      case_id,
      current_city_id,
      status,
      remaining_hours,
      total_hours,
      remaining_credits,
      total_credits,
      support_calls_remaining,
      city_visit_token
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(playerId, caseId, firstCity?.id || null, 'active', totalHours, totalHours, totalCredits, totalCredits, supportCalls, 1);

  if (firstCity) {
    db.prepare('UPDATE cities SET visited = 1, unlocked = 1 WHERE id = ?').run(firstCity.id);
  }

  const suspects = db.prepare('SELECT * FROM suspects WHERE case_id = ?').all(caseId) as any[];

  queueCaseProvisioning(caseId, normalizeCaseSource(caseRow?.source), cities, witnesses);

  return {
    caseId,
    crimeDescription: caseRow.crime_description,
    status: 'active',
    currentCityId: firstCity?.id || null,
    suspects: suspects.map((s: any) => ({ id: s.id, name: s.name, description: null, profiled: false, evidenceCount: 0 })),
    firstCity: firstCity ? buildCityResponse(firstCity) : null,
    resources: {
      remainingHours: totalHours,
      totalHours,
      remainingCredits: totalCredits,
      totalCredits,
      supportCallsRemaining: supportCalls,
    },
  };
}

function buildMissionSnapshot(
  session: any,
  templateId: string,
  status: MissionOfferStatus,
) {
  return {
    templateId,
    caseId: String(session.case_id),
    status,
    currentCityId: session.current_city_id || null,
    remainingHours: Math.max(0, Number(session?.remaining_hours || 0)),
    totalHours: Math.max(0, Number(session?.total_hours || 0)),
    remainingCredits: Math.max(0, Number(session?.remaining_credits || 0)),
    totalCredits: Math.max(0, Number(session?.total_credits || 0)),
    supportCallsRemaining: Math.max(0, Number(session?.support_calls_remaining || 0)),
    cityVisitToken: getSessionCityVisitToken(session),
  };
}

function buildArchivedGameState(
  playerId: string,
  snapshot: NonNullable<ReturnType<typeof getPlayerMissionSnapshot>>,
): GameState | null {
  return buildGameState({
    user_id: playerId,
    case_id: snapshot.caseId,
    status: snapshot.status,
    current_city_id: snapshot.currentCityId,
    remaining_hours: snapshot.remainingHours,
    total_hours: snapshot.totalHours,
    remaining_credits: snapshot.remainingCredits,
    total_credits: snapshot.totalCredits,
    support_calls_remaining: snapshot.supportCallsRemaining,
    city_visit_token: snapshot.cityVisitToken,
  });
}

function normalizeClosedMissionStatus(status: unknown): MissionOfferStatus | null {
  return status === 'failed' || status === 'solved' || status === 'abandoned'
    ? status
    : null;
}

function buildMissionHandlerDynamicVariables(playerId: string, session: any, caseRow: any): Record<string, string> {
  const player = getPlayerProgress(playerId);
  const codename = (player.displayName ?? '').trim() || 'Cipher';
  const cities = db.prepare('SELECT * FROM cities WHERE case_id = ? ORDER BY visit_order').all(session.case_id) as any[];
  const witnesses = db.prepare('SELECT * FROM witnesses WHERE case_id = ? ORDER BY name').all(session.case_id) as any[];
  const suspects = db.prepare('SELECT * FROM suspects WHERE case_id = ? ORDER BY name').all(session.case_id) as any[];
  const discoveredClues = db.prepare(
    'SELECT content FROM clues WHERE case_id = ? AND discovered = 1 ORDER BY discovered_at DESC'
  ).all(session.case_id) as Array<{ content: string }>;
  const currentCity = cities.find(city => city.id === session.current_city_id) || cities[0] || null;
  const memoryNotes = listHandlerCallMemory(session.case_id, playerId, 5);
  const handlerOpeningLine = session?.status === 'failed'
    ? `Agent ${codename}. Unpleasant outcome. I didn't expect someone of your caliber to miss on a case this simple, but here we are. The file is closed. If you have something to say, say it now.`
    : `Agent ${codename}, Vivienne from London Station. I have a mission for you - are you available?`;

  return {
    detective_codename: codename,
    handler_opening_line: handlerOpeningLine,
    case_status: String(session?.status || 'active'),
    case_title: resolveCaseTitle(caseRow),
    case_summary: resolveCaseSummary(caseRow),
    persons_of_interest: formatPersonsOfInterest(suspects),
    case_witness_roster: formatCaseWitnessRoster(cities, witnesses),
    current_city_witnesses: formatCurrentCityWitnesses(currentCity, witnesses),
    stored_call_memory: formatStoredCallMemory(memoryNotes),
    discovered_clues_summary: formatDiscoveredClueSummary(discoveredClues),
    remaining_hours: String(Math.max(0, Number(session?.remaining_hours || 0))),
    remaining_credits: String(Math.max(0, Number(session?.remaining_credits || 0))),
    support_calls_remaining: String(Math.max(0, Number(session?.support_calls_remaining || 0))),
  };
}

function normalizeCaseSource(source: unknown): 'seed' | 'ai' {
  return source === 'ai' ? 'ai' : 'seed';
}

function normalizeCaseDifficulty(value: unknown): number {
  const difficulty = typeof value === 'number' ? value : Number(value || 1);
  return Math.max(1, Math.min(5, Math.round(difficulty || 1)));
}

function normalizeCaseMinLevel(value: unknown): number {
  const minLevel = typeof value === 'number' ? value : Number(value || 1);
  return Math.max(1, Math.round(minLevel || 1));
}

function resolveCaseTitle(caseRow: any): string {
  if (typeof caseRow?.template_title === 'string' && caseRow.template_title.trim()) {
    return caseRow.template_title.trim();
  }

  const description = typeof caseRow?.crime_description === 'string'
    ? caseRow.crime_description.trim()
    : '';
  if (!description) return 'Active Assignment';

  const firstSentence = description.split(/[.!?]/)[0]?.trim();
  return firstSentence || 'Active Assignment';
}

function resolveCaseSummary(caseRow: any): string {
  const raw = typeof caseRow?.raw_case_json === 'string' ? caseRow.raw_case_json.trim() : '';
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { crime?: { summary?: unknown; description?: unknown } };
      const summary = typeof parsed?.crime?.summary === 'string' ? parsed.crime.summary.trim() : '';
      if (summary) return summary;
      const description = typeof parsed?.crime?.description === 'string' ? parsed.crime.description.trim() : '';
      if (description) return description;
    } catch {
      // Fall back to the stored column below.
    }
  }

  const description = typeof caseRow?.crime_description === 'string'
    ? caseRow.crime_description.trim()
    : '';
  return description || 'No additional case summary on file.';
}

function resolveCaseSlug(caseRow: any): string {
  if (typeof caseRow?.template_slug === 'string' && caseRow.template_slug.trim()) {
    return caseRow.template_slug.trim();
  }

  const title = resolveCaseTitle(caseRow);
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `case-${String(caseRow?.id || 'active').slice(0, 8).toLowerCase()}`;
}

function resolveCaseTemplateId(caseRow: any): string | null {
  if (typeof caseRow?.template_id === 'string' && caseRow.template_id.trim()) {
    return caseRow.template_id.trim();
  }

  return null;
}

function formatPersonsOfInterest(suspects: any[]): string {
  if (suspects.length === 0) return 'No persons of interest on file.';
  return suspects
    .map((suspect: any) => `${suspect.name}: ${String(suspect.description || '').replace(/\s+/g, ' ').trim()}`)
    .join(' || ');
}

function formatCaseWitnessRoster(cities: any[], witnesses: any[]): string {
  if (witnesses.length === 0) return 'No witnesses on file.';

  const cityNameById = new Map(cities.map((city: any) => [city.id, city.name]));
  return witnesses.map((witness: any) => {
    const cityName = cityNameById.get(witness.city_id) || 'Unknown city';
    const personality = String(witness.personality || '').replace(/\s+/g, ' ').trim();
    const backstory = String(witness.backstory || '').replace(/\s+/g, ' ').trim();
    return `${witness.name} in ${cityName}: ${personality}. ${backstory}`;
  }).join(' || ');
}

function formatCurrentCityWitnesses(currentCity: any, witnesses: any[]): string {
  if (!currentCity) return 'Current city not assigned yet.';

  const currentWitnesses = witnesses.filter((witness: any) => witness.city_id === currentCity.id);
  if (currentWitnesses.length === 0) {
    return `No witnesses currently registered in ${currentCity.name}.`;
  }

  return currentWitnesses.map((witness: any) => {
    const personality = String(witness.personality || '').replace(/\s+/g, ' ').trim();
    const backstory = String(witness.backstory || '').replace(/\s+/g, ' ').trim();
    return `${witness.name}: ${personality}. ${backstory}`;
  }).join(' || ');
}

function formatStoredCallMemory(notes: string[]): string {
  if (notes.length === 0) return 'No prior handler-call summaries on file for this mission.';
  return notes.map((note, index) => `Memory ${index + 1}: ${note}`).join(' || ');
}

function formatWitnessCallMemory(notes: string[]): string {
  if (notes.length === 0) return 'No prior witness-call summaries on file for this detective.';
  return notes.map((note, index) => `Memory ${index + 1}: ${note}`).join(' || ');
}

function formatDiscoveredClueSummary(clues: Array<{ content: string }>): string {
  if (clues.length === 0) return 'No discovered clues on file yet.';
  return clues.slice(0, 6).map(clue => clue.content.replace(/\s+/g, ' ').trim()).join(' || ');
}

function buildWitnessDynamicVariables(
  playerId: string,
  session: any,
  witness: { id: string; name: string },
): Record<string, string> {
  const player = getPlayerProgress(playerId);
  const codename = (player.displayName ?? '').trim() || 'Cipher';
  const memoryNotes = listWitnessCallMemory(session.case_id, playerId, witness.id, 4);
  const confirmedClues = db.prepare(
    'SELECT content FROM clues WHERE case_id = ? AND witness_id = ? AND discovered = 1 ORDER BY discovered_at DESC'
  ).all(session.case_id, witness.id) as Array<{ content: string }>;
  const hasTalkedThisVisit = hasWitnessContactedThisVisit(
    session.case_id,
    playerId,
    witness.id,
    getSessionCityVisitToken(session),
  );

  return {
    detective_codename: codename,
    stored_witness_memory: formatWitnessCallMemory(memoryNotes),
    known_witness_intel: formatDiscoveredClueSummary(confirmedClues),
    witness_visit_status: hasTalkedThisVisit
      ? 'This detective already spoke with you once during the current city visit.'
      : 'This is the first live call with this detective during the current city visit.',
  };
}

function isHandlerMemoryTranscriptEntry(value: unknown): value is HandlerMemoryTranscriptEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as HandlerMemoryTranscriptEntry;
  return (entry.role === 'agent' || entry.role === 'user') && typeof entry.text === 'string';
}

function getSessionCityVisitToken(session: any): number {
  return Math.max(1, Number(session?.city_visit_token || 1));
}

function getWitnessContactedSet(caseId: string, userId: string, cityVisitToken: number): Set<string> {
  const rows = db.prepare(`
    SELECT witness_id
    FROM witness_visit_contacts
    WHERE user_id = ? AND case_id = ? AND city_visit_token = ?
  `).all(userId, caseId, cityVisitToken) as Array<{ witness_id: string }>;

  return new Set(rows.map(row => row.witness_id));
}

function hasWitnessContactedThisVisit(
  caseId: string,
  userId: string,
  witnessId: string,
  cityVisitToken: number,
): boolean {
  const row = db.prepare(`
    SELECT 1
    FROM witness_visit_contacts
    WHERE user_id = ? AND case_id = ? AND witness_id = ? AND city_visit_token = ?
  `).get(userId, caseId, witnessId, cityVisitToken) as { 1: number } | undefined;

  return !!row;
}

function confirmWitnessConversation(
  caseId: string,
  userId: string,
  witnessId: string,
  cityVisitToken: number,
): { confirmedClues: number; unlockedCityIds: string[] } {
  const allWitnessClues = db.prepare(
    'SELECT id, points_to_city_id, discovered FROM clues WHERE case_id = ? AND witness_id = ?'
  ).all(caseId, witnessId) as Array<{ id: string; points_to_city_id: string | null; discovered: number }>;
  const undiscoveredClues = allWitnessClues.filter(clue => clue.discovered !== 1);
  const unlockedCityIds = [...new Set(allWitnessClues.map(clue => clue.points_to_city_id).filter(Boolean))] as string[];

  const commitConversation = db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO witness_visit_contacts (user_id, case_id, witness_id, city_visit_token)
      VALUES (?, ?, ?, ?)
    `).run(userId, caseId, witnessId, cityVisitToken);

    db.prepare(`
      UPDATE clues
      SET discovered = 1,
          discovered_at = COALESCE(discovered_at, datetime('now'))
      WHERE case_id = ? AND witness_id = ?
    `).run(caseId, witnessId);

    for (const cityId of unlockedCityIds) {
      db.prepare('UPDATE cities SET unlocked = 1 WHERE id = ? AND case_id = ?').run(cityId, caseId);
    }
  });

  commitConversation();
  return {
    confirmedClues: undiscoveredClues.length,
    unlockedCityIds,
  };
}

function buildGenericClueLead(clue: any): string {
  if (clue.points_to_city_id) {
    return clue.is_misleading === 1
      ? 'Unverified route lead. This witness may push the trail toward the wrong city.'
      : 'Route lead. This witness may know where the trail moves next.';
  }

  if (clue.points_to_suspect_id) {
    return clue.is_misleading === 1
      ? 'Unverified suspect lead. This witness may point at the wrong person.'
      : 'Suspect lead. This witness may be able to narrow the suspect field.';
  }

  return clue.is_misleading === 1
    ? 'Unverified corroboration lead. This witness may add noise to the timeline.'
    : 'Corroboration lead. This witness may confirm part of the timeline or motive.';
}

async function getSignedConversationUrl(agentId: string | null): Promise<string | null> {
  if (!hasElevenLabsApiKey() || !agentId) return null;

  try {
    const client = createElevenLabsClient();
    const payload = await client.conversationalAi.conversations.getSignedUrl({ agentId });
    return payload.signedUrl || null;
  } catch (error) {
    console.error(`ElevenLabs signed URL request error for ${agentId}:`, error);
    return null;
  }
}

async function ensureHandlerAgentId(caseId: string): Promise<string | null> {
  const caseRow = db.prepare('SELECT handler_agent_id FROM cases WHERE id = ?').get(caseId) as any;
  if (!caseRow) return null;
  if (caseRow.handler_agent_id) {
    await syncHandlerAgent(caseId, caseRow.handler_agent_id);
    return caseRow.handler_agent_id;
  }
  if (!hasElevenLabsApiKey()) return null;

  await createHandlerAgent(caseId);

  const refreshedCase = db.prepare('SELECT handler_agent_id FROM cases WHERE id = ?').get(caseId) as any;
  return refreshedCase?.handler_agent_id || null;
}

function buildFullCity(city: any, allWitnesses: any[]): City {
  const cityWitnesses = allWitnesses.filter((w: any) => w.city_id === city.id);
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    lat: city.latitude,
    lng: city.longitude,
    sceneImageUrl: city.scene_image_id ? `/api/assets/image/${city.scene_image_id}` : null,
    panorama360Url: city.panorama_image_id ? `/api/assets/image/${city.panorama_image_id}` : null,
    ambientSoundUrl: city.ambient_sound_id ? `/api/assets/sound/${city.ambient_sound_id}` : null,
    visitOrder: city.visit_order,
    visited: city.visited === 1,
    unlocked: city.unlocked === 1,
    witnessCount: cityWitnesses.length,
    travelHours: null,
    travelCost: null,
    witnesses: cityWitnesses.map((w: any) => ({
      id: w.id,
      name: w.name,
      personality: w.personality,
      backstory: w.backstory,
      portraitImageUrl: w.portrait_image_id ? `/api/assets/image/${w.portrait_image_id}` : null,
      agentId: w.agent_id || null,
      voiceDescription: w.voice_description,
      leadCount: 0,
      hasTalkedThisVisit: false,
      talkLockedReason: null,
    })),
  };
}

function buildGameState(session: any): GameState | null {
  const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(session.case_id) as any;
  if (!caseRow) return null;

  const missionNotes = db.prepare(
    `SELECT id, context_type, context_id, context_label, content, created_at, updated_at
     FROM mission_note_entries
     WHERE case_id = ? AND user_id = ?
     ORDER BY created_at DESC`
  ).all(session.case_id, session.user_id) as Array<{
    id: string;
    context_type: string;
    context_id: string | null;
    context_label: string | null;
    content: string;
    created_at: string;
    updated_at: string;
  }>;
  const witnessCallHistoryRows = db.prepare(
    `SELECT id, witness_id, note, transcript, created_at
     FROM witness_call_memory
     WHERE case_id = ? AND user_id = ?
     ORDER BY created_at DESC`
  ).all(session.case_id, session.user_id) as Array<{
    id: string;
    witness_id: string;
    note: string;
    transcript: string | null;
    created_at: string;
  }>;
  const cities = db.prepare('SELECT * FROM cities WHERE case_id = ? ORDER BY visit_order').all(session.case_id) as any[];
  const witnesses = db.prepare('SELECT * FROM witnesses WHERE case_id = ?').all(session.case_id) as any[];
  const suspects = db.prepare('SELECT * FROM suspects WHERE case_id = ? ORDER BY name').all(session.case_id) as any[];
  const allClues = db.prepare('SELECT * FROM clues WHERE case_id = ?').all(session.case_id) as any[];
  const currentCity = cities.find((city: any) => city.id === session.current_city_id) || cities[0] || null;
  const visibleCityIds = new Set(
    cities
      .filter((city: any) => city.visited === 1 || city.id === session.current_city_id)
      .map((city: any) => city.id),
  );
  const visibleWitnessIds = new Set(
    witnesses
      .filter((witness: any) => visibleCityIds.has(witness.city_id))
      .map((witness: any) => witness.id),
  );
  const contactedWitnessIds = getWitnessContactedSet(
    session.case_id,
    session.user_id,
    getSessionCityVisitToken(session),
  );
  const discoveredClueRows = allClues.filter((clue: any) => clue.discovered === 1);
  const visibleClueRows = allClues.filter((clue: any) => clue.discovered === 1 || (clue.witness_id && visibleWitnessIds.has(clue.witness_id)));
  const evidenceBySuspectId = countSuspectEvidence(discoveredClueRows);
  const resources = buildResourceSnapshot(session);
  const handler = buildHandlerState(session);
  const leadCountByWitnessId = new Map<string, number>();
  const strandedWarrantOverride = shouldAllowStrandedWarrant(session, cities, witnesses, contactedWitnessIds);
  const warrant = buildWarrantState(discoveredClueRows, { strandedOverride: strandedWarrantOverride });

  for (const clue of visibleClueRows) {
    if (!clue.witness_id) continue;
    leadCountByWitnessId.set(clue.witness_id, (leadCountByWitnessId.get(clue.witness_id) || 0) + 1);
  }

  const gameCities = cities.map((city: any) => {
    const cityState = buildFullCity(city, witnesses);
    const shouldRevealWitnesses = city.visited === 1 || city.id === session.current_city_id;
    const visibleWitnesses = shouldRevealWitnesses
      ? cityState.witnesses.map((witness) => ({
          ...witness,
          leadCount: leadCountByWitnessId.get(witness.id) || 0,
          hasTalkedThisVisit: city.id === session.current_city_id && contactedWitnessIds.has(witness.id),
          talkLockedReason: city.id === session.current_city_id && contactedWitnessIds.has(witness.id)
            ? WITNESS_REVISIT_REASON
            : null,
        }))
      : [];
    const travelCost = city.id !== currentCity?.id && city.unlocked === 1
      ? calculateTravelCost(currentCity, city)
      : null;

    return {
      ...cityState,
      witnesses: visibleWitnesses,
      travelHours: travelCost?.hours ?? null,
      travelCost: travelCost?.credits ?? null,
    } satisfies City;
  });

  return {
    caseId: session.case_id,
    status: session.status,
    currentCityId: session.current_city_id,
    case: {
      id: caseRow.id,
      title: resolveCaseTitle(caseRow),
      slug: resolveCaseSlug(caseRow),
      source: normalizeCaseSource(caseRow.source),
      difficulty: normalizeCaseDifficulty(caseRow.difficulty),
      minLevel: normalizeCaseMinLevel(caseRow.min_level),
      crimeDescription: caseRow.crime_description,
      handlerAgentId: caseRow.handler_agent_id || null,
      cities: gameCities,
      suspects: suspects.map((suspect: any) => {
        const evidenceCount = evidenceBySuspectId.get(suspect.id) || 0;
        return {
          id: suspect.id,
          name: suspect.name,
          description: evidenceCount > 0 ? suspect.description : null,
          profiled: evidenceCount > 0,
          evidenceCount,
        };
      }),
    },
    discoveredClues: visibleClueRows.map((clue: any) => ({
      id: clue.id,
      witnessId: clue.witness_id,
      content: clue.discovered === 1 ? clue.content : buildGenericClueLead(clue),
      isMisleading: clue.is_misleading === 1,
      pointsToCityId: clue.points_to_city_id,
      pointsToSuspectId: clue.points_to_suspect_id,
      discoveredAt: clue.discovered_at,
      kind: getClueKind(clue),
    })),
    missionNotes: missionNotes.map(row => ({
      id: row.id,
      contextType: (row.context_type as any) || 'general',
      contextId: row.context_id,
      contextLabel: row.context_label,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    witnessCallHistory: witnessCallHistoryRows.map(row => ({
      id: row.id,
      witnessId: row.witness_id,
      note: row.note,
      transcript: parseWitnessTranscript(row.transcript),
      createdAt: row.created_at,
    })),
    resources,
    handler,
    warrant,
  };
}

function parseWitnessTranscript(raw: string | null): Array<{ role: 'agent' | 'user'; text: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: any) => ({
        role: entry?.role === 'user' ? 'user' : 'agent',
        text: typeof entry?.text === 'string' ? entry.text : '',
      }))
      .filter(entry => entry.text.length > 0) as Array<{ role: 'agent' | 'user'; text: string }>;
  } catch {
    return [];
  }
}

function normalizeMissionNotesContent(raw: unknown): string {
  if (typeof raw !== 'string') {
    return '';
  }

  return raw.replace(/\r\n/g, '\n').slice(0, MISSION_NOTES_MAX_CHARS);
}

const ALLOWED_NOTE_CONTEXTS = new Set(['general', 'city', 'witness', 'clue']);

function resolveNoteContext(body: any, session: any): {
  contextType: 'general' | 'city' | 'witness' | 'clue';
  contextId: string | null;
  contextLabel: string | null;
} {
  const requestedType = typeof body?.contextType === 'string' && ALLOWED_NOTE_CONTEXTS.has(body.contextType)
    ? body.contextType as 'general' | 'city' | 'witness' | 'clue'
    : 'general';
  const requestedId = typeof body?.contextId === 'string' && body.contextId.trim() ? body.contextId.trim() : null;

  if (requestedType === 'general' || !requestedId) {
    return { contextType: 'general', contextId: null, contextLabel: null };
  }

  if (requestedType === 'city') {
    const city = db.prepare(
      'SELECT id, name, country FROM cities WHERE id = ? AND case_id = ?'
    ).get(requestedId, session.case_id) as { id: string; name: string; country: string } | undefined;
    if (!city) return { contextType: 'general', contextId: null, contextLabel: null };
    return { contextType: 'city', contextId: city.id, contextLabel: `${city.name}, ${city.country}` };
  }

  if (requestedType === 'witness') {
    const witness = db.prepare(
      `SELECT w.id, w.name, c.name AS city_name
       FROM witnesses w
       JOIN cities c ON c.id = w.city_id
       WHERE w.id = ? AND w.case_id = ?`
    ).get(requestedId, session.case_id) as { id: string; name: string; city_name: string } | undefined;
    if (!witness) return { contextType: 'general', contextId: null, contextLabel: null };
    return { contextType: 'witness', contextId: witness.id, contextLabel: `${witness.name} · ${witness.city_name}` };
  }

  if (requestedType === 'clue') {
    const clue = db.prepare(
      'SELECT id, content FROM clues WHERE id = ? AND case_id = ? AND discovered = 1'
    ).get(requestedId, session.case_id) as { id: string; content: string } | undefined;
    if (!clue) return { contextType: 'general', contextId: null, contextLabel: null };
    const snippet = clue.content.length > 60 ? `${clue.content.slice(0, 57)}...` : clue.content;
    return { contextType: 'clue', contextId: clue.id, contextLabel: snippet };
  }

  return { contextType: 'general', contextId: null, contextLabel: null };
}

function getNoteEntry(id: string) {
  const row = db.prepare(
    `SELECT id, context_type, context_id, context_label, content, created_at, updated_at
     FROM mission_note_entries WHERE id = ?`
  ).get(id) as {
    id: string;
    context_type: string;
    context_id: string | null;
    context_label: string | null;
    content: string;
    created_at: string;
    updated_at: string;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    contextType: row.context_type,
    contextId: row.context_id,
    contextLabel: row.context_label,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildResourceSnapshot(session: any): MissionResources {
  return {
    remainingHours: Math.max(0, Number(session?.remaining_hours || 0)),
    totalHours: Math.max(0, Number(session?.total_hours || 0)),
    remainingCredits: Math.max(0, Number(session?.remaining_credits || 0)),
    totalCredits: Math.max(0, Number(session?.total_credits || 0)),
    supportCallsRemaining: Math.max(0, Number(session?.support_calls_remaining || 0)),
  };
}

function buildHandlerState(session: any): HandlerState {
  const supportCallsRemaining = Math.max(0, Number(session?.support_calls_remaining || 0));
  if (session?.status === 'failed') {
    return {
      canCall: false,
      supportCallsRemaining,
      reason: FAILED_HANDLER_DEBRIEF_REASON,
    };
  }
  if (session?.status === 'solved') {
    return {
      canCall: false,
      supportCallsRemaining,
      reason: SOLVED_HANDLER_REVIEW_REASON,
    };
  }
  if (session?.status === 'abandoned') {
    return {
      canCall: false,
      supportCallsRemaining,
      reason: ABANDONED_HANDLER_REVIEW_REASON,
    };
  }
  if (session?.status && session.status !== 'active') {
    return {
      canCall: false,
      supportCallsRemaining,
      reason: CASE_CLOSED_REASON,
    };
  }
  return {
    canCall: supportCallsRemaining > 0,
    supportCallsRemaining,
    reason: supportCallsRemaining > 0 ? null : HANDLER_SUPPORT_REASON,
  };
}

function getClosedWitnessReason(status: unknown): string {
  if (status === 'failed') return FAILED_WITNESS_CHANNEL_REASON;
  if (status === 'solved') return SOLVED_WITNESS_CHANNEL_REASON;
  if (status === 'abandoned') return ABANDONED_WITNESS_CHANNEL_REASON;
  return CASE_CLOSED_REASON;
}

function hasAffordableTravelOption(session: any, cities: any[], currentCity: any): boolean {
  return cities.some((city: any) => {
    if (city.id === currentCity.id || city.unlocked !== 1) return false;
    const travelCost = calculateTravelCost(currentCity, city);
    return Number(session?.remaining_hours || 0) >= travelCost.hours
      && Number(session?.remaining_credits || 0) >= travelCost.credits;
  });
}

function hasRemainingCurrentCityWitnesses(
  session: any,
  witnesses: any[],
  contactedWitnessIds: Set<string>,
): boolean {
  if (!session?.current_city_id) return false;
  return witnesses.some((witness: any) => witness.city_id === session.current_city_id && !contactedWitnessIds.has(witness.id));
}

function shouldAllowStrandedWarrant(
  session: any,
  cities: any[],
  witnesses: any[],
  contactedWitnessIds: Set<string>,
): boolean {
  if (session?.status !== 'active' || !session?.current_city_id) return false;
  const currentCity = cities.find((city: any) => city.id === session.current_city_id);
  if (!currentCity) return false;

  const hasTravelOption = hasAffordableTravelOption(session, cities, currentCity);
  const hasRemainingWitnesses = hasRemainingCurrentCityWitnesses(session, witnesses, contactedWitnessIds);
  return !hasTravelOption && !hasRemainingWitnesses;
}

function buildWarrantState(
  discoveredClues: any[],
  options?: { suspectId?: string; strandedOverride?: boolean },
): WarrantState {
  const suspectId = options?.suspectId;
  const routeClues = discoveredClues.filter((clue: any) => clue.discovered === 1 && clue.is_misleading !== 1 && clue.points_to_city_id).length;
  const suspectClues = discoveredClues.filter((clue: any) => {
    if (clue.discovered !== 1 || clue.is_misleading === 1 || !clue.points_to_suspect_id) return false;
    return suspectId ? clue.points_to_suspect_id === suspectId : true;
  }).length;
  const corroboratingClues = discoveredClues.filter((clue: any) => clue.discovered === 1 && clue.is_misleading !== 1 && !clue.points_to_city_id && !clue.points_to_suspect_id).length;
  const standardReady = routeClues > 0 && suspectClues > 0 && corroboratingClues > 0;
  const overrideMode = !standardReady && options?.strandedOverride ? 'stranded' : null;
  const ready = standardReady || overrideMode === 'stranded';

  return {
    ready,
    routeClues,
    suspectClues,
    corroboratingClues,
    overrideMode,
    reason: standardReady
      ? null
      : overrideMode === 'stranded'
        ? STRANDED_WARRANT_REASON
        : 'A valid warrant needs a route clue, a direct suspect clue, and one corroborating piece of intel.',
  };
}

function countSuspectEvidence(discoveredClues: any[]): Map<string, number> {
  const evidence = new Map<string, number>();
  for (const clue of discoveredClues) {
    if (!clue.points_to_suspect_id) continue;
    evidence.set(clue.points_to_suspect_id, (evidence.get(clue.points_to_suspect_id) || 0) + 1);
  }
  return evidence;
}

function getClueKind(clue: any): ClueKind {
  if (clue.points_to_city_id) return 'route';
  if (clue.points_to_suspect_id) return 'suspect';
  return 'corroboration';
}

function getStartingHours(difficulty: number): number {
  return [72, 60, 48, 40, 32][Math.max(0, Math.min(4, difficulty - 1))] || 72;
}

function getStartingCredits(difficulty: number): number {
  return [9, 8, 7, 6, 5][Math.max(0, Math.min(4, difficulty - 1))] || 9;
}

function getSupportCalls(difficulty: number): number {
  return difficulty >= 5 ? 1 : difficulty >= 3 ? 2 : 3;
}

function calculateTravelCost(currentCity: any, destinationCity: any): { hours: number; credits: number; distanceKm: number } {
  if (!currentCity) {
    return { hours: 0, credits: 0, distanceKm: 0 };
  }

  const distanceKm = haversineKm(currentCity.latitude, currentCity.longitude, destinationCity.latitude, destinationCity.longitude);
  if (distanceKm <= TRAVEL_SHORT_MAX_KM) {
    return { hours: 4, credits: 1, distanceKm };
  }
  if (distanceKm <= TRAVEL_REGIONAL_MAX_KM) {
    return { hours: 8, credits: 2, distanceKm };
  }
  return { hours: 14, credits: 3, distanceKm };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLng = toRad(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}
