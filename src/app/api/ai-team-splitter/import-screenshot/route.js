import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    teams: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          teamName: { type: "string" },
          players: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["teamName", "players"],
      },
    },
    unassignedPlayers: {
      type: "array",
      items: { type: "string" },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["teams", "unassignedPlayers", "warnings"],
};

function cleanPlayerName(value) {
  return String(value || "")
    .replace(/^\s*\d+[.)-]?\s*/, "")
    .replace(/\s*[•|·]+\s*$/g, "")
    .replace(/\s*\((?:c|vc|wk|captain|vice captain|wicketkeeper)\)\s*/gi, " ")
    .replace(/\s*[-–—]\s*(?:c|vc|wk|captain|vice captain|wicketkeeper)\s*$/gi, "")
    .replace(/[✅☑️✔️]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausiblePlayerName(value) {
  if (!value || value.length > 80) return false;
  if (!/[a-z]/i.test(value)) return false;
  if (/^(team|players?|squad|date|time|match|versus|vs|available|unavailable)$/i.test(value)) {
    return false;
  }
  if (/^\+?\d[\d\s()-]{7,}$/.test(value)) return false;
  return true;
}

function dedupeNames(names) {
  const seen = new Set();
  const cleaned = [];

  for (const rawName of names || []) {
    const name = cleanPlayerName(rawName);
    const key = name.toLocaleLowerCase();
    if (!isPlausiblePlayerName(name) || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(name);
  }

  return cleaned;
}

function sanitizeExtraction(value) {
  const teamNames = new Set();
  const teams = [];

  for (const [index, rawTeam] of (value?.teams || []).entries()) {
    const teamName = String(rawTeam?.teamName || "").trim() || `Detected Team ${index + 1}`;
    const players = dedupeNames(rawTeam?.players);
    if (!players.length) continue;

    let uniqueTeamName = teamName;
    let suffix = 2;
    while (teamNames.has(uniqueTeamName.toLocaleLowerCase())) {
      uniqueTeamName = `${teamName} ${suffix}`;
      suffix += 1;
    }
    teamNames.add(uniqueTeamName.toLocaleLowerCase());
    teams.push({ teamName: uniqueTeamName, players });
  }

  const namesAlreadyInTeams = new Set(
    teams.flatMap((team) => team.players.map((name) => name.toLocaleLowerCase()))
  );
  const unassignedPlayers = dedupeNames(value?.unassignedPlayers).filter(
    (name) => !namesAlreadyInTeams.has(name.toLocaleLowerCase())
  );

  const warnings = [...new Set(
    (value?.warnings || [])
      .map((warning) => String(warning || "").trim())
      .filter(Boolean)
  )].slice(0, 10);

  return { teams, unassignedPlayers, warnings };
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a screenshot to upload." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPG/JPEG, and WebP screenshots are supported." },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "The screenshot must be smaller than 8 MB." },
        { status: 400 }
      );
    }

    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const imageUrl = `data:${file.type};base64,${imageBase64}`;

    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-5-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Extract cricket team headings and player names from this screenshot.",
                  "Return only people who appear to be players.",
                  "Preserve the visible team grouping and reading order.",
                  "Remove numbering, bullets, emojis, jersey numbers, and role markers such as (C), (VC), or (WK) from player names.",
                  "Do not treat dates, times, phone numbers, scores, buttons, app labels, or status text as player names.",
                  "Put names without a reliable team heading in unassignedPlayers.",
                  "Add short warnings when text is blurry, truncated, duplicated, or uncertain.",
                ].join(" "),
              },
              {
                type: "input_image",
                image_url: imageUrl,
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "cricket_team_screenshot",
            strict: true,
            schema: extractionSchema,
          },
        },
      }),
    });

    const openAIData = await openAIResponse.json();
    if (!openAIResponse.ok) {
      console.error("Screenshot extraction failed:", openAIData);
      return NextResponse.json(
        {
          error:
            openAIData?.error?.message ||
            "The screenshot could not be analyzed. Please try again.",
        },
        { status: openAIResponse.status >= 400 && openAIResponse.status < 500 ? 400 : 502 }
      );
    }

    // `output_text` is an SDK-only convenience property. Because this route
    // calls the REST endpoint with fetch(), read the text from the response
    // output array instead. Keep the fallback for compatibility.
    const outputText =
      openAIData.output_text ||
      (openAIData.output || [])
        .flatMap((item) => item?.content || [])
        .filter((part) => part?.type === "output_text" && typeof part?.text === "string")
        .map((part) => part.text)
        .join("\n")
        .trim();

    if (!outputText) {
      console.error("No output text in screenshot response:", openAIData);
      return NextResponse.json(
        { error: "No readable team list was returned from the screenshot." },
        { status: 422 }
      );
    }

    let extracted;
    try {
      extracted = JSON.parse(outputText);
    } catch {
      console.error("Invalid screenshot extraction JSON:", outputText);
      return NextResponse.json(
        { error: "The screenshot result could not be read. Please try again." },
        { status: 502 }
      );
    }

    const result = sanitizeExtraction(extracted);
    const totalPlayers =
      result.teams.reduce((sum, team) => sum + team.players.length, 0) +
      result.unassignedPlayers.length;

    if (!totalPlayers) {
      return NextResponse.json(
        {
          error:
            "No player names were detected. Upload a clearer screenshot with visible team headings and names.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ...result,
      totalPlayers,
      sourceFileName: file.name,
    });
  } catch (error) {
    console.error("import-screenshot route error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to analyze the screenshot." },
      { status: 500 }
    );
  }
}
