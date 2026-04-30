import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import {
  Radio, Mic, Waves, AlertCircle, RefreshCw, Lock,
  Plane, MapPin, Search, Target, ShieldAlert,
  ArrowLeft, Briefcase, FileWarning, Compass, ChevronRight,
  CircleDot, Phone, PhoneOff, Sparkles, Loader2,
  Clock, Wallet, PhoneCall, Image, NotebookPen, ChevronDown,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import * as api from '../lib/api';
import { getMissionEnvelope } from '../lib/mission-envelope';
import { getSeedMissionCoverUrl } from '../lib/seed-assets';
import { useAmbientSuppression, useLoopingSound } from './SoundEngine';
import { AUDIO_ASSET_URLS } from '../lib/audio-assets';
import type { GameState, MissionBoard, MissionOffer, MissionOfferStatus, WitnessCallHistoryEntry } from '../types';
import {
  buildHandlerSessionPlan,
  persistHandlerSession,
  type TranscriptEntry,
} from '../lib/handler-session';
import ViviennePortrait from './ViviennePortrait';

const SIGNOFF_IDLE_CLOSE_MS = 1800;
const SIGNOFF_WATCHDOG_MS = 45000;

export default function MissionBriefing() {
  const { gameState, missionBoard, loading, setView, resetGame, acceptMission, viewMissionDetail } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [utc, setUtc] = useState(formatUtc(new Date()));
  const boardChannelRef = useRef<BoardChannelHandle | null>(null);
  const [boardChannelLive, setBoardChannelLive] = useState(false);
  // Keep the last seen mission board so we can keep the Vivienne panel mounted
  // even after acceptMission clears missionBoard from context, until she signs off.
  const [boardSnapshot, setBoardSnapshot] = useState<MissionBoard | null>(null);

  useEffect(() => {
    if (missionBoard) setBoardSnapshot(missionBoard);
  }, [missionBoard]);

  useEffect(() => {
    // Once the channel goes idle and we already have a game in flight, drop the snapshot
    // so the mission HandlerPanel can take over.
    if (!boardChannelLive && gameState) {
      setBoardSnapshot(null);
    }
  }, [boardChannelLive, gameState]);

  const handleBoardChannel = useCallback((handle: BoardChannelHandle | null) => {
    boardChannelRef.current = handle;
    setBoardChannelLive(!!handle?.live);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setUtc(formatUtc(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (gameState) {
      setSelectedId(gameState.caseId);
      return;
    }

    if (missionBoard?.offers.length) {
      setSelectedId(current => {
        const stillAvailable = missionBoard.offers.some(offer => offer.templateId === current);
        return stillAvailable ? current : missionBoard.offers[0]!.templateId;
      });
      return;
    }

    setSelectedId(null);
  }, [gameState, missionBoard]);

  if (!gameState && !missionBoard) return null;

  const activeMission = useMemo(() => {
    if (!gameState) return null;

    return {
      id: gameState.caseId,
      code: gameState.caseId.slice(0, 4).toUpperCase() + '-A',
      title: gameState.case.title,
      type: gameState.case.source === 'seed' ? 'Seed File' : 'Generated File',
      region: `${new Set(gameState.case.cities.map(city => city.country)).size} countries`,
      difficulty: gameState.case.difficulty,
      summary: gameState.case.crimeDescription,
      cityCount: gameState.case.cities.length,
      witnessCount: gameState.case.cities.reduce((sum, city) => sum + city.witnessCount, 0),
      suspectCount: gameState.case.suspects.length,
    } satisfies MissionLite;
  }, [gameState]);

  const availableMissions = useMemo(() => {
    if (!missionBoard) return [];

    return missionBoard.offers.map((offer, index) => mapOfferToMissionLite(offer, index));
  }, [missionBoard]);

  const showingMissionBoard = !gameState && !!missionBoard;

  const codename = (
    (missionBoard?.player.displayName ?? '').trim() || 'Cipher'
  );

  const requestAbandonCase = () => {
    window.dispatchEvent(new Event('atlas:request-abandon'));
  };

  const handleAcceptMission = useCallback(async (mission: MissionLite) => {
    if (!mission.templateId) return;
    const channel = boardChannelRef.current;
    const selectionUpdate = channel?.live
      ? [
          `AGENT SELECTED: "${mission.title}" (code ${mission.code}).`,
          mission.region ? `Region: ${mission.region}.` : '',
          mission.difficulty ? `Difficulty: ${mission.difficulty}/5.` : '',
          mission.summary ? `Summary: ${mission.summary}.` : '',
          typeof mission.cityCount === 'number' ? `Cities in play: ${mission.cityCount}.` : '',
          typeof mission.witnessCount === 'number' ? `Witnesses on file: ${mission.witnessCount}.` : '',
          typeof mission.suspectCount === 'number' ? `Suspects on file: ${mission.suspectCount}.` : '',
          'The acceptance has succeeded. Transition from board mode into mission briefing mode now.',
          'Acknowledge the selection, brief the mission, give the first useful lead, and remain available for a short follow-up before closing the channel.',
        ].filter(Boolean).join(' ')
      : null;

    await acceptMission(mission.templateId);
    if (selectionUpdate && boardChannelRef.current?.live) {
      boardChannelRef.current.sendContextualUpdate(selectionUpdate);
    }
  }, [acceptMission]);

  const handleViewMissionDetail = useCallback(async (mission: MissionLite) => {
    if (!mission.templateId || !mission.hasDetail) return;
    await viewMissionDetail(mission.templateId);
  }, [viewMissionDetail]);

  return (
    <ConversationProvider>
        <div className="absolute inset-0 bg-midnight-950 overflow-y-auto overflow-x-hidden">
          {/* ── fixed backdrops ── */}
          <div className="fixed inset-0 bg-nebula pointer-events-none" />
          <div className="fixed inset-0 bg-atlas-grid opacity-25 pointer-events-none" />
          <div className="fixed inset-0 bg-grain opacity-[0.18] pointer-events-none mix-blend-overlay" />
          <div className="fixed -top-48 left-1/4 w-[40rem] h-[40rem] bg-coral-500/[0.07] blur-[140px] pointer-events-none" />
      <div className="fixed -bottom-48 right-1/4 w-[44rem] h-[44rem] bg-aqua-400/[0.07] blur-[140px] pointer-events-none" />
      <div className="fixed inset-0 vignette pointer-events-none" />

      {/* ── topbar ── */}
      {!gameState && (
        <header className="sticky top-0 z-30 bg-midnight-950/85 backdrop-blur-md border-b border-cream-50/[0.06]">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3.5">
            <button
              onClick={resetGame}
              className="group inline-flex items-center gap-2 mono-tick text-dust-400 hover:text-cream-50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Back to Landing
            </button>

            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-aqua-400/60 animate-ping" />
                <span className="relative w-2 h-2 rounded-full bg-aqua-400" />
              </span>
              <span className="mono-tick text-aqua-400">Briefing Room · Secure</span>
            </div>

            <div className="flex items-center gap-3 mono-tick text-dust-400">
              <span className="hidden sm:flex items-center gap-1.5">
                <Compass className="w-3 h-3" /> UTC {utc}
              </span>
              <PlayerStatsHeader missionBoard={missionBoard} gameState={gameState} />
            </div>
          </div>
        </header>
      )}

      {showingMissionBoard ? (
        <>
          {/* ── hero strip (board mode) ── */}
          <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-8">
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <div className="mono-tick text-coral-400 mb-2 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  <span>Atlas Bureau · Dispatch Desk</span>
                </div>
                <h1 className="font-display italic font-semibold text-5xl sm:text-6xl text-cream-50 leading-[0.95] tracking-tight">
                  {`Agent ${codename}.`}
                  <br />
                  <span className="text-coral-400">The desk is yours.</span>
                </h1>
                <p className="text-cream-300 mt-4 max-w-xl text-base leading-relaxed">
                  A few files are cleared for you. Read the envelope, sign for one — the rest stay sealed until you close it out.
                </p>
              </div>

              <div className="hidden md:flex flex-col items-end gap-1">
                <div className="mono-tick text-dust-400">Channel 7 · Live</div>
                <div className="font-display italic text-3xl text-cream-50 leading-none">
                  {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                </div>
                <div className="mono-tick text-amber-400 mt-1">{new Date().getFullYear()}</div>
              </div>
            </div>

            <div className="mt-8 h-px tick-line opacity-60" />
          </section>

          <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 px-6 pb-16">
            <aside className="self-start lg:col-span-4 lg:sticky lg:top-[88px]">
              {(() => {
                const boardForPanel = (missionBoard ?? boardSnapshot)!;
                return <MissionBoardPanel board={boardForPanel} onChannel={handleBoardChannel} />;
              })()}
            </aside>

            <section className="lg:col-span-8 flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="mono-tick text-aqua-400 mb-1 flex items-center gap-1.5">
                    <Briefcase className="w-3 h-3" /> Open Assignments
                  </div>
                  <h2 className="font-display italic text-2xl text-cream-50">
                    {`${availableMissions.length} cleared for you${
                      (missionBoard?.hiddenOfferCount ?? 0) > 0
                        ? ` · ${missionBoard?.hiddenOfferCount} sealed above your clearance`
                        : ''
                    }`}
                  </h2>
                </div>
                <div className="hidden sm:flex items-center gap-2 mono-tick text-dust-400">
                  <CircleDot className="w-3 h-3 text-coral-400 animate-pulse-soft" />
                  Sign for one — the rest go cold
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {availableMissions.map((mission) => (
                  <MissionRow
                    key={mission.id}
                    mission={mission}
                    open={selectedId === mission.id}
                    onToggle={() => setSelectedId(selectedId === mission.id ? null : mission.id)}
                  >
                    <MissionOfferDetail
                      mission={mission}
                      board={missionBoard}
                      loading={loading}
                      onViewDetail={() => mission.templateId && mission.hasDetail && void handleViewMissionDetail(mission)}
                      onAccept={() => mission.templateId && void handleAcceptMission(mission)}
                    />
                  </MissionRow>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : gameState && activeMission ? (
        <div className="pt-20">
          <ActiveMissionHero
            gameState={gameState}
            mission={activeMission}
            onResume={() => setView('case-board')}
            onAbandon={requestAbandonCase}
          />

          <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 px-6 pt-8 pb-16">
            <aside className="self-start lg:col-span-4 lg:sticky lg:top-[88px]">
              {(() => {
                const showBoard = boardChannelLive && !!boardSnapshot;
                if (showBoard) {
                  return <MissionBoardPanel board={boardSnapshot!} onChannel={handleBoardChannel} />;
                }
                return <HandlerPanel agentId={gameState.case.handlerAgentId} gameState={gameState} />;
              })()}
            </aside>

            <section className="lg:col-span-8 flex flex-col gap-6">
              <ActiveMissionBody gameState={gameState} />
            </section>
          </div>
        </div>
      ) : null}
    </div>
    </ConversationProvider>
  );
}

/* ═════════════════════ Handler card ═════════════════════ */

function formatConversationError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Channel disrupted';
  const normalized = message.toLowerCase();

  if (normalized.includes('permission') || normalized.includes('microphone')) {
    return 'Microphone access is required to open the channel.';
  }

  if (
    normalized.includes('network') ||
    normalized.includes('socket') ||
    normalized.includes('disconnect') ||
    normalized.includes('connection')
  ) {
    return 'Channel dropped. Check your connection and retry.';
  }

  return message;
}

function HandlerPanel({ agentId, gameState }: { agentId: string | null; gameState: GameState }) {
  return <HandlerPanelInner agentId={agentId} gameState={gameState} />;
}

function HandlerPanelInner({ agentId, gameState }: { agentId: string | null; gameState: GameState }) {
  const { refreshGameState } = useGame();
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(() => buildHandlerSessionPlan(gameState).initialTranscript);
  const [started, setStarted] = useState(false);
  const [openingChannel, setOpeningChannel] = useState(false);
  const [supportCallsRemaining, setSupportCallsRemaining] = useState(() => gameState.resources.supportCallsRemaining);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<TranscriptEntry[]>(buildHandlerSessionPlan(gameState).initialTranscript);
  const closedByUserRef = useRef(false);
  const hadLiveConnectionRef = useRef(false);
  const persistedRef = useRef(false);
  const signoffDetectedRef = useRef(false);
  const signoffTimeoutRef = useRef<number | null>(null);
  const signoffWatchdogRef = useRef<number | null>(null);
  const pendingSignoffCloseRef = useRef(false);
  const initialTranscriptLengthRef = useRef(buildHandlerSessionPlan(gameState).initialTranscript.length);
  const sessionPhaseRef = useRef<'idle' | 'starting' | 'active' | 'ending'>('idle');
  const signoffLastPlaybackActivityRef = useRef(0);

  const conversation = useConversation({
    onConnect: () => {
      sessionPhaseRef.current = 'active';
      closedByUserRef.current = false;
      hadLiveConnectionRef.current = true;
      setOpeningChannel(false);
      setStarted(true);
      setError(null);
    },
    onDisconnect: () => {
      sessionPhaseRef.current = 'idle';
      setOpeningChannel(false);
      setStarted(false);
      if (signoffDetectedRef.current) {
        void finalizeSignoffClose();
        return;
      }
      if (!closedByUserRef.current && hadLiveConnectionRef.current) {
        void flushTranscript(false);
        if (!signoffDetectedRef.current) {
          setError('Channel dropped. Check your connection and retry.');
        }
      }
    },
    onMessage: (m: { source?: string; message?: string }) => {
      if (!m.message) return;

      const nextEntry = {
        role: m.source === 'user' ? 'user' : 'agent',
        text: m.message,
      } satisfies TranscriptEntry;

      setTranscript(prev => {
        const next = [...prev, nextEntry];
        transcriptRef.current = next;
        return next;
      });
    },
    onAgentToolResponse: tool => {
      if (tool.tool_name !== 'end_call') return;
      signoffDetectedRef.current = true;
      pendingSignoffCloseRef.current = true;
      signoffLastPlaybackActivityRef.current = Date.now();
      armSignoffFallback();
      scheduleSignoffCloseCheck();
    },
    onAudio: () => {
      markSignoffPlaybackActivity();
    },
    onAudioAlignment: () => {
      markSignoffPlaybackActivity();
    },
    onError: (err: unknown) => {
      sessionPhaseRef.current = 'idle';
      setOpeningChannel(false);
      setStarted(false);
      setError(formatConversationError(err));
    },
  });

  const { status, isSpeaking } = conversation;
  const isSpeakingRef = useRef(isSpeaking);
  const statusRef = useRef(status);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    statusRef.current = status;
  }, [isSpeaking, status]);

  useEffect(() => {
    if (!pendingSignoffCloseRef.current || status !== 'connected') return;

    if (isSpeaking) {
      markSignoffPlaybackActivity();
      return;
    }

    scheduleSignoffCloseCheck();
  }, [isSpeaking, status]);

  useEffect(() => {
    const nextPlan = buildHandlerSessionPlan(gameState);
    setTranscript(nextPlan.initialTranscript);
    transcriptRef.current = nextPlan.initialTranscript;
    initialTranscriptLengthRef.current = nextPlan.initialTranscript.length;
    setSupportCallsRemaining(gameState.resources.supportCallsRemaining);
  }, [gameState]);

  useEffect(() => () => {
    clearSignoffTimers();
    safeEndSession(true);
  }, []);

  useEffect(() => {
    transcriptRef.current = transcript;
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  async function flushTranscript(applyCooldown: boolean) {
    if (persistedRef.current) return;

    const newEntries = transcriptRef.current.slice(initialTranscriptLengthRef.current);
    if (newEntries.length === 0) {
      persistedRef.current = true;
      return;
    }

    persistedRef.current = true;
    persistHandlerSession(gameState, newEntries, applyCooldown);
    void api.saveHandlerCallMemory(newEntries).catch(() => undefined);
  }

  function clearSignoffTimer() {
    if (signoffTimeoutRef.current !== null) {
      window.clearTimeout(signoffTimeoutRef.current);
      signoffTimeoutRef.current = null;
    }
  }

  function clearSignoffWatchdog() {
    if (signoffWatchdogRef.current !== null) {
      window.clearTimeout(signoffWatchdogRef.current);
      signoffWatchdogRef.current = null;
    }
  }

  function clearSignoffTimers() {
    clearSignoffTimer();
    clearSignoffWatchdog();
  }

  function markSignoffPlaybackActivity() {
    if (!pendingSignoffCloseRef.current) return;

    signoffLastPlaybackActivityRef.current = Date.now();
    clearSignoffTimer();
  }

  function scheduleSignoffCloseCheck(delayMs = SIGNOFF_IDLE_CLOSE_MS) {
    clearSignoffTimer();
    signoffTimeoutRef.current = window.setTimeout(() => {
      if (!pendingSignoffCloseRef.current) return;

      if (statusRef.current !== 'connected') {
        void finalizeSignoffClose();
        return;
      }

      const idleMs = Date.now() - signoffLastPlaybackActivityRef.current;
      if (isSpeakingRef.current || idleMs < SIGNOFF_IDLE_CLOSE_MS) {
        scheduleSignoffCloseCheck(Math.max(250, SIGNOFF_IDLE_CLOSE_MS - idleMs));
        return;
      }

      void finalizeSignoffClose();
    }, delayMs);
  }

  function armSignoffFallback() {
    clearSignoffWatchdog();
    signoffWatchdogRef.current = window.setTimeout(() => {
      if (!pendingSignoffCloseRef.current) return;

      if (statusRef.current === 'connected' && isSpeakingRef.current) {
        armSignoffFallback();
        return;
      }

      void finalizeSignoffClose();
    }, SIGNOFF_WATCHDOG_MS);
  }

  async function finalizeSignoffClose() {
    if (!pendingSignoffCloseRef.current) return;

    pendingSignoffCloseRef.current = false;
    clearSignoffTimers();
    await flushTranscript(true);
    safeEndSession(true);
    setStarted(false);
  }

  function safeEndSession(markClosedByUser: boolean): void {
    if (markClosedByUser) {
      closedByUserRef.current = true;
    }

    if (sessionPhaseRef.current === 'idle' || sessionPhaseRef.current === 'ending') {
      return;
    }

    sessionPhaseRef.current = 'ending';

    try {
      conversation.endSession();
    } catch {
      sessionPhaseRef.current = 'idle';
    }
  }

  async function startSession() {
    if (sessionPhaseRef.current !== 'idle') return;
    if (status === 'connecting' || status === 'connected') return;

    setOpeningChannel(true);

    const nextPlan = buildHandlerSessionPlan(gameState);
    setSupportCallsRemaining(gameState.resources.supportCallsRemaining);

    if (!nextPlan.canCall) {
      setOpeningChannel(false);
      setError(nextPlan.reason ?? 'Vivienne is unavailable on this case.');
      return;
    }

    let resolvedAgentId = agentId;
    let resolvedSignedUrl: string | null = null;
    let remoteDynamicVariables: Record<string, string> = {};

    try {
      const config = await api.getHandlerConfig();
      resolvedAgentId = config.agentId || resolvedAgentId;
      resolvedSignedUrl = config.signedUrl || null;
      remoteDynamicVariables = config.dynamicVariables || {};
      setSupportCallsRemaining(current => Math.max(0, current - 1));
      await refreshGameState();
    } catch (err) {
      setOpeningChannel(false);
      setError(err instanceof Error ? err.message : 'Handler channel is unavailable right now.');
      return;
    }

    if (!resolvedSignedUrl && !resolvedAgentId) {
      setOpeningChannel(false);
      setError('Handler channel is still provisioning. Try again in a moment.');
      return;
    }

    closedByUserRef.current = false;
    hadLiveConnectionRef.current = false;
    signoffDetectedRef.current = false;
    pendingSignoffCloseRef.current = false;
    persistedRef.current = false;
    clearSignoffTimers();
    sessionPhaseRef.current = 'starting';
    initialTranscriptLengthRef.current = transcriptRef.current.length;
    setError(null);
    try {
      const startOptions = {
        ...nextPlan.startOptions,
        dynamicVariables: {
          ...nextPlan.startOptions.dynamicVariables,
          ...remoteDynamicVariables,
        },
      };

      await navigator.mediaDevices.getUserMedia({ audio: true });
      if (resolvedSignedUrl) {
        await conversation.startSession({ signedUrl: resolvedSignedUrl, ...startOptions });
      } else {
        await conversation.startSession({ agentId: resolvedAgentId!, ...startOptions });
      }
      setStarted(true);
    } catch (err) {
      sessionPhaseRef.current = 'idle';
      setOpeningChannel(false);
      setStarted(false);
      setError(formatConversationError(err));
    }
  }

  async function endChannel() {
    setOpeningChannel(false);
    await flushTranscript(false);
    safeEndSession(true);
    setStarted(false);
  }

  const live = status === 'connected';
  const connecting = openingChannel || status === 'connecting';

  useLoopingSound(AUDIO_ASSET_URLS.commsLoading, connecting, 0.36);
  useAmbientSuppression(connecting || live);

  const startSessionRef = useRef(startSession);
  const endChannelRef = useRef(endChannel);
  useEffect(() => {
    startSessionRef.current = startSession;
    endChannelRef.current = endChannel;
  });

  return (
    <div className="dossier rounded-2xl overflow-hidden flex flex-col relative">
      {/* glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-aqua-400/15 blur-[80px] pointer-events-none" />
      <div className="absolute inset-0 bg-atlas-grid opacity-[0.15] pointer-events-none" />

      {/* avatar header */}
      <div className="relative px-6 pt-7 pb-5 border-b border-cream-50/[0.06]">
        {/* live tag */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 mono-tick px-2 py-0.5 rounded-full bg-midnight-950/60 border border-cream-50/[0.06]">
          <span className={`w-1.5 h-1.5 rounded-full ${
            live ? 'bg-aqua-400 animate-pulse-soft' : connecting ? 'bg-amber-400' : 'bg-dust-500'
          }`} />
          <span className={live ? 'text-aqua-400' : connecting ? 'text-amber-400' : 'text-dust-400'}>
            {live ? 'Live' : connecting ? 'Connecting' : 'Standby'}
          </span>
        </div>

        {/* avatar — portrait with live status */}
        <div className="flex flex-col items-center text-center">
          <div className="relative w-32 h-32">
            {/* outer ring */}
            <div className="absolute inset-0 rounded-full border border-aqua-400/20" />
            <div className="absolute inset-2 rounded-full border border-aqua-400/15" />
            {/* speaking pulse */}
            {live && isSpeaking && (
              <span className="absolute inset-0 rounded-full bg-aqua-400/20 blur-2xl animate-pulse" />
            )}
            {/* inner disc */}
            <div className={`absolute inset-4 rounded-full overflow-hidden backdrop-blur-sm border ${
              live && isSpeaking
                ? 'bg-aqua-400/20 border-aqua-400/60 shadow-[0_0_40px_-5px_rgba(95,227,208,0.6)]'
                : live
                  ? 'bg-aqua-400/[0.10] border-aqua-400/40'
                  : connecting
                    ? 'bg-amber-400/10 border-amber-400/40 animate-pulse'
                    : 'bg-midnight-800 border-cream-50/[0.10]'
            }`}>
              <ViviennePortrait
                imageClassName="h-full w-full object-cover object-center scale-[1.02]"
                fallbackClassName="flex h-full w-full items-center justify-center font-display text-4xl italic text-dust-300"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,21,0.04),rgba(7,12,21,0.34))] pointer-events-none" />
            </div>
            <div className={`absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md ${
              live && isSpeaking
                ? 'bg-aqua-400/20 border-aqua-400/60 text-aqua-50'
                : live
                  ? 'bg-aqua-400/[0.12] border-aqua-400/40 text-aqua-300'
                  : connecting
                    ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                    : 'bg-midnight-950/72 border-cream-50/[0.08] text-dust-400'
            }`}>
              {live && isSpeaking
                ? <Waves className="w-5 h-5" />
                : live
                  ? <Mic className="w-5 h-5" />
                  : <Radio className="w-5 h-5" />}
            </div>
          </div>

          <div className="mt-4">
            <div className="mono-tick text-coral-400">Handler · Codename</div>
            <h2 className="font-display italic font-semibold text-cream-50 text-3xl leading-none mt-1">
              Vivienne
            </h2>
            <p className="mono-tick text-dust-400 mt-1.5">London Station · Atlas Bureau</p>
          </div>
        </div>
      </div>

      {/* status strip */}
      <div className="relative px-5 py-3 border-b border-cream-50/[0.06] flex items-center justify-between bg-midnight-950/30">
        <div className="flex items-center gap-2 mono-tick text-dust-400">
          <Radio className="w-3 h-3" /> Channel 7
        </div>
        <div className="text-xs font-display italic">
          {live && isSpeaking && <span className="text-aqua-400">Speaking…</span>}
          {live && !isSpeaking && <span className="text-cream-200">Listening to you</span>}
          {connecting && <span className="text-amber-400">Opening channel…</span>}
          {!live && !connecting && <span className="text-dust-400">Awaiting connection</span>}
        </div>
      </div>

      {/* error */}
      {error && (
        <div className="relative px-5 py-2.5 bg-coral-500/[0.08] border-b border-coral-500/20 flex items-center gap-3">
          <AlertCircle className="w-3.5 h-3.5 text-coral-400 shrink-0" />
          <p className="text-xs text-coral-300 flex-1 truncate">{error}</p>
          <button
            onClick={() => { setError(null); void startSession(); }}
            className="flex items-center gap-1 px-2 py-1 mono-tick text-coral-300 rounded bg-coral-500/15 hover:bg-coral-500/25 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* CTA */}
      <div className="relative px-5 py-4">
        {!started ? (
          gameState.handler.canCall || connecting ? (
            <button
              onClick={startSession}
              disabled={!gameState.handler.canCall || connecting}
              className="btn-coral w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-md text-cream-50 font-mono uppercase tracking-[0.2em] text-xs"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {connecting ? 'Opening Channel' : `Open Channel · ${supportCallsRemaining} Left`}
            </button>
          ) : (
            <div className="w-full rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3.5 flex items-start gap-3">
              <Lock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="mono-tick text-amber-300">Handler unavailable</div>
                <p className="text-xs text-cream-200 leading-relaxed mt-1">
                  {gameState.handler.reason ?? 'Support Unavailable'}
                </p>
              </div>
            </div>
          )
        ) : (
          <button
            onClick={endChannel}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-md text-cream-300 hover:text-cream-50 border border-cream-50/[0.12] hover:border-cream-50/30 transition-colors mono-tick"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            Close Channel
          </button>
        )}
      </div>

      {/* transcript */}
      <div className="relative flex-1 min-h-[140px] max-h-[34vh] overflow-y-auto px-5 pb-5 space-y-2.5">
        {transcript.length === 0 ? (
          <div className="text-center pt-2">
            <p className="mono-tick text-dust-400">— Transcript appears here —</p>
            <p className="text-xs text-dust-300 mt-1.5 px-4 leading-relaxed normal-case tracking-normal font-sans">
              {started ? 'Speak naturally. Ask about the file, the current city, or the next lead.' : 'Open the channel to begin.'}
            </p>
          </div>
        ) : transcript.map((entry, i) => (
          <div key={i} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
              entry.role === 'user'
                ? 'bg-cream-50/[0.06] text-cream-50 border border-cream-50/[0.08]'
                : 'bg-aqua-400/[0.10] border border-aqua-400/20 text-aqua-100'
            }`}>
              <div className={`mono-tick mb-0.5 text-[9px] ${entry.role === 'user' ? 'text-dust-400' : 'text-aqua-400'}`}>
                {entry.role === 'user' ? 'You' : 'Vivienne'}
              </div>
              {entry.text}
            </div>
          </div>
        ))}

        <div className="relative px-5 pb-4 mono-tick text-dust-400 flex items-center justify-between text-[11px]">
          <span>Support windows left: {supportCallsRemaining}</span>
          <span>{gameState.resources.remainingHours}h · {gameState.resources.remainingCredits} cr</span>
        </div>
        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
}

/* ═════════════════════ Mission card ═════════════════════ */

interface MissionLite {
  id: string;
  slug?: string;
  code: string;
  title: string;
  type: string;
  region: string;
  difficulty: number;
  summary: string;
  templateId?: string;
  minLevel?: number;
  cityCount?: number;
  witnessCount?: number;
  suspectCount?: number;
  playerStatus?: MissionOfferStatus | null;
  hasDetail?: boolean;
  embargo?: string;
  locked?: boolean;
}

function MissionRow({ mission, open, onToggle, children }: {
  mission: MissionLite;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const locked = mission.locked;
  return (
    <div
      className={`group relative rounded-lg overflow-hidden transition-all border ${
        locked
          ? open
            ? 'border-amber-400/40 bg-midnight-900/60'
            : 'border-cream-50/[0.05] bg-midnight-900/40 hover:border-cream-50/[0.10]'
          : open
            ? 'border-coral-500/60 bg-coral-500/[0.06]'
            : 'border-cream-50/[0.08] bg-midnight-900/60 hover:border-aqua-400/40'
      }`}
    >
      {/* selected stripe */}
      {open && !locked && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-coral-300 via-coral-500 to-coral-700" />
      )}
      {locked && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400/30" />
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-left relative px-5 py-4 flex items-center gap-5"
      >
        {/* code box */}
        <div className={`shrink-0 w-16 h-16 rounded-md flex flex-col items-center justify-center border ${
          locked
            ? 'border-amber-400/20 bg-midnight-950/40 text-dust-400'
            : open
              ? 'border-coral-500/40 bg-coral-500/[0.10] text-coral-300'
              : 'border-cream-50/[0.10] bg-midnight-950/40 text-cream-200'
        }`}>
          <span className="mono-tick text-[8px] opacity-70">FILE №</span>
          <span className="font-display italic text-lg leading-none mt-0.5">
            {mission.code.split('-')[0]}
          </span>
          <span className="mono-tick text-[8px] mt-0.5 opacity-70">{mission.code.split('-')[1]}</span>
        </div>

        {/* body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`mono-tick ${
              locked ? 'text-amber-400/70' : open ? 'text-coral-400' : 'text-aqua-400'
            }`}>
              {mission.type}
            </span>
            {mission.playerStatus ? <MissionStatusBadge status={mission.playerStatus} /> : null}
            <span className="text-dust-500">·</span>
            <span className="mono-tick text-dust-400">{mission.region}</span>
          </div>
          <div className={`font-display italic font-semibold text-xl leading-tight ${
            locked ? 'text-dust-300' : 'text-cream-50'
          }`}>
            {mission.title}
          </div>
          <p className={`text-xs mt-1 line-clamp-1 ${
            locked ? 'text-dust-400' : 'text-cream-300'
          }`}>
            {mission.summary}
          </p>
        </div>

        {/* right column */}
        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
          <DifficultyBars value={mission.difficulty} dim={!!locked} />
          {locked ? (
            <div className="flex items-center gap-1 mono-tick text-amber-400/80">
              <Lock className="w-3 h-3" /> {mission.embargo}
            </div>
          ) : (
            <div className={`mono-tick flex items-center gap-1 ${
              open ? 'text-coral-400' : 'text-dust-400 group-hover:text-aqua-400'
            } transition-colors`}>
              {open ? 'Close' : 'Open File'}
              <ChevronRight className={`w-3 h-3 transition-transform ${
                open ? 'rotate-90' : 'group-hover:translate-x-0.5'
              }`} />
            </div>
          )}
        </div>
      </button>

      {/* collapsible body */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function MissionStatusBadge({ status }: { status: MissionOfferStatus }) {
  const label = status === 'failed'
    ? 'Failed'
    : status === 'abandoned'
      ? 'Abandoned'
      : 'Solved';
  const tone = status === 'failed'
    ? 'border-coral-400/35 bg-coral-500/12 text-coral-200'
    : status === 'abandoned'
      ? 'border-amber-400/35 bg-amber-400/12 text-amber-200'
      : 'border-aqua-400/35 bg-aqua-400/12 text-aqua-100';

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 mono-tick text-[10px] uppercase tracking-[0.18em] ${tone}`}>
      {label}
    </span>
  );
}

function DifficultyBars({ value, dim }: { value: number; dim?: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-3.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`w-1 rounded-sm ${
            i <= value
              ? (dim ? 'bg-dust-500/40' : i >= 4 ? 'bg-coral-400' : 'bg-amber-400')
              : 'bg-cream-50/[0.08]'
          }`}
          style={{ height: `${5 + i * 1.4}px` }}
        />
      ))}
    </div>
  );
}

/* ═════════════════════ Active mission view ═════════════════════ */

function ActiveMissionHero({
  gameState,
  mission,
  onResume,
  onAbandon,
}: {
  gameState: NonNullable<ReturnType<typeof useGame>['gameState']>;
  mission: MissionLite;
  onResume: () => void;
  onAbandon: () => void;
}) {
  const orderedCities = [...gameState.case.cities].sort((a, b) => a.visitOrder - b.visitOrder);
  const heroCity = orderedCities.find(city => city.unlocked && city.sceneImageUrl)
    ?? orderedCities.find(city => city.unlocked)
    ?? orderedCities[0];
  const currentCity = orderedCities.find(city => city.id === gameState.currentCityId) ?? heroCity;
  const sceneUrl = heroCity?.sceneImageUrl ?? null;
  const reviewMode = gameState.status !== 'active';
  const reviewHeading = gameState.status === 'solved'
    ? 'Mission Review'
    : gameState.status === 'abandoned'
      ? 'Abandoned File'
      : 'Mission Review';
  const reviewCopy = gameState.status === 'solved'
    ? 'The file closed successfully. This briefing is now read-only and field operations are sealed.'
    : gameState.status === 'abandoned'
      ? 'This file was abandoned. Review remains available, but operations stay sealed.'
      : 'This file is closed. Review remains available, but field operations stay sealed.';
  const isFreshMission = gameState.discoveredClues.filter(clue => !!clue.discoveredAt).length === 0
    && gameState.resources.remainingHours === gameState.resources.totalHours
    && gameState.resources.remainingCredits === gameState.resources.totalCredits;
  const seed = hashString(gameState.caseId);
  const palettes: Array<{ from: string; via: string; to: string; tint: string }> = [
    { from: 'from-coral-700/55', via: 'via-midnight-900', to: 'to-aqua-400/30', tint: 'bg-coral-500/15' },
    { from: 'from-aqua-400/40', via: 'via-midnight-900', to: 'to-magenta-500/30', tint: 'bg-aqua-400/15' },
    { from: 'from-amber-400/35', via: 'via-midnight-900', to: 'to-coral-500/30', tint: 'bg-amber-400/15' },
    { from: 'from-magenta-500/35', via: 'via-midnight-900', to: 'to-aqua-400/30', tint: 'bg-magenta-500/15' },
  ];
  const palette = palettes[seed % palettes.length]!;

  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 pt-6">
      <div className="dossier relative overflow-hidden rounded-3xl border border-cream-50/[0.07]">
        {/* image / placeholder */}
        <div className="relative h-72 sm:h-80 md:h-96 overflow-hidden">
          {sceneUrl ? (
            <img
              src={sceneUrl}
              alt={heroCity?.name ?? mission.title}
              className="absolute inset-0 w-full h-full object-cover scale-105"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <>
              <div className={`absolute inset-0 bg-gradient-to-br ${palette.from} ${palette.via} ${palette.to}`} />
              <div className={`absolute -top-20 left-1/3 w-[36rem] h-[36rem] rounded-full blur-[140px] ${palette.tint} pointer-events-none`} />
              <div className="absolute inset-0 grid place-items-center">
                <div className="grid place-items-center w-24 h-24 rounded-full border border-cream-50/15 bg-midnight-950/40 backdrop-blur-sm">
                  <Image className="w-9 h-9 text-cream-50/70" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-20 grid place-items-center">
                <span className="mono-tick text-cream-50/55">Field photo · pending</span>
              </div>
            </>
          )}

          {/* atmosphere */}
          <div className="absolute inset-0 bg-atlas-grid opacity-[0.18] mix-blend-overlay pointer-events-none" />
          <div className="absolute inset-0 bg-grain opacity-[0.20] mix-blend-overlay pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-midnight-950 via-midnight-950/65 to-midnight-950/10 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

          {/* corners */}
          <CornerB pos="top-3 left-3" />
          <CornerB pos="top-3 right-3" rot={90} />
          <CornerB pos="bottom-3 left-3" rot={-90} />
          <CornerB pos="bottom-3 right-3" rot={180} />

          {/* top meta strip */}
          <div className="absolute top-4 left-5 right-5 flex items-center justify-between mono-tick">
            <span className="inline-flex items-center gap-2 text-amber-400">
              <CircleDot className="w-3 h-3 animate-pulse-soft" />
              Mission File · {mission.code}
            </span>
            <span className="hidden sm:inline-flex items-center gap-2 text-cream-50/55">
              {currentCity ? `Current deployment · ${currentCity.name}${currentCity.country ? ` · ${currentCity.country}` : ''}` : 'Location classified'}
            </span>
          </div>

          {/* boarding pass */}
          <div className="absolute top-12 right-5 hidden md:block rotate-3">
            <div className="relative w-56 bg-cream-50 text-midnight-950 rounded-md shadow-2xl shadow-midnight-950/60 overflow-hidden">
              {/* perforation notches */}
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-midnight-950" />
              <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-midnight-950" />
              <div className="px-3 py-1.5 bg-coral-500 text-cream-50 flex items-center justify-between mono-tick text-[9px]">
                <span className="inline-flex items-center gap-1.5">
                  <Plane className="w-3 h-3" /> Boarding Pass
                </span>
                <span>CH 7</span>
              </div>
              <div className="px-3 py-2 flex items-end justify-between gap-2 border-b border-dashed border-midnight-950/20">
                <div>
                  <div className="mono-tick text-[8px] text-midnight-950/50">From</div>
                  <div className="font-display italic text-lg leading-none">LDN</div>
                </div>
                <Plane className="w-4 h-4 text-coral-500 rotate-90 mb-1" />
                <div className="text-right">
                  <div className="mono-tick text-[8px] text-midnight-950/50">To</div>
                  <div className="font-display italic text-lg leading-none">
                    {(currentCity?.name ?? '???').slice(0, 3).toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="px-3 py-1.5 flex items-center justify-between mono-tick text-[9px] text-midnight-950/70">
                <span>Flight {mission.code}</span>
                <span className="text-coral-600">{reviewMode ? 'REVIEW' : 'ACTIVE'}</span>
              </div>
            </div>
          </div>

          {/* title block */}
          <div className="absolute bottom-6 left-6 right-6">
            <div className="mono-tick text-amber-400 mb-2">{reviewMode ? reviewHeading : 'Mission Briefing'}</div>
            <h1 className="font-display italic font-semibold text-4xl sm:text-5xl md:text-6xl text-cream-50 leading-[0.95] tracking-tight drop-shadow-2xl">
              {mission.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-base text-cream-200/95 leading-relaxed drop-shadow">
              {mission.summary}
            </p>
          </div>
        </div>

        {/* control bar */}
        <div className="relative px-5 sm:px-6 py-4 border-t border-cream-50/[0.07] bg-midnight-950/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-cream-200">
            <HeroChip icon={<Clock className="w-3.5 h-3.5" />} accent="amber"
              label={`${gameState.resources.remainingHours}h / ${gameState.resources.totalHours}h`}
            />
            <HeroChip icon={<Wallet className="w-3.5 h-3.5" />} accent="aqua"
              label={`${gameState.resources.remainingCredits} / ${gameState.resources.totalCredits} cr`}
            />
            <HeroChip icon={<PhoneCall className="w-3.5 h-3.5" />} accent="coral"
              label={`${gameState.resources.supportCallsRemaining} support`}
            />
            <HeroChip icon={<Search className="w-3.5 h-3.5" />} accent="magenta"
              label={`Difficulty ${gameState.case.difficulty}/5`}
            />
          </div>

          <div className="sm:ml-auto flex flex-col sm:items-end gap-2">
            <p className="mono-tick text-[10px] text-dust-400 text-left sm:text-right">
              {reviewMode
                ? reviewCopy
                : `Mission file covers the whole case. Field operations continue in ${currentCity?.name ?? 'the current city'}.`}
            </p>
            <div className="flex items-center gap-2">
              {reviewMode ? (
                <>
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-3 py-2.5 rounded-md border border-cream-50/[0.08] text-dust-500 bg-midnight-900/55 cursor-not-allowed mono-tick text-[11px]"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Archived
                  </button>
                  <button
                    disabled
                    className="inline-flex items-center gap-3 pl-4 pr-2.5 py-2.5 rounded-md border border-cream-50/[0.08] text-dust-500 bg-midnight-900/55 cursor-not-allowed font-mono uppercase tracking-[0.22em] text-[11px] whitespace-nowrap"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    Review Only
                    <span className="grid place-items-center w-7 h-7 rounded bg-cream-50/[0.05] border border-cream-50/[0.08]">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onAbandon}
                    className="inline-flex items-center gap-2 px-3 py-2.5 rounded-md border border-cream-50/[0.08] text-cream-300 hover:text-cream-50 hover:border-coral-500/50 hover:bg-coral-500/[0.08] transition mono-tick text-[11px]"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Abandon
                  </button>
                  <button
                    onClick={onResume}
                    className="btn-coral group inline-flex items-center gap-3 pl-4 pr-2.5 py-2.5 rounded-md text-cream-50 font-mono uppercase tracking-[0.22em] text-[11px] whitespace-nowrap"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    {isFreshMission ? 'Begin Field Operations' : 'Resume Field Operations'}
                    <span className="grid place-items-center w-7 h-7 rounded bg-cream-50/15 border border-cream-50/25 group-hover:bg-cream-50/25 transition">
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroChip({ icon, label, accent }: {
  icon: React.ReactNode;
  label: string;
  accent: 'aqua' | 'coral' | 'amber' | 'magenta';
}) {
  const colors: Record<string, string> = {
    aqua: 'text-aqua-300',
    coral: 'text-coral-300',
    amber: 'text-amber-300',
    magenta: 'text-magenta-300',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 mono-tick ${colors[accent]}`}>
      {icon} {label}
    </span>
  );
}

function ActiveMissionBody({
  gameState,
}: {
  gameState: NonNullable<ReturnType<typeof useGame>['gameState']>;
}) {
  const orderedCities = [...gameState.case.cities].sort((a, b) => a.visitOrder - b.visitOrder);
  const totalWitnesses = gameState.case.cities.reduce((s, c) => s + c.witnessCount, 0);
  const clueCount = gameState.discoveredClues.length;
  const unlockedCities = orderedCities.filter(city => city.unlocked).length;
  const longDescription = gameState.case.crimeDescription?.trim() ?? '';
  const showLongDescription = longDescription.length > 0;

  return (
    <article className="dossier rounded-2xl overflow-hidden relative border border-cream-50/[0.06]">
      <div className="absolute -top-32 -right-20 w-72 h-72 bg-coral-500/[0.08] blur-[100px] pointer-events-none" />

      {/* case file briefing */}
      {showLongDescription && (
        <section className="relative px-6 pt-6 pb-5 border-b border-cream-50/[0.06]">
          <header className="mono-tick text-amber-400 mb-3 flex items-center gap-2">
            <FileWarning className="w-3 h-3" /> Case File · Briefing
          </header>
          <p className="text-sm sm:text-[15px] text-cream-200 leading-relaxed whitespace-pre-line">
            {longDescription}
          </p>
        </section>
      )}

      {/* progress strip */}
      <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-px bg-cream-50/[0.06] border-b border-cream-50/[0.06]">
        <Stat icon={<MapPin className="w-3.5 h-3.5" />} label="Cities mapped" value={`${unlockedCities}/${gameState.case.cities.length}`} accent="aqua" />
        <Stat icon={<Target className="w-3.5 h-3.5" />} label="Suspects" value={gameState.case.suspects.length} accent="coral" />
        <Stat icon={<Search className="w-3.5 h-3.5" />} label="Clues on file" value={clueCount} accent="amber" />
        <Stat icon={<ShieldAlert className="w-3.5 h-3.5" />} label="Warrant" value={gameState.warrant.ready ? 'Ready' : 'Pending'} accent="magenta" />
      </div>

      {/* itinerary + suspects */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-6">
        <section>
          <header className="mono-tick text-aqua-400 mb-3 flex items-center gap-2">
            <Plane className="w-3 h-3" /> Travel Envelope
          </header>
          <ol className="relative space-y-2.5 pl-3 border-l border-cream-50/[0.08]">
            {orderedCities.map((c, i) => (
              <li key={c.id} className="relative">
                <span className={`absolute -left-[14px] top-1.5 w-2 h-2 rounded-full ring-2 ring-midnight-900 ${c.unlocked ? 'bg-aqua-400/70' : 'bg-dust-500/70'}`} />
                <div className="font-display italic text-cream-50 text-base leading-tight">
                  {c.unlocked ? c.name : 'Route sealed'}
                </div>
                <div className="mono-tick text-dust-400 text-[10px] flex items-center gap-2 flex-wrap">
                  <span>№ {String(i + 1).padStart(2, '0')}</span>
                  <span>·</span>
                  <span>{c.unlocked ? c.country : 'Await route intel'}</span>
                  {c.unlocked && c.travelHours !== null && c.travelCost !== null && (
                    <>
                      <span>·</span>
                      <span>{c.travelHours}h / {c.travelCost} cr</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <header className="mono-tick text-coral-400 mb-3 flex items-center gap-2">
            <ShieldAlert className="w-3 h-3" /> Persons of Interest
          </header>
          <ul className="space-y-2.5">
            {gameState.case.suspects.map((s, i) => (
              <li
                key={s.id}
                className="dossier rounded-md p-3 flex items-start gap-3 border border-cream-50/[0.04]"
              >
                <div className="shrink-0 w-9 h-9 rounded-full bg-midnight-700 border border-coral-500/30 flex items-center justify-center font-display italic text-coral-300">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display italic text-cream-50 leading-tight">{s.name}</div>
                  {s.profiled && s.description ? (
                    <p className="text-xs text-cream-300 mt-0.5 line-clamp-2">{s.description}</p>
                  ) : (
                    <p className="text-xs text-dust-500 mt-0.5 line-clamp-2">Profile sealed until direct suspect intel is logged.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="relative px-6 py-5 border-t border-cream-50/[0.06]">
        <header className="mono-tick text-magenta-400 mb-3 flex items-center gap-2">
          <NotebookPen className="w-3 h-3" /> Investigation Notes · {gameState.missionNotes.length}
        </header>
        {gameState.missionNotes.length > 0 ? (
          <ul className="space-y-2">
            {gameState.missionNotes.map(entry => (
              <li
                key={entry.id}
                className="dossier rounded-md p-3 border-l-2 border-l-magenta-400/60"
              >
                <div className="flex items-center justify-between gap-2 mono-tick text-[10px] text-dust-400 mb-1.5">
                  <span className="truncate">
                    {entry.contextLabel
                      ? <><span className="text-magenta-300">{entry.contextType}</span> · {entry.contextLabel}</>
                      : 'General'}
                  </span>
                  <span>{new Date(entry.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                <p className="text-sm text-cream-100 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="dossier rounded-md p-4 text-xs text-dust-400 leading-relaxed">
            Open the Notebook from the top bar to start your own working notes for this case.
          </div>
        )}
      </section>

      <section className="relative px-6 py-5 border-t border-cream-50/[0.06]">
        <header className="mono-tick text-aqua-400 mb-3 flex items-center gap-2">
          <PhoneCall className="w-3 h-3" /> Witness Call History · {gameState.witnessCallHistory.length}
        </header>
        {gameState.witnessCallHistory.length > 0 ? (
          <ul className="space-y-2">
            {gameState.witnessCallHistory.map(entry => {
              const witnessRecord = (() => {
                for (const city of gameState.case.cities) {
                  const w = city.witnesses.find(x => x.id === entry.witnessId);
                  if (w) return { name: w.name, cityName: city.name };
                }
                return null;
              })();
              return (
                <WitnessCallHistoryItem
                  key={entry.id}
                  entry={entry}
                  witnessName={witnessRecord?.name ?? 'Unknown witness'}
                  cityName={witnessRecord?.cityName ?? null}
                />
              );
            })}
          </ul>
        ) : (
          <div className="dossier rounded-md p-4 text-xs text-dust-400 leading-relaxed">
            No witness calls logged yet on this case. Closed calls will be summarised here automatically.
          </div>
        )}
      </section>

      <footer className="relative px-6 py-4 border-t border-cream-50/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-midnight-950/40 text-xs">
        <span className="text-dust-300">{totalWitnesses} witnesses on file · {clueCount} clues on file</span>
        <span className={gameState.warrant.ready ? 'text-aqua-300' : 'text-dust-400'}>
          {gameState.warrant.ready ? 'Warrant ready for issue' : (gameState.warrant.reason ?? 'Warrant gating active')}
        </span>
      </footer>
    </article>
  );
}

function WitnessCallHistoryItem({
  entry,
  witnessName,
  cityName,
}: {
  entry: WitnessCallHistoryEntry;
  witnessName: string;
  cityName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const hasTranscript = entry.transcript.length > 0;
  const witnessInitials = witnessName
    .split(/\s+/)
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'W';
  const wordCount = entry.transcript.reduce((acc, t) => acc + t.text.split(/\s+/).filter(Boolean).length, 0);
  const approxMinutes = Math.max(1, Math.round(wordCount / 140));
  return (
    <li className="dossier rounded-md p-3 border-l-2 border-l-aqua-400/60">
      <div className="flex items-center justify-between gap-2 mono-tick text-[10px] text-dust-400 mb-1.5">
        <span className="truncate">
          <span className="text-aqua-300">{witnessName}</span>
          {cityName ? <> · {cityName}</> : null}
        </span>
        <span>{new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
      </div>
      <p className="text-sm text-cream-100 leading-relaxed whitespace-pre-wrap">{entry.note}</p>
      {hasTranscript ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-cream-50/[0.08] bg-midnight-950/40 hover:bg-midnight-950/60 hover:border-aqua-400/40 transition text-left"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2 mono-tick text-[10px] text-aqua-300">
              <PhoneCall className="w-3 h-3" />
              Call transcript
              <span className="text-dust-400">· {entry.transcript.length} turns · ~{approxMinutes} min</span>
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-dust-300 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open ? (
            <div className="mt-2 rounded-md border border-cream-50/[0.06] bg-midnight-950/40 p-3 max-h-80 overflow-y-auto">
              <ol className="space-y-2.5">
                {entry.transcript.map((turn, idx) => {
                  const isUser = turn.role === 'user';
                  return (
                    <li
                      key={idx}
                      className={`flex gap-2 ${isUser ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}
                    >
                      <div
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mono-tick text-[9px] tracking-wider border ${
                          isUser
                            ? 'bg-magenta-500/15 border-magenta-400/40 text-magenta-200'
                            : 'bg-aqua-500/15 border-aqua-400/40 text-aqua-200'
                        }`}
                        aria-hidden
                      >
                        {isUser ? 'YOU' : witnessInitials}
                      </div>
                      <div className={`flex-1 min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                        <span className={`mono-tick text-[9px] mb-0.5 ${isUser ? 'text-magenta-300' : 'text-aqua-300'}`}>
                          {isUser ? 'Detective' : witnessName}
                        </span>
                        <p
                          className={`max-w-[85%] inline-block px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? 'bg-magenta-500/10 border border-magenta-400/20 text-cream-100 rounded-tr-sm'
                              : 'bg-aqua-500/10 border border-aqua-400/20 text-cream-100 rounded-tl-sm'
                          }`}
                        >
                          {turn.text}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function MissionOfferDetail({
  mission,
  board,
  loading,
  onViewDetail,
  onAccept,
}: {
  mission: MissionLite;
  board: MissionBoard;
  loading: boolean;
  onViewDetail: () => void;
  onAccept: () => void;
}) {
  const envelope = getMissionEnvelope(mission.difficulty);
  const playerLevel = board.player.level;
  const minLevel = mission.minLevel ?? 1;
  const underLeveled = playerLevel < minLevel;
  const canViewDetail = !!mission.playerStatus && !!mission.hasDetail;
  const statusCopy = mission.playerStatus === 'failed'
    ? 'This dossier last ended in a failed warrant. You can inspect the archived file to review your route, notes, and witness work, or reopen it for a fresh attempt.'
    : mission.playerStatus === 'abandoned'
      ? 'This dossier was previously abandoned. You can inspect the archived file to review what was left on the board, or reopen it for a fresh attempt.'
      : mission.playerStatus === 'solved'
        ? 'This dossier has already been closed successfully once. You can inspect the archived file to review how the case landed, or reopen it for a fresh run.'
        : 'Sign on and the brief drops to your desk. Solve it before the hours run out — abandoning costs progress and burns this dossier.';
  const actionLabel = underLeveled
    ? 'Clearance Too Low'
    : mission.playerStatus
      ? 'Reopen File'
      : 'Sign On';

  return (
    <article className="dossier rounded-2xl overflow-hidden relative">
      <div className="absolute -top-32 -right-20 w-72 h-72 bg-aqua-400/10 blur-[100px] pointer-events-none" />

      <MissionCover mission={mission} />

      <header className="relative px-6 pt-6 pb-5 border-b border-cream-50/[0.06] bg-midnight-950/35">
        <div className="mono-tick text-aqua-400 mb-2">Case File · Preview</div>
        <h2 className="font-display italic font-semibold text-3xl text-cream-50 leading-tight">
          {mission.title}
        </h2>
        <p className="text-sm text-cream-200 leading-relaxed mt-3 max-w-2xl">
          {mission.summary}
        </p>
      </header>

      {/* Decision row — only what you need to pick */}
      <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-px bg-cream-50/[0.06] border-y border-cream-50/[0.06]">
        <Stat icon={<Search className="w-3.5 h-3.5" />} label="Difficulty" value={`${mission.difficulty}/5`} accent="magenta" />
        <Stat icon={<Target className="w-3.5 h-3.5" />} label="Suspects" value={mission.suspectCount ?? 0} accent="coral" />
        <Stat icon={<Clock className="w-3.5 h-3.5" />} label="On the clock" value={`${envelope.startingHours}h`} accent="amber" />
        <Stat icon={<Wallet className="w-3.5 h-3.5" />} label="Travel credits" value={envelope.startingCredits} accent="aqua" />
      </div>

      <div className="px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cream-300">
        <span className="inline-flex items-center gap-2">
          <PhoneCall className="w-3.5 h-3.5 text-coral-300" />
          {envelope.supportCalls} support {envelope.supportCalls === 1 ? 'call' : 'calls'}
        </span>
        <span className="inline-flex items-center gap-2">
          <ShieldAlert className={`w-3.5 h-3.5 ${underLeveled ? 'text-amber-400' : 'text-aqua-400'}`} />
          <span className={underLeveled ? 'text-amber-400' : ''}>
            Clearance L{minLevel} required
            {underLeveled ? ` — yours is L${playerLevel}` : ''}
          </span>
        </span>
      </div>

      <footer className="relative px-6 py-5 border-t border-cream-50/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-midnight-950/40">
        <div className="flex items-start gap-3 max-w-md">
          <FileWarning className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-cream-300 leading-relaxed">
            {statusCopy}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canViewDetail && (
            <button
              onClick={onViewDetail}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-md border border-cream-50/[0.10] text-cream-200 hover:text-cream-50 hover:border-aqua-400/35 hover:bg-aqua-400/[0.08] transition mono-tick text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <NotebookPen className="w-3.5 h-3.5" />
              View Detail
            </button>
          )}
          <button
            onClick={onAccept}
            disabled={loading || underLeveled}
            className="btn-coral group inline-flex items-center gap-3 pl-5 pr-3 py-3 rounded-md text-cream-50 font-mono uppercase tracking-[0.22em] text-xs whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Briefcase className="w-3.5 h-3.5" />
            {actionLabel}
            <span className="grid place-items-center w-7 h-7 rounded bg-cream-50/15 border border-cream-50/25 group-hover:bg-cream-50/25 transition">
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>
        </div>
      </footer>
    </article>
  );
}

function MissionCover({ mission }: { mission: MissionLite }) {
  const coverUrl = mission.slug ? getSeedMissionCoverUrl(mission.slug) : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showCoverImage = !!coverUrl && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [coverUrl]);

  const seed = hashString(mission.templateId ?? mission.id ?? mission.title);
  const palettes: Array<{ from: string; via: string; to: string; tint: string }> = [
    { from: 'from-coral-700/60', via: 'via-midnight-900', to: 'to-aqua-400/30', tint: 'bg-coral-500/15' },
    { from: 'from-aqua-400/40', via: 'via-midnight-900', to: 'to-magenta-500/30', tint: 'bg-aqua-400/15' },
    { from: 'from-amber-400/35', via: 'via-midnight-900', to: 'to-coral-500/30', tint: 'bg-amber-400/15' },
    { from: 'from-magenta-500/35', via: 'via-midnight-900', to: 'to-aqua-400/30', tint: 'bg-magenta-500/15' },
    { from: 'from-coral-500/35', via: 'via-midnight-900', to: 'to-amber-400/25', tint: 'bg-coral-500/12' },
  ];
  const palette = palettes[seed % palettes.length]!;
  // Two parallax-ish blobs with deterministic offsets.
  const blobX = (seed * 13) % 70;
  const blobY = (seed * 7) % 60;

  return (
    <div className="relative h-40 sm:h-48 overflow-hidden border-b border-cream-50/[0.06]">
      <div className={`absolute inset-0 bg-gradient-to-br ${palette.from} ${palette.via} ${palette.to}`} />
      {showCoverImage && (
        <img
          src={coverUrl}
          alt={`${mission.title} field location`}
          className="absolute inset-0 h-full w-full object-cover scale-105"
          loading="eager"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="absolute inset-0 bg-atlas-grid opacity-[0.18]" />
      <div className="absolute inset-0 bg-grain opacity-[0.22] mix-blend-overlay" />
      <div
        className={`absolute w-[28rem] h-[28rem] rounded-full blur-[110px] ${palette.tint} pointer-events-none`}
        style={{ left: `${blobX}%`, top: `-${blobY}%` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-midnight-950 via-midnight-950/70 to-transparent" />

      {/* Top tick row */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between mono-tick text-cream-50/70">
        <span className="inline-flex items-center gap-1.5">
          <CircleDot className="w-3 h-3 text-coral-400 animate-pulse-soft" />
          File {mission.code}
        </span>
        <span className="inline-flex items-center gap-1.5 text-cream-50/50">
          <Image className="w-3 h-3" /> {showCoverImage ? 'Field photo' : 'Field photo · pending'}
        </span>
      </div>

      {/* Centerpiece */}
      <div className={`absolute inset-0 grid place-items-center ${showCoverImage ? 'opacity-0' : ''}`}>
        <div className="grid place-items-center w-20 h-20 rounded-full border border-cream-50/15 bg-midnight-950/40 backdrop-blur-sm">
          <Plane className="w-7 h-7 text-cream-50/85" />
        </div>
      </div>

      {/* Bottom region tag */}
      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
        <span className="mono-tick text-cream-50/85">{mission.region}</span>
        <span className="mono-tick text-cream-50/55">Atlas Bureau · Channel 7</span>
      </div>
    </div>
  );
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function MissionBoardPanel({ board, onChannel }: { board: MissionBoard; onChannel?: (handle: BoardChannelHandle | null) => void }) {
  return <BoardHandlerPanel board={board} onChannel={onChannel} />;
}

interface BoardHandlerConfig {
  agentId: string;
  signedUrl: string | null;
  dynamicVariables: Record<string, string>;
}

export interface BoardChannelHandle {
  sendContextualUpdate: (text: string) => void;
  live: boolean;
}

function BoardHandlerPanel({ board, onChannel }: { board: MissionBoard; onChannel?: (handle: BoardChannelHandle | null) => void }) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const closedByUserRef = useRef(false);
  const signoffDetectedRef = useRef(false);
  const pendingSignoffCloseRef = useRef(false);
  const signoffTimeoutRef = useRef<number | null>(null);
  const signoffWatchdogRef = useRef<number | null>(null);
  const signoffLastPlaybackActivityRef = useRef(0);

  const conversation = useConversation({
    onConnect: () => {
      closedByUserRef.current = false;
      signoffDetectedRef.current = false;
      pendingSignoffCloseRef.current = false;
      setError(null);
    },
    onDisconnect: () => {
      if (!closedByUserRef.current && !signoffDetectedRef.current) {
        setError('Channel dropped. Try opening it again.');
      }
    },
    onMessage: (m: { source?: string; message?: string }) => {
      if (!m.message) return;
      const entry: TranscriptEntry = {
        role: m.source === 'user' ? 'user' : 'agent',
        text: m.message,
      };
      setTranscript(prev => [...prev, entry]);
    },
    onAgentToolResponse: tool => {
      if (tool.tool_name !== 'end_call') return;
      signoffDetectedRef.current = true;
      pendingSignoffCloseRef.current = true;
      signoffLastPlaybackActivityRef.current = Date.now();
      armSignoffFallback();
      scheduleSignoffCloseCheck();
    },
    onAudio: () => {
      markSignoffPlaybackActivity();
    },
    onAudioAlignment: () => {
      markSignoffPlaybackActivity();
    },
    onError: (err: unknown) => {
      setError(formatConversationError(err));
    },
  });

  const { status, isSpeaking } = conversation;
  const isSpeakingRef = useRef(isSpeaking);
  const statusRef = useRef(status);
  const live = status === 'connected';
  const connecting = status === 'connecting';

  useLoopingSound(AUDIO_ASSET_URLS.commsLoading, connecting || provisioning, 0.36);
  useAmbientSuppression(connecting || live || provisioning);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    statusRef.current = status;
  }, [isSpeaking, status]);

  useEffect(() => {
    if (!pendingSignoffCloseRef.current || status !== 'connected') return;

    if (isSpeaking) {
      markSignoffPlaybackActivity();
      return;
    }

    scheduleSignoffCloseCheck();
  }, [isSpeaking, status]);

  useEffect(() => {
    if (!onChannel) return;
    onChannel({
      sendContextualUpdate: (text: string) => {
        try { conversation.sendContextualUpdate(text); } catch { /* noop */ }
      },
      live,
    });
    return () => onChannel(null);
    // conversation is stable from useConversation; live is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, onChannel]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => () => {
    clearSignoffTimers();
    try { conversation.endSession(); } catch { /* noop */ }
    // only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearSignoffTimer() {
    if (signoffTimeoutRef.current !== null) {
      window.clearTimeout(signoffTimeoutRef.current);
      signoffTimeoutRef.current = null;
    }
  }

  function clearSignoffWatchdog() {
    if (signoffWatchdogRef.current !== null) {
      window.clearTimeout(signoffWatchdogRef.current);
      signoffWatchdogRef.current = null;
    }
  }

  function clearSignoffTimers() {
    clearSignoffTimer();
    clearSignoffWatchdog();
  }

  function markSignoffPlaybackActivity() {
    if (!pendingSignoffCloseRef.current) return;

    signoffLastPlaybackActivityRef.current = Date.now();
    clearSignoffTimer();
  }

  function scheduleSignoffCloseCheck(delayMs = SIGNOFF_IDLE_CLOSE_MS) {
    clearSignoffTimer();
    signoffTimeoutRef.current = window.setTimeout(() => {
      if (!pendingSignoffCloseRef.current) return;

      if (statusRef.current !== 'connected') {
        finalizeSignoffClose();
        return;
      }

      const idleMs = Date.now() - signoffLastPlaybackActivityRef.current;
      if (isSpeakingRef.current || idleMs < SIGNOFF_IDLE_CLOSE_MS) {
        scheduleSignoffCloseCheck(Math.max(250, SIGNOFF_IDLE_CLOSE_MS - idleMs));
        return;
      }

      finalizeSignoffClose();
    }, delayMs);
  }

  function armSignoffFallback() {
    clearSignoffWatchdog();
    signoffWatchdogRef.current = window.setTimeout(() => {
      if (!pendingSignoffCloseRef.current || closedByUserRef.current) return;

      if (statusRef.current === 'connected' && isSpeakingRef.current) {
        armSignoffFallback();
        return;
      }

      finalizeSignoffClose();
    }, SIGNOFF_WATCHDOG_MS);
  }

  function finalizeSignoffClose() {
    if (!pendingSignoffCloseRef.current) return;

    pendingSignoffCloseRef.current = false;
    clearSignoffTimers();
    closedByUserRef.current = true;
    try { conversation.endSession(); } catch { /* noop */ }
  }

  async function openChannel() {
    if (live || connecting || provisioning) return;
    setError(null);
    setProvisioning(true);
    try {
      const config = await api.getBoardHandlerConfig() as BoardHandlerConfig;
      if (!config.agentId && !config.signedUrl) {
        setError('Handler channel is still provisioning. Try again in a moment.');
        return;
      }

      await navigator.mediaDevices.getUserMedia({ audio: true });
      closedByUserRef.current = false;
      signoffDetectedRef.current = false;
      pendingSignoffCloseRef.current = false;
      clearSignoffTimers();

      const startOptions = {
        userId: 'board:control',
        dynamicVariables: config.dynamicVariables,
      };

      if (config.signedUrl) {
        await conversation.startSession({ signedUrl: config.signedUrl, ...startOptions });
      } else {
        await conversation.startSession({ agentId: config.agentId, ...startOptions });
      }
    } catch (err) {
      setError(formatConversationError(err));
    } finally {
      setProvisioning(false);
    }
  }

  function endChannel() {
    closedByUserRef.current = true;
    pendingSignoffCloseRef.current = false;
    clearSignoffTimers();
    try { conversation.endSession(); } catch { /* noop */ }
  }

  const codename = (board.player.displayName ?? '').trim() || 'Cipher';

  const statusLabel = live
    ? (isSpeaking ? 'ON AIR' : 'LIVE')
    : connecting || provisioning ? 'OPENING' : 'STANDBY';
  const statusTone = live
    ? 'border-aqua-400/40 bg-aqua-400/[0.12] text-aqua-200'
    : connecting || provisioning
      ? 'border-amber-400/40 bg-amber-400/[0.10] text-amber-200'
      : 'border-cream-50/[0.10] bg-midnight-950/70 text-dust-400';

  return (
    <div className="dossier relative overflow-hidden rounded-2xl">
      {/* corner ticks */}
      <CornerB pos="left-3 top-3" />
      <CornerB pos="right-3 top-3" rot={90} />
      <CornerB pos="left-3 bottom-3" rot={-90} />
      <CornerB pos="right-3 bottom-3" rot={180} />

      {/* ============== HERO ============== */}
      <div className="relative">
        {/* layered atmosphere */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,121,92,0.28),_transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(110,231,231,0.14),_transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-atlas-grid opacity-[0.10]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

        <div className="relative px-6 pb-6 pt-7">
          {/* top meta strip */}
          <div className="flex items-center justify-between mono-tick">
            <div className="flex items-center gap-2 text-amber-400">
              <Radio className="h-3 w-3" />
              <span>Atlas Bureau</span>
              <span className="text-cream-50/20">/</span>
              <span className="text-dust-400">London</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${statusTone}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                live ? 'bg-aqua-400 shadow-[0_0_8px_rgba(110,231,231,0.9)]' :
                connecting || provisioning ? 'bg-amber-400 animate-pulse' : 'bg-dust-500'
              }`} />
              {statusLabel}
            </span>
          </div>

          {/* portrait + identity */}
          <div className="mt-6 flex items-end gap-5">
            <div className="relative shrink-0">
              {/* halo */}
              <div className={`absolute -inset-3 rounded-full transition-opacity duration-500 ${
                live && isSpeaking ? 'opacity-100' : 'opacity-0'
              }`}>
                <div className="absolute inset-0 rounded-full bg-aqua-400/20 blur-2xl animate-pulse-soft" />
              </div>
              {/* outer ring */}
              <div className="relative h-28 w-28 rounded-full p-[2px] bg-gradient-to-br from-amber-400/70 via-coral-500/50 to-magenta-500/60">
                <div className="relative h-full w-full overflow-hidden rounded-full bg-gradient-to-br from-midnight-900 via-midnight-950 to-black">
                  {/* inner rim */}
                  <div className="absolute inset-1 rounded-full border border-amber-400/15" />
                  <div className={`absolute inset-3 rounded-full border ${live ? 'border-aqua-400/50' : 'border-cream-50/[0.08]'}`} />
                  {/* portrait */}
                  <ViviennePortrait
                    imageClassName="absolute inset-0 h-full w-full object-cover object-center scale-[1.04]"
                    fallbackClassName="absolute inset-0 flex items-center justify-center font-display text-5xl italic leading-none text-cream-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,21,0.02),rgba(7,12,21,0.34))]" />
                </div>
              </div>
              {/* tiny call sign tag */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-400/40 bg-midnight-950/95 px-2 py-0.5 mono-tick leading-none text-amber-300 shadow-lg">
                CS·07
              </div>
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="mono-tick text-dust-500">Casework Allocation</div>
              <h2 className="mt-1 font-display text-[2.1rem] font-semibold italic leading-[1.05] text-cream-50">
                Vivienne
                <br />
                <span className="bg-gradient-to-r from-coral-300 via-coral-400 to-magenta-400 bg-clip-text text-transparent">Ashcroft</span>
              </h2>
              <div className="mt-2 flex items-center gap-2 mono-tick text-dust-400">
                <span className="h-px w-6 bg-amber-400/40" />
                <span>Senior Allocator</span>
              </div>
            </div>
          </div>

          {/* operative + stats row */}
          <div className="mt-6 flex items-center gap-2 mono-tick text-dust-500">
            <span className="h-px flex-1 bg-cream-50/10" />
            <span>Encrypted Channel · {codename}</span>
            <span className="h-px flex-1 bg-cream-50/10" />
          </div>
        </div>
      </div>

      {/* ============== CHANNEL CONTROL ============== */}
      <div className="relative border-y border-cream-50/[0.07] bg-gradient-to-b from-midnight-950/50 to-midnight-950/20 px-5 py-4">
        <div className="flex items-center justify-between mono-tick">
          <div className="flex items-center gap-2">
            {live && isSpeaking ? (
              <><Waves className="h-3.5 w-3.5 text-aqua-400 animate-pulse-soft" /><span className="text-aqua-300">Vivienne speaking</span></>
            ) : live ? (
              <><Mic className="h-3.5 w-3.5 text-aqua-400" /><span className="text-aqua-300">Listening</span></>
            ) : connecting || provisioning ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" /><span className="text-amber-300">Opening channel</span></>
            ) : (
              <><PhoneOff className="h-3.5 w-3.5 text-dust-500" /><span className="text-dust-400">Channel idle</span></>
            )}
          </div>
          <span className="text-dust-500">CH 7 · ENC · 22.4 MHZ</span>
        </div>

        {/* waveform — always present, intensity reflects state */}
        <div className="mt-3 flex h-10 items-end justify-between gap-[3px] rounded-md border border-cream-50/[0.05] bg-midnight-950/60 px-2 py-1.5">
          {Array.from({ length: 32 }).map((_, i) => {
            const base = 18 + Math.sin(i * 0.7) * 10 + Math.cos(i * 1.3) * 8;
            const active = live && isSpeaking;
            const height = active ? Math.max(15, base + (i % 3) * 14) : 8 + (i % 4) * 3;
            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-t from-aqua-400 to-coral-400 animate-pulse-soft'
                    : live
                      ? 'bg-aqua-400/40'
                      : 'bg-cream-50/10'
                }`}
                style={{ height: `${height}%`, animationDelay: `${i * 40}ms` }}
              />
            );
          })}
        </div>

        <button
          onClick={live ? endChannel : () => void openChannel()}
          disabled={!live && (connecting || provisioning)}
          className={`group relative mt-4 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3.5 mono-tick font-semibold tracking-wider transition ${
            live
              ? 'border border-coral-500/50 bg-coral-500/[0.12] text-coral-100 hover:bg-coral-500/20'
              : 'bg-gradient-to-r from-coral-500 via-coral-400 to-magenta-500 text-cream-50 shadow-[0_8px_30px_-8px_rgba(255,121,92,0.6)] hover:shadow-[0_12px_38px_-8px_rgba(255,121,92,0.75)] hover:from-coral-400 hover:to-magenta-400 disabled:cursor-not-allowed disabled:opacity-60'
          }`}
        >
          {!live && !connecting && !provisioning && (
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cream-50/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          )}
          {live ? (
            <><PhoneOff className="h-4 w-4" /> End Transmission</>
          ) : connecting || provisioning ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Patching through…</>
          ) : (
            <><Phone className="h-4 w-4" /> Hail Vivienne</>
          )}
        </button>
      </div>

      {/* ============== ERROR ============== */}
      {error && (
        <div className="relative border-b border-coral-500/25 bg-coral-500/[0.08] px-5 py-3">
          <div className="flex items-start gap-2 text-coral-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* ============== TRANSCRIPT / DESK ============== */}
      <div className={`relative px-5 py-5 ${transcript.length > 0 ? 'max-h-[26rem] overflow-y-auto' : ''}`}>
        {transcript.length === 0 ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.07] via-coral-500/[0.04] to-transparent p-4">
              <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-400/10 blur-2xl" />
              <div className="relative">
                <div className="mono-tick flex items-center gap-2 text-amber-300">
                  <Sparkles className="h-3.5 w-3.5" /> Tonight at the Desk
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-cream-200">
                  Open the channel and Vivienne will walk the live board, weigh each dossier against your clearance, and steer you toward the file that fits.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {transcript.map((entry, i) => {
              const isAgent = entry.role === 'agent';
              return (
                <div key={i} className={`flex gap-2 ${isAgent ? '' : 'flex-row-reverse'}`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-xs italic leading-none ${
                    isAgent
                      ? 'border border-coral-400/40 bg-gradient-to-br from-coral-500/40 to-magenta-500/40 text-cream-50'
                      : 'border border-aqua-400/40 bg-aqua-400/10 text-aqua-300'
                  }`}>
                    {isAgent ? 'V' : codename.slice(0, 1).toUpperCase()}
                  </div>
                  <div className={`flex-1 min-w-0 ${isAgent ? '' : 'text-right'}`}>
                    <div className={`mono-tick mb-0.5 text-[9px] ${isAgent ? 'text-coral-400' : 'text-aqua-400'}`}>
                      {isAgent ? 'VIVIENNE' : codename.toUpperCase()}
                    </div>
                    <div className={`inline-block rounded-lg px-3 py-2 text-sm text-cream-100 ${
                      isAgent
                        ? 'border border-cream-50/[0.07] bg-midnight-900/80'
                        : 'border border-aqua-400/25 bg-aqua-400/[0.08]'
                    }`}>
                      {entry.text}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════ helpers ═════════════════════ */

function Stat({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: 'aqua' | 'coral' | 'amber' | 'magenta';
}) {
  const colors: Record<string, string> = {
    aqua: 'text-aqua-400', coral: 'text-coral-400',
    amber: 'text-amber-400', magenta: 'text-magenta-400',
  };
  return (
    <div className="bg-midnight-900/60 px-4 py-3.5">
      <div className={`flex items-center gap-1.5 mono-tick ${colors[accent]}`}>
        {icon} {label}
      </div>
      <div className={`mt-1.5 font-display text-2xl italic leading-none ${colors[accent]}`}>
        {value}
      </div>
    </div>
  );
}

function CornerB({ pos, rot = 0 }: { pos: string; rot?: number }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute h-4 w-4 text-amber-400/80 ${pos}`}
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <span className="absolute left-0 top-0 h-px w-full bg-current" />
      <span className="absolute left-0 top-0 h-full w-px bg-current" />
    </div>
  );
}

function mapOfferToMissionLite(offer: MissionOffer, index: number): MissionLite {
  return {
    id: offer.templateId,
    slug: offer.slug,
    templateId: offer.templateId,
    code: `${String(index + 1).padStart(4, '0')}-L${offer.minLevel}`,
    title: offer.title,
    type: 'Seed Dossier',
    region: offer.countryCount <= 1 ? 'Single jurisdiction' : `${offer.countryCount} jurisdictions`,
    difficulty: offer.difficulty,
    minLevel: offer.minLevel,
    cityCount: offer.cityCount,
    witnessCount: offer.witnessCount,
    suspectCount: offer.suspectCount,
    playerStatus: offer.playerStatus ?? null,
    hasDetail: !!offer.hasDetail,
    summary: offer.summary,
  };
}

function formatUtc(d: Date) {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/* ═════════════════════ Player stats header ═════════════════════ */

function PlayerStatsHeader({ missionBoard, gameState }: { missionBoard: MissionBoard | null; gameState: GameState | null }) {
  const player = missionBoard?.player;

  if (!player) {
    if (!gameState) return null;
    const code = gameState.caseId.slice(0, 4).toUpperCase();
    return (
      <div className="hidden sm:flex items-center gap-2 mono-tick px-2.5 py-1 rounded-full bg-midnight-950/60 border border-cream-50/[0.06]">
        <span className="text-amber-400" title="Case file identifier">DOSSIER № {code}</span>
        <span className="text-dust-500">·</span>
        <span className="text-coral-300" title="Difficulty rating, 1 (light) to 5 (severe)">D{gameState.case.difficulty}/5</span>
      </div>
    );
  }

  const codename = (player.displayName ?? '').trim() || 'Cipher';
  const initials = codename.slice(0, 2).toUpperCase();
  const xpTarget = player.nextLevelExperience;
  const xpLabel = xpTarget !== null
    ? `Experience earned vs. next clearance threshold (${player.experience} / ${xpTarget})`
    : `Experience earned (${player.experience}) — maximum clearance reached`;

  return (
    <div className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full bg-midnight-950/60 border border-cream-50/[0.06]">
      {/* clearance badge */}
      <div
        className="relative w-9 h-9 rounded-full flex items-center justify-center bg-amber-400/10 border border-amber-400/40 shadow-[0_0_18px_-4px_rgba(255,200,87,0.55)] cursor-help group"
      >
        <span className="font-display italic text-amber-300 text-sm leading-none">L{player.level}</span>
        <Tooltip>Clearance level — unlocks higher-difficulty dossiers</Tooltip>
      </div>

      {/* codename + xp */}
      <div className="hidden sm:flex flex-col leading-none gap-1 pr-1">
        <span className="flex items-center gap-1.5 group cursor-help relative">
          <span className="w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br from-coral-500/70 to-magenta-500/70 text-cream-50 font-display italic text-[10px] leading-none">{initials}</span>
          <span className="font-display italic text-cream-50 text-sm">{codename}</span>
          <Tooltip>Your field codename. Vivienne uses this on the air.</Tooltip>
        </span>
        <span className="mono-tick text-dust-400 group cursor-help relative">
          XP {player.experience}{xpTarget !== null ? ` / ${xpTarget}` : ''}
          <Tooltip>{xpLabel}</Tooltip>
        </span>
      </div>

      {/* stat tally */}
      <div className="hidden md:flex items-center gap-2 pl-2 border-l border-cream-50/[0.06]">
        <StatPill icon={<Target className="w-3 h-3" />} label="Solved" value={player.solvedCases} tone="aqua"
          tooltip="Cases closed correctly. Highest weight toward XP and clearance." />
        <StatPill icon={<ShieldAlert className="w-3 h-3" />} label="Failed" value={player.failedCases} tone="coral"
          tooltip="Cases where you arrested the wrong suspect." />
        <StatPill icon={<Briefcase className="w-3 h-3" />} label="Abandoned" value={player.abandonedCases} tone="amber"
          tooltip="Cases you dropped before resolution. No XP awarded." />
        {missionBoard && missionBoard.hiddenOfferCount > 0 && (
          <StatPill icon={<Lock className="w-3 h-3" />} label="Sealed" value={missionBoard.hiddenOfferCount} tone="magenta" align="end"
            tooltip="Dossiers above your current clearance. They unlock as you level up." />
        )}
      </div>
    </div>
  );
}

function StatPill({ icon, label, value, tone, tooltip, align }: { icon: React.ReactNode; label: string; value: number; tone: 'aqua' | 'coral' | 'amber' | 'magenta'; tooltip?: string; align?: 'center' | 'end' }) {
  const toneClass = {
    aqua: 'text-aqua-300',
    coral: 'text-coral-300',
    amber: 'text-amber-300',
    magenta: 'text-magenta-300',
  }[tone];
  return (
    <div className="relative group flex items-center gap-1 mono-tick cursor-help" aria-label={label}>
      <span className={toneClass}>{icon}</span>
      <span className="text-cream-100">{value}</span>
      <Tooltip align={align}>
        <span className={`mono-tick mr-1 ${toneClass}`}>{label.toUpperCase()}</span>
        <span className="text-cream-200">{tooltip ?? label}</span>
      </Tooltip>
    </div>
  );
}

function Tooltip({ children, align = 'center' }: { children: React.ReactNode; align?: 'center' | 'end' }) {
  const position = align === 'end'
    ? 'right-0'
    : 'left-1/2 -translate-x-1/2';
  const arrowPosition = align === 'end'
    ? 'right-3'
    : 'left-1/2 -translate-x-1/2';
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute top-full ${position} mt-2 z-40 whitespace-normal w-max max-w-[14rem] px-2.5 py-1.5 rounded-md bg-midnight-950/95 border border-cream-50/[0.10] text-[10.5px] leading-snug text-center text-cream-200 shadow-lg shadow-black/40 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 transition duration-150`}
    >
      <span className={`absolute -top-1 ${arrowPosition} w-2 h-2 rotate-45 bg-midnight-950/95 border-t border-l border-cream-50/[0.10]`} />
      {children}
    </span>
  );
}
