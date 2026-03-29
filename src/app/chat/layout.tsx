import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SocketProvider } from "@/components/providers/SocketProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";

export const dynamic = "force-dynamic";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) redirect("/login");

  return (
    <SocketProvider>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </SocketProvider>
  );
}
