"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export default function ExploreClient({ leagues }) {
  const [search, setSearch] = useState("");

  const filteredLeagues = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return leagues;

    return leagues.filter((league) => {
      const teamNames = (league.teams || [])
        .map((t) => t.name)
        .join(" ");

      const seriesNames = (league.series || [])
        .map((s) => `${s.name} ${s.year}`)
        .join(" ");

      return `${league.name} ${teamNames} ${seriesNames}`
        .toLowerCase()
        .includes(q);
    });
  }, [leagues, search]);

  return (
    <>
      <section className="explore-search-card">
        <div>
          <strong>🔎 Find a league</strong>
          <small>Search by league, team, series, or year.</small>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search public leagues..."
        />

        {search && (
          <button type="button" onClick={() => setSearch("")}>
            Clear
          </button>
        )}
      </section>

      {!filteredLeagues.length ? (
        <section className="explore-empty">
          <h2>No matching leagues found</h2>
          <p>Try searching by league name, team name, series, or year.</p>
        </section>
      ) : (
        <section className="explore-grid">
          {filteredLeagues.map((league) => {
            const totalPlayers = league.teams.reduce(
              (sum, team) => sum + (team.players?.length || 0),
              0
            );

            return (
              <Link
                key={league.id}
                href={`/leagues/${league.slug}`}
                className="explore-league-card"
              >
                <div className="explore-card-top">
                  <span>🏏 Public League</span>
                  <strong>{league.name}</strong>
                </div>

                <div className="explore-card-stats">
                  <div>
                    <strong>{league.teams.length}</strong>
                    <span>Teams</span>
                  </div>

                  <div>
                    <strong>{totalPlayers}</strong>
                    <span>Players</span>
                  </div>

                  <div>
                    <strong>{league.series.length}</strong>
                    <span>Series</span>
                  </div>

                  <div>
                    <strong>{league.matches.length}</strong>
                    <span>Matches</span>
                  </div>
                </div>

                <div className="explore-open">Open League →</div>
              </Link>
            );
          })}
        </section>
      )}
    </>
  );
}