"use client";

import { useMemo, useState } from "react";

function normalizeStatus(status) {
  return String(status || "SCHEDULED").toUpperCase();
}

function formatMatchTitle(match) {
  return `${match.teamA?.name || match.teamAName || "Team A"} vs ${
    match.teamB?.name || match.teamBName || "Team B"
  }`;
}

function buildPointsTable(matches, teams) {
  const table = new Map();

  (teams || []).forEach((team) => {
    table.set(Number(team.id), {
      teamId: Number(team.id),
      teamName: team.name,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
    });
  });

  (matches || []).forEach((match) => {
    const status = normalizeStatus(match.status);
    if (!["COMPLETED", "COMPLETED_LOCKED"].includes(status)) return;

    const teamA = table.get(Number(match.teamAId));
    const teamB = table.get(Number(match.teamBId));
    if (!teamA || !teamB) return;

    teamA.played += 1;
    teamB.played += 1;

    const statusText = String(match.statusText || "").toLowerCase();

    if (statusText.includes("tied")) {
      teamA.tied += 1;
      teamB.tied += 1;
      teamA.points += 1;
      teamB.points += 1;
      return;
    }

    if (statusText.includes(String(teamA.teamName).toLowerCase())) {
      teamA.won += 1;
      teamB.lost += 1;
      teamA.points += 2;
      return;
    }

    if (statusText.includes(String(teamB.teamName).toLowerCase())) {
      teamB.won += 1;
      teamA.lost += 1;
      teamB.points += 2;
    }
  });

  return [...table.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      a.teamName.localeCompare(b.teamName)
  );
}

function buildPublicStats(matches) {
  const batting = new Map();
  const bowling = new Map();

  for (const match of matches || []) {
    for (const ball of match.balls || []) {
      const strikerId = Number(ball.strikerId);
      const bowlerId = Number(ball.bowlerId);

      if (strikerId) {
        if (!batting.has(strikerId)) {
          batting.set(strikerId, {
            playerId: strikerId,
            playerName: ball.striker?.name || `Player ${strikerId}`,
            teamName: ball.striker?.team?.name || "",
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            matches: new Set(),
          });
        }

        const row = batting.get(strikerId);
        row.matches.add(match.id);
        row.runs += Number(ball.runsOffBat || 0);

        if (
          ball.extraType !== "WIDE" &&
          ball.extraType !== "NOBALL" &&
          ball.wicketType !== "RETIRED_HURT"
        ) {
          row.balls += 1;
        }

        if (Number(ball.runsOffBat || 0) === 4) row.fours += 1;
        if (Number(ball.runsOffBat || 0) === 6) row.sixes += 1;
      }

      if (bowlerId) {
        if (!bowling.has(bowlerId)) {
          bowling.set(bowlerId, {
            playerId: bowlerId,
            playerName: ball.bowler?.name || `Player ${bowlerId}`,
            teamName: ball.bowler?.team?.name || "",
            balls: 0,
            runs: 0,
            wickets: 0,
            dots: 0,
            matches: new Set(),
          });
        }

        const row = bowling.get(bowlerId);
        row.matches.add(match.id);

        const chargedRuns =
          ball.extraType === "BYE" || ball.extraType === "LEGBYE"
            ? 0
            : Number(ball.totalRuns || 0);

        row.runs += chargedRuns;

        if (
          ball.legalDelivery &&
          ball.extraType !== "WIDE" &&
          ball.extraType !== "NOBALL" &&
          ball.wicketType !== "RETIRED_HURT"
        ) {
          row.balls += 1;
          if (Number(ball.totalRuns || 0) === 0) row.dots += 1;
        }

        if (
          ball.isWicket &&
          !["RUN_OUT", "RETIRED_OUT", "RETIRED_HURT"].includes(ball.wicketType) &&
          ball.extraType !== "NOBALL"
        ) {
          row.wickets += 1;
        }
      }
    }
  }

  const battingRows = [...batting.values()]
    .map((row) => ({
      ...row,
      matches: row.matches.size,
      strikeRate: row.balls ? ((row.runs / row.balls) * 100).toFixed(2) : "0.00",
    }))
    .sort((a, b) => b.runs - a.runs);

  const bowlingRows = [...bowling.values()]
    .map((row) => ({
      ...row,
      matches: row.matches.size,
      overs: `${Math.floor(row.balls / 6)}.${row.balls % 6}`,
      economy: row.balls ? ((row.runs / row.balls) * 6).toFixed(2) : "0.00",
    }))
    .sort((a, b) => b.wickets - a.wickets || Number(a.economy) - Number(b.economy));

  return { battingRows, bowlingRows };
}

export default function PublicLeagueViewClient({ league }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [matchStatusFilter, setMatchStatusFilter] = useState("all");
  const [publicSearch, setPublicSearch] = useState("");
  const [publicStatsTab, setPublicStatsTab] = useState("batting");
  const [publicLeadersTab, setPublicLeadersTab] = useState("batting");

  const years = useMemo(
    () =>
      [...new Set((league.series || []).map((s) => Number(s.year)).filter(Boolean))].sort(
        (a, b) => b - a
      ),
    [league.series]
  );

  function openTab(tabName) {
    setActiveTab(tabName);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openTabAndClear(tabName) {
    setActiveTab(tabName);
    setPublicSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function copyLeagueLink() {
    navigator.clipboard.writeText(window.location.href);
    alert("League link copied.");
  }

  const filteredMatches = useMemo(() => {
    return (league.matches || []).filter((match) => {
      if (selectedSeriesId && Number(match.seriesId) !== Number(selectedSeriesId)) {
        return false;
      }

      if (selectedYear && Number(match.series?.year) !== Number(selectedYear)) {
        return false;
      }

      return true;
    });
  }, [league.matches, selectedSeriesId, selectedYear]);

  const searchResults = useMemo(() => {
    const q = publicSearch.trim().toLowerCase();

    if (!q) return { teams: [], players: [], matches: [] };

    const teams = (league.teams || []).filter((team) =>
      String(team.name || "").toLowerCase().includes(q)
    );

    const players = (league.teams || [])
      .flatMap((team) =>
        (team.players || []).map((player) => ({
          ...player,
          teamName: team.name,
        }))
      )
      .filter((player) =>
        [player.name, player.teamName].filter(Boolean).join(" ").toLowerCase().includes(q)
      );

    const matches = filteredMatches.filter((match) =>
      [
        match.teamA?.name,
        match.teamB?.name,
        match.series?.name,
        match.status,
        match.statusText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );

    return {
      teams: teams.slice(0, 6),
      players: players.slice(0, 8),
      matches: matches.slice(0, 6),
    };
  }, [publicSearch, league.teams, filteredMatches]);

  const liveMatches = filteredMatches.filter((m) =>
    ["LIVE", "IN_PROGRESS"].includes(normalizeStatus(m.status))
  );

  const scheduledMatches = filteredMatches.filter(
    (m) => normalizeStatus(m.status) === "SCHEDULED"
  );

  const completedMatches = filteredMatches.filter((m) =>
    ["COMPLETED", "COMPLETED_LOCKED", "ABANDONED"].includes(normalizeStatus(m.status))
  );

  const visibleMatches = useMemo(() => {
    if (matchStatusFilter === "live") return liveMatches;
    if (matchStatusFilter === "scheduled") return scheduledMatches;
    if (matchStatusFilter === "completed") return completedMatches;
    return filteredMatches;
  }, [matchStatusFilter, liveMatches, scheduledMatches, completedMatches, filteredMatches]);

  const pointsTable = useMemo(
    () => buildPointsTable(filteredMatches, league.teams || []),
    [filteredMatches, league.teams]
  );

  const { battingRows, bowlingRows } = useMemo(
    () => buildPublicStats(filteredMatches),
    [filteredMatches]
  );

  const topRunScorer = battingRows[0];
  const topWicketTaker = bowlingRows[0];
  const topSixHitter = [...battingRows].sort((a, b) => b.sixes - a.sixes)[0];
  const bestStrikeRate = [...battingRows]
    .filter((p) => p.balls >= 5)
    .sort((a, b) => Number(b.strikeRate) - Number(a.strikeRate))[0];
  const bestEconomy = [...bowlingRows]
    .filter((p) => p.balls >= 6)
    .sort((a, b) => Number(a.economy) - Number(b.economy))[0];

return (
  <main className="public-league-portal public-wow-page">
    <section className="public-wow-hero public-one-piece-card">
      <div className="public-wow-top">
        <div className="public-breadcrumb">
          <a href="/explore">Explore</a>
          <span>/</span>
          <strong>{league.name}</strong>
        </div>

        <div className="spectator-pill">👀 Spectator Mode</div>
      </div>

      <div className="public-wow-hero-main">
        <div>
          <h2>{league.name}</h2>
          <p>
            Follow live cricket action, standings, leaders, teams, player stats,
            and public scorecards — all in one beautiful spectator portal.
          </p>
        </div>

        <div className="public-wow-stats">
          <div><span>Visibility</span><strong>{league.visibility}</strong></div>
          <div><span>Teams</span><strong>{league.teams?.length || 0}</strong></div>
          <div><span>Matches</span><strong>{league.matches?.length || 0}</strong></div>
          <div><span>Series</span><strong>{league.series?.length || 0}</strong></div>
        </div>
      </div>

      <div className="public-wow-controls">
        <button type="button" onClick={copyLeagueLink}>🔗 Copy League Link</button>
        <a href="/explore">🧭 Explore Leagues</a>

      </div>
<div className="public-wow-controls">
        <label>
          <span>Year</span>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedSeriesId("");
            }}
          >
            <option value="">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Series</span>
          <select
            value={selectedSeriesId}
            onChange={(e) => setSelectedSeriesId(e.target.value)}
          >
            <option value="">All Series</option>
            {(league.series || [])
              .filter((s) => selectedYear ? Number(s.year) === Number(selectedYear) : true)
              .map((series) => (
                <option key={series.id} value={series.id}>
                  {series.name} • {series.year}
                </option>
              ))}
          </select>
        </label>

</div>
      <div className="public-wow-search">
        <span>🔎 Quick Find</span>
        <input
          value={publicSearch}
          onChange={(e) => setPublicSearch(e.target.value)}
          placeholder="Search teams, players, matches, or series..."
        />
        {publicSearch && (
          <button type="button" onClick={() => setPublicSearch("")}>
            Clear
          </button>
        )}
      </div>

      {publicSearch && (
        <div className="public-search-results-pro">
          {searchResults.teams.length === 0 &&
          searchResults.players.length === 0 &&
          searchResults.matches.length === 0 ? (
            <div className="public-empty-state">
              <strong>🔍 No results found</strong>
              <span>Try a team, player, match, or series name.</span>
            </div>
          ) : (
            <>
              {searchResults.teams.length > 0 && (
                <SearchGroup title="👥 Teams">
                  {searchResults.teams.map((team) => (
                    <a key={team.id} href={`/leagues/${league.slug}/teams/${team.id}`} className="public-search-result-pro">
                      <div><strong>{team.name}</strong><span>{team.players?.length || 0} players</span></div>
                      <b>Open →</b>
                    </a>
                  ))}
                </SearchGroup>
              )}

              {searchResults.players.length > 0 && (
                <SearchGroup title="🏏 Players">
                  {searchResults.players.map((player) => (
                    <a key={player.id} href={`/leagues/${league.slug}/players/${player.id}`} className="public-search-result-pro">
                      <div><strong>{player.name}</strong><span>{player.teamName}</span></div>
                      <b>View →</b>
                    </a>
                  ))}
                </SearchGroup>
              )}

              {searchResults.matches.length > 0 && (
                <SearchGroup title="📋 Matches">
                  {searchResults.matches.map((match) => (
                    <a key={match.id} href={match.shareCode ? `/live/${match.shareCode}` : "#"} className="public-search-result-pro">
                      <div><strong>{formatMatchTitle(match)}</strong><span>{match.series?.name || "No Series"} • {match.status || "SCHEDULED"}</span></div>
                      <b>Scorecard →</b>
                    </a>
                  ))}
                </SearchGroup>
              )}
            </>
          )}
        </div>
      )}

      <nav className="public-league-tabs public-wow-tabs">
        {[
          ["overview", "🏠 Overview"],
          ["matches", "📋 Matches"],
          ["points", "📈 Points"],
          ["stats", "📊 Stats"],
          ["leaders", "🏆 Leaders"],
          ["teams", "👥 Teams"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? "active" : ""}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="public-tab-content">
        {activeTab === "overview" && (
          <>
            <h2>Overview</h2>
            <div className="public-card-grid">
              <button type="button" className="public-card public-card-button" onClick={() => openTab("matches")}>
                <span>Live</span><strong>{liveMatches.length}</strong><small>Open matches</small>
              </button>
              <button type="button" className="public-card public-card-button" onClick={() => openTab("matches")}>
                <span>Scheduled</span><strong>{scheduledMatches.length}</strong><small>Upcoming games</small>
              </button>
              <button type="button" className="public-card public-card-button" onClick={() => openTab("matches")}>
                <span>Completed</span><strong>{completedMatches.length}</strong><small>Past results</small>
              </button>
              <button type="button" className="public-card public-card-button" onClick={() => openTab("points")}>
                <span>Top Team</span><strong>{pointsTable[0]?.teamName || "-"}</strong><small>View points table</small>
              </button>
            </div>
          </>
        )}

        {activeTab === "matches" && (
          <>
            <div className="public-section-head">
              <h2>Matches</h2>
              <button type="button" className="public-mini-tab-btn" onClick={() => openTabAndClear("matches")}>
                View all
              </button>
            </div>

            <div className="public-status-tabs">
              {[
                ["all", `All ${filteredMatches.length}`],
                ["live", `Live ${liveMatches.length}`],
                ["scheduled", `Scheduled ${scheduledMatches.length}`],
                ["completed", `Completed ${completedMatches.length}`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={matchStatusFilter === key ? "active" : ""}
                  onClick={() => setMatchStatusFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="public-match-list">
              {visibleMatches.length === 0 && (
                <div className="public-empty-state">
                  <strong>📭 No matches found</strong>
                  <span>Try changing the Year, Series, or Match Status filter.</span>
                </div>
              )}

              {visibleMatches.map((match) => (
                <div key={match.id} className="public-match-card public-match-card-pro">
                  <div className="public-match-main">
                    <span className={`public-match-status ${normalizeStatus(match.status).toLowerCase()}`}>
                      {match.status || "SCHEDULED"}
                    </span>
                    <strong>{formatMatchTitle(match)}</strong>
                    <small>
                      {match.series?.name || "No Series"}
                      {match.series?.year ? ` • ${match.series.year}` : ""}
                    </small>
                  </div>

                  {match.shareCode ? (
                    <a href={`/leagues/${league.slug}/matches/${match.id}`}>Match Center</a>
                  ) : (
                    <span className="public-muted-action">No scorecard yet</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "points" && (
          <>
            <div className="public-section-head">
              <h2>Points Table</h2>
              <button type="button" className="public-mini-tab-btn" onClick={() => openTabAndClear("points")}>
                View all
              </button>
            </div>

            <div className="table-scroll">
              {pointsTable.length === 0 ? (
                <div className="public-empty-state">
                  <strong>📈 No points table yet</strong>
                  <span>Points will appear after completed matches are available.</span>
                </div>
              ) : (
                <table className="score-table">
                  <thead>
                    <tr>
                      <th>Rank</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointsTable.map((row, index) => (
                      <tr key={row.teamId}>
                        <td><span className="public-rank-badge">#{index + 1}</span></td>
                        <td><strong>{row.teamName}</strong></td>
                        <td>{row.played}</td>
                        <td>{row.won}</td>
                        <td>{row.lost}</td>
                        <td>{row.tied}</td>
                        <td><strong>{row.points}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === "stats" && (
          <>
            <h2>Stats</h2>

            <div className="public-status-tabs">
              {[
                ["batting", `Batting ${battingRows.length}`],
                ["bowling", `Bowling ${bowlingRows.length}`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={publicStatsTab === key ? "active" : ""}
                  onClick={() => setPublicStatsTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {battingRows.length === 0 && bowlingRows.length === 0 ? (
              <div className="public-empty-state">
                <strong>📊 No stats yet</strong>
                <span>Stats will appear after balls are scored in this league.</span>
              </div>
            ) : publicStatsTab === "batting" ? (
              <StatsTable type="batting" rows={battingRows} />
            ) : (
              <StatsTable type="bowling" rows={bowlingRows} />
            )}
          </>
        )}

        {activeTab === "leaders" && (
          <>
            <div className="public-section-head">
              <h2>Leaders</h2>
              <button type="button" className="public-mini-tab-btn" onClick={() => openTabAndClear("leaders")}>
                View all
              </button>
            </div>

            <div className="public-status-tabs">
              {[
                ["batting", "Batting Leaders"],
                ["bowling", "Bowling Leaders"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={publicLeadersTab === key ? "active" : ""}
                  onClick={() => setPublicLeadersTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {!topRunScorer && !topWicketTaker ? (
              <div className="public-empty-state">
                <strong>🏆 No leaders yet</strong>
                <span>League leaders will appear after match scoring begins.</span>
              </div>
            ) : publicLeadersTab === "batting" ? (
              <div className="public-card-grid">
                <LeaderCard title="🏏 Most Runs" row={topRunScorer} value={`${topRunScorer?.runs || 0} runs`} />
                <LeaderCard title="💥 Most Sixes" row={topSixHitter} value={`${topSixHitter?.sixes || 0} sixes`} />
                <LeaderCard title="⚡ Best Strike Rate" row={bestStrikeRate} value={bestStrikeRate?.strikeRate || "0.00"} />
              </div>
            ) : (
              <div className="public-card-grid">
                <LeaderCard title="🎯 Most Wickets" row={topWicketTaker} value={`${topWicketTaker?.wickets || 0} wickets`} />
                <LeaderCard title="🧊 Best Economy" row={bestEconomy} value={bestEconomy?.economy || "0.00"} />
              </div>
            )}
          </>
        )}

        {activeTab === "teams" && (
          <>
            <div className="public-section-head">
              <h2>Teams</h2>
              <button type="button" className="public-mini-tab-btn" onClick={() => openTabAndClear("teams")}>
                View all
              </button>
            </div>

            {league.teams.length === 0 ? (
              <div className="public-empty-state">
                <strong>👥 No teams yet</strong>
                <span>Teams will appear here once they are added to this league.</span>
              </div>
            ) : (
              <div className="public-card-grid">
                {(league.teams || []).map((team) => (
                  <a
                    key={team.id}
                    href={`/leagues/${league.slug}/teams/${team.id}`}
                    className="public-card public-card-link"
                  >
                    <span>Team</span>
                    <strong>{team.name}</strong>
                    <small>{team.players?.length || 0} players</small>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  </main>
);
}

function SearchGroup({ title, children }) {
  return (
    <div className="public-search-group-pro">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

function StatsTable({ type, rows }) {
  return (
    <div className="table-scroll">
      <table className="score-table">
        <thead>
          {type === "batting" ? (
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Team</th>
              <th>Runs</th>
              <th>Balls</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          ) : (
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Team</th>
              <th>Overs</th>
              <th>Runs</th>
              <th>Wickets</th>
              <th>Economy</th>
            </tr>
          )}
        </thead>

        <tbody>
          {rows.map((row, index) =>
            type === "batting" ? (
              <tr key={`${row.playerId}-${index}`}>
                <td>{index + 1}</td>
                <td>{row.playerName}</td>
                <td>{row.teamName}</td>
                <td>{row.runs}</td>
                <td>{row.balls}</td>
                <td>{row.fours}</td>
                <td>{row.sixes}</td>
                <td>{row.strikeRate}</td>
              </tr>
            ) : (
              <tr key={`${row.playerId}-${index}`}>
                <td>{index + 1}</td>
                <td>{row.playerName}</td>
                <td>{row.teamName}</td>
                <td>{row.overs}</td>
                <td>{row.runs}</td>
                <td>{row.wickets}</td>
                <td>{row.economy}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeaderCard({ title, row, value }) {
  return (
    <div className="public-card">
      <span>{title}</span>
      <strong>{row?.playerName || "No data yet"}</strong>
      <small>{row?.teamName || ""}</small>
      <b>{value}</b>
    </div>
  );
}