"use client";

import { useEffect, useMemo, useState } from "react";
import "./LiveStreamStudio.css";

const YOUTUBE_STUDIO_URL = "https://studio.youtube.com/";
const OBS_DOWNLOAD_URL = "https://obsproject.com/download";

function copyText(value, successMessage, setStatus) {
  if (!value) return;

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setStatus(successMessage);
        window.setTimeout(() => setStatus(""), 2200);
      })
      .catch(() => {
        setStatus("Copy failed. Select and copy the value manually.");
      });
    return;
  }

  setStatus("Copy is unavailable in this browser.");
}

async function shareOverlay(value, setStatus) {
  if (!value) return;

  if (navigator?.share) {
    try {
      await navigator.share({
        title: "Cric4All Live Score Overlay",
        text: "Cric4All live scoreboard overlay",
        url: value,
      });
      setStatus("Overlay link shared!");
      window.setTimeout(() => setStatus(""), 2200);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  copyText(value, "Overlay URL copied!", setStatus);
}

export default function LiveStreamStudio({
  matchId,
  teamAName,
  teamBName,
  onClose,
}) {
  const [platform, setPlatform] = useState("youtube");
  const [status, setStatus] = useState("");
  const [isMobileView, setIsMobileView] = useState(false);

  const overlayUrl = useMemo(() => {
    if (typeof window === "undefined" || !matchId) return "";

    return `${window.location.origin}/stream/${encodeURIComponent(
      String(matchId)
    )}`;
  }, [matchId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(max-width: 760px), (pointer: coarse)"
    );

    const update = () => setIsMobileView(mediaQuery.matches);
    update();

    mediaQuery.addEventListener?.("change", update);

    return () => {
      mediaQuery.removeEventListener?.("change", update);
    };
  }, []);

  const title =
    `${teamAName || "Team A"} vs ` +
    `${teamBName || "Team B"}`;

  return (
    <div
      className={`live-stream-modal-backdrop ${
        isMobileView ? "is-mobile-stream-view" : ""
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="live-stream-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-stream-modal-title"
      >
        <header className="live-stream-modal-header">
          <div>
            <span className="live-stream-kicker">
              🎥 CRIC4ALL LIVE STREAMING
            </span>
            <h2 id="live-stream-modal-title">
              Stream {title}
            </h2>
            <p>
              {isMobileView
                ? "Set up your phone as the camera, then send the video to YouTube or another RTMP/RTMPS platform."
                : "Send your camera feed to YouTube or another RTMP/RTMPS platform and keep the live Cric4All scoreboard on top."}
            </p>
          </div>

          <button
            type="button"
            className="live-stream-close"
            onClick={onClose}
            aria-label="Close live streaming setup"
          >
            ×
          </button>
        </header>

        <div className="live-stream-modal-body">
          {isMobileView ? (
            <section className="live-stream-mobile-hero">
              <div className="live-stream-mobile-hero-copy">
                <span>📱 MOBILE STREAM SETUP</span>
                <strong>
                  Your phone can be the match camera.
                </strong>
                <p>
                  Cric4All provides the live scoreboard overlay.
                  A mobile streaming/encoder app sends your camera
                  video to YouTube or another RTMP platform.
                </p>
              </div>

              <div className="live-stream-mobile-actions">
                <a
                  href={YOUTUBE_STUDIO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="live-stream-mobile-primary"
                >
                  Open YouTube Studio ↗
                </a>

                <button
                  type="button"
                  className="live-stream-mobile-secondary"
                  onClick={() =>
                    shareOverlay(overlayUrl, setStatus)
                  }
                >
                  Share overlay
                </button>
              </div>
            </section>
          ) : null}

          <div className="live-stream-platform-row">
            <button
              type="button"
              className={platform === "youtube" ? "is-active" : ""}
              onClick={() => setPlatform("youtube")}
            >
              <strong>YouTube Live</strong>
              <span>Recommended setup</span>
            </button>

            <button
              type="button"
              className={platform === "other" ? "is-active" : ""}
              onClick={() => setPlatform("other")}
            >
              <strong>Other RTMP/RTMPS</strong>
              <span>Facebook, Twitch, custom</span>
            </button>
          </div>

          <div className="live-stream-security-note">
            <span aria-hidden="true">🔐</span>
            <p>
              <strong>Cric4All never asks for your stream key.</strong>{" "}
              Keep the stream key inside your streaming app or encoder.
              Cric4All only supplies the live scoreboard overlay URL.
            </p>
          </div>

          {isMobileView ? (
            <section className="live-stream-phone-flow">
              <div className="live-stream-phone-flow-heading">
                <span>PHONE → LIVE</span>
                <strong>Mobile workflow</strong>
              </div>

              <div className="live-stream-phone-steps">
                <article>
                  <b>1</b>
                  <div>
                    <strong>Choose a mobile streaming app</strong>
                    <p>
                      Use a mobile encoder that supports RTMP/RTMPS.
                      Your phone camera and microphone become the
                      broadcast source.
                    </p>
                  </div>
                </article>

                <article>
                  <b>2</b>
                  <div>
                    <strong>Connect it to your platform</strong>
                    <p>
                      Select YouTube or Custom RTMP in the app and
                      enter the server URL and stream key supplied by
                      your streaming platform.
                    </p>
                  </div>
                </article>

                <article>
                  <b>3</b>
                  <div>
                    <strong>Use the Cric4All overlay</strong>
                    <p>
                      If your mobile encoder supports a web/browser
                      overlay, add the URL below. Otherwise the phone
                      can still stream the camera feed without the
                      scoreboard embedded in the video.
                    </p>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          <div className="live-stream-step-grid">
            <article className="live-stream-step">
              <span className="live-stream-step-number">1</span>
              <div>
                <h3>Create your live stream</h3>

                {platform === "youtube" ? (
                  <>
                    <p>
                      In YouTube Studio, choose
                      <strong> Create → Go Live</strong>, then use the
                      Stream tab to create or schedule the event.
                    </p>

                    <a
                      href={YOUTUBE_STUDIO_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="live-stream-primary-link"
                    >
                      Open YouTube Live Control Room ↗
                    </a>
                  </>
                ) : (
                  <p>
                    Create a live event on your chosen RTMP/RTMPS
                    platform and keep its server URL and stream key
                    ready for your encoder.
                  </p>
                )}
              </div>
            </article>

            <article className="live-stream-step">
              <span className="live-stream-step-number">2</span>

              <div>
                <h3>
                  {isMobileView
                    ? "Use your phone camera"
                    : "Install an encoder"}
                </h3>

                {isMobileView ? (
                  <p>
                    Open your preferred mobile RTMP/RTMPS encoder,
                    allow camera and microphone access, and choose
                    the rear camera for the match.
                  </p>
                ) : (
                  <>
                    <p>
                      OBS Studio is free and supports cameras, capture
                      cards, microphones and browser overlays.
                    </p>

                    <a
                      href={OBS_DOWNLOAD_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="live-stream-secondary-link"
                    >
                      Download OBS Studio ↗
                    </a>
                  </>
                )}
              </div>
            </article>

            <article className="live-stream-step live-stream-overlay-step">
              <span className="live-stream-step-number">3</span>

              <div>
                <h3>Add the Cric4All overlay</h3>

                <p>
                  {isMobileView
                    ? "Copy or share this URL into a mobile encoder that supports browser/web overlays."
                    : "In OBS, add a Browser Source and paste this URL. Set it to 1920 × 1080."}
                </p>

                <div className="live-stream-copy-row">
                  <input
                    value={overlayUrl}
                    readOnly
                    aria-label="Cric4All stream overlay URL"
                    onFocus={(event) => event.currentTarget.select()}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        overlayUrl,
                        "Overlay URL copied!",
                        setStatus
                      )
                    }
                  >
                    Copy
                  </button>
                </div>

                <div className="live-stream-mini-actions">
                  <a
                    href={overlayUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="live-stream-text-link"
                    onClick={(event) => {
                      if (!overlayUrl) event.preventDefault();
                    }}
                  >
                    Test overlay ↗
                  </a>

                  {isMobileView ? (
                    <button
                      type="button"
                      className="live-stream-share-link"
                      onClick={() =>
                        shareOverlay(overlayUrl, setStatus)
                      }
                    >
                      Share overlay ↗
                    </button>
                  ) : null}
                </div>
              </div>
            </article>

            <article className="live-stream-step">
              <span className="live-stream-step-number">4</span>

              <div>
                <h3>
                  {isMobileView
                    ? "Frame the match"
                    : "Add your camera/video"}
                </h3>

                <p>
                  {isMobileView
                    ? "Use a stable tripod or mount, check the camera framing, and confirm that your microphone is picking up match audio."
                    : "Add your phone camera through a capture device, webcam, camera, or another video source in OBS. Put the Cric4All Browser Source above the camera source."}
                </p>
              </div>
            </article>

            <article className="live-stream-step">
              <span className="live-stream-step-number">5</span>

              <div>
                <h3>Connect the encoder</h3>

                {platform === "youtube" ? (
                  <p>
                    In your encoder, select YouTube or enter the Stream
                    URL shown by YouTube, then enter your YouTube Stream
                    Key. Cric4All does not store either value.
                  </p>
                ) : (
                  <p>
                    Select your platform or Custom Streaming Server and
                    enter that platform's RTMP/RTMPS server URL and
                    stream key.
                  </p>
                )}
              </div>
            </article>

            <article className="live-stream-step">
              <span className="live-stream-step-number">6</span>

              <div>
                <h3>Preview, then go live</h3>

                <p>
                  Start the encoder, confirm the camera and scoreboard
                  look correct, then start the live event on your
                  platform. Cric4All will continue updating the overlay
                  from the live score.
                </p>
              </div>
            </article>
          </div>

          <div className="live-stream-overlay-preview">
            <div>
              <span>LIVE SCORE OVERLAY</span>
              <strong>
                Auto-updates while the Cric4All match is being scored
              </strong>
            </div>

            <div className="live-stream-overlay-badges">
              <b>1920 × 1080</b>
              <b>Live data</b>
              <b>Browser Source</b>
            </div>
          </div>

          <div className="live-stream-note">
            <strong>Mobile note:</strong>{" "}
            iPhone and Android browsers do not provide a direct,
            reliable browser-to-YouTube RTMP publishing path. The
            phone therefore acts as the camera through a mobile
            streaming/encoder app. Cric4All remains responsible for
            the live scoreboard and overlay data.
          </div>

          {status ? (
            <div className="live-stream-status" role="status">
              {status}
            </div>
          ) : null}
        </div>

        <footer className="live-stream-modal-footer">
          <span>
            Press Esc or click outside to close
          </span>

          <button
            type="button"
            className="live-stream-done-button"
            onClick={onClose}
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
