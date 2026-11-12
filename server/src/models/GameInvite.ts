import mongoose, { Document, Schema } from 'mongoose';

export interface IGameInvite extends Document {
  gameId: mongoose.Types.ObjectId;
  code: string;
  gameName: string;
  fromUserId: mongoose.Types.ObjectId;
  toUserId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GameInviteSchema = new Schema<IGameInvite>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    code: { type: String, required: true },
    gameName: { type: String, required: true },
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // TTL index: Mongo deletes expired invites automatically
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);
GameInviteSchema.index({ gameId: 1, toUserId: 1 }, { unique: true });

export const GameInvite = mongoose.model<IGameInvite>('GameInvite', GameInviteSchema);
