import prisma from "@/lib/prisma";
import {
  buildPublicMatchResult,
  summarizePublicInnings,
  isMeaningfulCricketResultText,
} from "@/lib/public-match-result";

const FINAL_STATUSES =
  new Set([
    "COMPLETED",
    "COMPLETED_LOCKED",
    "COMPLETED_CORRECTED",
    "ABANDONED",
  ]);

function normalizeStatus(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

export async function getLiveShareMatch(
  shareCode
) {
  const code =
    String(
      shareCode ||
      ""
    ).trim();

  if (!code) {
    return null;
  }

  const match =
    await prisma.match.findFirst({
      where: {
        OR: [
          {
            shareCode:
              code,
          },
          ...(
            Number.isInteger(
              Number(code)
            )
              ? [
                  {
                    id:
                      Number(code),
                  },
                ]
              : []
          ),
        ],
      },
      select: {
        id: true,
        shareCode: true,
        status: true,
        statusText: true,
        scheduledAt: true,
        battingFirstTeamId: true,
        maxWicketsPerInnings: true,
        teamAId: true,
        teamBId: true,
        venueName: true,
        venueAddress: true,

        teamA: {
          select: {
            name: true,
          },
        },

        teamB: {
          select: {
            name: true,
          },
        },

        league: {
          select: {
            id: true,
            name: true,
            slug: true,
            visibility: true,
          },
        },

        balls: {
          select: {
            inningsNo: true,
            totalRuns: true,
            isWicket: true,
            wicketType: true,
            legalDelivery: true,
          },
        },
      },
    });

  if (!match) {
    return null;
  }

  const innings1 =
    summarizePublicInnings(
      match.balls ||
        [],
      1
    );

  const innings2 =
    summarizePublicInnings(
      match.balls ||
        [],
      2
    );

  const status =
    normalizeStatus(
      match.status
    );

  const isFinal =
    FINAL_STATUSES.has(
      status
    );

  const realResult =
    isFinal
      ? buildPublicMatchResult(
          match
        )
      : null;

  const storedStatus =
    String(
      match.statusText ||
      ""
    ).trim();

  const usefulLiveStatus =
    !isFinal &&
    isMeaningfulCricketResultText(
      storedStatus
    )
      ? storedStatus
      : "";

  const currentInnings =
    innings2.legalBalls >
      0
      ? 2
      : 1;

  const firstBattingTeamId =
    Number(
      match.battingFirstTeamId
    ) ||
    Number(
      match.teamAId
    );

  const secondBattingTeamId =
    firstBattingTeamId ===
    Number(
      match.teamAId
    )
      ? Number(
          match.teamBId
        )
      : Number(
          match.teamAId
        );

  function teamName(
    teamId
  ) {
    return Number(
      teamId
    ) ===
      Number(
        match.teamAId
      )
      ? match.teamA?.name ||
          "Team A"
      : match.teamB?.name ||
          "Team B";
  }

  const currentSummary =
    currentInnings ===
      2
      ? innings2
      : innings1;

  const currentTeamName =
    currentInnings ===
      2
      ? teamName(
          secondBattingTeamId
        )
      : teamName(
          firstBattingTeamId
        );

  const description =
    isFinal
      ? `${realResult}. View the full Cric4All scorecard and ball-by-ball details.`
      : `${currentTeamName} ${currentSummary.runs}/${currentSummary.wickets} (${currentSummary.overs} ov). Follow ${match.teamA?.name || "Team A"} vs ${match.teamB?.name || "Team B"} live on Cric4All.`;

  return {
    match,
    innings1,
    innings2,
    currentInnings,
    currentSummary,
    currentTeamName,
    status,
    isFinal,
    resultText:
      realResult,
    liveStatus:
      usefulLiveStatus,
    description,
  };
}
