import { getPlayerId } from './player-id';
import type { GameState } from '../types';
import { hydrateSeedAssetUrls } from './seed-assets';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Player-Id', getPlayerId());

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const raw = await res.text();
    let message = `API error ${res.status}`;
    try {
      const parsed = raw ? JSON.parse(raw) as { error?: string; message?: string } : null;
      message = parsed?.error ?? parsed?.message ?? raw ?? message;
    } catch {
      message = raw || message;
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function newGame() {
  return request('/game/new', { method: 'POST' });
}

export function getPlayerProfile() {
  return request('/player/profile');
}

export function updatePlayerName(displayName: string) {
  return request('/player/profile', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export function getMissionBoard() {
  return request('/game/offers');
}

export function getMissionDetail(templateId: string) {
  return request<GameState>(`/game/history/${encodeURIComponent(templateId)}`).then(hydrateSeedAssetUrls);
}

export function acceptMission(templateId: string) {
  return request('/game/accept', {
    method: 'POST',
    body: JSON.stringify({ templateId }),
  });
}

export function abandonMission() {
  return request('/game/abandon', { method: 'POST' });
}

export function resetGame() {
  return request('/game/reset', { method: 'POST' });
}

export function getGameState() {
  return request<GameState>('/game/state').then(hydrateSeedAssetUrls);
}

export function travel(cityId: string) {
  return request('/game/travel', {
    method: 'POST',
    body: JSON.stringify({ cityId }),
  });
}

export function recordClue(clueId: string) {
  return request('/game/clue', {
    method: 'POST',
    body: JSON.stringify({ clueId }),
  });
}

export function arrest(suspectId: string) {
  return request('/game/arrest', {
    method: 'POST',
    body: JSON.stringify({ suspectId }),
  });
}

export function getWitnessConfig(witnessId: string) {
  return request(`/game/witness/${witnessId}`);
}

export interface WitnessVoiceConfig {
  agentId: string;
  signedUrl: string | null;
  characterName: string;
  characterRole: 'witness';
  dynamicVariables?: Record<string, string>;
}

export interface HandlerVoiceConfig {
  agentId: string;
  signedUrl: string | null;
  characterName: string;
  characterRole: 'handler';
  systemPrompt?: string;
  dynamicVariables?: Record<string, string>;
}

export function getWitnessVoiceConfig(witnessId: string): Promise<WitnessVoiceConfig> {
  return request<WitnessVoiceConfig>(`/game/witness/${witnessId}/voice-config`);
}

export function getHandlerConfig(): Promise<HandlerVoiceConfig> {
  return request<HandlerVoiceConfig>('/game/handler-config');
}

export function getFailedHandlerConfig(): Promise<HandlerVoiceConfig> {
  return request<HandlerVoiceConfig>('/game/handler-config/failure');
}

export function getVictoryHandlerConfig(): Promise<HandlerVoiceConfig> {
  return request<HandlerVoiceConfig>('/game/handler-config/victory');
}

export function getBoardHandlerConfig() {
  return request('/game/handler-config/board');
}

export function saveHandlerCallMemory(transcript: Array<{ role: 'agent' | 'user'; text: string }>) {
  return request('/game/handler-memory', {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  });
}

export function saveWitnessCallMemory(witnessId: string, transcript: Array<{ role: 'agent' | 'user'; text: string }>) {
  return request(`/game/witness/${witnessId}/memory`, {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  });
}

export function createMissionNote(input: {
  content: string;
  contextType?: 'general' | 'city' | 'witness' | 'clue';
  contextId?: string | null;
}) {
  return request<{ ok: boolean; entry: import('../types').MissionNoteEntry }>('/game/notes', {
    method: 'POST',
    body: JSON.stringify({
      content: input.content,
      contextType: input.contextType ?? 'general',
      contextId: input.contextId ?? null,
    }),
  });
}

export function updateMissionNote(id: string, content: string) {
  return request<{ ok: boolean; entry: import('../types').MissionNoteEntry }>(`/game/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function deleteMissionNote(id: string) {
  return request<{ ok: boolean }>(`/game/notes/${id}`, {
    method: 'DELETE',
  });
}
