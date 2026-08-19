"use client";

import {
  useEffect,
  useState,
} from "react";

export default function FollowedLeaguesDrawerContent() {
  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    rows,
    setRows,
  ] =
    useState([]);

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(
    () => {
      let active =
        true;

      async function load() {
        try {
          const response =
            await fetch(
              "/api/leagues/followed",
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
              "Unable to load followed leagues."
            );
          }

          if (active) {
            setRows(
              Array.isArray(
                data?.leagues
              )
                ? data.leagues
                : []
            );
          }
        } catch (
          loadError
        ) {
          if (active) {
            setError(
              loadError?.message ||
              "Unable to load followed leagues."
            );
          }
        } finally {
          if (active) {
            setLoading(
              false
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
    []
  );

  if (loading) {
    return (
      <div
        style={{
          padding:
            16,
          opacity:
            0.78,
        }}
      >
        Loading followed leagues…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding:
            16,
        }}
      >
        <strong>
          Unable to load followed leagues
        </strong>
        <p
          style={{
            margin:
              "6px 0 0",
            opacity:
              0.75,
          }}
        >
          {error}
        </p>
      </div>
    );
  }

  if (
    rows.length ===
    0
  ) {
    return (
      <a
        href="/explore"
        className="public-league-explore-card"
      >
        <strong>
          Explore public leagues
        </strong>
        <span>
          Follow leagues to keep them here and enable match alerts.
        </span>
        <b>
          Open Explore →
        </b>
      </a>
    );
  }

  return (
    <div
      style={{
        display:
          "grid",
        gap:
          10,
        marginTop:
          12,
      }}
    >
      {rows.map(
        (league) => (
          <a
            key={
              league.id
            }
            href={`/leagues/${league.slug}`}
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "minmax(0,1fr) auto",
              alignItems:
                "center",
              gap:
                10,
              padding:
                12,
              borderRadius:
                13,
              border:
                "1px solid rgba(148,163,184,.16)",
              background:
                "rgba(15,23,42,.32)",
              color:
                "inherit",
              textDecoration:
                "none",
              minWidth:
                0,
            }}
          >
            <span
              style={{
                minWidth:
                  0,
              }}
            >
              <strong
                style={{
                  display:
                    "block",
                  overflowWrap:
                    "anywhere",
                }}
              >
                ⭐ {league.name}
              </strong>

              <small
                style={{
                  display:
                    "block",
                  marginTop:
                    4,
                  opacity:
                    0.72,
                  lineHeight:
                    1.35,
                }}
              >
                {league.teamCount} teams · {league.matchCount} matches
                {league.liveMatches?.length
                  ? ` · 🔴 ${league.liveMatches.length} live`
                  : ""}
              </small>

              <small
                style={{
                  display:
                    "block",
                  marginTop:
                    3,
                  opacity:
                    0.75,
                }}
              >
                {league.alertsEnabled
                  ? "🔔 Match alerts enabled"
                  : "Alerts off"}
              </small>
            </span>

            <b
              style={{
                whiteSpace:
                  "nowrap",
              }}
            >
              Open →
            </b>
          </a>
        )
      )}

      <a
        href="/explore"
        className="public-league-explore-card"
      >
        <strong>
          Discover more leagues
        </strong>
        <span>
          Browse public Cric4All competitions.
        </span>
        <b>
          Open Explore →
        </b>
      </a>
    </div>
  );
}
