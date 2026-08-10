import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

import {
  buildSuperOverState,
  isLegalSuperOverDelivery,
  isMainMatchTied,
} from "@/lib/super-over";

export const runtime = "nodejs";

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

async function loadMatch(matchId) {
  return prisma.match.findUnique({
    where: {
      id: matchId,
    },

    include: {
      teamA: {
        include: {
          players: {
            orderBy: {
              name: "asc",
            },
          },
        },
      },

      teamB: {
        include: {
          players: {
            orderBy: {
              name: "asc",
            },
          },
        },
      },

      battingFirstTeam: true,

      balls: {
        orderBy: [
          {
            inningsNo: "asc",
          },
          {
            sequence: "asc",
          },
          {
            id: "asc",
          },
        ],
      },

      events: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });
}

function teamById(match, teamId) {
  if (Number(match.teamAId) === Number(teamId)) {
    return match.teamA;
  }

  if (Number(match.teamBId) === Number(teamId)) {
    return match.teamB;
  }

  return null;
}

function otherTeamId(match, teamId) {
  return Number(match.teamAId) === Number(teamId)
    ? Number(match.teamBId)
    : Number(match.teamAId);
}

function playerBelongsTo(team, playerId) {
  return Boolean(
    team?.players?.some(
      (player) =>
        Number(player.id) === Number(playerId)
    )
  );
}

function publicState(match) {
  const state =
    buildSuperOverState(match);

  return {
    ...state,

    eligible:
      isMainMatchTied(match) ||
      state.exists,

    mainMatchTied:
      isMainMatchTied(match),

    teams: {
      teamA: {
        id: match.teamA.id,
        name: match.teamA.name,
        players: match.teamA.players,
      },

      teamB: {
        id: match.teamB.id,
        name: match.teamB.name,
        players: match.teamB.players,
      },
    },
  };
}

async function createEvent({
  matchId,
  round,
  superInnings = 0,
  eventType,
  data,
  strikerId = null,
  nonStrikerId = null,
}) {
  return prisma.matchEvent.create({
    data: {
      matchId,
      inningsNo:
        100 +
        Number(round || 0) * 10 +
        Number(superInnings || 0),
      eventType,
      strikerId:
        strikerId
          ? Number(strikerId)
          : null,
      nonStrikerId:
        nonStrikerId
          ? Number(nonStrikerId)
          : null,
      note:
        JSON.stringify({
          ...data,
          round: Number(round || 1),
          superInnings:
            Number(superInnings || 0),
        }),
    },
  });
}

export async function GET(
  request,
  {
    params,
  }
) {
  const session =
    await getServerSession(
      authOptions
    );

  if (!session?.user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const {
    id,
  } = await params;

  const matchId =
    validId(id);

  if (!matchId) {
    return NextResponse.json(
      {
        error:
          "Invalid match id",
      },
      {
        status: 400,
      }
    );
  }

  const match =
    await loadMatch(matchId);

  if (!match) {
    return NextResponse.json(
      {
        error:
          "Match not found",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json(
    publicState(match)
  );
}

export async function POST(
  request,
  {
    params,
  }
) {
  const session =
    await getServerSession(
      authOptions
    );

  if (!session?.user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const {
    id,
  } = await params;

  const matchId =
    validId(id);

  if (!matchId) {
    return NextResponse.json(
      {
        error:
          "Invalid match id",
      },
      {
        status: 400,
      }
    );
  }

  const body =
    await request.json();

  const action =
    String(
      body?.action ||
      ""
    )
      .trim()
      .toUpperCase();

  let match =
    await loadMatch(matchId);

  if (!match) {
    return NextResponse.json(
      {
        error:
          "Match not found",
      },
      {
        status: 404,
      }
    );
  }

  let state =
    buildSuperOverState(
      match
    );

  if (action === "START_ROUND") {
    const canStartFirst =
      !state.exists &&
      isMainMatchTied(match);

    const canStartNext =
      state.exists &&
      state.tied;

    if (
      !canStartFirst &&
      !canStartNext
    ) {
      return NextResponse.json(
        {
          error:
            "A Super Over can only start after a tied match or a tied previous Super Over.",
        },
        {
          status: 409,
        }
      );
    }

    const round =
      state.exists
        ? Number(state.round) + 1
        : 1;

    let firstBattingTeamId;

    if (round === 1) {
      /*
       * ICC Super Over convention:
       * team batting second in the main match bats first in the Super Over.
       */
      firstBattingTeamId =
        Number(match.battingFirstTeamId) ===
        Number(match.teamAId)
          ? Number(match.teamBId)
          : Number(match.teamAId);
    } else {
      /*
       * In a subsequent Super Over the side batting second in the previous
       * Super Over bats first, naturally alternating the order.
       */
      firstBattingTeamId =
        Number(
          state.secondBattingTeamId
        );
    }

    const secondBattingTeamId =
      otherTeamId(
        match,
        firstBattingTeamId
      );

    await createEvent({
      matchId,
      round,
      eventType:
        "SUPER_OVER_START",
      data: {
        firstBattingTeamId,
        secondBattingTeamId,
        startedAt:
          new Date().toISOString(),
      },
    });

    await prisma.match.update({
      where: {
        id: matchId,
      },

      data: {
        status:
          "COMPLETED",
        statusText:
          `Super Over ${round} in progress`,
      },
    });
  } else if (action === "SETUP") {
    if (
      !state.exists ||
      !state.active
    ) {
      return NextResponse.json(
        {
          error:
            "Start a Super Over round first.",
        },
        {
          status: 409,
        }
      );
    }

    const superInnings =
      Number(
        body?.superInnings ||
        state.currentSuperInnings
      );

    if (![1, 2].includes(superInnings)) {
      return NextResponse.json(
        {
          error:
            "Invalid Super Over innings.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      superInnings !==
      Number(
        state.currentSuperInnings
      )
    ) {
      return NextResponse.json(
        {
          error:
            "That Super Over innings is not currently active.",
        },
        {
          status: 409,
        }
      );
    }

    const battingTeamId =
      superInnings === 1
        ? state.firstBattingTeamId
        : state.secondBattingTeamId;

    const bowlingTeamId =
      otherTeamId(
        match,
        battingTeamId
      );

    const battingTeam =
      teamById(
        match,
        battingTeamId
      );

    const bowlingTeam =
      teamById(
        match,
        bowlingTeamId
      );

    const batter1Id =
      validId(
        body?.batter1Id
      );

    const batter2Id =
      validId(
        body?.batter2Id
      );

    const batter3Id =
      body?.batter3Id
        ? validId(
            body.batter3Id
          )
        : null;

    const bowlerId =
      validId(
        body?.bowlerId
      );

    if (
      !batter1Id ||
      !batter2Id ||
      !bowlerId
    ) {
      return NextResponse.json(
        {
          error:
            "Select two opening batters and a bowler.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      batter1Id === batter2Id ||
      (
        batter3Id &&
        [
          batter1Id,
          batter2Id,
        ].includes(
          batter3Id
        )
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Super Over batters must be different players.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !playerBelongsTo(
        battingTeam,
        batter1Id
      ) ||
      !playerBelongsTo(
        battingTeam,
        batter2Id
      ) ||
      (
        batter3Id &&
        !playerBelongsTo(
          battingTeam,
          batter3Id
        )
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Selected batters must belong to the batting team.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !playerBelongsTo(
        bowlingTeam,
        bowlerId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Selected bowler must belong to the bowling team.",
        },
        {
          status: 400,
        }
      );
    }

    const current =
      superInnings === 1
        ? state.first
        : state.second;

    if (current?.setup) {
      return NextResponse.json(
        {
          error:
            "This Super Over innings is already set up.",
        },
        {
          status: 409,
        }
      );
    }

    await createEvent({
      matchId,
      round:
        state.round,
      superInnings,
      eventType:
        "SUPER_OVER_SETUP",
      strikerId:
        batter1Id,
      nonStrikerId:
        batter2Id,
      data: {
        battingTeamId,
        bowlingTeamId,
        batter1Id,
        batter2Id,
        batter3Id,
        bowlerId,
      },
    });
  } else if (action === "BALL") {
    if (
      !state.exists ||
      !state.active
    ) {
      return NextResponse.json(
        {
          error:
            "No active Super Over round.",
        },
        {
          status: 409,
        }
      );
    }

    const superInnings =
      Number(
        state.currentSuperInnings
      );

    const innings =
      superInnings === 1
        ? state.first
        : state.second;

    if (!innings?.setup) {
      return NextResponse.json(
        {
          error:
            "Select the Super Over batters and bowler first.",
        },
        {
          status: 409,
        }
      );
    }

    if (innings.complete) {
      return NextResponse.json(
        {
          error:
            "This Super Over innings is already complete.",
        },
        {
          status: 409,
        }
      );
    }

    const extraType =
      String(
        body?.extraType ||
        "NONE"
      ).toUpperCase();

    let runsOffBat =
      Math.max(
        0,
        Number(
          body?.runsOffBat ||
          0
        )
      );

    let extras =
      Math.max(
        0,
        Number(
          body?.extras ||
          0
        )
      );

    if (
      extraType === "WIDE" &&
      extras < 1
    ) {
      extras = 1;
    }

    if (
      extraType === "NOBALL" &&
      extras < 1
    ) {
      extras = 1;
    }

    const isWicket =
      Boolean(
        body?.isWicket
      );

    if (
      isWicket &&
      extraType === "NOBALL"
    ) {
      return NextResponse.json(
        {
          error:
            "Use a normal legal-delivery wicket in the Super Over scorer. A wicket cannot be recorded on this no-ball shortcut.",
        },
        {
          status: 400,
        }
      );
    }

    const legalDelivery =
      isLegalSuperOverDelivery(
        extraType
      );

    const totalRuns =
      runsOffBat +
      extras;

    const ballEvent =
      await createEvent({
        matchId,
        round:
          state.round,
        superInnings,
        eventType:
          "SUPER_OVER_BALL",
        strikerId:
          innings.strikerId,
        nonStrikerId:
          innings.nonStrikerId,
        data: {
          battingTeamId:
            superInnings === 1
              ? state.firstBattingTeamId
              : state.secondBattingTeamId,
          strikerId:
            innings.strikerId,
          nonStrikerId:
            innings.nonStrikerId,
          bowlerId:
            innings.bowlerId,
          runsOffBat,
          extras,
          extraType,
          totalRuns,
          isWicket,
          legalDelivery,
          sequence:
            innings.balls.length +
            1,
        },
      });

    match =
      await loadMatch(
        matchId
      );

    state =
      buildSuperOverState(
        match
      );

    const updated =
      superInnings === 1
        ? state.first
        : state.second;

    const targetReached =
      superInnings === 2 &&
      Number(
        updated.runs
      ) >=
      Number(
        state.target ||
        Infinity
      );

    const inningsComplete =
      updated.complete ||
      targetReached ||
      (
        updated.wickets === 1 &&
        !updated.thirdBatterId
      );

    if (inningsComplete) {
      await createEvent({
        matchId,
        round:
          state.round,
        superInnings,
        eventType:
          "SUPER_OVER_INNINGS_END",
        data: {
          runs:
            updated.runs,
          wickets:
            updated.wickets,
          legalBalls:
            updated.legalBalls,
          targetReached,
        },
      });

      if (superInnings === 2) {
        const firstRuns =
          Number(
            state.first.runs
          );

        const secondRuns =
          Number(
            updated.runs
          );

        if (
          secondRuns === firstRuns
        ) {
          await createEvent({
            matchId,
            round:
              state.round,
            eventType:
              "SUPER_OVER_ROUND_TIED",
            data: {
              firstRuns,
              secondRuns,
              resultText:
                `Super Over ${state.round} tied`,
            },
          });

          await prisma.match.update({
            where: {
              id: matchId,
            },

            data: {
              status:
                "COMPLETED",
              statusText:
                `Super Over ${state.round} tied — another Super Over required`,
            },
          });
        } else {
          const winnerTeamId =
            secondRuns >
            firstRuns
              ? Number(
                  state.secondBattingTeamId
                )
              : Number(
                  state.firstBattingTeamId
                );

          const winner =
            teamById(
              match,
              winnerTeamId
            );

          const margin =
            Math.abs(
              secondRuns -
              firstRuns
            );

          const roundResult =
            secondRuns >
            firstRuns
              ? `${winner?.name || "Team"} won Super Over ${state.round}`
              : `${winner?.name || "Team"} won Super Over ${state.round} by ${margin} run${margin === 1 ? "" : "s"}`;

          const matchResult =
            `${winner?.name || "Team"} won via Super Over`;

          await createEvent({
            matchId,
            round:
              state.round,
            eventType:
              "SUPER_OVER_RESULT",
            data: {
              winnerTeamId,
              winnerTeamName:
                winner?.name ||
                "Team",
              firstRuns,
              secondRuns,
              firstWickets:
                state.first.wickets,
              secondWickets:
                updated.wickets,
              roundResult,
              resultText:
                matchResult,
              completedAt:
                new Date().toISOString(),
            },
          });

          await prisma.match.update({
            where: {
              id: matchId,
            },

            data: {
              status:
                "COMPLETED",
              statusText:
                matchResult,
              endedAt:
                match.endedAt ||
                new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      ballEventId:
        ballEvent.id,
      state:
        publicState(
          await loadMatch(
            matchId
          )
        ),
    });
  } else if (action === "UNDO") {
    if (
      !state.exists ||
      !state.active ||
      !state.currentSuperInnings
    ) {
      return NextResponse.json(
        {
          error:
            "There is no active Super Over delivery to undo.",
        },
        {
          status: 409,
        }
      );
    }

    const innings =
      state.currentSuperInnings === 1
        ? state.first
        : state.second;

    const lastBall =
      innings?.balls?.[
        innings.balls.length - 1
      ];

    if (!lastBall) {
      return NextResponse.json(
        {
          error:
            "No Super Over delivery to undo.",
        },
        {
          status: 404,
        }
      );
    }

    await createEvent({
      matchId,
      round:
        state.round,
      superInnings:
        state.currentSuperInnings,
      eventType:
        "SUPER_OVER_UNDO",
      data: {
        ballEventId:
          lastBall.id,
      },
    });
  } else {
    return NextResponse.json(
      {
        error:
          "Unsupported Super Over action.",
      },
      {
        status: 400,
      }
    );
  }

  match =
    await loadMatch(
      matchId
    );

  return NextResponse.json({
    success: true,
    state:
      publicState(match),
  });
}
