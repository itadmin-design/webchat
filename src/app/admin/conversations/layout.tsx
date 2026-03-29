import { ConversationsShell } from "@/components/admin/ConversationsShell";

export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConversationsShell>{children}</ConversationsShell>;
}
