import mongoose, { Document, Schema } from 'mongoose';

export interface IGameEvent extends Document {
  gameId: mongoose.Types.ObjectId;
  type: string;
  payload: Record<string, any>;
  ts: Date;
}

const GameEventSchema = new Schema<IGameEvent>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true, index: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    ts: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  }
);

export const GameEvent = mongoose.model<IGameEvent>('GameEvent', GameEventSchema);
