"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "@/app/public-league-wow.css";

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
    if (!["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(status)) return;

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
  const [isFollowing, setIsFollowing] = useState(Boolean(league.isFollowing));
  const [followBusy, setFollowBusy] = useState(false);
async function toggleFollowLeague() {
  try {
    setFollowBusy(true);

    const res = await fetch(`/api/leagues/${league.id}/follow`, {
      method: isFollowing ? "DELETE" : "POST",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Unable to follow league.");
    }

    setIsFollowing(Boolean(data.followed));
  } catch (err) {
    alert(err.message);
  } finally {
    setFollowBusy(false);
  }
}

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
    ["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED", "ABANDONED"].includes(normalizeStatus(m.status))
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
    <main className="slp-page">
      <section className="slp-shell">
        <header className="slp-hero">
          <div className="slp-topline">
            <nav className="slp-breadcrumb" aria-label="Breadcrumb">
              <a href="/explore">Explore</a>
              <span>/</span>
              <strong>{league.name}</strong>
            </nav>

            <span className="slp-public-label">
              <span aria-hidden="true" />
              Live league
            </span>
          </div>

          <div className="slp-hero-main">
            <div className="slp-league-copy">
              <p className="slp-kicker">Cric4All Competition</p>
              <h1>{league.name}</h1>
              <p>
                Scores, fixtures, standings and player performances—built for
                spectators who want the cricket first.
              </p>

              <div className="slp-league-facts" aria-label="League summary">
                <span><b>{league.teams?.length || 0}</b> Teams</span>
                <span><b>{league.matches?.length || 0}</b> Matches</span>
                <span><b>{league.series?.length || 0}</b> Series</span>
                <span><b>{liveMatches.length}</b> Live</span>
              </div>
            </div>

            <div className="slp-actions">
              <button
                type="button"
                className={`slp-follow ${isFollowing ? "is-following" : ""}`}
                onClick={toggleFollowLeague}
                disabled={followBusy}
              >
                <Icon name={isFollowing ? "check" : "star"} />
                {followBusy
                  ? "Saving..."
                  : isFollowing
                    ? "Following"
                    : "Follow league"}
              </button>

              <button type="button" onClick={copyLeagueLink}>
                <Icon name="link" />
                Copy link
              </button>

              <a href="/explore">
                <Icon name="compass" />
                Explore
              </a>
            </div>
          </div>
        </header>

        <div className="slp-utility-bar">
          <div className="slp-filters">
            <label>
              <span>Season</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedSeriesId("");
                }}
              >
                <option value="">All years</option>
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
                <option value="">All series</option>
                {(league.series || [])
                  .filter((series) =>
                    selectedYear
                      ? Number(series.year) === Number(selectedYear)
                      : true
                  )
                  .map((series) => (
                    <option key={series.id} value={series.id}>
                      {series.name} · {series.year}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="slp-search-wrap">
            <div className="slp-search">
              <Icon name="search" />
              <input
                value={publicSearch}
                onChange={(e) => setPublicSearch(e.target.value)}
                placeholder="Search teams, players or matches"
                aria-label="Search this league"
              />
              {publicSearch && (
                <button
                  type="button"
                  onClick={() => setPublicSearch("")}
                  aria-label="Clear search"
                >
                  <Icon name="close" />
                </button>
              )}
            </div>

            {publicSearch && (
              <SearchResults searchResults={searchResults} league={league} />
            )}
          </div>
        </div>

        <nav className="slp-tabs" aria-label="League sections">
          {[
            ["overview", "Overview"],
            ["matches", "Matches"],
            ["points", "Standings"],
            ["stats", "Stats"],
            ["leaders", "Leaders"],
            ["teams", "Teams"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? "active" : ""}
              onClick={() => setActiveTab(key)}
              aria-current={activeTab === key ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="slp-content">
          {activeTab === "overview" && (
            <OverviewSection
              liveMatches={liveMatches}
              scheduledMatches={scheduledMatches}
              completedMatches={completedMatches}
              pointsTable={pointsTable}
              topRunScorer={topRunScorer}
              topWicketTaker={topWicketTaker}
              leagueSlug={league.slug}
              openTab={openTab}
            />
          )}

          {activeTab === "matches" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Fixtures and results"
                title="Matches"
                description={`${filteredMatches.length} matches in this view`}
              />

              <SegmentedControl
                value={matchStatusFilter}
                onChange={setMatchStatusFilter}
                items={[
                  ["all", "All", filteredMatches.length],
                  ["live", "Live", liveMatches.length],
                  ["scheduled", "Scheduled", scheduledMatches.length],
                  ["completed", "Completed", completedMatches.length],
                ]}
              />

              {visibleMatches.length === 0 ? (
                <EmptyState
                  title="No matches found"
                  message="Try changing the year, series or match-status filter."
                />
              ) : (
                <div className="slp-match-list">
                  {visibleMatches.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      leagueSlug={league.slug}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "points" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Competition"
                title="Standings"
                description="Calculated from completed matches"
              />

              {pointsTable.length === 0 ? (
                <EmptyState
                  title="No standings yet"
                  message="The table will appear after completed matches."
                />
              ) : (
                <PointsTable rows={pointsTable} />
              )}
            </section>
          )}

          {activeTab === "stats" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Player performance"
                title="Statistics"
                description="Batting and bowling numbers from selected matches"
              />

              <SegmentedControl
                value={publicStatsTab}
                onChange={setPublicStatsTab}
                items={[
                  ["batting", "Batting", battingRows.length],
                  ["bowling", "Bowling", bowlingRows.length],
                ]}
              />

              {battingRows.length === 0 && bowlingRows.length === 0 ? (
                <EmptyState
                  title="No statistics yet"
                  message="Statistics will appear after balls are scored."
                />
              ) : publicStatsTab === "batting" ? (
                <StatsTable type="batting" rows={battingRows} />
              ) : (
                <StatsTable type="bowling" rows={bowlingRows} />
              )}
            </section>
          )}

          {activeTab === "leaders" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="Top performers"
                title="League leaders"
                description="The competition's standout players"
              />

              <SegmentedControl
                value={publicLeadersTab}
                onChange={setPublicLeadersTab}
                items={[
                  ["batting", "Batting", null],
                  ["bowling", "Bowling", null],
                ]}
              />

              {!topRunScorer && !topWicketTaker ? (
                <EmptyState
                  title="No leaders yet"
                  message="Leaders will appear after scoring begins."
                />
              ) : publicLeadersTab === "batting" ? (
                <div className="slp-leaders">
                  <LeaderRow
                    rank="01"
                    label="Most runs"
                    row={topRunScorer}
                    value={`${topRunScorer?.runs || 0} runs`}
                  />
                  <LeaderRow
                    rank="02"
                    label="Most sixes"
                    row={topSixHitter}
                    value={`${topSixHitter?.sixes || 0} sixes`}
                  />
                  <LeaderRow
                    rank="03"
                    label="Best strike rate"
                    row={bestStrikeRate}
                    value={`${bestStrikeRate?.strikeRate || "0.00"} SR`}
                  />
                </div>
              ) : (
                <div className="slp-leaders">
                  <LeaderRow
                    rank="01"
                    label="Most wickets"
                    row={topWicketTaker}
                    value={`${topWicketTaker?.wickets || 0} wickets`}
                  />
                  <LeaderRow
                    rank="02"
                    label="Best economy"
                    row={bestEconomy}
                    value={`${bestEconomy?.economy || "0.00"} economy`}
                  />
                </div>
              )}
            </section>
          )}

          {activeTab === "teams" && (
            <section className="slp-section">
              <SectionHeader
                eyebrow="League directory"
                title="Teams"
                description={`${league.teams?.length || 0} participating teams`}
              />

              {(league.teams || []).length === 0 ? (
                <EmptyState
                  title="No teams yet"
                  message="Teams will appear once they are added."
                />
              ) : (
                <div className="slp-team-list">
                  {(league.teams || []).map((team, index) => (
                    <a
                      key={team.id}
                      href={`/leagues/${league.slug}/teams/${team.id}`}
                      className="slp-team-row"
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span className="slp-avatar">{getInitials(team.name)}</span>
                      <span>
                        <strong>{team.name}</strong>
                        <small>{team.players?.length || 0} players</small>
                      </span>
                      <b>View team →</b>
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function getInitials(value) {
  return String(value || "C")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function OverviewSection({
  liveMatches,
  scheduledMatches,
  completedMatches,
  pointsTable,
  topRunScorer,
  topWicketTaker,
  leagueSlug,
  openTab,
}) {
  const fallbackMatch =
    scheduledMatches[0] || completedMatches[0] || null;

  return (
    <section className="slp-overview">
      <LiveMatchRail
        liveMatches={liveMatches}
        fallbackMatch={fallbackMatch}
        leagueSlug={leagueSlug}
        openTab={openTab}
      />

      <div className="slp-overview-layout">
        <section className="slp-overview-block">
          <div className="slp-block-heading">
            <div>
              <p>Competition pulse</p>
              <h2>League at a glance</h2>
            </div>
          </div>

          <div className="slp-numbers">
            <button type="button" onClick={() => openTab("matches")}>
              <span>Live</span>
              <strong>{liveMatches.length}</strong>
              <small>Matches happening now</small>
            </button>

            <button type="button" onClick={() => openTab("matches")}>
              <span>Upcoming</span>
              <strong>{scheduledMatches.length}</strong>
              <small>Scheduled fixtures</small>
            </button>

            <button type="button" onClick={() => openTab("matches")}>
              <span>Finished</span>
              <strong>{completedMatches.length}</strong>
              <small>Completed results</small>
            </button>

            <button type="button" onClick={() => openTab("points")}>
              <span>Table leader</span>
              <strong className="is-name">
                {pointsTable[0]?.teamName || "—"}
              </strong>
              <small>Current standings leader</small>
            </button>
          </div>
        </section>

        <section className="slp-overview-block">
          <div className="slp-block-heading">
            <div>
              <p>Form players</p>
              <h2>Top performers</h2>
            </div>
            <button type="button" onClick={() => openTab("leaders")}>
              All leaders
            </button>
          </div>

          {!topRunScorer && !topWicketTaker ? (
            <EmptyState
              title="No performers yet"
              message="Player leaders will appear after scoring starts."
            />
          ) : (
            <div className="slp-performers">
              {topRunScorer && (
                <button type="button" onClick={() => openTab("leaders")}>
                  <span className="slp-avatar">
                    {getInitials(topRunScorer.playerName)}
                  </span>
                  <span>
                    <small>Top run scorer</small>
                    <strong>{topRunScorer.playerName}</strong>
                    <em>{topRunScorer.teamName || "League player"}</em>
                  </span>
                  <b>{topRunScorer.runs}</b>
                  <i>runs</i>
                </button>
              )}

              {topWicketTaker && (
                <button type="button" onClick={() => openTab("leaders")}>
                  <span className="slp-avatar">
                    {getInitials(topWicketTaker.playerName)}
                  </span>
                  <span>
                    <small>Top wicket taker</small>
                    <strong>{topWicketTaker.playerName}</strong>
                    <em>{topWicketTaker.teamName || "League player"}</em>
                  </span>
                  <b>{topWicketTaker.wickets}</b>
                  <i>wickets</i>
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function LiveMatchRail({
  liveMatches,
  fallbackMatch,
  leagueSlug,
  openTab,
}) {
  const railRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const matches = liveMatches.length
    ? liveMatches
    : fallbackMatch
      ? [fallbackMatch]
      : [];

  const hasMultipleLiveMatches = liveMatches.length > 1;
  const isShowingLiveMatches = liveMatches.length > 0;

  function scrollToMatch(index) {
    const rail = railRef.current;
    if (!rail || !matches.length) return;

    const normalizedIndex =
      (index + matches.length) % matches.length;
    const card = rail.children[normalizedIndex];

    if (!card) return;

    rail.scrollTo({
      left: card.offsetLeft - rail.offsetLeft,
      behavior: "smooth",
    });

    setActiveIndex(normalizedIndex);
  }

  function handleRailScroll() {
    const rail = railRef.current;
    if (!rail || !matches.length) return;

    const cards = Array.from(rail.children);
    const nearestIndex = cards.reduce(
      (bestIndex, card, index) => {
        const bestCard = cards[bestIndex];
        const cardDistance = Math.abs(card.offsetLeft - rail.scrollLeft);
        const bestDistance = Math.abs(
          bestCard.offsetLeft - rail.scrollLeft
        );

        return cardDistance < bestDistance ? index : bestIndex;
      },
      0
    );

    setActiveIndex(nearestIndex);
  }

  useEffect(() => {
    if (!hasMultipleLiveMatches || isPaused) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % matches.length;

        window.requestAnimationFrame(() => {
          const rail = railRef.current;
          const card = rail?.children?.[nextIndex];

          if (rail && card) {
            rail.scrollTo({
              left: card.offsetLeft - rail.offsetLeft,
              behavior: "smooth",
            });
          }
        });

        return nextIndex;
      });
    }, 7000);

    return () => window.clearInterval(timer);
  }, [hasMultipleLiveMatches, isPaused, matches.length]);

  if (!matches.length) {
    return (
      <EmptyState
        title="No matches yet"
        message="Fixtures will appear here when they are created."
      />
    );
  }

  return (
    <section
      className="slp-live-rail-section"
      aria-label={
        isShowingLiveMatches ? "Live matches" : "Featured match"
      }
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="slp-live-rail-head">
        <div>
          <p>
            {isShowingLiveMatches
              ? "Live cricket"
              : normalizeStatus(matches[0]?.status) === "SCHEDULED"
                ? "Next fixture"
                : "Latest result"}
          </p>
          <h2>
            {isShowingLiveMatches
              ? `${liveMatches.length} ${
                  liveMatches.length === 1 ? "match" : "matches"
                } live now`
              : "Featured match"}
          </h2>
        </div>

        <div className="slp-live-rail-tools">
          {hasMultipleLiveMatches && (
            <>
              <span>
                {activeIndex + 1} / {matches.length}
              </span>

              <button
                type="button"
                onClick={() => scrollToMatch(activeIndex - 1)}
                aria-label="Previous live match"
              >
                ←
              </button>

              <button
                type="button"
                onClick={() => scrollToMatch(activeIndex + 1)}
                aria-label="Next live match"
              >
                →
              </button>
            </>
          )}

          <button
            type="button"
            className="slp-view-all-live"
            onClick={() => openTab("matches")}
          >
            View all
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="slp-live-rail"
        onScroll={handleRailScroll}
      >
        {matches.map((match, index) => {
          const isLive = ["LIVE", "IN_PROGRESS"].includes(
            normalizeStatus(match.status)
          );

          return (
            <article
              key={match.id}
              className={`slp-live-card ${
                isLive ? "is-live" : ""
              }`}
              aria-current={activeIndex === index ? "true" : undefined}
            >
              <div className="slp-live-card-status">
                {isLive && <span aria-hidden="true" />}
                {isLive
                  ? "Live now"
                  : normalizeStatus(match.status) === "SCHEDULED"
                    ? "Upcoming"
                    : "Latest result"}
              </div>

              <div className="slp-live-card-copy">
                <small>{match.series?.name || "League match"}</small>
                <h3>{formatMatchTitle(match)}</h3>
                <p>
                  {match.statusText ||
                    formatStatusLabel(match.status)}
                </p>
              </div>

              {match.shareCode ? (
                <a href={`/leagues/${leagueSlug}/matches/${match.id}`}>
                  Match center
                  <Icon name="arrowRight" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => openTab("matches")}
                >
                  View fixture
                  <Icon name="arrowRight" />
                </button>
              )}
            </article>
          );
        })}
      </div>

      {hasMultipleLiveMatches && (
        <div
          className="slp-live-dots"
          aria-label="Select live match"
        >
          {matches.map((match, index) => (
            <button
              key={match.id}
              type="button"
              className={activeIndex === index ? "active" : ""}
              onClick={() => scrollToMatch(index)}
              aria-label={`Show live match ${index + 1}`}
              aria-current={activeIndex === index ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SearchResults({ searchResults, league }) {
  const isEmpty =
    searchResults.teams.length === 0 &&
    searchResults.players.length === 0 &&
    searchResults.matches.length === 0;

  return (
    <div className="slp-search-results">
      {isEmpty ? (
        <div className="slp-search-empty">
          <strong>No results found</strong>
          <span>Try another team, player, match or series.</span>
        </div>
      ) : (
        <>
          {searchResults.teams.length > 0 && (
            <SearchGroup title="Teams">
              {searchResults.teams.map((team) => (
                <a
                  key={team.id}
                  href={`/leagues/${league.slug}/teams/${team.id}`}
                >
                  <span className="slp-avatar">{getInitials(team.name)}</span>
                  <span>
                    <strong>{team.name}</strong>
                    <small>{team.players?.length || 0} players</small>
                  </span>
                  <b>→</b>
                </a>
              ))}
            </SearchGroup>
          )}

          {searchResults.players.length > 0 && (
            <SearchGroup title="Players">
              {searchResults.players.map((player) => (
                <a
                  key={player.id}
                  href={`/leagues/${league.slug}/players/${player.id}`}
                >
                  <span className="slp-avatar">{getInitials(player.name)}</span>
                  <span>
                    <strong>{player.name}</strong>
                    <small>{player.teamName}</small>
                  </span>
                  <b>→</b>
                </a>
              ))}
            </SearchGroup>
          )}

          {searchResults.matches.length > 0 && (
            <SearchGroup title="Matches">
              {searchResults.matches.map((match) =>
                match.shareCode ? (
                  <a key={match.id} href={`/live/${match.shareCode}`}>
                    <span className="slp-avatar">VS</span>
                    <span>
                      <strong>{formatMatchTitle(match)}</strong>
                      <small>
                        {match.series?.name || "No series"} ·{" "}
                        {formatStatusLabel(match.status)}
                      </small>
                    </span>
                    <b>→</b>
                  </a>
                ) : (
                  <div key={match.id} className="is-disabled">
                    <span className="slp-avatar">VS</span>
                    <span>
                      <strong>{formatMatchTitle(match)}</strong>
                      <small>Scorecard unavailable</small>
                    </span>
                  </div>
                )
              )}
            </SearchGroup>
          )}
        </>
      )}
    </div>
  );
}

function SearchGroup({ title, children }) {
  return (
    <section className="slp-search-group">
      <p>{title}</p>
      <div>{children}</div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="slp-section-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <span>{description}</span>
    </div>
  );
}

function SegmentedControl({ value, onChange, items }) {
  return (
    <div className="slp-segments">
      {items.map(([key, label, count]) => (
        <button
          key={key}
          type="button"
          className={value === key ? "active" : ""}
          onClick={() => onChange(key)}
        >
          {label}
          {count !== null && count !== undefined && <b>{count}</b>}
        </button>
      ))}
    </div>
  );
}

function MatchRow({ match, leagueSlug }) {
  const status = normalizeStatus(match.status);
  const isLive = ["LIVE", "IN_PROGRESS"].includes(status);

  return (
    <article className="slp-match-row">
      <div className={`slp-status ${getStatusClass(status)}`}>
        {isLive && <span />}
        {formatStatusLabel(match.status)}
      </div>

      <div className="slp-match-copy">
        <small>
          {match.series?.name || "No series"}
          {match.series?.year ? ` · ${match.series.year}` : ""}
        </small>
        <strong>{formatMatchTitle(match)}</strong>
        {match.statusText && <p>{match.statusText}</p>}
      </div>

      <div className="slp-match-date">
        <span>{getMatchDatePart(match, "day")}</span>
        <b>{getMatchDatePart(match, "month")}</b>
      </div>

      {match.shareCode ? (
        <a href={`/leagues/${leagueSlug}/matches/${match.id}`}>
          Match center →
        </a>
      ) : (
        <span className="slp-unavailable">Unavailable</span>
      )}
    </article>
  );
}

function PointsTable({ rows }) {
  return (
    <div className="slp-table-wrap">
      <table className="slp-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Team</th>
            <th>P</th>
            <th>W</th>
            <th>L</th>
            <th>T</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.teamId}>
              <td><span className="slp-rank">{index + 1}</span></td>
              <td>
                <span className="slp-table-team">
                  <span className="slp-avatar">{getInitials(row.teamName)}</span>
                  <strong>{row.teamName}</strong>
                </span>
              </td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              <td>{row.tied}</td>
              <td><strong>{row.points}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsTable({ type, rows }) {
  return (
    <div className="slp-table-wrap">
      <table className="slp-table">
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
          {rows.map((row, index) => (
            <tr key={`${row.playerId}-${index}`}>
              <td><span className="slp-rank">{index + 1}</span></td>
              <td>
                <span className="slp-table-team">
                  <span className="slp-avatar">{getInitials(row.playerName)}</span>
                  <strong>{row.playerName}</strong>
                </span>
              </td>
              <td>{row.teamName || "—"}</td>
              {type === "batting" ? (
                <>
                  <td><strong>{row.runs}</strong></td>
                  <td>{row.balls}</td>
                  <td>{row.fours}</td>
                  <td>{row.sixes}</td>
                  <td><strong>{row.strikeRate}</strong></td>
                </>
              ) : (
                <>
                  <td>{row.overs}</td>
                  <td>{row.runs}</td>
                  <td><strong>{row.wickets}</strong></td>
                  <td><strong>{row.economy}</strong></td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderRow({ rank, label, row, value }) {
  return (
    <article className="slp-leader-row">
      <span className="slp-leader-rank">{rank}</span>
      <span className="slp-avatar">{getInitials(row?.playerName || "?")}</span>
      <span>
        <small>{label}</small>
        <strong>{row?.playerName || "No data yet"}</strong>
        <em>{row?.teamName || "Statistics pending"}</em>
      </span>
      <b>{value}</b>
    </article>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="slp-empty">
      <span>—</span>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

function getMatchDatePart(match, part) {
  const candidate =
    match.matchDate ||
    match.scheduledAt ||
    match.startTime ||
    match.createdAt;

  if (!candidate) return part === "day" ? "—" : "";

  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) return part === "day" ? "—" : "";

  if (part === "day") return String(date.getDate()).padStart(2, "0");

  return date
    .toLocaleString("en-US", { month: "short" })
    .toUpperCase();
}

function formatStatusLabel(status) {
  return normalizeStatus(status)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClass(status) {
  if (["LIVE", "IN_PROGRESS"].includes(status)) return "is-live";
  if (["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(status)) {
    return "is-completed";
  }
  if (status === "ABANDONED") return "is-abandoned";
  return "is-scheduled";
}

function Icon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" /></>,
    arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  };

  return (
    <svg
      className="slp-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.arrowRight}
    </svg>
  );
}
