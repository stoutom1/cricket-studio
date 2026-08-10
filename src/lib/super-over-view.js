import { buildSuperOverState } from "@/lib/super-over";

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function playerLookup(match) {
  return new Map(
    [
      ...(match?.teamA?.players || []),
      ...(match?.teamB?.players || []),
    ].map((player) => [Number(player.id), player.name])
  );
}

function teamName(match, teamId) {
  if (Number(teamId) === Number(match?.teamAId)) return match?.teamA?.name || "Team A";
  if (Number(teamId) === Number(match?.teamBId)) return match?.teamB?.name || "Team B";
  return "Team";
}

function ballOutcome(data) {
  if (data?.isWicket) return "W";

  const extraType = String(data?.extraType || "NONE").toUpperCase();
  const extras = number(data?.extras);
  const runsOffBat = number(data?.runsOffBat);

  if (extraType === "WIDE") return extras > 1 ? `${extras}WD` : "WD";
  if (extraType === "NOBALL") {
    const total = number(data?.totalRuns);
    return total > 1 ? `${total}NB` : "NB";
  }
  if (extraType === "BYE") return extras > 1 ? `${extras}B` : "B";
  if (extraType === "LEGBYE") return extras > 1 ? `${extras}LB` : "LB";

  return String(runsOffBat);
}

function buildInningsView(match, innings, teamId, playerMap) {
  const setup = innings?.setup || {};
  const balls = innings?.balls || [];

  const batterIds = [setup.batter1Id, setup.batter2Id, setup.batter3Id]
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);

  const batterMap = new Map(
    batterIds.map((id) => [
      id,
      {
        playerId: id,
        playerName: playerMap.get(id) || `Player ${id}`,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dismissal: "not out",
      },
    ])
  );

  const bowlerId = Number(setup.bowlerId || innings?.bowlerId || 0);
  const bowler = {
    playerId: bowlerId || null,
    playerName: bowlerId ? playerMap.get(bowlerId) || `Player ${bowlerId}` : "-",
    legalBalls: 0,
    runs: 0,
    wickets: 0,
  };

  let score = 0;
  let wickets = 0;
  let legalBalls = 0;

  const commentary = balls.map((event, index) => {
    const data = event?.data || {};
    const strikerId = Number(data.strikerId || event?.strikerId || 0);
    const nonStrikerId = Number(data.nonStrikerId || event?.nonStrikerId || 0);
    const currentBowlerId = Number(data.bowlerId || bowlerId || 0);

    if (strikerId && !batterMap.has(strikerId)) {
      batterMap.set(strikerId, {
        playerId: strikerId,
        playerName: playerMap.get(strikerId) || `Player ${strikerId}`,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dismissal: "not out",
      });
    }

    const striker = batterMap.get(strikerId);
    const runsOffBat = number(data.runsOffBat);
    const totalRuns = number(data.totalRuns);
    const legal = Boolean(data.legalDelivery);
    const wicket = Boolean(data.isWicket);

    const overNo = Math.floor(legalBalls / 6);
    const ballNo = (legalBalls % 6) + 1;
    const over = `${overNo}.${ballNo}`;

    if (striker) {
      striker.runs += runsOffBat;
      if (legal) striker.balls += 1;
      if (runsOffBat === 4) striker.fours += 1;
      if (runsOffBat === 6) striker.sixes += 1;
      if (wicket) striker.dismissal = "out";
    }

    bowler.runs += totalRuns;
    if (legal) {
      bowler.legalBalls += 1;
      legalBalls += 1;
    }
    if (wicket) {
      bowler.wickets += 1;
      wickets += 1;
    }

    score += totalRuns;

    const strikerName = striker?.playerName || playerMap.get(strikerId) || "Batter";
    const nonStrikerName = playerMap.get(nonStrikerId) || "Non-striker";
    const bowlerName = playerMap.get(currentBowlerId) || bowler.playerName || "Bowler";
    const outcome = ballOutcome(data);

    let text;
    if (wicket) {
      text = `${bowlerName} to ${strikerName}: WICKET`;
      if (totalRuns > 0) text += `, ${totalRuns} run${totalRuns === 1 ? "" : "s"}`;
    } else if (String(data.extraType || "NONE").toUpperCase() === "WIDE") {
      text = `${bowlerName} to ${strikerName}: ${number(data.extras)} wide${number(data.extras) === 1 ? "" : "s"}`;
    } else if (String(data.extraType || "NONE").toUpperCase() === "NOBALL") {
      text = `${bowlerName} to ${strikerName}: no-ball, ${totalRuns} total`;
    } else {
      text = `${bowlerName} to ${strikerName}: ${runsOffBat} run${runsOffBat === 1 ? "" : "s"}`;
    }

    return {
      id: event?.id || `super-${index}`,
      type: "BALL",
      over,
      badge: outcome,
      badgeClass: wicket
        ? "wicket-pill"
        : String(data.extraType || "").toUpperCase() === "WIDE"
          ? "wide-pill"
          : String(data.extraType || "").toUpperCase() === "NOBALL"
            ? "noball-pill"
            : runsOffBat === 4
              ? "four-pill"
              : runsOffBat === 6
                ? "six-pill"
                : "",
      text,
      score: `${score}/${wickets}`,
      strikerSummary: `${strikerName} ${striker?.runs || 0} (${striker?.balls || 0})`,
      nonStrikerSummary: nonStrikerName,
      bowlerSummary: `${bowlerName} ${Math.floor(bowler.legalBalls / 6)}.${bowler.legalBalls % 6}-${bowler.runs}-${bowler.wickets}`,
      strikerId,
      nonStrikerId,
      bowlerId: currentBowlerId || null,
      runsOffBat,
      extras: number(data.extras),
      extraType: String(data.extraType || "NONE").toUpperCase(),
      totalRuns,
      isWicket: wicket,
      legalDelivery: legal,
    };
  });

  const batting = Array.from(batterMap.values())
    .filter((row) => row.playerId)
    .map((row) => ({
      ...row,
      strikeRate: row.balls > 0 ? ((row.runs / row.balls) * 100).toFixed(2) : "0.00",
    }));

  return {
    teamId: Number(teamId),
    teamName: teamName(match, teamId),
    runs: number(innings?.runs),
    wickets: number(innings?.wickets),
    legalBalls: number(innings?.legalBalls),
    overs: innings?.overs || "0.0",
    complete: Boolean(innings?.complete),
    batting,
    bowling: [
      {
        ...bowler,
        overs: `${Math.floor(bowler.legalBalls / 6)}.${bowler.legalBalls % 6}`,
        economy: bowler.legalBalls > 0 ? ((bowler.runs * 6) / bowler.legalBalls).toFixed(2) : "0.00",
      },
    ].filter((row) => row.playerId),
    commentary,
  };
}

export function buildSuperOverView(match) {
  const state = buildSuperOverState(match);
  const playerMap = playerLookup(match);

  if (!state.exists) {
    return {
      exists: false,
      active: false,
      completed: false,
      tied: false,
      round: 0,
      currentSuperInnings: 0,
      target: null,
      winnerTeamId: null,
      resultText: null,
      history: [],
      commentary: [],
    };
  }

  const history = (state.history || []).map((round) => {
    const first = buildInningsView(match, round.first, round.firstBattingTeamId, playerMap);
    const second = buildInningsView(match, round.second, round.secondBattingTeamId, playerMap);
    const resultText = round.result?.resultText || round.result?.roundResult || null;

    return {
      round: Number(round.round),
      completed: Boolean(round.completed),
      tied: Boolean(round.tied),
      resultText,
      first,
      second,
    };
  });

  const commentary = history.flatMap((round) => [
    {
      inningsNo: `SO-${round.round}-1`,
      title: `⚡ Super Over ${round.round} • ${round.first.teamName}`,
      superOver: true,
      round: round.round,
      superInnings: 1,
      items: round.first.commentary,
    },
    {
      inningsNo: `SO-${round.round}-2`,
      title: `⚡ Super Over ${round.round} • ${round.second.teamName}`,
      superOver: true,
      round: round.round,
      superInnings: 2,
      items: round.second.commentary,
    },
  ]);

  return {
    exists: true,
    active: Boolean(state.active),
    completed: Boolean(state.completed),
    tied: Boolean(state.tied),
    round: Number(state.round || 0),
    currentSuperInnings: Number(state.currentSuperInnings || 0),
    target: state.target ?? null,
    winnerTeamId: state.winnerTeamId ?? null,
    resultText: state.resultText || null,
    history,
    commentary,
  };
}
