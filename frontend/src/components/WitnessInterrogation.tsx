import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import {
  ArrowLeft, Mic, MicOff, Phone, PhoneOff, Loader2, NotebookPen,
  MapPin, User, AlertCircle, Waves, RefreshCw, Lock, Lightbulb, Clock,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import * as api from '../lib/api';
import { useAmbientSuppression, useLoopingSound } from './SoundEngine';
import { AUDIO_ASSET_URLS } from '../lib/audio-assets';

interface TranscriptLine {
  role: 'detective' | 'witness';
  text: string;
}

type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

const HINT_COST_HOURS = 2;
const SIGNOFF_IDLE_CLOSE_MS = 1800;
const SIGNOFF_WATCHDOG_MS = 45000;

function WitnessInterrogationInner() {
  const {
    gameState,
    activeWitnessId,
    closeInterrogation,
    discoverClue,
    refreshGameState,
  } = useGame();

  const witnessRecord = useMemo(() => {
    if (!gameState || !activeWitnessId) return null;
    for (const city of gameState.case.cities) {
      const w = city.witnesses.find(x => x.id === activeWitnessId);
      if (w) return { witness: w, city };
    }
    return null;
  }, [gameState, activeWitnessId]);
  const investigationLocked = gameState?.status !== 'active';

  const [status, setStatus] = useState<CallStatus>('idle');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [hintingClueId, setHintingClueId] = useState<string | null>(null);

  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const transcriptEntriesRef = useRef<TranscriptLine[]>([]);
  const startedRef = useRef(false);
  const persistedRef = useRef(false);
  const closedByUserRef = useRef(false);
  const hadLiveConnectionRef = useRef(false);
  const signoffDetectedRef = useRef(false);
  const pendingSignoffCloseRef = useRef(false);
  const signoffTimeoutRef = useRef<number | null>(null);
  const signoffWatchdogRef = useRef<number | null>(null);
  const signoffLastPlaybackActivityRef = useRef(0);

  const conversation = useConversation({
    onConnect: () => {
      closedByUserRef.current = false;
      hadLiveConnectionRef.current = true;
      signoffDetectedRef.current = false;
      pendingSignoffCloseRef.current = false;
      clearSignoffTimers();
      setStatus('connected');
      setErrorMsg(null);
    },
    onDisconnect: () => {
      clearSignoffTimers();
      setStatus(prev => (prev === 'error' ? 'error' : 'ended'));
      startedRef.current = false;
      if (signoffDetectedRef.current) {
        setErrorMsg(null);
        void flushTranscript(false);
        return;
      }
      if (!closedByUserRef.current && hadLiveConnectionRef.current) {
        void flushTranscript(false);
        setErrorMsg('Channel dropped. Check your connection and retry.');
      }
    },
    onMessage: (msg: { source?: string; message?: string }) => {
      if (!msg.message) return;
      const role: TranscriptLine['role'] = msg.source === 'user' ? 'detective' : 'witness';
      setTranscript(prev => {
        const next = [...prev, { role, text: msg.message! }];
        transcriptEntriesRef.current = next;
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
      if (signoffDetectedRef.current || pendingSignoffCloseRef.current || closedByUserRef.current) {
        setErrorMsg(null);
        setStatus('ended');
        startedRef.current = false;
        return;
      }
      console.error('ConvAI error', err);
      setErrorMsg(formatConversationError(err));
      setStatus('error');
      startedRef.current = false;
    },
  });

  const isSpeaking = conversation.isSpeaking;
  const isLive = status === 'connecting' || status === 'connected';
  const isSpeakingRef = useRef(isSpeaking);
  const statusRef = useRef(status);

  const safeEnd = useCallback(() => {
    try { conversation.endSession(); } catch { /* noop */ }
  }, [conversation]);

  const flushTranscript = useCallback(async (reportErrors = true) => {
    if (!activeWitnessId || persistedRef.current) return;

    const nextTranscript = transcriptEntriesRef.current
      .filter(entry => entry.text.trim().length > 0)
      .map(entry => ({
        role: entry.role === 'detective' ? 'user' as const : 'agent' as const,
        text: entry.text,
      }));
    const hasWitnessReply = nextTranscript.some(entry => entry.role === 'agent');

    if (!hasWitnessReply) {
      return;
    }

    persistedRef.current = true;
    try {
      await api.saveWitnessCallMemory(activeWitnessId, nextTranscript);
      await refreshGameState();
    } catch (error) {
      persistedRef.current = false;
      if (reportErrors) {
        setErrorMsg(error instanceof Error ? error.message : 'Failed to save witness call');
      }
    }
  }, [activeWitnessId, refreshGameState]);

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

  const startCall = useCallback(async () => {
    if (!activeWitnessId || startedRef.current || !witnessRecord) return;
    if (investigationLocked) {
      setErrorMsg('Mission failed. Witness channels are sealed for this case.');
      setStatus('ended');
      return;
    }
    if (witnessRecord.witness.hasTalkedThisVisit) {
      setErrorMsg(witnessRecord.witness.talkLockedReason || 'This witness is unavailable until you leave and revisit the city.');
      setStatus('ended');
      return;
    }
    startedRef.current = true;
    persistedRef.current = false;
    transcriptEntriesRef.current = [];
    signoffDetectedRef.current = false;
    pendingSignoffCloseRef.current = false;
    clearSignoffTimers();
    setStatus('connecting');
    setErrorMsg(null);
    setTranscript([]);
    try {
      const cfg = await api.getWitnessVoiceConfig(activeWitnessId);
      // Trigger the mic permission prompt up-front so it happens here, not deep inside the SDK.
      await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cfg.signedUrl) {
        await conversation.startSession({ signedUrl: cfg.signedUrl });
      } else if (cfg.agentId) {
        await conversation.startSession({ agentId: cfg.agentId });
      } else {
        throw new Error('No agent channel available for this witness yet.');
      }
    } catch (err) {
      console.error('startCall failed', err);
      setErrorMsg(formatConversationError(err));
      setStatus('error');
      startedRef.current = false;
    }
  }, [activeWitnessId, conversation, witnessRecord, investigationLocked]);

  const hangup = useCallback(async () => {
    await flushTranscript();
    closedByUserRef.current = true;
    pendingSignoffCloseRef.current = false;
    clearSignoffTimers();
    safeEnd();
    setStatus('ended');
  }, [flushTranscript, safeEnd]);

  const leavePage = useCallback(async () => {
    await flushTranscript(false);
    closedByUserRef.current = true;
    pendingSignoffCloseRef.current = false;
    clearSignoffTimers();
    safeEnd();
    closeInterrogation();
  }, [flushTranscript, safeEnd, closeInterrogation]);

  const retryCall = useCallback(async () => {
    pendingSignoffCloseRef.current = false;
    clearSignoffTimers();
    safeEnd();
    setStatus('idle');
    setErrorMsg(null);
    startedRef.current = false;
    await startCall();
  }, [safeEnd, startCall]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    setMuted(next);
    try {
      const conv = conversation as unknown as { setMicMuted?: (m: boolean) => Promise<void> | void };
      if (typeof conv.setMicMuted === 'function') {
        await conv.setMicMuted(next);
      }
    } catch {
      // Ignore — UI still reflects intent.
    }
  }, [conversation, muted]);

  /* end the call cleanly when this view unmounts */
  useEffect(() => {
    return () => {
      clearSignoffTimers();
      void flushTranscript(false);
      safeEnd();
    };
  }, [flushTranscript, safeEnd]);

  /* auto-scroll transcript */
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript]);

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
      if (!pendingSignoffCloseRef.current || closedByUserRef.current) return;

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
    await flushTranscript(false);
    closedByUserRef.current = true;
    setErrorMsg(null);
    safeEnd();
    setStatus('ended');
  }

  if (!witnessRecord) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-midnight-950 text-cream-50">
        <div className="text-center space-y-3">
          <p className="mono-tick text-dust-400">No witness selected.</p>
          <button onClick={() => closeInterrogation()} className="btn-coral px-4 py-2 rounded-md">
            Back to the board
          </button>
        </div>
      </div>
    );
  }

  const { witness: w, city } = witnessRecord;
  const pendingClues = (gameState?.discoveredClues ?? []).filter(c => !c.discoveredAt && c.witnessId === w.id);
  const recordedClues = (gameState?.discoveredClues ?? []).filter(c => c.discoveredAt && c.witnessId === w.id);
  const hasConversed = w.hasTalkedThisVisit || transcript.some(t => t.role === 'witness') || recordedClues.length > 0;
  const remainingHours = gameState?.resources.remainingHours ?? 0;
  const canAffordHint = remainingHours >= HINT_COST_HOURS;

  const requestHint = useCallback(async (clueId: string) => {
    if (hintingClueId || investigationLocked) return;
    setHintingClueId(clueId);
    try {
      await discoverClue(clueId);
    } finally {
      setHintingClueId(null);
    }
  }, [discoverClue, hintingClueId, investigationLocked]);

  useLoopingSound(AUDIO_ASSET_URLS.commsLoading, status === 'connecting', 0.38);
  useAmbientSuppression(status === 'connecting' || status === 'connected');

  const orbState: 'idle' | 'speaking' | 'user' | 'thinking' =
    status === 'connecting' ? 'thinking'
      : isSpeaking ? 'speaking'
      : status === 'connected' ? 'user'
      : 'idle';

  const statusLabel =
    status === 'idle' ? 'Not connected'
      : status === 'connecting' ? 'Connecting…'
      : status === 'error' ? 'Connection issue'
      : status === 'ended' ? 'Channel closed'
      : muted ? 'Muted'
      : isSpeaking ? `${w.name} is speaking`
      : 'Listening to you…';

  return (
    <div className="absolute inset-0 bg-nebula vignette text-cream-50 overflow-hidden">
      <div className="fixed inset-0 bg-atlas-grid opacity-30 pointer-events-none" />

      {/* TOP BAR */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 py-4">
        <button
          onClick={() => { void leavePage(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-midnight-800/70 border border-cream-50/[0.08] text-dust-300 hover:text-cream-50 hover:border-cream-50/[0.16] transition mono-tick"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to board
        </button>
        {isLive && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-coral-500/10 border border-coral-400/20">
            <span className="w-1.5 h-1.5 rounded-full bg-coral-400 animate-pulse" />
            <span className="mono-tick text-coral-300">{statusLabel}</span>
          </div>
        )}
      </header>

      {/* BODY */}
      <main className="absolute inset-0 grid grid-cols-1 lg:grid-cols-[360px_1fr_360px] gap-4 px-6 pt-20 pb-32">
        {/* LEFT: dossier */}
        <aside className="dossier rounded-2xl p-5 border border-cream-50/[0.06] overflow-y-auto">
          <div className="aspect-square w-full rounded-xl overflow-hidden border border-cream-50/[0.08] bg-midnight-800 mb-4">
            {w.portraitImageUrl ? (
              <img
                src={w.portraitImageUrl}
                alt={w.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-dust-400">
                <User className="w-12 h-12" />
              </div>
            )}
          </div>
          <h2 className="font-display italic text-2xl text-cream-50 leading-tight">{w.name}</h2>
          <div className="mono-tick text-dust-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {city.name}, {city.country}
          </div>

          <section className="mt-5 space-y-3">
            <div>
              <div className="mono-tick text-amber-400 mb-1">Demeanour</div>
              <p className="text-sm text-cream-200 leading-relaxed">{w.personality}</p>
            </div>
            <div>
              <div className="mono-tick text-amber-400 mb-1">Background</div>
              <p className="text-sm text-cream-200 leading-relaxed">{w.backstory}</p>
            </div>
          </section>
        </aside>

        {/* CENTER: orb + transcript */}
        <section className="flex flex-col items-center justify-between min-h-0">
          {!isLive && status !== 'ended' ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full text-center gap-6">
              <Orb state="idle" />
              <div className="space-y-1">
                <p className="font-display italic text-cream-50 text-3xl">{w.name}</p>
                <p className="mono-tick text-dust-400">
                  {investigationLocked
                    ? 'Mission failed. Live witness channels are sealed.'
                    : w.hasTalkedThisVisit
                    ? 'You already made contact in this city visit.'
                    : 'Review the dossier on the left, then place the call.'}
                </p>
              </div>
              <button
                onClick={() => { void startCall(); }}
                disabled={investigationLocked || w.hasTalkedThisVisit}
                className={`group inline-flex items-center gap-3 px-7 py-3 rounded-full font-mono uppercase tracking-[0.18em] text-xs transition active:scale-95 ${
                  investigationLocked || w.hasTalkedThisVisit
                    ? 'bg-midnight-800 text-dust-500 border border-cream-50/[0.08] cursor-not-allowed'
                    : 'bg-aqua-400 text-midnight-950 hover:bg-aqua-300 hover:shadow-[0_0_40px_rgba(95,227,208,0.45)]'
                }`}
              >
                <Phone className="w-4 h-4" />
                {investigationLocked ? 'Channel sealed' : w.hasTalkedThisVisit ? 'Call locked' : 'Call witness'}
              </button>
              {investigationLocked ? (
                <div className="px-3 py-2 rounded-md bg-coral-500/10 border border-coral-400/20 flex items-center gap-2 max-w-md">
                  <Lock className="w-3.5 h-3.5 text-coral-300 shrink-0" />
                  <span className="text-xs text-coral-100">Mission failed. Witness channels are sealed for this case.</span>
                </div>
              ) : w.hasTalkedThisVisit && w.talkLockedReason && (
                <div className="px-3 py-2 rounded-md bg-amber-400/10 border border-amber-400/20 flex items-center gap-2 max-w-md">
                  <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="text-xs text-amber-100">{w.talkLockedReason}</span>
                </div>
              )}
              {errorMsg && (
                <div className="px-3 py-2 rounded-md bg-coral-500/10 border border-coral-400/20 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-coral-300" />
                  <span className="text-xs text-coral-200">{errorMsg}</span>
                </div>
              )}
            </div>
          ) : status === 'ended' ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full text-center gap-6">
              <Orb state="idle" />
              <div className="space-y-1">
                <p className="font-display italic text-cream-50 text-3xl">{w.name}</p>
                <p className="mono-tick text-dust-400">
                  {w.hasTalkedThisVisit
                    ? (w.talkLockedReason ?? 'Channel closed for this city visit.')
                    : 'Channel closed.'}
                </p>
              </div>
              {w.hasTalkedThisVisit ? (
                <button
                  onClick={() => { void leavePage(); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-midnight-800 border border-cream-50/[0.08] text-cream-100 font-mono uppercase tracking-[0.18em] text-xs hover:bg-midnight-700 transition active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to board
                </button>
              ) : (
                <button
                  onClick={() => { void retryCall(); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-aqua-400 text-midnight-950 font-mono uppercase tracking-[0.18em] text-xs hover:bg-aqua-300 transition active:scale-95"
                >
                  <Phone className="w-4 h-4" /> Call again
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <Orb state={orbState} />
                <p className="mt-4 text-cream-200 font-display italic text-xl">{w.name}</p>
                <p className="mono-tick text-dust-400 mt-1">{statusLabel}</p>
                {errorMsg && (
                  <div className="mt-4 px-3 py-2 rounded-md bg-coral-500/10 border border-coral-400/20 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-coral-300" />
                    <span className="text-xs text-coral-200">{errorMsg}</span>
                    <button
                      onClick={retryCall}
                      className="ml-2 inline-flex items-center gap-1 px-2 py-1 mono-tick text-coral-200 rounded bg-coral-500/15 hover:bg-coral-500/25 transition"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  </div>
                )}
              </div>

              {/* transcript */}
              <div
                ref={transcriptScrollRef}
                className="w-full max-w-xl max-h-44 overflow-y-auto space-y-2 px-2"
              >
                {transcript.map((t, i) => (
                  <div
                    key={i}
                    className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
                      t.role === 'detective'
                        ? 'ml-auto max-w-[80%] bg-aqua-400/10 border border-aqua-400/20 text-cream-100 text-right'
                        : 'mr-auto max-w-[80%] bg-midnight-800/70 border border-cream-50/[0.06] text-cream-200'
                    }`}
                  >
                    <div className="mono-tick text-[9px] mb-0.5 opacity-70">
                      {t.role === 'detective' ? 'You' : w.name}
                    </div>
                    {t.text}
                  </div>
                ))}
                {transcript.length === 0 && status !== 'connecting' && (
                  <p className="text-center mono-tick text-dust-400 py-4">
                    Conversation will appear here.
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        {/* RIGHT: notes */}
        <aside className="dossier rounded-2xl p-5 border border-cream-50/[0.06] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <NotebookPen className="w-3.5 h-3.5 text-magenta-400" />
            <span className="mono-tick text-magenta-400">Case notes</span>
          </div>

          {pendingClues.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="mono-tick text-dust-400">Hidden leads ({pendingClues.length})</span>
                <span className="mono-tick text-amber-300/80 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> -{HINT_COST_HOURS}h
                </span>
              </div>
              <p className="text-[11px] text-dust-400 leading-relaxed mb-2">
                Listen carefully — they will hint at something. {hasConversed
                  ? 'Stuck? Spend hours to reveal what they meant.'
                  : 'Talk with them first, then a hint button will unlock here.'}
              </p>
              <div className="space-y-2">
                {pendingClues.map((clue, idx) => {
                  const busy = hintingClueId === clue.id;
                  const disabled = investigationLocked || !hasConversed || !canAffordHint || busy;
                  const reason = investigationLocked
                    ? 'Mission failed. Investigation is sealed.'
                    : !hasConversed
                    ? 'Have a conversation first'
                    : !canAffordHint
                      ? `Not enough hours (need ${HINT_COST_HOURS}h)`
                      : 'Reveal the lead and log it';
                  return (
                    <button
                      key={clue.id}
                      type="button"
                      onClick={() => requestHint(clue.id)}
                      disabled={disabled}
                      title={reason}
                      className={`w-full text-left text-xs px-3 py-2 rounded-md border transition flex items-center gap-2
                        ${disabled
                          ? 'bg-midnight-800/60 border-cream-50/[0.06] text-dust-500 cursor-not-allowed'
                          : 'bg-midnight-800 border-magenta-400/30 text-cream-100 hover:border-magenta-400/60 hover:bg-magenta-400/[0.08]'}`}
                    >
                      {busy
                        ? <Loader2 className="w-3.5 h-3.5 text-magenta-300 animate-spin shrink-0" />
                        : hasConversed
                          ? <Lightbulb className="w-3.5 h-3.5 text-magenta-300 shrink-0" />
                          : <Lock className="w-3.5 h-3.5 text-dust-500 shrink-0" />}
                      <span className="flex-1">
                        Lead #{idx + 1} — {hasConversed ? 'reveal hint' : 'locked'}
                      </span>
                      <span className="mono-tick text-amber-300/70">-{HINT_COST_HOURS}h</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="mono-tick text-dust-400 mb-2">Recorded ({recordedClues.length})</div>
            {recordedClues.length === 0 ? (
              <p className="text-xs text-dust-400">No clues recorded from {w.name} yet.</p>
            ) : (
              <ul className="space-y-2">
                {recordedClues.map(clue => (
                  <li
                    key={clue.id}
                    className="text-xs px-3 py-2 rounded-md bg-aqua-400/[0.06] border border-aqua-400/20 text-cream-100"
                  >
                    {clue.content}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>

      {/* BOTTOM: call controls */}
      {isLive && (
        <>
          <footer className="absolute bottom-0 inset-x-0 z-30 flex items-center justify-center gap-6 pb-8 pt-4 bg-linear-to-t from-midnight-950/90 via-midnight-950/40 to-transparent">
            <button
              onClick={() => { void toggleMute(); }}
              disabled={status === 'connecting'}
              className={`group relative w-20 h-20 rounded-full grid place-items-center transition-all
                ${muted
                  ? 'bg-coral-500/20 border-2 border-coral-400/50 hover:bg-coral-500/30'
                  : isSpeaking
                    ? 'bg-aqua-400/25 border-2 border-aqua-400 shadow-[0_0_40px_rgba(95,227,208,0.4)] scale-105'
                    : 'bg-aqua-400/10 border-2 border-aqua-400/30 hover:bg-aqua-400/20 hover:border-aqua-400/60'}
                disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {status === 'connecting' ? (
                <Loader2 className="w-7 h-7 text-aqua-200 animate-spin" />
              ) : isSpeaking ? (
                <Waves className="w-7 h-7 text-aqua-100" />
              ) : muted ? (
                <MicOff className="w-7 h-7 text-coral-200" />
              ) : (
                <Mic className="w-7 h-7 text-aqua-200" />
              )}
            </button>

            <button
              onClick={() => { void hangup(); }}
              className="w-16 h-16 rounded-full bg-coral-500/20 border-2 border-coral-400/40 grid place-items-center transition hover:bg-coral-500/30 hover:border-coral-400 hover:shadow-[0_0_30px_rgba(255,122,107,0.35)] active:scale-95"
              aria-label="Hang up"
            >
              <PhoneOff className="w-6 h-6 text-coral-200" />
            </button>
          </footer>

          <div className="absolute bottom-2 inset-x-0 text-center mono-tick text-dust-500 pointer-events-none">
            {muted
              ? 'You are muted — tap to speak'
              : isSpeaking
                ? `${w.name} is talking — you can interrupt at any time`
                : 'Just speak — the witness is listening'}
          </div>
        </>
      )}
    </div>
  );
}

function formatConversationError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Connection failed';
  const normalized = message.toLowerCase();
  if (normalized.includes('permission') || normalized.includes('microphone')) {
    return 'Microphone access is required to call this witness.';
  }
  if (
    normalized.includes('network') ||
    normalized.includes('socket') ||
    normalized.includes('websocket') ||
    normalized.includes('connection')
  ) {
    return 'Channel dropped. Check your connection and retry.';
  }
  if (normalized.includes('signed url') || normalized.includes('token')) {
    return 'ElevenLabs rejected the session. Try again to refresh the channel.';
  }
  return message;
}

/* ── decorative orb ───────────────────────────── */
function Orb({ state }: { state: 'idle' | 'speaking' | 'user' | 'thinking' }) {
  const ring =
    state === 'speaking' ? 'border-aqua-400/70 shadow-[0_0_60px_rgba(95,227,208,0.45)]'
      : state === 'user' ? 'border-coral-400/70 shadow-[0_0_60px_rgba(255,122,107,0.4)]'
      : state === 'thinking' ? 'border-amber-400/60 shadow-[0_0_50px_rgba(255,209,102,0.35)]'
      : 'border-cream-50/15 shadow-[0_0_30px_rgba(255,255,255,0.05)]';
  const pulse = state === 'speaking' || state === 'user' ? 'animate-pulse' : '';
  return (
    <div className={`relative w-56 h-56 rounded-full border-2 ${ring} ${pulse}`}>
      <div className="absolute inset-3 rounded-full border border-cream-50/[0.08]" />
      <div className="absolute inset-8 rounded-full border border-cream-50/[0.05]" />
      <div className="absolute inset-0 grid place-items-center">
        <Phone className="w-10 h-10 text-cream-50/40" />
      </div>
    </div>
  );
}

export default function WitnessInterrogation() {
  return (
    <ConversationProvider>
      <WitnessInterrogationInner />
    </ConversationProvider>
  );
}
