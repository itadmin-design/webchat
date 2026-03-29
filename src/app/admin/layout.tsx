import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SocketProvider } from "@/components/providers/SocketProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/chat");

  return (
    <SocketProvider>
      <NotificationProvider>
        <AdminShell>{children}</AdminShell>
      </NotificationProvider>
    </SocketProvider>
  );
}
