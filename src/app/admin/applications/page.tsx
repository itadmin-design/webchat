"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApplicationData } from "@/types";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

// Status label mapping
const statusLabels: Record<string, string> = {
  pending: "ожидает",     // pending
  approved: "одобрена",   // approved
  rejected: "отклонена",  // rejected
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/applications")
      .then((res) => res.json())
      .then((data) => {
        setApplications(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Не удалось загрузить заявки"); // Failed to load applications
        setLoading(false);
      });
  }, []);

  async function handleAction(e: React.MouseEvent, id: string, action: "approve" | "reject") {
    e.stopPropagation();
    setActionLoading(id);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        setApplications((prev) =>
          prev.map((app) =>
            app._id === id ? { ...app, status: action === "approve" ? "approved" : "rejected" } : app
          )
        );
        // Toast: Application approved / rejected
        toast.success(action === "approve" ? "Заявка одобрена" : "Заявка отклонена");
      } else {
        const data = await res.json();
        toast.error(data.error || "Действие не выполнено"); // Action failed
      }
    } catch {
      toast.error("Что-то пошло не так"); // Something went wrong
    } finally {
      setActionLoading(null);
    }
  }

  const filterApps = (status?: string) =>
    status ? applications.filter((a) => a.status === status) : applications;

  const statusVariant = (status: string) => {
    switch (status) {
      case "approved": return "default" as const;
      case "rejected": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  function ApplicationTable({ apps }: { apps: ApplicationData[] }) {
    return (
      <Card className="p-0 border-none shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Table headers */}
                <TableHead>Имя</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Телефон / Компания</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Подана</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Нет заявок {/* No applications */}
                  </TableCell>
                </TableRow>
              ) : (
                apps.map((app) => (
                  <TableRow key={app._id}>
                    <TableCell className="font-medium">{app.name}</TableCell>
                    <TableCell className="text-muted-foreground">{app.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[app.phone, (app as unknown as { company?: string }).company].filter(Boolean).join(" / ") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {app.comment || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(app.status)} className="text-[10px]">
                        {statusLabels[app.status] || app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(app.createdAt), "d MMM yyyy", { locale: ru })}
                    </TableCell>
                    <TableCell className="text-right">
                      {app.status === "pending" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => handleAction(e, app._id, "approve")}
                            disabled={actionLoading === app._id}
                          >
                            {actionLoading === app._id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Одобрить {/* Approve */}
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => handleAction(e, app._id, "reject")}
                            disabled={actionLoading === app._id}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Отклонить {/* Reject */}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 pl-10 md:pl-0">
        <h1 className="text-2xl font-bold tracking-tight">Заявки</h1> {/* Applications */}
        <p className="text-sm text-muted-foreground mt-1">
          Управление запросами на регистрацию {/* Manage client access requests */}
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          {/* Filter tabs */}
          <TabsTrigger value="all">
            Все ({applications.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Ожидающие ({filterApps("pending").length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Одобренные ({filterApps("approved").length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Отклонённые ({filterApps("rejected").length})
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="mt-4">
            <Card className="p-0 border-none shadow-none">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableHead key={j}><div className="h-4 w-16" /></TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : (
          ["all", "pending", "approved", "rejected"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <ApplicationTable apps={filterApps(tab === "all" ? undefined : tab)} />
            </TabsContent>
          ))
        )}
      </Tabs>
    </div>
  );
}
