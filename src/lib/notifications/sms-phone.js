export function normalizeSmsPhoneNumber(
  value
) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const digits =
    raw.replace(/\D/g, "");

  /*
   * US/Canada local number:
   * 4806373627 → +14806373627
   */
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  /*
   * International number already containing
   * its country code.
   */
  if (
    digits.length >= 11 &&
    digits.length <= 15
  ) {
    return `+${digits}`;
  }

  return null;
}