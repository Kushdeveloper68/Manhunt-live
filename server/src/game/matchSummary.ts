/**
 * MANHUNT LIVE - Pure match summary + stat maths (no DB, no sockets).
 */

import type { MatchPlayerSummary, MatchSummary } from '@manhunt/shared';
export type { MatchPlayerSummary, MatchSummary };

export interface StatDelta {
  games: number;
  wins: number;
  tags: number;
  escapes: number;
  kmRun: number;
}

interface SummarySource {
  players: { userId: string; username: string; role: string; status: string; taggedBy?: string }[];
  distanceMeters?: Map<string, number>;
  startedAt?: number;
  endedAt?: number;
}

export function buildMatchSummary(
  state: SummarySource,
  winningRole: 'CHASER' | 'RUNNER'
): MatchSummary {
  const players: MatchPlayerSummary[] = state.players
    .filter((p) => p.role === 'CHASER' || p.role === 'RUNNER')
    .map((p) => {
      const tags =
        p.role === 'CHASER'
          ? state.players.filter((o) => o.role === 'RUNNER' && o.taggedBy === p.username).length
          : 0;
      const survived = p.status === 'ACTIVE';
      const distanceKm = Math.round(((state.distanceMeters?.get(p.userId) ?? 0) / 1000) * 100) / 100;
      const score = Math.round(tags * 100 + (p.role === 'RUNNER' && survived ? 150 : 0) + distanceKm * 10);
      return { userId: p.userId, username: p.username, role: p.role, survived, tags, distanceKm, score };
    });

  const best = [...players].sort((a, b) => b.score - a.score)[0];
  const durationMin =
    state.startedAt !== undefined && state.endedAt !== undefined ? Math.max(0, Math.round((state.endedAt - state.startedAt) / 60000)) : 0;

  return { winningRole, durationMin, players, mvpUserId: best && best.score > 0 ? best.userId : undefined };
}

/** What one finished match adds to each player's lifetime stats. */
export function computeStatDeltas(summary: MatchSummary): Map<string, StatDelta> {
  const out = new Map<string, StatDelta>();
  for (const p of summary.players) {
    out.set(p.userId, {
      games: 1,
      wins: p.role === summary.winningRole ? 1 : 0,
      tags: p.tags,
      escapes: p.role === 'RUNNER' && p.survived ? 1 : 0,
      kmRun: p.distanceKm,
    });
  }
  return out;
}

/** Counts a movement step toward distance only if it looks like real, plausible walking/running. */
export function plausibleStepMeters(
  stepMeters: number,
  elapsedMs: number,
  isMock: boolean | undefined,
  accuracy: number | undefined
): number {
  if (isMock) return 0;
  if (accuracy !== undefined && accuracy > 50) return 0; // too noisy to trust
  if (stepMeters < 3) return 0; // GPS jitter while standing still
  const seconds = Math.max(elapsedMs, 1) / 1000;
  if (stepMeters / seconds > 12) return 0; // faster than ~43 km/h: vehicle or GPS jump
  return stepMeters;
}
