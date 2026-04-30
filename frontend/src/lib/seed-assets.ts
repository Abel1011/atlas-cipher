import type { City, GameState, Witness } from '../types';

const STATIC_SEED_SLUGS = new Set([
  'star-of-carthage',
  'sapphire-relay',
  'ash-ledger',
  'glass-atlas',
  'neon-embassy',
  'midnight-ledger',
  'polar-current',
  'velvet-mirage',
]);

const SEED_MISSION_COVER_PATHS: Record<string, string> = {
  'star-of-carthage': 'cities/01-istanbul-scene.jpg',
  'sapphire-relay': 'cities/01-singapore-scene.jpg',
  'ash-ledger': 'cities/01-rome-scene.jpg',
  'glass-atlas': 'cities/01-reykjavik-scene.jpg',
  'neon-embassy': 'cities/01-seoul-scene.jpg',
  'midnight-ledger': 'cities/01-dubai-scene.jpg',
  'polar-current': 'cities/01-nuuk-scene.jpg',
  'velvet-mirage': 'cities/01-marseille-scene.jpg',
};

export function getPublicAssetUrl(path: string): string {
  const normalizedBase = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}${normalizedPath}`;
}

export function hydrateSeedAssetUrls(state: GameState): GameState {
  if (state.case.source !== 'seed') return state;
  if (!STATIC_SEED_SLUGS.has(state.case.slug)) return state;

  return {
    ...state,
    case: {
      ...state.case,
      cities: state.case.cities.map(city => hydrateCity(state.case.slug, city)),
    },
  };
}

function hydrateCity(caseSlug: string, city: City): City {
  return {
    ...city,
    sceneImageUrl: buildSceneUrl(caseSlug, city),
    panorama360Url: buildPanoramaUrl(caseSlug, city),
    ambientSoundUrl: buildMissionMusicUrl(caseSlug),
    witnesses: city.witnesses.map(witness => hydrateWitness(caseSlug, city, witness)),
  };
}

export function getSeedPanoramaMusicUrl(caseSlug: string): string | null {
  if (!STATIC_SEED_SLUGS.has(caseSlug)) return null;
  return getPublicAssetUrl(`assets/seeds/${caseSlug}/audio/panorama-mystery.mp3`);
}

export function getSeedMissionCoverUrl(caseSlug: string): string | null {
  const coverPath = SEED_MISSION_COVER_PATHS[caseSlug];
  if (!coverPath) return null;
  return getPublicAssetUrl(`assets/seeds/${caseSlug}/${coverPath}`);
}

function hydrateWitness(caseSlug: string, city: City, witness: Witness): Witness {
  return {
    ...witness,
    portraitImageUrl: buildPortraitUrl(caseSlug, city, witness),
  };
}

function buildSceneUrl(caseSlug: string, city: City): string {
  const fileName = `${String(city.visitOrder).padStart(2, '0')}-${slugify(city.name)}-scene.jpg`;
  return getPublicAssetUrl(`assets/seeds/${caseSlug}/cities/${fileName}`);
}

function buildPanoramaUrl(caseSlug: string, city: City): string {
  const fileName = `${String(city.visitOrder).padStart(2, '0')}-${slugify(city.name)}-panorama.jpg`;
  return getPublicAssetUrl(`assets/seeds/${caseSlug}/panoramas/${fileName}`);
}

function buildPortraitUrl(caseSlug: string, city: City, witness: Witness): string {
  const fileName = `${slugify(city.name)}-${slugify(witness.name)}-portrait.jpg`;
  return getPublicAssetUrl(`assets/seeds/${caseSlug}/witnesses/${fileName}`);
}

function buildMissionMusicUrl(caseSlug: string): string {
  return getPublicAssetUrl(`assets/seeds/${caseSlug}/audio/mission-theme.mp3`);
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}