const STORAGE_KEY =
  "cric4all.offlineScoringSession.v1";

const CACHE_NAME =
  "cric4all-offline-shell-v6";

const OFFLINE_DASHBOARD_CACHE_KEY =
  "/__cric4all_offline_dashboard_shell_v6__";

const MAX_SESSION_AGE_MS =
  1000 * 60 * 60 * 24 * 7;


function isNextDevelopmentMode() {
  return (
    process.env.NODE_ENV ===
    "development"
  );
}

export function shouldUseOfflineServiceWorker() {
  /*
   * Service workers are disabled only for `next dev` / Turbopack HMR.
   *
   * They ARE allowed for a production build served with `npm start`,
   * including http://localhost:3000. That gives us a reliable local way to
   * test the complete offline-navigation flow before deploying.
   */
  return !isNextDevelopmentMode();
}

function canUseBrowserStorage() {
  return (
    typeof window !==
      "undefined" &&
    typeof window.localStorage !==
      "undefined"
  );
}

function safePositiveInteger(
  value
) {
  const numeric =
    Number(
      value
    );

  return Number.isInteger(
    numeric
  ) &&
    numeric > 0
    ? numeric
    : null;
}

export function buildOfflineScoringResumeUrl(
  session
) {
  const matchId =
    safePositiveInteger(
      session?.matchId
    );

  if (!matchId) {
    return "/dashboard?tab=scoring";
  }

  const params =
    new URLSearchParams();

  params.set(
    "tab",
    "scoring"
  );

  params.set(
    "matchId",
    String(
      matchId
    )
  );

  const leagueId =
    safePositiveInteger(
      session
        ?.leagueId
    );

  if (leagueId) {
    params.set(
      "leagueId",
      String(
        leagueId
      )
    );
  }

  params.set(
    "offlineResume",
    "1"
  );

  return `/dashboard?${params.toString()}`;
}

export function getOfflineScoringSession() {
  if (
    !canUseBrowserStorage()
  ) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(
        raw
      );

    const matchId =
      safePositiveInteger(
        parsed?.matchId
      );

    if (!matchId) {
      window.localStorage.removeItem(
        STORAGE_KEY
      );

      return null;
    }

    const savedAt =
      Date.parse(
        parsed?.savedAt ||
        ""
      );

    if (
      Number.isFinite(
        savedAt
      ) &&
      Date.now() -
        savedAt >
        MAX_SESSION_AGE_MS
    ) {
      window.localStorage.removeItem(
        STORAGE_KEY
      );

      return null;
    }

    return {
      ...parsed,
      matchId,
      leagueId:
        safePositiveInteger(
          parsed
            ?.leagueId
        ),
    };
  } catch (
    error
  ) {
    console.warn(
      "[OFFLINE_RESUME_READ_FAILED]",
      error
    );

    return null;
  }
}

export function saveOfflineScoringSession(
  session
) {
  if (
    !canUseBrowserStorage()
  ) {
    return null;
  }

  const matchId =
    safePositiveInteger(
      session?.matchId
    );

  if (!matchId) {
    return null;
  }

  const next = {
    matchId,

    leagueId:
      safePositiveInteger(
        session
          ?.leagueId
      ),

    leagueName:
      String(
        session
          ?.leagueName ||
        ""
      ),

    teamAName:
      String(
        session
          ?.teamAName ||
        ""
      ),

    teamBName:
      String(
        session
          ?.teamBName ||
        ""
      ),

    scoreText:
      String(
        session
          ?.scoreText ||
        ""
      ),

    inningsNo:
      Number(
        session
          ?.inningsNo ||
        1
      ),

    matchStatus:
      String(
        session
          ?.matchStatus ||
        ""
      ),

    savedAt:
      new Date()
        .toISOString(),
  };

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        next
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        "cric4all:offline-scoring-session",
        {
          detail:
            next,
        }
      )
    );
  } catch (
    error
  ) {
    console.warn(
      "[OFFLINE_RESUME_SAVE_FAILED]",
      error
    );
  }

  return next;
}

export function clearOfflineScoringSession(
  matchId = null
) {
  if (
    !canUseBrowserStorage()
  ) {
    return;
  }

  const current =
    getOfflineScoringSession();

  if (
    matchId &&
    current &&
    Number(
      current.matchId
    ) !==
      Number(
        matchId
      )
  ) {
    return;
  }

  try {
    window.localStorage.removeItem(
      STORAGE_KEY
    );

    window.dispatchEvent(
      new CustomEvent(
        "cric4all:offline-scoring-session",
        {
          detail:
            null,
        }
      )
    );
  } catch (
    error
  ) {
    console.warn(
      "[OFFLINE_RESUME_CLEAR_FAILED]",
      error
    );
  }
}

function assetUrlsFromHtml(
  html
) {
  if (
    typeof DOMParser ===
    "undefined"
  ) {
    return [];
  }

  try {
    const document =
      new DOMParser()
        .parseFromString(
          html,
          "text/html"
        );

    const values =
      new Set();

    for (
      const node
      of document.querySelectorAll(
        'script[src],link[rel="stylesheet"][href],link[rel="preload"][href]'
      )
    ) {
      const value =
        node.getAttribute(
          "src"
        ) ||
        node.getAttribute(
          "href"
        );

      if (
        value &&
        value.startsWith(
          "/"
        )
      ) {
        values.add(
          value
        );
      }
    }

    return [
      ...values,
    ];
  } catch {
    return [];
  }
}

/*
 * Prime a dedicated authenticated Dashboard document while the device is
 * online. This is intentionally done from the browser after login, instead of
 * at service-worker install time, so the cached document belongs to the
 * scorer's current authenticated Cric4All session.
 *
 * The scoring state itself remains in the existing IndexedDB offline store.
 * This cache only solves the missing NAVIGATION/App-Shell layer.
 */
export async function primeOfflineScoringShell() {
  /*
   * Never prime/register the offline app shell on localhost.
   * Next.js `next dev` relies on HMR/WebSocket/Turbopack runtime behavior that
   * a service worker must not intercept or cache.
   *
   * Test the offline shell with a production build (`npm run build` +
   * `npm start`) or on the deployed HTTPS site.
   */
  if (
    typeof window ===
      "undefined" ||
    isNextDevelopmentMode() ||
    !(
      "caches" in
      window
    )
  ) {
    return false;
  }

  if (
    navigator.onLine ===
    false
  ) {
    return false;
  }

  try {
    if (
      "serviceWorker" in
      navigator
    ) {
      await navigator.serviceWorker
        .register(
          "/sw.js",
          {
            scope:
              "/",
          }
        )
        .catch(
          () => null
        );
    }

    const response =
      await fetch(
        "/dashboard?offlineShell=1",
        {
          method:
            "GET",
          credentials:
            "include",
          cache:
            "no-store",
          headers: {
            "X-Cric4All-Offline-Prime":
              "1",
          },
        }
      );

    if (
      !response.ok
    ) {
      return false;
    }

    const cache =
      await caches.open(
        CACHE_NAME
      );

    await cache.put(
      OFFLINE_DASHBOARD_CACHE_KEY,
      response.clone()
    );

    const html =
      await response.text();

    const htmlAssets =
      assetUrlsFromHtml(
        html
      );

    /*
     * Next.js App Router / Turbopack can request additional chunks after the
     * initial HTML has hydrated. Those chunk URLs are not guaranteed to appear
     * as <script> tags in the fetched Dashboard HTML.
     *
     * Cache every same-origin resource that this already-working Dashboard
     * loaded in the current browser session. This includes dashboard-client,
     * CSS modules and runtime chunks needed to recreate the scorer offline.
     */
    const runtimeAssets =
      typeof performance !== "undefined"
        ? performance
            .getEntriesByType("resource")
            .map((entry) => {
              try {
                const url =
                  new URL(
                    entry.name,
                    window.location.origin
                  );

                return url.origin === window.location.origin &&
                  (
                    url.pathname.startsWith("/_next/") ||
                    url.pathname.startsWith("/icons/") ||
                    url.pathname.startsWith("/fonts/")
                  )
                  ? `${url.pathname}${url.search}`
                  : null;
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        : [];

    const assets =
      [...new Set([
        ...htmlAssets,
        ...runtimeAssets,
      ])];

    await Promise.allSettled(
      assets.map(
        async (url) => {
          const assetResponse =
            await fetch(
              url,
              {
                credentials:
                  "same-origin",
                cache:
                  "no-store",
              }
            );

          if (assetResponse.ok) {
            await cache.put(
              url,
              assetResponse.clone()
            );
          }
        }
      )
    );

    return true;
  } catch (
    error
  ) {
    console.warn(
      "[OFFLINE_SHELL_PRIME_FAILED]",
      error
    );

    return false;
  }
}

export function isCompletedMatchStatus(
  status
) {
  const normalized =
    String(
      status ||
      ""
    )
      .trim()
      .toUpperCase();

  return [
    "COMPLETED",
    "COMPLETED_LOCKED",
    "COMPLETED_CORRECTED",
    "ABANDONED",
  ].includes(
    normalized
  );
}

export {
  CACHE_NAME,
  OFFLINE_DASHBOARD_CACHE_KEY,
};
