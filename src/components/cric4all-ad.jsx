"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import styles from "./Cric4AllAd.module.css";
import { getNativeRuntime } from "@/lib/native-runtime";
import {
  GOOGLE_ADSENSE_CLIENT,
  getAdSenseSlot,
  isAdPlacementConfigured,
} from "@/lib/ads";

const BLOCKED_WEB_PATHS = [
  "/dashboard",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/complete-profile",
  "/score-now",
  "/live/",
];

function isBlockedPath(pathname) {
  const path = String(pathname || "");

  return BLOCKED_WEB_PATHS.some((blocked) =>
    blocked.endsWith("/")
      ? path.startsWith(blocked)
      : path === blocked || path.startsWith(`${blocked}/`)
  );
}

export default function Cric4AllAd({
  placement,
  className = "",
  label = "Sponsored",
}) {
  const pathname = usePathname();
  const initializedRef = useRef(false);
  const [webEligible, setWebEligible] = useState(false);

  const slot = getAdSenseSlot(placement);
  const configured = isAdPlacementConfigured(placement);

  useEffect(() => {
    if (!configured || isBlockedPath(pathname)) {
      setWebEligible(false);
      return;
    }

    try {
      setWebEligible(!getNativeRuntime().native);
    } catch {
      // If Capacitor runtime detection is unavailable, this is still a web
      // browser and the public web placement is allowed.
      setWebEligible(true);
    }
  }, [configured, pathname]);

  useEffect(() => {
    if (!webEligible || initializedRef.current) return;

    initializedRef.current = true;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (error) {
      // Ad blockers, consent state, network failures or an unapproved AdSense
      // account can prevent rendering. Ads must never break Cric4All content.
      console.debug("Cric4All ad was not rendered.", error);
    }
  }, [webEligible]);

  if (!configured || !webEligible) {
    return null;
  }

  return (
    <div
      className={`${styles.slot} ${className}`.trim()}
      data-cric4all-ad={placement}
    >
      <Script
        id="cric4all-google-adsense"
        strategy="afterInteractive"
        async
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
          GOOGLE_ADSENSE_CLIENT
        )}`}
      />

      <div className={styles.frame}>
        <span className={styles.label}>{label}</span>
        <ins
          className={`adsbygoogle ${styles.ad}`}
          data-ad-client={GOOGLE_ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
