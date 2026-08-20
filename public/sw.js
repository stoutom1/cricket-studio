/* Cric4All service worker
 *
 * Responsibilities:
 * 1. Existing Web Push notification delivery.
 * 2. Runtime caching of Cric4All static assets.
 * 3. Offline navigation fallback.
 * 4. Dedicated cached authenticated Dashboard shell for offline scorer resume.
 *
 * IMPORTANT:
 * API responses are never cached here. Offline scoring data remains in the
 * existing IndexedDB scoring store and is reconciled by DashboardClient.
 */

const VERSION =
  "cric4all-sw-v6";

const STATIC_CACHE =
  `${VERSION}-static`;

const PAGE_CACHE =
  `${VERSION}-pages`;

const OFFLINE_SCORER_CACHE =
  "cric4all-offline-shell-v6";

const OFFLINE_DASHBOARD_CACHE_KEY =
  "/__cric4all_offline_dashboard_shell_v6__";

const CORE_PAGES = [
  "/",
  "/offline",
];


self.addEventListener(
  "install",
  (
    event
  ) => {
    event.waitUntil(
      caches
        .open(
          PAGE_CACHE
        )
        .then(
          (
            cache
          ) =>
            Promise.allSettled(
              CORE_PAGES.map(
                (
                  url
                ) =>
                  cache.add(
                    url
                  )
              )
            )
        )
        .then(
          () =>
            self.skipWaiting()
        )
    );
  }
);

self.addEventListener(
  "activate",
  (
    event
  ) => {
    event.waitUntil(
      Promise.all([
        self.clients.claim(),

        caches
          .keys()
          .then(
            (
              keys
            ) =>
              Promise.all(
                keys
                  .filter(
                    (
                      key
                    ) =>
                      (
                        (
                          key.startsWith(
                            "cric4all-sw-"
                          ) ||
                          key.startsWith(
                            "cric4all-offline-shell-"
                          )
                        ) &&
                        ![
                          STATIC_CACHE,
                          PAGE_CACHE,
                          OFFLINE_SCORER_CACHE,
                        ].includes(
                          key
                        )
                      )
                  )
                  .map(
                    (
                      key
                    ) =>
                      caches.delete(
                        key
                      )
                  )
              )
          ),
      ])
    );
  }
);

function isApiRequest(
  url
) {
  return url.pathname.startsWith(
    "/api/"
  );
}

function isStaticAsset(
  request,
  url
) {
  return (
    url.pathname.startsWith(
      "/_next/static/"
    ) ||
    [
      "style",
      "script",
      "font",
      "image",
    ].includes(
      request.destination
    )
  );
}

async function networkFirstStatic(
  request
) {
  try {
    /*
     * IMPORTANT:
     * Next/Turbopack development chunk URLs can remain stable while their
     * contents change. Cache-first can therefore keep executing an OLD
     * dashboard-client.jsx after the source file has been fixed.
     *
     * Network-first still gives us offline fallback while ensuring that an
     * online reload receives the current build.
     */
    const response =
      await fetch(
        request,
        {
          cache:
            "no-store",
        }
      );

    if (
      response.ok
    ) {
      const cache =
        await caches.open(
          STATIC_CACHE
        );

      cache.put(
        request,
        response.clone()
      );
    }

    return response;
  } catch (
    error
  ) {
    const cached =
      await caches.match(
        request
      );

    if (cached) {
      return cached;
    }

    throw error;
  }
}

async function networkFirstPage(
  request
) {
  try {
    const response =
      await fetch(
        request
      );

    if (
      response.ok &&
      request.method ===
        "GET"
    ) {
      const cache =
        await caches.open(
          PAGE_CACHE
        );

      cache.put(
        request,
        response.clone()
      );
    }

    return response;
  } catch (
    error
  ) {
    const url =
      new URL(
        request.url
      );

    if (
      url.pathname ===
        "/dashboard"
    ) {
      const scorerCache =
        await caches.open(
          OFFLINE_SCORER_CACHE
        );

      const scorerShell =
        await scorerCache.match(
          OFFLINE_DASHBOARD_CACHE_KEY
        );

      if (
        scorerShell
      ) {
        return scorerShell;
      }
    }

    const cached =
      await caches.match(
        request
      );

    if (cached) {
      return cached;
    }

    const offline =
      await caches.match(
        "/offline"
      );

    if (offline) {
      return offline;
    }

    throw error;
  }
}

self.addEventListener(
  "fetch",
  (
    event
  ) => {
    const request =
      event.request;

    if (
      request.method !==
        "GET"
    ) {
      return;
    }

    const url =
      new URL(
        request.url
      );

    if (
      url.origin !==
        self.location.origin
    ) {
      return;
    }

    /*
     * Never cache API responses. The existing offline scoring queue and
     * conflict protection remain the only authority for match mutations.
     */
    if (
      isApiRequest(
        url
      )
    ) {
      return;
    }

    if (
      request.mode ===
        "navigate"
    ) {
      event.respondWith(
        networkFirstPage(
          request
        )
      );

      return;
    }

    if (
      isStaticAsset(
        request,
        url
      )
    ) {
      event.respondWith(
        networkFirstStatic(
          request
        )
      );
    }
  }
);

/* Existing Cric4All Web Push compatibility. */
self.addEventListener(
  "push",
  (
    event
  ) => {
    let payload = {};

    try {
      payload =
        event.data
          ? event.data.json()
          : {};
    } catch {
      try {
        payload = {
          body:
            event.data
              ?.text() ||
            "",
        };
      } catch {
        payload = {};
      }
    }

    const title =
      payload.title ||
      payload
        ?.notification
        ?.title ||
      "Cric4All";

    const data = {
      ...(
        payload.data ||
        {}
      ),

      url:
        payload.url ||
        payload
          ?.data
          ?.url ||
        "/",
    };

    const options = {
      body:
        payload.body ||
        payload
          ?.notification
          ?.body ||
        "",

      icon:
        payload.icon ||
        "/icons/icon-192x192.png",

      badge:
        payload.badge ||
        "/icons/icon-96x96.png",

      tag:
        payload.tag,

      renotify:
        Boolean(
          payload.renotify
        ),

      data,
    };

    event.waitUntil(
      self.registration
        .showNotification(
          title,
          options
        )
    );
  }
);

self.addEventListener(
  "notificationclick",
  (
    event
  ) => {
    event.notification
      .close();

    const target =
      event.notification
        ?.data
        ?.url ||
      "/";

    event.waitUntil(
      self.clients
        .matchAll({
          type:
            "window",
          includeUncontrolled:
            true,
        })
        .then(
          async (
            clients
          ) => {
            for (
              const client
              of clients
            ) {
              try {
                const current =
                  new URL(
                    client.url
                  );

                const destination =
                  new URL(
                    target,
                    self.location.origin
                  );

                if (
                  current.origin ===
                    destination.origin &&
                  "focus" in
                    client
                ) {
                  await client.focus();

                  if (
                    "navigate" in
                      client
                  ) {
                    await client.navigate(
                      destination.href
                    );
                  }

                  return;
                }
              } catch {
                // Continue to another client.
              }
            }

            if (
              self.clients
                .openWindow
            ) {
              return self.clients
                .openWindow(
                  target
                );
            }
          }
        )
    );
  }
);
