import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  password?: string;
  company?: string;
  phone?: string;
  role: "client" | "admin";
  status: "pending" | "active" | "suspended";
  lastLoginAt?: Date;
  lastLoginIp?: string;
  lastLoginUserAgent?: string;
  lastLoginCountry?: string;
  lastLoginCity?: string;
  adminNotes?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    password: { type: String, select: false },
    company: { type: String, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, enum: ["client", "admin"], default: "client" },
    status: { type: String, enum: ["pending", "active", "suspended"], default: "pending" },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    lastLoginUserAgent: { type: String },
    lastLoginCountry: { type: String },
    lastLoginCity: { type: String },
    adminNotes: { type: String, default: "" },
    utmSource: { type: String, trim: true },
    utmMedium: { type: String, trim: true },
    utmCampaign: { type: String, trim: true },
    utmContent: { type: String, trim: true },
    utmTerm: { type: String, trim: true },
  },
  { timestamps: true }
);

// email index already created by `unique: true`
UserSchema.index({ role: 1, status: 1 });

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
