import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { User } from "@/models/User";
import { ChatClient } from "./ChatClient";

export default async function ChatPage() {
  const session = await auth();
  if (!session) redirect("/login");

  await connectDB();

  // Find or create conversation for this user
  let conversation = await Conversation.findOne({ userId: session.user.id });
  if (!conversation) {
    conversation = await Conversation.create({ userId: session.user.id });
  }

  const user = await User.findById(session.user.id);

  return (
    <ChatClient
      conversationId={conversation._id.toString()}
      currentUserId={session.user.id}
      user={{
        name: user?.name || session.user.name,
        email: user?.email || session.user.email || "",
        company: user?.company || "",
        phone: user?.phone || "",
      }}
    />
  );
}
