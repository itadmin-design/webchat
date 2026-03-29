import mongoose, { Schema, Document } from "mongoose";

export interface IUtmEvent extends Document {
  userId: mongoose.Types.ObjectId;
  eventType: "signup" | "visit";
  utmSource: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  url: string;
  createdAt: Date;
}

const UtmEventSchema = new Schema<IUtmEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    eventType: { type: String, enum: ["signup", "visit"], default: "visit" },
    utmSource: { type: String, required: true, trim: true },
    utmMedium: { type: String, trim: true },
    utmCampaign: { type: String, trim: true },
    utmContent: { type: String, trim: true },
    utmTerm: { type: String, trim: true },
    url: { type: String, default: "" },
  },
  { timestamps: true }
);

UtmEventSchema.index({ userId: 1, createdAt: -1 });

export const UtmEvent =
  mongoose.models.UtmEvent ||
  mongoose.model<IUtmEvent>("UtmEvent", UtmEventSchema);
