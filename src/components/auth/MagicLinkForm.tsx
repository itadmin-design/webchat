"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, CheckCircle2, UserRoundX } from "lucide-react";
import Link from "next/link";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "not-found">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/magic-link/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Не удалось отправить ссылку"); // Failed to send link
        return;
      }

      if (data.found === false) {
        setStatus("not-found");
      } else {
        setStatus("sent");
      }
    } catch {
      setError("Что-то пошло не так. Попробуйте ещё раз."); // Something went wrong
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStatus("idle");
    setEmail("");
    setError("");
  }

  // Success state: link sent
  if (status === "sent") {
    return (
      <div className="text-center py-6 space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Проверьте почту</h3> {/* Check your email */}
          <p className="text-sm text-muted-foreground mt-1">
            Мы отправили ссылку для входа на <span className="font-medium text-foreground">{email}</span>.
            <br />Ссылка действительна 15 минут. {/* Link expires in 15 minutes */}
          </p>
        </div>
        <Button variant="ghost" className="text-sm" onClick={reset}>
          Отправить на другой email {/* Send to a different email */}
        </Button>
      </div>
    );
  }

  // Not found state: no account for this email
  if (status === "not-found") {
    return (
      <div className="text-center py-6 space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <UserRoundX className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Аккаунт не найден</h3> {/* No account found */}
          <p className="text-sm text-muted-foreground mt-1">
            Для <span className="font-medium text-foreground">{email}</span> нет активного аккаунта.            
          </p>
        </div>
        <div className="flex flex-col gap-2 items-center">
          <Link href="/apply">
            <Button className="text-sm">
              Стать клиентом {/* Request access */}
            </Button>
          </Link>
          <Button variant="ghost" className="text-sm" onClick={reset}>
            Попробовать другой email {/* Try a different email */}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Input
          id="magic-email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
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
            <Mail className="mr-2 h-4 w-4" />
            Отправить ссылку {/* Send login link */}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Мы отправим вам ссылку для входа на email. {/* We'll email you a link to log in */}
      </p>
    </form>
  );
}
