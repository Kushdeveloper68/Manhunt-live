import mongoose, { Document, Schema } from 'mongoose';
import {
  GameSettings,
  GameStatus,
  PlayerRole,
  PlayerStatus,
} from '@manhunt/shared';

export interface IGamePlayer {
  userId: mongoose.Types.ObjectId;
  role: PlayerRole;
  status: PlayerStatus;
  ready: boolean;
}

export interface IGame extends Document {
  code: string;
  hostId: mongoose.Types.ObjectId;
  name: string;
  mode: 'Classic Manhunt' | 'Last Runner Standing';
  settings: GameSettings;
  status: GameStatus;
  players: IGamePlayer[];
  startedAt?: Date;
  endedAt?: Date;
  result?: {
    winningRole: PlayerRole;
    reason: string;
    mvpUserId?: mongoose.Types.ObjectId;
    summary?: unknown;
  };
  /** Set once per game so player stats are applied exactly once. */
  statsApplied?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GamePlayerSchema = new Schema<IGamePlayer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['CHASER', 'RUNNER', 'UNASSIGNED'], default: 'UNASSIGNED' },
    status: {
      type: String,
      enum: ['ACTIVE', 'TAGGED', 'ELIMINATED', 'DISCONNECTED'],
      default: 'ACTIVE',
    },
    ready: { type: Boolean, default: false },
  },
  { _id: false }
);

const CoordinatesSchema = new Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { _id: false }
);

const NoGoZoneSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    polygon: [CoordinatesSchema],
  },
  { _id: false }
);

const GameSettingsSchema = new Schema<GameSettings>(
  {
    zone: {
      center: { type: CoordinatesSchema, required: true },
      radius: { type: Number, required: true, min: 500, max: 10000 },
    },
    noGoZones: [NoGoZoneSchema],
    durationMin: { type: Number, required: true, min: 5, max: 240, default: 60 },
    headStartMin: { type: Number, required: true, min: 1, max: 30, default: 3 },
    revealIntervalMin: { type: Number, required: true, min: 1, max: 15, default: 2 },
    revealMode: {
      type: String,
      enum: ['RUNNERS_TO_CHASERS', 'BOTH_WAYS'],
      default: 'RUNNERS_TO_CHASERS',
    },
    zoneShrink: {
      startAfterMin: { type: Number, default: 30 },
      percent: { type: Number, default: 25 },
      count: { type: Number, default: 3 },
      intervalMin: { type: Number },
    },
    tagMethod: { type: String, enum: ['CODE', 'QR'], default: 'CODE' },
    outOfZonePenalty: {
      type: String,
      enum: ['WARNING', 'REVEAL', 'ELIMINATE'],
      default: 'WARNING',
    },
    teamVisibility: {
      type: String,
      enum: ['TEAMMATES_ONLY', 'ALL_PLAYERS'],
      default: 'TEAMMATES_ONLY',
    },
  },
  { _id: false }
);

const GameSchema = new Schema<IGame>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 6,
    },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 28 },
    mode: {
      type: String,
      enum: ['Classic Manhunt', 'Last Runner Standing'],
      default: 'Classic Manhunt',
    },
    settings: { type: GameSettingsSchema, required: true },
    status: {
      type: String,
      enum: ['lobby', 'countdown', 'running', 'ended'],
      default: 'lobby',
    },
    players: [GamePlayerSchema],
    startedAt: { type: Date },
    endedAt: { type: Date },
    result: {
      winningRole: { type: String, enum: ['CHASER', 'RUNNER'] },
      reason: { type: String },
      mvpUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      summary: { type: Schema.Types.Mixed },
    },
    statsApplied: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export const Game = mongoose.model<IGame>('Game', GameSchema);
