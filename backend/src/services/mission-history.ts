import db from '../db';
import type { MissionOfferStatus } from '../types';

export interface MissionSnapshot {
  templateId: string;
  caseId: string;
  status: MissionOfferStatus;
  currentCityId: string | null;
  remainingHours: number;
  totalHours: number;
  remainingCredits: number;
  totalCredits: number;
  supportCallsRemaining: number;
  cityVisitToken: number;
  updatedAt?: string;
}

export function listPlayerMissionStatuses(userId: string): Record<string, MissionOfferStatus> {
  const rows = db.prepare(`
    SELECT template_id, status
    FROM player_mission_history
    WHERE user_id = ?
  `).all(userId) as Array<{ template_id: string; status: MissionOfferStatus }>;

  return Object.fromEntries(
    rows
      .filter(row => typeof row.template_id === 'string' && typeof row.status === 'string')
      .map(row => [row.template_id, row.status])
  );
}

export function recordMissionStatus(userId: string, templateId: string | null | undefined, status: MissionOfferStatus): void {
  const normalizedTemplateId = typeof templateId === 'string' ? templateId.trim() : '';
  if (!normalizedTemplateId) return;

  db.prepare(`
    INSERT INTO player_mission_history (user_id, template_id, status, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, template_id)
    DO UPDATE SET
      status = excluded.status,
      updated_at = datetime('now')
  `).run(userId, normalizedTemplateId, status);
}

export function listPlayerMissionSnapshots(userId: string): Record<string, MissionSnapshot> {
  const rows = db.prepare(`
    SELECT
      template_id,
      case_id,
      status,
      current_city_id,
      remaining_hours,
      total_hours,
      remaining_credits,
      total_credits,
      support_calls_remaining,
      city_visit_token,
      updated_at
    FROM player_mission_snapshots
    WHERE user_id = ?
  `).all(userId) as Array<{
    template_id: string;
    case_id: string;
    status: MissionOfferStatus;
    current_city_id: string | null;
    remaining_hours: number;
    total_hours: number;
    remaining_credits: number;
    total_credits: number;
    support_calls_remaining: number;
    city_visit_token: number;
    updated_at: string;
  }>;

  return Object.fromEntries(
    rows
      .filter(row => typeof row.template_id === 'string' && typeof row.case_id === 'string' && typeof row.status === 'string')
      .map(row => [row.template_id, {
        templateId: row.template_id,
        caseId: row.case_id,
        status: row.status,
        currentCityId: row.current_city_id,
        remainingHours: Math.max(0, Number(row.remaining_hours || 0)),
        totalHours: Math.max(0, Number(row.total_hours || 0)),
        remainingCredits: Math.max(0, Number(row.remaining_credits || 0)),
        totalCredits: Math.max(0, Number(row.total_credits || 0)),
        supportCallsRemaining: Math.max(0, Number(row.support_calls_remaining || 0)),
        cityVisitToken: Math.max(1, Number(row.city_visit_token || 1)),
        updatedAt: row.updated_at,
      } satisfies MissionSnapshot])
  );
}

export function getPlayerMissionSnapshot(userId: string, templateId: string): MissionSnapshot | null {
  const normalizedTemplateId = templateId.trim();
  if (!normalizedTemplateId) return null;

  const row = db.prepare(`
    SELECT
      template_id,
      case_id,
      status,
      current_city_id,
      remaining_hours,
      total_hours,
      remaining_credits,
      total_credits,
      support_calls_remaining,
      city_visit_token,
      updated_at
    FROM player_mission_snapshots
    WHERE user_id = ? AND template_id = ?
  `).get(userId, normalizedTemplateId) as {
    template_id: string;
    case_id: string;
    status: MissionOfferStatus;
    current_city_id: string | null;
    remaining_hours: number;
    total_hours: number;
    remaining_credits: number;
    total_credits: number;
    support_calls_remaining: number;
    city_visit_token: number;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    templateId: row.template_id,
    caseId: row.case_id,
    status: row.status,
    currentCityId: row.current_city_id,
    remainingHours: Math.max(0, Number(row.remaining_hours || 0)),
    totalHours: Math.max(0, Number(row.total_hours || 0)),
    remainingCredits: Math.max(0, Number(row.remaining_credits || 0)),
    totalCredits: Math.max(0, Number(row.total_credits || 0)),
    supportCallsRemaining: Math.max(0, Number(row.support_calls_remaining || 0)),
    cityVisitToken: Math.max(1, Number(row.city_visit_token || 1)),
    updatedAt: row.updated_at,
  };
}

export function recordMissionSnapshot(userId: string, snapshot: MissionSnapshot): void {
  const normalizedTemplateId = snapshot.templateId.trim();
  const normalizedCaseId = snapshot.caseId.trim();
  if (!normalizedTemplateId || !normalizedCaseId) return;

  db.prepare(`
    INSERT INTO player_mission_snapshots (
      user_id,
      template_id,
      case_id,
      status,
      current_city_id,
      remaining_hours,
      total_hours,
      remaining_credits,
      total_credits,
      support_calls_remaining,
      city_visit_token,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, template_id)
    DO UPDATE SET
      case_id = excluded.case_id,
      status = excluded.status,
      current_city_id = excluded.current_city_id,
      remaining_hours = excluded.remaining_hours,
      total_hours = excluded.total_hours,
      remaining_credits = excluded.remaining_credits,
      total_credits = excluded.total_credits,
      support_calls_remaining = excluded.support_calls_remaining,
      city_visit_token = excluded.city_visit_token,
      updated_at = datetime('now')
  `).run(
    userId,
    normalizedTemplateId,
    normalizedCaseId,
    snapshot.status,
    snapshot.currentCityId,
    Math.max(0, snapshot.remainingHours),
    Math.max(0, snapshot.totalHours),
    Math.max(0, snapshot.remainingCredits),
    Math.max(0, snapshot.totalCredits),
    Math.max(0, snapshot.supportCallsRemaining),
    Math.max(1, snapshot.cityVisitToken),
  );
}