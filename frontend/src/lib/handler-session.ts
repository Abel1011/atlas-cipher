import type { GameState } from '../types';

export interface TranscriptEntry {
  role: 'agent' | 'user';
  text: string;
}

interface StoredHandlerCall {
  id: string;
  createdAt: string;
  transcript: TranscriptEntry[];
}

interface StoredHandlerSession {
  detectiveCodename: string;
  cooldownUntil: string | null;
  calls: StoredHandlerCall[];
}

export interface HandlerSessionPlan {
  detectiveCodename: string;
  canCall: boolean;
  cooldownRemainingMs: number;
  reason: string | null;
  initialTranscript: TranscriptEntry[];
  startOptions: {
    userId: string;
    dynamicVariables: Record<string, string>;
  };
}

const STORAGE_PREFIX = 'atlas-cipher:handler-session';
const DEFAULT_DETECTIVE_CODENAME = 'Cipher';
const MAX_STORED_CALLS = 6;
const MAX_MEMORY_ENTRIES = 12;
const MAX_VISIBLE_HISTORY_ENTRIES = 16;

export function buildHandlerSessionPlan(gameState: GameState): HandlerSessionPlan {
  const stored = readSession(gameState.caseId);
  const detectiveCodename = stored.detectiveCodename || DEFAULT_DETECTIVE_CODENAME;
  const cooldownRemainingMs = 0;

  return {
    detectiveCodename,
    canCall: gameState.handler.canCall,
    cooldownRemainingMs,
    reason: gameState.handler.reason,
    initialTranscript: flattenCalls(stored.calls).slice(-MAX_VISIBLE_HISTORY_ENTRIES),
    startOptions: {
      userId: `${gameState.caseId}:control`,
      dynamicVariables: buildHandlerDynamicVariables(gameState, detectiveCodename, stored.calls),
    },
  };
}

export function persistHandlerSession(gameState: GameState, transcript: TranscriptEntry[], applyCooldown: boolean): void {
  if (!transcript.length || typeof window === 'undefined') return;

  const session = readSession(gameState.caseId);
  session.calls = [
    ...session.calls,
    {
      id: createId(),
      createdAt: new Date().toISOString(),
      transcript: transcript.slice(-MAX_VISIBLE_HISTORY_ENTRIES),
    },
  ].slice(-MAX_STORED_CALLS);

  // The handler stays callable; keep the field cleared for compatibility with older sessions.
  session.cooldownUntil = null;

  void applyCooldown;

  writeSession(gameState.caseId, session);
}

export function isHandlerOnCooldown(caseId: string): boolean {
  void caseId;
  return false;
}

export function getHandlerCooldownRemainingMs(caseId: string): number {
  void caseId;
  return 0;
}

export function formatHandlerCooldown(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function buildHandlerDynamicVariables(
  gameState: GameState,
  detectiveCodename: string,
  calls: StoredHandlerCall[]
): Record<string, string> {
  const currentCity = gameState.case.cities.find(city => city.id === gameState.currentCityId) || gameState.case.cities[0] || null;
  const visitedCities = gameState.case.cities.filter(city => city.visited).map(city => city.name).join(', ') || 'None yet';
  const recordedStatements = gameState.discoveredClues.filter(clue => !!clue.discoveredAt);
  const discoveredIntel = recordedStatements.length > 0
    ? recordedStatements.slice(-4).map(clue => clue.content).join(' | ')
    : 'No witness statements recorded yet.';
  const nextLead = currentCity
    ? `Push the investigation through ${currentCity.name} and extract any route, transfer, or suspect link that advances the chase.`
    : 'Direct the investigation toward the strongest unvisited city tied to the file.';
  const handlerOpeningLine = gameState.status === 'failed'
    ? `Agent ${detectiveCodename}. Unpleasant outcome. I didn't expect someone of your caliber to miss on a case this simple, but here we are. The file is closed. If you have something to say, say it now.`
    : `Agent ${detectiveCodename}, Vivienne from London Station. I have a mission for you - are you available?`;

  return {
    detective_codename: detectiveCodename,
    handler_opening_line: handlerOpeningLine,
    current_city: currentCity?.name || 'Unassigned',
    current_country: currentCity?.country || 'Unknown',
    visited_cities: visitedCities,
    current_objective: nextLead,
    recent_intel: discoveredIntel,
    remaining_hours: String(gameState.resources.remainingHours),
    remaining_credits: String(gameState.resources.remainingCredits),
    support_calls_remaining: String(gameState.resources.supportCallsRemaining),
    warrant_status: gameState.warrant.ready ? 'ready' : (gameState.warrant.reason ?? 'not ready'),
    previous_channel_memory: buildMemoryBlock(calls),
    opening_brief: buildOpeningBrief(gameState, detectiveCodename, currentCity),
  };
}

function buildOpeningBrief(
  gameState: GameState,
  detectiveCodename: string,
  currentCity: GameState['case']['cities'][number] | null,
): string {
  const cities = gameState.case.cities.map(city => city.name).join(', ');
  const suspects = gameState.case.suspects.map(suspect => suspect.name).join(', ');
  const recordedStatements = gameState.discoveredClues.filter(clue => !!clue.discoveredAt);
  const intelSummary = recordedStatements.length > 0
    ? `Witness statements on file: ${recordedStatements.slice(-2).map(clue => clue.content).join(' ')}`
    : 'We have no witness statements on file yet, so the first interview matters.';

  return `Good, Agent ${detectiveCodename}. Here's the file. ${gameState.case.crimeDescription} Your immediate lead is ${currentCity ? `${currentCity.name}, ${currentCity.country}` : 'the first city on the board'}. Cities in play: ${cities}. Suspects in the file: ${suspects}. You have ${gameState.resources.remainingHours} hours, ${gameState.resources.remainingCredits} credits, and ${gameState.resources.supportCallsRemaining} support windows left. ${intelSummary} Stay sharp, but don't rush into anything reckless.`;
}

function buildMemoryBlock(calls: StoredHandlerCall[]): string {
  const recentEntries = flattenCalls(calls).slice(-MAX_MEMORY_ENTRIES);
  if (recentEntries.length === 0) {
    return 'No previous calls on file for this mission.';
  }

  return recentEntries
    .map(entry => `${entry.role === 'user' ? 'Agent' : 'Vivienne'}: ${entry.text}`)
    .join('\n');
}

function flattenCalls(calls: StoredHandlerCall[]): TranscriptEntry[] {
  return calls.flatMap(call => call.transcript);
}

function getStorageKey(caseId: string): string {
  return `${STORAGE_PREFIX}:${caseId}`;
}

function readSession(caseId: string): StoredHandlerSession {
  if (typeof window === 'undefined') {
    return createEmptySession();
  }

  const raw = window.localStorage.getItem(getStorageKey(caseId));
  if (!raw) return createEmptySession();

  try {
    const parsed = JSON.parse(raw) as Partial<StoredHandlerSession>;
    return {
      detectiveCodename: typeof parsed.detectiveCodename === 'string' ? parsed.detectiveCodename : DEFAULT_DETECTIVE_CODENAME,
      cooldownUntil: null,
      calls: Array.isArray(parsed.calls)
        ? parsed.calls
            .map(call => ({
              id: typeof call?.id === 'string' ? call.id : createId(),
              createdAt: typeof call?.createdAt === 'string' ? call.createdAt : new Date().toISOString(),
              transcript: Array.isArray(call?.transcript)
                ? call.transcript.filter(isTranscriptEntry)
                : [],
            }))
            .filter(call => call.transcript.length > 0)
        : [],
    };
  } catch {
    return createEmptySession();
  }
}

function writeSession(caseId: string, session: StoredHandlerSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getStorageKey(caseId), JSON.stringify(session));
}

function createEmptySession(): StoredHandlerSession {
  return {
    detectiveCodename: DEFAULT_DETECTIVE_CODENAME,
    cooldownUntil: null,
    calls: [],
  };
}

function isTranscriptEntry(value: unknown): value is TranscriptEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as TranscriptEntry;
  return (entry.role === 'agent' || entry.role === 'user') && typeof entry.text === 'string';
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}