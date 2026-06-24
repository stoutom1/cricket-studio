"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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
    <main className="public-league-portal public-wow-page">
      <section className="public-wow-hero public-one-piece-card">
        <div className="public-wow-top">
          <div className="public-breadcrumb">
            <strong>Explore</strong>
          </div>

          <div className="spectator-pill">🌐 Public Leagues</div>
        </div>

        <div className="public-wow-hero-main">
          <div>
            <h2>Explore Cricket Leagues</h2>
            <p>
              Discover public cricket leagues, live matches, teams, series,
              standings, and scoreboards powered by Cric4All.
            </p>
          </div>

          <div className="public-wow-stats">
            <div>
              <span>Leagues</span>
              <strong>{leagues.length}</strong>
            </div>

            <div>
              <span>Teams</span>
              <strong>{totalTeams}</strong>
            </div>

            <div>
              <span>Matches</span>
              <strong>{totalMatches}</strong>
            </div>

            <div>
              <span>Series</span>
              <strong>{totalSeries}</strong>
            </div>
          </div>
        </div>

        <div className="public-wow-search">
          <span>🔎 Search</span>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search league, team, series..."
          />

          {query && (
            <button type="button" onClick={() => setQuery("")}>
              Clear
            </button>
          )}
        </div>

        <div className="public-tab-content">
          {!filteredLeagues.length ? (
            <div className="public-empty-state">
              <strong>🔍 No leagues found</strong>
              <span>Try searching by league, team, or series name.</span>
            </div>
          ) : (
            <div className="explore-league-list">
              {filteredLeagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.slug}`}
                  className="explore-league-row"
                >
                  <div className="league-main">
                    <strong>{league.name}</strong>
                    <small>
                      {league.description || "Public cricket league"}
                    </small>
                  </div>

                  <div className="league-stat">
                    <span>Teams</span>
                    <strong>{league.teams?.length || 0}</strong>
                  </div>

                  <div className="league-stat">
                    <span>Matches</span>
                    <strong>{league.matches?.length || 0}</strong>
                  </div>

                  <div className="league-stat">
                    <span>Series</span>
                    <strong>{league.series?.length || 0}</strong>
                  </div>

<div className="league-follow-cell">
  {league.isFollowing ? (
    <span className="following-pill">⭐ Following</span>
  ) : (
    <span className="follow-muted-pill">☆ Not following</span>
  )}
</div>

                  <div className="league-arrow">→</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}