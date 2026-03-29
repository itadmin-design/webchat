import mongoose, { Schema, Document } from "mongoose";

export interface ILoginHistory extends Document {
  userId: mongoose.Types.ObjectId;
  ip: string;
  userAgent: string;
  country?: string;
  city?: string;
  loginAt: Date;
}

const LoginHistorySchema = new Schema<ILoginHistory>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  country: { type: String },
  city: { type: String },
  loginAt: { type: Date, default: Date.now },
});

LoginHistorySchema.index({ userId: 1, loginAt: -1 });
LoginHistorySchema.index({ loginAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days TTL

export const LoginHistory =
  mongoose.models.LoginHistory ||
  mongoose.model<ILoginHistory>("LoginHistory", LoginHistorySchema);
