/* Agenda AV — avisos. No cachea la app para no pelear con ?v= del index. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL("./", self.registration.scope).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(url) && "focus" in client) {
        return client.focus();
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(url);
    }
    return undefined;
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "notify" || !data.title) return;
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || "",
      tag: data.tag || "agenda-av",
      lang: "es",
      renotify: true,
      data: data.payload || {},
    })
  );
});
