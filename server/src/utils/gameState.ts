import { GamePlayer, GameStateSync } from '@manhunt/shared';
import { IGame } from '../models/Game.js';

export function formatGameState(game: IGame): GameStateSync {
  const hostIdAny = game.hostId as any;
  const hostIdStr = hostIdAny && typeof hostIdAny === 'object' && '_id' in hostIdAny
    ? hostIdAny._id.toString()
    : String(game.hostId);

  const formattedPlayers: GamePlayer[] = (game.players || []).map((p) => {
    const userObj = p.userId as any;
    const isPopulated = userObj && typeof userObj === 'object' && userObj.username;
    const uid = isPopulated ? userObj._id.toString() : userObj.toString();
    const uname = isPopulated ? userObj.username : 'OPERATIVE';
    const avatar = isPopulated ? userObj.avatarId : 'wolf';

    return {
      userId: uid,
      username: uname,
      avatarId: avatar,
      role: p.role,
      status: p.status,
      ready: p.ready,
      isHost: uid === hostIdStr,
    };
  });

  return {
    gameId: game._id.toString(),
    code: game.code,
    name: game.name,
    hostId: hostIdStr,
    status: game.status,
    settings: game.settings,
    players: formattedPlayers,
    startedAt: game.startedAt ? new Date(game.startedAt).getTime() : undefined,
    endedAt: game.endedAt ? new Date(game.endedAt).getTime() : undefined,
    serverTime: Date.now(),
    currentZone: game.settings.zone,
    teammateLocations: [],
    runnerSnapshots: [],
  };
}
