import { useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  Clock,
  Coins,
  Crosshair,
  FileText,
  Map as MapIcon,
  Radio,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import VoicePanel from './VoicePanel';
import * as api from '../lib/api';
import { buildHandlerSessionPlan, persistHandlerSession } from '../lib/handler-session';
import type { GameState } from '../types';

interface VictoryStats {
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

function computeVictoryStats(state: GameState): VictoryStats {
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

interface VictorySceneProps {
  suspectName: string;
  onContinue: () => void;
  onNext: () => void;
}

export default function VictoryScene({ suspectName, onContinue, onNext }: VictorySceneProps) {
  const { gameState } = useGame();
  const [channelOpen, setChannelOpen] = useState(false);

  const sessionPlan = useMemo(
    () => (gameState ? buildHandlerSessionPlan(gameState) : null),
    [gameState],
  );

  if (!gameState) {
    return (
      <div className="h-full w-full bg-midnight-950 flex items-center justify-center text-cream-300">
        Closing the file…
      </div>
    );
  }

  const stats = computeVictoryStats(gameState);
  const closedSuspectName = (suspectName && suspectName.trim()) || 'the target';
  const caseTitle = gameState.case.title;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-midnight-950/95 backdrop-blur-md">
      {/* atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-atlas-grid opacity-25" />
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-30 mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 failure-sweep" />
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] bg-aqua-400/25 blur-3xl failure-orb-a" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 w-[32rem] h-[32rem] bg-amber-400/20 blur-3xl failure-orb-b" />

      <div className="relative max-w-6xl mx-auto px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        {/* hero */}
        <div className="failure-reveal failure-reveal-1 flex flex-col items-center text-center gap-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-aqua-400/40 bg-aqua-400/[0.10] mono-tick text-aqua-200 shadow-[0_0_30px_-14px_rgba(95,227,208,0.85)]">
            <Award className="w-3.5 h-3.5" />
            Case Closed · Form W-7 Approved
          </div>
          <h1 className="font-display italic font-semibold text-aqua-300 text-5xl sm:text-6xl lg:text-7xl leading-[0.92] drop-shadow-[0_4px_24px_rgba(95,227,208,0.35)]">
            Mission Solved
          </h1>
          <p className="font-display italic text-cream-100 text-xl sm:text-2xl lg:text-[2rem]">
            {caseTitle}
          </p>
          <p className="text-sm sm:text-base text-cream-300 max-w-2xl leading-relaxed">
            The warrant on{' '}
            <span className="text-aqua-200 font-display italic font-semibold">{closedSuspectName}</span>{' '}
            landed clean. The trail is closed and the file is sealed. Vivienne is on the line if you want the wrap-up.
          </p>
        </div>

        {/* hero panel — case + suspect */}
        <div className="mt-12 failure-reveal failure-reveal-2 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <div className="rounded-2xl border border-aqua-400/30 bg-aqua-400/[0.06] px-5 py-5 sm:px-6 sm:py-6 shadow-[0_30px_80px_-50px_rgba(95,227,208,0.45)]">
            <div className="mono-tick text-aqua-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Verdict
            </div>
            <h3 className="font-display italic font-semibold text-[2rem] sm:text-[2.25rem] text-cream-50 leading-[1.02]">
              {caseTitle} · file sealed.
            </h3>
            <p className="text-sm text-cream-200 leading-relaxed mt-3 max-w-2xl">
              You named <span className="text-aqua-200 font-display italic font-semibold">{closedSuspectName}</span>{' '}
              and the warrant held. Travel and live witness contact are archived. The atlas, notebook, and dossier remain available for review.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-4 sm:px-5 sm:py-5">
            <div className="mono-tick text-amber-300 mb-2 flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5" />
              File status
            </div>
            <div className="space-y-2.5 text-xs text-cream-200 leading-relaxed">
              <p>The case is closed and removed from your active board.</p>
              <p>Witness channels and live travel are archived for this file.</p>
              <p>Use the review panel to keep your post-case notes warm.</p>
            </div>
          </div>
        </div>

        {/* stats */}
        <div className="mt-10 failure-reveal failure-reveal-3">
          <div className="mono-tick text-dust-400 mb-3 px-1">Mission ledger</div>
          <VictoryStatsGrid stats={stats} />
        </div>

        {/* debrief channel */}
        <div className="mt-10 rounded-2xl border border-aqua-400/30 bg-aqua-400/[0.05] p-5 sm:p-6 lg:p-7 failure-reveal failure-reveal-3 shadow-[0_30px_80px_-45px_rgba(95,227,208,0.45)]">
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div>
              <div className="mono-tick text-aqua-300 mb-1">Direct wrap-up · Channel 7</div>
              <h2 className="font-display italic font-semibold text-cream-50 text-2xl leading-tight">
                Talk to Vivienne about the close.
              </h2>
              <p className="text-xs text-cream-200 leading-relaxed mt-1.5 max-w-xl">
                Optional. Open the line if you want the wrap-up — read of the case, what nearly threw you, where to sharpen next time.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChannelOpen(open => !open)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-aqua-400/40 bg-aqua-400/[0.14] text-aqua-100 hover:bg-aqua-400/[0.22] transition mono-tick shrink-0"
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
                onClose={() => setChannelOpen(false)}
                resolveSessionConfig={api.getVictoryHandlerConfig}
                initialTranscript={sessionPlan.initialTranscript}
                sessionOptions={{
                  ...sessionPlan.startOptions,
                  dynamicVariables: {
                    ...sessionPlan.startOptions.dynamicVariables,
                    case_status: 'solved',
                    handler_mode: 'post_victory_debrief',
                    warrant_status: 'solved',
                  },
                }}
                persistTranscript={async (entries, { applyCooldown }) => {
                  persistHandlerSession(gameState, entries, applyCooldown);
                }}
              />
            </div>
          )}
        </div>

        {/* actions */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-3 failure-reveal failure-reveal-4">
          <button
            onClick={onContinue}
            className="mono-tick px-5 py-3 border border-cream-50/[0.16] rounded-md text-cream-200 hover:text-cream-50 hover:border-cream-50/40 transition-colors inline-flex items-center gap-2"
          >
            <ScrollText className="w-4 h-4" />
            Review case file
          </button>
          <button
            onClick={onNext}
            className="btn-coral inline-flex items-center gap-3 px-6 py-3 rounded-md text-cream-50 font-mono uppercase tracking-[0.2em] text-xs"
          >
            <Briefcase className="w-4 h-4" /> Next case
          </button>
        </div>
      </div>
    </div>
  );
}

interface VictoryStatsGridProps {
  stats: VictoryStats;
}

function VictoryStatsGrid({ stats }: VictoryStatsGridProps) {
  const items: Array<{ icon: React.ReactNode; label: string; value: string; sub?: string; tone: 'amber' | 'aqua' | 'cream' }> = [
    {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Hours invested',
      value: `${stats.hoursUsed}h`,
      sub: `of ${stats.totalHours}h`,
      tone: 'aqua',
    },
    {
      icon: <Coins className="w-3.5 h-3.5" />,
      label: 'Credits spent',
      value: `${stats.creditsUsed}`,
      sub: `of ${stats.totalCredits} cr`,
      tone: 'amber',
    },
    {
      icon: <Radio className="w-3.5 h-3.5" />,
      label: 'Support left',
      value: `${stats.supportCallsLeft}`,
      sub: 'call windows',
      tone: 'cream',
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

  const toneClass: Record<'amber' | 'aqua' | 'cream', string> = {
    amber: 'border-amber-400/25 bg-amber-400/[0.06] text-amber-200',
    aqua: 'border-aqua-400/30 bg-aqua-400/[0.07] text-aqua-200',
    cream: 'border-cream-50/[0.14] bg-cream-50/[0.04] text-cream-100',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`rounded-xl border ${toneClass[item.tone]} px-4 py-3.5 failure-reveal`}
          style={{ animationDelay: `${220 + (index * 90)}ms` }}
        >
          <div className="flex items-center gap-1.5 mono-tick opacity-80">
            {item.icon}
            <span>{item.label}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display italic font-semibold text-cream-50 leading-none text-[2rem]">
              {item.value}
            </span>
            {item.sub && (
              <span className="mono-tick text-[10px] text-dust-300">{item.sub}</span>
            )}
          </div>
        </div>
      ))}

      <div
        className="rounded-xl border border-aqua-400/30 bg-aqua-400/[0.06] text-aqua-200 px-4 py-3.5 md:col-span-2 xl:col-span-3 failure-reveal"
        style={{ animationDelay: `${220 + (items.length * 90)}ms` }}
      >
        <div className="flex items-center gap-1.5 mono-tick opacity-80">
          <Crosshair className="w-3.5 h-3.5" />
          <span>Warrant evidence held</span>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <EvidenceCell label="Route" value={stats.routeClues} tone="aqua" />
          <EvidenceCell label="Suspect" value={stats.suspectClues} tone="amber" />
          <EvidenceCell label="Corroboration" value={stats.corroboratingClues} tone="cream" />
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
  tone: 'amber' | 'aqua' | 'cream';
}) {
  const toneClass = tone === 'amber'
    ? 'border-amber-400/25 bg-amber-400/[0.07] text-amber-200'
    : tone === 'aqua'
      ? 'border-aqua-400/30 bg-aqua-400/[0.09] text-aqua-200'
      : 'border-cream-50/[0.16] bg-cream-50/[0.05] text-cream-100';

  return (
    <div className={`rounded-lg border px-3 py-3 ${toneClass}`}>
      <div className="mono-tick opacity-80">{label}</div>
      <div className="mt-1.5 font-display italic font-semibold text-cream-50 text-3xl leading-none">
        {value}
      </div>
    </div>
  );
}
