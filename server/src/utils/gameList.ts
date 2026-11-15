import type { GameListItem } from '@manhunt/shared';

const idOf = (v: any): string => String(v?._id ?? v);

/** Turns a Game document into the small item the home screen lists, from MY point of view. */
export function toGameListItem(game: any, userId: string): GameListItem {
  const me = (game.players ?? []).find((p: any) => idOf(p.userId) === userId);
  const role = me?.role ?? 'UNASSIGNED';
  const status = game.status as GameListItem['status'];
  const winningRole = game.result?.winningRole;
  const cancelled = status === 'ended' && !winningRole;
  const mine = game.result?.summary?.players?.find((p: any) => p.userId === userId);

  const started = game.startedAt ? new Date(game.startedAt).getTime() : undefined;
  const ended = game.endedAt ? new Date(game.endedAt).getTime() : undefined;

  return {
    id: idOf(game),
    code: game.code,
    name: game.name,
    status,
    hostUsername: game.hostId?.username ?? '',
    role,
    playerCount: (game.players ?? []).length,
    createdAt: new Date(game.createdAt).toISOString(),
    startedAt: started ? new Date(started).toISOString() : undefined,
    endedAt: ended ? new Date(ended).toISOString() : undefined,
    durationMin: started && ended ? Math.max(0, Math.round((ended - started) / 60000)) : undefined,
    cancelled,
    won: status !== 'ended' || cancelled ? null : winningRole === role,
    stats: mine ? { tags: mine.tags ?? 0, distanceKm: mine.distanceKm ?? 0, survived: !!mine.survived } : undefined,
  };
}
