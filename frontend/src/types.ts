export interface Case {
  id: string;
  title: string;
  slug: string;
  source: 'seed' | 'ai';
  difficulty: number;
  minLevel: number;
  crimeDescription: string;
  handlerAgentId: string | null;
  cities: City[];
  suspects: Suspect[];
}

export interface City {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  sceneImageUrl: string | null;
  panorama360Url: string | null;
  ambientSoundUrl: string | null;
  visitOrder: number;
  visited: boolean;
  unlocked: boolean;
  witnessCount: number;
  travelHours: number | null;
  travelCost: number | null;
  witnesses: Witness[];
}

export interface Witness {
  id: string;
  name: string;
  personality: string;
  backstory: string;
  portraitImageUrl: string | null;
  agentId: string | null;
  voiceDescription: string;
  leadCount: number;
  hasTalkedThisVisit: boolean;
  talkLockedReason: string | null;
}

export interface Suspect {
  id: string;
  name: string;
  description: string | null;
  profiled: boolean;
  evidenceCount: number;
}

export type ClueKind = 'route' | 'suspect' | 'corroboration';

export interface Clue {
  id: string;
  witnessId: string | null;
  content: string;
  isMisleading: boolean;
  pointsToCityId: string | null;
  pointsToSuspectId: string | null;
  discoveredAt: string | null;
  kind: ClueKind;
}

export interface MissionResources {
  remainingHours: number;
  totalHours: number;
  remainingCredits: number;
  totalCredits: number;
  supportCallsRemaining: number;
}

export interface HandlerState {
  canCall: boolean;
  supportCallsRemaining: number;
  reason: string | null;
}

export interface WarrantState {
  ready: boolean;
  routeClues: number;
  suspectClues: number;
  corroboratingClues: number;
  overrideMode: 'stranded' | null;
  reason: string | null;
}

export type MissionNoteContextType = 'general' | 'city' | 'witness' | 'clue';

export interface MissionNoteEntry {
  id: string;
  contextType: MissionNoteContextType;
  contextId: string | null;
  contextLabel: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface WitnessCallTranscriptTurn {
  role: 'agent' | 'user';
  text: string;
}

export interface WitnessCallHistoryEntry {
  id: string;
  witnessId: string;
  note: string;
  transcript: WitnessCallTranscriptTurn[];
  createdAt: string;
}

export type MissionSessionStatus = 'active' | 'solved' | 'failed' | 'abandoned';

export interface GameState {
  caseId: string;
  status: MissionSessionStatus;
  currentCityId: string | null;
  case: Case;
  discoveredClues: Clue[];
  missionNotes: MissionNoteEntry[];
  witnessCallHistory: WitnessCallHistoryEntry[];
  resources: MissionResources;
  handler: HandlerState;
  warrant: WarrantState;
}

export interface PlayerProgress {
  displayName: string | null;
  level: number;
  experience: number;
  solvedCases: number;
  failedCases: number;
  abandonedCases: number;
  nextLevelExperience: number | null;
}

export type MissionOfferStatus = 'solved' | 'failed' | 'abandoned';

export interface MissionOffer {
  templateId: string;
  slug: string;
  title: string;
  summary: string;
  difficulty: number;
  minLevel: number;
  cityCount: number;
  witnessCount: number;
  suspectCount: number;
  countryCount: number;
  playerStatus?: MissionOfferStatus | null;
  hasDetail?: boolean;
}

export interface MissionBoard {
  player: PlayerProgress;
  offers: MissionOffer[];
  hiddenOfferCount: number;
}

export interface AgentConfig {
  agentId: string;
  signedUrl: string | null;
  characterName: string;
  characterRole: 'handler' | 'witness';
}
