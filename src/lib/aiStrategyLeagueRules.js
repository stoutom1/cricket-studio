function normalizeRuleText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCompact(value) {
  return normalizeRuleText(value).replace(/\s+/g, "");
}

const CROSS_TEAM_HISTORY_RULES = [
  {
    leagueNames: new Set(["surprise cricket league"]),
    teamNames: new Set(["surprise1", "surprise2"]),
  },
];

export function getCrossTeamHistoryRule(leagueName) {
  const normalizedLeagueName = normalizeRuleText(leagueName);

  return (
    CROSS_TEAM_HISTORY_RULES.find((rule) =>
      rule.leagueNames.has(normalizedLeagueName)
    ) || null
  );
}

export function isCrossTeamHistoryTeam(rule, teamName) {
  if (!rule) return false;
  return rule.teamNames.has(normalizeCompact(teamName));
}

export function normalizePlayerIdentity(name) {
  return normalizeRuleText(name);
}
