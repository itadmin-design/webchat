"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (data: { name: string; company: string; phone: string }) => void;
}

export function EditProfileDialog({ open, onOpenChange, onSaved }: EditProfileDialogProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    setPassword("");
    setConfirmPassword("");

    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        setName(data.name || "");
        setCompany(data.company || "");
        setPhone(data.phone || "");
        setHasPassword(data.hasPassword || false);
      })
      .catch(() => toast.error("Не удалось загрузить профиль"))
      .finally(() => setFetching(false));
  }, [open]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Имя обязательно");
      return;
    }

    if (password && password !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }

    if (password && password.length < 6) {
      toast.error("Пароль должен содержать минимум 6 символов");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = {
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
      };
      if (password) body.password = password;

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Ошибка сохранения");
        return;
      }

      toast.success("Профиль обновлён");
      onSaved({ name: name.trim(), company: company.trim(), phone: phone.trim() });
      if (password) setHasPassword(true);
      setPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать профиль</DialogTitle>
        </DialogHeader>

        {fetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Имя</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-company">Компания</Label>
              <Input
                id="profile-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Название компании"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-phone">Телефон</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {hasPassword ? "Изменить пароль" : "Установить пароль"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {hasPassword
                  ? "Оставьте пустым, чтобы не менять"
                  : "Установите пароль, чтобы входить по email и паролю"}
              </p>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Новый пароль"
              />
              {password && (
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Подтвердите пароль"
                />
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Сохранить"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
