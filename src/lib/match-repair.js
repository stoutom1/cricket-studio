import {
  isLegalDelivery,
} from "@/lib/scoring";

function numericId(
  value
) {
  const parsed =
    Number(value);

  return Number.isInteger(
    parsed
  ) &&
    parsed > 0
    ? parsed
    : null;
}

function validPair(ball) {
  const strikerId =
    numericId(
      ball.strikerId
    );

  const nonStrikerId =
    numericId(
      ball.nonStrikerId
    );

  return (
    strikerId &&
    nonStrikerId &&
    strikerId !==
      nonStrikerId
  )
    ? {
        strikerId,
        nonStrikerId,
      }
    : null;
}

function otherMember(
  pair,
  playerId
) {
  if (!pair) {
    return null;
  }

  if (
    pair.strikerId ===
    playerId
  ) {
    return pair.nonStrikerId;
  }

  if (
    pair.nonStrikerId ===
    playerId
  ) {
    return pair.strikerId;
  }

  return null;
}

function expectedTotalRuns(
  ball
) {
  return (
    Number(
      ball.runsOffBat || 0
    ) +
    Number(
      ball.extras || 0
    )
  );
}

function expectedLegalDelivery(
  ball
) {
  return isLegalDelivery(
    String(
      ball.extraType ||
      "NONE"
    ),
    String(
      ball.wicketType ||
      "NONE"
    )
  );
}

function describeBall(
  ball
) {
  return {
    id:
      ball.id,

    inningsNo:
      Number(
        ball.inningsNo
      ),

    sequence:
      Number(
        ball.sequence
      ),

    overLabel:
      `${Number(
        ball.overNo || 0
      )}.${Number(
        ball.ballInOver || 0
      )}`,
  };
}

export function analyzeMatchRepair(
  balls
) {
  const sorted =
    [...balls].sort(
      (left, right) =>
        Number(
          left.inningsNo
        ) -
          Number(
            right.inningsNo
          ) ||
        Number(
          left.sequence
        ) -
          Number(
            right.sequence
          ) ||
        Number(
          left.id
        ) -
          Number(
            right.id
          )
    );

  const safeChanges = [];
  const warnings = [];

  for (
    let index = 0;
    index <
    sorted.length;
    index += 1
  ) {
    const ball =
      sorted[index];

    const previous =
      index > 0 &&
      Number(
        sorted[
          index - 1
        ].inningsNo
      ) ===
        Number(
          ball.inningsNo
        )
        ? sorted[
            index - 1
          ]
        : null;

    const next =
      index <
        sorted.length - 1 &&
      Number(
        sorted[
          index + 1
        ].inningsNo
      ) ===
        Number(
          ball.inningsNo
        )
        ? sorted[
            index + 1
          ]
        : null;

    const strikerId =
      numericId(
        ball.strikerId
      );

    const nonStrikerId =
      numericId(
        ball.nonStrikerId
      );

    const duplicatePair =
      strikerId &&
      nonStrikerId &&
      strikerId ===
        nonStrikerId;

    const missingStriker =
      !strikerId;

    const missingNonStriker =
      !nonStrikerId;

    if (
      duplicatePair ||
      missingStriker ||
      missingNonStriker
    ) {
      const knownPlayerId =
        strikerId ||
        nonStrikerId;

      const previousOther =
        otherMember(
          validPair(
            previous || {}
          ),
          knownPlayerId
        );

      const nextOther =
        otherMember(
          validPair(
            next || {}
          ),
          knownPlayerId
        );

      const inferredOther =
        previousOther &&
        nextOther &&
        previousOther !==
          nextOther
          ? null
          : previousOther ||
            nextOther ||
            null;

      if (
        knownPlayerId &&
        inferredOther &&
        inferredOther !==
          knownPlayerId
      ) {
        const data = {};

        if (
          duplicatePair ||
          missingNonStriker
        ) {
          data.nonStrikerId =
            inferredOther;
        } else if (
          missingStriker
        ) {
          data.strikerId =
            inferredOther;
        }

        safeChanges.push({
          ...describeBall(
            ball
          ),

          code:
            duplicatePair
              ? "DUPLICATE_BATTER_PAIR"
              : "MISSING_BATTER",

          message:
            duplicatePair
              ? "Striker and non-striker are the same player."
              : "A striker/non-striker value is missing.",

          before: {
            strikerId:
              ball.strikerId,

            nonStrikerId:
              ball.nonStrikerId,
          },

          after: {
            strikerId:
              data.strikerId ??
              ball.strikerId,

            nonStrikerId:
              data.nonStrikerId ??
              ball.nonStrikerId,
          },

          data,
          confidence:
            "HIGH",
        });
      } else {
        warnings.push({
          ...describeBall(
            ball
          ),

          code:
            "UNRESOLVED_BATTER_PAIR",

          message:
            "The batter pair is invalid, but adjacent deliveries do not provide one unambiguous repair.",
        });
      }
    }

    const calculatedTotal =
      expectedTotalRuns(
        ball
      );

    if (
      Number(
        ball.totalRuns
      ) !==
      calculatedTotal
    ) {
      safeChanges.push({
        ...describeBall(
          ball
        ),

        code:
          "TOTAL_RUNS_MISMATCH",

        message:
          "totalRuns does not equal runsOffBat + extras.",

        before: {
          totalRuns:
            ball.totalRuns,
        },

        after: {
          totalRuns:
            calculatedTotal,
        },

        data: {
          totalRuns:
            calculatedTotal,
        },

        confidence:
          "HIGH",
      });
    }

    const calculatedLegal =
      expectedLegalDelivery(
        ball
      );

    if (
      Boolean(
        ball.legalDelivery
      ) !==
      calculatedLegal
    ) {
      safeChanges.push({
        ...describeBall(
          ball
        ),

        code:
          "LEGAL_DELIVERY_MISMATCH",

        message:
          "legalDelivery conflicts with the extra/wicket type.",

        before: {
          legalDelivery:
            Boolean(
              ball.legalDelivery
            ),
        },

        after: {
          legalDelivery:
            calculatedLegal,
        },

        data: {
          legalDelivery:
            calculatedLegal,
        },

        confidence:
          "HIGH",
      });
    }
  }

  const grouped =
    new Map();

  for (
    const change of
    safeChanges
  ) {
    if (
      !grouped.has(
        change.id
      )
    ) {
      grouped.set(
        change.id,
        {
          id:
            change.id,

          inningsNo:
            change.inningsNo,

          sequence:
            change.sequence,

          overLabel:
            change.overLabel,

          data: {},

          issues: [],
        }
      );
    }

    const item =
      grouped.get(
        change.id
      );

    Object.assign(
      item.data,
      change.data
    );

    item.issues.push(
      change
    );
  }

  return {
    safeChanges:
      [...grouped.values()],

    warnings,

    counts: {
      balls:
        sorted.length,

      safeChanges:
        grouped.size,

      warnings:
        warnings.length,
    },

    canApply:
      grouped.size > 0,
  };
}
