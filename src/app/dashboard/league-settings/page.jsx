"use client";

import { useEffect, useState } from "react";
import LeaguePermissions from "@/components/LeaguePermissions";

export default function LeagueSettingsPage() {
  const [leagueId, setLeagueId] =
    useState(null);

  useEffect(() => {
    async function loadLeague() {
      try {
        const res =
          await fetch("/api/me");

        const data =
          await res.json();

        setLeagueId(
          data.activeLeagueId
        );
      } catch (err) {
        console.error(err);
      }
    }

    loadLeague();
  }, []);

  if (!leagueId) {
    return (
      <div
        style={{
          padding: 24
        }}
      >
        <h2>
          Select a league first
        </h2>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24
      }}
    >
      <h1>
        League Settings
      </h1>

      <LeaguePermissions
        leagueId={leagueId}
      />
    </div>
  );
}