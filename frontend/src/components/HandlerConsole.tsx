import { useState, useCallback, useEffect } from 'react';
import { Radio, PhoneCall } from 'lucide-react';
import { useAmbientSuppression, useLoopingSound, useSoundEngine } from './SoundEngine';
import VoicePanel from './VoicePanel';
import * as api from '../lib/api';
import { AUDIO_ASSET_URLS } from '../lib/audio-assets';
import type { AgentConfig } from '../types';
import { useGame } from '../context/GameContext';
import {
  buildHandlerSessionPlan,
  persistHandlerSession,
} from '../lib/handler-session';

interface HandlerConsoleProps {
  /** 'dock' = compact toolbar button + floating bottom-left voice panel.
   *  'inline' = full-width primary CTA + voice panel rendered in-flow. */
  variant?: 'dock' | 'inline';
}

export default function HandlerConsole({ variant = 'dock' }: HandlerConsoleProps) {
  const { gameState, refreshGameState } = useGame();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [sessionPlan, setSessionPlan] = useState<ReturnType<typeof buildHandlerSessionPlan> | null>(null);
  const [loading, setLoading] = useState(false);
  const { playTransition } = useSoundEngine();

  useLoopingSound(AUDIO_ASSET_URLS.commsLoading, loading, 0.32);
  useAmbientSuppression(loading);

  useEffect(() => {
    if (!gameState?.handler.canCall && open) {
      setOpen(false);
    }
  }, [gameState?.handler.canCall, open]);

  const handleOpen = useCallback(async () => {
    if (open) { setOpen(false); return; }
    if (!gameState) return;

    const nextPlan = buildHandlerSessionPlan(gameState);
    setSessionPlan(nextPlan);

    if (!nextPlan.canCall) {
      return;
    }

    setLoading(true);
    try {
      const cfg = await api.getHandlerConfig() as AgentConfig;
      setConfig(cfg);
      setSessionPlan(nextPlan);
      await refreshGameState();
      playTransition(AUDIO_ASSET_URLS.handlerOpen);
      setOpen(true);
    } catch {
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [gameState, open, playTransition, refreshGameState]);

  const handleClose = useCallback(() => setOpen(false), []);
  const supportCallsRemaining = gameState?.resources.supportCallsRemaining ?? 0;
  const unavailableReason = gameState?.handler.reason ?? null;
  const canCall = !!gameState?.handler.canCall;
  const isInline = variant === 'inline';

  // Inline variant: hide the trigger entirely while the panel is open so the
  // VoicePanel takes over the space. Render the panel right where the
  // component sits, full-width, instead of as a floating dock.
  if (isInline) {
    if (open && config && sessionPlan) {
      return (
        <VoicePanel
          agentId={config.agentId}
          signedUrl={config.signedUrl}
          characterName={config.characterName}
          characterRole="handler"
          variant="inline"
          onClose={handleClose}
          resolveSessionConfig={async () => await api.getHandlerConfig() as AgentConfig}
          initialTranscript={sessionPlan.initialTranscript}
          sessionOptions={sessionPlan.startOptions}
          persistTranscript={async (entries, { applyCooldown }) => {
            if (!gameState) return;
            persistHandlerSession(gameState, entries, applyCooldown);
          }}
        />
      );
    }
    return (
      <button
        onClick={handleOpen}
        disabled={loading || !gameState || !canCall}
        title={unavailableReason ?? 'Open Handler Channel · Channel 7 secure'}
        className={`group w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg border transition-all mono-tick
          ${canCall
            ? 'bg-aqua-400/[0.12] border-aqua-400/50 text-aqua-200 hover:bg-aqua-400/[0.22] hover:border-aqua-400/80 hover:text-aqua-50 shadow-[0_0_24px_-8px_rgba(95,227,208,0.5)]'
            : 'bg-midnight-800/60 border-cream-50/[0.08] text-dust-400'}
          disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <PhoneCall className={`w-4 h-4 ${canCall ? 'group-hover:scale-110 transition-transform' : ''}`} />
        <span>{loading ? 'Opening channel…' : canCall ? 'Open channel' : 'Channel offline'}</span>
        <span className="ml-1 text-[10px] opacity-70">· {supportCallsRemaining} left</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={loading || !gameState || !canCall}
        title={unavailableReason ?? 'Open Handler Channel · Channel 7 secure'}
        className={`relative flex items-center gap-2 h-10 px-3 rounded-md border transition-all
          ${open
            ? 'bg-aqua-400/[0.12] border-aqua-400/60 text-aqua-300'
            : 'bg-midnight-800/60 border-cream-50/[0.08] text-cream-300 hover:border-aqua-400/60 hover:text-aqua-400 hover:bg-aqua-400/[0.06]'}
          disabled:opacity-50`}
      >
        <Radio className={`w-4 h-4 ${open ? 'text-aqua-300' : ''}`} />
        <span className="hidden md:inline mono-tick">Handler · {supportCallsRemaining}</span>
        {/* live indicator */}
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className={`absolute inline-flex h-full w-full rounded-full ${canCall ? 'animate-ping bg-aqua-400 opacity-60' : 'bg-amber-400 opacity-40'}`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-midnight-900 ${canCall ? 'bg-aqua-400' : 'bg-amber-400'}`} />
        </span>
      </button>

      {open && config && sessionPlan && (
        <VoicePanel
          agentId={config.agentId}
          signedUrl={config.signedUrl}
          characterName={config.characterName}
          characterRole="handler"
          variant="dock"
          onClose={handleClose}
          resolveSessionConfig={async () => await api.getHandlerConfig() as AgentConfig}
          initialTranscript={sessionPlan.initialTranscript}
          sessionOptions={sessionPlan.startOptions}
          persistTranscript={async (entries, { applyCooldown }) => {
            if (!gameState) return;
            persistHandlerSession(gameState, entries, applyCooldown);
          }}
        />
      )}
    </>
  );
}
