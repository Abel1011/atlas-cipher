// Client-side mirror of backend resource rules in backend/src/routes.ts.
// These are pure functions of difficulty, used to preview the operational
// envelope on the mission selection screen before a case is accepted.

export interface MissionEnvelope {
  startingHours: number;
  startingCredits: number;
  supportCalls: number;
}

export function getStartingHours(difficulty: number): number {
  return [72, 60, 48, 40, 32][Math.max(0, Math.min(4, difficulty - 1))] || 72;
}

export function getStartingCredits(difficulty: number): number {
  return [9, 8, 7, 6, 5][Math.max(0, Math.min(4, difficulty - 1))] || 9;
}

export function getSupportCalls(difficulty: number): number {
  return difficulty >= 5 ? 1 : difficulty >= 3 ? 2 : 3;
}

export function getMissionEnvelope(difficulty: number): MissionEnvelope {
  return {
    startingHours: getStartingHours(difficulty),
    startingCredits: getStartingCredits(difficulty),
    supportCalls: getSupportCalls(difficulty),
  };
}
