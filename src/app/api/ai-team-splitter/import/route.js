import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeHeading(value) {
  return [
    "player", "player name", "name", "team", "team a", "team b",
    "squad", "players", "captain", "vice captain", "backup captain",
  ].includes(normalizeName(value));
}

function extractNamesFromWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const names = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    for (const row of rows) {
      for (const cell of row) {
        const value = String(cell || "").trim();
        if (!value || looksLikeHeading(value)) continue;
        if (/^\d+$/.test(value)) continue;
        if (value.length < 2 || value.length > 80) continue;
        names.push(value.replace(/^\d+[.)-]?\s*/, "").trim());
      }
    }
  }

  return names;
}

function extractNamesFromText(text) {
  const names = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    for (const part of line.split(/[,;\t|]/)) {
      const value = part.replace(/^\s*\d+[.)-]?\s*/, "").trim();
      if (!value || looksLikeHeading(value)) continue;
      if (/^\d+$/.test(value)) continue;
      if (value.length < 2 || value.length > 80) continue;
      names.push(value);
    }
  }
  return names;
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const leagueId = Number(formData.get("leagueId"));
    const teamIds = String(formData.get("teamIds") || "")
      .split(",")
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Please choose a file." }, { status: 400 });
    }
    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json({ error: "A valid league is required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    const membership = user
      ? await prisma.leagueMember.findFirst({ where: { leagueId, userId: user.id } })
      : null;
    if (!membership) {
      return NextResponse.json({ error: "You do not have access to this league." }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = String(file.name || "").toLowerCase().split(".").pop();
    const rawNames = ["xlsx", "xls"].includes(extension)
      ? extractNamesFromWorkbook(buffer)
      : extractNamesFromText(buffer.toString("utf8"));

    const uniqueImported = [...new Map(
      rawNames.map((name) => [normalizeName(name), name]).filter(([key]) => key)
    ).entries()].map(([key, displayName]) => ({ key, displayName }));

    if (!uniqueImported.length) {
      return NextResponse.json(
        { error: "No player names were found in the uploaded file." },
        { status: 400 }
      );
    }

    const teams = await prisma.team.findMany({
      where: {
        leagueId,
        ...(teamIds.length ? { id: { in: teamIds } } : {}),
      },
      select: {
        id: true,
        name: true,
players: {
  select: {
    id: true,
    name: true,
  }
}
      },
    });

    const leaguePlayers = [];
    for (const team of teams) {
      for (const player of team.players) {
        leaguePlayers.push({
          id: player.id,
          playerKey: player.globalPlayerId || normalizeName(player.name),
          playerName: player.name,
          teamId: team.id,
          teamName: team.name,
          sourceTeamIds: [team.id],
          sourceTeams: [team.name],
          normalizedName: normalizeName(player.name),
        });
      }
    }

    const combined = new Map();
    for (const player of leaguePlayers) {
      const key = player.normalizedName;
      if (!combined.has(key)) combined.set(key, player);
      else {
        const existing = combined.get(key);
        if (!existing.sourceTeamIds.includes(player.teamId)) existing.sourceTeamIds.push(player.teamId);
        if (!existing.sourceTeams.includes(player.teamName)) existing.sourceTeams.push(player.teamName);
      }
    }

    const matchedPlayers = [];
    const unmatchedNames = [];
    for (const imported of uniqueImported) {
      const exact = combined.get(imported.key);
      if (exact) matchedPlayers.push(exact);
      else unmatchedNames.push(imported.displayName);
    }

    return NextResponse.json({
      ok: true,
      matchedPlayers,
      unmatchedNames,
      summary: {
        imported: uniqueImported.length,
        matched: matchedPlayers.length,
        unmatched: unmatchedNames.length,
      },
    });
  } catch (error) {
    console.error("Team Builder import failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import player file." },
      { status: 500 }
    );
  }
}
