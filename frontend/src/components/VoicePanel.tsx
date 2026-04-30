import { useState, useEffect, useRef } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { Mic, MicOff, Radio, X, AlertCircle, RefreshCw, Waves } from 'lucide-react';
import type { TranscriptEntry } from '../lib/handler-session';
import type { DisconnectionDetails } from '@elevenlabs/types';
import { useAmbientSuppression, useLoopingSound } from './SoundEngine';
import { AUDIO_ASSET_URLS } from '../lib/audio-assets';

interface SessionConfig {
  agentId?: string | null;
  signedUrl?: string | null;
  dynamicVariables?: Record<string, string | number | boolean>;
}

interface ConversationStartOptions {
  userId?: string;
  dynamicVariables?: Record<string, string | number | boolean>;
  overrides?: {
    agent?: {
      prompt?: {
        prompt?: string;
      };
      firstMessage?: string;
    };
  };
}

interface VoicePanelProps {
  agentId: string;
  signedUrl?: string | null;
  characterName: string;
  characterRole: 'handler' | 'witness';
  onClose: () => void;
  resolveSessionConfig?: () => Promise<SessionConfig>;
  systemPrompt?: string;
  initialTranscript?: TranscriptEntry[];
  sessionOptions?: ConversationStartOptions;
  persistTranscript?: (entries: TranscriptEntry[], options: { applyCooldown: boolean }) => void | Promise<void>;
  /** 'modal' = full-screen blocking dialog (default). 'dock' = floating non-blocking side panel. 'inline' = embedded in current layout. */
  variant?: 'modal' | 'dock' | 'inline';
}

function extractApiErrorMessage(message: string): string | null {
  const match = message.match(/^api error \d+:\s*(.*)$/i);
  if (!match) return null;

  const rawBody = match[1]?.trim();
  if (!rawBody) return 'The backend rejected the session request.';

  try {
    const parsed = JSON.parse(rawBody) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error;
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
  } catch {
    // Keep the raw text when the backend did not return JSON.
  }

  return rawBody;
}

function formatConversationError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Connection failed';
  const normalized = message.toLowerCase();
  const apiMessage = extractApiErrorMessage(message);

  if (apiMessage) {
    return apiMessage;
  }

  if (normalized.includes('permission') || normalized.includes('microphone')) {
    return 'Microphone access is required to open the channel.';
  }

  if (
    normalized.includes('network') ||
    normalized.includes('socket') ||
    normalized.includes('websocket') ||
    normalized.includes('livekit') ||
    normalized.includes('disconnect') ||
    normalized.includes('connection')
  ) {
    return 'Channel dropped. Check your connection and retry.';
  }

  if (
    normalized.includes('request error') ||
    normalized.includes('token') ||
    normalized.includes('signed url')
  ) {
    return 'ElevenLabs rejected the session. The channel link may be stale or invalid. Retry to request a fresh session.';
  }

  return message;
}

function formatDisconnectionMessage(details: DisconnectionDetails): string {
  if (details.reason === 'agent') {
    return details.closeReason?.trim() || 'Vivienne closed the channel.';
  }

  if (details.reason === 'error') {
    return details.closeReason?.trim() || details.message?.trim() || 'Channel dropped. Check your connection and retry.';
  }

  return 'Channel closed.';
}

function VoicePanelInner({
  agentId,
  signedUrl,
  characterName,
  characterRole,
  onClose,
  resolveSessionConfig,
  initialTranscript = [],
  sessionOptions,
  persistTranscript,
  variant = 'modal',
}: VoicePanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(initialTranscript);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<TranscriptEntry[]>(initialTranscript);
  const sessionTargetRef = useRef<SessionConfig>({
    agentId: agentId || null,
    signedUrl: signedUrl || null,
    dynamicVariables: sessionOptions?.dynamicVariables,
  });
  const closedByUserRef = useRef(false);
  const hadLiveConnectionRef = useRef(false);
  const autoStartTimeoutRef = useRef<number | null>(null);
  const initialTranscriptLengthRef = useRef(initialTranscript.length);
  const persistedRef = useRef(false);
  const sessionPhaseRef = useRef<'idle' | 'starting' | 'active' | 'ending'>('idle');
  const pendingRestartRef = useRef(false);

  const conversation = useConversation({
    onConnect: () => {
      sessionPhaseRef.current = 'active';
      closedByUserRef.current = false;
      hadLiveConnectionRef.current = true;
      setError(null);
    },
    onDisconnect: (details) => {
      sessionPhaseRef.current = 'idle';
      if (pendingRestartRef.current) {
        pendingRestartRef.current = false;
        void startSession();
        return;
      }

      if (!closedByUserRef.current && hadLiveConnectionRef.current) {
        void flushTranscript(false);
        setError(formatDisconnectionMessage(details));
      }
    },
    onMessage: (message: { source?: string; message?: string }) => {
      if (message.message) {
        const nextEntry = {
          role: message.source === 'user' ? 'user' : 'agent',
          text: message.message,
        } satisfies TranscriptEntry;

        setTranscript(prev => {
          const next = [...prev, nextEntry];
          transcriptRef.current = next;
          return next;
        });
      }
    },
    onError: (err: unknown) => {
      sessionPhaseRef.current = 'idle';
      if (pendingRestartRef.current) {
        pendingRestartRef.current = false;
        void startSession();
        return;
      }

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
    sessionTargetRef.current = {
      agentId: agentId || sessionTargetRef.current.agentId || null,
      signedUrl: signedUrl || null,
      dynamicVariables: sessionTargetRef.current.dynamicVariables,
    };
  }, [agentId, signedUrl]);

  useEffect(() => {
    autoStartTimeoutRef.current = window.setTimeout(() => {
      void startSession();
    }, 0);

    return () => {
      if (autoStartTimeoutRef.current !== null) {
        window.clearTimeout(autoStartTimeoutRef.current);
      }
      safeEndSession(true);
    };
  }, []);

  useEffect(() => {
    transcriptRef.current = transcript;
    const node = transcriptScrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [transcript]);

  async function flushTranscript(applyCooldown: boolean) {
    if (!persistTranscript || persistedRef.current) return;

    const newEntries = transcriptRef.current.slice(initialTranscriptLengthRef.current);
    if (newEntries.length === 0) {
      persistedRef.current = true;
      return;
    }

    persistedRef.current = true;
    await persistTranscript(newEntries, { applyCooldown });
  }

  async function getSessionTarget(): Promise<SessionConfig> {
    let resolvedAgentId = sessionTargetRef.current.agentId || null;
    let resolvedSignedUrl = sessionTargetRef.current.signedUrl || null;
    let resolvedDynamicVariables = sessionTargetRef.current.dynamicVariables;

    if (resolveSessionConfig) {
      try {
        const next = await resolveSessionConfig();
        resolvedAgentId = next.agentId || resolvedAgentId;
        resolvedSignedUrl = next.signedUrl || resolvedSignedUrl || null;
        resolvedDynamicVariables = next.dynamicVariables || resolvedDynamicVariables;
      } catch (err) {
        if (!resolvedAgentId && !resolvedSignedUrl) {
          throw err;
        }
      }
    }

    const resolvedTarget = {
      agentId: resolvedAgentId,
      signedUrl: resolvedSignedUrl,
      dynamicVariables: resolvedDynamicVariables,
    };
    sessionTargetRef.current = resolvedTarget;
    return resolvedTarget;
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

    const sessionTarget = await getSessionTarget();
    if (!sessionTarget.signedUrl && !sessionTarget.agentId) {
      setError('Agent channel is still provisioning. Try again in a moment.');
      return;
    }

    closedByUserRef.current = false;
    hadLiveConnectionRef.current = false;
    persistedRef.current = false;
    pendingRestartRef.current = false;
    sessionPhaseRef.current = 'starting';
    initialTranscriptLengthRef.current = transcriptRef.current.length;
    setError(null);
    try {
      const startOptions = sessionTarget.dynamicVariables
        ? {
            ...sessionOptions,
            dynamicVariables: {
              ...(sessionOptions?.dynamicVariables || {}),
              ...sessionTarget.dynamicVariables,
            },
          }
        : sessionOptions;

      // Runtime prompt/first-message overrides are only used in the failed
      // Vivienne debrief flow. Prefer starting those sessions by agentId so the
      // overrides are applied directly instead of relying on a signed URL that
      // may have been minted for the base agent config.
      const shouldPreferAgentId = Boolean(sessionOptions?.overrides && sessionTarget.agentId);

      await navigator.mediaDevices.getUserMedia({ audio: true });
      if (sessionTarget.signedUrl && !shouldPreferAgentId) {
        await conversation.startSession({ signedUrl: sessionTarget.signedUrl, ...startOptions });
      } else {
        await conversation.startSession({
          agentId: sessionTarget.agentId!,
          ...(shouldPreferAgentId ? { connectionType: 'websocket' as const } : {}),
          ...startOptions,
        });
      }
    } catch (err) {
      sessionPhaseRef.current = 'idle';
      setError(formatConversationError(err));
    }
  }

  async function handleClose() {
    await flushTranscript(false);
    safeEndSession(true);
    onClose();
  }

  async function handleRetry() {
    setError(null);
    transcriptRef.current = initialTranscript;
    setTranscript(initialTranscript);
    closedByUserRef.current = false;
    persistedRef.current = false;

    if (sessionPhaseRef.current === 'idle') {
      await startSession();
      return;
    }

    pendingRestartRef.current = true;
    safeEndSession(true);
  }

  const isHandler = characterRole === 'handler';
  const accentText = isHandler ? 'text-aqua-400' : 'text-coral-400';
  const accentBg   = isHandler ? 'bg-aqua-400/15 border-aqua-400/40' : 'bg-coral-500/15 border-coral-500/40';

  useLoopingSound(AUDIO_ASSET_URLS.commsLoading, status === 'connecting', 0.38);
  useAmbientSuppression(status === 'connecting' || status === 'connected');

  const isDock = variant === 'dock';
  const isInline = variant === 'inline';
  const wrapperClass = isInline
    ? 'relative w-full pointer-events-auto'
    : isDock
    ? 'fixed bottom-20 left-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] pointer-events-auto'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/75 backdrop-blur-sm p-4';
  const cardClass = isInline
    ? 'relative w-full bg-midnight-900/90 backdrop-blur-md border border-cream-50/[0.10] rounded-xl shadow-[0_14px_34px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col h-[27rem]'
    : isDock
    ? 'relative w-full bg-midnight-900/95 backdrop-blur-xl border border-cream-50/[0.10] rounded-xl shadow-[0_18px_48px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col max-h-[60vh]'
    : 'relative w-full max-w-md bg-midnight-900 border border-cream-50/[0.08] rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[82vh]';
  const transcriptClass = isInline
    ? 'relative flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0'
    : 'relative flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[200px]';

  return (
    <div className={wrapperClass}>
      <div className={cardClass}>
        {/* decorative bg */}
        <div className="absolute inset-0 bg-atlas-grid opacity-25 pointer-events-none" />
        <div className={`absolute -top-24 -right-24 w-72 h-72 ${isHandler ? 'bg-aqua-400/10' : 'bg-coral-500/10'} blur-3xl pointer-events-none`} />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-cream-50/[0.06]">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-md ${accentBg} border flex items-center justify-center shrink-0`}>
              <Radio className={`w-4 h-4 ${accentText}`} />
            </div>
            <div className="min-w-0">
              <div className={`mono-tick ${accentText}`}>
                {isHandler ? 'Channel 7 · Encrypted' : 'Witness · Live Feed'}
              </div>
              <h3 className="font-display italic font-semibold text-cream-50 truncate text-lg leading-tight">
                {characterName}
              </h3>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-midnight-700 text-dust-400 hover:text-cream-50 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status */}
        <div className="relative flex items-center justify-center gap-4 py-5 border-b border-cream-50/[0.06]">
          {status === 'connected' ? (
            <div className="relative">
              {isSpeaking && (
                <span className={`absolute inset-0 rounded-full ${isHandler ? 'bg-aqua-400/30' : 'bg-coral-500/30'} blur-xl animate-pulse`} />
              )}
              <div className={`relative p-4 rounded-full border ${
                isSpeaking
                  ? (isHandler ? 'bg-aqua-400/15 border-aqua-400/50' : 'bg-coral-500/15 border-coral-500/50')
                  : 'bg-midnight-800 border-cream-50/[0.08]'
              }`}>
                {isSpeaking
                  ? <Waves className={`w-6 h-6 ${accentText}`} />
                  : <Mic className="w-6 h-6 text-aqua-400" />}
              </div>
            </div>
          ) : status === 'connecting' ? (
            <div className="p-4 rounded-full bg-amber-400/10 border border-amber-400/40 animate-pulse">
              <Radio className="w-6 h-6 text-amber-400" />
            </div>
          ) : (
            <div className="p-4 rounded-full bg-midnight-800 border border-cream-50/[0.08]">
              <MicOff className="w-6 h-6 text-dust-400" />
            </div>
          )}
          <div>
            <div className="mono-tick text-dust-400">Status</div>
            <p className="text-sm text-cream-50 font-display italic">
              {status === 'connected' && isSpeaking && `${isHandler ? 'Handler' : 'Witness'} speaking…`}
              {status === 'connected' && !isSpeaking && 'Listening…'}
              {status === 'connecting' && 'Establishing channel…'}
              {status === 'disconnected' && 'Channel closed'}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="relative px-5 py-3 bg-coral-500/[0.08] border-b border-coral-500/20 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-coral-400 shrink-0" />
            <p className="text-xs text-coral-300 flex-1">{error}</p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 px-2 py-1 mono-tick text-coral-300 rounded bg-coral-500/15 hover:bg-coral-500/25 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Transcript */}
        <div ref={transcriptScrollRef} className={transcriptClass}>
          {transcript.length === 0 && !error && (
            <div className="text-center mt-10 space-y-2">
              <p className="mono-tick text-dust-400">
                {status === 'connected' ? '— Speak to begin —' : '— Awaiting connection —'}
              </p>
              <p className="text-xs text-dust-300 normal-case tracking-normal font-sans px-6">
                {isHandler
                  ? 'Your handler will brief you. Ask anything about the case.'
                  : 'Press them gently — witnesses share what they remember.'}
              </p>
            </div>
          )}
          {transcript.map((entry, i) => (
            <div key={i} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed ${
                entry.role === 'user'
                  ? 'bg-cream-50/[0.08] text-cream-50 border border-cream-50/[0.08]'
                  : `${isHandler ? 'bg-aqua-400/[0.10] border-aqua-400/20 text-aqua-100' : 'bg-coral-500/[0.10] border-coral-500/20 text-coral-100'} border`
              }`}>
                <div className={`mono-tick mb-1 ${entry.role === 'user' ? 'text-dust-400' : accentText}`}>
                  {entry.role === 'user' ? 'You' : characterName}
                </div>
                {entry.text}
              </div>
            </div>
          ))}
        </div>

        {/* Footer with prominent hangup (dock variant only) */}
        {isDock && (
          <div className="relative px-4 py-3 border-t border-cream-50/[0.06] bg-midnight-950/60 flex items-center justify-between gap-3">
            <span className="mono-tick text-dust-400 truncate">
              {status === 'connected' ? 'Channel live' : status === 'connecting' ? 'Opening channel…' : 'Channel closed'}
            </span>
            <button
              onClick={handleClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-coral-500/15 border border-coral-400/40 text-coral-200 hover:bg-coral-500/25 hover:border-coral-400/70 transition mono-tick"
              title="End the call"
            >
              <X className="w-3.5 h-3.5" />
              End call
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VoicePanel(props: VoicePanelProps) {
  return (
    <ConversationProvider>
      <VoicePanelInner {...props} />
    </ConversationProvider>
  );
}
