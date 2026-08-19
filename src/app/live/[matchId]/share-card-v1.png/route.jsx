import {
  ImageResponse,
} from "next/og";
import {
  getLiveShareMatch,
} from "@/lib/live-share";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const CARD_HEADERS = {
  "Cache-Control":
    "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
  "Content-Type":
    "image/png",
  "Content-Disposition":
    'inline; filename="cric4all-live-score.png"',
  "Access-Control-Allow-Origin":
    "*",
  "X-Content-Type-Options":
    "nosniff",
};

function fallbackCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width:
            "100%",
          height:
            "100%",
          display:
            "flex",
          alignItems:
            "center",
          justifyContent:
            "center",
          background:
            "#07111f",
          color:
            "#ffffff",
          fontSize:
            56,
          fontWeight:
            800,
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        🏏 Cric4All Live Score
      </div>
    ),
    {
      width:
        1200,
      height:
        630,
      headers:
        CARD_HEADERS,
    }
  );
}

export async function GET(
  request,
  {
    params,
  }
) {
  try {
    const {
      matchId:
        shareCode,
    } = await params;

    const data =
      await getLiveShareMatch(
        shareCode
      );

    if (!data) {
      return fallbackCard();
    }

    const {
      match,
      innings1,
      innings2,
      currentInnings,
      currentSummary,
      currentTeamName,
    } = data;

    const teamA =
      match.teamA?.name ||
      "Team A";

    const teamB =
      match.teamB?.name ||
      "Team B";

    const leagueName =
      match.league?.name ||
      "Cricket League";

    const venue =
      String(
        match.venueName ||
        match.venueAddress ||
        ""
      ).trim();

    const headline =
      data.isFinal
        ? `🏆 ${data.resultText}`
        : `🔴 LIVE · ${currentTeamName} ${currentSummary.runs}/${currentSummary.wickets} (${currentSummary.overs} ov)`;

    const subline =
      data.isFinal
        ? "Full scorecard available on Cric4All"
        : currentInnings ===
            2
          ? "2nd innings · Follow ball-by-ball"
          : "1st innings · Follow ball-by-ball";

    return new ImageResponse(
      (
        <div
          style={{
            width:
              "100%",
            height:
              "100%",
            display:
              "flex",
            flexDirection:
              "column",
            padding:
              "48px 58px",
            background:
              "linear-gradient(135deg,#06101e 0%,#0a1930 58%,#083747 100%)",
            color:
              "#ffffff",
            fontFamily:
              "Arial, sans-serif",
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap:
                22,
            }}
          >
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  12,
                fontSize:
                  28,
                fontWeight:
                  800,
              }}
            >
              🏏 Cric4All
            </div>

            <div
              style={{
                display:
                  "flex",
                padding:
                  "8px 15px",
                border:
                  "1px solid rgba(255,255,255,.20)",
                borderRadius:
                  999,
                fontSize:
                  18,
                maxWidth:
                  500,
                overflow:
                  "hidden",
              }}
            >
              {String(
                leagueName
              )}
            </div>
          </div>

          <div
            style={{
              display:
                "flex",
              marginTop:
                46,
              gap:
                28,
              alignItems:
                "stretch",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                flex:
                  1,
                flexDirection:
                  "column",
                padding:
                  "23px 25px",
                borderRadius:
                  18,
                background:
                  "rgba(15,23,42,.46)",
                border:
                  "1px solid rgba(148,163,184,.16)",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  fontSize:
                    22,
                  color:
                    "#93c5fd",
                }}
              >
                {String(
                  teamA
                )}
              </div>

              <div
                style={{
                  display:
                    "flex",
                  marginTop:
                    12,
                  fontSize:
                    58,
                  fontWeight:
                    900,
                }}
              >
                {`${innings1.runs}/${innings1.wickets}`}
              </div>

              <div
                style={{
                  display:
                    "flex",
                  marginTop:
                    3,
                  fontSize:
                    19,
                  color:
                    "#cbd5e1",
                }}
              >
                {`${innings1.overs} overs`}
              </div>
            </div>

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                fontSize:
                  21,
                fontWeight:
                  900,
                color:
                  "#7dd3fc",
                width:
                  64,
              }}
            >
              VS
            </div>

            <div
              style={{
                display:
                  "flex",
                flex:
                  1,
                flexDirection:
                  "column",
                alignItems:
                  "flex-end",
                padding:
                  "23px 25px",
                borderRadius:
                  18,
                background:
                  "rgba(15,23,42,.46)",
                border:
                  "1px solid rgba(148,163,184,.16)",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  fontSize:
                    22,
                  color:
                    "#93c5fd",
                  textAlign:
                    "right",
                }}
              >
                {String(
                  teamB
                )}
              </div>

              <div
                style={{
                  display:
                    "flex",
                  marginTop:
                    12,
                  fontSize:
                    58,
                  fontWeight:
                    900,
                }}
              >
                {`${innings2.runs}/${innings2.wickets}`}
              </div>

              <div
                style={{
                  display:
                    "flex",
                  marginTop:
                    3,
                  fontSize:
                    19,
                  color:
                    "#cbd5e1",
                }}
              >
                {`${innings2.overs} overs`}
              </div>
            </div>
          </div>

          <div
            style={{
              display:
                "flex",
              flexDirection:
                "column",
              marginTop:
                28,
              padding:
                "16px 20px",
              borderRadius:
                16,
              background:
                data.isFinal
                  ? "rgba(5,150,105,.16)"
                  : "rgba(220,38,38,.14)",
              border:
                data.isFinal
                  ? "1px solid rgba(52,211,153,.26)"
                  : "1px solid rgba(248,113,113,.24)",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                fontSize:
                  26,
                fontWeight:
                  900,
              }}
            >
              {headline}
            </div>

            <div
              style={{
                display:
                  "flex",
                marginTop:
                  5,
                color:
                  "#cbd5e1",
                fontSize:
                  17,
              }}
            >
              {subline}
            </div>
          </div>

          <div
            style={{
              marginTop:
                "auto",
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap:
                20,
              color:
                "#94a3b8",
              fontSize:
                17,
            }}
          >
            <div
              style={{
                display:
                  "flex",
                maxWidth:
                  820,
                overflow:
                  "hidden",
              }}
            >
              {venue
                ? `📍 ${venue}`
                : "Live cricket scorecard · Ball-by-ball updates"}
            </div>

            <div
              style={{
                display:
                  "flex",
                color:
                  "#7dd3fc",
                fontWeight:
                  800,
              }}
            >
              cric4all.app
            </div>
          </div>
        </div>
      ),
      {
        width:
          1200,
        height:
          630,
        headers:
          CARD_HEADERS,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "[LIVE_SHARE_CARD_V1_FAILED]",
      error
    );

    return fallbackCard();
  }
}
