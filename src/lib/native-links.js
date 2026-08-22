import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

const CRIC4ALL_HOSTS = new Set([
  "cric4all.app",
  "www.cric4all.app",
]);

function toUrl(value) {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    return new URL(
      value,
      window.location.origin
    );
  } catch {
    return null;
  }
}

export function isCric4AllUrl(value) {
  const url = toUrl(value);

  if (!url) {
    return false;
  }

  return (
    url.origin === window.location.origin ||
    CRIC4ALL_HOSTS.has(
      url.hostname.toLowerCase()
    )
  );
}

/**
 * Open a URL with app-safe behavior.
 *
 * Native Capacitor:
 *   Cric4All URL -> same WebView
 *   external HTTP(S) -> native system browser
 *
 * Web:
 *   preserve existing "_blank" style behavior by default.
 */
export async function openCric4AllLink(
  value,
  {
    webTarget = "_blank",
  } = {}
) {
  const url = toUrl(value);

  if (!url) {
    return false;
  }

  if (
    typeof window !== "undefined" &&
    Capacitor.isNativePlatform()
  ) {
    if (isCric4AllUrl(url.href)) {
      const internalPath =
        `${url.pathname}${url.search}${url.hash}`;

      window.location.assign(
        internalPath
      );

      return true;
    }

    if (
      url.protocol === "http:" ||
      url.protocol === "https:"
    ) {
      await Browser.open({
        url: url.href,
      });

      return true;
    }

    /*
     * tel:, sms:, mailto:, whatsapp:, etc. should be handed to the operating
     * system rather than rendered inside Cric4All's WebView.
     */
    window.location.href =
      url.href;

    return true;
  }

  if (webTarget === "_self") {
    window.location.assign(
      url.href
    );
  } else {
    window.open(
      url.href,
      webTarget,
      "noopener,noreferrer"
    );
  }

  return true;
}
