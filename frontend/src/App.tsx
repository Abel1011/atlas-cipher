import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import {
  Loader2,
  Plane,
  Compass,
  Radio,
  Lock,
  Briefcase,
  Globe2,
  Crosshair,
  ArrowUpRight,
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import { useRepeatingCue, useSoundEngine } from './components/SoundEngine';
import * as api from './lib/api';
import { AUDIO_ASSET_URLS } from './lib/audio-assets';

const GlobeView = lazy(() => import('./components/GlobeView'));
const MissionBriefing = lazy(() => import('./components/MissionBriefing'));
const CaseBoard = lazy(() => import('./components/CaseBoard'));
const WitnessInterrogation = lazy(() => import('./components/WitnessInterrogation'));
const InGameShell = lazy(() => import('./components/InGameShell'));
const VictoryScene = lazy(() => import('./components/VictoryScene'));

/* ────────────────────────────────────────────────────────────
   Decorative data — for ticker, stamps, intel
   ──────────────────────────────────────────────────────────── */
const INTEL_FEED = [
  'INTEL · Sighting reported — Reykjavík 03:42 LT',
  'CIPHER · Burst transmission decrypted at 19.4°S 47.5°W',
  'WIRE · Unidentified vault opened beneath Marrakesh',
  'CARGO · Crate № 7-A diverted in Port of Hồ Chí Minh',
  'TAIL · Subject changed identities in Lisbon · 11:08',
  'SIGINT · Diplomatic plate flagged crossing Helsinki border',
  'ASSET · Handler online — Channel 7 secure',
  'NOTE · One stolen artifact resurfaces on the dark market',
];

const ROTATING_WORDS = ['cipher', 'thief', 'mark', 'dossier', 'ghost'];

const CITY_STAMPS = [
  { name: 'Tokyo',     code: 'HND', lat: '35.6°N', lng: '139.7°E' },
  { name: 'Reykjavík', code: 'KEF', lat: '64.1°N', lng: '21.9°W'  },
  { name: 'Marrakesh', code: 'RAK', lat: '31.6°N', lng: '7.9°W'   },
  { name: 'Bogotá',    code: 'BOG', lat: '4.7°N',  lng: '74.0°W'  },
];

/* Dragon-radar style blips — bright blinking dots scattered inside a circle */
type Blip = { top: string; left: string; color: string; delay: string; dur?: string; size?: 'sm' | 'lg' };
function RadarBlips({ blips }: { blips: Blip[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {blips.map((b, i) => (
        <span
          key={i}
          className={`radar-blip${b.size === 'sm' ? ' radar-blip--sm' : b.size === 'lg' ? ' radar-blip--lg' : ''}`}
          style={{
            top: b.top,
            left: b.left,
            ['--blip-color' as any]: b.color,
            ['--blip-delay' as any]: b.delay,
            ['--blip-dur' as any]: b.dur ?? '1.6s',
          }}
        />
      ))}
    </div>
  );
}

const LANDING_BLIPS: Blip[] = [
  { top: '18%', left: '30%', color: '#ff7a6b', delay: '0s',    dur: '1.7s', size: 'lg' },
  { top: '26%', left: '74%', color: '#ffd166', delay: '0.45s', dur: '2.0s', size: 'lg' },
  { top: '82%', left: '66%', color: '#5fe3d0', delay: '0.9s',  dur: '1.8s', size: 'lg' },
  { top: '78%', left: '22%', color: '#e879f9', delay: '1.3s',  dur: '2.1s', size: 'lg' },
  { top: '50%', left: '82%', color: '#5fe3d0', delay: '0.7s',  dur: '1.6s', size: 'lg' },
];
const LOADING_BLIPS: Blip[] = [
  { top: '18%', left: '30%', color: '#ff7a6b', delay: '0s',    dur: '1.7s', size: 'lg' },
  { top: '26%', left: '74%', color: '#ffd166', delay: '0.45s', dur: '2.0s', size: 'lg' },
  { top: '82%', left: '66%', color: '#5fe3d0', delay: '0.9s',  dur: '1.8s', size: 'lg' },
  { top: '78%', left: '22%', color: '#e879f9', delay: '1.3s',  dur: '2.1s', size: 'lg' },
  { top: '50%', left: '82%', color: '#5fe3d0', delay: '0.7s',  dur: '1.6s', size: 'lg' },
];

/* ────────────────────────────────────────────────────────────
   Game router
   ──────────────────────────────────────────────────────────── */
function GameRouter() {
  const { view, loading, error, gameState, missionBoard, startNewGame, loadGameState, arrestResult, setView, clearError } = useGame();

  useEffect(() => {
    loadGameState();
  }, [loadGameState]);

  let scene: React.ReactNode = null;

  if (loading && !gameState && !missionBoard) {
    scene = <LoadingScene />;
  } else if (view === 'landing') {
    scene = <Landing onStart={startNewGame} loading={loading} error={error} onDismissError={clearError} />;
  } else if (view === 'briefing') {
    scene = (
      <Suspense fallback={<LoadingScene />}>
        <InGameShell>
          <MissionBriefing />
        </InGameShell>
      </Suspense>
    );
  } else if (view === 'case-board') {
    scene = (
      <Suspense fallback={<LoadingScene />}>
        <InGameShell>
          <CaseBoard />
        </InGameShell>
      </Suspense>
    );
  } else if (view === 'globe') {
    scene = (
      <div className="h-full w-full relative bg-midnight-950">
        <ErrorBoundary fallbackMessage="Failed to render the globe. Your browser may not support WebGL.">
          <Suspense fallback={<LoadingScene />}>
            <InGameShell>
              <GlobeView />
            </InGameShell>
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  } else if (view === 'interrogation') {
    scene = (
      <div className="h-full w-full relative bg-midnight-950">
        <ErrorBoundary fallbackMessage="The interrogation screen failed to load.">
          <Suspense fallback={<LoadingScene />}>
            <WitnessInterrogation />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  } else if (view === 'arrest-result') {
    scene = (
      <Suspense fallback={<LoadingScene />}>
        <VictoryScene
          suspectName={arrestResult?.suspectName ?? ''}
          onContinue={() => setView('case-board')}
          onNext={startNewGame}
        />
      </Suspense>
    );
  }

  return (
    <>
      <GameAmbientDirector />
      <GameAudioSignals />
      {scene}
    </>
  );
}

function GameAmbientDirector() {
  const { gameState, missionBoard, view } = useGame();
  const { playAmbient, stopAmbient } = useSoundEngine();

  const currentCity = useMemo(() => {
    if (!gameState) return null;
    return gameState.case.cities.find(city => city.id === gameState.currentCityId) ?? gameState.case.cities[0] ?? null;
  }, [gameState]);

  const ambientTrack = useMemo(() => {
    if (view === 'landing' || view === 'arrest-result') {
      return null;
    }

    if (!gameState) {
      if (missionBoard && view === 'briefing') {
        return { url: AUDIO_ASSET_URLS.missionBoardTheme, volume: 0.22 };
      }

      return null;
    }

    return {
      url: currentCity?.ambientSoundUrl || AUDIO_ASSET_URLS.missionBoardTheme,
      volume: 0.28,
    };
  }, [currentCity, gameState, missionBoard, view]);

  useEffect(() => {
    if (!ambientTrack?.url) {
      stopAmbient();
      return;
    }

    playAmbient(ambientTrack.url, ambientTrack.volume);
  }, [ambientTrack, playAmbient, stopAmbient]);

  return null;
}

function GameAudioSignals() {
  const { gameState } = useGame();
  const { playCue } = useSoundEngine();
  const lastCaseIdRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const nextCaseId = gameState?.caseId ?? null;
    const nextStatus = gameState?.status ?? null;

    if (nextCaseId !== lastCaseIdRef.current) {
      lastCaseIdRef.current = nextCaseId;
      lastStatusRef.current = nextStatus;
      return;
    }

    if (nextStatus && nextStatus !== lastStatusRef.current) {
      if (nextStatus === 'solved') playCue('victory');
      if (nextStatus === 'failed') playCue('defeat');
    }

    lastStatusRef.current = nextStatus;
  }, [gameState?.caseId, gameState?.status, playCue]);

  return null;
}

/* ────────────────────────────────────────────────────────────
   LANDING — "ATLAS // CIPHER" Operations Hub
   ──────────────────────────────────────────────────────────── */
function Landing({ onStart, loading, error, onDismissError }: {
  onStart: () => void;
  loading: boolean;
  error: string | null;
  onDismissError: () => void;
}) {
  useRepeatingCue('radarPing', true, 1800);

  // rotating word
  const [wordIdx, setWordIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setWordIdx(i => (i + 1) % ROTATING_WORDS.length), 3200);
    return () => clearInterval(t);
  }, []);

  // live UTC clock
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const utc = clock.toISOString().slice(11, 19);

  // codename / display name for this session
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.getPlayerProfile()
      .then((profile) => {
        const name = (profile as { displayName?: string | null } | null)?.displayName;
        if (!cancelled && typeof name === 'string' && name.length > 0) {
          setName(name);
        }
      })
      .catch(() => { /* fresh session, no name yet */ });
    return () => { cancelled = true; };
  }, []);

  const trimmedName = name.trim();
  const canStart = trimmedName.length >= 2 && !loading && !savingName;
  const agentDisplayName = trimmedName.length > 0 ? `Codename ${trimmedName}` : 'Codename Vesper';
  const agentInitials = trimmedName.length > 0
    ? trimmedName
        .split(/\s+/)
        .map(part => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '47';

  const handleStart = async () => {
    if (!canStart) return;
    setSavingName(true);
    try {
      await api.updatePlayerName(trimmedName);
    } catch {
      // name is also kept locally; proceed anyway
    } finally {
      setSavingName(false);
    }
    onStart();
  };

  return (
    <div className="relative h-full w-full overflow-hidden text-cream-50 bg-nebula vignette">
      {/* — background layers — */}
      <div className="absolute inset-0 bg-atlas-grid opacity-70 pointer-events-none" />
      <div className="absolute inset-0 bg-equator pointer-events-none" />

      {/* Wireframe globe behind hero */}
      <div className="globe-wire pointer-events-none"
        style={{ width: '70vh', height: '70vh', left: '50%', top: '52%' }}>
        <RadarBlips blips={LANDING_BLIPS} />
      </div>

      {/* Radar — anchored to bottom-right of viewport, above the ticker, away from rails */}
      <div className="absolute bottom-20 right-6 w-40 h-40 pointer-events-none hidden 2xl:block opacity-80">
        <div className="radar-rings absolute inset-0" />
        <div className="radar absolute inset-0" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-aqua-400 shadow-[0_0_20px_4px_rgba(95,227,208,0.7)]" />
        </div>
      </div>

      {/* Compass — anchored to bottom-left, above the ticker, away from rails */}
      <div className="absolute bottom-20 left-6 w-24 h-24 pointer-events-none hidden 2xl:block animate-spin-slow opacity-70">
        <div className="compass">
          <Compass className="absolute inset-0 m-auto w-7 h-7 text-amber-400/70" />
        </div>
      </div>

      {/* Floating passport stamps */}
      {CITY_STAMPS.map((s, i) => (
        <PassportStamp key={s.code} {...s} index={i} />
      ))}

      {/* Vertical scan line */}
      <div className="absolute left-0 right-0 h-12 bg-gradient-to-b from-transparent via-aqua-400/10 to-transparent pointer-events-none animate-scan" />

      <div className="absolute inset-0 bg-grain pointer-events-none mix-blend-overlay" />

      {/* ── HEADER BAR ────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-20 px-8 lg:px-14 py-5 flex items-center justify-between border-b border-cream-50/[0.06] backdrop-blur-[2px]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-coral-500/20 border border-coral-500/40 flex items-center justify-center">
            <Globe2 className="w-4 h-4 text-coral-400" />
          </div>
          <div className="leading-none">
            <div className="font-mono text-[10px] tracking-[0.4em] text-amber-400 uppercase">Atlas Cipher</div>
            <div className="font-mono text-[9px] tracking-[0.3em] text-dust-400 mt-1 uppercase">Operations Hub · v0.1</div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 mono-tick text-cream-300">
          <span className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-aqua-400 animate-pulse-soft" />
            Channel 7 · Secure
          </span>
          <span>UTC {utc}</span>
          <span className="text-amber-400">Dossier № 0451-A</span>
        </div>

        <div className="flex items-center gap-2 mono-tick text-coral-400">
          <Lock className="w-3 h-3" />
          <span>Eyes Only</span>
        </div>
      </header>

      {/* ── MAIN GRID ─────────────────────────────────────── */}
      <main className="relative z-10 h-full w-full grid grid-cols-12 gap-6 px-8 lg:px-14 pt-28 pb-20">

        {/* LEFT RAIL — agent badge */}
        <aside className="hidden lg:flex col-span-3 flex-col justify-between">
          <div className="dossier rounded-lg p-5 max-w-xs">
            <div className="flex items-center justify-between mono-tick text-dust-400 mb-4">
              <span>Agent Profile</span>
              <span className="text-aqua-400">ACTIVE</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-coral-500 to-magenta-500 flex items-center justify-center font-display font-bold text-cream-50 text-xl shadow-lg shadow-coral-500/30">
                {agentInitials}
              </div>
              <div>
                <div className="font-display font-semibold text-cream-50 text-lg leading-tight">{agentDisplayName}</div>
                <div className="mono-tick text-dust-400 mt-0.5">Field Operative</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Cases" value="0" />
              <Stat label="Success" value="—" />
              <Stat label="Streak" value="0" />
            </div>
          </div>

          <div className="mono-tick text-dust-400 leading-relaxed max-w-xs relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative w-8 h-8 shrink-0 animate-spin-slow">
                <div className="compass">
                  <Compass className="absolute inset-0 m-auto w-4 h-4 text-amber-400/80" />
                </div>
              </div>
              <div className="text-amber-400">// HANDLER NOTE</div>
            </div>
            <p className="normal-case tracking-normal text-sm text-cream-300 font-sans leading-relaxed">
              “Trust nothing. Verify the postmark. The world is large — but they always slip up. Your ear is sharper than any algorithm.”
            </p>
          </div>
        </aside>

        {/* CENTER — Hero */}
        <section className="col-span-12 lg:col-span-6 flex flex-col items-center justify-center text-center px-2">
          {/* Tag */}
          <div className="mono-tick text-amber-400 mb-8 tick-line">
            Mission Briefing
          </div>

          {/* Title */}
          <h1 className="font-display font-semibold leading-[0.9] tracking-tight text-cream-50">
            <span className="block text-[clamp(2.4rem,6vw,5.2rem)]">Where in the world</span>
            <span className="block text-[clamp(2.4rem,6vw,5.2rem)] mt-1">
              <span>is the </span>
              <RotatingWord words={ROTATING_WORDS} index={wordIdx} />
              <span>?</span>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-10 max-w-xl text-cream-300 text-base sm:text-lg leading-relaxed">
            A voice-driven detective opera. Chase a phantom across continents,
            <span className="text-coral-400"> interrogate witnesses with your own voice</span>,
            and close the file before the trail goes cold.
          </p>

          {/* Error */}
          {error && (
            <div className="mt-8 flex flex-col items-center gap-2 px-5 py-4 rounded-md bg-coral-700/20 border border-coral-500/40 backdrop-blur-sm max-w-md w-full">
              <p className="text-coral-300 text-sm text-center font-medium">{error}</p>
              <button
                onClick={onDismissError}
                className="mono-tick text-dust-400 hover:text-cream-50 underline transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* CTA cluster */}
          <div className="mt-12 flex flex-col items-center gap-5">
            <label className="w-full max-w-sm flex flex-col items-start gap-2">
              <span className="mono-tick text-aqua-400">Codename</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 32))}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleStart(); }}
                placeholder="Type your handler call sign"
                maxLength={32}
                disabled={loading || savingName}
                className="w-full px-4 py-3 rounded-md bg-midnight-900/60 border border-cream-50/[0.12] text-cream-50 placeholder:text-dust-500 outline-none transition focus:border-coral-500/60 focus:bg-midnight-900/80 disabled:opacity-60"
              />
            </label>

            <button
              onClick={() => void handleStart()}
              disabled={!canStart}
              className="btn-coral group relative inline-flex items-center gap-4 pl-7 pr-5 py-4 rounded-md text-cream-50 font-semibold overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {/* sweep highlight */}
              <span className="absolute inset-0 overflow-hidden rounded-md pointer-events-none">
                <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-cream-50/30 to-transparent animate-sweep" />
              </span>
              {(loading || savingName) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-mono uppercase tracking-[0.22em] text-sm">Preparing Dossier…</span>
                </>
              ) : (
                <>
                  <Briefcase className="w-5 h-5" />
                  <span className="font-mono uppercase tracking-[0.22em] text-sm">Meet Your Handler</span>
                  <span className="ml-2 grid place-items-center w-9 h-9 rounded bg-cream-50/15 border border-cream-50/25 group-hover:bg-cream-50/25 transition">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </>
              )}
            </button>

            <div className="flex items-center gap-3 mono-tick text-dust-400">
              <Radio className="w-3 h-3 text-aqua-400 animate-pulse-soft" />
              <span>Live briefing voiced by ElevenLabs · Channel 7</span>
            </div>
          </div>
        </section>

        {/* RIGHT RAIL — destinations dossier */}
        <aside className="hidden lg:flex col-span-3 flex-col justify-between items-end">
          <div className="dossier rounded-lg p-5 w-full max-w-xs relative overflow-hidden">
            {/* mini radar inside the card header */}
            <div className="absolute -top-6 -right-6 w-24 h-24 opacity-60 pointer-events-none">
              <div className="radar-rings absolute inset-0" />
              <div className="radar absolute inset-0" />
            </div>
            <div className="relative flex items-center justify-between mono-tick text-dust-400 mb-4">
              <span>Last Known Locations</span>
              <Plane className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <ul className="space-y-3">
              {CITY_STAMPS.map((c) => (
                <li key={c.code} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-amber-400/30 flex items-center justify-center mono-tick text-amber-400 text-[9px]">
                    {c.code}
                  </div>
                  <div className="flex-1 leading-tight">
                    <div className="font-display italic text-cream-50">{c.name}</div>
                    <div className="mono-tick text-dust-400">{c.lat} · {c.lng}</div>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-coral-500 animate-pulse-soft" />
                </li>
              ))}
            </ul>
          </div>

          <div className="mono-tick text-right text-dust-400 leading-relaxed">
            <div className="text-aqua-400 mb-1">// THREAT LEVEL</div>
            <div className="font-display text-3xl text-amber-400 not-italic font-bold tracking-normal normal-case">
              ELEVATED
            </div>
            <div>4 leads · 1 ghost</div>
          </div>
        </aside>
      </main>

      {/* ── INTEL TICKER ──────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-cream-50/[0.06] bg-midnight-950/60 backdrop-blur-md overflow-hidden">
        <div className="flex items-center">
          <div className="px-6 py-3 mono-tick text-coral-400 border-r border-cream-50/[0.08] bg-midnight-900/70 flex items-center gap-2 shrink-0">
            <Crosshair className="w-3 h-3" />
            <span>Intel Feed</span>
          </div>
          <div className="overflow-hidden flex-1">
            <div className="flex gap-12 whitespace-nowrap py-3 animate-ticker mono-tick text-cream-300 will-change-transform">
              {[...INTEL_FEED, ...INTEL_FEED].map((line, i) => (
                <span key={i} className="inline-flex items-center gap-3">
                  <span className="text-aqua-400">◆</span>
                  {line}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Subcomponents
   ──────────────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-cream-50/[0.08] bg-midnight-900/40 px-2 py-2">
      <div className="font-display font-bold text-cream-50 text-lg leading-none">{value}</div>
      <div className="mono-tick text-dust-400 mt-1 text-[9px]">{label}</div>
    </div>
  );
}

function RotatingWord({ words, index }: { words: string[]; index: number }) {
  return (
    <span className="relative inline-block align-baseline" style={{ minWidth: '5.5ch' }}>
      <span
        key={index}
        className="font-display italic font-semibold bg-gradient-to-br from-coral-300 via-coral-500 to-magenta-500 bg-clip-text text-transparent inline-block"
        style={{ animation: 'word-cycle 3.2s ease-in-out' }}
      >
        {words[index]}
      </span>
    </span>
  );
}

function PassportStamp({ name, code, lat, lng, index }: {
  name: string; code: string; lat: string; lng: string; index: number;
}) {
  // four scattered positions around the viewport
  const positions = [
    { top: '14%',   left: '6%',   tilt: '-12deg', color: 'text-aqua-400' },
    { top: '68%',   right: '8%',  tilt: '8deg',   color: 'text-coral-400' },
    { bottom: '14%', left: '32%', tilt: '-5deg',  color: 'text-amber-400' },
    { top: '15%',   left: '44%',  tilt: '14deg',  color: 'text-magenta-400' },
  ];
  const p = positions[index % positions.length]!;
  return (
    <div
      aria-hidden
      className={`absolute hidden xl:flex stamp-circle ${p.color} animate-float pointer-events-none opacity-70`}
      style={{
        ...p,
        ['--tilt' as string]: p.tilt,
        transform: `rotate(${p.tilt})`,
      } as React.CSSProperties}
    >
      <div className="text-[10px]">{code}</div>
      <div className="font-display italic text-base not-italic" style={{ fontStyle: 'italic' }}>{name}</div>
      <div className="text-[8px] mt-0.5 opacity-80">{lat}</div>
      <div className="text-[8px] opacity-80">{lng}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Loading & Result scenes
   ──────────────────────────────────────────────────────────── */

function LoadingScene() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-nebula vignette">
      <div className="absolute inset-0 bg-atlas-grid opacity-50" />
      <div className="globe-wire pointer-events-none"
        style={{ width: '60vh', height: '60vh', left: '50%', top: '50%' }}>
        <RadarBlips blips={LOADING_BLIPS} />
      </div>
      <div className="relative h-full w-full flex flex-col items-center justify-center gap-8">
        <div className="relative w-28 h-28">
          <div className="radar-rings absolute inset-0" />
          <div className="radar absolute inset-0" />
          <div className="absolute inset-0 rounded-full border-2 border-aqua-400/30 border-t-aqua-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Crosshair className="w-7 h-7 text-coral-400 animate-pulse-soft" />
          </div>
        </div>
        <div className="mono-tick text-amber-400 flex items-center gap-3">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral-500 animate-blink" />
          Preparing Case File · Syncing Briefing
        </div>
        <p className="font-display italic text-2xl text-cream-100 text-center max-w-md px-6">
          “A new file just landed on your desk…”
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Root
   ──────────────────────────────────────────────────────────── */

function App() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}

export default App;
