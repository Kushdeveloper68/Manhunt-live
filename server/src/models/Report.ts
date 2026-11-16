import mongoose, { Document, Schema } from 'mongoose';

export const REPORT_REASONS = ['CHEATING', 'HARASSMENT', 'UNSAFE_BEHAVIOUR', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface IReport extends Document {
  reporter: mongoose.Types.ObjectId;
  reported: mongoose.Types.ObjectId;
  gameId?: mongoose.Types.ObjectId;
  reason: ReportReason;
  details?: string;
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reported: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game' },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Report = mongoose.model<IReport>('Report', ReportSchema);
