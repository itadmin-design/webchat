import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminConversationClient } from "./AdminConversationClient";

export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "admin") redirect("/login");

  const { conversationId } = await params;

  return (
    <AdminConversationClient
      conversationId={conversationId}
      currentUserId={session.user.id}
    />
  );
}
