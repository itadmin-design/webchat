"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";

function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
          <Link href="/">
            <Image src="/icons/logo.svg" alt="Logo" width={120} height={38} priority />
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>
    </div>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No token provided");
      return;
    }

    async function verify() {
      try {
        // Sign in directly — the credentials provider handles magic link
        // token verification (hashes it, checks MagicLink collection, marks as used)
        const result = await signIn("credentials", {
          email: "__magic_link__",
          password: token,
          redirect: false,
        });

        if (result?.error) {
          setStatus("error");
          setErrorMsg("Ссылка больше не активна.");
          return;
        }

        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();
        const destination = session?.user?.role === "admin" ? "/admin" : "/chat";

        setStatus("success");
        setTimeout(() => {
          router.push(destination);
          router.refresh();
        }, 800);
      } catch {
        setStatus("error");
        setErrorMsg("Что-то пошло не так. Попробуйте еще раз.");
      }
    }

    verify();
  }, [token, router]);

  return (
    <Card className="shadow-none border-border/50">
      <CardContent className="pt-8 pb-8">
        {status === "loading" && (
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Проверяем ссылку...</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Вход подтвержден!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Перенаправляем...
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Ссылка больше не активна</h3>
              <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <Link href="/magic-link">
              <Button variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Запросить ссылку заново
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <VerifyLayout>
      <Suspense
        fallback={
          <Card className="shadow-lg border-border/50">
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Загрузка...</p>
              </div>
            </CardContent>
          </Card>
        }
      >
        <VerifyContent />
      </Suspense>
    </VerifyLayout>
  );
}
