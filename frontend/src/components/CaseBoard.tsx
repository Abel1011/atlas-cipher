import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import {
  MapPin, Users, Eye, Radio,
  Phone, Lightbulb,
  MessageCircle, BookOpen, CheckCircle2, User, AlertTriangle,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSoundEngine } from './SoundEngine';
import CityPanoramaViewer from './CityPanoramaViewer';
import type { City } from '../types';
import VoicePanel from './VoicePanel';
import * as api from '../lib/api';
import { getSeedPanoramaMusicUrl } from '../lib/seed-assets';

type Blip = {
  top: string; left: string; color: string; delay: string; dur?: string; size?: 'sm' | 'lg';
};

const BOARD_BLIPS: Blip[] = [
  { top: '14%', left: '22%', color: '#ff7a6b', delay: '0s',    dur: '1.7s', size: 'lg' },
  { top: '28%', left: '78%', color: '#ffd166', delay: '0.5s',  dur: '2.0s', size: 'lg' },
  { top: '74%', left: '70%', color: '#5fe3d0', delay: '0.9s',  dur: '1.8s', size: 'lg' },
  { top: '82%', left: '18%', color: '#e879f9', delay: '1.3s',  dur: '2.1s', size: 'lg' },
  { top: '50%', left: '88%', color: '#5fe3d0', delay: '0.7s',  dur: '1.6s', size: 'lg' },
  { top: '40%', left: '10%', color: '#ffd166', delay: '1.0s',  dur: '1.9s' },
];

/* duration of the cinematic intro (globe spin → content fades in) */
const INTRO_SPIN_MS = 2200;
const CONTENT_FADE_DELAY_MS = 1100;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

/* deterministic gradient per witness so placeholders feel like real profiles */
function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const palettes = [
    ['#3b1d4a', '#7a2d6b'], // magenta
    ['#0d3b4f', '#1d6b7a'], // aqua
    ['#3a2410', '#7a4a1f'], // amber
    ['#3d1422', '#7a2438'], // coral
    ['#1a2c4a', '#2b4a7a'], // indigo
    ['#2a1f3d', '#4a3a6b'], // violet
  ];
  const [a, b] = palettes[h % palettes.length] ?? ['#3b1d4a', '#7a2d6b'];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function WitnessAvatar({
  name, src, size = 'md', className = '',
}: { name: string; src: string | null | undefined; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = size === 'sm' ? 'w-11 h-11 text-[11px]' : size === 'lg' ? 'w-full h-full text-3xl' : 'w-14 h-14 text-sm';
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-5 h-5';
  const [broken, setBroken] = useState(false);
  const showImg = !!src && !broken;
  return (
    <div
      className={`relative ${dims} rounded-md overflow-hidden border border-cream-50/[0.10] shrink-0 ${className}`}
      style={!showImg ? { background: avatarGradient(name) } : undefined}
    >
      {showImg ? (
        <img
          src={src!}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <>
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-display italic font-semibold text-cream-50/95 drop-shadow">
              {getInitials(name)}
            </span>
          </div>
          <div className="absolute bottom-1 right-1 text-cream-50/40">
            <User className={iconSize} />
          </div>
          <div className="absolute inset-0 bg-grain mix-blend-overlay opacity-50 pointer-events-none" />
        </>
      )}
    </div>
  );
}

function formatClueKind(kind: 'route' | 'suspect' | 'corroboration', _isMisleading: boolean): string {
  return kind === 'route'
    ? 'Route'
    : kind === 'suspect'
    ? 'Suspect'
    : 'Corroboration';
}

interface BoardPoint {
  lat: number;
  lng: number;
  color: string;
  radius: number;
  altitude: number;
  label: string;
}

interface BoardRing {
  lat: number;
  lng: number;
  color: string;
  maxR: number;
  propagationSpeed: number;
  repeatPeriod: number;
}

export default function CaseBoard() {
  const {
    gameState, loading, refreshGameState,
  } = useGame();
  const { playAmbient } = useSoundEngine();
  const [contentVisible, setContentVisible] = useState(false);
  const [selectedWitnessId, setSelectedWitnessId] = useState<string | null>(null);
  const [witnessChannelOpen, setWitnessChannelOpen] = useState(false);
  const [panoramaOpen, setPanoramaOpen] = useState(false);
  const orderedCities = useMemo(() => {
    if (!gameState) return [];
    return [...gameState.case.cities].sort((a, b) => a.visitOrder - b.visitOrder);
  }, [gameState]);
  const currentCity = orderedCities.find(c => c.id === gameState?.currentCityId) ?? orderedCities[0] ?? null;
  const seedPanoramaMusicUrl = gameState?.case.source === 'seed'
    ? getSeedPanoramaMusicUrl(gameState.case.slug)
    : null;
  const panoramaAmbientTrackUrl = panoramaOpen
    ? seedPanoramaMusicUrl || currentCity?.ambientSoundUrl || null
    : null;

  /* fade in the file contents shortly after the globe spin starts */
  useEffect(() => {
    setContentVisible(false);
    const t = window.setTimeout(() => setContentVisible(true), CONTENT_FADE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  /* panorama overrides the shared ambient while it is open */
  useEffect(() => {
    if (!panoramaAmbientTrackUrl) return;

    playAmbient(panoramaAmbientTrackUrl, 0.3);

    return () => {
      if (currentCity?.ambientSoundUrl) {
        playAmbient(currentCity.ambientSoundUrl, 0.28);
      }
    };
  }, [currentCity?.ambientSoundUrl, panoramaAmbientTrackUrl, playAmbient]);

  if (!gameState) return null;

  const localWitnesses = currentCity?.witnesses ?? [];
  const selectedWitness = localWitnesses.find(w => w.id === selectedWitnessId) ?? localWitnesses[0] ?? null;
  const localWitnessIdSet = new Set(localWitnesses.map(w => w.id));
  const localLeadCount = gameState.discoveredClues.filter(c =>
    c.witnessId !== null && localWitnessIdSet.has(c.witnessId)
  ).length;
  const witnessClues = selectedWitness
    ? gameState.discoveredClues.filter(c => c.witnessId === selectedWitness.id)
    : [];
  const investigationLocked = gameState.status !== 'active';
  const lockedDeskCopy = gameState.status === 'solved'
    ? 'Mission solved. This desk is now in review mode. Witness files remain visible, but live witness channels are archived.'
    : gameState.status === 'abandoned'
      ? 'Mission abandoned. This desk is now in review mode. Witness files remain visible, but live witness channels are archived.'
      : 'Mission failed. This desk is now in review mode. Witness files remain visible, but live witness channels are sealed.';
  const lockedChannelCopy = gameState.status === 'solved'
    ? 'Mission solved · channel archived'
    : gameState.status === 'abandoned'
      ? 'Mission abandoned · channel archived'
      : 'Mission failed · channel sealed';
  const hasTalkedThisVisit = selectedWitness?.hasTalkedThisVisit ?? false;
  const witnessLockedReason = selectedWitness?.talkLockedReason ?? null;
  const canToggleWitnessChannel = !investigationLocked && (witnessChannelOpen || !witnessLockedReason);

  useEffect(() => {
    if (selectedWitnessId) return;
    const firstWitness = localWitnesses[0];
    if (firstWitness) {
      setSelectedWitnessId(firstWitness.id);
    }
  }, [localWitnesses, selectedWitnessId]);

  useEffect(() => {
    setPanoramaOpen(false);
  }, [currentCity?.id]);

  useEffect(() => {
    setWitnessChannelOpen(false);
  }, [selectedWitnessId]);

  useEffect(() => {
    if (investigationLocked && witnessChannelOpen) {
      setWitnessChannelOpen(false);
    }
  }, [investigationLocked, witnessChannelOpen]);

  const selectWitness = useCallback((witnessId: string) => {
    setSelectedWitnessId(witnessId);
  }, []);

  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden text-cream-50 bg-nebula vignette">
      {/* ── BACKDROP GLOBE (real 3D, decorative) ──────────── */}
      <BackdropGlobe
        targetLat={currentCity?.lat ?? 0}
        targetLng={currentCity?.lng ?? 0}
        cities={orderedCities.filter(c => c.visited || c.id === gameState.currentCityId)}
        currentCityId={gameState.currentCityId}
      />

      {/* ── decorative overlays on top of globe ──────────── */}
      <div className="fixed inset-0 bg-atlas-grid opacity-30 pointer-events-none" />
      <div className="fixed inset-0 bg-equator pointer-events-none opacity-60" />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(8,12,24,0) 0%, rgba(8,12,24,0.55) 55%, rgba(8,12,24,0.85) 100%)',
        }}
      />
      <div className="fixed left-0 right-0 h-12 bg-gradient-to-b from-transparent via-aqua-400/10 to-transparent pointer-events-none animate-scan" />
      <div className="fixed inset-0 bg-grain pointer-events-none mix-blend-overlay opacity-60" />

      {/* small radar blips for ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <RadarBlips blips={BOARD_BLIPS} />
      </div>

      {/* ── MAIN ──────────────────────────────────────────── */}
      <main
        className={`relative z-10 px-6 lg:px-12 pt-24 pb-32 space-y-10 transition-all duration-700 ease-out ${
          contentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* ── TITLE BAND ── */}
        <section className="relative">
          <div className="mono-tick text-amber-400 mb-2 tick-line">Current Deployment</div>
          <h1 className="font-display italic font-semibold text-cream-50 leading-[0.95] text-[clamp(2rem,4.5vw,3.6rem)] max-w-4xl">
            {currentCity ? `Operate in ${currentCity.name}` : 'Operate on the ground'}
          </h1>
          <p className="mt-2 mono-tick text-dust-400">
            Knock on doors, listen close, and let the city tell you who is lying.
          </p>
        </section>

        {/* ── CURRENT CITY HERO (image + local contacts in one block) ── */}
        {currentCity && (
          <section>
            <article className="dossier rounded-2xl overflow-hidden relative border border-aqua-400/[0.18]">
              <div className="absolute -top-32 -right-20 w-72 h-72 bg-aqua-400/[0.10] blur-[100px] pointer-events-none" />
              <div className="grid grid-cols-12">
                {/* image side */}
                <div className="col-span-12 md:col-span-5 relative h-56 md:h-auto md:min-h-[20rem]">
                  {currentCity.sceneImageUrl ? (
                    <img
                      src={currentCity.sceneImageUrl}
                      alt={currentCity.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-nebula" />
                  )}
                  {/* mobile bottom fade, desktop right fade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-midnight-900 via-midnight-900/40 to-transparent md:hidden" />
                  <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-transparent via-transparent to-midnight-900/85" />

                  <div className="absolute top-3 left-3 mono-tick text-aqua-300 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-aqua-400 animate-pulse-soft" />
                    You are here
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="mono-tick text-cream-200/80 mb-1">Current city</div>
                    <div className="font-display italic font-semibold text-3xl sm:text-4xl text-cream-50 leading-[0.95] drop-shadow-2xl">
                      {currentCity.name}
                    </div>
                    <div className="mono-tick text-cream-200 mt-1.5 flex items-center gap-2 flex-wrap">
                      <span>{currentCity.country}</span>
                      <span className="text-dust-400">·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {currentCity.lat.toFixed(2)}°, {currentCity.lng.toFixed(2)}°
                      </span>
                    </div>
                  </div>
                </div>

                {/* info side */}
                <div className="col-span-12 md:col-span-7 p-5 md:p-6 flex flex-col gap-5">
                  {/* quick stats */}
                  <div className="grid grid-cols-3 gap-px bg-cream-50/[0.06] border border-cream-50/[0.05] rounded-md overflow-hidden">
                    <div className="bg-midnight-900/60 px-3 py-2.5">
                      <div className="mono-tick text-aqua-400 mb-0.5 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Contacts here
                      </div>
                      <div className="font-display italic text-2xl text-cream-50 leading-none">{localWitnesses.length}</div>
                    </div>
                    <div className="bg-midnight-900/60 px-3 py-2.5">
                      <div className="mono-tick text-amber-400 mb-0.5 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Leads on file
                      </div>
                      <div className="font-display italic text-2xl text-cream-50 leading-none">{localLeadCount}</div>
                    </div>
                    <div className="bg-midnight-900/60 px-3 py-2.5">
                      <div className="mono-tick text-coral-400 mb-0.5 flex items-center gap-1">
                        <Radio className="w-3 h-3" /> Channel
                      </div>
                      <div className="mono-tick text-cream-100 text-[10px] leading-tight pt-1">
                        {currentCity.ambientSoundUrl ? 'Live ambient' : 'Awaiting audio'}
                      </div>
                    </div>
                  </div>

                  {currentCity.panorama360Url && (
                    <div className="flex items-start justify-between gap-4 rounded-xl border border-aqua-300/20 bg-aqua-300/6 px-4 py-4">
                      <div>
                        <div className="mono-tick text-aqua-300 flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-aqua-300" />
                          360 evidence scan
                        </div>
                        <p className="mt-2 text-sm text-dust-200 max-w-md leading-relaxed">
                          Inspect the full scene for handoff traces, paperwork cues, and environmental tells tied to this city.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPanoramaOpen(true)}
                        className="shrink-0 inline-flex items-center gap-2 rounded-md border border-aqua-300/30 bg-aqua-300/12 px-4 py-3 mono-tick text-aqua-100 transition hover:bg-aqua-300/18 hover:text-cream-50"
                      >
                        <span className="inline-block h-2 w-2 rounded-full bg-aqua-300" />
                        Open 360 scan
                      </button>
                    </div>
                  )}

                </div>
              </div>
            </article>
          </section>
        )}

        {panoramaOpen && currentCity?.panorama360Url && (
          <CityPanoramaViewer
            imageUrl={currentCity.panorama360Url}
            title={`${currentCity.name}, ${currentCity.country}`}
            subtitle="360 evidence scan"
            onClose={() => setPanoramaOpen(false)}
          />
        )}

        {/* ── WITNESS DESK (separate block) ── */}
        {currentCity && (
          <section>
            <article className="dossier rounded-2xl p-5 md:p-6 border border-magenta-400/20 bg-midnight-900/55 relative overflow-hidden">
              <div className="absolute -top-24 -right-16 w-64 h-64 bg-magenta-500/[0.10] blur-[110px] pointer-events-none" />
              <div className="absolute -bottom-24 -left-16 w-56 h-56 bg-aqua-400/[0.08] blur-[100px] pointer-events-none" />

              <header className="flex items-center justify-between mb-4 relative">
                <div className="mono-tick text-cream-100 flex items-center gap-2">
                  <Eye className="w-3 h-3 text-aqua-400" /> Witness desk · {currentCity.name}
                </div>
                <div className="mono-tick text-dust-400 text-[10px]">
                  {localWitnesses.length === 0 ? 'No witnesses logged' : `${localWitnesses.length} contact${localWitnesses.length === 1 ? '' : 's'} ready`}
                </div>
              </header>

              {investigationLocked && (
                <div className="mb-4 rounded-md border border-coral-500/25 bg-coral-500/[0.08] px-3 py-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-coral-300 shrink-0 mt-0.5" />
                  <p className="text-xs text-coral-100 leading-relaxed">
                    {lockedDeskCopy}
                  </p>
                </div>
              )}

              {localWitnesses.length === 0 ? (
                <div className="rounded-md border border-dashed border-cream-50/[0.08] px-4 py-5 text-center">
                  <p className="text-[11px] text-dust-400 leading-relaxed">
                    No contacts cleared in {currentCity.name} yet. Pull route intel through Vivienne, then move to the next lead.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 relative">
                  {/* ── tab list ── */}
                  <aside className="space-y-2">
                    <div className="mono-tick text-dust-400 text-[10px] px-1">Local contacts</div>
                    {localWitnesses.map(witness => {
                      const active = witness.id === selectedWitness?.id;
                      const wLeadCount = gameState.discoveredClues.filter(c => c.witnessId === witness.id).length;
                      return (
                        <button
                          key={witness.id}
                          type="button"
                          onClick={() => selectWitness(witness.id)}
                          disabled={loading}
                          className={`w-full text-left flex gap-3 items-center px-3 py-2.5 rounded-lg border transition disabled:opacity-60 disabled:cursor-not-allowed group ${
                            active
                              ? 'border-coral-400/55 bg-coral-500/[0.12] shadow-[0_0_0_1px_rgba(255,122,107,0.12),0_0_24px_-6px_rgba(255,122,107,0.45)]'
                              : 'border-cream-50/[0.06] bg-midnight-900/45 hover:border-coral-500/35 hover:bg-coral-500/[0.05]'
                          }`}
                        >
                          <WitnessAvatar name={witness.name} src={witness.portraitImageUrl} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-display italic text-sm text-cream-50 truncate">{witness.name}</span>
                              {witness.hasTalkedThisVisit && (
                                <span title="Call used this visit" className="inline-block w-1.5 h-1.5 rounded-full bg-coral-300" />
                              )}
                            </div>
                            <p className="text-[11px] text-dust-300 line-clamp-1">{witness.personality}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] mono-tick">
                              {wLeadCount > 0 && (
                                <span className="text-magenta-300">{wLeadCount} lead{wLeadCount === 1 ? '' : 's'} on file</span>
                              )}
                              {witness.hasTalkedThisVisit && (
                                <span className="text-coral-200">used this visit</span>
                              )}
                              {wLeadCount === 0 && !witness.hasTalkedThisVisit && (
                                <span className="text-dust-500">no leads logged</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </aside>

                  {/* ── detail panel ── */}
                  {selectedWitness && (
                    <div className="rounded-xl border border-magenta-400/25 bg-gradient-to-br from-midnight-900/85 via-midnight-900/70 to-midnight-800/60 overflow-hidden">
                      {/* hero strip: portrait + identity */}
                      <div className="flex flex-col sm:flex-row gap-4 p-4 md:p-5 border-b border-cream-50/[0.06] bg-midnight-900/40">
                        <div className="sm:w-44 sm:h-52 w-full h-48 relative rounded-lg overflow-hidden border border-cream-50/[0.10] shrink-0">
                          <WitnessAvatar name={selectedWitness.name} src={selectedWitness.portraitImageUrl} size="lg" />
                          <div className="absolute inset-0 ring-1 ring-inset ring-cream-50/[0.06] pointer-events-none" />
                          <div className="absolute top-2 left-2 mono-tick text-[10px] text-magenta-200 bg-midnight-900/80 px-1.5 py-0.5 rounded border border-magenta-400/30">
                            DOSSIER
                          </div>
                          <div className="absolute bottom-2 right-2 mono-tick text-[10px] text-cream-100/80 bg-midnight-900/80 px-1.5 py-0.5 rounded border border-cream-50/[0.10]">
                            ID · {selectedWitness.id.slice(0, 6).toUpperCase()}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="mono-tick text-magenta-300 mb-0.5 tick-line">Selected contact</div>
                          <h3 className="font-display italic font-semibold text-2xl md:text-3xl text-cream-50 leading-[1.05]">
                            {selectedWitness.name}
                          </h3>
                          <div className="mono-tick text-cream-200/85 mt-1 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Witness</span>
                            <span className="text-dust-500">·</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {currentCity.name}, {currentCity.country}</span>
                          </div>
                          {/* status badges */}
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            <span className={`mono-tick text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              hasTalkedThisVisit
                                ? 'bg-coral-500/[0.12] border-coral-400/35 text-coral-100'
                                : 'bg-midnight-800/60 border-cream-50/[0.08] text-dust-400'
                            }`}>
                              <CheckCircle2 className="w-3 h-3" />
                              {hasTalkedThisVisit ? 'Call used this visit' : 'Channel available'}
                            </span>
                            {witnessClues.length > 0 && (
                              <span className="mono-tick text-[10px] px-2 py-0.5 rounded-full border bg-magenta-400/[0.10] border-magenta-400/35 text-magenta-200 flex items-center gap-1">
                                <Lightbulb className="w-3 h-3" /> {witnessClues.length} lead{witnessClues.length === 1 ? '' : 's'} on file
                              </span>
                            )}
                            {investigationLocked && (
                              <span className="mono-tick text-[10px] px-2 py-0.5 rounded-full border bg-coral-500/[0.10] border-coral-400/35 text-coral-100 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Review only
                              </span>
                            )}
                          </div>

                          <div className="flex-1" />

                          <div className="mt-4 flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                if (!canToggleWitnessChannel) return;
                                setWitnessChannelOpen(v => !v);
                              }}
                              disabled={!canToggleWitnessChannel}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md mono-tick transition border ${
                                witnessChannelOpen
                                  ? 'bg-coral-500/25 border-coral-400/55 text-coral-100'
                                  : canToggleWitnessChannel
                                  ? 'bg-coral-500/15 border-coral-400/35 text-coral-100 hover:bg-coral-500/25'
                                  : 'bg-midnight-800/60 border-cream-50/[0.08] text-dust-500 cursor-not-allowed'
                              }`}
                            >
                              <Phone className="w-3.5 h-3.5" /> {witnessChannelOpen ? 'Hide channel' : canToggleWitnessChannel ? 'Open channel' : 'Channel locked'}
                            </button>
                            <span className="mono-tick text-[10px] text-dust-500">
                              {witnessChannelOpen
                                ? 'Live · transcript captured'
                                : investigationLocked
                                ? lockedChannelCopy
                                : witnessLockedReason || 'Idle · ready to dial'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* dossier sections: demeanour + background */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 md:p-5">
                        <div className="rounded-md border border-cream-50/[0.06] bg-midnight-900/45 p-3">
                          <div className="mono-tick text-amber-400 mb-1.5 flex items-center gap-1.5 tick-line">
                            <Eye className="w-3 h-3" /> Demeanour
                          </div>
                          <p className="text-xs text-cream-200/90 leading-relaxed">
                            {selectedWitness.personality || <span className="text-dust-500 italic">No profile notes on file.</span>}
                          </p>
                        </div>
                        <div className="rounded-md border border-cream-50/[0.06] bg-midnight-900/45 p-3">
                          <div className="mono-tick text-aqua-400 mb-1.5 flex items-center gap-1.5 tick-line">
                            <BookOpen className="w-3 h-3" /> Background
                          </div>
                          <p className="text-xs text-cream-200/90 leading-relaxed">
                            {selectedWitness.backstory || <span className="text-dust-500 italic">No background recorded.</span>}
                          </p>
                        </div>
                      </div>

                      {/* live channel */}
                      {witnessChannelOpen && (
                        <div className="px-4 md:px-5 pb-4">
                          <div className="mono-tick text-coral-300 mb-2 flex items-center gap-1.5 tick-line">
                            <MessageCircle className="w-3 h-3" /> Live channel
                          </div>
                          <VoicePanel
                            agentId={selectedWitness.agentId ?? ''}
                            characterName={selectedWitness.name}
                            characterRole="witness"
                            variant="inline"
                            onClose={() => setWitnessChannelOpen(false)}
                            resolveSessionConfig={async () => await api.getWitnessVoiceConfig(selectedWitness.id)}
                            persistTranscript={async (entries) => {
                              if (entries.some(entry => entry.role === 'agent')) {
                                await api.saveWitnessCallMemory(selectedWitness.id, entries);
                                await refreshGameState();
                              }
                            }}
                          />
                        </div>
                      )}

                      <div className="p-4 md:p-5 pt-0">
                        <div className="rounded-md border border-magenta-400/20 bg-midnight-900/45 p-3">
                          <div className="mono-tick text-magenta-300 mb-2 flex items-center gap-1.5 tick-line">
                            <Lightbulb className="w-3 h-3" /> Leads on file ({witnessClues.length})
                          </div>
                          {witnessClues.length === 0 ? (
                            <p className="text-[11px] text-dust-400">No leads tied to this witness yet.</p>
                          ) : (
                            <>
                              <ul className="space-y-1.5">
                                {witnessClues.map(clue => (
                                  <li key={clue.id} className="text-xs px-2.5 py-2 rounded-md bg-magenta-400/[0.06] border border-magenta-400/20 text-cream-100 leading-relaxed">
                                    <div className="mb-1 flex items-center gap-2">
                                      <span className="mono-tick text-[10px] px-1.5 py-0.5 rounded border border-magenta-400/25 bg-midnight-900/65 text-magenta-200">
                                        {formatClueKind(clue.kind, clue.isMisleading)}
                                      </span>
                                    </div>
                                    {clue.content}
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-2 text-[11px] text-dust-400">
                                Cross-check these against the rest of the file and keep your own theory in the Notebook.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          </section>
        )}

        <section className="dossier rounded-xl p-5 max-w-3xl mx-auto relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-56 h-56 bg-amber-400/[0.08] blur-[80px] pointer-events-none" />
          <div className="mono-tick text-amber-400 mb-2">Detective&rsquo;s notebook</div>
          <p className="text-sm text-cream-200 leading-relaxed">
            Every voice in this city pushes the case somewhere. Keep the names, routes, and contradictions that matter in your Notebook, then decide for yourself what holds.
          </p>
        </section>
      </main>
    </div>
  );
}

/* ── helpers ───────────────────────────────────────────── */

function BackdropGlobe({
  targetLat, targetLng, cities, currentCityId,
}: {
  targetLat: number;
  targetLng: number;
  cities: City[];
  currentCityId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mounted, setMounted] = useState(false);

  /* responsive sizing */
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  /* slow auto-rotate, no zoom, no pan */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = false;
  }, [dimensions]);

  /* cinematic intro: start far + tilted, then fly to first city */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !mounted) return;
    // start position
    globe.pointOfView({ lat: 18, lng: targetLng - 70, altitude: 3.4 }, 0);
    // settle on first city
    const t = window.setTimeout(() => {
      globe.pointOfView({ lat: targetLat, lng: targetLng, altitude: 2.4 }, INTRO_SPIN_MS);
    }, 80);
    return () => window.clearTimeout(t);
  }, [mounted, targetLat, targetLng]);

  /* delay first paint a tick so dimensions exist */
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  const points: BoardPoint[] = useMemo(() => cities.map((c) => {
    const isCurrent = c.id === currentCityId;
    return {
      lat: c.lat,
      lng: c.lng,
      color: isCurrent ? '#5fe3d0' : '#8a7eb8',
      radius: isCurrent ? 0.7 : 0.4,
      altitude: isCurrent ? 0.04 : 0.02,
      label: `${c.name}, ${c.country}`,
    };
  }), [cities, currentCityId]);

  const rings: BoardRing[] = useMemo(() => {
    const target = cities.find(c => c.id === currentCityId) ?? cities[0];
    if (!target) return [];
    return [{
      lat: target.lat, lng: target.lng,
      color: '#5fe3d0',
      maxR: 4, propagationSpeed: 1.4, repeatPeriod: 1700,
    }];
  }, [cities, currentCityId]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none"
      aria-hidden
    >
      {dimensions.width > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          atmosphereColor="#5fe3d0"
          atmosphereAltitude={0.28}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointRadius="radius"
          pointAltitude="altitude"
          pointLabel="label"
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor="color"
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          ringAltitude={0.005}
          enablePointerInteraction={false}
        />
      )}
    </div>
  );
}

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
