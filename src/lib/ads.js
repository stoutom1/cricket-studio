/*
 * Cric4All web advertising configuration.
 *
 * Web/PWA monetization uses Google AdSense only on selected public pages.
 * Native iOS/Android apps should use AdMob instead of these web ad units.
 *
 * Required production environment variables:
 *   NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
 *   NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE=XXXXXXXXXX
 *   NEXT_PUBLIC_ADSENSE_SLOT_LEAGUE=XXXXXXXXXX
 *   NEXT_PUBLIC_ADSENSE_SLOT_MATCH=XXXXXXXXXX
 *
 * Optional master switch:
 *   NEXT_PUBLIC_ADS_ENABLED=true|false
 *
 * When NEXT_PUBLIC_ADS_ENABLED is omitted, ads automatically become eligible
 * when a valid publisher client and the requested slot are configured.
 */

export const GOOGLE_ADSENSE_CLIENT = String(
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT || ""
).trim();

export const ADS_ENABLED_SETTING = String(
  process.env.NEXT_PUBLIC_ADS_ENABLED || "auto"
)
  .trim()
  .toLowerCase();

export const ADSENSE_SLOTS = Object.freeze({
  explore: String(process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE || "").trim(),
  league: String(process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEAGUE || "").trim(),
  match: String(process.env.NEXT_PUBLIC_ADSENSE_SLOT_MATCH || "").trim(),
});

export function isValidAdSenseClient(value = GOOGLE_ADSENSE_CLIENT) {
  return /^ca-pub-\d+$/.test(String(value || "").trim());
}

export function isValidAdSenseSlot(value) {
  return /^\d+$/.test(String(value || "").trim());
}

export function getAdSenseSlot(placement) {
  return ADSENSE_SLOTS[placement] || "";
}

export function isAdPlacementConfigured(placement) {
  if (ADS_ENABLED_SETTING === "false" || ADS_ENABLED_SETTING === "0") {
    return false;
  }

  return (
    isValidAdSenseClient() &&
    isValidAdSenseSlot(getAdSenseSlot(placement))
  );
}

export function getAdsTxtPublisherId() {
  const explicit = String(process.env.GOOGLE_ADSENSE_PUBLISHER_ID || "").trim();

  if (/^pub-\d+$/.test(explicit)) {
    return explicit;
  }

  if (isValidAdSenseClient()) {
    return GOOGLE_ADSENSE_CLIENT.replace(/^ca-/, "");
  }

  return "";
}
