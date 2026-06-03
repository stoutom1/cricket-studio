"use client";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";
import { EXTRA_TYPES, getPlayerName, WICKET_TYPES } from "@/lib/scoring";
import "@/app/globals.css";
import { useRouter } from "next/navigation";

function Card({
  title,
  children,
  right,
  defaultCollapsed = false
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="card">
      <div
        className="card-head"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer"
        }}
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10
          }}
        >
          <button
            type="button"
            className="btn btn-outline"
            style={{
              padding: "2px 10px",
              minWidth: 36
            }}
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((prev) => !prev);
            }}
          >
            {collapsed ? "＋" : "－"}
          </button>

          <h2 style={{ margin: 0 }}>{title}</h2>
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
        >
          {right || null}
        </div>
      </div>

      {!collapsed && (
        <div style={{ marginTop: 16 }}>
          {children}
        </div>
      )}
    </section>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="collapsible-section">
      <button
        type="button"
        className="collapsible-toggle"
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>

        <span
          style={{
            fontSize: 18,
            fontWeight: 700
          }}
        >
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}
 

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function DashboardClient() {
  const { data: session } = useSession();
  //const [activeTab, setActiveTab] = useState("management");
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [toast, setToast] = useState(null);
const [activeQuickAction, setActiveQuickAction] = useState(null);
const [expandedTeamId, setExpandedTeamId] = useState(null);
const [selectedPlayerId, setSelectedPlayerId] = useState("");
//const [selectedPlayers, setSelectedPlayers] = useState({});
const [showWicketModal, setShowWicketModal] = useState(false);
const [selectedWicketType, setSelectedWicketType] = useState("BOWLED");
const [selectedNewBatter, setSelectedNewBatter] = useState("");
const [showExtrasModal, setShowExtrasModal] = useState(false);
const [selectedExtraType, setSelectedExtraType] = useState("WIDE");
const [leagues, setLeagues] = useState([]);
const [leagueForm, setLeagueForm] = useState({
  name: ""
});
const [selectedLeagueId, setSelectedLeagueId] = useState("");
const [expandedLeagueId, setExpandedLeagueId] = useState(null);
const [activeLeagueId, setActiveLeagueId] = useState(null);
const [activeTab, setActiveTab] = useState("management");
const [permissions, setPermissions] = useState({
  canViewManagement: false,
  canCreateMatch: false,
  canDeleteMatch: false,
  canScoreMatch: false,
  canUndoBall: false
});
const [selectedMember, setSelectedMember] = useState(null);
  const [matchDetail, setMatchDetail] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);
  const [stats, setStats] = useState({ batting: [], bowling: [] });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showRetiredHurtModal, setShowRetiredHurtModal] = useState(false);
  const [retiredHurtBatterId, setRetiredHurtBatterId] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState({});

  const [teamForm, setTeamForm] = useState({leagueId: "", name: ""});
  const [playerForm, setPlayerForm] = useState({teamId: "", names: ""});
const [preferencesLoaded, setPreferencesLoaded] = useState(false);

const [me, setMe] = useState(null);

useEffect(() => {
  fetch("/api/me")
    .then((r) => r.json())
    .then(setMe);
}, []);

useEffect(() => {
  async function loadPermissions() {
    const res =
      await fetch(
        "/api/my-permissions"
      );

    if (!res.ok) return;

    const data =
      await res.json();

    setPermissions(data);
  }

  loadPermissions();
}, [activeLeagueId]);


useEffect(() => {
    async function loadUserPreferences() {
      const res = await fetch("/api/me");

      if (!res.ok) {
        setPreferencesLoaded(true);
        return;
      }

      const data = await res.json();

      setActiveLeagueId(data.activeLeagueId ?? null);

      setSelectedMatchId(
        data.activeMatchId
          ? String(data.activeMatchId)
          : ""
      );

      setPreferencesLoaded(true);
    }

    loadUserPreferences();
  }, []);
useEffect(() => {
  if (!preferencesLoaded) return;

  fetch("/api/user/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      activeLeagueId,
      activeMatchId: selectedMatchId || null
    })
  });
}, [
  activeLeagueId,
  selectedMatchId,
  preferencesLoaded
]);
useEffect(() => {
  if (!activeLeagueId) {
    setMatches([]);
    return;
  }

  setMatches([]);
  loadMatches();
}, [activeLeagueId]);
const filteredTeams = teams.filter(
  (team) =>
    String(team.leagueId) ===
    String(activeLeagueId)
);
const filteredMatches = matches.filter(
  (match) =>
    String(match.leagueId) ===
    String(activeLeagueId)
);
const teamsForMatch =
  activeLeagueId
    ? filteredTeams
    : teams;

  const [matchForm, setMatchForm] = useState({
  teamAId: "",
  teamBId: "",
  battingFirstTeamId: "",
  oversPerInnings: "20",
  powerplayOversInnings: "6",
  maxWicketsPerInnings: "",
  maxOversPerBowler: ""
});

 /* const [ballForm, setBallForm] = useState({
    inningsNo: "1",
    strikerId: "",
    nonStrikerId: "",
    bowlerId: "",
    extraType: "NONE",
    runsOffBat: "0",
    extras: "0",
    isWicket: false,
    wicketType: "NONE",
    dismissedPlayerId: "",
    newBatterId: "",
    note: ""
  }, [
  scoreboard?.currentState?.strikerId,
  scoreboard?.currentState?.nonStrikerId,
  scoreboard?.currentState?.bowlerId,
  scoreboard?.currentState?.dismissedPlayerId,
  scoreboard?.currentState?.inningsNo,
  scoreboard?.currentInnings
]);
*/
const [ballForm, setBallForm] = useState({
  inningsNo: "1",
  strikerId: "",
  nonStrikerId: "",
  bowlerId: "",
  extraType: "NONE",
  runsOffBat: "0",
  extras: "0",
  isWicket: false,
  wicketType: "NONE",
  dismissedPlayerId: "",
  newBatterId: "",
  note: ""
});

function openPermissionEditor(member) {
  setSelectedMember(member);

  setPermissions({
    canViewManagement:
      member.canViewManagement ?? false,

    canCreateMatch:
      member.canCreateMatch ?? false,

    canDeleteMatch:
      member.canDeleteMatch ?? false,

    canScoreMatch:
      member.canScoreMatch ?? false,

    canUndoBall:
      member.canUndoBall ?? false
  });
}

function updatePermission(
  permission,
  value
) {
  setPermissions((prev) => ({
    ...prev,
    [permission]: value
  }));
}

async function savePermissions() {
  if (!selectedMember) return;

  const response = await fetch(
    `/api/leagues/${activeLeague.id}/permissions`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
 body: JSON.stringify({
  memberId: selectedMember.id,
  email: selectedMember.user.email,
  ...permissions
})
    }
  );

  if (!response.ok) {
    const error = await response.json();

    alert(
      error.error || "Failed to save permissions"
    );
    return;
  }

  alert("Permissions updated");
}

async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }
    function showToast(type, text) {
      setToast({ type, text });

      setTimeout(() => {
        setToast(null);
      }, 3000);
    }
      async function handleShareMatch() {
      if (!scoreboard) return;

      const shareUrl = `${window.location.origin}/live/${selectedMatchId}`;
      const innings =
        scoreboard.innings?.[scoreboard.innings.length - 1];

      const shareText = `
    🏏 ${scoreboard.match.teamAName} vs ${scoreboard.match.teamBName}

    Score:
    ${innings?.teamName || ""} ${innings?.runs}/${innings?.wickets}
    Overs: ${innings?.oversDisplay}

    ${scoreboard.summary?.statusText || "Loading scorecard..."}

    Live Score:
    ${shareUrl}
      `.trim();

      try {
        if (navigator.share) {
          await navigator.share({
            title: `${scoreboard.match.teamAName} vs ${scoreboard.match.teamBName}`,
            text: shareText,
            url: shareUrl,
          });
        } else {
          await navigator.clipboard.writeText(
            `${shareText}\n\n${shareUrl}`
          );

          //alert("Share link copied to clipboard");
        }
      } catch (err) {
        console.error(err);
      }
    }
async function loadLeagues() {
  const data = await api("/api/leagues");
  setLeagues(data);
}

async function updateRole(
  leagueId,
  memberId,
  role
) {
  const response = await fetch(
    `/api/leagues/${leagueId}/permissions`,
    {
      method: "PATCH",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        memberId,
        role
      })
    }
  );

  if (!response.ok) {
    alert("Failed to update role");
    return;
  }

  setLeagues((prev) =>
    prev.map((league) => ({
      ...league,
      members: league.members?.map((member) =>
        member.id === memberId
          ? {
              ...member,
              role
            }
          : member
      )
    }))
  );
}
  async function loadTeams() {
    const data = await api("/api/teams");
    setTeams(data);
  }

  async function loadMatches() {
    const data = await api("/api/matches");
    setMatches(data);

    if (!selectedMatchId && data.length > 0) {
      setSelectedMatchId(String(data[0].id));
    } else if (
      selectedMatchId &&
      !data.some((m) => String(m.id) === String(selectedMatchId))
    ) {
      setSelectedMatchId(data[0] ? String(data[0].id) : "");
    }
  }

  async function loadSelectedMatch(matchId) {
    if (!matchId) {
      setMatchDetail(null);
      setScoreboard(null);
      setStats({ batting: [], bowling: [] });
      return;
    }

  fetch("/api/user/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      activeLeagueId: activeLeagueId,
      activeMatchId: selectedMatchId
    })
  });

    const [detail, board, statData] = await Promise.all([
      api(`/api/matches/${matchId}`),
      api(`/api/scoreboard/${matchId}`),
      api(`/api/stats/${matchId}`),
      api(`/api/liveview/${matchId}`),
      //api(`/api/live/${matchId}`)
    ]);

    setMatchDetail(detail);
    setScoreboard(board);
    setStats(statData);
  }
async function handleAddLeague(e) {
  e.preventDefault();

  setMessage("");
  setError("");

  try {
const league = await api("/api/leagues", {
  method: "POST",
  body: JSON.stringify({
    name: leagueForm.name.trim(),
    leagueId: activeLeagueId
  })
});

    setLeagueForm({
      name: ""
    });
    setActiveLeagueId(Number(league.id));
    showToast(
      "success",
      "🏆 League created"
    );

    await loadLeagues();
    await loadMatches();
    await loadTeams();
    await refreshAll();
    //setActiveLeagueId(Number(activeLeagueId));
    //router.refresh();
  } catch (err) {
    setError(err.message);
  }
}

async function handleDeleteLeague(
  leagueId,
  leagueName
) {
  if (
    !confirm(
      `Delete league "${leagueName}"?`
    )
  ) {
    return;
  }

  try {
    await api(
      `/api/leagues/${leagueId}`,
      {
        method: "DELETE"
      }
    );

    showToast(
      "success",
      "🗑️ League deleted"
    );

    await refreshAll();
  } catch (err) {
    setError(err.message);
  }
}
  async function refreshAll(matchId = selectedMatchId) {
    await Promise.all([loadLeagues(), loadTeams(), loadMatches()]);
    if (matchId) {
      await loadSelectedMatch(matchId);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadLeagues(), loadTeams(), loadMatches()]);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedMatchId) {
      loadSelectedMatch(selectedMatchId).catch((err) => setError(err.message));
    } else {
      setMatchDetail(null);
      setScoreboard(null);
      setStats({ batting: [], bowling: [] });
    }
  }, [selectedMatchId]);

  useEffect(() => {
    if (scoreboard?.currentInnings) {
      setBallForm((prev) => ({
        ...prev,
        inningsNo: String(scoreboard.currentInnings)
      }));
    }
  }, [scoreboard?.currentInnings]);

  const battingTeam = useMemo(() => {
    if (!matchDetail) return null;
    const inningsNo = Number(ballForm.inningsNo);

    const battingFirst =
      matchDetail.battingFirstTeamId === matchDetail.teamA.id
        ? matchDetail.teamA
        : matchDetail.teamB;

    const secondBat =
      matchDetail.battingFirstTeamId === matchDetail.teamA.id
        ? matchDetail.teamB
        : matchDetail.teamA;

    return inningsNo === 1 ? battingFirst : secondBat;
  }, [matchDetail, ballForm.inningsNo]);

  const bowlingTeam = useMemo(() => {
    if (!matchDetail || !battingTeam) return null;
    return battingTeam.id === matchDetail.teamA.id ? matchDetail.teamB : matchDetail.teamA;
  }, [matchDetail, battingTeam]);

  const availableNewBatters = useMemo(() => {
    if (!battingTeam) return [];
    return battingTeam.players.filter(
      (p) =>
        String(p.id) !== String(ballForm.strikerId) &&
        String(p.id) !== String(ballForm.nonStrikerId)
    );
  }, [battingTeam, ballForm.strikerId, ballForm.nonStrikerId]);

  useEffect(() => {
    if (!battingTeam || !bowlingTeam) return;

    const firstStriker = battingTeam.players[0]?.id ? String(battingTeam.players[0].id) : "";
    const secondPlayer = battingTeam.players.find(
      (p) => String(p.id) !== firstStriker
    );
    const firstNonStriker = secondPlayer?.id ? String(secondPlayer.id) : "";
    const firstBowler = bowlingTeam.players[0]?.id ? String(bowlingTeam.players[0].id) : "";

    setBallForm((prev) => ({
      ...prev,
      strikerId: prev.strikerId || firstStriker,
      nonStrikerId: prev.nonStrikerId || firstNonStriker,
      bowlerId: prev.bowlerId || firstBowler,
      dismissedPlayerId: prev.dismissedPlayerId || firstStriker
    }));
  }, [battingTeam?.id, bowlingTeam?.id]);

  useEffect(() => {
    if (!scoreboard?.currentState) return;

setBallForm((prev) => ({
  ...prev,

  inningsNo:
    scoreboard?.currentInnings != null
      ? String(scoreboard.currentInnings)
      : "",

  strikerId:
    scoreboard?.currentState?.strikerId != null
      ? String(scoreboard.currentState.strikerId)
      : "",

  nonStrikerId:
    scoreboard?.currentState?.nonStrikerId != null
      ? String(scoreboard.currentState.nonStrikerId)
      : "",

  dismissedPlayerId:
    scoreboard?.currentState?.strikerId != null
      ? String(scoreboard.currentState.strikerId)
      : "",
  bowlerId:
      scoreboard.currentState.bowlerId
        ? String(scoreboard.currentState.bowlerId)
        : "",
  bowlerName:
      scoreboard.currentState.bowlerId
        ? String(scoreboard.currentState.bowlerName)
        : "",      
  newBatterId: ""
}));
  }, [
    scoreboard?.currentState?.strikerId,
    scoreboard?.currentState?.nonStrikerId,
    scoreboard?.currentState?.bowlerId,
    scoreboard?.currentState?.bowlerName,
    scoreboard?.currentInnings
  ]);

  async function handleAddTeam(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
await api("/api/teams", {
  method: "POST",
  body: JSON.stringify({
    leagueId: Number(teamForm.leagueId),
    name: teamForm.name.trim()
  })
});

setTeamForm({
  leagueId: "",
  name: ""
});
      setMessage("✅ Team added");
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteTeam(teamId, teamName) {
    if (!confirm(`Delete team "${teamName}"?`)) {
       return;
    }   

    setMessage("");
    setError("");

    try {
      await api(`/api/teams/${teamId}`, {
        method: "DELETE"
      });
      setMessage("🗑️ Team deleted");
      showToast("success", "🗑️ Team deleted");
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddPlayer(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
const names = playerForm.names
  .split(/\r?\n|,/)
  .map((x) => x.trim())
  .filter(Boolean);

await api("/api/players/bulk", {
  method: "POST",
  body: JSON.stringify({
    teamId: Number(playerForm.teamId),
    names
  })
});

      setPlayerForm({ teamId: "", names: "" });
      setMessage("✅ Player added");
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeletePlayer(playerId, playerName) {
    if (!confirm(`Delete player "${playerName}"?`)) return;

    setMessage("");
    setError("");

    try {
      await api(`/api/players/${playerId}`, {
        method: "DELETE"
      });
      setMessage("🗑️ Player deleted");
      showToast("success", "✅ Player deleted");
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateMatch(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const match = await api("/api/matches", {
        method: "POST",
 body: JSON.stringify({
  teamAId: Number(matchForm.teamAId),
  teamBId: Number(matchForm.teamBId),
  battingFirstTeamId: Number(matchForm.battingFirstTeamId),

  oversPerInnings: Number(matchForm.oversPerInnings),

  powerplayOversInnings: Number(
    matchForm.powerplayOversInnings
  ),

  maxWicketsPerInnings:
    matchForm.maxWicketsPerInnings
      ? Number(matchForm.maxWicketsPerInnings)
      : null,

  maxOversPerBowler:
    matchForm.maxOversPerBowler
      ? Number(matchForm.maxOversPerBowler)
      : null
})
      });

      setMatchForm({
        teamAId: "",
        teamBId: "",
        battingFirstTeamId: "",
        oversPerInnings: "20",
        powerplayOversInnings: "6",
        maxWicketsPerInnings: "",
        maxOversPerBowler: ""
      });

      setMessage("✅ Match created");
      await loadMatches();
      setSelectedMatchId(String(match.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteMatch(matchId) {
    if (!confirm("Delete this match and all its scoring data?")) return;

    setMessage("");
    setError("");

    try {
      await api(`/api/matches/${matchId}`, {
        method: "DELETE"
      });
      setMessage("🗑️ Match deleted");
      showToast("success", "🗑️ Match deleted");
      await refreshAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddBall(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!selectedMatchId) {
      setError("Please select a match");
      return;
    }

    try {
      await api("/api/balls", {
        method: "POST",
        body: JSON.stringify({
          matchId: Number(selectedMatchId),
          inningsNo: Number(ballForm.inningsNo),
          strikerId: Number(ballForm.strikerId),
          nonStrikerId: Number(ballForm.nonStrikerId),
          bowlerId: Number(ballForm.bowlerId),
          extraType: ballForm.extraType,
          runsOffBat: Number(ballForm.runsOffBat),
          extras: Number(ballForm.extras),
          isWicket: ballForm.isWicket && ballForm.wicketType !== "RETIRED_HURT"? 1 : 0,
          wicketType: ballForm.isWicket? ballForm.wicketType: "NONE",
          dismissedPlayerId: ballForm.isWicket
            ? Number(ballForm.dismissedPlayerId || ballForm.strikerId)
            : null,
          newBatterId:
            ballForm.isWicket && ballForm.newBatterId
              ? Number(ballForm.newBatterId)
              : null,
          note: ballForm.note
        })
      });

      setMessage("✅ Ball added");

      setBallForm((prev) => ({
        ...prev,
        extraType: "NONE",
        runsOffBat: "0",
        extras: "0",
        isWicket: false,
        wicketType: "NONE",
        newBatterId: "",
        note: "",
        dismissal: ""
      }));

      await loadSelectedMatch(selectedMatchId);
      await loadTeams();
    } catch (err) {
      setError(err.message);
      showToast(error, err.message);
    }
  }

  async function handleUndoBall() {
    setMessage("");
    setError("");

    if (!selectedMatchId) {
      setError("Please select a match");
      return;
    }

    try {
      await api(`/api/matches/${selectedMatchId}/undo`, {
        method: "POST"
      });

      setMessage("↩️ Last ball removed");
      await loadSelectedMatch(selectedMatchId);
    } catch (err) {
      setError(err.message);
    }
  }
  
  const battingByTeam = stats?.batting.reduce((acc, row) => {
    if (!acc[row.teamName]) acc[row.teamName] = [];
    acc[row.teamName].push(row);
    return acc;
  }, {});

  const bowlingByTeam = stats?.bowling.reduce((acc, row) => {
    if (!acc[row.teamName]) acc[row.teamName] = [];
    acc[row.teamName].push(row);
    return acc;
  }, {});

  function quickNormalBall(runs) {
    setBallForm((prev) => ({
      ...prev,
      extraType: "NONE",
      runsOffBat: String(runs),
      extras: "0",
      isWicket: false,
      wicketType: "NONE"
    }));
  }
async function selectLeague(league) {
  setActiveLeagueId(league.id);
  setSelectedMatchId("");
  setMatches([]);
  setActiveTab("matches");

  fetch("/api/user/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      activeLeagueId: league.id,
      activeMatchId: selectedMatchId
    })
  });
  await loadMatches();
}
  const handleLeagueChange = (leagueId) => {
  setActiveLeagueId(leagueId);

  localStorage.setItem(
    "activeLeagueId",
    String(leagueId)
  );
};
const handleMatchChange = (matchId) => {
  setSelectedMatchId(matchId);

  localStorage.setItem(
    "selectedMatchId",
    String(matchId)
  );
};
function quickExtra(type) {
  setSelectedExtraType(type);

  setBallForm((prev) => ({
    ...prev,
    extraType: type,
    runsOffBat: "0",
    extras: "1"
  }));

  setShowExtrasModal(true);
}
function confirmExtra(extraRuns) {
  setBallForm((prev) => ({
    ...prev,
    extraType: selectedExtraType,
    extras: String(extraRuns)
  }));

  setShowExtrasModal(false);
}
function quickWicket(type = "BOWLED") {
  setBallForm((prev) => ({
    ...prev,
    isWicket: true,
    wicketType: type,
    dismissedPlayerId: prev.strikerId
  }));

  setShowWicketModal(true);
}


async function swapBatters() {
  if (!selectedMatchId) return;

  try {

setBallForm((prev) => ({
      ...prev,
      strikerId: prev.nonStrikerId || "",
      nonStrikerId: prev.strikerId || "",
    }));
    
    await loadSelectedMatch(selectedMatchId);
setMessage("🔄 Striker swapped successfully");
    showToast(
      "success",
      "🔄 Striker swapped successfully"
    );
  } catch (err) {
    setError(err.message);
  }
}

async function handleMatchSelect(matchId) {
  setSelectedMatchId(String(matchId));

  await loadSelectedMatch(matchId);

  setActiveTab("scoring");

  await fetch("/api/user/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      activeLeagueId: activeLeagueId,
      activeMatchId: matchId
    })
  });
}

  function getNextAvailableBatter(players, strikerId, nonStrikerId, balls = []) {
  if (!players?.length) return null;

  // Players already dismissed
  const dismissedIds = new Set(
    balls
      ?.filter((b) => b.dismissedPlayerId)
      .map((b) => Number(b.dismissedPlayerId))
  );

  // Find next available batter
  return players.find(
    (p) =>
      Number(p.id) !== Number(strikerId) &&
      Number(p.id) !== Number(nonStrikerId) &&
      !dismissedIds.has(Number(p.id))
  );
}


function quickRetiredHurt() {
  if (!selectedMatchId) {
    setError("Please select a match");
    return;
  }

  if (!battingTeam) {
    setError("Batting team not found");
    return;
  }

  const striker = battingTeam.players.find(
    (p) => String(p.id) === String(ballForm.strikerId)
  );

  if (!striker) {
    setError("Current striker not found");
    return;
  }

  setRetiredHurtBatterId("");
  setShowRetiredHurtModal(true);
}
async function generateInviteLink(leagueId) {
  const res = await api(
    `/api/leagues/${leagueId}/invite`,
    {
      method: "POST"
    }
  );
  const data = res;

  await navigator.clipboard.writeText(
    data.inviteLink)

/*  await navigator.clipboard.writeText(
    res.url
  );
*/
  showToast(
    "success",
    "Registration link copied"
  );
}
async function confirmRetiredHurt() {
  if (!retiredHurtBatterId) {
    setError("Please select a new batter");
    return;
  }

  const striker = battingTeam.players.find(
    (p) => String(p.id) === String(ballForm.strikerId)
  );

  const selectedBatter = battingTeam.players.find(
    (p) => String(p.id) === String(retiredHurtBatterId)
  );

  if (!selectedBatter) {
    setError("Invalid batter selected");
    return;
  }

  try {
    setMessage("");
    setError("");
/*
    await api("/api/balls", {
      method: "POST",
      body: JSON.stringify({
        matchId: Number(selectedMatchId),
        inningsNo: Number(ballForm.inningsNo),

        strikerId: Number(ballForm.strikerId),
        nonStrikerId: Number(ballForm.nonStrikerId),
        bowlerId: Number(ballForm.bowlerId),

        extraType: "NONE",
        runsOffBat: 0,
        extras: 0,

        isWicket: 1,
        wicketType: "RETIRED_HURT",

        dismissedPlayerId: Number(ballForm.strikerId),

        newBatterId: Number(retiredHurtBatterId),
        
        note: "Retired Hurt",
        dismissal: "Retired Hurt"
      })
    });
*/
    setBallForm((prev) => ({
      ...prev,
      strikerId: String(selectedBatter.id),
      dismissedPlayerId: "",
      newBatterId: "",
      isWicket: false,
      wicketType: "NONE",
      runsOffBat: "0",
      extras: "0"
    }));

    setShowRetiredHurtModal(false);

    setMessage(
      `${striker.name} retired hurt. ${selectedBatter.name} came in to bat.`
    );

    await loadSelectedMatch(selectedMatchId);

  } catch (err) {
    setError(err.message);
  }
}

function triggerQuickAction(actionKey, callback) {
  setActiveQuickAction(actionKey);

  callback();

  setTimeout(() => {
    setActiveQuickAction(null);
  }, 600); // was 400
}
  const activeInnings =
    scoreboard?.innings?.find((x) => x.number === scoreboard.currentInnings) ||
    scoreboard?.innings?.[0];

const activeLeague =
  leagues.find(
    (league) =>
      league.id === me?.activeLeagueId
  );

return (
  <>
<div className="dashboard-tabs">
  {permissions?.canViewManagement && (
    <button
      className={`dashboard-tab ${
        activeTab === "management" ? "active" : ""
      }`}
      onClick={() => setActiveTab("management")}
    >
      <span className="tab-icon">⚙️</span>
      <span className="tab-text">Leagues</span>
    </button>
  )}

  {permissions?.canViewMatches && (
    <button
      className={`dashboard-tab ${
        activeTab === "matches" ? "active" : ""
      }`}
      onClick={() => setActiveTab("matches")}
    >
      <span className="tab-icon">📋</span>
      <span className="tab-text">Matches</span>
    </button>
  )}

  {permissions?.canViewScoring && (
    <button
      className={`dashboard-tab ${
        activeTab === "scoring" ? "active" : ""
      }`}
      onClick={() => setActiveTab("scoring")}
    >
      <span className="tab-icon">🏏</span>
      <span className="tab-text">Scoring</span>
    </button>
  )}

  {permissions?.canViewStats && (
    <button
      className={`dashboard-tab ${
        activeTab === "stats" ? "active" : ""
      }`}
      onClick={() => setActiveTab("stats")}
    >
      <span className="tab-icon">📊</span>
      <span className="tab-text">Stats</span>
    </button>
  )}

  {permissions?.canViewManagement && (
    <button
      className={`dashboard-tab ${
        activeTab === "permissions" ? "active" : ""
      }`}
      onClick={() => setActiveTab("permissions")}
    >
      <span className="tab-icon">🔐</span>
      <span className="tab-text">Permissions</span>
    </button>
  )}
</div>
  {activeTab === "scoring" && (
  <div className="page-grid">
    <div className="grid-main">
          <Card
            title="🏏 Live Scoreboard" defaultCollapsed={false}
            right={
              selectedMatchId ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleShareMatch}
                >
                  📤 Share
                </button>
              ) : null
            }
          >
          {!scoreboard ? (
            <p className="muted">Select a match to view scoreboard.</p>
          ) : (
            <div className="scoreboard-wrap">
              <div className="score-header">
                <div>
                  <h3>
                    {scoreboard.match.teamAName} vs {scoreboard.match.teamBName}
                  </h3>
                  <p className="muted small">
                    Batting first: {scoreboard.match.battingFirstTeamName} • Overs:{" "}
                    {scoreboard.match.oversPerInnings} • Powerplay:{" "}
                    {scoreboard.match.powerplayOversInnings}
                  </p>
                </div>
                <span className="pill">{scoreboard.match.status}</span>
              </div>
<div className="table-scroll">
              <table className="score-table">
                <thead>
                  <tr>
                    <th>Innings</th>
                    <th>Team</th>
                    <th>Runs</th>
                    <th>Wkts</th>
                    <th>Overs</th>
                    <th>RR</th>
                    <th>PP</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreboard.innings.map((inn) => (
                    <tr key={inn.number}>
                      <td>{inn.number}</td>
                      <td>{inn.teamName}</td>
                      <td>{inn.runs}</td>
                      <td>{inn.wickets}</td>
                      <td>{inn.oversDisplay}</td>
                      <td>{inn.runRate}</td>
                      <td>{inn.powerplay.runs}/{inn.powerplay.wickets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
</div>
              {scoreboard.currentState ? (
                <div className="result-box">
                  <p><strong>🎯 Current innings:</strong> {scoreboard.currentInnings}</p>
                  <p><strong>🏏 Striker:</strong> {scoreboard.currentState.strikerName}</p>
                  <p><strong>🏃 Non-striker:</strong> {scoreboard.currentState.nonStrikerName}</p>
                  <p>
                    <strong>⏭️ Next ball:</strong>{" "}
                    {scoreboard.currentState.nextOverNo}.{scoreboard.currentState.nextBallInOver}
                  </p>
                </div>
              ) : null}
<CollapsibleSection
  title="🤝 Partnerships"
  defaultOpen={true}
>
  {!activeInnings?.partnerships?.length ? (
    <p className="muted">No partnerships yet</p>
  ) : (
    <div className="table-scroll">
    <table className="score-table">
      <thead>
        <tr>
          <th>Batters</th>
          <th>Runs</th>
          <th>Balls</th>
          <th>Status</th>
        </tr>
      </thead>

      <tbody>
        {activeInnings.partnerships.map((p, idx) => (
          <tr key={idx}>
            <td>{p.batter1} & {p.batter2}</td>
            <td>{p.runs}</td>
            <td>{p.balls}</td>
            <td>
              {p.ongoing
                ? "Current"
                : `Ended at wicket ${p.wicketNumber}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )}
</CollapsibleSection>

<CollapsibleSection
  title="💥 Fall of Wickets"
  defaultOpen={false}
>
  {!activeInnings?.fallOfWickets?.length ? (
    <p className="muted">No wickets yet</p>
  ) : (
    <div className="table-scroll">
    <table className="score-table">
      <thead>
        <tr>
          <th>Wkt</th>
          <th>Score</th>
          <th>Player Out</th>
          <th>Over</th>
        </tr>
      </thead>

      <tbody>
        {activeInnings.fallOfWickets.map((w, idx) => (
          <tr key={idx}>
            <td>{w.wicketNumber}</td>
            <td>{w.score}</td>
            <td>{w.playerOut}</td>
            <td>{w.over}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )}
</CollapsibleSection>

              <div>
                <h4>🕘 Recent Balls</h4>
                <div className="recent-balls">
                  {scoreboard.recentBalls.length === 0 ? (
                    <span className="muted">No deliveries yet</span>
                  ) : (
                    scoreboard.recentBalls.map((item) => (
                      <span key={item.id} className="tag">
                        {item.label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
<Card
  title="🎯 Advanced Scoring"
  defaultCollapsed={false}
>
          {!matchDetail ? (
            <p className="muted">Select a match first.</p>
          ) : (
            <>
<div className="score-summary-panel">
<div className="single-line-scoreboard">
  <span className="status-chip">
    📌 {scoreboard?.summary?.statusText}
  </span>
</div>
  <div className="single-line-scoreboard">
    <span>
      <strong>Score:</strong>{" "}
      {activeInnings
        ? `${activeInnings.runs}/${activeInnings.wickets}`
        : "-"}
    </span>

    <span>
      <strong>Overs:</strong>{" "}
      {activeInnings?.oversDisplay || "0.0"}
    </span>

    <span>
      <strong>Striker:</strong>{" "}
      {scoreboard?.currentState?.strikerName || "-"}{" "}
      (
      {scoreboard?.currentState?.strikerStats
        ? `${scoreboard.currentState.strikerStats.runs} (${scoreboard.currentState.strikerStats.balls})`
        : "0 (0)"}
      )
    </span>

    <span>
      <strong>Non-Striker:</strong>{" "}
      {scoreboard?.currentState?.nonStrikerName || "-"}{" "}
      (
      {scoreboard?.currentState?.nonStrikerStats
        ? `${scoreboard.currentState.nonStrikerStats.runs} (${scoreboard.currentState.nonStrikerStats.balls})`
        : "0 (0)"}
      )
    </span>
    <span>
      <strong>Bowler:</strong>{" "}
      {scoreboard?.currentState?.bowlerName || "-"}{" "}
      (
      {scoreboard?.currentState?.bowlerStats
        ? `${scoreboard.currentState.bowlerStats.wickets}/${scoreboard.currentState.bowlerStats.runs} in ${scoreboard.currentState.bowlerStats.overs} ov`
        : "0/0"}
      )
    </span>
  </div>
  {(message || error) && (
    <div
      className={`notification-banner ${
        error ? "notification-error" : "notification-success"
      }`}
    >
      {error || message}
    </div>
  )}
<div className="recent-balls-row">
  <span className="recent-label">Recent: </span>

  {scoreboard?.recentBalls?.length ? (
    scoreboard.recentBalls.slice(-20).map((ball, index) => {
      const label = ball.label || "";

      // Detect over change
      const currentOver = label.split(".")[0];
      const prevOver =
        index > 0
          ? scoreboard.recentBalls
              .slice(-20)
              [index - 1]?.label?.split(".")[0]
          : currentOver;

      // Extract only result after over.ball
      // Example:
      // "12.3 4" => "4"
      // "14.5 W" => "W"
      const ballResult = (label.split(" ").slice(1).join(" ") || label).replace(/[()]/g, "");

      return (
        <React.Fragment key={ball.id}>
          {index > 0 && currentOver !== prevOver && (
            <span className="over-separator">|</span>
          )}

          <span
            className={`ball-chip ${
              ballResult === "W"
                ? "ball-wicket"
                : ballResult === "4" || ballResult === "6"
                ? "ball-boundary"
                : ""
            }`}
          >
            {ballResult}
          </span>
        </React.Fragment>
      );
    })
  ) : (
    <span className="muted">No recent balls</span>
  )}
</div>

<div className="quick-actions">
  <button type="button" className={`chip ${activeQuickAction === "0" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("0", () => quickNormalBall(0))}>0</button>
  <button type="button" className={`chip ${activeQuickAction === "1" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("1", () => quickNormalBall(1))}>1</button>
  <button type="button" className={`chip ${activeQuickAction === "2" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("2", () => quickNormalBall(2))}>2</button>
  <button type="button" className={`chip ${activeQuickAction === "3" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("3", () => quickNormalBall(3))}>3</button>
  <button type="button" className={`chip ${activeQuickAction === "4" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("4", () => quickNormalBall(4))}>4</button>
  <button type="button" className={`chip ${activeQuickAction === "6" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("6", () => quickNormalBall(6))}>6</button>

  <button type="button" className={`chip ${activeQuickAction === "Wd" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("Wd", () => quickExtra("WIDE"))}>Wd</button>

  <button type="button" className={`chip ${activeQuickAction === "Nb" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("Nb", () => quickExtra("NOBALL"))}>Nb</button>

  <button type="button" className={`chip ${activeQuickAction === "B" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("B", () => quickExtra("BYE"))}>B</button>

  <button type="button" className={`chip ${activeQuickAction === "LB" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("LB", () => quickExtra("LEGBYE"))}>LB</button>

  <button type="button" className={`chip ${activeQuickAction === "W" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("W", () => quickWicket("BOWLED"))}>Wkt</button>
   <button type="button" className="chip" onClick={quickRetiredHurt}>
    RH
  </button>
 <button
    type="button"
    className="btn btn-outline"
    onClick={swapBatters}
  >
    ⇄ Swap
  </button>
  <button
    type="button"
    className="btn btn-danger scoring-btn"
    onClick={handleUndoBall}
  >
    ↩ Undo Ball
  </button>
    <button
    type="submit"
    form="add-ball-form"
    className="btn scoring-btn scoring-btn-primary"
  >
    ✅ Add Delivery
  </button>
</div>

<div className="scoring-action-bar">
</div>
</div>

              <form id="add-ball-form" className="form grid-2" onSubmit={handleAddBall}>
                <label>
                  <span>Innings</span>
                  <select
                    value={ballForm.inningsNo || ""}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, inningsNo: e.target.value }))
                    }
                  >
                    <option value="1">Innings 1</option>
                    <option value="2">Innings 2</option>
                  </select>
                </label>
  {/* Striker */}
  <label>
    <span>Striker</span>

    <select
      value={ballForm.strikerId || ""}
      onChange={(e) =>
        setBallForm((prev) => ({
          ...prev,
          strikerId: e.target.value,
          dismissedPlayerId: e.target.value
        }))
      }
      required
    >
      <option value="">Select striker</option>

      {(battingTeam?.players || []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
     {/* Bowler */}
  </label>
                <label>
                  <span>Bowler</span>
                  <select
                    value={ballForm.bowlerId || ""}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, bowlerId: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select bowler</option>
                    {(bowlingTeam?.players || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
  {/* Non Striker */}
  <label>
    <span>Non-striker</span>

    <select
      value={ballForm.nonStrikerId || ""}
      onChange={(e) =>
        setBallForm((prev) => ({
          ...prev,
          nonStrikerId: e.target.value
        }))
      }
      required
    >
      <option value="">Select non-striker</option>

      {(battingTeam?.players || []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  </label>
                <label>
                  <span>Extra Type</span>
                  <select
                    value={ballForm.extraType || ""}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, extraType: e.target.value }))
                    }
                  >
                    {EXTRA_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Runs Off Bat</span>
                  <input
                    type="number"
                    min="0"
                    value={ballForm.runsOffBat || ""}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, runsOffBat: e.target.value }))
                    }
                    required
                  />
                </label>

                <label>
                  <span>Extras</span>
                  <input
                    type="number"
                    min="0"
                    value={ballForm.extras || ""}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, extras: e.target.value }))
                    }
                    required
                  />
                </label>

                <label className="checkbox-row">
                  <span>Wicket</span>
                  <input
                    type="checkbox"
                    checked={ballForm.isWicket}
                    onChange={(e) =>
                      setBallForm((prev) => ({
                        ...prev,
                        isWicket: e.target.checked,
                        wicketType: e.target.checked ? "BOWLED" : "NONE"
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Wicket Type</span>
                  <select
                    value={ballForm.wicketType || ""}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, wicketType: e.target.value }))
                    }
                    disabled={!ballForm.isWicket}
                  >
                    {WICKET_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Dismissed Player</span>
                  <select
                    value={ballForm.dismissedPlayerId || ""}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, dismissedPlayerId: e.target.value }))
                    }
                    disabled={!ballForm.isWicket}
                  >
                    <option value="">Select dismissed player</option>
                    {(battingTeam?.players || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>New Batter</span>
                  <select
                    value={ballForm.newBatterId || ""}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, newBatterId: e.target.value }))
                    }
                    disabled={!ballForm.isWicket}
                  >
                    <option value="">Select new batter</option>
                    {availableNewBatters.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>

                <label className="full-span">
                  <span>Note</span>
                  <input
                    type="text"
                    value={ballForm.note || ""}
                    onChange={(e) =>
                      setBallForm((prev) => ({ ...prev, note: e.target.value }))
                    }
                    placeholder="Optional note"
                  />
                </label>
              </form>
            </>
          )}
        </Card>

        <Card title="📊 Player Statistics" defaultCollapsed={false}>
          {!stats ? (
            <p className="muted">Select a match.</p>
          ) : (
            <div className="stats-grid">
              <div>
                  <h4>Batting</h4>

                  {Object.entries(battingByTeam || {}).map(([teamName, players]) => (
                    <div key={teamName} style={{ marginBottom: 24 }}>
                      <h5>{teamName}</h5>
<div className="table-scroll">
                      <table className="score-table">
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>R</th>
                            <th>B</th>
                            <th>4s</th>
                            <th>6s</th>
                            <th>SR</th>
                            <th>Out</th>
                          </tr>
                        </thead>

                        <tbody>
                          {players.map((row) => (
                            <tr key={row.playerId}>
                              <td>{row.playerName}</td>
                              <td>{row.runs}</td>
                              <td>{row.balls}</td>
                              <td>{row.fours}</td>
                              <td>{row.sixes}</td>
                              <td>{row.strikeRate}</td>
                              <td>{row.outs ? row.dismissal : "not out"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  ))}
                </div>
              <div>
                        <h4>Bowling</h4>
                        {Object.entries(bowlingByTeam || {}).map(([teamName, players]) => (
                          <div key={teamName} style={{ marginBottom: 24 }}>
                            <h5>{teamName}</h5>
<div className="table-scroll">
                            <table className="score-table">
                              <thead>
                                <tr>
                                  <th>Player</th>
                                  <th>O</th>
                                  <th>R</th>
                                  <th>W</th>
                                  <th>Dots</th>
                                  <th>Eco</th>
                                </tr>
                              </thead>

                              <tbody>
                                {players.map((row) => (
                                  <tr key={row.playerId}>
                                    <td>{row.playerName}</td>
                                    <td>{row.overs}</td>
                                    <td>{row.runs}</td>
                                    <td>{row.wickets}</td>
                                    <td>{row.dots}</td>
                                    <td>{row.economy}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            </div>
                          </div>
                        ))}
                      </div>
            </div>
          )}
        </Card>

    </div>

    <div className="grid-side">
            <Card title="📋 Matches" defaultCollapsed={false}>
        {matches.length === 0 ? (
          <p className="muted">No matches yet</p>
        ) : (
          <div className="match-list">
            {matches.map((match) => {
                  const isProtectedLeague = match.leagueName === "Surprise Cricket League";
                  //const PROTECTED_LEAGUE_ID = 2;
                  //const isProtectedLeague = Number(match.leagueId) === PROTECTED_LEAGUE_ID;
                  const canDeleteProtectedLeague = session?.user?.email === "surprisecricket11@gmail.com";
    return (
              <div
                key={match.id}
                className={`match-item ${
                  String(match.id) === String(selectedMatchId)
                    ? "active"
                    : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMatchId(String(match.id))
                    //handleMatchSelect(match.id)
                  }
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  <div>
                    <strong>
                      #{match.id} • {match.teamAName} vs{" "}
                      {match.teamBName}
                    </strong>

                    <div className="muted small">
                      Bat first: {match.battingFirstTeamName}
                      {" • "}
                      {match.oversPerInnings} overs
                      {" • "}
                      Max wkts:{" "}
                      {match.maxWicketsPerInnings ?? "∞"}
                      {" • "}
                      Bowler limit:{" "}
                      {match.maxOversPerBowler ?? "∞"}
                    </div>

                    <div className="muted small">
                      {formatDate(match.createdAt)}
                    </div>
                  </div>
                </button>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                  }}
                >
                  
                  <span className="pill">
                    {match.status}
                  </span>
      {
            permissions?.canDeleteMatch && (                 
                  <button 
                    type="button"
                    className="btn btn-outline"
                    onClick={() =>
                      handleDeleteMatch(match.id)
                    }
                  >
                    Delete
                  </button>
            )}            
                </div>
              </div>
    ); 
          })}
          </div>
        )}
      </Card>

        {(message || error) && (
          <Card title="ℹ️ Notifications" defaultCollapsed={false}>
            {message ? <p className="success">{message}</p> : null}
            {error ? <p className="error">{error}</p> : null}
          </Card>
        )}
    </div>
  </div>
)}
{activeTab === "matches" && (
  <div className="page-grid">
    <div className="grid-main">
<Card title="🎯 Active League">
  <select
    value={activeLeagueId || ""}
 onChange={(e) => {
  const value = e.target.value;

  setActiveLeagueId(
    value ? Number(value) : null
  );
}}
  >
    <option value="">
      Select League
    </option>

    {leagues.map((league) => (
      <option
        key={league.id}
        value={league.id}
      >
        {league.name}
      </option>
    ))}
  </select>
</Card>
      <Card title="🗓️ Create Match" defaultCollapsed={false}>
{activeLeagueId && (
  <div
    style={{
      marginBottom: 16,
      padding: 12,
      borderRadius: 8
    }}
  >
    Active League:{" "}
    <strong>
      {
        leagues.find(
          (l) => l.id === activeLeagueId
        )?.name
      }
    </strong>
  </div>
)}
        <form className="form stack" onSubmit={handleCreateMatch}>
            <label>
              <span>Team A</span>
              <select
                value={matchForm.teamAId || ""}
                onChange={(e) =>
                  setMatchForm((prev) => ({ ...prev, teamAId: e.target.value }))
                }
                required
              >
                <option value="">Select Team A</option>
{teamsForMatch.map(team => (
  <option
    key={team.id}
    value={team.id}
  >
    {team.name}
  </option>
))}
              </select>
            </label>

            <label>
              <span>Team B</span>
              <select
                value={matchForm.teamBId || ""}
                onChange={(e) =>
                  setMatchForm((prev) => ({ ...prev, teamBId: e.target.value }))
                }
                required
              >
                <option value="">Select Team B</option>
 {teamsForMatch.map(team => (
  <option
    key={team.id}
    value={team.id}
  >
    {team.name}
  </option>
))}
              </select>
            </label>

            <label>
              <span>Batting First</span>
              <select
                value={matchForm.battingFirstTeamId || ""}
                onChange={(e) =>
                  setMatchForm((prev) => ({
                    ...prev,
                    battingFirstTeamId: e.target.value
                  }))
                }
                required
              >
                <option value="">Select batting first team</option>
                {teams
                  .filter((t) => [matchForm.teamAId, matchForm.teamBId].includes(String(t.id)))
                  .map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
              </select>
            </label>

            <label>
              <span>Overs per innings</span>
              <input
                type="number"
                min="1"
                value={matchForm.oversPerInnings}
                onChange={(e) =>
                  setMatchForm((prev) => ({
                    ...prev,
                    oversPerInnings: e.target.value
                  }))
                }
                required
              />
            </label>
            <label>
  <span>Maximum wickets per innings</span>

  <input
    type="number"
    min=""
    max=""
    value={matchForm.maxWicketsPerInnings}
    onChange={(e) =>
      setMatchForm((prev) => ({
        ...prev,
        maxWicketsPerInnings: e.target.value
      }))
    }
  />

  <small className="muted">
    Leave empty for unlimited
  </small>
</label>

<label>
  <span>Maximum overs per bowler</span>

  <input
    type="number"
    min="1"
    value={matchForm.maxOversPerBowler}
    onChange={(e) =>
      setMatchForm((prev) => ({
        ...prev,
        maxOversPerBowler: e.target.value
      }))
    }
  />

  <small className="muted">
    Example: 4 in T20
  </small>
</label>

            <label>
              <span>Powerplay overs</span>
              <input
                type="number"
                min="0"
                value={matchForm.powerplayOversInnings}
                onChange={(e) =>
                  setMatchForm((prev) => ({
                    ...prev,
                    powerplayOversInnings: e.target.value
                  }))
                }
              />
            </label>

            <button type="submit" className="btn">Create Match</button>
        </form>
      </Card>

    </div>

    <div className="grid-side">

      <Card title="📋 Matches" defaultCollapsed={false}>
        {matches.length === 0 ? (
          <p className="muted">No matches yet</p>
        ) : (
          <div className="match-list">
            {matches.map((match) => {
                                const isProtectedLeague = match.leagueName === "Surprise Cricket League";
                  //const PROTECTED_LEAGUE_ID = 2;
                  //const isProtectedLeague = Number(match.leagueId) === PROTECTED_LEAGUE_ID;
                  const canDeleteProtectedLeague = session?.user?.email === "surprisecricket11@gmail.com";
    return (
              <div
                key={match.id}
                className={`match-item ${
                  String(match.id) === String(selectedMatchId)
                    ? "active"
                    : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    //setSelectedMatchId(String(match.id))
                    handleMatchSelect(match.id)
                  }
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  <div>
                    <strong>
                      #{match.id} • {match.teamAName} vs{" "}
                      {match.teamBName}
                    </strong>

                    <div className="muted small">
                      Bat first: {match.battingFirstTeamName}
                      {" • "}
                      {match.oversPerInnings} overs
                      {" • "}
                      Max wkts:{" "}
                      {match.maxWicketsPerInnings ?? "∞"}
                      {" • "}
                      Bowler limit:{" "}
                      {match.maxOversPerBowler ?? "∞"}
                    </div>

                    <div className="muted small">
                      {formatDate(match.createdAt)}
                    </div>
                  </div>
                </button>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                  }}
                >
                  <span className="pill">
                    {match.status}
                  </span>
  {(!isProtectedLeague ||
  canDeleteProtectedLeague) && (     
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() =>
                      handleDeleteMatch(match.id)
                    }
                  >
                    Delete
                  </button>
  )}
                </div>
              </div>
    );  
})}
          </div>
        )}
      </Card>

      {(message || error) && (
        <Card title="ℹ️ Notifications">
          {message && (
            <p className="success">{message}</p>
          )}
          {error && (
            <p className="error">{error}</p>
          )}
        </Card>
      )}

    </div>
  </div>
)}
{activeTab === "management" && (
  <div className="page-grid">

    <div className="grid-main">
<Card title="🏆 Create League" defaultCollapsed={true}>
  <form className="form stack" onSubmit={handleAddLeague}>
    <label>
      <span>League Name</span>

      <input
        type="text"
        value={leagueForm.name}
        onChange={(e) =>
          setLeagueForm({
            name: e.target.value
          })
        }
        placeholder="Premier League"
        required
      />
    </label>

    <button
      type="submit"
      className="btn"
    >
      Create League
    </button>
  </form>
</Card>
<Card title="🏆 Leagues" defaultCollapsed={false}>
  {leagues.map((league) => {
    const isProtectedLeague =
    league.name === "Surprise Cricket League";

  const canDeleteProtectedLeague =
    session?.user?.email ===
    "surprisecricket11@gmail.com";
return(
    <div
      key={league.id}
      className="card"
      style={{ marginBottom: 16 }}
    >
      <div className="card-head">
        <button
          type="button"
          className="btn btn-outline"
            key={league.id}

            onClick={() => selectLeague(league)}
       >
            <strong>{league.name}</strong>
            {activeLeagueId === league.id && (
              <span
                style={{
                  marginLeft: 10,
                  color: "#2563eb"
                }}
              >
                (Active)
              </span>
            )}
        </button>     
        <button
          type="button"
          className="btn btn-outline"
          onClick={() =>
            setExpandedLeagueId(
              expandedLeagueId === league.id
                ? null
                : league.id
            )
          }
        >
          {expandedLeagueId === league.id
            ? "Hide Teams"
            : `Teams (${league.teams?.length || 0})`}
        </button>
        <button
  className="btn btn-outline"
  onClick={() => generateInviteLink(league.id)}
>
  🔗 Invite Link
</button>
 {(!isProtectedLeague ||
  canDeleteProtectedLeague) && (
  <button
    className="btn btn-danger"
    onClick={() =>
      handleDeleteLeague(
        league.id,
        league.name
      )
    }
  >
    Delete League
  </button>
)}
      </div>

      {expandedLeagueId === league.id && (
        <>
          {/* ADD TEAM FORM */}
          <form
            onSubmit={handleAddTeam}
            style={{
              marginTop: 12,
              marginBottom: 12
            }}
          >
            <input
              type="text"
              value={teamForm.name}
              placeholder="Team name"
onChange={(e) =>
  setTeamForm((prev) => ({
    ...prev,
    leagueId: league.id,
    name: e.target.value
  }))
}
              required
            />

            <button
              type="submit"
              className="btn"
            >
              Add Team
            </button>
          </form>

          {/* TEAM LIST */}
          {league.teams?.map((team) => (
   <div
    key={team.id}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 12
    }}
  >
    <span style={{ minWidth: 150 }}>
      {team.name}
    </span>

    <select
      value={selectedPlayers[team.id] || ""}
      onChange={(e) =>
        setSelectedPlayers((prev) => ({
          ...prev,
          [team.id]: e.target.value
        }))
      }
    >
      <option value="">
        Select Player
      </option>

      {team.players?.map((player) => (
        <option
          key={player.id}
          value={player.id}
        >
          {player.name}
        </option>
      ))}
    </select>
{
permissions?.canDeletePlayer && (
<button
  disabled={!selectedPlayers[team.id]}
  onClick={() => {
    const player = team.players.find(
      (p) =>
        p.id === Number(selectedPlayers[team.id])
    );

    handleDeletePlayer(
      player.id,
      player.name
    );
  }}
>
  Delete Player
</button>
  )}

    {
      permissions?.canDeleteTeam && (
    <button
      onClick={() => handleDeleteTeam(team.id,team.name)}
    >
      Delete Team
    </button>
  )}   
  </div>
          ))}
        </>
      )}
    </div>
);    
})}
</Card>
    </div>

    <div className="grid-side">
 <Card title="🧍 Add Player" defaultCollapsed={false}>
          <form className="form stack" onSubmit={handleAddPlayer}>
            <label>
              <span>Team</span>
              <select
                value={playerForm.teamId || ""}
                onChange={(e) =>
                  setPlayerForm((prev) => ({ ...prev, teamId: e.target.value }))
                }
                required
              >
                <option value="">Select team</option>
                {teamsForMatch.map(team => (
  <option
    key={team.id}
    value={team.id}
  >
    {team.name}
  </option>
))}
              </select>
            </label>

<label>
  <span>Player Names</span>

  <textarea
    rows={8}
    value={playerForm.names}
    onChange={(e) =>
      setPlayerForm((prev) => ({
        ...prev,
        names: e.target.value
      }))
    }
    placeholder={`Sachin Tendulkar
Virat Kohli
MS Dhoni
Rohit Sharma`}
    required
  />

  <small className="muted">
    Enter one player per line
  </small>
</label>

            <button type="submit" className="btn">Add Player</button>
          </form>
        </Card>
        {(message || error) && (
          <Card title="ℹ️ Notifications" defaultCollapsed={false}>
            {message ? <p className="success">{message}</p> : null}
            {error ? <p className="error">{error}</p> : null}
          </Card>
        )}
    </div>

  </div>
)}
{activeTab === "permissions" && (
  <div className="page-grid">
    <div className="grid-main">

      {/* MEMBER LIST */}
<Card title="👥 League Permissions">
  <div className="members-list">
    {activeLeague?.members?.map((member) => (
      <div
        key={member.id}
        className="member-card"
      >
        <div className="member-info">
          <div className="member-avatar">
            👤
          </div>

          <div className="member-details">
            <div className="member-name">
              {member.user?.name || "Unknown User"}
            </div>

            <div className="member-email">
              {member.user?.email}
            </div>
          </div>
        </div>

        <div className="member-actions">
          <select
            className="member-role-select"
            value={member.role}
            onChange={(e) =>
              updateRole(
                activeLeague.id,
                member.id,
                e.target.value
              )
            }
          >
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="CAPTAIN">Captain</option>
            <option value="SCORER">Scorer</option>
            <option value="ANALYST">Analyst</option>
            <option value="VIEWER">Viewer</option>
          </select>

          <button
            className="btn btn-outline"
            onClick={() =>
              openPermissionEditor(member)
            }
          >
            🔐 Permissions
          </button>
        </div>
      </div>
    ))}
  </div>
</Card>

 {/* MEMBER PERMISSIONS */}
{selectedMember && permissions && (
  <Card
    title={`🔐 Permissions - ${
      selectedMember.user?.name ||
      selectedMember.user?.email
    }`}
  >
    <div className="permissions-grid">

      <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canViewManagement ?? false}
          onChange={(e) =>
            updatePermission(
              "canViewManagement",
              e.target.checked
            )
          }
        />
        <span>View Management</span>
      </label>

      <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canCreateMatch ?? false}
          onChange={(e) =>
            updatePermission(
              "canCreateMatch",
              e.target.checked
            )
          }
        />
        <span>Create Match</span>
      </label>

      <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canDeleteMatch ?? false}
          onChange={(e) =>
            updatePermission(
              "canDeleteMatch",
              e.target.checked
            )
          }
        />
        <span>Delete Match</span>
      </label>

      <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canScoreMatch ?? false}
          onChange={(e) =>
            updatePermission(
              "canScoreMatch",
              e.target.checked
            )
          }
        />
        <span>Score Match</span>
      </label>

      <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canUndoBall ?? false}
          onChange={(e) =>
            updatePermission(
              "canUndoBall",
              e.target.checked
            )
          }
        />
        <span>Undo Ball</span>
      </label>

    </div>

    <div className="permission-actions">
      <button
        className="btn"
        onClick={savePermissions}
      >
        💾 Save Permissions
      </button>
    </div>

  </Card>
)}
    </div>
  </div>
)}
{showWicketModal && (
  <div className="modal-backdrop">
    <div className="modal-card">
      <h3>🏏 Wicket Details</h3>

      <label>
        <span>Wicket Type</span>
        <select
          value={ballForm.wicketType || ""}
          onChange={(e) =>
            setBallForm((prev) => ({
              ...prev,
              wicketType: e.target.value
            }))
          }
        >
          {WICKET_TYPES
            .filter((x) => x !== "NONE")
            .map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
        </select>
      </label>

      <label style={{ marginTop: 12 }}>
        <span>New Batter</span>

        <select
          value={ballForm.newBatterId || ""}
          onChange={(e) =>
            setBallForm((prev) => ({
              ...prev,
              newBatterId: e.target.value
            }))
          }
        >
          <option value="">
            Select New Batter
          </option>

          {availableNewBatters.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 20
        }}
      >
        <button
          className="btn"
          onClick={() => setShowWicketModal(false)}
        >
          Confirm
        </button>

        <button
          className="btn btn-outline"
          onClick={() => {
            setShowWicketModal(false);

            setBallForm((prev) => ({
              ...prev,
              isWicket: false,
              wicketType: "NONE",
              newBatterId: ""
            }));
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
{showExtrasModal && (
  <div className="modal-backdrop">
    <div className="modal-card">
      <h3>
        {selectedExtraType === "WIDE" && "Wide"}
        {selectedExtraType === "NOBALL" && "No Ball"}
        {selectedExtraType === "BYE" && "Bye"}
        {selectedExtraType === "LEGBYE" && "Leg Bye"}
      </h3>

      <p>Select total extra runs</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 8,
          marginTop: 12
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((runs) => (
          <button
            key={runs}
            className="btn"
            onClick={() => confirmExtra(runs)}
          >
            {runs}
          </button>
        ))}
      </div>

      <button
        className="btn btn-outline"
        style={{ marginTop: 16 }}
        onClick={() => setShowExtrasModal(false)}
      >
        Cancel
      </button>
    </div>
  </div>
)}
{showRetiredHurtModal && (
  <div className="modal-backdrop">
    <div className="modal-card">
      <h3>Retired Hurt</h3>

      <p>Select incoming batter</p>

      <select
        value={retiredHurtBatterId || ""}
        onChange={(e) => setRetiredHurtBatterId(e.target.value)}
      >
        <option value="">Select batter</option>

        {battingTeam?.players
          ?.filter(
            (p) =>
              String(p.id) !== String(ballForm.strikerId) &&
              String(p.id) !== String(ballForm.nonStrikerId)
          )
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </select>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 16
        }}
      >
        <button
          className="btn"
          onClick={confirmRetiredHurt}
        >
          Confirm
        </button>

        <button
          className="btn btn-outline"
          onClick={() => setShowRetiredHurtModal(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
{toast && (
  <div
    className={`toast-popup ${
      toast.type === "error" ? "toast-error" : "toast-success"
    }`}
  >
    {toast.text}
  </div>
)}
  </>
);
}