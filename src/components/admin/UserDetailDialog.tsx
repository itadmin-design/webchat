"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, Shield, ShieldOff, Trash2, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { UserData, LoginHistoryEntry, UtmEventEntry } from "@/types";

// Status label mapping
const statusLabels: Record<string, string> = {
  active: "активен",
  suspended: "заблокирован",
  pending: "ожидает",
};

// Role label mapping
const roleLabels: Record<string, string> = {
  client: "клиент",
  admin: "админ",
};

interface UserDetailDialogProps {
  userId: string | null;
  onClose: () => void;
  onUserUpdated: () => void;
  onUserDeleted: (id: string) => void;
}

export function UserDetailDialog({
  userId,
  onClose,
  onUserUpdated,
  onUserDeleted,
}: UserDetailDialogProps) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Login history
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [loginHistoryLoaded, setLoginHistoryLoaded] = useState(false);

  // UTM events
  const [utmEvents, setUtmEvents] = useState<UtmEventEntry[]>([]);
  const [utmEventsLoading, setUtmEventsLoading] = useState(false);
  const [utmEventsLoaded, setUtmEventsLoaded] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState<"client" | "admin">("client");
  const [adminNotes, setAdminNotes] = useState("");

  const fetchUser = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUser(data);
      setName(data.name);
      setEmail(data.email);
      setCompany(data.company || "");
      setRole(data.role);
      setAdminNotes(data.adminNotes || "");
    } catch {
      toast.error("Не удалось загрузить данные пользователя"); // Failed to load user details
      onClose();
    } finally {
      setLoading(false);
    }
  }, [onClose]);

  const fetchUtmEvents = useCallback(async (id: string) => {
    setUtmEventsLoading(true);
    try {
      const res = await fetch(`/api/users/${id}/utm-events`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUtmEvents(data);
      setUtmEventsLoaded(true);
    } catch {
      toast.error("Не удалось загрузить UTM-метки");
    } finally {
      setUtmEventsLoading(false);
    }
  }, []);

  const fetchLoginHistory = useCallback(async (id: string) => {
    setLoginHistoryLoading(true);
    try {
      const res = await fetch(`/api/users/${id}/logins`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLoginHistory(data);
      setLoginHistoryLoaded(true);
    } catch {
      toast.error("Не удалось загрузить историю входов"); // Failed to load login history
    } finally {
      setLoginHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchUser(userId);
      setConfirmDelete(false);
      setLoginHistory([]);
      setLoginHistoryLoaded(false);
      setUtmEvents([]);
      setUtmEventsLoaded(false);
    } else {
      setUser(null);
    }
  }, [userId, fetchUser]);

  function handleTabChange(value: string) {
    if (value === "logins" && !loginHistoryLoaded && userId) {
      fetchLoginHistory(userId);
    }
    if (value === "utm" && !utmEventsLoaded && userId) {
      fetchUtmEvents(userId);
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, role, adminNotes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Ошибка обновления"); // Update failed
        return;
      }
      toast.success("Пользователь обновлён"); // User updated
      onUserUpdated();
      fetchUser(user._id);
    } catch {
      toast.error("Что-то пошло не так"); // Something went wrong
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusToggle() {
    if (!user) return;
    const newStatus = user.status === "suspended" ? "active" : "suspended";
    setTogglingStatus(true);
    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Не удалось изменить статус"); // Status change failed
        return;
      }
      // Toast: User suspended / activated
      toast.success(newStatus === "suspended" ? "Пользователь заблокирован" : "Пользователь активирован");
      setUser((prev) => prev ? { ...prev, status: newStatus } : null);
      onUserUpdated();
    } catch {
      toast.error("Что-то пошло не так"); // Something went wrong
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleDelete() {
    if (!user) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${user._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Не удалось удалить"); // Delete failed
        return;
      }
      toast.success("Пользователь удалён"); // User deleted
      onUserDeleted(user._id);
      onClose();
    } catch {
      toast.error("Что-то пошло не так"); // Something went wrong
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "default" as const;
      case "suspended": return "destructive" as const;
      case "pending": return "secondary" as const;
      default: return "secondary" as const;
    }
  };

  // Determine the "primary" IP (most recent login) for flagging different IPs
  const primaryIp = loginHistory.length > 0 ? loginHistory[0].ip : null;

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] md:max-w-[66vw] max-h-[90vh] md:max-h-[80vh] overflow-y-auto">
        {loading || !user ? (
          <div className="flex items-center justify-center py-12">
            <DialogHeader className="sr-only">
              <DialogTitle>Загрузка пользователя</DialogTitle> {/* Loading user */}
            </DialogHeader>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl">{user.name}</DialogTitle>
                <Badge variant={statusColor(user.status)}>{statusLabels[user.status] || user.status}</Badge>
                <Badge variant="outline">{roleLabels[user.role] || user.role}</Badge>
              </div>
              <DialogDescription className="text-left">{user.email}</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="details" className="mt-2" onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="details">Детали</TabsTrigger> {/* Details */}
                <TabsTrigger value="logins">История входов</TabsTrigger> {/* Login History */}
                <TabsTrigger value="utm">UTM-метки</TabsTrigger> {/* UTM Tags */}
              </TabsList>

              {/* Details Tab //*/}
              <TabsContent value="details" className="space-y-6 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Имя</Label> {/* Name */}
                    <Input
                      id="user-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-phone">Телефон</Label> {/* Phone */}
                    <Input
                      id="user-phone"
                      value={user.phone || "—"}
                      disabled
                      className="disabled:opacity-70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-company">Компания</Label> {/* Company */}
                    <Input
                      id="user-company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Роль</Label> {/* Role */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={role === "client" ? "default" : "outline"}
                        onClick={() => setRole("client")}
                      >
                        Клиент {/* Client */}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={role === "admin" ? "default" : "outline"}
                        onClick={() => setRole("admin")}
                      >
                        Админ {/* Admin */}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Admin Notes */}
                <div className="space-y-2">
                  <Label htmlFor="admin-notes">Приватные заметки</Label> {/* Private Notes */}
                  <Textarea
                    id="admin-notes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Заметки о пользователе (видны только админам)..." // Add notes about this user (only visible to admins)
                    rows={3}
                  />
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Сохранение... {/* Saving... */}
                      </>
                    ) : (
                      "Сохранить изменения" // Save Changes
                    )}
                  </Button>
                </div>

                <Separator />

                {/* Application Info */}
                {user.applicationDate && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Заявка на регистрацию</h4> {/* Application */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InfoField
                        label="Подана" // Submitted
                        value={format(new Date(user.applicationDate), "d MMM yyyy, HH:mm", { locale: ru })}
                      />
                      <InfoField
                        label="Комментарий" // Comment
                        value={user.applicationComment || "—"}
                      />
                    </div>
                  </div>
                )}
                

                <Separator />

                {/* Login Metadata */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">История Входов</h4> {/* Login Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoField
                      label="Последний вход" // Last Login
                      value={
                        user.lastLoginAt
                          ? format(new Date(user.lastLoginAt), "d MMM yyyy, HH:mm", { locale: ru })
                          : "Никогда" // Never
                      }
                    />
                    <InfoField
                      label="Местоположение" // Location
                      value={
                        [user.lastLoginCity, user.lastLoginCountry]
                          .filter(Boolean)
                          .join(", ") || "Неизвестно" // Unknown
                      }
                    />
                    <InfoField
                      label="IP-адрес" // IP Address
                      value={user.lastLoginIp || "Неизвестно"} // Unknown
                    />
                    <InfoField
                      label="Участник с" // Member Since
                      value={format(new Date(user.createdAt), "d MMM yyyy", { locale: ru })}
                    />
                  </div>
                  {user.lastLoginUserAgent && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">User Agent</p>
                      <p className="text-xs text-muted-foreground bg-muted rounded-md p-2 break-all">
                        {user.lastLoginUserAgent}
                      </p>
                    </div>
                  )}
                </div>

                {/* Account Actions */}
                <div className="rounded-lg border divide-y">
                  {/* Suspend / Activate */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {user.status === "suspended" ? "Аккаунт заблокирован" : "Аккаунт активен"}
                        {/* Account Suspended / Account Active */}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.status === "suspended"
                          ? "Этот пользователь не может войти в систему." // This user cannot log in
                          : "Этот пользователь имеет доступ к платформе."} {/* This user can access the platform */}
                      </p>
                    </div>
                    <Button
                      variant={user.status === "suspended" ? "default" : "outline"}
                      size="sm"
                      onClick={handleStatusToggle}
                      disabled={togglingStatus}
                    >
                      {togglingStatus ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : user.status === "suspended" ? (
                        <>
                          <Shield className="mr-1.5 h-4 w-4" />
                          Активировать {/* Activate */}
                        </>
                      ) : (
                        <>
                          <ShieldOff className="mr-1.5 h-4 w-4" />
                          Заблокировать {/* Suspend */}
                        </>
                      )}
                    </Button>
                  </div>
                  {/* Delete account */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Удалить аккаунт</p> {/* Delete Account */}
                      <p className="text-xs text-muted-foreground">
                        Безвозвратно удалить пользователя. Отменить нельзя. {/* Permanently remove. Cannot be undone. */}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant={confirmDelete ? "destructive" : "outline"}
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="mr-1.5 h-4 w-4" />
                            {confirmDelete ? "Подтвердить" : "Удалить"} {/* Confirm / Delete */}
                          </>
                        )}
                      </Button>
                      {confirmDelete && !deleting && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(false)}
                        >
                          Отмена {/* Cancel */}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Login History Tab */}
              <TabsContent value="logins" className="mt-4">
                {loginHistoryLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : loginHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    История входов пока пуста. {/* No login history recorded yet */}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {loginHistory.map((entry) => {
                      const isDifferentIp = primaryIp && entry.ip !== primaryIp;
                      return (
                        <LoginHistoryRow
                          key={entry._id}
                          entry={entry}
                          flagged={!!isDifferentIp}
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* UTM Events Tab */}
              <TabsContent value="utm" className="mt-4">
                {utmEventsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : utmEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    UTM-меток пока нет. {/* No UTM events recorded yet */}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">Дата</th>
                          <th className="py-2 pr-3 font-medium">Тип</th>
                          <th className="py-2 pr-3 font-medium">Source</th>
                          <th className="py-2 pr-3 font-medium">Medium</th>
                          <th className="py-2 pr-3 font-medium">Campaign</th>
                          <th className="py-2 pr-3 font-medium">Content</th>
                          <th className="py-2 font-medium">Term</th>
                        </tr>
                      </thead>
                      <tbody>
                        {utmEvents.map((event, index) => (
                          <tr
                            key={event._id}
                            className={`border-b last:border-0 ${
                              index === 0
                                ? "bg-primary/5 font-medium"
                                : ""
                            }`}
                          >
                            <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                              {format(new Date(event.createdAt), "d MMM yyyy, HH:mm", { locale: ru })}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge variant={event.eventType === "signup" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                {event.eventType === "signup" ? "регистрация" : "визит"}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3">{event.utmSource || "—"}</td>
                            <td className="py-2 pr-3">{event.utmMedium || "—"}</td>
                            <td className="py-2 pr-3">{event.utmCampaign || "—"}</td>
                            <td className="py-2 pr-3">{event.utmContent || "—"}</td>
                            <td className="py-2">{event.utmTerm || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function LoginHistoryRow({ entry, flagged }: { entry: LoginHistoryEntry; flagged: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const location = [entry.city, entry.country].filter(Boolean).join(", ");

  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm transition-colors ${
        flagged ? "border-amber-300/60 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-950/20" : ""
      } ${entry.userAgent ? "cursor-pointer hover:bg-muted/50" : ""}`}
      onClick={() => entry.userAgent && setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {flagged && (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"
              title="IP отличается от последнего входа" // Different IP from most recent login
            />
          )}
          <span className="text-muted-foreground whitespace-nowrap">
            {format(new Date(entry.loginAt), "d MMM yyyy, HH:mm", { locale: ru })}
          </span>
          <span className="font-medium">{location || "Неизвестно"}</span> {/* Unknown location */}
          <span className="text-muted-foreground font-mono text-xs">{entry.ip || "—"}</span>
        </div>
        {entry.userAgent && (
          <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        )}
      </div>
      {entry.userAgent && (
        <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
            <p className="mt-2 text-xs text-muted-foreground bg-muted rounded p-2 break-all">
              {entry.userAgent}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
