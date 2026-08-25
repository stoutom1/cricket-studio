"use client";

import {
  useEffect,
  useState,
} from "react";

function formatDate(value) {
  if (!value) {
    return "Never played";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        month:
          "short",
        day:
          "numeric",
        year:
          "numeric",
      }
    ).format(
      new Date(
        value
      )
    );
  } catch {
    return String(
      value
    );
  }
}

export default function PlayerInactivityAlertSettings({
  leagueId,
  leagueName,
}) {
  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [checking, setChecking] =
    useState(false);

  const [running, setRunning] =
    useState(false);

  const [enabled, setEnabled] =
    useState(false);

  const [recipientPhone, setRecipientPhone] =
    useState("");

  const [consentConfirmed, setConsentConfirmed] =
    useState(false);

  const [inactivePlayers, setInactivePlayers] =
    useState([]);

  const [previewLoaded, setPreviewLoaded] =
    useState(false);

  const [previewPlayerKey, setPreviewPlayerKey] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const inactivityDays =
    60;

  async function api(
    url,
    options =
      {}
  ) {
    const response =
      await fetch(
        url,
        {
          ...options,
          headers: {
            "Content-Type":
              "application/json",
            ...(
              options.headers ||
              {}
            ),
          },
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Request failed."
      );
    }

    return data;
  }

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      if (!leagueId) {
        return;
      }

      setLoading(
        true
      );

      setError(
        ""
      );

      setMessage(
        ""
      );

      setPreviewLoaded(
        false
      );

      setInactivePlayers(
        []
      );

      try {
        const data =
          await api(
            `/api/leagues/${leagueId}/player-inactivity-alerts`
          );

        if (
          cancelled
        ) {
          return;
        }

        setEnabled(
          Boolean(
            data?.setting
              ?.enabled
          )
        );

        setRecipientPhone(
          data?.setting
            ?.recipientPhone ||
            ""
        );

        /*
         * Existing enabled settings already have stored consent.
         * The owner must reconfirm only when enabling/saving again.
         */
        setConsentConfirmed(
          Boolean(
            data?.setting
              ?.enabled &&
            data?.setting
              ?.consentConfirmedAt
          )
        );
      } catch (loadError) {
        if (
          !cancelled
        ) {
          setError(
            loadError?.message ||
              "Unable to load player inactivity alert settings."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    load();

    return () => {
      cancelled =
        true;
    };
  }, [
    leagueId,
  ]);

  async function saveSettings(
    event
  ) {
    event?.preventDefault();

    if (
      saving ||
      !leagueId
    ) {
      return;
    }

    setSaving(
      true
    );

    setError(
      ""
    );

    setMessage(
      ""
    );

    try {
      const data =
        await api(
          `/api/leagues/${leagueId}/player-inactivity-alerts`,
          {
            method:
              "PATCH",
            body:
              JSON.stringify({
                enabled,
                recipientPhone,
                consentConfirmed,
              }),
          }
        );

      setEnabled(
        Boolean(
          data?.setting
            ?.enabled
        )
      );

      setRecipientPhone(
        data?.setting
          ?.recipientPhone ||
          ""
      );

      setConsentConfirmed(
        Boolean(
          data?.setting
            ?.enabled
        )
      );

      setMessage(
        data?.message ||
          "Player inactivity alert settings saved."
      );
    } catch (saveError) {
      setError(
        saveError?.message ||
          "Unable to save player inactivity alert settings."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  async function previewInactivePlayers() {
    if (
      checking ||
      !leagueId
    ) {
      return;
    }

    setChecking(
      true
    );

    setError(
      ""
    );

    setMessage(
      ""
    );

    try {
      const data =
        await api(
          `/api/leagues/${leagueId}/player-inactivity-alerts/preview`
        );

      const players =
        data?.players ||
        [];

      setInactivePlayers(
        players
      );

      setPreviewPlayerKey(
        (current) => {
          if (
            current &&
            players.some(
              (player) =>
                player.identityKey ===
                current
            )
          ) {
            return current;
          }

          return (
            players?.[0]
              ?.identityKey ||
            ""
          );
        }
      );

      setPreviewLoaded(
        true
      );

      setMessage(
        data?.count
          ? `${data.count} player${data.count === 1 ? "" : "s"} currently meet the ${inactivityDays}-day inactivity rule.`
          : `No players currently meet the ${inactivityDays}-day inactivity rule.`
      );
    } catch (previewError) {
      setError(
        previewError?.message ||
          "Unable to check inactive players."
      );
    } finally {
      setChecking(
        false
      );
    }
  }

  async function runAlertsNow() {
    if (
      running ||
      !leagueId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Send any currently due ${inactivityDays}-day player inactivity alerts to ${recipientPhone || "the configured phone number"} now?\n\nPlayers already alerted for the same inactivity episode will not be sent again.`
      );

    if (!confirmed) {
      return;
    }

    setRunning(
      true
    );

    setError(
      ""
    );

    setMessage(
      ""
    );

    try {
      const data =
        await api(
          `/api/leagues/${leagueId}/player-inactivity-alerts/run`,
          {
            method:
              "POST",
            body:
              JSON.stringify({
                dryRun:
                  false,
              }),
          }
        );

      const summary =
        data?.summary ||
        {};

      setMessage(
        `Alert check complete: ${Number(summary.sent || 0)} sent, ${Number(summary.alreadyAlerted || 0)} already alerted, ${Number(summary.failed || 0)} failed.`
      );

      await previewInactivePlayers();
    } catch (runError) {
      setError(
        runError?.message ||
          "Unable to run player inactivity alerts."
      );
    } finally {
      setRunning(
        false
      );
    }
  }

  const previewPlayer =
    inactivePlayers.find(
      (player) =>
        player.identityKey ===
        previewPlayerKey
    ) ||
    inactivePlayers?.[0] ||
    null;

  const previewPlayerName =
    previewPlayer?.playerName ||
    "Player name";

  if (
    loading
  ) {
    return (
      <div className="player-inactivity-setting-state">
        Loading inactivity alert settings…
      </div>
    );
  }

  return (
    <section className="player-inactivity-setting">
      <div className="player-inactivity-setting-intro">
        <div>
          <strong>
            Player inactivity SMS alert
          </strong>

          <p>
            Notify one configured phone number when a player has no qualifying match attendance for {inactivityDays} days.
          </p>
        </div>

        <span className="player-inactivity-policy-badge">
          {inactivityDays} days
        </span>
      </div>

      <div className="player-inactivity-policy-note">
        <strong>
          Activity policy
        </strong>

        <span>
          Completed, completed locked, completed corrected, and abandoned matches can count as activity. For an abandoned match, only players with match-level participation evidence (captain, vice-captain, wicketkeeper assignment, or recorded delivery involvement) are treated as having attended. Cancelled, no-result, scheduled, and live matches do not reset the inactivity clock.
        </span>
      </div>

      <form
        onSubmit={
          saveSettings
        }
        className="player-inactivity-setting-form"
      >
        <label className="player-inactivity-toggle-row player-inactivity-inline-check">
          <input
            type="checkbox"
            checked={
              enabled
            }
            onChange={
              (
                event
              ) =>
                setEnabled(
                  event
                    .target
                    .checked
                )
            }
          />

          <span>
            <strong>
              Enable 60-day inactivity alerts
            </strong>
            <small>
              — one SMS per player per inactivity episode.
            </small>
          </span>
        </label>

        <label className="player-inactivity-field">
          <span>
            Alert recipient phone
          </span>

          <input
            type="tel"
            inputMode="tel"
            placeholder="+16025551234"
            value={
              recipientPhone
            }
            onChange={
              (
                event
              ) =>
                setRecipientPhone(
                  event
                    .target
                    .value
                )
            }
          />

          <small>
            Include the country code. This phone receives the operational player-removal eligibility notice.
          </small>
        </label>

        <label className="player-inactivity-consent-row player-inactivity-inline-check">
          <input
            type="checkbox"
            checked={
              consentConfirmed
            }
            onChange={
              (
                event
              ) =>
                setConsentConfirmed(
                  event
                    .target
                    .checked
                )
            }
          />

          <span>
            I confirm this recipient agreed to receive Cric4All operational SMS alerts.
          </span>
        </label>

        <div className="player-inactivity-sample">
          <div className="player-inactivity-sample-heading">
            <strong>
              Message preview
            </strong>

            {inactivePlayers.length > 1 && (
              <label>
                <span>
                  Preview player
                </span>

                <select
                  value={
                    previewPlayerKey
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setPreviewPlayerKey(
                        event
                          .target
                          .value
                      )
                  }
                >
                  {inactivePlayers.map(
                    (
                      player
                    ) => (
                      <option
                        key={
                          player.identityKey
                        }
                        value={
                          player.identityKey
                        }
                      >
                        {player.playerName}
                      </option>
                    )
                  )}
                </select>
              </label>
            )}
          </div>

          {!previewLoaded && (
            <small className="player-inactivity-preview-hint">
              Click “Check inactive players” to load a real eligible player into this preview.
            </small>
          )}

          <div className="player-inactivity-message-card">
            <p className="player-inactivity-message-title">
              Cric4All Player Activity Notice
            </p>

            <p>
              <strong>
                {previewPlayerName}
              </strong>{" "}
              has not recorded a qualifying match appearance in the last {inactivityDays} days and is eligible to be removed from the group.
            </p>

            <p>
              Please review the player before taking any action.
              <br />
              - Cric4All
            </p>
          </div>
        </div>

        <div className="player-inactivity-actions">
          <button
            type="submit"
            disabled={
              saving
            }
          >
            {saving
              ? "Saving…"
              : "Save inactivity alert settings"}
          </button>

          <button
            type="button"
            className="secondary"
            disabled={
              checking
            }
            onClick={
              previewInactivePlayers
            }
          >
            {checking
              ? "Checking…"
              : "Check inactive players"}
          </button>

          <button
            type="button"
            className="secondary"
            disabled={
              running ||
              !enabled ||
              !recipientPhone
            }
            onClick={
              runAlertsNow
            }
          >
            {running
              ? "Sending…"
              : "Run alert check now"}
          </button>
        </div>
      </form>

      {error && (
        <div className="player-inactivity-error">
          {error}
        </div>
      )}

      {message && (
        <div className="player-inactivity-message">
          {message}
        </div>
      )}

      {previewLoaded && (
        <div className="player-inactivity-preview">
          <div className="player-inactivity-preview-heading">
            <strong>
              Currently eligible for review
            </strong>

            <span>
              {inactivePlayers.length}
            </span>
          </div>

          {inactivePlayers.length ===
          0 ? (
            <p>
              No inactive players found.
            </p>
          ) : (
            <div className="player-inactivity-preview-list">
              {inactivePlayers.map(
                (
                  player
                ) => (
                  <div
                    key={
                      player.identityKey
                    }
                    className="player-inactivity-preview-row"
                  >
                    <div>
                      <strong>
                        {player.playerName}
                      </strong>

                      <small>
                        Last played:{" "}
                        {formatDate(
                          player.lastPlayedAt
                        )}
                      </small>
                    </div>

                    <span>
                      Eligible since{" "}
                      {formatDate(
                        player.eligibleAt
                      )}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      <p className="player-inactivity-access-note">
        Only the Cric4All Super Admin or an Owner of {leagueName || "this league"} can change or run this setting.
      </p>
    </section>
  );
}
