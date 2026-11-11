self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() ?? "" }; }
  const title = payload.title || "Festa na Chácara";
  const options = {
    body: payload.body || "Há novidades na organização da festa.",
    icon: new URL("party-icon-192.png", self.registration.scope).href,
    badge: new URL("party-icon-192.png", self.registration.scope).href,
    data: { url: payload.url || "./" },
    tag: payload.tag || "party-update",
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope) && "focus" in client) return client.focus();
    }
    return clients.openWindow(target);
  }));
});
