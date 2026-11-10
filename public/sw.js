// Push-only service worker (no fetch handler, no caching): shows owner alerts and opens the leads page.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data.json(); } catch {}
  e.waitUntil(self.registration.showNotification(d.title || "DU PYQ Online", {
    body: d.body || "", icon: "/icon.png", badge: "/icon.png", tag: "owner-alert", renotify: true, data: { url: d.url || "/admin/leads" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/admin/leads";
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const w = wins.find((c) => c.url.includes("/admin")) || wins[0];
    if (w) { await w.focus(); if ("navigate" in w) await w.navigate(url); } else await self.clients.openWindow(url);
  })());
});
