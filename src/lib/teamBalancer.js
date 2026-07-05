function n(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalize(value, max) {
  if (!max || max <= 0) return 0;
  return Math.min(100, (n(value) / max) * 100);
}

function getMax(players, field) {
  return Math.max(...players.map((p) => n(p[field])), 1);
}

function calculateSkillScores(players) {
  const maxRuns = getMax(players, "runs");
  const maxWickets = getMax(players, "wickets");
  const maxFielding = Math.max(
    ...players.map((p) => n(p.catches) + n(p.runOuts) + n(p.stumpings)),
    1
  );

  return players.map((p) => {
    const battingScore =
      normalize(p.runs, maxRuns) * 0.55 +
      normalize(p.average, 50) * 0.25 +
      normalize(p.strikeRate, 180) * 0.2;

    const bowlingScore =
      normalize(p.wickets, maxWickets) * 0.7 +
      Math.max(0, 100 - n(p.economy, 12) * 8) * 0.3;

    const fieldingScore = normalize(
      n(p.catches) + n(p.runOuts) + n(p.stumpings),
      maxFielding
    );

    const skillScore =
      battingScore * 0.4 + bowlingScore * 0.4 + fieldingScore * 0.2;

    return {
      ...p,
      battingScore: Number(battingScore.toFixed(1)),
      bowlingScore: Number(bowlingScore.toFixed(1)),
      fieldingScore: Number(fieldingScore.toFixed(1)),
      skillScore: Number(skillScore.toFixed(1)),
    };
  });
}

function total(team) {
  return team.reduce((sum, p) => sum + n(p.skillScore), 0);
}

function diff(teamA, teamB) {
  return Math.abs(total(teamA) - total(teamB));
}

export function balancePlayers(players) {
  const scored = calculateSkillScores(players).sort(
    (a, b) => b.skillScore - a.skillScore
  );

  let teamA = [];
  let teamB = [];

  for (const player of scored) {
    if (teamA.length < teamB.length) {
      teamA.push(player);
    } else if (teamB.length < teamA.length) {
      teamB.push(player);
    } else if (total(teamA) <= total(teamB)) {
      teamA.push(player);
    } else {
      teamB.push(player);
    }
  }

  let improved = true;

  while (improved) {
    improved = false;
    let bestDiff = diff(teamA, teamB);
    let bestSwap = null;

    for (let i = 0; i < teamA.length; i++) {
      for (let j = 0; j < teamB.length; j++) {
        const testA = [...teamA];
        const testB = [...teamB];

        [testA[i], testB[j]] = [testB[j], testA[i]];

        const newDiff = diff(testA, testB);

        if (newDiff < bestDiff) {
          bestDiff = newDiff;
          bestSwap = { i, j };
        }
      }
    }

    if (bestSwap) {
      [teamA[bestSwap.i], teamB[bestSwap.j]] = [
        teamB[bestSwap.j],
        teamA[bestSwap.i],
      ];
      improved = true;
    }
  }

  const teamAStrength = total(teamA);
  const teamBStrength = total(teamB);
  const difference = Math.abs(teamAStrength - teamBStrength);
  const avg = (teamAStrength + teamBStrength) / 2 || 1;
  const balanceQuality = Math.max(0, 100 - (difference / avg) * 100);

  return {
    teamA,
    teamB,
    teamAStrength: Number(teamAStrength.toFixed(1)),
    teamBStrength: Number(teamBStrength.toFixed(1)),
    difference: Number(difference.toFixed(1)),
    balanceQuality: Number(balanceQuality.toFixed(1)),
  };
}