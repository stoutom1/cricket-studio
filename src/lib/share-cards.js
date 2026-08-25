function cleanText(value) {
  return String(value || "").trim();
}

function scopeLabel({
  selectedYear,
  selectedSeriesId,
}) {
  if (selectedSeriesId) {
    return "Series spotlight";
  }

  if (selectedYear) {
    return `Season ${selectedYear}`;
  }

  return "All-time league";
}

function makeCard({
  id,
  icon,
  eyebrow,
  title,
  name,
  team,
  value,
  detail,
  leagueName,
  scope,
  accent = "blue",
}) {
  const safeTitle = cleanText(title);
  const safeName = cleanText(name);
  const safeTeam = cleanText(team);
  const safeValue = cleanText(value);
  const safeDetail = cleanText(detail);

  return {
    id,
    icon,
    eyebrow,
    title: safeTitle,
    name: safeName,
    team: safeTeam,
    value: safeValue,
    detail: safeDetail,
    leagueName: cleanText(leagueName),
    scope,
    accent,
    caption: [
      `${icon} ${safeTitle}`,
      safeName ? `${safeName}${safeTeam ? ` · ${safeTeam}` : ""}` : "",
      safeValue,
      safeDetail,
      cleanText(leagueName) ? `Cric4All · ${cleanText(leagueName)}` : "Cric4All",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildShareCardCatalog({
  league,
  topRunScorer,
  topWicketTaker,
  topFielder,
  topImpactPlayer,
  leagueRecords,
  leagueMilestones,
  selectedYear,
  selectedSeriesId,
}) {
  const cards = [];
  const scope = scopeLabel({
    selectedYear,
    selectedSeriesId,
  });

  if (topRunScorer) {
    cards.push(
      makeCard({
        id: "run-leader",
        icon: "🏏",
        eyebrow: "League leader",
        title: "Run Machine",
        name: topRunScorer.playerName,
        team: topRunScorer.teamName,
        value: `${topRunScorer.runs || 0} runs`,
        detail: `${topRunScorer.matches || 0} match${Number(topRunScorer.matches || 0) === 1 ? "" : "es"} · SR ${topRunScorer.strikeRate || "0.0"}`,
        leagueName: league?.name,
        scope,
        accent: "blue",
      })
    );
  }

  if (topWicketTaker) {
    cards.push(
      makeCard({
        id: "wicket-leader",
        icon: "🎯",
        eyebrow: "League leader",
        title: "Wicket Hunter",
        name: topWicketTaker.playerName,
        team: topWicketTaker.teamName,
        value: `${topWicketTaker.wickets || 0} wickets`,
        detail: `${topWicketTaker.overs || "0.0"} overs · Econ ${topWicketTaker.economy || "0.00"}`,
        leagueName: league?.name,
        scope,
        accent: "purple",
      })
    );
  }

  if (topFielder) {
    cards.push(
      makeCard({
        id: "fielding-leader",
        icon: "🧤",
        eyebrow: "League leader",
        title: "Fielding MVP",
        name: topFielder.playerName,
        team: topFielder.teamName,
        value: `${topFielder.fieldingTotal || 0} contributions`,
        detail: `${topFielder.catches || 0} catches · ${topFielder.runOuts || 0} run-outs`,
        leagueName: league?.name,
        scope,
        accent: "green",
      })
    );
  }

  if (topImpactPlayer) {
    cards.push(
      makeCard({
        id: "impact-leader",
        icon: "🌟",
        eyebrow: "League leader",
        title: "Impact Crown",
        name: topImpactPlayer.playerName,
        team: topImpactPlayer.teamName,
        value: `${topImpactPlayer.allRounderPoints || 0} impact pts`,
        detail: `${topImpactPlayer.runs || 0} runs · ${topImpactPlayer.wickets || 0} wickets · ${topImpactPlayer.fieldingTotal || 0} fielding`,
        leagueName: league?.name,
        scope,
        accent: "gold",
      })
    );
  }

  const topRecord =
    leagueRecords?.records?.[0];

  if (topRecord) {
    cards.push(
      makeCard({
        id: `record-${topRecord.id}`,
        icon: topRecord.icon || "📚",
        eyebrow: "League record",
        title: topRecord.title,
        name: topRecord.holder,
        team: topRecord.teamName,
        value: topRecord.value,
        detail: topRecord.detail,
        leagueName: league?.name,
        scope,
        accent: topRecord.accent || "orange",
      })
    );
  }

  const latestMilestone =
    leagueMilestones?.recentAchievements?.[0];

  if (latestMilestone) {
    cards.push(
      makeCard({
        id: `milestone-${latestMilestone.id}`,
        icon: latestMilestone.icon || "🏅",
        eyebrow: "Milestone achieved",
        title: latestMilestone.title,
        name: latestMilestone.playerName,
        team: latestMilestone.teamName,
        value: `${latestMilestone.threshold}`,
        detail: latestMilestone.matchLabel
          ? `Reached in ${latestMilestone.matchLabel}`
          : "Career landmark",
        leagueName: league?.name,
        scope,
        accent: "orange",
      })
    );
  }

  return cards;
}

function accentPalette(accent) {
  const palettes = {
    blue: ["#0d2946", "#071525", "#2f80ed"],
    purple: ["#2a1f4d", "#0a1628", "#8b5cf6"],
    green: ["#123f3a", "#071925", "#14b8a6"],
    gold: ["#4a3515", "#111827", "#f59e0b"],
    orange: ["#4a2818", "#101827", "#f97316"],
    red: ["#4a2020", "#101827", "#ef4444"],
  };

  return palettes[accent] || palettes.blue;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fitCanvasText(
  ctx,
  value,
  {
    maxWidth,
    startSize,
    minSize,
    weight = 900,
    family = "Arial, sans-serif",
  }
) {
  const text = cleanText(value);
  let size = startSize;

  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;

    if (ctx.measureText(text).width <= maxWidth) {
      break;
    }

    size -= 2;
  }

  ctx.font = `${weight} ${Math.max(size, minSize)}px ${family}`;
  return text;
}

function drawSingleLine(
  ctx,
  value,
  x,
  y,
  options
) {
  const text = fitCanvasText(
    ctx,
    value,
    options
  );

  ctx.fillText(text, x, y);
}

async function createShareCardBlob(card) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas is unavailable in this browser.");
  }

  const [top, bottom, accent] = accentPalette(card.accent);

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);

  const glow = ctx.createRadialGradient(880, 140, 10, 880, 140, 420);
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = accent;
  roundedRect(ctx, 72, 72, 14, 936, 7);
  ctx.fill();

  const left = 112;
  const textWidth = 840;

  ctx.fillStyle = "#f8fbff";
  drawSingleLine(ctx, "🏏 Cric4All", left, 142, {
    maxWidth: textWidth,
    startSize: 54,
    minSize: 42,
  });

  ctx.fillStyle = "#8eb4d6";
  drawSingleLine(
    ctx,
    card.scope || "League spotlight",
    left,
    192,
    {
      maxWidth: textWidth,
      startSize: 28,
      minSize: 20,
      weight: 800,
    }
  );

  ctx.fillStyle = accent;
  drawSingleLine(
    ctx,
    `${card.icon || "🏆"} ${String(card.eyebrow || "").toUpperCase()}`,
    left,
    294,
    {
      maxWidth: textWidth,
      startSize: 31,
      minSize: 20,
    }
  );

  ctx.fillStyle = "#ffffff";
  drawSingleLine(ctx, card.title, left, 380, {
    maxWidth: textWidth,
    startSize: 64,
    minSize: 34,
  });

  ctx.fillStyle = "#ffffff";
  drawSingleLine(ctx, card.name, left, 500, {
    maxWidth: textWidth,
    startSize: 78,
    minSize: 36,
  });

  if (card.team) {
    ctx.fillStyle = "#9ab0c7";
    drawSingleLine(ctx, card.team, left, 555, {
      maxWidth: textWidth,
      startSize: 30,
      minSize: 18,
      weight: 700,
    });
  }

  ctx.fillStyle = "#ffffff";
  drawSingleLine(ctx, card.value, left, 710, {
    maxWidth: textWidth,
    startSize: 94,
    minSize: 44,
  });

  ctx.fillStyle = "#9fb5c9";
  drawSingleLine(ctx, card.detail, left, 775, {
    maxWidth: textWidth,
    startSize: 30,
    minSize: 17,
    weight: 700,
  });

  ctx.strokeStyle = "rgba(145, 178, 205, 0.20)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, 870);
  ctx.lineTo(952, 870);
  ctx.stroke();

  ctx.fillStyle = "#829bb1";
  drawSingleLine(
    ctx,
    card.leagueName || "Cric4All",
    left,
    936,
    {
      maxWidth: textWidth,
      startSize: 28,
      minSize: 17,
      weight: 700,
    }
  );

  ctx.fillStyle = "#6f8aa3";
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillText("cric4all.app", left, 990);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not generate the share image."));
      },
      "image/png",
      0.95
    );
  });
}

export async function shareCric4AllCard(card) {
  if (typeof window === "undefined") {
    return {
      mode: "unavailable",
    };
  }

  const blob = await createShareCardBlob(card);

  const file = new File(
    [blob],
    `cric4all-${card.id}.png`,
    {
      type: "image/png",
    }
  );

  if (
    navigator.share &&
    navigator.canShare?.({
      files: [file],
    })
  ) {
    await navigator.share({
      title: `${card.title} · Cric4All`,
      text: card.caption,
      files: [file],
    });

    return {
      mode: "shared",
    };
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  try {
    await navigator.clipboard?.writeText(card.caption);
  } catch {
    // The PNG still downloads even if clipboard permission is unavailable.
  }

  return {
    mode: "downloaded",
  };
}
