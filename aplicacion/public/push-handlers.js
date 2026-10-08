self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "Nuevo pedido recibido" }; }

  const orderId = data.orderId || data.order_id || "";
  const code = data.code || data.public_code || "";
  const title = data.title || (code ? `Nuevo pedido #${code}` : "Nuevo pedido · Control Emprende");
  const targetUrl = data.url || (orderId ? `/?webOrder=${encodeURIComponent(orderId)}` : "/");
  const options = {
    body: data.body || "Tienes un nuevo pedido web para revisar.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || (orderId ? `od-order-${orderId}` : "od-new-order"),
    renotify: true,
    requireInteraction: false,
    data: { url: targetUrl, orderId },
  };

  const tasks = [self.registration.showNotification(title, options)];
  try {
    if (self.navigator && typeof self.navigator.setAppBadge === "function") tasks.push(self.navigator.setAppBadge(1));
  } catch {}
  event.waitUntil(Promise.allSettled(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const relativeUrl = event.notification?.data?.url || "/";
  const resolved = new URL(relativeUrl, self.location.origin);
  const target = resolved.origin === self.location.origin ? resolved.href : self.location.origin;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const sameOrigin = windows.find((client) => {
      try { return new URL(client.url).origin === self.location.origin; } catch { return false; }
    });

    if (sameOrigin) {
      try { await sameOrigin.navigate(target); } catch {}
      await sameOrigin.focus();
      return;
    }
    await self.clients.openWindow(target);
  })());
});
