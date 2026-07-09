export function calculateCaptainScore(player) {
  const skill = Number(player.skillScore || 0);
  const batting = Number(player.battingScore || 0);
  const bowling = Number(player.bowlingScore || 0);
  const matches = Number(player.matches || 0);

  const allRound =
    batting > 0 && bowling > 0
      ? (batting + bowling) / 2
      : Math.max(batting, bowling);

  const experience = Math.min(matches * 3, 100);

  return (
    skill * 0.4 +
    batting * 0.15 +
    bowling * 0.15 +
    allRound * 0.15 +
    experience * 0.15
  );
}

export function suggestCaptainsForTeam(players = []) {
  return [...players]
    .map((player) => ({
      ...player,
      captainScore: calculateCaptainScore(player),
    }))
    .sort((a, b) => b.captainScore - a.captainScore)
    .slice(0, 2)
    .map((player, index) => ({
      playerId: player.playerId || player.id,
      playerName: player.playerName || player.name,
      label: index === 0 ? "🥇 Best Match" : "🥈 Strong Choice",
      reason:
        index === 0
          ? "Balanced skill, experience, and consistency"
          : "Good leadership backup option",
    }));
}