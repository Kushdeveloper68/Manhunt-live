export type PlayerRole = 'CHASER' | 'RUNNER' | 'UNASSIGNED';
export type PlayerStatus = 'ACTIVE' | 'TAGGED' | 'ELIMINATED' | 'DISCONNECTED';
export type GameStatus = 'lobby' | 'countdown' | 'running' | 'ended';
export type TagMethod = 'CODE' | 'QR';
export type OutOfZonePenalty = 'WARNING' | 'REVEAL' | 'ELIMINATE';
export type TeamVisibility = 'TEAMMATES_ONLY' | 'ALL_PLAYERS';
export type RevealMode = 'RUNNERS_TO_CHASERS' | 'BOTH_WAYS';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ZoneSettings {
  center: Coordinates;
  radius: number; // in meters (500m - 10000m)
}

export interface NoGoZone {
  id: string;
  name: string;
  polygon: Coordinates[];
}

export interface ZoneShrinkSettings {
  startAfterMin: number;
  percent: number; // e.g. 20%
  count: number; // number of shrink stages
}

export interface GameSettings {
  zone: ZoneSettings;
  noGoZones: NoGoZone[];
  durationMin: number;
  headStartMin: number;
  revealIntervalMin: number;
  revealMode: RevealMode;
  zoneShrink: ZoneShrinkSettings;
  tagMethod: TagMethod;
  outOfZonePenalty: OutOfZonePenalty;
  teamVisibility: TeamVisibility;
}

export interface GamePlayer {
  userId: string;
  username: string;
  avatarId?: string;
  role: PlayerRole;
  status: PlayerStatus;
  ready: boolean;
  isHost?: boolean;
}

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface UserStats {
  games: number;
  wins: number;
  tags: number;
  escapes: number;
  kmRun: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  googleId?: string;
  avatarId?: string;
  dob?: string;
  emergencyContact?: EmergencyContact;
  stats: UserStats;
  fcmToken?: string;
  createdAt: string;
}

export interface LivePlayerLocation {
  userId: string;
  username: string;
  role: PlayerRole;
  coordinates: Coordinates;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: number;
  isMock?: boolean;
}

export interface RunnerSnapshot {
  userId: string;
  username: string;
  coordinates: Coordinates;
  timestamp: number; // server timestamp when revealed
}

export interface GameStateSync {
  gameId: string;
  code: string;
  name: string;
  hostId: string;
  status: GameStatus;
  settings: GameSettings;
  players: GamePlayer[];
  startedAt?: number;
  endedAt?: number;
  serverTime: number;
  currentZone: ZoneSettings;
  nextRevealTimestamp?: number;
  nextShrinkTimestamp?: number;
  teammateLocations: LivePlayerLocation[];
  runnerSnapshots: RunnerSnapshot[]; // revealed pings for chasers
}
