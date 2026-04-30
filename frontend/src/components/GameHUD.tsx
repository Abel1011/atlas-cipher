import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ShieldAlert, MapPin, Home, Clock, Coins } from 'lucide-react';
import { useGame } from '../context/GameContext';
import CaseNotebook from './CaseNotebook';
import ArrestWarrant from './ArrestWarrant';
import ConfirmDialog from './ConfirmDialog';
import { useSoundEngine } from './SoundEngine';

export default function GameHUD() {
  const { gameState, abandonCase, startNewGame } = useGame();
  const { playCue } = useSoundEngine();
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [warrantOpen, setWarrantOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [abandonBusy, setAbandonBusy] = useState(false);

  if (!gameState) return null;

  const currentCity = gameState.case.cities.find(c => c.id === gameState.currentCityId);
  const caseTitle = gameState.case.title;
  const missionFailed = gameState.status === 'failed';

  const handleHomeAction = useCallback(async () => {
    if (missionFailed) {
      setAbandonBusy(true);
      setAbandonOpen(false);
      setNotebookOpen(false);
      setWarrantOpen(false);
      try {
        await startNewGame();
      } finally {
        setAbandonBusy(false);
      }
      return;
    }

    setAbandonOpen(true);
  }, [missionFailed, startNewGame]);

  useEffect(() => {
    const onRequestAbandon = () => {
      void handleHomeAction();
    };
    window.addEventListener('atlas:request-abandon', onRequestAbandon);
    return () => window.removeEventListener('atlas:request-abandon', onRequestAbandon);
  }, [handleHomeAction]);

  const confirmAbandon = useCallback(async () => {
    setAbandonBusy(true);
    try {
      playCue('abandon');
      await abandonCase();
      setAbandonOpen(false);
    } finally {
      setAbandonBusy(false);
    }
  }, [abandonCase, playCue]);

  return (
    <>
      <div className="absolute top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center justify-between gap-3 px-5 py-3 pointer-events-auto bg-midnight-900/70 backdrop-blur-md border-b border-cream-50/[0.06]">
          {/* Left — Home + case title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <HudBtn onClick={() => { void handleHomeAction(); }} title={missionFailed ? 'Return to mission board' : 'Abandon case'}>
              <Home className="w-4 h-4" />
            </HudBtn>

            <div className="hidden sm:block w-px h-8 bg-cream-50/[0.08]" />

            <div className="min-w-0 flex-1">
              <div className="mono-tick text-amber-400 mb-0.5">Active Dossier</div>
              <h1 className="font-display italic font-semibold text-cream-50 text-base sm:text-lg leading-tight truncate">
                {caseTitle}
              </h1>
              {currentCity && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3 h-3 text-aqua-400 shrink-0" />
                  <span className="mono-tick text-cream-300 normal-case tracking-wider">
                    {currentCity.name} · {currentCity.country}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right — resources + actions */}
          <div className="flex items-center gap-2 shrink-0">
            <ResourceChip
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Hours"
              value={gameState.resources.remainingHours}
              accent={gameState.resources.remainingHours <= 24 ? 'coral' : 'amber'}
            />
            <ResourceChip
              icon={<Coins className="w-3.5 h-3.5" />}
              label="Credits"
              value={gameState.resources.remainingCredits}
              accent={gameState.resources.remainingCredits <= 100 ? 'coral' : 'aqua'}
            />

            <div className="hidden sm:block w-px h-8 bg-cream-50/[0.08] mx-1" />

            <HudBtn onClick={() => setNotebookOpen(true)} title="Case Notebook" label="Notebook">
              <BookOpen className="w-4 h-4" />
            </HudBtn>
            <HudBtn
              onClick={() => setWarrantOpen(true)}
              title={missionFailed
                ? 'Mission failed — review debrief'
                : gameState.warrant.ready
                ? 'Arrest Warrant — ready to issue'
                : 'Arrest Warrant'}
              label={missionFailed ? 'Failed' : 'Warrant'}
              accent="coral"
              pulse={gameState.warrant.ready && !missionFailed}
            >
              <ShieldAlert className="w-4 h-4" />
            </HudBtn>
          </div>
        </div>
      </div>

      <CaseNotebook isOpen={notebookOpen} onClose={() => setNotebookOpen(false)} />
      <ArrestWarrant isOpen={warrantOpen} onClose={() => setWarrantOpen(false)} />
      <ConfirmDialog
        open={!missionFailed && abandonOpen}
        title="Abandon this case?"
        description="Your current mission progress will be discarded and you'll return to the mission board."
        confirmLabel="Abandon case"
        cancelLabel="Keep investigating"
        confirmTone="danger"
        busy={abandonBusy}
        onConfirm={() => { void confirmAbandon(); }}
        onCancel={() => setAbandonOpen(false)}
      />
    </>
  );
}

function HudBtn({
  children, onClick, title, label, accent = 'default', pulse = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  label?: string;
  accent?: 'default' | 'coral';
  pulse?: boolean;
}) {
  const accentRing = accent === 'coral'
    ? 'hover:border-coral-500 hover:text-coral-400 hover:bg-coral-500/[0.08]'
    : 'hover:border-aqua-400/60 hover:text-aqua-400 hover:bg-aqua-400/[0.06]';
  const pulseClass = pulse
    ? 'border-coral-500/70 text-coral-200 bg-coral-500/[0.14] animate-warrant-glow'
    : '';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative flex items-center gap-2 h-10 px-3 rounded-md bg-midnight-800/60 border border-cream-50/[0.08] text-cream-300 transition-all ${accentRing} ${pulseClass}`}
    >
      {children}
      {label && (
        <span className="hidden md:inline mono-tick">{label}</span>
      )}
      {pulse && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-coral-400 shadow-[0_0_8px_2px_rgba(255,122,107,0.7)] animate-pulse-soft"
        />
      )}
    </button>
  );
}

function ResourceChip({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: 'amber' | 'aqua' | 'coral';
}) {
  const accentClass =
    accent === 'coral' ? 'text-coral-300 border-coral-500/30 bg-coral-500/[0.08]'
    : accent === 'aqua' ? 'text-aqua-300 border-aqua-400/25 bg-aqua-400/[0.06]'
    : 'text-amber-300 border-amber-400/25 bg-amber-400/[0.06]';
  return (
    <div
      title={`${label} remaining`}
      className={`hidden sm:flex items-center gap-1.5 h-10 px-2.5 rounded-md border ${accentClass}`}
    >
      {icon}
      <div className="flex items-baseline gap-1 leading-none">
        <span className="font-display italic text-base text-cream-50">{value}</span>
        <span className="mono-tick text-[10px] opacity-70 hidden md:inline">{label}</span>
      </div>
    </div>
  );
}
