export function formatOversFromBalls(balls) {
  const overs = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${overs}.${rem}`;
}

function getInningsSummary(match, inningsNo) {
  const balls = (match.balls || []).filter(
    (b) => Number(b.inningsNo) === inningsNo
  );

  return {
    runs: balls.reduce((sum, b) => sum + Number(b.totalRuns || 0), 0),
    wickets: balls.reduce(
      (sum, b) =>
        sum + (b.isWicket && b.wicketType !== "RETIRED_HURT" ? 1 : 0),
      0
    ),
    legalBalls: balls.filter((b) => b.legalDelivery).length,
  };
}

export function buildPointsTable({ teams, matches }) {
  const table = new Map();

  teams.forEach((team) => {
    table.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      runsFor: 0,
      ballsFor: 0,
      runsAgainst: 0,
      ballsAgainst: 0,
      nrr: "0.000",
    });
  });

  matches.forEach((match) => {
    const status = String(match.status || "").toUpperCase();

    if (!["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED", "ABANDONED"].includes(status)) {
      return;
    }

    const teamA = table.get(match.teamAId);
    const teamB = table.get(match.teamBId);

    if (!teamA || !teamB) return;

    teamA.played += 1;
    teamB.played += 1;

    if (status === "ABANDONED") {
      teamA.noResult += 1;
      teamB.noResult += 1;
      teamA.points += 1;
      teamB.points += 1;
      return;
    }

    const inn1 = getInningsSummary(match, 1);
    const inn2 = getInningsSummary(match, 2);

    const battingFirstTeamId = match.battingFirstTeamId;
    const chasingTeamId =
      battingFirstTeamId === match.teamAId ? match.teamBId : match.teamAId;

    const batFirst = table.get(battingFirstTeamId);
    const chase = table.get(chasingTeamId);

    if (!batFirst || !chase) return;

    batFirst.runsFor += inn1.runs;
    batFirst.ballsFor += inn1.legalBalls;
    batFirst.runsAgainst += inn2.runs;
    batFirst.ballsAgainst += inn2.legalBalls;

    chase.runsFor += inn2.runs;
    chase.ballsFor += inn2.legalBalls;
    chase.runsAgainst += inn1.runs;
    chase.ballsAgainst += inn1.legalBalls;

    if (inn1.runs > inn2.runs) {
      batFirst.won += 1;
      chase.lost += 1;
      batFirst.points += 2;
    } else if (inn2.runs > inn1.runs) {
      chase.won += 1;
      batFirst.lost += 1;
      chase.points += 2;
    } else {
      batFirst.tied += 1;
      chase.tied += 1;
      batFirst.points += 1;
      chase.points += 1;
    }
  });

  return [...table.values()]
    .map((row) => {
      const forRate = row.ballsFor
        ? row.runsFor / (row.ballsFor / 6)
        : 0;

      const againstRate = row.ballsAgainst
        ? row.runsAgainst / (row.ballsAgainst / 6)
        : 0;

      return {
        ...row,
        nrr: (forRate - againstRate).toFixed(3),
        oversFor: formatOversFromBalls(row.ballsFor),
        oversAgainst: formatOversFromBalls(row.ballsAgainst),
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        Number(b.nrr) - Number(a.nrr) ||
        b.won - a.won
    );
}