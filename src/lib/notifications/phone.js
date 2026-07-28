/**
 * Converts a phone value into digits suitable for a WhatsApp API.
 *
 * Store and submit numbers with the full international country code:
 *
 * United States:
 * +1 425 555 1234
 *
 * India:
 * +91 98765 43210
 *
 * This helper intentionally does not guess missing country codes.
 */
export function normalizeInternationalPhone(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return null;
  }

  const digits = rawValue.replace(/\D/g, "");

  /*
   * E.164 allows a maximum of 15 digits.
   * Seven is used here as a conservative minimum.
   */
  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  return digits;
}

/**
 * Avoid returning or logging the complete phone number.
 */
export function maskPhoneNumber(value) {
  const digits = normalizeInternationalPhone(value);

  if (!digits) {
    return "";
  }

  if (digits.length <= 4) {
    return "*".repeat(digits.length);
  }

  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}