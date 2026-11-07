import { create } from 'zustand';
import {
  GameStateSync,
  LivePlayerLocation,
  PlayerRole,
  RunnerSnapshot,
  ZoneSettings,
  GamePlayer,
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
  mySpeed: number;
  myHeading: number;
  teammateLocations: LivePlayerLocation[];
  runnerSnapshots: RunnerSnapshot[];
  players: GamePlayer[];
  zoneViolation: { distanceOutsideMeters: number; penalty: string } | null;
  matchEnd: { winnerRole: string; reason: string } | null;
  exposedAlert: boolean;
  compassHeading: number;

  initGame: (initialState: GameStateSync, currentUserId: string) => void;
  updateLocation: (coords: { latitude: number; longitude: number }, speed?: number, heading?: number, isMock?: boolean) => void;
  dismissExposedAlert: () => void;
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
  mySpeed: 0,
  myHeading: 0,
  teammateLocations: [],
  runnerSnapshots: [],
  players: [],
  zoneViolation: null,
  matchEnd: null,
  exposedAlert: false,
  compassHeading: 12, // Default heading 12 deg

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
      players: initialState.players || [],
      matchEnd: null,
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
      socket.on(SOCKET_EVENTS.REVEAL_TICK, (data: { snapshots: RunnerSnapshot[]; nextRevealTimestamp: number }) => {
        const { myRole } = get();
        if (myRole === 'CHASER') {
          set({
            runnerSnapshots: data.snapshots,
            nextRevealTimestamp: data.nextRevealTimestamp,
          });
        } else if (myRole === 'RUNNER') {
          set({
            exposedAlert: true,
            nextRevealTimestamp: data.nextRevealTimestamp,
          });
        }
      });

      // Listen for zone shrinking & updates
      socket.off(SOCKET_EVENTS.ZONE_UPDATE);
      socket.on(SOCKET_EVENTS.ZONE_UPDATE, (data: { zone: ZoneSettings }) => {
        set({ currentZone: data.zone });
      });

      // Listen for zone violation alerts
      socket.off(SOCKET_EVENTS.ZONE_VIOLATION);
      socket.on(SOCKET_EVENTS.ZONE_VIOLATION, (data: { userId: string; distanceOutsideMeters: number; penalty: string }) => {
        if (data.userId === currentUserId) {
          set({ zoneViolation: { distanceOutsideMeters: data.distanceOutsideMeters, penalty: data.penalty } });
        }
      });

      // Listen for game end
      socket.off(SOCKET_EVENTS.GAME_END);
      socket.on(SOCKET_EVENTS.GAME_END, (data: { winningRole: string; reason: string }) => {
        set({
          status: 'ended',
          matchEnd: { winnerRole: data.winningRole, reason: data.reason },
        });
      });
    }
  },

  updateLocation: (coords, speed = 0, heading = 0, isMock = false) => {
    set({
      myLocation: coords,
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
        timestamp: Date.now(),
      });
    }
  },

  dismissExposedAlert: () => set({ exposedAlert: false }),

  resetGame: () =>
    set({
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
      exposedAlert: false,
    }),
}));
