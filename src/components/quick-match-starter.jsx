"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";
import {
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
  acquisitionContext = {},
}) {
  const router =
    useRouter();

  const isSpectatorAcquisition =
    acquisitionContext?.source ===
    "spectator";

  const acquisitionMetadata =
    isSpectatorAcquisition
      ? {
          acquisitionSource:
            "SPECTATOR",
          originMatchId:
            acquisitionContext
              ?.originMatchId ||
            null,
          originLeagueId:
            acquisitionContext
              ?.originLeagueId ||
            null,
          originShareCode:
            acquisitionContext
              ?.originShareCode ||
            null,
          originState:
            acquisitionContext
              ?.originState ||
            null,
        }
      : {};

  const scoreNowReturnPath =
    useMemo(() => {
      const params =
        new URLSearchParams();

      if (
        isSpectatorAcquisition
      ) {
        params.set(
          "source",
          "spectator"
        );

        if (
          acquisitionContext
            ?.originMatchId
        ) {
          params.set(
            "originMatchId",
            String(
              acquisitionContext
                .originMatchId
            )
          );
        }

        if (
          acquisitionContext
            ?.originLeagueId
        ) {
          params.set(
            "originLeagueId",
            String(
              acquisitionContext
                .originLeagueId
            )
          );
        }

        if (
          acquisitionContext
            ?.originShareCode
        ) {
          params.set(
            "originShareCode",
            String(
              acquisitionContext
                .originShareCode
            )
          );
        }

        if (
          acquisitionContext
            ?.originState
        ) {
          params.set(
            "originState",
            String(
              acquisitionContext
                .originState
            )
          );
        }
      }

      const query =
        params.toString();

      return query
        ? `/score-now?${query}`
        : "/score-now";
    }, [
      isSpectatorAcquisition,
      acquisitionContext
        ?.originMatchId,
      acquisitionContext
        ?.originLeagueId,
      acquisitionContext
        ?.originShareCode,
      acquisitionContext
        ?.originState,
    ]);

  useEffect(() => {
    trackGrowthEvent(
      "QUICK_MATCH_VIEW",
      {
        source:
          isSpectatorAcquisition
            ? "SPECTATOR_SCORE_NOW"
            : "SCORE_NOW",
        matchId:
          acquisitionContext
            ?.originMatchId ||
          undefined,
        leagueId:
          acquisitionContext
            ?.originLeagueId ||
          undefined,
        metadata:
          acquisitionMetadata,
      }
    );
    // Track once for this page mount. The acquisition context is immutable
    // for a given /score-now navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          isSpectatorAcquisition
            ? "SPECTATOR_SCORE_NOW"
            : "SCORE_NOW",
        matchId:
          acquisitionContext
            ?.originMatchId ||
          undefined,
        leagueId:
          acquisitionContext
            ?.originLeagueId ||
          undefined,
        metadata: {
          ...acquisitionMetadata,
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
            isSpectatorAcquisition
              ? "SPECTATOR_SCORE_NOW_CREATED"
              : "SCORE_NOW_CLIENT",
          leagueId:
            data.leagueId,
          matchId:
            data.matchId,
          metadata: {
            ...acquisitionMetadata,
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
    <main
      style={{
        minHeight:
          "100vh",
        padding:
          "clamp(14px, 3vw, 34px)",
        background:
          "linear-gradient(180deg, rgba(2,6,23,1) 0%, rgba(7,18,37,1) 100%)",
        color:
          "#f8fafc",
      }}
    >
      <div
        style={{
          width:
            "min(920px, 100%)",
          margin:
            "0 auto",
        }}
      >
        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap:
              10,
            flexWrap:
              "wrap",
            marginBottom:
              18,
          }}
        >
          <Link
            href="/"
            style={{
              color:
                "inherit",
              textDecoration:
                "none",
              fontWeight:
                900,
              fontSize:
                18,
            }}
          >
            🏏 Cric4All
          </Link>

          <div
            style={{
              display:
                "flex",
              gap:
                8,
              flexWrap:
                "wrap",
            }}
          >
            {userContext
              ?.signedIn ? (
              <Link
                href="/dashboard"
                style={{
                  color:
                    "inherit",
                  textDecoration:
                    "none",
                  padding:
                    "8px 12px",
                  borderRadius:
                    999,
                  border:
                    "1px solid rgba(148,163,184,.25)",
                  fontSize:
                    13,
                  fontWeight:
                    800,
                }}
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(
                      scoreNowReturnPath
                    )}`}
                style={{
                  color:
                    "inherit",
                  textDecoration:
                    "none",
                  padding:
                    "8px 12px",
                  borderRadius:
                    999,
                  border:
                    "1px solid rgba(148,163,184,.25)",
                  fontSize:
                    13,
                  fontWeight:
                    800,
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        <section
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(280px, 1fr))",
            gap:
              16,
            alignItems:
              "start",
          }}
        >
          <div
            style={{
              minWidth:
                0,
            }}
          >
            <div
              style={{
                display:
                  "inline-flex",
                alignItems:
                  "center",
                gap:
                  6,
                padding:
                  "7px 10px",
                borderRadius:
                  999,
                border:
                  "1px solid rgba(56,189,248,.28)",
                background:
                  "rgba(14,116,144,.12)",
                color:
                  "#bae6fd",
                fontSize:
                  12,
                fontWeight:
                  900,
              }}
            >
              ⚡ QUICK MATCH
            </div>

            <h1
              style={{
                margin:
                  "14px 0 8px",
                fontSize:
                  "clamp(28px, 6vw, 46px)",
                lineHeight:
                  1.02,
                letterSpacing:
                  "-0.03em",
              }}
            >
              Score a cricket
              match now.
            </h1>

            <p
              style={{
                margin:
                  0,
                maxWidth:
                  560,
                color:
                  "#cbd5e1",
                fontSize:
                  "clamp(15px, 2.8vw, 18px)",
                lineHeight:
                  1.55,
              }}
            >
              Enter the two team
              names and overs.
              Cric4All creates the
              setup and sends you
              straight into the
              normal scorer
              workflow.
            </p>

            <div
              style={{
                marginTop:
                  18,
                display:
                  "grid",
                gap:
                  9,
              }}
            >
              {[
                "📴 Keep scoring if connectivity drops",
                "🌧 Rain / DLS workflows are available",
                "📊 Full scorecard and player statistics",
                "🔗 Share the live match with spectators",
              ].map(
                (
                  item
                ) => (
                  <div
                    key={
                      item
                    }
                    style={{
                      padding:
                        "10px 12px",
                      borderRadius:
                        12,
                      border:
                        "1px solid rgba(148,163,184,.14)",
                      background:
                        "rgba(15,23,42,.48)",
                      fontSize:
                        13,
                      lineHeight:
                        1.35,
                    }}
                  >
                    {item}
                  </div>
                )
              )}
            </div>
          </div>

          <form
            onSubmit={
              createQuickMatch
            }
            style={{
              minWidth:
                0,
              padding:
                "clamp(16px, 3vw, 24px)",
              borderRadius:
                20,
              border:
                "1px solid rgba(96,165,250,.23)",
              background:
                "rgba(15,23,42,.78)",
              boxShadow:
                "0 18px 60px rgba(0,0,0,.20)",
            }}
          >
            <div
              style={{
                marginBottom:
                  14,
              }}
            >
              <strong
                style={{
                  display:
                    "block",
                  fontSize:
                    19,
                }}
              >
                🏏 Match Setup
              </strong>

              <span
                style={{
                  display:
                    "block",
                  marginTop:
                    4,
                  color:
                    "#94a3b8",
                  fontSize:
                    12,
                  lineHeight:
                    1.4,
                }}
              >
                You can change
                detailed settings
                later.
              </span>
            </div>

            {activeLeagueAvailable && (
              <label
                style={{
                  display:
                    "flex",
                  gap:
                    10,
                  alignItems:
                    "flex-start",
                  marginBottom:
                    14,
                  padding:
                    12,
                  borderRadius:
                    12,
                  border:
                    "1px solid rgba(52,211,153,.20)",
                  background:
                    "rgba(6,78,59,.10)",
                  cursor:
                    "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    Boolean(
                      form
                        .useActiveLeague
                    )
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "useActiveLeague",
                      event
                        .target
                        .checked
                    )
                  }
                  style={{
                    marginTop:
                      2,
                  }}
                />

                <span
                  style={{
                    minWidth:
                      0,
                  }}
                >
                  <strong
                    style={{
                      display:
                        "block",
                      fontSize:
                        13,
                    }}
                  >
                    Use my active
                    league
                  </strong>

                  <small
                    style={{
                      display:
                        "block",
                      marginTop:
                        3,
                      color:
                        "#a7f3d0",
                      overflowWrap:
                        "anywhere",
                    }}
                  >
                    {
                      userContext
                        .activeLeagueName
                    }
                  </small>
                </span>
              </label>
            )}

            {!form.useActiveLeague && (
              <label
                style={{
                  display:
                    "grid",
                  gap:
                    6,
                  marginBottom:
                    12,
                }}
              >
                <span
                  style={{
                    fontSize:
                      12,
                    fontWeight:
                      900,
                  }}
                >
                  League / Group
                </span>

                <input
                  value={
                    form
                      .leagueName
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "leagueName",
                      event
                        .target
                        .value
                    )
                  }
                  maxLength={
                    70
                  }
                  placeholder="My Cricket League"
                  style={{
                    width:
                      "100%",
                    minWidth:
                      0,
                    boxSizing:
                      "border-box",
                    padding:
                      "12px 13px",
                    borderRadius:
                      11,
                    border:
                      "1px solid rgba(148,163,184,.25)",
                    background:
                      "rgba(2,6,23,.48)",
                    color:
                      "inherit",
                    fontSize:
                      16,
                    outline:
                      "none",
                  }}
                />
              </label>
            )}

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(145px, 1fr))",
                gap:
                  10,
              }}
            >
              <label
                style={{
                  display:
                    "grid",
                  gap:
                    6,
                }}
              >
                <span
                  style={{
                    fontSize:
                      12,
                    fontWeight:
                      900,
                  }}
                >
                  Team 1
                </span>

                <input
                  value={
                    form
                      .teamAName
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "teamAName",
                      event
                        .target
                        .value
                    )
                  }
                  maxLength={
                    60
                  }
                  placeholder="Team A"
                  style={{
                    width:
                      "100%",
                    minWidth:
                      0,
                    boxSizing:
                      "border-box",
                    padding:
                      "12px 13px",
                    borderRadius:
                      11,
                    border:
                      "1px solid rgba(148,163,184,.25)",
                    background:
                      "rgba(2,6,23,.48)",
                    color:
                      "inherit",
                    fontSize:
                      16,
                    outline:
                      "none",
                  }}
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    6,
                }}
              >
                <span
                  style={{
                    fontSize:
                      12,
                    fontWeight:
                      900,
                  }}
                >
                  Team 2
                </span>

                <input
                  value={
                    form
                      .teamBName
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "teamBName",
                      event
                        .target
                        .value
                    )
                  }
                  maxLength={
                    60
                  }
                  placeholder="Team B"
                  style={{
                    width:
                      "100%",
                    minWidth:
                      0,
                    boxSizing:
                      "border-box",
                    padding:
                      "12px 13px",
                    borderRadius:
                      11,
                    border:
                      "1px solid rgba(148,163,184,.25)",
                    background:
                      "rgba(2,6,23,.48)",
                    color:
                      "inherit",
                    fontSize:
                      16,
                    outline:
                      "none",
                  }}
                />
              </label>
            </div>

            <div
              style={{
                marginTop:
                  12,
              }}
            >
              <span
                style={{
                  display:
                    "block",
                  marginBottom:
                    7,
                  fontSize:
                    12,
                  fontWeight:
                    900,
                }}
              >
                Overs per innings
              </span>

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(4, minmax(0, 1fr))",
                  gap:
                    7,
                }}
              >
                {[
                  5,
                  10,
                  20,
                ].map(
                  (
                    overs
                  ) => (
                    <button
                      key={
                        overs
                      }
                      type="button"
                      onClick={() =>
                        update(
                          "overs",
                          String(
                            overs
                          )
                        )
                      }
                      style={{
                        minWidth:
                          0,
                        minHeight:
                          42,
                        padding:
                          "8px 6px",
                        borderRadius:
                          10,
                        border:
                          Number(
                            form
                              .overs
                          ) ===
                          overs
                            ? "2px solid rgba(56,189,248,.95)"
                            : "1px solid rgba(148,163,184,.22)",
                        background:
                          Number(
                            form
                              .overs
                          ) ===
                          overs
                            ? "linear-gradient(135deg, rgba(37,99,235,.95), rgba(14,165,233,.95))"
                            : "rgba(2,6,23,.40)",
                        color:
                          "#fff",
                        fontWeight:
                          900,
                        cursor:
                          "pointer",
                      }}
                    >
                      {overs}
                    </button>
                  )
                )}

                <input
                  aria-label="Custom overs"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={
                    [5, 10, 20]
                      .includes(
                        Number(
                          form
                            .overs
                        )
                      )
                      ? ""
                      : form
                          .overs
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "overs",
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Other"
                  style={{
                    width:
                      "100%",
                    minWidth:
                      0,
                    boxSizing:
                      "border-box",
                    padding:
                      "8px 6px",
                    borderRadius:
                      10,
                    border:
                      "1px solid rgba(148,163,184,.22)",
                    background:
                      "rgba(2,6,23,.40)",
                    color:
                      "inherit",
                    fontWeight:
                      900,
                    textAlign:
                      "center",
                    fontSize:
                      14,
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowPlayers(
                  (
                    previous
                  ) =>
                    !previous
                )
              }
              style={{
                width:
                  "100%",
                marginTop:
                  12,
                padding:
                  "10px 12px",
                borderRadius:
                  11,
                border:
                  "1px solid rgba(148,163,184,.20)",
                background:
                  "rgba(30,41,59,.55)",
                color:
                  "inherit",
                fontSize:
                  13,
                fontWeight:
                  800,
                cursor:
                  "pointer",
              }}
            >
              {showPlayers
                ? "− Hide player names"
                : "+ Add player names now (optional)"}
            </button>

            {showPlayers && (
              <div
                style={{
                  marginTop:
                    10,
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap:
                    10,
                }}
              >
                {[
                  [
                    "teamAPlayers",
                    `${form.teamAName || "Team 1"} players`,
                    teamAPlayers.length,
                  ],
                  [
                    "teamBPlayers",
                    `${form.teamBName || "Team 2"} players`,
                    teamBPlayers.length,
                  ],
                ].map(
                  ([
                    field,
                    label,
                    count,
                  ]) => (
                    <label
                      key={
                        field
                      }
                      style={{
                        display:
                          "grid",
                        gap:
                          6,
                        minWidth:
                          0,
                      }}
                    >
                      <span
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap:
                            8,
                          fontSize:
                            12,
                          fontWeight:
                            900,
                        }}
                      >
                        <span>
                          {
                            label
                          }
                        </span>

                        <small
                          style={{
                            opacity:
                              0.65,
                          }}
                        >
                          {
                            count
                          }
                        </small>
                      </span>

                      <textarea
                        value={
                          form[
                            field
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          update(
                            field,
                            event
                              .target
                              .value
                          )
                        }
                        rows={
                          5
                        }
                        placeholder={
                          "One player per line"
                        }
                        style={{
                          width:
                            "100%",
                          minWidth:
                            0,
                          boxSizing:
                            "border-box",
                          resize:
                            "vertical",
                          padding:
                            "11px 12px",
                          borderRadius:
                            11,
                          border:
                            "1px solid rgba(148,163,184,.22)",
                          background:
                            "rgba(2,6,23,.40)",
                          color:
                            "inherit",
                          fontSize:
                            14,
                          lineHeight:
                            1.45,
                        }}
                      />
                    </label>
                  )
                )}

                <p
                  style={{
                    gridColumn:
                      "1 / -1",
                    margin:
                      0,
                    color:
                      "#94a3b8",
                    fontSize:
                      12,
                    lineHeight:
                      1.45,
                  }}
                >
                  If you leave
                  player names
                  blank, Cric4All
                  creates two
                  temporary players
                  per team so the
                  normal delivery
                  setup can open
                  immediately. You
                  can rename or add
                  players later.
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                style={{
                  marginTop:
                    12,
                  padding:
                    "10px 12px",
                  borderRadius:
                    10,
                  border:
                    "1px solid rgba(248,113,113,.34)",
                  background:
                    "rgba(127,29,29,.17)",
                  color:
                    "#fecaca",
                  fontSize:
                    13,
                  lineHeight:
                    1.4,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                saving
              }
              style={{
                width:
                  "100%",
                marginTop:
                  14,
                minHeight:
                  50,
                padding:
                  "11px 14px",
                border:
                  0,
                borderRadius:
                  12,
                background:
                  "linear-gradient(135deg, #2563eb, #22c1dc)",
                color:
                  "#fff",
                fontSize:
                  15,
                fontWeight:
                  950,
                cursor:
                  saving
                    ? "wait"
                    : "pointer",
                opacity:
                  saving
                    ? 0.72
                    : 1,
                boxShadow:
                  "0 10px 26px rgba(37,99,235,.22)",
              }}
            >
              {saving
                ? "Creating your match…"
                : userContext?.signedIn
                  ? "🏏 Create Match & Start Scoring"
                  : "🏏 Continue to Score This Match"}
            </button>

            <p
              style={{
                margin:
                  "9px 0 0",
                textAlign:
                  "center",
                color:
                  "#94a3b8",
                fontSize:
                  11,
                lineHeight:
                  1.4,
              }}
            >
              Detailed roles,
              powerplay, wicket
              limits, DLS and other
              match settings remain
              available in the
              normal Cric4All
              workflow.
            </p>

            {authRequired && (
              <div
                style={{
                  marginTop:
                    14,
                  padding:
                    14,
                  borderRadius:
                    14,
                  border:
                    "1px solid rgba(56,189,248,.28)",
                  background:
                    "rgba(7,89,133,.13)",
                }}
              >
                <strong
                  style={{
                    display:
                      "block",
                    fontSize:
                      14,
                  }}
                >
                  Your match setup
                  is saved on this
                  device.
                </strong>

                <p
                  style={{
                    margin:
                      "6px 0 10px",
                    color:
                      "#bae6fd",
                    fontSize:
                      12,
                    lineHeight:
                      1.45,
                  }}
                >
                  Sign in or create
                  a free Cric4All
                  account, then
                  return here. Your
                  team names and
                  overs will still
                  be waiting.
                </p>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(130px, 1fr))",
                    gap:
                      8,
                  }}
                >
                  <Link
                    href={`/login?callbackUrl=${encodeURIComponent(
                      scoreNowReturnPath
                    )}`}
                    onClick={() =>
                      trackGrowthEvent(
                        "QUICK_MATCH_AUTH_CLICKED",
                        {
                          source:
                            isSpectatorAcquisition
                              ? "SPECTATOR_SCORE_NOW_LOGIN"
                              : "SCORE_NOW_LOGIN",
                          matchId:
                            acquisitionContext
                              ?.originMatchId ||
                            undefined,
                          leagueId:
                            acquisitionContext
                              ?.originLeagueId ||
                            undefined,
                          metadata:
                            acquisitionMetadata,
                        }
                      )
                    }
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      minHeight:
                        42,
                      padding:
                        "8px 10px",
                      borderRadius:
                        10,
                      background:
                        "#2563eb",
                      color:
                        "#fff",
                      textDecoration:
                        "none",
                      fontWeight:
                        900,
                      fontSize:
                        13,
                    }}
                  >
                    Sign In
                  </Link>

                  <Link
                    href={`/register?next=${encodeURIComponent(
                      scoreNowReturnPath
                    )}`}
                    onClick={() => {
                      trackGrowthEvent(
                        "QUICK_MATCH_AUTH_CLICKED",
                        {
                          source:
                            "SCORE_NOW_REGISTER",
                        }
                      );

                      trackGrowthEvent(
                        "SIGNUP_STARTED",
                        {
                          source:
                            "SCORE_NOW",
                        }
                      );
                    }}
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      minHeight:
                        42,
                      padding:
                        "8px 10px",
                      borderRadius:
                        10,
                      border:
                        "1px solid rgba(96,165,250,.45)",
                      color:
                        "#fff",
                      textDecoration:
                        "none",
                      fontWeight:
                        900,
                      fontSize:
                        13,
                    }}
                  >
                    Create Free
                    Account
                  </Link>
                </div>
              </div>
            )}
          </form>
        </section>

        <section
          style={{
            marginTop:
              18,
            padding:
              14,
            borderRadius:
              14,
            border:
              "1px solid rgba(148,163,184,.14)",
            background:
              "rgba(15,23,42,.38)",
          }}
        >
          <strong
            style={{
              display:
                "block",
              marginBottom:
                7,
              fontSize:
                13,
            }}
          >
            What happens after I
            click Start Scoring?
          </strong>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(145px, 1fr))",
              gap:
                8,
            }}
          >
            {[
              "1️⃣ Cric4All creates the league/teams if needed.",
              "2️⃣ You choose who bats first.",
              "3️⃣ Select striker, non-striker and bowler.",
              "4️⃣ Score the first delivery.",
            ].map(
              (
                item
              ) => (
                <div
                  key={
                    item
                  }
                  style={{
                    padding:
                      "9px 10px",
                    borderRadius:
                      10,
                    background:
                      "rgba(2,6,23,.34)",
                    fontSize:
                      12,
                    lineHeight:
                      1.4,
                  }}
                >
                  {item}
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
