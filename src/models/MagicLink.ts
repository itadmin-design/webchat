import mongoose, { Schema, Document } from "mongoose";

export interface IMagicLink extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  hashedToken: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const MagicLinkSchema = new Schema<IMagicLink>(
  {
    email: { type: String, required: true, lowercase: true },
    hashedToken: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MagicLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
MagicLinkSchema.index({ email: 1, used: 1 });

export const MagicLink =
  mongoose.models.MagicLink || mongoose.model<IMagicLink>("MagicLink", MagicLinkSchema);
