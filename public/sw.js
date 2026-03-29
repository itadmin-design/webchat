// Ensure new service worker versions activate immediately
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", function (event) {
  console.log("[SW] Push event received");

  if (!event.data) {
    console.log("[SW] No data in push event");
    return;
  }

  let data;
  try {
    data = event.data.json();
    console.log("[SW] Push data:", JSON.stringify(data));
  } catch (e) {
    console.error("[SW] Failed to parse push data:", e);
    data = { title: "FinChat", body: "New message" };
  }

  const options = {
    body: data.body || "New message",
    icon: "/icons/web-app-manifest-192x192.png",
    badge: "/icons/favicon-96x96.png",
    data: { url: data.url || "/chat" },
    tag: data.tag || "chat-message",
    renotify: true,
    vibrate: [100, 50, 100],
  };

  console.log("[SW] Showing notification:", data.title, options);

  event.waitUntil(
    self.registration
      .showNotification(data.title || "FinChat", options)
      .then(() => console.log("[SW] Notification shown successfully"))
      .catch((err) => console.error("[SW] showNotification failed:", err))
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (client.url.includes("/chat") && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || "/chat");
        }
      })
  );
});
