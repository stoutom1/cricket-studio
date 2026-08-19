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
    <main className="c4a-quick-page">
      <GrowthTracker
        eventType="QUICK_MATCH_VIEW"
        oncePerSession={false}
      />

      <div className="c4a-quick-shell">
        <header className="c4a-quick-topbar">
          <Link href="/" className="c4a-quick-brand">
            <span aria-hidden="true">🏏</span>
            <span>Cric4All</span>
          </Link>

          {userContext?.signedIn ? (
            <Link href="/dashboard" className="c4a-quick-nav-button">
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login?callbackUrl=%2Fscore-now"
              className="c4a-quick-nav-button"
            >
              Sign In
            </Link>
          )}
        </header>

        <section className="c4a-quick-layout">
          <div className="c4a-quick-intro">
            <div className="c4a-quick-kicker">
              <span aria-hidden="true">⚡</span>
              QUICK MATCH
            </div>

            <h1>Score a cricket match now.</h1>

            <p className="c4a-quick-intro-copy">
              Enter the two team names and overs. Cric4All creates the setup and
              sends you straight into the normal scorer workflow.
            </p>

            <div className="c4a-quick-benefits">
              {[
                "📴 Keep scoring if connectivity drops",
                "🌧 Rain / DLS workflows are available",
                "📊 Full scorecard and player statistics",
                "🔗 Share the live match with spectators",
              ].map((item) => (
                <div key={item} className="c4a-quick-benefit">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <form
            className="c4a-quick-card"
            onSubmit={createQuickMatch}
            noValidate
          >
            <div className="c4a-quick-card-head">
              <div className="c4a-quick-card-icon" aria-hidden="true">
                🏏
              </div>

              <div>
                <h2>Match Setup</h2>
                <p>You can change detailed settings later.</p>
              </div>
            </div>

            {activeLeagueAvailable && (
              <label className="c4a-active-league-card">
                <input
                  className="c4a-active-league-checkbox"
                  type="checkbox"
                  checked={Boolean(form.useActiveLeague)}
                  onChange={(event) =>
                    update("useActiveLeague", event.target.checked)
                  }
                />

                <span className="c4a-active-league-copy">
                  <strong>Use my active league</strong>
                  <small>{userContext.activeLeagueName}</small>
                </span>

                <span
                  className={`c4a-active-league-state ${
                    form.useActiveLeague ? "is-selected" : ""
                  }`}
                  aria-hidden="true"
                >
                  {form.useActiveLeague ? "Selected" : "Optional"}
                </span>
              </label>
            )}

            <div className="c4a-quick-fields">
              {!form.useActiveLeague && (
                <label className="c4a-quick-field c4a-quick-field-full">
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

              <label className="c4a-quick-field">
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

              <label className="c4a-quick-field">
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

            <fieldset className="c4a-overs-group">
              <legend>Overs per innings</legend>

              <div className="c4a-overs-options">
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
                  className={`c4a-overs-custom ${
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
              className="c4a-player-toggle"
              aria-expanded={showPlayers}
              onClick={() => setShowPlayers((previous) => !previous)}
            >
              <span>
                <b aria-hidden="true">{showPlayers ? "−" : "+"}</b>
                Add player names now
                <small>(optional)</small>
              </span>

              <span className="c4a-player-toggle-chevron" aria-hidden="true">
                {showPlayers ? "⌃" : "⌄"}
              </span>
            </button>

            {showPlayers && (
              <div className="c4a-player-panel">
                <div className="c4a-player-columns">
                  <label className="c4a-quick-field">
                    <span>Team 1 players</span>
                    <small>One name per line or comma separated</small>

                    <textarea
                      value={form.teamAPlayers}
                      onChange={(event) =>
                        update("teamAPlayers", event.target.value)
                      }
                      rows={5}
                      placeholder={"Player 1\nPlayer 2\nPlayer 3"}
                    />
                  </label>

                  <label className="c4a-quick-field">
                    <span>Team 2 players</span>
                    <small>One name per line or comma separated</small>

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

                <p className="c4a-player-help">
                  If you leave player names blank, Cric4All creates two
                  temporary players per team so the normal delivery setup can
                  open immediately. You can rename or add players later.
                </p>
              </div>
            )}

            {error && (
              <div role="alert" className="c4a-quick-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="c4a-quick-submit"
            >
              {saving
                ? "Creating your match…"
                : userContext?.signedIn
                  ? "🏏 Create Match & Start Scoring"
                  : "🏏 Continue to Score This Match"}
            </button>

            <p className="c4a-quick-footnote">
              Detailed roles, powerplay, wicket limits, DLS and other match
              settings remain available in the normal Cric4All workflow.
            </p>

            {authRequired && (
              <div className="c4a-auth-box">
                <strong>Your match setup is saved on this device.</strong>

                <p>
                  Sign in or create a free Cric4All account, then return here.
                  Your team names and overs will still be waiting.
                </p>

                <div className="c4a-auth-actions">
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
                    Create Free Account
                  </Link>
                </div>
              </div>
            )}
          </form>
        </section>

        <section className="c4a-next-steps">
          <div className="c4a-next-steps-head">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>What happens after Start Scoring?</strong>
              <small>Four quick steps, then you are live.</small>
            </div>
          </div>

          <div className="c4a-next-steps-grid">
            {[
              ["1", "Setup", "Cric4All creates the league and teams if needed."],
              ["2", "Toss", "Choose which team bats first."],
              ["3", "Players", "Select striker, non-striker and bowler."],
              ["4", "Score", "Record the first delivery."],
            ].map(([number, title, copy]) => (
              <article key={number}>
                <span>{number}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
