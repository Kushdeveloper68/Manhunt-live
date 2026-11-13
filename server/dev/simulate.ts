/**
 * MANHUNT LIVE - Dev simulator (testing only).
 *
 * Creates fake players that join YOUR lobby by code, get ready, and then walk around once the
 * match starts, so you can test a full game alone with just one phone.
 *
 *   npm run simulate -- --code ABC123 --count 3
 *   npm run simulate -- --code ABC123 --count 2 --center 23.0225,72.5714 --sos-after 30
 *
 * Options
 *   --code        lobby code (required)
 *   --count       number of bots (default 2)
 *   --api         server URL (default http://localhost:4000)
 *   --center      "lat,lon" where bots stand/wander (default: the zone centre of the game)
 *   --spread      max distance from centre in metres (default 25: close enough to be tagged)
 *   --sos-after   seconds after match start before bot #1 presses SOS (tests the host SOS banner)
 *   --prefix      username prefix (default "simbot")
 *
 * Bots print what matters for testing:
 *   - the 4-digit TAG CODE of every bot that is a runner (type it on your phone to tag it)
 *   - live positions they receive from teammates (use a bot on YOUR team to verify that your
 *     phone keeps sending GPS with the screen locked)
 */
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@manhunt/shared';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const API = (arg('api', 'http://localhost:4000') as string).replace(/\/$/, '');
const CODE = (arg('code') ?? '').toUpperCase();
const COUNT = Math.min(Math.max(parseInt(arg('count', '2') as string, 10) || 2, 1), 10);
const PREFIX = (arg('prefix', 'simbot') as string).toLowerCase();
const SPREAD_M = parseFloat(arg('spread', '25') as string);
const SOS_AFTER = arg('sos-after') ? parseInt(arg('sos-after') as string, 10) : null;
const CENTER_ARG = arg('center');

if (!CODE) {
  console.error('Usage: npm run simulate -- --code ABC123 [--count 3] [--center lat,lon] [--sos-after 30]');
  process.exit(1);
}

type Coord = { latitude: number; longitude: number };
const M_PER_DEG = 111_320;

function offset(c: Coord, dxMeters: number, dyMeters: number): Coord {
  return {
    latitude: c.latitude + dyMeters / M_PER_DEG,
    longitude: c.longitude + dxMeters / (M_PER_DEG * Math.cos((c.latitude * Math.PI) / 180)),
  };
}
function metersBetween(a: Coord, b: Coord): number {
  const dy = (a.latitude - b.latitude) * M_PER_DEG;
  const dx = (a.longitude - b.longitude) * M_PER_DEG * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

async function authenticate(username: string): Promise<{ token: string; userId: string }> {
  const email = `${username}@sim.local`;
  const password = 'simulate123';
  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${API}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as any };
  };
  let r = await post('/auth/register', { email, password, username });
  if (!r.ok) r = await post('/auth/login', { email, password }); // already registered on a previous run
  if (!r.ok) throw new Error(`auth failed for ${username}: ${r.status} ${r.data?.error ?? ''}`);
  return { token: r.data.token, userId: r.data.user.id };
}

function startBot(index: number): void {
  const username = `${PREFIX}${index}`;
  let socket: Socket;
  let userId = '';
  let gameId = '';
  let status = 'lobby';
  let myRole = 'UNASSIGNED';
  let zone: { center: Coord; radius: number } | null = null;
  let home: Coord | null = null;
  let pos: Coord | null = null;
  let heading = Math.random() * 2 * Math.PI;
  let matchStartedAt = 0;
  let sosSent = false;
  let announcedCode = '';
  const lastSeen = new Map<string, number>();

  const log = (msg: string) => console.log(`[${username}] ${msg}`);

  const readState = (s: any) => {
    if (!s) return;
    gameId = s.gameId ?? gameId;
    status = s.status ?? status;
    if (s.currentZone) zone = s.currentZone;
    else if (s.settings?.zone) zone = s.settings.zone;
    const me = s.players?.find((p: any) => p.userId === userId);
    if (me) {
      if (me.role !== myRole) {
        myRole = me.role;
        log(`role is now ${myRole}`);
      }
      if (me.tagCode && me.tagCode !== announcedCode) {
        announcedCode = me.tagCode;
        log(`*** TAG CODE: ${me.tagCode} *** (type this on your chaser phone to tag me)`);
      }
    }
  };

  (async () => {
    const auth = await authenticate(username);
    userId = auth.userId;
    socket = io(API, { auth: { token: auth.token }, transports: ['websocket'] });

    socket.on('connect', () => {
      log('connected, joining lobby ' + CODE);
      socket.emit(SOCKET_EVENTS.GAME_JOIN, { code: CODE });
    });
    socket.on(SOCKET_EVENTS.ERROR, (e: any) => log(`server error: ${e?.message}`));

    socket.on(SOCKET_EVENTS.LOBBY_UPDATE, (s: any) => {
      readState(s);
      const me = s?.players?.find((p: any) => p.userId === userId);
      if (me && !me.ready) socket.emit(SOCKET_EVENTS.PLAYER_READY, { gameId, ready: true });
    });
    socket.on(SOCKET_EVENTS.GAME_STATE, readState);
    socket.on(SOCKET_EVENTS.GAME_START, () => {
      status = 'countdown';
      matchStartedAt = Date.now();
      log('match is starting');
    });
    socket.on(SOCKET_EVENTS.ZONE_UPDATE, (d: any) => d?.zone && (zone = d.zone));
    socket.on(SOCKET_EVENTS.GAME_END, (d: any) => log(`GAME OVER: ${d?.winningRole} win (${d?.reason})`));
    socket.on(SOCKET_EVENTS.GAME_CANCELLED, (d: any) => log(`match cancelled: ${d?.reason}`));
    socket.on(SOCKET_EVENTS.PLAYER_KICKED, () => log('kicked from lobby'));
    socket.on(SOCKET_EVENTS.PLAYER_ELIMINATED, (d: any) => d?.userId === userId && log('I was eliminated'));
    socket.on(SOCKET_EVENTS.TAG_ATTEMPT, (d: any) => {
      log(`@${d?.chaserUsername} tagged me (${d?.distanceMeters} m). Confirming in 5s...`);
      setTimeout(() => socket.emit(SOCKET_EVENTS.TAG_CONFIRM, { gameId, attemptId: d?.attemptId }), 5000);
    });
    socket.on(SOCKET_EVENTS.REVEAL_TICK, (d: any) => log(`reveal tick: ${d?.snapshots?.length ?? 0} runner position(s)`));
    // Teammates' live positions: proves your phone keeps sending GPS (even with the screen locked)
    socket.on(SOCKET_EVENTS.LOCATION_UPDATE, (loc: any) => {
      if (!loc || loc.userId === userId) return;
      const now = Date.now();
      const gap = lastSeen.has(loc.userId) ? ((now - lastSeen.get(loc.userId)!) / 1000).toFixed(1) : 'first';
      lastSeen.set(loc.userId, now);
      log(`teammate @${loc.username} at ${loc.coordinates.latitude.toFixed(5)}, ${loc.coordinates.longitude.toFixed(5)} (+${gap}s)`);
    });

    // Walk loop
    setInterval(() => {
      if (status === 'lobby' || status === 'ended' || !gameId) return;
      if (!home) {
        const centre = CENTER_ARG
          ? (() => {
              const [la, lo] = CENTER_ARG.split(',').map(Number);
              return { latitude: la, longitude: lo };
            })()
          : zone?.center;
        if (!centre) return;
        home = offset(centre, (Math.random() - 0.5) * SPREAD_M, (Math.random() - 0.5) * SPREAD_M);
        pos = home;
      }
      // gentle random walk (about 1.2 m/s), kept within SPREAD_M of home
      heading += (Math.random() - 0.5) * 1.2;
      let next = offset(pos!, Math.cos(heading) * 2.4, Math.sin(heading) * 2.4);
      if (metersBetween(next, home) > SPREAD_M) {
        heading += Math.PI;
        next = offset(pos!, Math.cos(heading) * 2.4, Math.sin(heading) * 2.4);
      }
      pos = next;
      socket.emit(SOCKET_EVENTS.LOCATION_UPDATE, {
        gameId,
        coordinates: pos,
        accuracy: 5,
        speed: 1.2,
        heading: (heading * 180) / Math.PI,
        timestamp: Date.now(),
      });

      if (SOS_AFTER !== null && index === 1 && !sosSent && matchStartedAt && Date.now() - matchStartedAt > SOS_AFTER * 1000) {
        sosSent = true;
        log('pressing SOS now (check the host banner on your phone)');
        socket.emit(SOCKET_EVENTS.SOS_TRIGGER, { gameId, coordinates: pos, reason: 'simulated SOS' });
      }
    }, 2000);
  })().catch((err) => log(`failed: ${err instanceof Error ? err.message : err}`));
}

console.log(`Starting ${COUNT} bot(s) for lobby ${CODE} against ${API}`);
for (let i = 1; i <= COUNT; i++) startBot(i);
