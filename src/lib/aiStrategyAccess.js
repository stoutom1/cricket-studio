const AI_STRATEGY_EMAILS = new Set([
  "surprisecricket11@gmail.com",
]);

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function canUseAIStrategy(email) {
  return AI_STRATEGY_EMAILS.has(normalizeEmail(email));
}
