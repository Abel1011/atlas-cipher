import { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert, AlertTriangle, Check, X, Loader2, Gavel, FileWarning, Radio, Lock,
  Clock, Coins, Map as MapIcon, FileText, Crosshair, Skull,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSoundEngine } from './SoundEngine';
import VoicePanel from './VoicePanel';
import * as api from '../lib/api';
import { buildHandlerSessionPlan, persistHandlerSession } from '../lib/handler-session';
import type { GameState } from '../types';

interface ArrestWarrantProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FailureStats {
  hoursUsed: number;
  totalHours: number;
  creditsUsed: number;
  totalCredits: number;
  supportCallsLeft: number;
  citiesVisited: number;
  citiesTotal: number;
  cluesRecorded: number;
  routeClues: number;
  suspectClues: number;
  corroboratingClues: number;
}

function computeFailureStats(state: GameState): FailureStats {
  return {
    hoursUsed: Math.max(0, state.resources.totalHours - state.resources.remainingHours),
    totalHours: state.resources.totalHours,
    creditsUsed: Math.max(0, state.resources.totalCredits - state.resources.remainingCredits),
    totalCredits: state.resources.totalCredits,
    supportCallsLeft: state.resources.supportCallsRemaining,
    citiesVisited: state.case.cities.filter(c => c.visited).length,
    citiesTotal: state.case.cities.length,
    cluesRecorded: state.discoveredClues.filter(c => !!c.discoveredAt).length,
    routeClues: state.warrant.routeClues,
    suspectClues: state.warrant.suspectClues,
    corroboratingClues: state.warrant.corroboratingClues,
  };
}

export default function ArrestWarrant({ isOpen, onClose }: ArrestWarrantProps) {
  const { gameState, arrestSuspect, arrestResult, dismissArrestResult, startNewGame, loading } = useGame();
  const { playNarration } = useSoundEngine();
  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [failureChannelOpen, setFailureChannelOpen] = useState(false);
  const failureSessionPlan = useMemo(
    () => (gameState ? buildHandlerSessionPlan(gameState) : null),
    [gameState],
  );

  useEffect(() => {
    if (isOpen) return;
    setShowConfirmation(false);
    setSubmittingDecision(false);
  }, [isOpen]);

  if (!gameState) return null;

  // Full-screen dramatic failure debrief. Shown immediately after a wrong
  // arrest while `arrestResult` still holds the failure payload — independent
  // of `isOpen` so the player can't dismiss it by clicking a backdrop.
  if (arrestResult && !arrestResult.correct) {
    const stats = computeFailureStats(gameState);
    const failedSuspectName = arrestResult.suspectName || 'the detained target';
    return (
      <FullScreenFailureDebrief
        stats={stats}
        caseTitle={gameState.case.title}
        failedSuspectName={failedSuspectName}
        channelOpen={failureChannelOpen}
        onToggleChannel={() => setFailureChannelOpen(open => !open)}
        sessionPlan={failureSessionPlan}
        gameState={gameState}
        onDismiss={() => {
          setFailureChannelOpen(false);
          dismissArrestResult();
          onClose();
        }}
      />
    );
  }

  if (!isOpen) return null;

  const strandedOverride = gameState.warrant.overrideMode === 'stranded';
  const missionFailed = gameState.status === 'failed';
  const canArrest = selectedSuspectId !== null && gameState.warrant.ready;
  const selectedSuspect = gameState.case.suspects.find(s => s.id === selectedSuspectId);

  const handleIssueWarrant = () => {
    if (canArrest) setShowConfirmation(true);
  };

  const handleConfirmArrest = async () => {
    if (!selectedSuspectId) return;
    setSubmittingDecision(true);
    const result = await arrestSuspect(selectedSuspectId);
    if (result) {
      setShowConfirmation(false);
    }
    setSubmittingDecision(false);
  };

  if (arrestResult?.correct) {
    return (
      <Backdrop onClick={onClose}>
        <Sheet>
          <div className="flex flex-col items-center text-center gap-5 px-2 py-4">
            <div className="stamp-circle text-aqua-400 animate-stamp">
              <div className="text-xs">Closed</div>
              <div className="text-[8px] mt-1 opacity-80">04 · 2026</div>
            </div>
            <h2 className="font-display italic font-semibold text-3xl text-cream-50">
              Brilliant work, agent.
            </h2>
            <p className="text-sm text-cream-300 leading-relaxed max-w-sm">
              {arrestResult.suspectName} has been apprehended. The file is sealed.
            </p>
            {arrestResult.narrationUrl && (
              <button
                onClick={() => playNarration(arrestResult.narrationUrl)}
                className="mono-tick px-4 py-2 rounded-md border border-cream-50/[0.12] text-cream-300 hover:text-cream-50 hover:border-aqua-400/40 transition-colors"
              >
                Play Narration
              </button>
            )}
            <div className="flex gap-3 mt-2">
              <button onClick={startNewGame} className="btn-coral inline-flex items-center gap-2 px-6 py-3 rounded-md text-cream-50 font-mono uppercase tracking-[0.2em] text-xs">
                <Gavel className="w-4 h-4" /> Next Case
              </button>
            </div>
          </div>
        </Sheet>
      </Backdrop>
    );
  }

  if (missionFailed) {
    const stats = computeFailureStats(gameState);
    return (
      <Backdrop onClick={onClose}>
        <Sheet wide>
          <div className="flex items-center justify-between mb-6 pb-5 border-b border-cream-50/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-coral-500/15 border border-coral-500/40 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-coral-400" />
              </div>
              <div>
                <div className="mono-tick text-coral-400">Form W-7 · Failed</div>
                <h2 className="font-display italic font-semibold text-xl text-cream-50 leading-tight">Case File · Closed</h2>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-midnight-700 text-dust-400 hover:text-cream-50 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
              <div className="rounded-xl border border-coral-500/25 bg-coral-500/[0.08] px-5 py-5">
                <div className="mono-tick text-coral-300 mb-1.5">Wrong target</div>
                <h3 className="font-display italic font-semibold text-[2rem] text-cream-50 leading-[1.02]">
                  {gameState.case.title} · file closed.
                </h3>
                <p className="text-sm text-cream-200 leading-relaxed mt-3 max-w-2xl">
                  Travel and live witness contact are sealed. The atlas, notebook, and dossier remain available for review.
                </p>
              </div>

              <div className="rounded-xl border border-cream-50/[0.08] bg-midnight-800/45 px-4 py-4">
                <div className="mono-tick text-dust-400 mb-2">Locked operations</div>
                <div className="space-y-2.5 text-xs text-cream-200 leading-relaxed">
                  <p>Globe travel is frozen at the point of arrest.</p>
                  <p>Witness channels remain archived, but no new calls can be opened.</p>
                  <p>Use this review panel to audit where the case broke.</p>
                </div>
              </div>
            </div>

            <FailureStatsGrid stats={stats} dense />

            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3.5 flex items-start gap-3">
              <Lock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <div className="mono-tick text-amber-300 mb-1">Debrief closed</div>
                <p className="text-xs text-amber-100 leading-relaxed">
                  The Vivienne debrief only appears on the initial failure screen. This view keeps the mission ledger and the post-mortem summary only.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={onClose} className="mono-tick px-5 py-3 border border-cream-50/[0.12] rounded-md text-cream-300 hover:text-cream-50 hover:border-cream-50/30 transition-colors">
                Return to file
              </button>
            </div>
          </div>
        </Sheet>
      </Backdrop>
    );
  }

  if (showConfirmation) {
    return (
      <Backdrop>
        <Sheet small>
          <div className="flex flex-col items-center text-center gap-5 px-2 py-2">
            <div className="w-14 h-14 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center">
              <FileWarning className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="font-display italic font-semibold text-2xl text-cream-50">Issue Warrant?</h3>
            <p className="text-sm text-cream-300">
              You are about to arrest <span className="text-coral-400 font-display italic font-semibold">{selectedSuspect?.name}</span>.
              <br />
              <span className="mono-tick text-dust-400">
                {strandedOverride ? 'Resources are exhausted. This is a risk warrant.' : 'This decision is final.'}
              </span>
            </p>
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={submittingDecision || loading}
                className="flex-1 mono-tick px-4 py-2.5 border border-cream-50/[0.12] rounded-md text-cream-300 hover:text-cream-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmArrest}
                disabled={submittingDecision || loading}
                className="btn-coral flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-cream-50 font-mono uppercase tracking-[0.2em] text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submittingDecision || loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                {submittingDecision || loading ? 'Issuing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </Sheet>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet>
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-cream-50/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-coral-500/15 border border-coral-500/40 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-coral-400" />
            </div>
            <div>
              <div className="mono-tick text-coral-400">Form W-7 · Restricted</div>
              <h2 className="font-display italic font-semibold text-xl text-cream-50 leading-tight">Arrest Warrant</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-midnight-700 text-dust-400 hover:text-cream-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {strandedOverride ? (
            <div className="flex items-start gap-3 p-3 rounded-md bg-amber-400/[0.06] border border-amber-400/30">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400 leading-relaxed">
                {gameState.warrant.reason ?? 'No further travel or witness calls are available. You may issue a warrant with the intel you have.'}
              </p>
            </div>
          ) : !gameState.warrant.ready && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-amber-400/[0.06] border border-amber-400/30">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400 leading-relaxed">
                {gameState.warrant.reason ?? 'Insufficient evidence. Recover route, suspect, and corroborating clues before issuing a warrant.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-cream-50/[0.08] bg-midnight-800/40 px-2 py-2">
              <div className="mono-tick text-dust-400">Route</div>
              <div className="font-display italic text-aqua-400 text-lg leading-none mt-1">{gameState.warrant.routeClues}</div>
            </div>
            <div className="rounded-md border border-cream-50/[0.08] bg-midnight-800/40 px-2 py-2">
              <div className="mono-tick text-dust-400">Suspect</div>
              <div className="font-display italic text-coral-400 text-lg leading-none mt-1">{gameState.warrant.suspectClues}</div>
            </div>
            <div className="rounded-md border border-cream-50/[0.08] bg-midnight-800/40 px-2 py-2">
              <div className="mono-tick text-dust-400">Corroboration</div>
              <div className="font-display italic text-amber-400 text-lg leading-none mt-1">{gameState.warrant.corroboratingClues}</div>
            </div>
          </div>

          <div className="mono-tick text-dust-400 px-1 pt-1">Persons of Interest</div>

          {gameState.case.suspects.map((suspect, i) => (
            <button
              key={suspect.id}
              onClick={() => setSelectedSuspectId(suspect.id)}
              className={`w-full text-left p-4 rounded-md border transition-all flex items-start gap-3 ${
                selectedSuspectId === suspect.id
                  ? 'border-coral-500/60 bg-coral-500/[0.08] shadow-[0_8px_30px_-12px_rgba(255,122,107,0.4)]'
                  : 'border-cream-50/[0.08] bg-midnight-800/40 hover:border-cream-50/20'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mono-tick text-[10px] shrink-0 ${
                selectedSuspectId === suspect.id
                  ? 'bg-coral-500 text-midnight-950'
                  : 'bg-midnight-700 text-dust-300 border border-cream-50/[0.08]'
              }`}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display italic font-semibold text-cream-50">{suspect.name}</div>
                <p className="text-xs text-cream-300 mt-1 leading-relaxed">
                  {suspect.profiled && suspect.description
                    ? suspect.description
                    : 'Profile sealed until direct suspect intel is logged.'}
                </p>
                <p className="mono-tick text-dust-400 mt-2">Evidence count: {suspect.evidenceCount}</p>
              </div>
              {selectedSuspectId === suspect.id && (
                <Check className="w-4 h-4 text-coral-400 shrink-0" />
              )}
            </button>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-cream-50/[0.08]">
          <button
            onClick={handleIssueWarrant}
            disabled={!canArrest || loading}
            className="btn-coral w-full inline-flex items-center justify-center gap-3 px-4 py-3.5 rounded-md text-cream-50 font-mono uppercase tracking-[0.2em] text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
            {strandedOverride ? 'Issue Risk Warrant' : 'Issue Warrant'}
          </button>
        </div>
      </Sheet>
    </Backdrop>
  );
}

function Backdrop({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-midnight-950/75 backdrop-blur-sm" onClick={onClick} />
      {children}
    </div>
  );
}

function Sheet({ children, small, wide }: { children: React.ReactNode; small?: boolean; wide?: boolean }) {
  return (
    <div className={`relative w-full ${small ? 'max-w-sm' : wide ? 'max-w-5xl' : 'max-w-md'} bg-midnight-900 border border-cream-50/[0.08] rounded-lg p-6 shadow-2xl overflow-hidden`}>
      <div className="absolute inset-0 bg-atlas-grid opacity-30 pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-coral-500/10 blur-3xl pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
}

interface FailureStatsGridProps {
  stats: FailureStats;
  dense?: boolean;
  animated?: boolean;
}

function FailureStatsGrid({ stats, dense = false, animated = false }: FailureStatsGridProps) {
  const items: Array<{ icon: React.ReactNode; label: string; value: string; sub?: string; tone: 'amber' | 'aqua' | 'coral' }> = [
    {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Hours burned',
      value: `${stats.hoursUsed}h`,
      sub: `of ${stats.totalHours}h`,
      tone: 'amber',
    },
    {
      icon: <Coins className="w-3.5 h-3.5" />,
      label: 'Credits spent',
      value: `${stats.creditsUsed}`,
      sub: `of ${stats.totalCredits} cr`,
      tone: 'aqua',
    },
    {
      icon: <Radio className="w-3.5 h-3.5" />,
      label: 'Support left',
      value: `${stats.supportCallsLeft}`,
      sub: 'call windows',
      tone: 'coral',
    },
    {
      icon: <MapIcon className="w-3.5 h-3.5" />,
      label: 'Cities visited',
      value: `${stats.citiesVisited}`,
      sub: `of ${stats.citiesTotal}`,
      tone: 'aqua',
    },
    {
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'Clues recorded',
      value: `${stats.cluesRecorded}`,
      tone: 'amber',
    },
  ];

  const toneClass: Record<'amber' | 'aqua' | 'coral', string> = {
    amber: 'border-amber-400/25 bg-amber-400/[0.06] text-amber-200',
    aqua: 'border-aqua-400/25 bg-aqua-400/[0.06] text-aqua-200',
    coral: 'border-coral-500/30 bg-coral-500/[0.08] text-coral-200',
  };

  return (
    <div className={`grid ${dense ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'}`}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`rounded-xl border ${toneClass[item.tone]} ${dense ? 'px-4 py-3.5' : 'px-4 py-4'} ${animated ? 'failure-reveal' : ''}`}
          style={animated ? { animationDelay: `${180 + (index * 90)}ms` } : undefined}
        >
          <div className="flex items-center gap-1.5 mono-tick opacity-80">
            {item.icon}
            <span>{item.label}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`font-display italic font-semibold text-cream-50 leading-none ${dense ? 'text-[2rem]' : 'text-[2.25rem]'}`}>
              {item.value}
            </span>
            {item.sub && (
              <span className="mono-tick text-[10px] text-dust-300">{item.sub}</span>
            )}
          </div>
        </div>
      ))}

      <div
        className={`rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/[0.06] text-fuchsia-200 ${dense ? 'px-4 py-3.5 md:col-span-2 xl:col-span-3' : 'px-4 py-4 md:col-span-2 xl:col-span-3'} ${animated ? 'failure-reveal' : ''}`}
        style={animated ? { animationDelay: `${180 + (items.length * 90)}ms` } : undefined}
      >
        <div className="flex items-center gap-1.5 mono-tick opacity-80">
          <Crosshair className="w-3.5 h-3.5" />
          <span>Warrant evidence</span>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <EvidenceCell label="Route" value={stats.routeClues} tone="aqua" />
          <EvidenceCell label="Suspect" value={stats.suspectClues} tone="coral" />
          <EvidenceCell label="Corroboration" value={stats.corroboratingClues} tone="amber" />
        </div>
      </div>
    </div>
  );
}

function EvidenceCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'aqua' | 'coral';
}) {
  const toneClass = tone === 'amber'
    ? 'border-amber-400/25 bg-amber-400/[0.07] text-amber-200'
    : tone === 'coral'
      ? 'border-coral-500/30 bg-coral-500/[0.09] text-coral-200'
      : 'border-aqua-400/25 bg-aqua-400/[0.07] text-aqua-200';

  return (
    <div className={`rounded-lg border px-3 py-3 ${toneClass}`}>
      <div className="mono-tick opacity-80">{label}</div>
      <div className="mt-1.5 font-display italic font-semibold text-cream-50 text-3xl leading-none">
        {value}
      </div>
    </div>
  );
}

interface FullScreenFailureDebriefProps {
  stats: FailureStats;
  caseTitle: string;
  failedSuspectName: string;
  channelOpen: boolean;
  onToggleChannel: () => void;
  sessionPlan: ReturnType<typeof buildHandlerSessionPlan> | null;
  gameState: GameState;
  onDismiss: () => void;
}

function FullScreenFailureDebrief({
  stats,
  caseTitle,
  failedSuspectName,
  channelOpen,
  onToggleChannel,
  sessionPlan,
  gameState,
  onDismiss,
}: FullScreenFailureDebriefProps) {
  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-midnight-950/95 backdrop-blur-md">
      {/* atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-atlas-grid opacity-20" />
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-35 mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 failure-sweep" />
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] bg-coral-500/20 blur-3xl failure-orb-a" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 w-[32rem] h-[32rem] bg-fuchsia-500/15 blur-3xl failure-orb-b" />

      <div className="relative max-w-6xl mx-auto px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        {/* hero */}
        <div className="failure-reveal failure-reveal-1 flex flex-col items-center text-center gap-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-coral-500/40 bg-coral-500/[0.10] mono-tick text-coral-300 shadow-[0_0_30px_-14px_rgba(255,122,107,0.75)]">
            <Skull className="w-3.5 h-3.5" />
            Case Closed · Form W-7 Failed
          </div>
          <h1 className="font-display italic font-semibold text-coral-300 text-5xl sm:text-6xl lg:text-7xl leading-[0.92] drop-shadow-[0_4px_24px_rgba(255,90,90,0.35)]">
            Mission Failed
          </h1>
          <p className="font-display italic text-cream-100 text-xl sm:text-2xl lg:text-[2rem]">
            {caseTitle}
          </p>
          <p className="text-sm sm:text-base text-cream-300 max-w-2xl leading-relaxed">
            The warrant on <span className="text-coral-300 font-display italic font-semibold">{failedSuspectName}</span> missed.
            The trail goes cold and the file is sealed. Vivienne is on the line for the debrief.
          </p>
        </div>

        {/* stats */}
        <div className="mt-12 failure-reveal failure-reveal-2">
          <div className="mono-tick text-dust-400 mb-3 px-1">Mission ledger</div>
          <FailureStatsGrid stats={stats} animated />
        </div>

        {/* debrief channel */}
        <div className="mt-10 rounded-2xl border border-aqua-400/25 bg-aqua-400/[0.05] p-5 sm:p-6 lg:p-7 failure-reveal failure-reveal-3 shadow-[0_30px_80px_-45px_rgba(95,227,208,0.35)]">
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div>
              <div className="mono-tick text-aqua-300 mb-1">Direct debrief · Channel 7</div>
              <h2 className="font-display italic font-semibold text-cream-50 text-2xl leading-tight">
                Talk to Vivienne about the breakdown.
              </h2>
              <p className="text-xs text-cream-200 leading-relaxed mt-1.5 max-w-xl">
                This is the only window for a live handler debrief. Once you close this screen the channel will not be available again on this file.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleChannel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-aqua-400/40 bg-aqua-400/[0.14] text-aqua-100 hover:bg-aqua-400/[0.2] transition mono-tick shrink-0"
            >
              <Radio className="w-4 h-4" />
              {channelOpen ? 'Hide channel' : 'Talk to Vivienne'}
            </button>
          </div>

          {channelOpen && sessionPlan && (
            <div className="mt-5">
              <VoicePanel
                agentId=""
                characterName="Vivienne"
                characterRole="handler"
                variant="inline"
                onClose={onToggleChannel}
                resolveSessionConfig={api.getFailedHandlerConfig}
                initialTranscript={sessionPlan.initialTranscript}
                sessionOptions={{
                  ...sessionPlan.startOptions,
                  dynamicVariables: {
                    ...sessionPlan.startOptions.dynamicVariables,
                    case_status: 'failed',
                    handler_mode: 'post_failure_debrief',
                    warrant_status: 'failed',
                    failed_suspect_name: failedSuspectName,
                    opening_brief: `Agent ${sessionPlan.detectiveCodename}, stand down. The warrant on ${failedSuspectName} missed and the case is closed. You can only review the evidence already on file. Explain where the trail broke and answer questions from the recorded intel.`,
                    current_objective: 'Debrief the failed warrant. Explain why the mission is closed and answer questions using only the evidence already logged.',
                  },
                }}
                persistTranscript={async (entries, { applyCooldown }) => {
                  persistHandlerSession(gameState, entries, applyCooldown);
                }}
              />
            </div>
          )}
        </div>

        {/* dismiss */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-3 failure-reveal failure-reveal-4">
          <p className="mono-tick text-dust-400 text-center sm:text-left">
            After closing, the warrant button keeps a stats-only review of this file.
          </p>
          <button
            onClick={onDismiss}
            className="btn-coral inline-flex items-center gap-2 px-6 py-3 rounded-md text-cream-50 font-mono uppercase tracking-[0.2em] text-xs"
          >
            <Lock className="w-4 h-4" />
            Close debrief
          </button>
        </div>
      </div>
    </div>
  );
}
