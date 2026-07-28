import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

function cleanModelJson(value) {
  return String(value || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function cleanPlayerNames(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();

  return value
    .map((name) =>
      String(name || "")
        .replace(/^[\d.\-•)\s]+/, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((name) => {
      if (!name) {
        return false;
      }

      const normalizedName = name.toLowerCase();

      if (seen.has(normalizedName)) {
        return false;
      }

      seen.add(normalizedName);
      return true;
    });
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured on the server.",
        },
        {
          status: 500,
        }
      );
    }

    const session =
  await getServerSession(authOptions);

if (!session?.user) {
  return NextResponse.json(
    {
      error: "Unauthorized.",
    },
    {
      status: 401,
    }
  );
}

    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Please upload a playing-teams screenshot.",
        },
        {
          status: 400,
        }
      );
    }

    if (!SUPPORTED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json(
        {
          error:
            "Unsupported screenshot format. Please use PNG, JPG, JPEG, or WEBP.",
        },
        {
          status: 400,
        }
      );
    }

    if (image.size <= 0) {
      return NextResponse.json(
        {
          error: "The uploaded screenshot is empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (image.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error:
            "The screenshot must be 8 MB or smaller.",
        },
        {
          status: 400,
        }
      );
    }

    const imageBuffer = Buffer.from(
      await image.arrayBuffer()
    );

    const base64Image =
      imageBuffer.toString("base64");

    const imageDataUrl =
      `data:${image.type};base64,${base64Image}`;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response =
      await openai.responses.create({
        model: "gpt-4.1-mini",

        input: [
          {
            role: "user",

            content: [
              {
                type: "input_text",

                text: `
You are reading a cricket playing-team screenshot.

The screenshot normally contains two vertical columns of player names:

- leftTeam: every player name in the left playing-team column
- rightTeam: every player name in the right playing-team column

Instructions:

1. Read only actual player names.
2. Preserve the order from top to bottom.
3. Do not include spreadsheet headings such as X, Y, Z, Team A, Team B, or column labels.
4. Preserve useful cricket annotations attached to a name, such as "(WK)".
5. A suffix such as "+1" may represent an additional unnamed player. Preserve it as part of the detected row.
6. Do not invent names that cannot be read.
7. Do not combine names from the two columns.
8. Ignore blank rows, borders, grid lines, spreadsheet controls, and surrounding UI.
9. Return only valid JSON.
10. Do not wrap the response in Markdown or code fences.

Return exactly this structure:

{
  "leftTeam": ["Player 1", "Player 2"],
  "rightTeam": ["Player 1", "Player 2"],
  "confidence": "HIGH",
  "warnings": []
}

The confidence value must be one of:

"HIGH"
"MEDIUM"
"LOW"

Warnings must contain short descriptions of rows that may need human review.
                `.trim(),
              },

              {
                type: "input_image",
                image_url: imageDataUrl,
                detail: "high",
              },
            ],
          },
        ],
      });

    const rawOutput =
      cleanModelJson(response.output_text);

    let parsedOutput;

    try {
      parsedOutput = JSON.parse(rawOutput);
    } catch (parseError) {
      console.error(
        "Kit OCR JSON parse failed:",
        {
          parseError,
          rawOutput,
        }
      );

      return NextResponse.json(
        {
          error:
            "The screenshot was read, but the player-list response could not be understood. Please try again.",
        },
        {
          status: 502,
        }
      );
    }

    const leftTeam = cleanPlayerNames(
      parsedOutput?.leftTeam
    );

    const rightTeam = cleanPlayerNames(
      parsedOutput?.rightTeam
    );

    if (
      leftTeam.length === 0 &&
      rightTeam.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No player names could be detected. Try cropping the screenshot so both player columns are larger and clearer.",
        },
        {
          status: 422,
        }
      );
    }

    const validConfidenceValues = new Set([
      "HIGH",
      "MEDIUM",
      "LOW",
    ]);

    const confidence = validConfidenceValues.has(
      String(
        parsedOutput?.confidence || ""
      ).toUpperCase()
    )
      ? String(
          parsedOutput.confidence
        ).toUpperCase()
      : "MEDIUM";

    const warnings = Array.isArray(
      parsedOutput?.warnings
    )
      ? parsedOutput.warnings
          .map((warning) =>
            String(warning || "").trim()
          )
          .filter(Boolean)
          .slice(0, 10)
      : [];

    return NextResponse.json({
      success: true,
      leftTeam,
      rightTeam,
      confidence,
      warnings,
      counts: {
        leftTeam: leftTeam.length,
        rightTeam: rightTeam.length,
      },
    });
  } catch (error) {
console.error(
  "Kit screenshot reading failed:",
  {
    status: error?.status,
    code: error?.code,
    type: error?.type,
    message: error?.message,
    requestId: error?.requestID,
  }
);

    const errorStatus =
      Number(error?.status) || 500;

    if (errorStatus === 401) {
      return NextResponse.json(
        {
          error:
            "The OpenAI API key is invalid or unavailable.",
        },
        {
          status: 500,
        }
      );
    }

if (
  errorStatus === 429 &&
  error?.code === "insufficient_quota"
) {
  return NextResponse.json(
    {
      error:
        "Automatic screenshot reading is currently unavailable because the Cric4All OCR service has no remaining API credit. An administrator must update the API billing balance. You can still enter player names manually.",
      code: "OCR_QUOTA_EXCEEDED",
    },
    {
      status: 503,
    }
  );
}

if (errorStatus === 429) {
  return NextResponse.json(
    {
      error:
        "The screenshot-reading service is receiving too many requests. Please wait briefly and try again.",
      code: "OCR_RATE_LIMITED",
    },
    {
      status: 429,
    }
  );
}

    return NextResponse.json(
      {
        error:
          "Unable to read player names from the screenshot. Please try again.",
      },
      {
        status:
          errorStatus >= 400 &&
          errorStatus < 600
            ? errorStatus
            : 500,
      }
    );
  }
}