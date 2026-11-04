self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : "New notification" };
    }

    event.waitUntil(
        self.registration.showNotification(data.title || "GCSHARP", {
            body: data.body || "You have a new notification.",
            icon: "/gcsharp.png",
            badge: "/gcsharp.png",
            data: { url: data.url || "/dashboard" },
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            const existing = clients.find((client) => "focus" in client);
            if (existing) {
                existing.navigate(targetUrl);
                return existing.focus();
            }
            return self.clients.openWindow(targetUrl);
        })
    );
});
