"use client";

import { useEffect } from "react";

function id(key) {
  try {
    let value = localStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      localStorage.setItem(key, value);
    }
    return value;
  } catch {
    return null;
  }
}

export function trackGrowthEvent(eventType, extra = {}) {
  if (typeof window === "undefined") return;
  const visitorId = id("cric4all_growth_visitor_id");
  let sessionId = null;
  try {
    sessionId = sessionStorage.getItem("cric4all_growth_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("cric4all_growth_session_id", sessionId);
    }
  } catch {}

  fetch("/api/growth/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ eventType, visitorId, sessionId, path: window.location.pathname, source: "WEB", ...extra }),
  }).catch(() => {});
}

export default function GrowthTracker({ eventType, oncePerSession = true }) {
  useEffect(() => {
    const key = `cric4all_growth_seen_${eventType}`;
    if (oncePerSession) {
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {}
    }
    trackGrowthEvent(eventType);
  }, [eventType, oncePerSession]);
  return null;
}
