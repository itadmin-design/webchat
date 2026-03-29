"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!session?.user || !("Notification" in window)) return;

    // Only show banner if permission is default (not yet asked)
    if (Notification.permission === "default") {
      // Show banner after a brief delay
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // If already granted, register service worker
    if (Notification.permission === "granted") {
      registerPushSubscription();
    }
  }, [session]);

  async function registerPushSubscription() {
    try {
      console.log("[Push] Registering service worker...");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      console.log("[Push] Service worker ready");

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn("[Push] No VAPID public key found");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      console.log("[Push] Subscribed, sending to server...");

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      console.log("[Push] Server response:", res.status);
    } catch (err) {
      console.error("[Push] Registration error:", err);
    }
  }

  async function handleEnableNotifications() {
    setShowBanner(false);
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await registerPushSubscription();
    }
  }

  return (
    <>
      {children}

      {/* Notification permission banner */}
      {showBanner && (
        <div className="fixed top-4 right-4 z-50 max-w-sm animate-in slide-in-from-top-2 fade-in">
          <div className="bg-background border shadow-lg rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Включить уведомления</p> {/* Enable notifications */}
              <p className="text-xs text-muted-foreground mt-0.5">
                Получайте уведомления о новых сообщениях {/* Get notified when you receive new messages */}
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="h-7 text-xs" onClick={handleEnableNotifications}>
                  Включить {/* Enable */}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setShowBanner(false)}
                >
                  Позже {/* Later */}
                </Button>
              </div>
            </div>
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setShowBanner(false)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
