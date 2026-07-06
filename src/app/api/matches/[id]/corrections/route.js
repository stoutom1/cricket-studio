import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

async function transferBatterRuns({ match, payload }) {
  const inningsNo = Number(payload.inningsNo);

if (![1, 2].includes(inningsNo)) {
  throw new Error("Invalid innings selected.");
}
  const fromPlayerId = Number(payload.fromPlayerId);
  const toPlayerId = Number(payload.toPlayerId);
  const runs = Number(payload.runs);

  if (!fromPlayerId || !toPlayerId || !runs || runs <= 0) {
    throw new Error("Invalid batter run transfer.");
  }

const matchingBalls =
  match.balls.filter(
    (b) =>
      Number(b.inningsNo) === inningsNo &&
      Number(b.strikerId) === fromPlayerId &&
      Number(b.runsOffBat || 0) > 0
  );

  let remaining = runs;
  const changed = [];

  for (const ball of matchingBalls.reverse()) {
    if (remaining <= 0) break;

    const moveRuns = Math.min(Number(ball.runsOffBat || 0), remaining);

    changed.push({
      id: ball.id,
      before: {
        strikerId: ball.strikerId,
        runsOffBat: ball.runsOffBat,
        note: ball.note,
      },
      after: {
        strikerId: toPlayerId,
        runsOffBat: ball.runsOffBat,
        note: appendCorrectionNote(
          ball.note,
          `Correction: ${moveRuns} run(s) credited to player ${toPlayerId}.`
        ),
      },
    });

    remaining -= moveRuns;
  }

  if (remaining > 0) {
    throw new Error("Not enough runs found to transfer from selected batter.");
  }

  for (const item of changed) {
    await prisma.ball.update({
      where: { id: item.id },
      data: item.after,
    });
  }

  return {
    label: `Transferred ${runs} run(s) from player ${fromPlayerId} to player ${toPlayerId}.`,
    beforeJson: { changed: changed.map((x) => ({ id: x.id, ...x.before })) },
    afterJson: { changed: changed.map((x) => ({ id: x.id, ...x.after })) },
  };
}

async function correctRetiredHurt({ match, payload }) {
  const inningsNo = Number(payload.inningsNo);
  const retiredBallId = Number(payload.retiredBallId);
  const correctedRetiredPlayerId = Number(payload.retiredPlayerId);
  const correctedReplacementPlayerId = Number(payload.replacementPlayerId);

  if (![1, 2].includes(inningsNo)) {
    throw new Error("Invalid innings selected.");
  }

  if (!retiredBallId) {
    throw new Error("Please select the retired hurt event.");
  }

  if (!correctedRetiredPlayerId) {
    throw new Error("Please select the retired batter.");
  }

  if (!correctedReplacementPlayerId) {
    throw new Error("Please select the replacement batter.");
  }

  if (correctedRetiredPlayerId === correctedReplacementPlayerId) {
    throw new Error("Retired batter and replacement batter cannot be the same.");
  }

  const retiredBall = match.balls.find(
    (ball) =>
      Number(ball.id) === retiredBallId &&
      Number(ball.inningsNo) === inningsNo &&
      String(ball.wicketType || "").toUpperCase() === "RETIRED_HURT"
  );

  if (!retiredBall) {
    throw new Error("Selected retired hurt event was not found.");
  }

  const oldRetiredPlayerId =
    Number(retiredBall.dismissedPlayerId) ||
    Number(retiredBall.strikerId);

  const oldReplacementPlayerId =
    Number(retiredBall.newBatterId);

  const beforeRetiredBall = snapshotBall(retiredBall);

  const retiredBallUpdate = {
    dismissedPlayerId: correctedRetiredPlayerId,
    newBatterId: correctedReplacementPlayerId,
    note: appendCorrectionNote(
      retiredBall.note,
      "Retired Hurt correction applied."
    ),
  };

  if (Number(retiredBall.strikerId) === oldRetiredPlayerId) {
    retiredBallUpdate.strikerId = correctedRetiredPlayerId;
  }

  if (Number(retiredBall.nonStrikerId) === oldRetiredPlayerId) {
    retiredBallUpdate.nonStrikerId = correctedRetiredPlayerId;
  }

const futureBalls = match.balls
  .filter(
    (ball) =>
      Number(ball.inningsNo) === inningsNo &&
      Number(ball.sequence) > Number(retiredBall.sequence)
  )
  .sort((a, b) => Number(a.sequence) - Number(b.sequence));

const affectedBalls = [];

for (const ball of futureBalls) {
  const retiredPlayerHasReturned =
    Number(ball.strikerId) === correctedRetiredPlayerId ||
    Number(ball.nonStrikerId) === correctedRetiredPlayerId;

  if (retiredPlayerHasReturned) {
    break;
  }

  const hasOldReplacement =
    Number(ball.strikerId) === oldReplacementPlayerId ||
    Number(ball.nonStrikerId) === oldReplacementPlayerId ||
    Number(ball.newBatterId) === oldReplacementPlayerId;

  if (oldReplacementPlayerId && hasOldReplacement) {
    affectedBalls.push(ball);
  }
}

  const beforeFutureBalls = affectedBalls.map(snapshotBall);

await prisma.ball.update({
  where: { id: retiredBall.id },
  data: retiredBallUpdate,
});

  const afterFutureBalls = [];

  for (const ball of affectedBalls) {
    const updateData = {};

    if (Number(ball.strikerId) === oldReplacementPlayerId) {
      updateData.strikerId = correctedReplacementPlayerId;
    }

    if (Number(ball.nonStrikerId) === oldReplacementPlayerId) {
      updateData.nonStrikerId = correctedReplacementPlayerId;
    }

    if (Number(ball.newBatterId) === oldReplacementPlayerId) {
      updateData.newBatterId = correctedReplacementPlayerId;
    }

    updateData.note = appendCorrectionNote(
      ball.note,
      `Retired hurt correction: replacement player ${oldReplacementPlayerId} changed to ${correctedReplacementPlayerId}.`
    );

    await prisma.ball.update({
      where: { id: ball.id },
      data: updateData,
    });

    afterFutureBalls.push({
      id: ball.id,
      ...updateData,
    });
  }

  const beforeBalls = [
    beforeRetiredBall,
    ...beforeFutureBalls,
  ];

  const label =
    affectedBalls.length === 0
      ? `Retired Hurt event corrected at ${retiredBall.overNo}.${retiredBall.ballInOver}.`
      : `Retired Hurt corrected at ${retiredBall.overNo}.${retiredBall.ballInOver}. ${affectedBalls.length} future ball(s) updated.`;

  return {
    label,
    beforeJson: {
      retiredBallId,
      oldRetiredPlayerId,
      oldReplacementPlayerId,
      correctedRetiredPlayerId,
      correctedReplacementPlayerId,
      retiredBallBefore: beforeRetiredBall,
      futureBallsBefore: beforeFutureBalls,
    },
    afterJson: {
      retiredBallId,
      correctedRetiredPlayerId,
      correctedReplacementPlayerId,
      retiredBallAfter: {
        id: retiredBall.id,
        ...retiredBallUpdate,
      },
      futureBallsUpdated: afterFutureBalls.length,
      futureBallsAfter: afterFutureBalls,
    },
    beforeBalls,
  };
}

async function reassignOverBowler({ match, payload }) {
const inningsNo = Number(payload.inningsNo);

if (![1, 2].includes(inningsNo)) {
  throw new Error("Invalid innings selected.");
}
  const overNo = Number(payload.overNo);
  const newBowlerId = Number(payload.newBowlerId);

  if (!inningsNo || overNo < 0 || !newBowlerId) {
    throw new Error("Invalid bowler correction.");
  }

  const startBall = overNo * 6 + 1;
  const endBall = overNo * 6 + 6;

  const ballsToUpdate = match.balls.filter(
    (b) =>
      Number(b.inningsNo) === inningsNo &&
      Number(b.legalBallNumber || b.sequence) >= startBall &&
      Number(b.legalBallNumber || b.sequence) <= endBall
  );

  if (!ballsToUpdate.length) {
    throw new Error("No balls found for this over.");
  }

  const before = ballsToUpdate.map((b) => ({
    id: b.id,
    bowlerId: b.bowlerId,
    note: b.note,
  }));

  for (const ball of ballsToUpdate) {
    await prisma.ball.update({
      where: { id: ball.id },
      data: {
        bowlerId: newBowlerId,
        note: appendCorrectionNote(
          ball.note,
          `Correction: over reassigned to bowler ${newBowlerId}.`
        ),
      },
    });
  }

  return {
    label: `Reassigned innings ${inningsNo}, over ${overNo} to bowler ${newBowlerId}.`,
    beforeJson: { balls: before },
    afterJson: {
      balls: ballsToUpdate.map((b) => ({
        id: b.id,
        bowlerId: newBowlerId,
      })),
    },
  };
}

async function changeFielder({ match, payload }) {
  const inningsNo = Number(payload.inningsNo);

if (![1, 2].includes(inningsNo)) {
  throw new Error("Invalid innings selected.");
}
const ballId = Number(payload.ballId);

if (!ballId || Number.isNaN(ballId)) {
  throw new Error("Please select a dismissal.");
}
  const fielderId = payload.fielderId ? Number(payload.fielderId) : null;
  const assistantFielderId = payload.assistantFielderId
    ? Number(payload.assistantFielderId)
    : null;

  if (!ballId) {
    throw new Error("Ball is required.");
  }

const ball =
  match.balls.find(
    (b) =>
      Number(b.id) === ballId &&
      Number(b.inningsNo) === inningsNo
  );

if (!ball) {
  throw new Error("Selected dismissal was not found for this innings.");
}
  const before = {
    id: ball.id,
    fielderId: ball.fielderId,
    assistantFielderId: ball.assistantFielderId,
    wicketNote: ball.wicketNote,
    note: ball.note,
  };

  const after = {
    fielderId,
    assistantFielderId,
    wicketNote: payload.wicketNote || ball.wicketNote || null,
    note: appendCorrectionNote(
      ball.note,
      `Correction: fielder changed to ${fielderId || "none"}.`
    ),
  };

  await prisma.ball.update({
    where: { id: ball.id },
    data: after,
  });

  return {
    label: `Updated fielding details for ball ${ballId}.`,
    beforeJson: before,
    afterJson: { id: ball.id, ...after },
  };
}

function appendCorrectionNote(existing, correctionText) {
  return [existing, correctionText].filter(Boolean).join(" | ");
}

function snapshotBall(ball) {
  return {
    id: ball.id,
    sequence: ball.sequence,
    strikerId: ball.strikerId,
    nonStrikerId: ball.nonStrikerId,
    bowlerId: ball.bowlerId,
    overNo: ball.overNo,
    ballInOver: ball.ballInOver,
    extraType: ball.extraType,
    runsOffBat: ball.runsOffBat,
    extras: ball.extras,
    totalRuns: ball.totalRuns,
    legalDelivery: ball.legalDelivery,
    isWicket: ball.isWicket,
    wicketType: ball.wicketType,
    dismissedPlayerId: ball.dismissedPlayerId,
    newBatterId: ball.newBatterId,
    fielderId: ball.fielderId,
    assistantFielderId: ball.assistantFielderId,
    wicketNote: ball.wicketNote,
    note: ball.note,
  };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const matchId = Number(id);

const corrections = await prisma.correctionLog.findMany({
  where: { matchId },
  orderBy: { createdAt: "desc" },
  take: 50,
});

  return NextResponse.json(corrections);
}

export async function POST(request, { params }) {
  const { id } = await params;
  const matchId = Number(id);
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { correctionType, payload, reason } = body;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      balls: {
        orderBy: [{ inningsNo: "asc" }, { sequence: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const status = String(match.status || "").toUpperCase();

  if (!["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(status)) {
    return NextResponse.json(
      { error: "Corrections are allowed only after match completion." },
      { status: 400 }
    );
  }

  let result;

  if (correctionType === "TRANSFER_BATTER_RUNS") {
    result = await transferBatterRuns({ match, payload });
  } else if (correctionType === "REASSIGN_OVER_BOWLER") {
    result = await reassignOverBowler({ match, payload });
  } else if (correctionType === "CHANGE_FIELDER") {
    result = await changeFielder({ match, payload });
  } else if (correctionType === "RETIRED_HURT") {
    result = await correctRetiredHurt({ match, payload });
  } else {
    return NextResponse.json({ error: "Invalid correction type." }, { status: 400 });
  }

const correction = await prisma.correctionLog.create({
  data: {
    type: correctionType,
    matchId,
    correctionType,
    correctionLabel: result.label,
    reason: reason || null,

    beforeJson: result.beforeJson,
    afterJson: result.afterJson,
    beforeBalls: result.beforeBalls || undefined,

    correctedById:
  session.user.id &&
  !Number.isNaN(Number(session.user.id))
    ? Number(session.user.id)
    : null,
    correctedByName: session.user.name || null,
    correctedByEmail: session.user.email || null,
  },
});

  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: status === "COMPLETED_LOCKED" ? "COMPLETED_LOCKED" : "COMPLETED_CORRECTED",
    },
  });

  await logAudit({
    action: "SCORE_CORRECTED",
    entityType: "MATCH",
    entityId: matchId,
    leagueId: match.leagueId,
    matchId,
    actor: session.user,
    description: result.label,
    beforeData: result.beforeJson,
    afterData: result.afterJson,
    request,
  });

  return NextResponse.json({ ok: true, correction });
}