import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Conversation } from "@/models/Conversation";
import { Application } from "@/models/Application";
import { Message } from "@/models/Message";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessagesSquare, ClipboardList, MessageSquare } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  await connectDB();

  const [totalUsers, activeConversations, pendingApps, todayMessages] = await Promise.all([
    User.countDocuments({ role: "client" }),
    Conversation.countDocuments({ status: "active" }),
    Application.countDocuments({ status: "pending" }),
    Message.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  // Dashboard stat cards
  const stats = [
    {
      label: "Всего клиентов", // Total Clients
      value: totalUsers,
      icon: Users,
      href: "/admin/users",
    },
    {
      label: "Активные диалоги", // Active Conversations
      value: activeConversations,
      icon: MessagesSquare,
      href: "/admin/conversations",
    },
    {
      label: "Ожидающие заявки", // Pending Applications
      value: pendingApps,
      icon: ClipboardList,
      href: "/admin/applications",
      highlight: pendingApps > 0,
    },
    {
      label: "Сообщений сегодня", // Messages Today
      value: todayMessages,
      icon: MessageSquare,
      href: "/admin/conversations",
    },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 pl-10 md:pl-0">
        <h1 className="text-2xl font-bold tracking-tight">Панель управления</h1> {/* Dashboard */}
        <p className="text-sm text-muted-foreground mt-1">
          Статистика активности {/* Overview of activity summary */}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="h-full">
            <Card
              className={`h-full cursor-pointer bg-primary/5 shadow-none border-none ${
                stat.highlight ? "border-primary/50 bg-primary/5" : ""
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
