"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { UserData } from "@/types";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

// Status label mapping
const statusLabels: Record<string, string> = {
  active: "активен",        // active
  pending: "ожидает",       // pending
  suspended: "заблокирован", // suspended
};

// Role label mapping
const roleLabels: Record<string, string> = {
  client: "клиент", // client
  admin: "админ",   // admin
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const statusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "pending":
        return "secondary";
      case "suspended":
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Helper for pluralizing user count
  function userCountLabel(count: number) {
    if (count === 1) return "пользователь зарегистрирован";
    if (count >= 2 && count <= 4) return "пользователя зарегистрировано";
    return "пользователей зарегистрировано";
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 pl-10 md:pl-0">
        <h1 className="text-2xl font-bold tracking-tight">Пользователи</h1> {/* Users */}
        <p className="text-sm text-muted-foreground mt-1">
          {users.length} {userCountLabel(users.length)}
        </p>
      </div>

      <Card className="p-0 border-none shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Table headers */}
                <TableHead>Имя</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Компания</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Последний вход</TableHead>
                <TableHead>Регистрация</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Пользователи не найдены {/* No users found */}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user._id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedUserId(user._id)}
                  >
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">{user.company || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {roleLabels[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusColor(user.status) as "default" | "secondary" | "destructive"}
                        className="text-[10px]"
                      >
                        {statusLabels[user.status] || user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.lastLoginAt
                        ? format(new Date(user.lastLoginAt), "d MMM, HH:mm", { locale: ru })
                        : "Никогда"} {/* Never */}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(user.createdAt), "d MMM yyyy", { locale: ru })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserDetailDialog
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onUserUpdated={fetchUsers}
        onUserDeleted={(id) => {
          setUsers((prev) => prev.filter((u) => u._id !== id));
          setSelectedUserId(null);
        }}
      />
    </div>
  );
}
