const DEFAULT_DESTINATION = "/dashboard";

/*
 * Install immediately so a newly deployed service worker
 * does not remain waiting behind the previous version.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

/*
 * Begin controlling already-open Cric4All pages.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/*
 * Receive a push event from the browser push service.
 */
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data
      ? event.data.json()
      : {};
  } catch {
    payload = {
      title: "Cric4All",
      body: event.data
        ? event.data.text()
        : "You have a new Cric4All notification.",
    };
  }

  const title =
    payload.title ||
    "Cric4All Birthday Alert";

  const options = {
    body:
      payload.body ||
      "A player has a birthday today.",

    icon:
      payload.icon ||
      "/icons/icon-192.png",

    badge:
      payload.badge ||
      "/icons/icon-192.png",

    tag:
      payload.tag ||
      "cric4all-birthday-alert",

    renotify: true,

    data: {
      url:
        payload.url ||
        DEFAULT_DESTINATION,

      type:
        payload.type ||
        "BIRTHDAY_ALERT",

      leagueId:
        payload.leagueId ||
        null,
    },

    actions: [
      {
        action: "open-birthdays",
        title: "View Birthdays",
      },
    ],
  };

  /*
   * Safari requires the service worker to display a
   * visible notification after receiving the push.
   */
  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

/*
 * Handle the owner tapping the notification.
 */
self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const destination =
      event.notification.data?.url ||
      DEFAULT_DESTINATION;

    const absoluteUrl = new URL(
      destination,
      self.location.origin
    ).href;

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((windowClients) => {
          /*
           * Reuse an existing Cric4All tab/window when
           * possible rather than opening duplicates.
           */
          for (const client of windowClients) {
            try {
              const clientUrl =
                new URL(client.url);

              if (
                clientUrl.origin ===
                self.location.origin
              ) {
                if ("navigate" in client) {
                  client.navigate(absoluteUrl);
                }

                if ("focus" in client) {
                  return client.focus();
                }
              }
            } catch {
              // Ignore malformed client URLs.
            }
          }

          /*
           * No existing Cric4All window exists.
           */
          return self.clients.openWindow(
            absoluteUrl
          );
        })
    );
  }
);