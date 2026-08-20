"use client";

import "@/app/score-now/score-now.css";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";
import GrowthTracker, {
  trackGrowthEvent,
} from "@/components/growth-tracker";

const DRAFT_KEY =
  "cric4all_quick_match_draft_v1";

function parsePlayerNames(value) {
  const seen =
    new Set();

  return String(
    value ||
    ""
  )
    .split(/\r?\n|,/)
    .map((name) =>
      name.trim()
    )
    .filter(Boolean)
    .filter((name) => {
      const key =
        name.toLowerCase();

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 25);
}

function initialDraft() {
  return {
    leagueName:
      "My Cricket League",
    teamAName:
      "Team A",
    teamBName:
      "Team B",
    overs:
      "10",
    teamAPlayers:
      "",
    teamBPlayers:
      "",
    useActiveLeague:
      false,
  };
}

export default function QuickMatchStarter({
  userContext,
}) {
  const router =
    useRouter();

  const [
    form,
    setForm,
  ] = useState(
    initialDraft
  );

  const [
    showPlayers,
    setShowPlayers,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    authRequired,
    setAuthRequired,
  ] = useState(false);

  const activeLeagueAvailable =
    Boolean(
      userContext
        ?.signedIn &&
      userContext
        ?.activeLeagueId
    );

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          DRAFT_KEY
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(saved);

      if (
        parsed &&
        typeof parsed ===
          "object"
      ) {
        setForm(
          (previous) => ({
            ...previous,
            ...parsed,

            /*
             * Never silently attach a returning user's new quick match to
             * an active league just because a draft was saved previously.
             */
            useActiveLeague:
              activeLeagueAvailable
                ? Boolean(
                    parsed
                      .useActiveLeague
                  )
                : false,
          })
        );

        if (
          parsed
            .teamAPlayers ||
          parsed
            .teamBPlayers
        ) {
          setShowPlayers(
            true
          );
        }
      }
    } catch {
      // Draft restore is a convenience only.
    }
  }, [
    activeLeagueAvailable,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify(
          form
        )
      );
    } catch {
      // Local draft persistence must never block the wizard.
    }
  }, [form]);

  const teamAPlayers =
    useMemo(
      () =>
        parsePlayerNames(
          form
            .teamAPlayers
        ),
      [
        form
          .teamAPlayers,
      ]
    );

  const teamBPlayers =
    useMemo(
      () =>
        parsePlayerNames(
          form
            .teamBPlayers
        ),
      [
        form
          .teamBPlayers,
      ]
    );

  function update(
    field,
    value
  ) {
    setError("");
    setAuthRequired(
      false
    );

    setForm(
      (previous) => ({
        ...previous,
        [field]:
          value,
      })
    );
  }

  async function createQuickMatch(
    event
  ) {
    event.preventDefault();

    setError("");

    const teamAName =
      String(
        form
          .teamAName ||
        ""
      ).trim();

    const teamBName =
      String(
        form
          .teamBName ||
        ""
      ).trim();

    const overs =
      Number(
        form.overs
      );

    if (
      !teamAName ||
      !teamBName
    ) {
      setError(
        "Enter both team names."
      );
      return;
    }

    if (
      teamAName
        .toLowerCase() ===
      teamBName
        .toLowerCase()
    ) {
      setError(
        "The two teams need different names."
      );
      return;
    }

    if (
      !Number.isInteger(
        overs
      ) ||
      overs < 1 ||
      overs > 100
    ) {
      setError(
        "Enter total overs between 1 and 100."
      );
      return;
    }

    trackGrowthEvent(
      "QUICK_MATCH_STARTED",
      {
        source:
          "SCORE_NOW",
        metadata: {
          overs,
          hasPlayerNames:
            teamAPlayers.length >
              0 ||
            teamBPlayers.length >
              0,
          signedIn:
            Boolean(
              userContext
                ?.signedIn
            ),
        },
      }
    );

    if (
      !userContext
        ?.signedIn
    ) {
      setAuthRequired(
        true
      );
      return;
    }

    setSaving(
      true
    );

    try {
      const response =
        await fetch(
          "/api/quick-match",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                leagueName:
                  form
                    .leagueName,
                teamAName,
                teamBName,
                overs,
                teamAPlayers,
                teamBPlayers,
                useActiveLeague:
                  Boolean(
                    activeLeagueAvailable &&
                    form
                      .useActiveLeague
                  ),
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data?.error ||
          "Unable to create the quick match."
        );
      }

      try {
        localStorage.removeItem(
          DRAFT_KEY
        );
      } catch {}

      trackGrowthEvent(
        "QUICK_MATCH_CREATED",
        {
          source:
            "SCORE_NOW_CLIENT",
          leagueId:
            data.leagueId,
          matchId:
            data.matchId,
          metadata: {
            createdLeague:
              Boolean(
                data.createdLeague
              ),
          },
        }
      );

      /*
       * Reuse the existing dashboard scoring deep-link workflow.
       * The match intentionally remains SCHEDULED with batting first unset,
       * so the normal Start Match modal asks who bats first and then opens
       * the existing delivery setup. No duplicate scoring UI is introduced.
       */
      router.push(
        `/dashboard?tab=scoring&leagueId=${encodeURIComponent(
          data.leagueId
        )}&matchId=${encodeURIComponent(
          data.matchId
        )}&source=quick-match`
      );
    } catch (
      failure
    ) {
      setError(
        failure instanceof
          Error
          ? failure.message
          : "Unable to create the quick match."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  return (
    <main className="qmw-page">
      <GrowthTracker
        eventType="QUICK_MATCH_VIEW"
        oncePerSession={false}
      />

      <div className="qmw-shell">
        <header className="qmw-topbar">
          <Link href="/" className="qmw-brand" aria-label="Cric4All home">
            <span aria-hidden="true">🏏</span>
            <strong>Cric4All</strong>
          </Link>

          <div className="qmw-top-actions">
            <Link href="/explore" className="qmw-quiet-link">
              Explore
            </Link>

            {userContext?.signedIn ? (
              <Link href="/dashboard" className="qmw-pill-link">
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login?callbackUrl=%2Fscore-now"
                className="qmw-pill-link"
              >
                Sign In
              </Link>
            )}
          </div>
        </header>

        <section className="qmw-intro-bar">
          <div className="qmw-intro-title">
            <span className="qmw-kicker">⚡ QUICK MATCH</span>
            <span className="qmw-divider" aria-hidden="true">•</span>
            <strong>Score a Match</strong>
          </div>

          <div className="qmw-mini-points" aria-label="Quick match features">
            <span>📴 Offline-ready</span>
            <span>🌧 DLS</span>
            <span>🔗 Live sharing</span>
          </div>
        </section>

        <form
          className="qmw-card"
          onSubmit={createQuickMatch}
          noValidate
        >
          <div className="qmw-card-head">
            <div>
              <span className="qmw-card-eyebrow">MATCH SETUP</span>
              <h1>Set up your match</h1>
              <p>Enter the basics and go straight to scoring.</p>
            </div>

            <span className="qmw-step">1 of 4</span>
          </div>

          {activeLeagueAvailable && (
            <label
              className={`qmw-active-league ${
                form.useActiveLeague ? "is-active" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={Boolean(form.useActiveLeague)}
                onChange={(event) =>
                  update("useActiveLeague", event.target.checked)
                }
              />

              <span className="qmw-active-league-copy">
                <strong>Use active league</strong>
                <small>{userContext.activeLeagueName}</small>
              </span>

              <span className="qmw-active-state">
                {form.useActiveLeague ? "Using" : "Optional"}
              </span>
            </label>
          )}

          <div className="qmw-fields">
            {!form.useActiveLeague && (
              <label className="qmw-field qmw-field-league">
                <span>League / Group</span>
                <input
                  value={form.leagueName}
                  onChange={(event) =>
                    update("leagueName", event.target.value)
                  }
                  maxLength={70}
                  placeholder="My Cricket League"
                  autoComplete="organization"
                />
              </label>
            )}

            <label className="qmw-field">
              <span>Team 1</span>
              <input
                value={form.teamAName}
                onChange={(event) =>
                  update("teamAName", event.target.value)
                }
                maxLength={60}
                placeholder="Team A"
                autoComplete="off"
              />
            </label>

            <label className="qmw-field">
              <span>Team 2</span>
              <input
                value={form.teamBName}
                onChange={(event) =>
                  update("teamBName", event.target.value)
                }
                maxLength={60}
                placeholder="Team B"
                autoComplete="off"
              />
            </label>
          </div>

          <fieldset className="qmw-overs">
            <legend>Overs per innings</legend>

            <div className="qmw-over-buttons">
              {[5, 10, 20].map((overs) => {
                const active = Number(form.overs) === overs;

                return (
                  <button
                    key={overs}
                    type="button"
                    className={active ? "is-active" : ""}
                    aria-pressed={active}
                    onClick={() => update("overs", String(overs))}
                  >
                    {overs}
                  </button>
                );
              })}

              <label
                className={`qmw-other ${
                  ![5, 10, 20].includes(Number(form.overs))
                    ? "is-active"
                    : ""
                }`}
              >
                <span>Other</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={
                    [5, 10, 20].includes(Number(form.overs))
                      ? ""
                      : form.overs
                  }
                  onChange={(event) =>
                    update(
                      "overs",
                      event.target.value.replace(/\D/g, "").slice(0, 3)
                    )
                  }
                  onFocus={() => {
                    if ([5, 10, 20].includes(Number(form.overs))) {
                      update("overs", "");
                    }
                  }}
                  aria-label="Custom number of overs"
                  placeholder="15"
                />
              </label>
            </div>
          </fieldset>

          <button
            type="button"
            className="qmw-player-toggle"
            aria-expanded={showPlayers}
            onClick={() => setShowPlayers((previous) => !previous)}
          >
            <span>
              <b aria-hidden="true">{showPlayers ? "−" : "+"}</b>
              Player names
              <small>optional</small>
            </span>

            <span aria-hidden="true">{showPlayers ? "⌃" : "⌄"}</span>
          </button>

          {showPlayers && (
            <div className="qmw-player-panel">
              <div className="qmw-player-grid">
                <label className="qmw-field">
                  <span>Team 1 players</span>
                  <textarea
                    value={form.teamAPlayers}
                    onChange={(event) =>
                      update("teamAPlayers", event.target.value)
                    }
                    rows={5}
                    placeholder={"Player 1\nPlayer 2\nPlayer 3"}
                  />
                </label>

                <label className="qmw-field">
                  <span>Team 2 players</span>
                  <textarea
                    value={form.teamBPlayers}
                    onChange={(event) =>
                      update("teamBPlayers", event.target.value)
                    }
                    rows={5}
                    placeholder={"Player 1\nPlayer 2\nPlayer 3"}
                  />
                </label>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="qmw-error">
              {error}
            </div>
          )}

          <div className="qmw-action-row">
            <div className="qmw-next">
              <span>Next:</span>
              <strong>Toss</strong>
              <span>→</span>
              <strong>Players</strong>
              <span>→</span>
              <strong>Score</strong>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="qmw-submit"
            >
              <span>
                {saving
                  ? "Creating match…"
                  : userContext?.signedIn
                    ? "🏏 Start Scoring"
                    : "🏏 Continue"}
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          {authRequired && (
            <div className="qmw-auth">
              <strong>One quick step</strong>
              <p>
                Sign in or create a free account to continue. Your setup is saved.
              </p>

              <div>
                <Link
                  href="/login?callbackUrl=%2Fscore-now"
                  onClick={() =>
                    trackGrowthEvent("QUICK_MATCH_AUTH_CLICKED", {
                      source: "SCORE_NOW_LOGIN",
                    })
                  }
                >
                  Sign In
                </Link>

                <Link
                  href="/register?next=%2Fscore-now"
                  className="is-secondary"
                  onClick={() => {
                    trackGrowthEvent("QUICK_MATCH_AUTH_CLICKED", {
                      source: "SCORE_NOW_REGISTER",
                    });

                    trackGrowthEvent("SIGNUP_STARTED", {
                      source: "SCORE_NOW",
                    });
                  }}
                >
                  Create Account
                </Link>
              </div>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
