import mongoose, { Document, Schema } from 'mongoose';

export interface IFriendship extends Document {
  requester: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  status: 'PENDING' | 'ACCEPTED';
  /** Order-independent key (smaller id first) so A->B and B->A can never both exist. */
  pairKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['PENDING', 'ACCEPTED'], default: 'PENDING' },
    pairKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export const Friendship = mongoose.model<IFriendship>('Friendship', FriendshipSchema);
