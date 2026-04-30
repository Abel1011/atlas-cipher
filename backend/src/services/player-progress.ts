import db from '../db';
import type { PlayerProgress } from '../types';

const LEVEL_THRESHOLDS = [0, 2, 5, 9, 14];

interface PlayerProgressRow {
  user_id: string;
  display_name: string | null;
  level: number;
  experience: number;
  solved_cases: number;
  failed_cases: number;
  abandoned_cases: number;
}

function normalizeDifficulty(difficulty: number): number {
  return Math.max(1, Math.min(5, Math.round(difficulty || 1)));
}

function getLevelForExperience(experience: number): number {
  let level = 1;

  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (experience >= LEVEL_THRESHOLDS[index]!) {
      level = index + 1;
    }
  }

  return level;
}

function getNextLevelExperience(level: number): number | null {
  return LEVEL_THRESHOLDS[level] ?? null;
}

function ensurePlayerRow(userId: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO player_progress (user_id)
    VALUES (?)
  `).run(userId);
}

function mapPlayerProgress(row: PlayerProgressRow): PlayerProgress {
  return {
    displayName: row.display_name,
    level: row.level,
    experience: row.experience,
    solvedCases: row.solved_cases,
    failedCases: row.failed_cases,
    abandonedCases: row.abandoned_cases,
    nextLevelExperience: getNextLevelExperience(row.level),
  };
}

export function getPlayerProgress(userId: string): PlayerProgress {
  ensurePlayerRow(userId);

  const row = db.prepare(`
    SELECT user_id, display_name, level, experience, solved_cases, failed_cases, abandoned_cases
    FROM player_progress
    WHERE user_id = ?
  `).get(userId) as PlayerProgressRow | undefined;

  if (!row) {
    throw new Error(`Player progress could not be loaded for ${userId}`);
  }

  return mapPlayerProgress(row);
}

const MAX_DISPLAY_NAME_LENGTH = 32;

export function setPlayerDisplayName(userId: string, displayName: string | null): PlayerProgress {
  ensurePlayerRow(userId);

  const normalized = typeof displayName === 'string'
    ? displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH)
    : '';

  db.prepare(`
    UPDATE player_progress
    SET display_name = ?, updated_at = datetime('now')
    WHERE user_id = ?
  `).run(normalized.length > 0 ? normalized : null, userId);

  return getPlayerProgress(userId);
}

export function recordSolvedCase(userId: string, difficulty: number): PlayerProgress {
  const current = getPlayerProgress(userId);
  const experience = current.experience + normalizeDifficulty(difficulty);
  const level = getLevelForExperience(experience);

  db.prepare(`
    UPDATE player_progress
    SET
      level = ?,
      experience = ?,
      solved_cases = solved_cases + 1,
      updated_at = datetime('now')
    WHERE user_id = ?
  `).run(level, experience, userId);

  return getPlayerProgress(userId);
}

export function recordFailedCase(userId: string): PlayerProgress {
  getPlayerProgress(userId);

  db.prepare(`
    UPDATE player_progress
    SET
      failed_cases = failed_cases + 1,
      updated_at = datetime('now')
    WHERE user_id = ?
  `).run(userId);

  return getPlayerProgress(userId);
}

export function recordAbandonedCase(userId: string): PlayerProgress {
  getPlayerProgress(userId);

  db.prepare(`
    UPDATE player_progress
    SET
      abandoned_cases = abandoned_cases + 1,
      updated_at = datetime('now')
    WHERE user_id = ?
  `).run(userId);

  return getPlayerProgress(userId);
}