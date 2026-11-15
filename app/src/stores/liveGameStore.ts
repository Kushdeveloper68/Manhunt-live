import { create } from 'zustand';
import { Vibration } from 'react-native';
import { useStatusStore } from './statusStore';
import {
  GameStateSync,
  LivePlayerLocation,
  PlayerRole,
  RunnerSnapshot,
  ZoneSettings,
  GamePlayer,
  MatchSummary,
  NoGoZone,
  SOCKET_EVENTS,
} from '@manhunt/shared';
import { getSocket, isSocketConnected } from '../services/socket';

interface LiveGameStateProps {
  gameId: string | null;
  code: string | null;
  name: string | null;
  myRole: PlayerRole;
  status: 'lobby' | 'countdown' | 'running' | 'ended';
  startedAt?: number;
  headStartEndsAt?: number;
  countdownRemainingMs: number;
  durationMin: number;
  currentZone: ZoneSettings | null;
  nextRevealTimestamp?: number;
  nextShrinkTimestamp?: number;
  myLocation: { latitude: number; longitude: number } | null;
  /** GPS accuracy of the last fix, in metres */
  myAccuracy: number | null;
  mySpeed: number;
  myHeading: number;
  teammateLocations: LivePlayerLocation[];
  runnerSnapshots: RunnerSnapshot[];
  /** BOTH_WAYS only: last revealed chaser positions, shown to runners */
  chaserSnapshots: RunnerSnapshot[];
  noGoZones: NoGoZone[];
  /** how often reveals happen (for the countdown progress bar) */
  revealIntervalMin: number;
  /** server clock minus this phone's clock, so countdowns match the server even if the phone clock is off */
  clockOffsetMs: number;
  /** "zone shrinks in N s": set 60 s before a shrink, cleared when the zone actually changes */
  shrinkWarning: { stage: number; shrinksAtLocal: number; nextZone: ZoneSettings } | null;
  players: GamePlayer[];
  zoneViolation: {
    distanceOutsideMeters: number;
    penalty: string;
    reason?: string;
    zoneName?: string;
    secondsInBreach?: number;
    countdownSec?: number;
    action?: string;
    message?: string;
    receivedAt: number;
  } | null;
  matchEnd: { winnerRole: string; reason: string; summary?: MatchSummary } | null;
  /** Host only: players whose SOS is currently active */
  incomingSos: Record<string, { userId: string; username: string; coordinates: { latitude: number; longitude: number } | null; timestamp: number }>;
  exposedAlert: boolean;
  compassHeading: number;
  pendingTagAttempt: {
    attemptId: string;
    gameId: string;
    chaserUserId: string;
    chaserUsername: string;
    distanceMeters: number;
    expiresAt: number;
  } | null;
  eliminatedData: {
    taggedBy: string;
    taggedAt: number;
  } | null;

  initGame: (initialState: GameStateSync, currentUserId: string) => void;
  updateLocation: (coords: { latitude: number; longitude: number }, speed?: number, heading?: number, isMock?: boolean, accuracy?: number) => void;
  dismissExposedAlert: () => void;
  clearPendingTagAttempt: () => void;
  resetGame: () => void;
}

export const useLiveGameStore = create<LiveGameStateProps>((set, get) => ({
  gameId: null,
  code: null,
  name: null,
  myRole: 'UNASSIGNED',
  status: 'lobby',
  startedAt: undefined,
  headStartEndsAt: undefined,
  countdownRemainingMs: 0,
  durationMin: 60,
  currentZone: null,
  nextRevealTimestamp: undefined,
  nextShrinkTimestamp: undefined,
  myLocation: null,
  myAccuracy: null,
  mySpeed: 0,
  myHeading: 0,
  teammateLocations: [],
  runnerSnapshots: [],
  chaserSnapshots: [],
  noGoZones: [],
  revealIntervalMin: 2,
  clockOffsetMs: 0,
  shrinkWarning: null,
  players: [],
  zoneViolation: null,
  matchEnd: null,
      incomingSos: {},
  exposedAlert: false,
  compassHeading: 12,
  pendingTagAttempt: null,
  eliminatedData: null,

  initGame: (initialState: GameStateSync, currentUserId: string) => {
    const myPlayer = initialState.players.find((p) => p.userId === currentUserId);
    const myRole = myPlayer?.role || 'UNASSIGNED';

    set({
      gameId: initialState.gameId,
      code: initialState.code,
      name: initialState.name,
      myRole,
      status: initialState.status,
      startedAt: initialState.startedAt,
      durationMin: initialState.settings.durationMin || 60,
      currentZone: initialState.currentZone || initialState.settings.zone,
      nextRevealTimestamp: initialState.nextRevealTimestamp,
      nextShrinkTimestamp: initialState.nextShrinkTimestamp,
      teammateLocations: initialState.teammateLocations || [],
      runnerSnapshots: initialState.runnerSnapshots || [],
      chaserSnapshots: initialState.chaserSnapshots || [],
      noGoZones: initialState.settings.noGoZones || [],
      revealIntervalMin: initialState.settings.revealIntervalMin || 2,
      clockOffsetMs: initialState.serverTime ? initialState.serverTime - Date.now() : 0,
      shrinkWarning: null,
      players: initialState.players || [],
      matchEnd: initialState.matchResult
        ? { winnerRole: initialState.matchResult.winningRole, reason: initialState.matchResult.reason, summary: initialState.matchResult.summary }
        : null,
      incomingSos: {},
    });

    if (isSocketConnected()) {
      const socket = getSocket();

      // Listen for countdown ticks
      socket.off(SOCKET_EVENTS.COUNTDOWN_TICK);
      socket.on(SOCKET_EVENTS.COUNTDOWN_TICK, (data: { remainingMs: number; status: string }) => {
        set({
          countdownRemainingMs: data.remainingMs,
          status: data.status as any,
        });
      });

      // Listen for teammate location updates
      socket.off(SOCKET_EVENTS.LOCATION_UPDATE);
      socket.on(SOCKET_EVENTS.LOCATION_UPDATE, (loc: LivePlayerLocation) => {
        const currentTeammates = get().teammateLocations.filter((l) => l.userId !== loc.userId);
        set({ teammateLocations: [...currentTeammates, loc] });
      });

      // Listen for reveal tick pings (Chasers receive runner snapshots; runners get exposed alert)
      socket.off(SOCKET_EVENTS.REVEAL_TICK);
      socket.on(SOCKET_EVENTS.REVEAL_TICK, (data: { snapshots: RunnerSnapshot[]; chaserSnapshots?: RunnerSnapshot[]; nextRevealTimestamp: number }) => {
        const { myRole } = get();
        if (myRole === 'CHASER') {
          set({
            runnerSnapshots: data.snapshots,
            nextRevealTimestamp: data.nextRevealTimestamp,
          });
        } else if (myRole === 'RUNNER') {
          // Runners learn that THEY were revealed; positions only arrive in BOTH_WAYS mode
          set({
            exposedAlert: true,
            chaserSnapshots: data.chaserSnapshots ?? get().chaserSnapshots,
            nextRevealTimestamp: data.nextRevealTimestamp,
          });
        }
      });

      // Listen for zone shrinking & updates
      socket.off(SOCKET_EVENTS.ZONE_UPDATE);
      socket.on(SOCKET_EVENTS.ZONE_UPDATE, (data: { zone: ZoneSettings; nextShrinkTimestamp?: number }) => {
        set({ currentZone: data.zone, nextShrinkTimestamp: data.nextShrinkTimestamp, shrinkWarning: null });
      });

      socket.off(SOCKET_EVENTS.ZONE_SHRINK_WARNING);
      socket.on(SOCKET_EVENTS.ZONE_SHRINK_WARNING, (d: { stage: number; secondsLeft: number; nextZone: ZoneSettings }) => {
        Vibration.vibrate([0, 150, 100, 150]);
        set({ shrinkWarning: { stage: d.stage, shrinksAtLocal: Date.now() + d.secondsLeft * 1000, nextZone: d.nextZone } });
      });

      // Listen for zone violation alerts
      socket.off(SOCKET_EVENTS.ZONE_VIOLATION);
      socket.on(SOCKET_EVENTS.ZONE_VIOLATION, (data: { userId: string; inViolation?: boolean; distanceOutsideMeters: number; penalty: string; reason?: string; zoneName?: string; secondsInBreach?: number; countdownSec?: number; action?: string; message?: string }) => {
        if (data.userId !== currentUserId) return;
        if (data.inViolation === false) {
          set({ zoneViolation: null }); // back inside the zone
          return;
        }
        set({
          zoneViolation: {
            distanceOutsideMeters: data.distanceOutsideMeters,
            penalty: data.penalty,
            reason: data.reason,
            zoneName: data.zoneName,
            secondsInBreach: data.secondsInBreach,
            countdownSec: data.countdownSec,
            action: data.action,
            message: data.message,
            receivedAt: Date.now(),
          },
        });
      });

      // Listen for incoming TAG_ATTEMPT (for runner)
      socket.off(SOCKET_EVENTS.TAG_ATTEMPT);
      socket.on(SOCKET_EVENTS.TAG_ATTEMPT, (attempt: any) => {
        set({
          pendingTagAttempt: {
            attemptId: attempt.attemptId,
            gameId: attempt.gameId,
            chaserUserId: attempt.chaserUserId,
            chaserUsername: attempt.chaserUsername || 'UNKNOWN CHASER',
            distanceMeters: attempt.distanceMeters || 1,
            expiresAt: attempt.expiresAt || (Date.now() + 45000),
          },
        });
      });

      // Listen for TAG_DISPUTE
      socket.off(SOCKET_EVENTS.TAG_DISPUTE);
      socket.on(SOCKET_EVENTS.TAG_DISPUTE, () => {
        set({ pendingTagAttempt: null });
      });

      // Listen for PLAYER_TAGGED & PLAYER_ELIMINATED
      socket.off(SOCKET_EVENTS.PLAYER_ELIMINATED);
      socket.on(SOCKET_EVENTS.PLAYER_ELIMINATED, (data: { runnerUserId: string; runnerUsername: string; remainingRunners: number; eliminatedAt: number; cause?: string }) => {
        const updatedPlayers = get().players.map((p) =>
          p.userId === data.runnerUserId ? { ...p, status: 'ELIMINATED' as const } : p
        );
        const isMe = data.runnerUserId === currentUserId;
        set({
          players: updatedPlayers,
          pendingTagAttempt: isMe ? null : get().pendingTagAttempt,
          eliminatedData: isMe
            ? {
                taggedBy: data.cause === 'ZONE_BREACH' ? 'ZONE BREACH' : data.cause === 'LEFT_GAME' ? 'LEFT GAME' : 'CHASER',
                taggedAt: data.eliminatedAt || Date.now(),
              }
            : get().eliminatedData,
        });
      });

      // Listen for full game state sync
      socket.off(SOCKET_EVENTS.GAME_STATE);
      socket.on(SOCKET_EVENTS.GAME_STATE, (sync: GameStateSync) => {
        const me = sync.players.find((p) => p.userId === currentUserId);
        set({
          players: sync.players,
          teammateLocations: sync.teammateLocations,
          runnerSnapshots: sync.runnerSnapshots,
          chaserSnapshots: sync.chaserSnapshots ?? [],
          clockOffsetMs: sync.serverTime ? sync.serverTime - Date.now() : get().clockOffsetMs,
          currentZone: sync.currentZone,
          status: sync.status,
          nextRevealTimestamp: sync.nextRevealTimestamp,
          nextShrinkTimestamp: sync.nextShrinkTimestamp,
          eliminatedData: me?.status === 'ELIMINATED' && me.taggedBy
            ? { taggedBy: me.taggedBy, taggedAt: me.taggedAt || Date.now() }
            : get().eliminatedData,
        });
      });

      // Listen for game end
      socket.off(SOCKET_EVENTS.GAME_END);
      socket.on(SOCKET_EVENTS.GAME_END, (data: { winningRole: string; reason: string; summary?: MatchSummary }) => {
        set({
          status: 'ended',
          matchEnd: { winnerRole: data.winningRole, reason: data.reason, summary: data.summary },
        });
      });

      // Host cancelled the match
      socket.off(SOCKET_EVENTS.GAME_CANCELLED);
      socket.on(SOCKET_EVENTS.GAME_CANCELLED, (d: { reason?: string }) => {
        useStatusStore.getState().setNotice('CANCELLED', d?.reason || 'The host cancelled the match.');
      });

      // SOS alerts (only the host receives these from the server)
      socket.off(SOCKET_EVENTS.SOS_TRIGGER);
      socket.on(SOCKET_EVENTS.SOS_TRIGGER, (d: { userId: string; username: string; coordinates: { latitude: number; longitude: number } | null; timestamp: number }) => {
        Vibration.vibrate([300, 200, 300, 200, 300]);
        set((st) => ({ incomingSos: { ...st.incomingSos, [d.userId]: d } }));
      });
      socket.off(SOCKET_EVENTS.SOS_LOCATION);
      socket.on(SOCKET_EVENTS.SOS_LOCATION, (d: { userId: string; coordinates: { latitude: number; longitude: number }; timestamp: number }) => {
        set((st) => {
          const prev = st.incomingSos[d.userId];
          if (!prev) return st;
          return { incomingSos: { ...st.incomingSos, [d.userId]: { ...prev, coordinates: d.coordinates, timestamp: d.timestamp } } };
        });
      });
      socket.off(SOCKET_EVENTS.SOS_RESOLVED);
      socket.on(SOCKET_EVENTS.SOS_RESOLVED, (d: { userId: string }) => {
        set((st) => {
          const { [d.userId]: _removed, ...rest } = st.incomingSos;
          return { incomingSos: rest };
        });
      });
    }
  },

  updateLocation: (coords, speed = 0, heading = 0, isMock = false, accuracy) => {
    set({
      myLocation: coords,
      myAccuracy: accuracy ?? null,
      mySpeed: speed,
      myHeading: heading,
      compassHeading: heading || 12,
    });

    const { gameId } = get();
    if (gameId && isSocketConnected()) {
      getSocket().emit(SOCKET_EVENTS.LOCATION_UPDATE, {
        gameId,
        coordinates: coords,
        speed,
        heading,
        isMock,
        accuracy,
        timestamp: Date.now(),
      });
    }
  },

  dismissExposedAlert: () => set({ exposedAlert: false }),
  clearPendingTagAttempt: () => set({ pendingTagAttempt: null }),

  resetGame: () =>
    set({
      chaserSnapshots: [],
      noGoZones: [],
      shrinkWarning: null,
      clockOffsetMs: 0,
      gameId: null,
      code: null,
      name: null,
      myRole: 'UNASSIGNED',
      status: 'lobby',
      startedAt: undefined,
      headStartEndsAt: undefined,
      countdownRemainingMs: 0,
      currentZone: null,
      nextRevealTimestamp: undefined,
      nextShrinkTimestamp: undefined,
      myLocation: null,
      teammateLocations: [],
      runnerSnapshots: [],
      players: [],
      zoneViolation: null,
      matchEnd: null,
      incomingSos: {},
      exposedAlert: false,
      pendingTagAttempt: null,
      eliminatedData: null,
    }),
}));

/** The server's idea of "now" (ms), so countdowns are right even if this phone's clock is wrong. */
export function serverNow(): number {
  return Date.now() + useLiveGameStore.getState().clockOffsetMs;
}
