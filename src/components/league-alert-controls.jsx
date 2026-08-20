"use client";

import {
  useEffect,
  useState,
} from "react";

function urlBase64ToUint8Array(
  base64String
) {
  const padding =
    "=".repeat(
      (
        4 -
        (
          base64String.length %
          4
        )
      ) %
        4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );

  const rawData =
    window.atob(
      base64
    );

  return Uint8Array.from(
    [...rawData].map(
      (character) =>
        character.charCodeAt(
          0
        )
    )
  );
}

function isIosDevice() {
  return (
    /iphone|ipad|ipod/i.test(
      navigator.userAgent
    ) ||
    (
      navigator.platform ===
        "MacIntel" &&
      navigator.maxTouchPoints >
        1
    )
  );
}

function isStandaloneMode() {
  return (
    window.matchMedia?.(
      "(display-mode: standalone)"
    )?.matches ||
    window.navigator
      .standalone ===
      true
  );
}

function positiveInteger(
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

export default function LeagueAlertControls({
  leagueId,
  leagueName,
  isFollowing,
}) {
  const resolvedLeagueId =
    positiveInteger(
      leagueId
    );

  const [
    state,
    setState,
  ] =
    useState(null);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  async function loadAlertState() {
    if (
      !isFollowing ||
      !resolvedLeagueId
    ) {
      setState(
        null
      );
      return null;
    }

    const response =
      await fetch(
        `/api/public-league-alerts/${resolvedLeagueId}`,
        {
          credentials:
            "include",
          cache:
            "no-store",
        }
      );

    const data =
      await response.json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Unable to load match alert settings."
      );
    }


    setState(
      data
    );

    return {
      ...data,
      leagueId:
        numericLeagueId,
    };
  }

  useEffect(
    () => {
      let active =
        true;

      async function load() {
        if (
          !isFollowing
        ) {
          setState(
            null
          );
          return;
        }

        try {
          const response =
            await fetch(
              `/api/public-league-alerts/${resolvedLeagueId}`,
              {
                credentials:
                  "include",
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json()
              .catch(
                () => ({})
              );

          if (
            response.ok &&
            active
          ) {

            setState(
              data
            );
            setMessage("");
          } else if (
            active
          ) {
            setMessage(
              data?.error ||
              "Unable to load match alert settings."
            );
          }
        } catch (
          error
        ) {
          if (
            active
          ) {
            setMessage(
              error?.message ||
              "Unable to load match alert settings."
            );
          }
        }
      }

      load();

      return () => {
        active =
          false;
      };
    },
    [
      resolvedLeagueId,
      isFollowing,
    ]
  );

  if (
    !isFollowing
  ) {
    return null;
  }

  async function patchAlerts(
    patch
  ) {
    if (
      !resolvedLeagueId
    ) {
      throw new Error(
        "The league identifier is missing."
      );
    }

    const response =
      await fetch(
        `/api/public-league-alerts/${resolvedLeagueId}`,
        {
          method:
            "PATCH",
          credentials:
            "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify(
              patch
            ),
        }
      );

    const data =
      await response.json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Unable to update match alerts."
      );
    }


    setState(
      data
    );

    return data;
  }

  async function ensurePushSubscription() {
    if (
      !(
        "serviceWorker" in
          navigator
      ) ||
      !(
        "PushManager" in
          window
      ) ||
      !(
        "Notification" in
          window
      )
    ) {
      throw new Error(
        "This browser does not support Cric4All match notifications."
      );
    }

    if (
      isIosDevice() &&
      !isStandaloneMode()
    ) {
      throw new Error(
        "On iPhone, add Cric4All to the Home Screen first, then open it from the Cric4All icon to enable match alerts."
      );
    }

    const numericLeagueId =
      positiveInteger(
        resolvedLeagueId
      );

    if (
      !numericLeagueId
    ) {
      throw new Error(
        "A valid numeric league ID is required for match alerts."
      );
    }

    const publicKey =
      process.env
        .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
      throw new Error(
        "The Cric4All push public key is missing."
      );
    }

    const registration =
      await navigator.serviceWorker
        .register(
          "/sw.js",
          {
            scope:
              "/",
          }
        );

    await navigator.serviceWorker
      .ready;

    const permission =
      await Notification
        .requestPermission();

    if (
      permission !==
      "granted"
    ) {
      throw new Error(
        permission ===
          "denied"
          ? "Notifications are blocked in your browser settings."
          : "Notification permission was not granted."
      );
    }

    let subscription =
      await registration.pushManager
        .getSubscription();

    if (!subscription) {
      subscription =
        await registration.pushManager
          .subscribe({
            userVisibleOnly:
              true,
            applicationServerKey:
              urlBase64ToUint8Array(
                publicKey
              ),
          });
    }

    const response =
      await fetch(
        "/api/push/subscribe",
        {
          method:
            "POST",
          credentials:
            "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              subscription:
                subscription.toJSON(),

              /*
               * Existing Cric4All Web Push registration is league-aware.
               * Match alerts reuse the same device subscription.
               *
               * Do NOT send birthdayPreference here; enabling league match
               * alerts must never turn birthday alerts on or alter their
               * existing settings.
               */
              leagueId:
                numericLeagueId,
            }),
        }
      );

    const data =
      await response.json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Unable to save this device for Cric4All notifications."
      );
    }
  }

  async function enableAlerts() {
    setBusy(
      true
    );
    setMessage("");

    try {
      await ensurePushSubscription();

      await patchAlerts({
        alertsEnabled:
          true,
        alertMatchStart:
          true,
        alertMatchResult:
          true,
      });

      setMessage(
        `🔔 Match alerts enabled for ${leagueName}.`
      );
    } catch (
      error
    ) {
      setMessage(
        error?.message ||
        "Unable to enable match alerts."
      );
    } finally {
      setBusy(
        false
      );
    }
  }

  async function disableAlerts() {
    setBusy(
      true
    );
    setMessage("");

    try {
      await patchAlerts({
        alertsEnabled:
          false,
      });

      /*
       * Do NOT unsubscribe the browser globally. The same Web Push
       * subscription may serve birthday notifications or other leagues.
       */
      setMessage(
        `Match alerts are off for ${leagueName}.`
      );
    } catch (
      error
    ) {
      setMessage(
        error?.message ||
        "Unable to disable match alerts."
      );
    } finally {
      setBusy(
        false
      );
    }
  }

  async function togglePreference(
    key
  ) {
    if (
      !state
        ?.alertsEnabled
    ) {
      return;
    }

    setBusy(
      true
    );
    setMessage("");

    try {
      await patchAlerts({
        [key]:
          !state[key],
      });
    } catch (
      error
    ) {
      setMessage(
        error?.message ||
        "Unable to update match alert preference."
      );
    } finally {
      setBusy(
        false
      );
    }
  }

  return (
    <div
      style={{
        display:
          "grid",
        gap:
          7,
        minWidth:
          0,
        width:
          "100%",
      }}
    >
      {!state
        ?.alertsEnabled ? (
        <button
          type="button"
          disabled={
            busy
          }
          onClick={
            enableAlerts
          }
          style={{
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            minHeight:
              42,
            width:
              "100%",
            padding:
              "9px 12px",
            borderRadius:
              10,
            border:
              "1px solid rgba(56,189,248,.28)",
            background:
              "rgba(14,116,144,.16)",
            color:
              "inherit",
            fontWeight:
              850,
            cursor:
              busy
                ? "wait"
                : "pointer",
            whiteSpace:
              "normal",
            textAlign:
              "center",
            lineHeight:
              1.2,
          }}
        >
          {busy
            ? "Enabling…"
            : "🔔 Enable match alerts"}
        </button>
      ) : (
        <div
          style={{
            display:
              "grid",
            gap:
              7,
            padding:
              9,
            borderRadius:
              11,
            border:
              "1px solid rgba(52,211,153,.22)",
            background:
              "rgba(6,78,59,.10)",
          }}
        >
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap:
                8,
            }}
          >
            <strong
              style={{
                fontSize:
                  11,
              }}
            >
              🔔 Match alerts on
            </strong>

            <button
              type="button"
              disabled={
                busy
              }
              onClick={
                disableAlerts
              }
              style={{
                border:
                  0,
                background:
                  "transparent",
                color:
                  "inherit",
                opacity:
                  0.78,
                fontSize:
                  10,
                cursor:
                  "pointer",
              }}
            >
              Turn off
            </button>
          </div>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap:
                6,
            }}
          >
            <button
              type="button"
              disabled={
                busy
              }
              onClick={() =>
                togglePreference(
                  "alertMatchStart"
                )
              }
              style={{
                minWidth:
                  0,
                padding:
                  "7px 6px",
                borderRadius:
                  8,
                border:
                  "1px solid rgba(148,163,184,.18)",
                background:
                  state
                    ?.alertMatchStart
                    ? "rgba(34,197,94,.13)"
                    : "rgba(148,163,184,.07)",
                color:
                  "inherit",
                fontSize:
                  10,
                fontWeight:
                  800,
                lineHeight:
                  1.2,
                whiteSpace:
                  "normal",
              }}
            >
              {state
                ?.alertMatchStart
                ? "✓ "
                : ""}
              Match starts
            </button>

            <button
              type="button"
              disabled={
                busy
              }
              onClick={() =>
                togglePreference(
                  "alertMatchResult"
                )
              }
              style={{
                minWidth:
                  0,
                padding:
                  "7px 6px",
                borderRadius:
                  8,
                border:
                  "1px solid rgba(148,163,184,.18)",
                background:
                  state
                    ?.alertMatchResult
                    ? "rgba(34,197,94,.13)"
                    : "rgba(148,163,184,.07)",
                color:
                  "inherit",
                fontSize:
                  10,
                fontWeight:
                  800,
                lineHeight:
                  1.2,
                whiteSpace:
                  "normal",
              }}
            >
              {state
                ?.alertMatchResult
                ? "✓ "
                : ""}
              Final results
            </button>
          </div>
        </div>
      )}

      {message ? (
        <small
          style={{
            display:
              "block",
            width:
              "100%",
            fontSize:
              9,
            lineHeight:
              1.35,
            overflowWrap:
              "anywhere",
            opacity:
              0.82,
          }}
        >
          {message}
        </small>
      ) : null}
    </div>
  );
}
