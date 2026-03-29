import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/chatting_app";

async function seed() {
  await mongoose.connect(MONGODB_URI);

  const UserModel =
    mongoose.models.User ||
    mongoose.model(
      "User",
      new mongoose.Schema(
        {
          email: { type: String, required: true, unique: true, lowercase: true },
          name: { type: String, required: true },
          password: { type: String },
          company: { type: String },
          role: { type: String, enum: ["client", "admin"], default: "client" },
          status: { type: String, enum: ["pending", "active", "suspended"], default: "pending" },
          lastLoginAt: { type: Date },
        },
        { timestamps: true }
      )
    );

  const email = "admin@admin.com";
  const password = "123456";
  const hashedPassword = await bcrypt.hash(password, 12);

  const existing = await UserModel.findOne({ email });
  if (existing) {
    console.log("Admin user already exists:", email);
  } else {
    await UserModel.create({
      email,
      name: "Admin",
      password: hashedPassword,
      role: "admin",
      status: "active",
    });
    console.log("Admin user created!");
  }

  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);

  await mongoose.disconnect();
}

seed().catch(console.error);
