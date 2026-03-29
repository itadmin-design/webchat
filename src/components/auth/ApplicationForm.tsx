"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Send } from "lucide-react";
import { getStoredUtmParams } from "@/hooks/useUtmParams";

export function ApplicationForm() {
  const [form, setForm] = useState({ email: "", name: "", phone: "", comment: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successSubtitle, setSuccessSubtitle] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...getStoredUtmParams() }),
      });

      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
        setSuccessMessage(data.message || "Регистрация завершена!");
        setSuccessSubtitle(data.subtitle || "");
      } else {
        setError(data.error || "Не удалось отправить заявку");
      }
    } catch {
      setError("Что-то пошло не так. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-6 space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{successMessage}</h3>
          {successSubtitle && (
            <p className="text-sm text-muted-foreground mt-1">
              {successSubtitle}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="app-name" className="text-sm font-medium text-foreground/80">Имя</Label>
          <Input
            id="app-name"
            placeholder="Ваше имя"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-phone" className="text-sm font-medium text-foreground/80">Телефон</Label>
          <Input
            id="app-phone"
            type="tel"
            placeholder="+7 (999) 123-45-67"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="app-email" className="text-sm font-medium text-foreground/80">Email</Label>
        <Input
          id="app-email"
          type="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="app-comment" className="text-sm font-medium text-foreground/80">
          Комментарий <span className="text-muted-foreground font-normal">(необязательно)</span>
        </Label>
        <Textarea
          id="app-comment"
          placeholder="Расскажите о вашей задаче"
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          rows={3}
          className="resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-medium">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Отправить заявку
          </>
        )}
      </Button>
    </form>
  );
}
