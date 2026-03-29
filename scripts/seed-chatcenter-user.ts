import mongoose from "mongoose";

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
        },
        { timestamps: true }
      )
    );

  const email = "chatcenter@system.internal";
  const name = "Оператор";

  const existing = await UserModel.findOne({ email });
  if (existing) {
    console.log("Chat center system user already exists.");
    console.log(`  _id: ${existing._id}`);
  } else {
    const user = await UserModel.create({
      email,
      name,
      role: "admin",
      status: "active",
    });
    console.log("Chat center system user created!");
    console.log(`  _id: ${user._id}`);
  }

  console.log(`\nSet this in your .env.local:`);
  console.log(`  CHATCENTER_SYSTEM_USER_ID=${(existing || (await UserModel.findOne({ email })))?._id}`);

  await mongoose.disconnect();
}

seed().catch(console.error);
