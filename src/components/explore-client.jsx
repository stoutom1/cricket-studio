"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import "@/app/public-league-wow.css";

function getInitials(name) {
  return (
    String(name || "League")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "LG"
  );
}

export default function ExploreClient({ leagues }) {
  const [query, setQuery] = useState("");

  const filteredLeagues = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return leagues;

    return leagues.filter((league) =>
      [
        league.name,
        league.description,
        league.visibility,
        ...(league.teams || []).map((t) => t.name),
        ...(league.series || []).map((s) => s.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, leagues]);

  const totalTeams = leagues.reduce(
    (sum, league) => sum + (league.teams?.length || 0),
    0
  );

  const totalMatches = leagues.reduce(
    (sum, league) => sum + (league.matches?.length || 0),
    0
  );

  const totalSeries = leagues.reduce(
    (sum, league) => sum + (league.series?.length || 0),
    0
  );

  return (
    <main className="sep-page">
      <section className="sep-shell">
        <header className="sep-hero">
          <div className="sep-topline">
            <strong>Explore</strong>

            <span className="sep-public-label">
              <span aria-hidden="true" />
              Public leagues
            </span>
          </div>

          <div className="sep-hero-main">
            <div className="sep-copy">
              <p className="sep-kicker">Cric4All Discovery</p>
              <h2>Explore cricket leagues</h2>
              <p>
                Discover public competitions, teams, fixtures, standings and
                live scoreboards across Cric4All.
              </p>
            </div>

            <div className="sep-summary" aria-label="Public league totals">
              <span><b>{leagues.length}</b> Leagues</span>
              <span><b>{totalTeams}</b> Teams</span>
              <span><b>{totalMatches}</b> Matches</span>
              <span><b>{totalSeries}</b> Series</span>
            </div>
          </div>
        </header>

        <section className="sep-toolbar">
          <div className="sep-search">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search league, team or series"
              aria-label="Search public leagues"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>

          <span className="sep-result-count">
            {filteredLeagues.length}{" "}
            {filteredLeagues.length === 1 ? "league" : "leagues"}
          </span>
        </section>

        <section className="sep-content">
          <div className="sep-section-heading">
            <div>
              <p>Public competitions</p>
              <h2>League directory</h2>
            </div>

            <span>
              Browse active public leagues and open any competition for scores,
              teams and standings.
            </span>
          </div>

          {!filteredLeagues.length ? (
            <div className="sep-empty">
              <span aria-hidden="true">—</span>
              <div>
                <strong>No leagues found</strong>
                <p>Try searching by league, team or series name.</p>
              </div>
            </div>
          ) : (
            <div className="sep-league-list">
              {filteredLeagues.map((league, index) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.slug}`}
                  className="sep-league-row"
                >
                  <span className="sep-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="sep-league-mark" aria-hidden="true">
                    {getInitials(league.name)}
                  </span>

                  <span className="sep-league-main">
                    <small>{league.visibility || "PUBLIC"}</small>
                    <strong>{league.name}</strong>
                    <em>
                      {league.description || "Public cricket league"}
                    </em>
                  </span>

                  <span className="sep-league-stat">
                    <small>Teams</small>
                    <strong>{league.teams?.length || 0}</strong>
                  </span>

                  <span className="sep-league-stat">
                    <small>Matches</small>
                    <strong>{league.matches?.length || 0}</strong>
                  </span>

                  <span className="sep-league-stat">
                    <small>Series</small>
                    <strong>{league.series?.length || 0}</strong>
                  </span>

                  <span
                    className={`sep-follow-state ${
                      league.isFollowing ? "is-following" : ""
                    }`}
                  >
                    <span aria-hidden="true" />
                    {league.isFollowing ? "Following" : "Not following"}
                  </span>

                  <span className="sep-open-action">
                    Open league
                    <b aria-hidden="true">→</b>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="sep-footer-note">
          Public leagues shown here are available for spectator viewing.
        </footer>
      </section>
    </main>
  );
}
