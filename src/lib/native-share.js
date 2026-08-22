import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

function isAbortLike(error) {
  const name = String(error?.name || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();

  return (
    name.includes("abort") ||
    message.includes("cancel") ||
    message.includes("dismiss")
  );
}

/**
 * Share through the native iOS/Android share sheet when Cric4All is running
 * inside Capacitor. Browser behavior remains unchanged.
 *
 * Returns:
 *   { shared: true, native: boolean }
 *   { shared: false, cancelled: true }
 *   { shared: false, unsupported: true }
 *
 * Throws only for real share failures.
 */
export async function shareCric4All({
  title = "Cric4All",
  text = "",
  url = "",
  dialogTitle = "Share with Cric4All",
} = {}) {
  const cleanTitle = String(title || "").trim();
  const cleanText = String(text || "").trim();
  const cleanUrl = String(url || "").trim();

  if (
    typeof window !== "undefined" &&
    Capacitor.isNativePlatform()
  ) {
    try {
      await Share.share({
        title: cleanTitle || undefined,
        text: cleanText || undefined,
        url: cleanUrl || undefined,
        dialogTitle,
      });

      return {
        shared: true,
        native: true,
      };
    } catch (error) {
      if (isAbortLike(error)) {
        return {
          shared: false,
          cancelled: true,
        };
      }

      throw error;
    }
  }

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({
        title: cleanTitle || undefined,
        text: cleanText || undefined,
        url: cleanUrl || undefined,
      });

      return {
        shared: true,
        native: false,
      };
    } catch (error) {
      if (isAbortLike(error)) {
        return {
          shared: false,
          cancelled: true,
        };
      }

      throw error;
    }
  }

  return {
    shared: false,
    unsupported: true,
  };
}
