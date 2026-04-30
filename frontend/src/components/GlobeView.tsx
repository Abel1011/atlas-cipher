import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import {
  Plane, Users, MapPin, Target, Radio, ArrowRight,
  CheckCircle2, Globe2, Search, Lock, AlertTriangle, X, ShieldAlert,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSoundEngine } from './SoundEngine';
import { AUDIO_ASSET_URLS } from '../lib/audio-assets';
import type { City } from '../types';

interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
}

interface PointData {
  lat: number;
  lng: number;
  city: City;
  color: string;
  radius: number;
  altitude: number;
  label: string;
}

interface RingData {
  lat: number;
  lng: number;
  color: string;
  maxR: number;
  propagationSpeed: number;
  repeatPeriod: number;
}

const TRAVEL_SOUND_URL = AUDIO_ASSET_URLS.travelTransition;

const COLOR_CURRENT  = '#5fe3d0';
const COLOR_VISITED  = '#8a7eb8';
const COLOR_PENDING  = '#ff9685';
const COLOR_LOCKED   = '#667085';
const COLOR_HOVER    = '#ffc857';
const COLOR_ARC_PAST = 'rgba(95, 227, 208, 0.55)';
const COLOR_ARC_LIVE = '#ffc857';

export default function GlobeView() {
  const {
    gameState, travelToCity, setView, error, clearError,
  } = useGame();
  const { playTransition } = useSoundEngine();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [animatingArc, setAnimatingArc] = useState<ArcData | null>(null);
  const [traveling, setTraveling] = useState(false);
  const [travelRoute, setTravelRoute] = useState<{ from: City; to: City } | null>(null);
  const [hoveredCityId, setHoveredCityId] = useState<string | null>(null);
  const [utcTime, setUtcTime] = useState(formatUtc(new Date()));
  const [preflightError, setPreflightError] = useState<string | null>(null);

  // Auto-dismiss the travel-denied banner after 5 seconds
  useEffect(() => {
    if (!preflightError && !error) return;
    const t = window.setTimeout(() => {
      setPreflightError(null);
      clearError();
    }, 5000);
    return () => window.clearTimeout(t);
  }, [preflightError, error, clearError]);

  /* live UTC clock */
  useEffect(() => {
    const id = setInterval(() => setUtcTime(formatUtc(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

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

  /* globe controls */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = true;
  }, [dimensions]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotate = !traveling;
  }, [traveling]);

  /* fly camera to current city when it changes */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !gameState) return;
    const c = gameState.case.cities.find(x => x.id === gameState.currentCityId);
    if (c) globe.pointOfView({ lat: c.lat, lng: c.lng, altitude: 2.2 }, 1400);
  }, [gameState?.currentCityId]);

  const currentCity = useMemo(
    () => gameState?.case.cities.find(c => c.id === gameState?.currentCityId) || null,
    [gameState],
  );
  const investigationLocked = gameState?.status !== 'active';

  const stats = useMemo(() => {
    if (!gameState) return { visited: 0, total: 0, clues: 0, suspects: 0, witnesses: 0, openLeads: 0 };
    const cities = gameState.case.cities;
    return {
      visited: cities.filter(c => c.visited).length,
      total: cities.length,
      clues: gameState.discoveredClues.length,
      suspects: gameState.case.suspects.length,
      witnesses: cities.reduce((s, c) => s + c.witnessCount, 0),
      openLeads: cities.filter(c => c.unlocked && !c.visited && c.id !== gameState.currentCityId).length,
    };
  }, [gameState]);

  /** Cities grouped by status — routes branch, so we don't show a linear order. */
  const groupedCities = useMemo(() => {
    if (!gameState) return { leads: [], visited: [], locked: 0 };
    const cities = gameState.case.cities;
    const byName = (a: City, b: City) => a.name.localeCompare(b.name);
    return {
      leads: cities.filter(c => c.unlocked && !c.visited && c.id !== gameState.currentCityId).sort(byName),
      visited: cities.filter(c => c.visited && c.id !== gameState.currentCityId).sort((a, b) => a.visitOrder - b.visitOrder),
      locked: cities.filter(c => !c.unlocked).length,
    };
  }, [gameState]);

  const pointsData: PointData[] = useMemo(() => {
    if (!gameState) return [];
    return gameState.case.cities.map(city => {
      const isCurrent = city.id === gameState.currentCityId;
      const isHovered = city.id === hoveredCityId;
      const isVisited = city.visited;
      const isUnlocked = city.unlocked;
      let color: string, radius: number, altitude: number;
      if (isCurrent)        { color = COLOR_CURRENT; radius = 0.75; altitude = 0.05; }
      else if (isHovered)   { color = COLOR_HOVER;   radius = 0.7;  altitude = 0.04; }
      else if (isVisited)   { color = COLOR_VISITED; radius = 0.4;  altitude = 0.01; }
      else if (isUnlocked)  { color = COLOR_PENDING; radius = 0.55; altitude = 0.025; }
      else                  { color = COLOR_LOCKED;  radius = 0.3;  altitude = 0.005; }
      return { lat: city.lat, lng: city.lng, city, color, radius, altitude, label: `${city.name}, ${city.country}` };
    });
  }, [gameState, hoveredCityId]);

  const ringsData: RingData[] = useMemo(() => {
    if (!gameState) return [];
    const rings: RingData[] = [];
    if (currentCity) {
      rings.push({ lat: currentCity.lat, lng: currentCity.lng, color: COLOR_CURRENT, maxR: 4, propagationSpeed: 1.5, repeatPeriod: 1600 });
    }
    if (hoveredCityId && hoveredCityId !== currentCity?.id) {
      const city = gameState.case.cities.find(c => c.id === hoveredCityId);
      if (city) rings.push({ lat: city.lat, lng: city.lng, color: COLOR_HOVER, maxR: 3, propagationSpeed: 2, repeatPeriod: 900 });
    }
    return rings;
  }, [currentCity, hoveredCityId, gameState]);

  const travelArcs: ArcData[] = useMemo(() => {
    if (!gameState) return [];
    const visited = gameState.case.cities.filter(c => c.visited).sort((a, b) => a.visitOrder - b.visitOrder);
    const arcs: ArcData[] = [];
    for (let i = 0; i < visited.length - 1; i++) {
      const from = visited[i], to = visited[i + 1];
      if (from && to) arcs.push({
        startLat: from.lat, startLng: from.lng,
        endLat: to.lat, endLng: to.lng,
        color: COLOR_ARC_PAST,
      });
    }
    return arcs;
  }, [gameState]);

  const allArcs = useMemo(
    () => animatingArc ? [...travelArcs, animatingArc] : travelArcs,
    [travelArcs, animatingArc],
  );

  const travelToCityId = useCallback(async (cityId: string) => {
    if (traveling || !gameState) return;
    if (investigationLocked) {
      setPreflightError('Mission failed. Atlas is now in review mode and travel is locked.');
      return;
    }
    // Ignore clicks on the current location — you cannot travel to where you already are.
    if (cityId === gameState.currentCityId) return;
    const target = gameState.case.cities.find(c => c.id === cityId);
    const from = currentCity;
    if (!target) return;
    if (!target.unlocked) return;

    setPreflightError(null);
    clearError();

    if (target.travelHours !== null && gameState.resources.remainingHours < target.travelHours) {
      setPreflightError('You do not have enough case time left to make this trip.');
      return;
    }
    if (target.travelCost !== null && gameState.resources.remainingCredits < target.travelCost) {
      setPreflightError('You do not have enough agency credits left to fund this trip.');
      return;
    }

    setTraveling(true);
    if (from) {
      setTravelRoute({ from, to: target });
      setAnimatingArc({
        startLat: from.lat, startLng: from.lng,
        endLat: target.lat, endLng: target.lng,
        color: COLOR_ARC_LIVE,
      });
    }
    playTransition(TRAVEL_SOUND_URL);
    const globe = globeRef.current;
    if (globe) globe.pointOfView({ lat: target.lat, lng: target.lng, altitude: 2.2 }, 3200);
    await new Promise(r => setTimeout(r, 3400));
    setAnimatingArc(null);
    setTravelRoute(null);
    setTraveling(false);
    try {
      await travelToCity(cityId);
      setView('case-board');
    } catch {
      // Keep the player in Atlas when the trip is rejected so the stale city view
      // does not look like a successful travel.
    }
  }, [traveling, gameState, currentCity, playTransition, travelToCity, setView, clearError, investigationLocked]);

  const handleCityClick = useCallback((point: object) => {
    const p = point as PointData;
    void travelToCityId(p.city.id);
  }, [travelToCityId]);

  const focusCity = useCallback((city: City) => {
    const globe = globeRef.current;
    if (globe) globe.pointOfView({ lat: city.lat, lng: city.lng, altitude: 1.7 }, 1100);
  }, []);

  if (!gameState) return null;

  return (
    <div className="absolute inset-0 flex flex-col bg-midnight-950 overflow-hidden">
      {/* spacer behind HUD */}
      <div className="h-[72px] shrink-0" />

      <div ref={containerRef} className="relative flex-1 w-full overflow-hidden">
        {/* layered backdrops */}
        <div className="absolute inset-0 bg-nebula" />
        <div className="absolute inset-0 bg-atlas-grid opacity-40 pointer-events-none" />
        <div className="absolute inset-0 bg-grain opacity-[0.18] pointer-events-none mix-blend-overlay" />
        <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] bg-coral-500/10 blur-[110px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-32 w-[32rem] h-[32rem] bg-aqua-400/10 blur-[120px] pointer-events-none" />

        {/* ── GLOBE ── */}
        {dimensions.width > 0 && (
          <Globe
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            atmosphereColor="#5fe3d0"
            atmosphereAltitude={0.25}
            pointsData={pointsData}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointRadius="radius"
            pointAltitude="altitude"
            pointLabel="label"
            onPointClick={handleCityClick}
            onPointHover={(p) => {
              const nextPoint = p as PointData | null;
              const c = nextPoint?.city;
              // Don't highlight the current city as a hover target — it isn't clickable.
              setHoveredCityId(c && c.unlocked && c.id !== gameState.currentCityId ? c.id : null);
            }}
            arcsData={allArcs}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor="color"
            arcDashLength={0.5}
            arcDashGap={0.3}
            arcDashAnimateTime={2600}
            arcStroke={0.6}
            ringsData={ringsData}
            ringLat="lat"
            ringLng="lng"
            ringColor="color"
            ringMaxRadius="maxR"
            ringPropagationSpeed="propagationSpeed"
            ringRepeatPeriod="repeatPeriod"
            ringAltitude={0.005}
            enablePointerInteraction={!traveling && !investigationLocked}
          />
        )}

        {/* corner brackets (subtle frame) */}
        <CornerBracket pos="top-4 left-4" />
        <CornerBracket pos="top-4 right-4" rot={90} />
        <CornerBracket pos="bottom-4 left-4" rot={-90} />
        <CornerBracket pos="bottom-4 right-4" rot={180} />

        {/* TOP-LEFT mission tag — unified card with accent strip */}
        <div className="absolute top-5 left-5 max-w-xs">
          <div className="dossier rounded-md backdrop-blur overflow-hidden flex">
            <div className="w-1 bg-aqua-400" />
            <div className="px-3.5 py-2.5 flex-1">
              <div className="flex items-center gap-2 mono-tick mb-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-aqua-400 animate-pulse-soft" />
                <span className="text-aqua-400">Ops Console · Live</span>
                <span className="text-dust-500">·</span>
                <span className="text-amber-400">UTC {utcTime}</span>
              </div>
              <div className="mono-tick text-dust-400">Case · {gameState.caseId.slice(0, 8).toUpperCase()}</div>
              <div className="font-display italic text-cream-50 text-base leading-tight mt-0.5 line-clamp-2">
                {gameState.case.title}
              </div>
            </div>
          </div>
        </div>

        {/* TOP-RIGHT legend — compact horizontal chip row */}
        <div className="absolute top-5 right-5 hidden md:flex items-center gap-1.5 dossier rounded-md px-2.5 py-1.5 backdrop-blur">
          <LegendChip color={COLOR_CURRENT} label="Here" />
          <LegendChip color={COLOR_PENDING} label="Lead" />
          <LegendChip color={COLOR_VISITED} label="Visited" />
          <LegendChip color={COLOR_LOCKED} label="Locked" />
        </div>

        {(preflightError || error) && (
          <div
            key={preflightError ?? error ?? 'travel-denied'}
            className="absolute top-24 left-5 right-5 z-20 md:left-auto md:right-5 md:max-w-md animate-slide-in-down"
          >
            <div className="relative overflow-hidden dossier rounded-lg border border-coral-500/40 bg-midnight-900/95 backdrop-blur shadow-[0_24px_60px_-18px_rgba(0,0,0,0.75)]">
              {/* Top accent strip */}
              <div className="h-[3px] w-full bg-gradient-to-r from-coral-500/0 via-coral-500/80 to-coral-500/0" />

              <div className="px-3.5 py-3 flex items-start gap-3">
                {/* Icon halo */}
                <div className="w-9 h-9 rounded-md bg-coral-500/15 border border-coral-500/40 flex items-center justify-center shrink-0 animate-pulse-soft">
                  <AlertTriangle className="w-4.5 h-4.5 text-coral-300" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="mono-tick text-coral-300">Travel denied</span>
                    {travelRoute?.to.name && (
                      <span className="mono-tick text-[10px] text-dust-400 truncate">
                        → {travelRoute.to.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-cream-200 leading-relaxed">
                    {preflightError ?? error}
                  </p>
                  {gameState.warrant.overrideMode === 'stranded' && (
                    <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-400/30 bg-amber-400/[0.06] px-2 py-1.5">
                      <ShieldAlert className="w-3 h-3 text-amber-300 shrink-0 mt-0.5" />
                      <p className="mono-tick text-[10px] text-amber-200 normal-case tracking-wide leading-snug">
                        No further travel possible. Issue a warrant from the header with current intel.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPreflightError(null);
                    clearError();
                  }}
                  title="Dismiss travel alert"
                  className="p-1 rounded-md text-dust-400 hover:text-coral-300 hover:bg-midnight-800 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 5s countdown bar */}
              <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-coral-500/15">
                <div
                  className="h-full bg-coral-400/80 animate-shrink-bar"
                  style={{ animationDuration: '5000ms' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* LEFT RAIL: current location dossier */}
        {currentCity && (
          <aside className="absolute top-1/2 left-5 -translate-y-1/2 w-72 hidden lg:block">
            <div className="mono-tick text-coral-400 mb-2 flex items-center gap-2">
              <MapPin className="w-3 h-3" /> Active Position
            </div>
            <div className="dossier rounded-lg overflow-hidden backdrop-blur shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
              <div className="relative h-32 overflow-hidden">
                {currentCity.sceneImageUrl ? (
                  <img
                    src={currentCity.sceneImageUrl}
                    alt={currentCity.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full bg-midnight-800 flex items-center justify-center">
                    <Globe2 className="w-8 h-8 text-dust-400 opacity-40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-midnight-950 via-midnight-950/30 to-transparent" />
                <div className="absolute top-2 left-2 mono-tick text-aqua-300 bg-midnight-950/60 px-1.5 py-0.5 rounded">
                  {currentCity.lat.toFixed(2)}° {currentCity.lng.toFixed(2)}°
                </div>
                <div className="absolute bottom-2 left-3 right-3">
                  <div className="font-display italic text-cream-50 text-2xl leading-none">{currentCity.name}</div>
                  <div className="text-cream-300 text-xs mt-0.5">{currentCity.country}</div>
                </div>
              </div>
              <div className="px-3.5 py-3 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="mono-tick text-dust-400">Witnesses on file</span>
                  <span className="font-display italic text-aqua-400 text-lg leading-none">{currentCity.witnessCount}</span>
                </div>
                <button
                  onClick={() => setView('case-board')}
                  className="btn-coral w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-cream-50 font-mono uppercase tracking-[0.18em] text-[11px]"
                >
                  <Search className="w-3.5 h-3.5" /> Investigate
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* RIGHT RAIL: dossier-style lead board (non-linear) */}
        <aside className="absolute top-1/2 right-5 -translate-y-1/2 w-80 hidden lg:block">
          <div className="mono-tick text-aqua-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2"><Target className="w-3 h-3" /> Lead Board</span>
            <span className="text-dust-400">
              {stats.openLeads} open · {stats.visited} cleared
            </span>
          </div>

          <div className="dossier rounded-lg backdrop-blur p-3 max-h-[62vh] overflow-y-auto space-y-4">
            {/* Active leads (parallel, unordered) */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <span className="mono-tick text-coral-400 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral-400 animate-pulse-soft" />
                  Active leads
                </span>
                <span className="mono-tick text-dust-500">{groupedCities.leads.length}</span>
              </div>
              {groupedCities.leads.length === 0 ? (
                <p className="text-[11px] text-dust-500 italic px-2 py-3">
                  No open leads. Talk to witnesses here to surface new destinations.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {groupedCities.leads.map(city => (
                    <LeadCard
                      key={city.id}
                      city={city}
                      variant="lead"
                      disabled={traveling || investigationLocked}
                      onClick={() => travelToCityId(city.id)}
                      onHoverIn={() => { setHoveredCityId(city.id); focusCity(city); }}
                      onHoverOut={() => setHoveredCityId(null)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Visited */}
            {groupedCities.visited.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="mono-tick text-dust-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Cleared
                  </span>
                  <span className="mono-tick text-dust-500">{groupedCities.visited.length}</span>
                </div>
                <div className="space-y-1.5">
                  {groupedCities.visited.map(city => (
                    <LeadCard
                      key={city.id}
                      city={city}
                      variant="visited"
                      disabled={traveling || investigationLocked}
                      onClick={() => travelToCityId(city.id)}
                      onHoverIn={() => { setHoveredCityId(city.id); focusCity(city); }}
                      onHoverOut={() => setHoveredCityId(null)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Sealed (count only — no spoilers, no order) */}
            {groupedCities.locked > 0 && (
              <section className="pt-1 border-t border-cream-50/[0.06]">
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="mono-tick text-dust-500 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> Sealed routes
                  </span>
                  <span className="mono-tick text-dust-500">{groupedCities.locked}</span>
                </div>
                <p className="text-[10px] text-dust-500 italic px-1 mt-1">
                  Awaiting intel from witnesses or evidence.
                </p>
              </section>
            )}
          </div>
        </aside>

        {/* BOTTOM TICKER — grouped Progress | Resources */}
        <div className="absolute bottom-20 left-5 right-5 dossier rounded-md backdrop-blur px-4 py-2.5 flex items-center gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <Radio className="w-3.5 h-3.5 text-coral-400 animate-pulse-soft" />
            <span className="mono-tick text-coral-400">Live Intel</span>
          </div>
          <div className="h-4 w-px bg-cream-50/[0.08] shrink-0" />
          <div className="flex items-center gap-4 shrink-0">
            <Stat icon={<MapPin className="w-3 h-3" />} label="Cities" value={`${stats.visited}/${stats.total}`} accent="aqua" />
            <Stat icon={<Search className="w-3 h-3" />} label="Clues" value={stats.clues} accent="magenta" />
            <Stat icon={<Users className="w-3 h-3" />} label="Witnesses" value={stats.witnesses} accent="amber" />
            <Stat icon={<Target className="w-3 h-3" />} label="Suspects" value={stats.suspects} accent="coral" />
          </div>
          <div className="h-4 w-px bg-cream-50/[0.08] shrink-0" />
          <div className="hidden md:flex items-center gap-2 ml-auto shrink-0 mono-tick text-dust-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-aqua-400 animate-pulse-soft" />
            Channel 7 · Encrypted
          </div>
        </div>

        {/* MOBILE compact lead row (lg:hidden) — only open leads + visited, no order numbering */}
        <div className="lg:hidden absolute top-20 left-5 right-5 dossier rounded-md backdrop-blur px-3 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="mono-tick text-coral-400 shrink-0">Leads</span>
          {groupedCities.leads.length === 0 && (
            <span className="mono-tick text-dust-500 shrink-0 italic">none open</span>
          )}
          {groupedCities.leads.map(city => (
            <button
              key={city.id}
              onClick={() => travelToCityId(city.id)}
              disabled={traveling || investigationLocked}
              className="shrink-0 px-2 py-1 rounded text-xs border border-coral-400/30 text-coral-300 transition-colors hover:bg-coral-400/10"
            >
              {city.name}
            </button>
          ))}
          {groupedCities.visited.length > 0 && (
            <>
              <span className="h-4 w-px bg-cream-50/[0.08] shrink-0" />
              <span className="mono-tick text-dust-400 shrink-0">Cleared</span>
              {groupedCities.visited.map(city => (
                <button
                  key={city.id}
                  onClick={() => travelToCityId(city.id)}
                  disabled={traveling || investigationLocked}
                  className="shrink-0 px-2 py-1 rounded text-xs border border-dust-500/30 text-dust-400"
                >
                  {city.name}
                </button>
              ))}
            </>
          )}
        </div>

        {/* TRAVEL OVERLAY — boarding-pass card with FROM → TO and progress */}
        {traveling && (
          <div className="absolute top-64 left-1/2 -translate-x-1/2 pointer-events-none z-20 animate-[fadeInDown_240ms_ease-out]">
            <div className="relative">
              {/* outer glow */}
              <div className="absolute -inset-2 rounded-xl bg-amber-400/15 blur-2xl" />
              <div className="relative dossier rounded-xl backdrop-blur-md shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] overflow-hidden border border-amber-400/30">
                {/* top stripe */}
                <div className="flex items-center justify-between px-5 pt-3 pb-2 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent">
                  <div className="flex items-center gap-2">
                    <span className="relative inline-flex w-2 h-2">
                      <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping" />
                      <span className="relative w-2 h-2 rounded-full bg-amber-400" />
                    </span>
                    <span className="mono-tick text-amber-400 tracking-[0.22em]">In Transit · Channel 7</span>
                  </div>
                  <span className="mono-tick text-dust-400">FLIGHT · GD-{gameState.caseId.slice(0, 4).toUpperCase()}</span>
                </div>

                {/* main row: FROM → plane → TO */}
                <div className="flex items-center gap-5 px-6 py-3.5">
                  {travelRoute && (
                    <div className="text-right min-w-[120px]">
                      <div className="mono-tick text-dust-400">From</div>
                      <div className="font-display italic text-cream-50 text-xl leading-none truncate">{travelRoute.from.name}</div>
                      <div className="mono-tick text-dust-500 text-[9px] mt-0.5">{travelRoute.from.country}</div>
                    </div>
                  )}

                  {/* dotted track + plane */}
                  <div className="relative h-8 flex-1 min-w-[140px] flex items-center">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-[repeating-linear-gradient(to_right,theme(colors.amber.400)_0,theme(colors.amber.400)_4px,transparent_4px,transparent_9px)] opacity-60" />
                    <Plane className="absolute w-5 h-5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)] animate-[flightPath_3.4s_ease-in-out_forwards]" />
                  </div>

                  {travelRoute && (
                    <div className="text-left min-w-[120px]">
                      <div className="mono-tick text-aqua-400">To</div>
                      <div className="font-display italic text-cream-50 text-xl leading-none truncate">{travelRoute.to.name}</div>
                      <div className="mono-tick text-dust-500 text-[9px] mt-0.5">{travelRoute.to.country}</div>
                    </div>
                  )}
                </div>

                {/* progress bar */}
                <div className="h-0.5 w-full bg-midnight-800/80 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-aqua-400 animate-[progressFill_3.4s_linear_forwards]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────── helpers ─────── */

function Stat({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: 'aqua' | 'coral' | 'amber' | 'magenta';
}) {
  const colors: Record<string, string> = {
    aqua: 'text-aqua-400',
    coral: 'text-coral-400',
    amber: 'text-amber-400',
    magenta: 'text-magenta-400',
  };
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className={colors[accent]}>{icon}</span>
      <span className="mono-tick text-dust-400">{label}</span>
      <span className={`font-display italic text-base leading-none ${colors[accent]}`}>{value}</span>
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />;
}

function LeadCard({
  city, variant, disabled, onClick, onHoverIn, onHoverOut,
}: {
  city: City;
  variant: 'lead' | 'visited';
  disabled: boolean;
  onClick: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
}) {
  const isLead = variant === 'lead';
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
      disabled={disabled}
      className={`group w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-all border ${
        isLead
          ? 'border-coral-400/20 bg-coral-400/[0.04] hover:border-coral-400/50 hover:bg-coral-400/10'
          : 'border-cream-50/[0.05] hover:border-cream-50/15 hover:bg-midnight-800/60'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="shrink-0">
        {isLead ? (
          <div className="relative w-7 h-7 rounded-full bg-coral-400/15 border border-coral-400/50 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-coral-400/20 animate-pulse-soft" />
            <MapPin className="relative w-3.5 h-3.5 text-coral-400" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-midnight-800/80 border border-dust-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-dust-400" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-display italic text-sm leading-tight truncate ${
          isLead ? 'text-cream-50' : 'text-dust-300'
        }`}>
          {city.name}
        </div>
        <div className="mono-tick text-dust-400 text-[9px] truncate">
          {city.country}
          {city.travelHours !== null && city.travelCost !== null
            ? ` · ${city.travelHours}h · ${city.travelCost} cr`
            : ''}
        </div>
      </div>
      <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-all ${
        isLead
          ? 'text-coral-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5'
          : 'text-dust-500 opacity-0 group-hover:opacity-100'
      }`} />
    </button>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] mono-tick text-cream-200">
      <Dot c={color} />
      {label}
    </span>
  );
}

function CornerBracket({ pos, rot = 0 }: { pos: string; rot?: number }) {
  return (
    <div
      aria-hidden
      className={`absolute w-6 h-6 text-amber-400/40 pointer-events-none ${pos}`}
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <span className="absolute top-0 left-0 w-full h-px bg-current" />
      <span className="absolute top-0 left-0 h-full w-px bg-current" />
    </div>
  );
}

function formatUtc(d: Date) {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
