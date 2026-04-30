import { useState, type ReactNode } from 'react';
import {
  Briefcase, MapPin, Globe2, ChevronRight, Radio, Phone,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import HandlerConsole from './HandlerConsole';
import GameHUD from './GameHUD';
import ViviennePortrait from './ViviennePortrait';
import type { ViewState } from '../context/GameContext';

/**
 * InGameShell: layout wrapper that mounts persistent overlays around the
 * three in-game interfaces (Mission File, Current City, Atlas).
 *
 * Persistent across view switches:
 *   - Persons-of-Interest rail — collapsible right edge. Hosts the
 *     handler call shortcut (Vivienne) as the first card; the dock VoicePanel
 *     anchors to the bottom-left regardless of where the trigger lives.
 *   - View switcher — bottom-center pill, three discrete interfaces.
 */
export default function InGameShell({ children }: { children: ReactNode }) {
  const { gameState, view } = useGame();

  if (!gameState) return <>{children}</>;

  // Only show overlays on the three primary interfaces.
  const showOverlays = view === 'briefing' || view === 'case-board' || view === 'globe';
  // Mission File already hosts a full Vivienne handler panel — no need to
  // duplicate the rail entry there.
  const showHandlerRail = showOverlays && view !== 'briefing';

  return (
    <div className="relative h-full w-full">
      {children}
      {showOverlays && (
        <>
          <GameHUD />
          {showHandlerRail && <PersonsOfInterestRail />}
          <ViewSwitcher />
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   View switcher (3 interfaces, no tabs) — bottom-center
   ──────────────────────────────────────────────────────────── */
function ViewSwitcher() {
  const { view, setView, gameState } = useGame();
  const hasCurrentCity = !!gameState?.currentCityId;

  const items: Array<{ id: ViewState; label: string; icon: typeof Briefcase; disabled?: boolean }> = [
    { id: 'briefing',   label: 'Mission File',  icon: Briefcase },
    { id: 'case-board', label: 'Current City',  icon: MapPin, disabled: !hasCurrentCity },
    { id: 'globe',      label: 'Atlas',         icon: Globe2 },
  ];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-full bg-midnight-900/90 backdrop-blur-md border border-cream-50/[0.10] shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        {items.map(({ id, label, icon: Icon, disabled }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && setView(id)}
              title={disabled ? 'Travel to a city first' : label}
              className={`flex items-center gap-2 h-9 px-4 rounded-full mono-tick transition-all
                ${active
                  ? 'bg-aqua-400 text-midnight-950 shadow-[0_0_24px_rgba(95,227,208,0.4)]'
                  : disabled
                    ? 'text-dust-500 cursor-not-allowed'
                    : 'text-cream-200 hover:bg-cream-50/[0.06] hover:text-cream-50'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Handler rail — collapsible right-edge panel for Vivienne.
   Hosts the inline VoicePanel so the avatar + transcript stay
   in one place. Suspect files live in the Arrest Warrant.
   ──────────────────────────────────────────────────────────── */
function PersonsOfInterestRail() {
  const { gameState } = useGame();
  const [open, setOpen] = useState(false);

  if (!gameState) return null;

  const handler = gameState.handler;
  const RAIL_WIDTH = 380;

  return (
    <>
      {/* Toggle handle — subtle phone tab */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={open ? 'Hide handler channel' : `Call Vivienne · ${handler.supportCallsRemaining} left`}
        aria-label={open ? 'Hide handler channel' : 'Call Vivienne'}
        className="fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-9 h-9 rounded-l-md border border-r-0 transition-all pointer-events-auto
          bg-midnight-900/70 hover:bg-midnight-900/90 backdrop-blur-md border-cream-50/[0.08] text-aqua-300/80 hover:text-aqua-200"
        style={{ right: open ? RAIL_WIDTH : 0 }}
      >
        {open
          ? <ChevronRight className="w-4 h-4" />
          : <Phone className="w-4 h-4" />}
        {/* tiny availability dot */}
        {!open && (
          <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${handler.canCall ? 'bg-aqua-400' : 'bg-amber-400'}`} />
        )}
      </button>

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-40 bg-midnight-900/92 backdrop-blur-xl border-l border-cream-50/[0.08] transition-transform duration-300 ease-out pointer-events-auto
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: RAIL_WIDTH }}
        aria-hidden={!open}
      >
        <div className="h-full overflow-y-auto px-4 py-5">
          <VivienneRailCard handler={handler} />
        </div>
      </aside>
    </>
  );
}

/* ────────────────────────────────────────────────────────────
  Vivienne card — portrait, identity, and the
   inline handler call (button → transcript in-place).
   ──────────────────────────────────────────────────────────── */
function VivienneRailCard({ handler }: { handler: NonNullable<ReturnType<typeof useGame>['gameState']>['handler'] }) {
  return (
    <div className="dossier rounded-2xl overflow-hidden flex flex-col relative">
      {/* glow */}
      <div className="absolute -top-20 -right-20 w-56 h-56 bg-aqua-400/15 blur-[80px] pointer-events-none" />
      <div className="absolute inset-0 bg-atlas-grid opacity-[0.15] pointer-events-none" />

      {/* identity header */}
      <div className="relative px-5 pt-6 pb-4 border-b border-cream-50/[0.06]">
        <div className="absolute top-3 right-3 flex items-center gap-1.5 mono-tick px-2 py-0.5 rounded-full bg-midnight-950/60 border border-cream-50/[0.06]">
          <span className={`w-1.5 h-1.5 rounded-full ${handler.canCall ? 'bg-aqua-400 animate-pulse-soft' : 'bg-amber-400'}`} />
          <span className={handler.canCall ? 'text-aqua-400' : 'text-amber-400'}>
            {handler.canCall ? 'On standby' : 'Offline'}
          </span>
        </div>

        <div className="flex flex-col items-center text-center">
          {/* portrait avatar */}
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border border-aqua-400/20" />
            <div className="absolute inset-1.5 rounded-full border border-aqua-400/15" />
            <div className="absolute inset-3 rounded-full overflow-hidden bg-midnight-950 border border-aqua-400/30 backdrop-blur-sm shadow-[0_0_32px_-14px_rgba(95,227,208,0.45)]">
              <ViviennePortrait
                imageClassName="h-full w-full object-cover object-center"
                fallbackClassName="flex h-full w-full items-center justify-center bg-aqua-400/[0.08] font-display text-3xl italic text-aqua-200"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,24,0.02),rgba(5,15,24,0.24))] pointer-events-none" />
            </div>
          </div>

          <div className="mt-3">
            <div className="mono-tick text-coral-400">Handler · Codename</div>
            <h2 className="font-display italic font-semibold text-cream-50 text-2xl leading-none mt-1">
              Vivienne
            </h2>
            <p className="mono-tick text-dust-400 mt-1.5">London Station · Atlas Bureau</p>
          </div>
        </div>
      </div>

      {/* status strip */}
      <div className="relative px-4 py-2.5 border-b border-cream-50/[0.06] flex items-center justify-between bg-midnight-950/30">
        <div className="flex items-center gap-2 mono-tick text-dust-400">
          <Radio className="w-3 h-3" /> Channel 7 · Encrypted
        </div>
        <span className="mono-tick text-aqua-300">
          {handler.supportCallsRemaining} call{handler.supportCallsRemaining === 1 ? '' : 's'} left
        </span>
      </div>

      {/* call surface — inline trigger or live transcript */}
      <div className="relative p-4">
        {!handler.canCall && handler.reason && (
          <p className="text-[11px] text-dust-300 leading-relaxed mb-3">
            {handler.reason}
          </p>
        )}
        <HandlerConsole variant="inline" />
      </div>
    </div>
  );
}
