"use client";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";
import { EXTRA_TYPES, getPlayerName, WICKET_TYPES } from "@/lib/scoring";
import "@/app/globals.css";
import { useRouter } from "next/navigation";
import { Analytics } from "@vercel/analytics/next"

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
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [toast, setToast] = useState(null);
  const [activeQuickAction, setActiveQuickAction] = useState(null);
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [selectedWicketType, setSelectedWicketType] = useState("BOWLED");
  const [selectedNewBatter, setSelectedNewBatter] = useState("");
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [selectedExtraType, setSelectedExtraType] = useState("WIDE");
  const [leagues, setLeagues] = useState([]);
  const [leagueForm, setLeagueForm] = useState({name: ""});
  const [selectedPlayerTeamId, setSelectedPlayerTeamId] = useState("");
  const [showLeagueModal, setShowLeagueModal] = useState(false);
  const [pendingNonBallEvent, setPendingNonBallEvent] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [expandedLeagueId, setExpandedLeagueId] = useState(null);
  const [activeLeagueId, setActiveLeagueId] = useState("");
  const [activeTab, setActiveTab] = useState("management");
  const [permissions, setPermissions] = useState(null);
  const [showControls, setShowControls] = useState(false);
  const [matchDetail, setMatchDetail] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);
  const [stats, setStats] = useState({ batting: [], bowling: [] });
  const [runOutRuns, setRunOutRuns] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAdvancedSheet, setShowAdvancedSheet] = useState(false);
  const [showRetiredHurtModal, setShowRetiredHurtModal] = useState(false);
  const [retiredHurtBatterId, setRetiredHurtBatterId] = useState("");
  const [retiredPlayerType, setRetiredPlayerType] = useState("STRIKER");
  const [replacementPlayerId, setReplacementPlayerId] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState({});
  const [showBowlerModal, setShowBowlerModal] = useState(false);
  const [pendingBallData, setPendingBallData] = useState(null);
  const [mustChangeBowler, setMustChangeBowler] = useState(false);
  const [teamForm, setTeamForm] = useState({leagueId: "", name: ""});
const [playerForm, setPlayerForm] = useState({names: "",teamId: "",leagueId: ""});
const [preferencesLoaded, setPreferencesLoaded] = useState(false);
const [searchTerm, setSearchTerm] = useState("");
const [showFullScoreboard, setShowFullScoreboard] = useState(false);
const [roleFilter, setRoleFilter] = useState("ALL");
const [pointsTable, setPointsTable] = useState([]);
const [showPlayerModal, setShowPlayerModal] = useState(false);
const [showStartMatchModal, setShowStartMatchModal] = useState(false);
const [startMatchData, setStartMatchData] = useState({matchId: "",battingFirstTeamId: ""});
const [playerLeagueId, setPlayerLeagueId] = useState(null);
const [showPermissionModal,setShowPermissionModal] = useState(false);
const [selectedMember, setSelectedMember] = useState(null);
const [showAddTeam, setShowAddTeam] = useState(false);
const [playerNames, setPlayerNames] = useState("");
const [selectedMemberId, setSelectedMemberId] = useState("");
const [isMobile, setIsMobile] = useState(false);
const [showAddPlayers, setShowAddPlayers] = useState(false);
const [memberSearch, setMemberSearch] = useState("");
const [matchesSubTab, setMatchesSubTab] = useState("ACTIVE");
const [me, setMe] = useState(null);
const [permissionsLoading, setPermissionsLoading] = useState(false);
const scheduledMatches = matches.filter((m) => normalizeStatus(m.status) === "SCHEDULED");
const [scoringSubTab, setScoringSubTab] = useState("ADVANCED");
const [statsSubTab, setStatsSubTab] = useState("BATTING");
const [leagueStats, setLeagueStats] = useState(null);
const [rankingType, setRankingType] = useState("topRunScorers");
const isSuperAdmin =
  session?.user?.email ===
  "surprisecricket11@gmail.com";

useEffect(() => {
  fetch("/api/me")
    .then((r) => r.json())
    .then(setMe);
}, []);
useEffect(() => {
  if (!message && !error) return;

  const timer = setTimeout(() => {
    setMessage("");
    setError("");
  }, 20000); // 30 seconds

  return () => clearTimeout(timer);
}, [message, error]);
const selectedLeague =
  leagues.find(
    (l) => String(l.id) === String(activeLeagueId)
  );
const activeLeague =
  leagues.find(
    (league) =>
      league.id ===
      Number(activeLeagueId)
  ) || null;
useEffect(() => {
  if (activeTab === "scoring") {
    setScoringSubTab("ADVANCED");
  }
}, [activeTab]);
useEffect(() => {
  if (!activeLeagueId) return;

  if (isSuperAdmin) {
    setPermissions({
        canViewDashboard:  true,
  canViewManagement:  true,
  canViewMatches:  true,
  canViewScoring:  true,
  canViewStats:  true,

  canCreateLeague:  true,
  canEditLeague:  true,
  canDeleteLeague:  true,

  canManageMembers:  true,
  canManagePermissions:  true,

  canCreateTeam:  true,
  canEditTeam:  true,
  canDeleteTeam:  true,

  canCreatePlayer:  true,
  canEditPlayer:  true,
  canDeletePlayer:  true,

  canCreateMatch:  true,
  canEditMatch:  true,
  canDeleteMatch:  true,

  canScoreMatch:  true,
  canEditScore:  true,
  canUndoBall:  true,
  canSwapStrike:  true,
  canRetirePlayer:  true,

  canEndMatch:  true,
  canAbandonMatch:  true,
  canLockMatch:  true,

  canExportStats:  true,
  canViewAuditLogs:  true
    });

    return;
  }
  //loadPermissions(selectedMember);
  loadMyLeaguePermissions(activeLeagueId);
}, [activeLeagueId, isSuperAdmin]);
useEffect(() => {
  if (activeLeagueId) {
    loadPointsTable(activeLeagueId);
  }
}, [activeLeagueId]);
async function loadPermissions(member) {
  try {
    if (!activeLeague?.id || !member?.id) {
      setError("Member id is required");
      return;
    }

    setPermissionsLoading(true);

    const data = await api(
      `/api/leagues/${activeLeague.id}/permissions?memberId=${member.id}`
    );

    const latestMember = data.member;

    setSelectedMember(latestMember);

    const loadedPermissions = {
      role: latestMember.role || "VIEWER",
    };

    for (const field of PERMISSION_FIELDS) {
      loadedPermissions[field] =
        latestMember[field] ?? false;
    }

    setPermissions(loadedPermissions);
    setShowPermissionModal(true);
  } catch (err) {
    console.error(err);
    setError(err.message);
  } finally {
    setPermissionsLoading(false);
  }
}
const selectedTeam =
  selectedLeague?.teams?.find(
    (t) => String(t.id) === String(selectedTeamId)
  );

const filteredMembers =
  activeLeague?.members?.filter(
    (member) => {
      const matchesSearch =
        (member.user?.name || "")
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          ) ||
        (member.user?.email || "")
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          );

      const matchesRole =
        roleFilter === "ALL" ||
        member.role === roleFilter;

      return (
        matchesSearch &&
        matchesRole
      );
    }
  ) || [];

  const helpCardStyle = {
  padding: 20,
  borderRadius: 12,

  border: "1px solid #e2e8f0",
  boxShadow:
    "0 2px 8px rgba(15,23,42,0.06)",
};

  const playerTeams =
  leagues
    .find((l) => l.id === playerLeagueId)
    ?.teams || [];
const selectedPlayerLeague = leagues.find(
  (l) => l.id === Number(playerLeagueId)
);
useEffect(() => {
  if (
    activeLeague?.members?.length > 0
  ) {
    setSelectedMember(
      activeLeague.members[0]
    );
  }
}, [activeLeague]);


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
    setSelectedMatchId("");
    setMatchDetail(null);
    setScoreboard(null);
    setStats(null);
    return;
  }

  setSelectedMatchId("");
  setMatchDetail(null);
  setScoreboard(null);
  setStats(null);

  loadMatches();
}, [activeLeagueId]);

useEffect(() => {
  if (
    showPlayerModal &&
    activeLeague
  ) {
    setPlayerForm((prev) => ({
      ...prev,
      leagueId: activeLeague.id,
    }));
  }
}, [showPlayerModal, activeLeague]);

useEffect(() => {
  if (!activeLeague) return;

  const member =
    activeLeague.members?.find(
      (m) =>
        String(m.id) === String(selectedMemberId)
    );

  if (member) {
    setSelectedMember(member);
  }

  setShowPermissionModal(false);
}, [selectedMemberId, activeLeague]);
useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  checkMobile();

  window.addEventListener(
    "resize",
    checkMobile
  );

  return () =>
    window.removeEventListener(
      "resize",
      checkMobile
    );
}, []);
useEffect(() => {
  if (activeLeagueId) {
    loadLeagueStats(activeLeagueId);
  }
}, [activeLeagueId]);

async function handleCreateLeague() {
  const league = await api("/api/leagues", {
    method: "POST",
    body: JSON.stringify({
      name: leagueName
    })
  });

  await loadLeagues();

  setActiveLeagueId(String(league.id));
  setSelectedTeamId("");

  setShowLeagueModal(false);
  setLeagueName("");
}
async function loadLeagueStats(leagueId) {
  if (!leagueId) return;

  const data = await api(`/api/leagues/${leagueId}/stats`);
  setLeagueStats(data);
}
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

  // NEW
  scheduledAt: "",

  // keep this, but now it is optional
  battingFirstTeamId: "",

  oversPerInnings: 20,
  powerplayOversInnings: 6,
  maxWicketsPerInnings: "",
  maxOversPerBowler: "",

  // NEW
  status: "SCHEDULED"
});

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
  note: "",
  fielderId: "",
  assistantFielderId: "",
  wicketNote: ""
});
const rankingConfig = {
  topRunScorers: {
    label: "Runs",
    icon: "🏏",
    title: "Top Run Scorers",
    value: (r) => `${r.runs} runs`
  },
  topWicketTakers: {
    label: "Wickets",
    icon: "🎯",
    title: "Top Wicket Takers",
    value: (r) => `${r.wickets} wkts`
  },
  bestStrikeRate: {
    label: "Strike Rate",
    icon: "🚀",
    title: "Best Strike Rate",
    value: (r) => r.strikeRate
  },
  bestEconomy: {
    label: "Economy",
    icon: "🧊",
    title: "Best Economy",
    value: (r) => r.economy
  },
  mostSixes: {
    label: "Sixes",
    icon: "💥",
    title: "Most Sixes",
    value: (r) => `${r.sixes} sixes`
  },
  bestAllRounders: {
    label: "All-rounders",
    icon: "⭐",
    title: "Best All-Rounders",
    value: (r) => `${r.allRounderPoints} pts`
  }
};

const selectedRanking =
  leagueStats?.rankings?.[rankingType] || [];

const currentRankingConfig =
  rankingConfig[rankingType];
async function loadMatches() {
  try {
    if (!activeLeagueId) {
      setMatches([]);
      setSelectedMatchId("");
      return;
    }

    const data = await api(
      `/api/matches?leagueId=${activeLeagueId}`
    );

    const leagueMatches = data.filter(
      (m) =>
        String(m.leagueId) === String(activeLeagueId)
    );

    setMatches(leagueMatches);

    if (
      selectedMatchId &&
      !leagueMatches.some(
        (m) => String(m.id) === String(selectedMatchId)
      )
    ) {
      setSelectedMatchId("");
      setMatchDetail(null);
      setScoreboard(null);
      setStats(null);
      return;
    }

    if (!selectedMatchId && leagueMatches.length > 0) {
      setSelectedMatchId(String(leagueMatches[0].id));
    }
  } catch (error) {
    console.error("Load Matches Error:", error);
  }
}
async function loadTeams() {
  try {
    const data = await api("/api/teams");

    setTeams(data || []);

    // Keep selected team valid
    if (!selectedTeamId && data?.length > 0) {
      setSelectedTeamId(String(data[0].id));
    } else if (
      selectedTeamId &&
      !data.some(
        (t) =>
          String(t.id) ===
          String(selectedTeamId)
      )
    ) {
      setSelectedTeamId(
        data[0]
          ? String(data[0].id)
          : ""
      );
    }

  } catch (error) {
    console.error(
      "Load Teams Error:",
      error
    );

    setError(
      error.message ||
      "Failed to load teams"
    );

    setTeams([]);
  }
}
const handleAddPlayers = async (e) => {
 alert(JSON.stringify(playerForm));


  e.preventDefault();

  try {


    if (!playerForm.teamId) {
      setError("Please select a team");
      return;
    }

    const rawNames = playerForm.names || "";



    const playerNames = rawNames
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0);



    if (playerNames.length === 0) {
      setError("Enter at least one player");
      return;
    }

    const payload = {
      teamId: Number(selectedPlayerTeamId),
      names: playerNames,
    };



    const response = await fetch(
      "/api/players/bulk",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

  

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to create players"
      );
    }

    await loadTeams();
    await loadLeagues();

    setMessage(
      `${data.created || playerNames.length} players added`
    );

    setPlayerForm({
      names: "",
      teamId: "",
      leagueId: activeLeagueId || "",
    });

    setShowPlayerModal(false);

  } catch (error) {
    console.error("Add Players Error:", error);
    setError(error.message);
  }
};
async function openPermissionEditor(member) {
  try {
    setSelectedMember(member);
    setShowPermissionModal(true);

    const response = await fetch(
      //`/api/leagues/${activeLeague.id}/permissions?memberId=${member.id}`
    `/api/leagues/${activeLeague.id}/permissions?memberId=${member.id}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to load permissions"
      );
    }

    const latestMember = data.member;

    const loadedPermissions = {
      role: latestMember.role || "VIEWER",
    };

    for (const field of PERMISSION_FIELDS) {
      loadedPermissions[field] =
        latestMember[field] ?? false;
    }

    setSelectedMember(latestMember);
    setPermissions(loadedPermissions);
  } catch (error) {
    setError(error.message);
  }
}
function updatePermission(permission, value) {
  setPermissions((prev) => ({
    ...prev,
    [permission]: value,
  }));
}

async function savePermissions(member) {
  console.log("selectedMember", selectedMember);
  console.log("active League Id:", activeLeagueId);
   console.log("active League.Id:", activeLeague.id);
      console.log("member.Id:", member.id);
  if (!selectedMember || !activeLeague?.id) return;

  try {
    const response = await fetch(
      `/api/leagues/${activeLeague.id}/permissions?memberId=${member.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: selectedMember.id,
          email: selectedMember.user?.email,
          role: permissions.role,
          ...Object.fromEntries(
            PERMISSION_FIELDS.map((field) => [
              field,
              permissions[field] ?? false,
            ])
          ),
        }),
      }
    );

    const data = await response.json();
console.log("data", data);
    if (!response.ok) {
      throw new Error(
        data.error || "Failed to save permissions"
      );
    }

    const updatedMember = data.member || {
      ...selectedMember,
      ...permissions,
    };

    setLeagues((prev) =>
      prev.map((league) =>
        league.id === activeLeague.id
          ? {
              ...league,
              members: league.members?.map((member) =>
                member.id === selectedMember.id
                  ? {
                      ...member,
                      ...updatedMember,
                    }
                  : member
              ),
            }
          : league
      )
    );

    setSelectedMember(updatedMember);
    setShowPermissionModal(false);
    setMessage("✅ Role and permissions updated successfully");
  } catch (error) {
    setError(error.message);
  }
}
const PERMISSION_FIELDS = [
  "canViewDashboard",
  "canViewManagement",
  "canViewMatches",
  "canViewScoring",
  "canViewStats",

  "canCreateLeague",
  "canEditLeague",
  "canDeleteLeague",

  "canManageMembers",
  "canManagePermissions",

  "canCreateTeam",
  "canEditTeam",
  "canDeleteTeam",

  "canCreatePlayer",
  "canEditPlayer",
  "canDeletePlayer",

  "canCreateMatch",
  "canEditMatch",
  "canDeleteMatch",

  "canScoreMatch",
  "canEditScore",
  "canUndoBall",
  "canSwapStrike",
  "canRetirePlayer",

  "canEndMatch",
  "canAbandonMatch",
  "canLockMatch",

  "canExportStats",
  "canViewAuditLogs",
];
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
async function loadPointsTable(leagueId) {
  if (!leagueId) return;

  const data = await api(`/api/leagues/${leagueId}/points-table`);
  setPointsTable(data);
}
  async function handleShareMatch() {
      if (!scoreboard) return;

      const shareCode = scoreboard?.match?.shareCode;
      const shareUrl = `${window.location.origin}/live/${shareCode}`;
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
const loadLeagues = async () => {
  const response = await fetch("/api/leagues");
  const data = await response.json();

 setLeagues(data);

if (activeLeagueId) {
  const refreshedLeague =
    data.find(
      (l) =>
        String(l.id) ===
        String(activeLeagueId)
    );

  if (!refreshedLeague) {
    setActiveLeagueId("");
    setSelectedTeamId("");
  }
}
  return data;
};

async function updateRole(
  leagueId,
  memberId,
  role
) {
  try {
    const response = await fetch(
      `/api/leagues/${activeLeague.id}/permissions?memberId=${memberId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          memberId,
          role
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to update role"
      );
    }

    setLeagues((prev) =>
      prev.map((league) =>
        league.id === leagueId
          ? {
              ...league,
              members: league.members?.map(
                (member) =>
                  member.id === memberId
                    ? {
                        ...member,
                        role
                      }
                    : member
              )
            }
          : league
      )
    );

    setMessage("Role updated successfully");
  } catch (error) {
    console.error(error);
    setError(error.message);
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
    if (board?.currentState) {
  setBallForm(prev => ({
    ...prev,

    strikerId:
      board.currentState.strikerId,

    nonStrikerId:
      board.currentState.nonStrikerId,

    bowlerId:
      board.currentState.bowlerId ??
      prev.bowlerId
  }));
}
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
    await loadLeagues();
    setActiveLeagueId(Number(league.id));
    showToast(
      "success",
      "🏆 League created"
    );

    await loadLeagues();
    await loadMatches();
    await loadTeams();
    await refreshAll();
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
useEffect(() => {
  if (
    scoreboard?.currentState
      ?.needNewBowler
  ) {
    //alert("Opening bowler popup555");
    setShowBowlerModal(true);
  }
}, [scoreboard]);
const handleAddTeam = async (e) => {
  e.preventDefault();

  try {


    const response = await fetch("/api/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: teamForm.name,
        leagueId: teamForm.leagueId,
      }),
    });

    const data = await response.json();



    if (!response.ok) {
      throw new Error(data.error || "Failed to create team");
    }

 setMessage(`Team "${data.name}" created`);

await loadLeagues();
await loadTeams();

setTeamForm((prev) => ({
  ...prev,
  name: ""
}));

setShowAddTeam(false);

  } catch (error) {
    console.error("Create Team Error:", error);

    setError(error.message);
  }
};

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

const handleAddPlayer = async (e) => {
  e.preventDefault();

  try {
    const response = await fetch(
      "/api/players",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          name: playerForm.name,
          teamId: selectedTeam.id,
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Failed to add player"
      );
    }

    setMessage(
      `Player "${data.name}" added`
    );

    setPlayerForm({
      name: "",
    });

    setShowPlayerModal(false);

   const updatedLeagues = await loadLeagues();

const refreshedLeague = updatedLeagues.find(
  (l) => l.id === activeLeague.id
);

if (refreshedLeague) {
  selectLeague(refreshedLeague);
}

  } catch (error) {
    setError(error.message);
  }
};

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
battingFirstTeamId: matchForm.battingFirstTeamId
  ? Number(matchForm.battingFirstTeamId)
  : null,

scheduledAt: matchForm.scheduledAt
  ? new Date(matchForm.scheduledAt).toISOString()
  : null,

status: "SCHEDULED",

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
  scheduledAt: "",
  battingFirstTeamId: "",
  oversPerInnings: 20,
  powerplayOversInnings: 6,
  maxWicketsPerInnings: "",
  maxOversPerBowler: "",
  status: "SCHEDULED"
});

      setMessage("✅ Match created");
      await loadMatches();
      setSelectedMatchId(String(match.id));
    } catch (err) {
      setError(err.message);
    }
  }
const isMatchCompleted = scoreboard?.match?.status === "COMPLETED";
const isMatchLocked = scoreboard?.match?.status ===  "COMPLETED_LOCKED";
const isMatchAbandoned = scoreboard?.match?.status ===  "ABANDONED";

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

      await Promise.all([
        loadSelectedMatch(selectedMatchId),
        loadMatches()
      ]);
      
      setMessage("↩️ Last ball removed");
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

  async function quickNormalBall(runs) {
  
  try{  
    await submitBall({
    matchId: Number(selectedMatchId),
    inningsNo: Number(ballForm.inningsNo),
    strikerId: Number(ballForm.strikerId),
    nonStrikerId: Number(ballForm.nonStrikerId),
    bowlerId: Number(ballForm.bowlerId),
    extraType: "NONE",
    runsOffBat: runs,
    extras: 0,
    isWicket: 0,
    wicketType: "NONE",
    dismissedPlayerId: null,
    newBatterId: null
  });

    if (runs === 0) {
      setMessage("🟢 Dot ball recorded.");
    } else if (runs === 4) {
      setMessage("🔥 FOUR! Ball recorded and 4 runs added.");
    } else if (runs === 6) {
      setMessage("🚀 SIX! Ball recorded and 6 runs added.");
    } else {
      setMessage(
        `🏏 Ball recorded • ${runs} run${runs > 1 ? "s" : ""} added to the total.`
      );
    }
  } catch (err) {
    setError(err.message);
  }  
}

async function handleAddBall(e) {
  e?.preventDefault();

  await submitBall({
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
    note: ballForm.note,
    matchStatus: scoreboard.match.status,
    fielderId: ballForm.fielderId
  ? Number(ballForm.fielderId)
  : null,

assistantFielderId: ballForm.assistantFielderId
  ? Number(ballForm.assistantFielderId)
  : null,

wicketNote: ballForm.wicketNote || null
  });
}
async function submitBall(data) {
  setMessage("");
  setError("");

  if (scoreboard?.match?.status === "COMPLETED") {
    setError("Match has already ended");
    return;
  }

  if (!selectedMatchId) {
    setError("Please select a match");
    return;
  }

  try {
    await api("/api/balls", {
      method: "POST",
      body: JSON.stringify(data)
    });

    const wasLegalLastBallOfOver =
      data.extraType !== "WIDE" &&
      data.extraType !== "NOBALL" &&
      Number(scoreboard?.currentState?.nextBallInOver) === 6;

    setBallForm((prev) => ({
      ...prev,
      extraType: "NONE",
      runsOffBat: "0",
      extras: "0",
      isWicket: false,
      wicketType: "NONE",
      newBatterId: "",
      dismissedPlayerId: "",
      note: "",
      dismissal: "",
      fielderId: "",
      assistantFielderId: "",
      wicketNote: ""
    }));

    setShowAdvancedSheet(false);

    await Promise.all([
      loadSelectedMatch(selectedMatchId),
      loadMatches()
    ]);

if (wasLegalLastBallOfOver) {
  setPendingBallData(null);
  setMustChangeBowler(true);
  setShowBowlerModal(true);
}
  } catch (err) {
    if (
      err.message?.includes(
        "BOWLER_CONSECUTIVE_OVER"
      )
    ) {
      setPendingBallData({
        matchId: Number(selectedMatchId),
        inningsNo: Number(data.inningsNo),
        strikerId: Number(data.strikerId),
        nonStrikerId: Number(data.nonStrikerId),
        bowlerId: Number(data.bowlerId),
        extraType: data.extraType,
        runsOffBat: Number(data.runsOffBat),
        extras: Number(data.extras),

        isWicket:
          data.isWicket &&
          data.wicketType !== "RETIRED_HURT"
            ? 1
            : 0,

        wicketType: data.isWicket
          ? data.wicketType
          : "NONE",

        dismissedPlayerId:
          data.isWicket
            ? Number(
                data.dismissedPlayerId ||
                  data.strikerId
              )
            : null,

        newBatterId:
          data.newBatterId
            ? Number(data.newBatterId)
            : null,

        note: data.note,
        matchStatus: data.matchStatus
      });

      setShowBowlerModal(true);
      return;
    }

    setError(err.message);
    showToast("error", err.message);
  }
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
    extraType: type
  }));
  setShowExtrasModal(true);
}
async function confirmExtra(extraRuns) {
  try {
    let runsOffBat = Number(ballForm.runsOffBat || 0);
    let extras = Number(ballForm.extras || 0);
    let displayLabel = String(extraRuns);

    // Handles WD, WD+1, WD+2...
    if (typeof extraRuns === "string" && extraRuns.startsWith("WD")) {
      const additionalRuns = extraRuns.includes("+")
        ? Number(extraRuns.split("+")[1])
        : 0;

      runsOffBat = 0;
      extras = 1 + additionalRuns; // WD+1 = 2 extras
    }

    // Handles NB, NB+1, NB+2...
    else if (typeof extraRuns === "string" && extraRuns.startsWith("NB")) {
      const batRuns = extraRuns.includes("+")
        ? Number(extraRuns.split("+")[1])
        : 0;

      runsOffBat = batRuns; // NB+1 = 1 to striker
      extras = 1;           // only no-ball penalty as extra
    }

    // Bye / Leg bye
    else {
      runsOffBat = 0;
      extras = Number(extraRuns);
    }

    await submitBall({
      matchId: Number(selectedMatchId),
      inningsNo: Number(ballForm.inningsNo),
      strikerId: Number(ballForm.strikerId),
      nonStrikerId: Number(ballForm.nonStrikerId),
      bowlerId: Number(ballForm.bowlerId),
      extraType: ballForm.extraType,
      runsOffBat,
      extras,

      isWicket:
        ballForm.isWicket &&
        ballForm.wicketType !== "RETIRED_HURT"
          ? 1
          : 0,

      wicketType: ballForm.isWicket
        ? ballForm.wicketType
        : "NONE",

      dismissedPlayerId: ballForm.isWicket
        ? Number(
            ballForm.dismissedPlayerId ||
              ballForm.strikerId
          )
        : null,

      newBatterId:
        ballForm.isWicket && ballForm.newBatterId
          ? Number(ballForm.newBatterId)
          : null,

      note: ballForm.note,
      matchStatus: scoreboard?.match?.status
    });
if (
  ballForm.extraType === "NOBALL" &&
  runsOffBat % 2 === 1
) {
  setBallForm((prev) => ({
    ...prev,
    strikerId: prev.nonStrikerId,
    nonStrikerId: prev.strikerId
  }));
}
    const extraLabels = {
      WIDE: "Wide",
      NOBALL: "No Ball",
      BYE: "Bye",
      LEGBYE: "Leg Bye",
      NONE: "Extra"
    };

    const extraLabel =
      extraLabels[ballForm.extraType] ||
      ballForm.extraType;

    setMessage(
      `✅ ${displayLabel} added as ${extraLabel}.`
    );

    setShowExtrasModal(false);
  } catch (err) {
    setError(err.message);
  }
}
async function quickWicket(type = "BOWLED") {
  setBallForm((prev) => ({
    ...prev,
    isWicket: true,
    wicketType: type,
    dismissedPlayerId: prev.strikerId
  }));

  setShowWicketModal(true);
}
async function confirmWicket() {
  try {
    if (mustChangeBowler) {
  setError("Please select a new bowler before scoring the next ball.");
  setShowWicketModal(false);
  setShowRetiredHurtModal(false);
  setShowBowlerModal(true);
  return;
}
    const isRunOut = ballForm.wicketType === "RUN_OUT";

    if (isRunOut && runOutRuns === null) {
      setError("Please select runs completed before the run out.");
      return;
    }

    const dismissedPlayerId = isRunOut
      ? Number(ballForm.dismissedPlayerId)
      : Number(ballForm.dismissedPlayerId || ballForm.strikerId);

    if (isRunOut && !dismissedPlayerId) {
      setError("Please select who is out.");
      return;
    }

    if (!ballForm.newBatterId) {
      setError("Please select a new batter.");
      return;
    }

    const runsOffBat = isRunOut
      ? Number(runOutRuns)
      : Number(ballForm.runsOffBat || 0);

    const dismissedPlayer = battingTeam?.players?.find(
      (p) => Number(p.id) === dismissedPlayerId
    );

    const newBatter = battingTeam?.players?.find(
      (p) => Number(p.id) === Number(ballForm.newBatterId)
    );

    await submitBall({
      matchId: Number(selectedMatchId),
      inningsNo: Number(ballForm.inningsNo),
      strikerId: Number(ballForm.strikerId),
      nonStrikerId: Number(ballForm.nonStrikerId),
      bowlerId: Number(ballForm.bowlerId),
      extraType: "NONE",
      runsOffBat,
      extras: 0,

      isWicket:
        ballForm.isWicket &&
        ballForm.wicketType !== "RETIRED_HURT"
          ? 1
          : 0,

      wicketType: ballForm.isWicket
        ? ballForm.wicketType
        : "NONE",

      dismissedPlayerId,
      newBatterId: Number(ballForm.newBatterId),

      note: ballForm.note,
      matchStatus: scoreboard?.match?.status,

      fielderId: ballForm.fielderId
          ? Number(ballForm.fielderId)
          : null,

      assistantFielderId: ballForm.assistantFielderId
          ? Number(ballForm.assistantFielderId)
          : null,

      wicketNote: ballForm.wicketNote || null
    });

    setMessage(
      `🚨 ${dismissedPlayer?.name || "Batter"} is out (${ballForm.wicketType
        ?.replaceAll("_", " ")
        ?.toLowerCase()}). ${runsOffBat} ${
        runsOffBat === 1 ? "run" : "runs"
      } awarded. ${newBatter?.name || "New batter"} comes in.`
    );

    setShowWicketModal(false);
    setRunOutRuns(null);
  } catch (err) {
    setError(err.message);
  }
}


async function swapBatters() {
  if (!selectedMatchId) return;

  try {
    const newStrikerId =
      ballForm.nonStrikerId;

    const newNonStrikerId =
      ballForm.strikerId;

    await api(
      "/api/events/swap-strike",
      {
        method: "POST",
        body: JSON.stringify({
          matchId: selectedMatchId,
          inningsNo: ballForm.inningsNo,
          strikerId: newStrikerId,
          nonStrikerId: newNonStrikerId
        })
      }
    );

    setBallForm(prev => ({
      ...prev,
      strikerId: newStrikerId,
      nonStrikerId: newNonStrikerId
    }));

    await loadSelectedMatch(
      selectedMatchId
    );

    setMessage(
      "🔄 Striker swapped successfully"
    );

  } catch (err) {
    setError(err.message);
  }
}
const handleBulkAddPlayers = async (e) => {
  e.preventDefault();

  try {

const names = playerForm.names
  .split("\n")
  .map((name) => name.trim())
  .filter(Boolean);

    const response = await fetch("/api/players/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamId: playerForm.teamId,
        names,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to add players"
      );
    }

    await loadLeagues();

    setShowPlayerModal(false);

    setMessage(
      `${names.length} players added successfully`
    );
  } catch (error) {
    setError(error.message);
  }
};
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

async function handleRetiredHurtSubmit() {
  if (mustChangeBowler) {
  setError("Please select a new bowler before scoring the next ball.");
  setShowRetiredHurtModal(false);
  setShowWicketModal(false);
  setShowBowlerModal(true);
  return;
}

  if (!replacementPlayerId) {
    setError("Select replacement batter");
    return;
  }

  const dismissedPlayerId =
    retiredPlayerType === "STRIKER"
      ? Number(ballForm.strikerId)
      : Number(ballForm.nonStrikerId);

  const retiredPlayer =
    retiredPlayerType === "STRIKER"
      ? battingTeam?.players?.find(
          p => p.id === Number(ballForm.strikerId)
        )
      : battingTeam?.players?.find(
          p => p.id === Number(ballForm.nonStrikerId)
        );

  const retiredPlayerName = retiredPlayer?.name;
  const replacementPlayer =
    battingTeam?.players?.find(
      p => p.id === Number(replacementPlayerId)
    );

  const replacementPlayerName =
    replacementPlayer?.name;      

  const retiredHurtBall = {
    ...ballForm,

    matchId: selectedMatchId,
    isWicket: true,
    wicketType: "RETIRED_HURT",

    dismissedPlayerId,
    newBatterId: Number(replacementPlayerId),

    runsOffBat: 0,
    extras: 0,
    totalRuns: 0,

    legalDelivery: false
  };

try {  
await api("/api/balls", {
  method: "POST",
  body: JSON.stringify(retiredHurtBall)
});

  await loadSelectedMatch(selectedMatchId);
  setMessage("✅ "+retiredPlayerName +" is retired hurt and replaced by "+ replacementPlayerName);
  setShowRetiredHurtModal(false);
  } catch (err) {
    setError(
      err.message ||
      "Failed to retired hurt a player"
    );
  }  
}
async function loadMyLeaguePermissions(leagueId) {
  try {
    setPermissionsLoading(true);

    const data = await api(
      `/api/leagues/${leagueId}/permissions/me`
    );

    setPermissions(data.permissions);
  } catch (err) {
    console.error(err);
    setPermissions(null);
    setError(err.message);
  } finally {
    setPermissionsLoading(false);
  }
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

  showToast(
    "success",
    "Registration link copied"
  );
}
async function handleEndMatch() {
  const confirmed = window.confirm(
    "End this match? No more scoring will be allowed."
  );

  if (!confirmed) return;

  try {
    await api(
      `/api/matches/${selectedMatchId}/end`,
      {
        method: "POST",
        body: JSON.stringify({
        matchEndType: "End" })
      }
    );
    await loadMatches();
    await loadSelectedMatch(selectedMatchId);
    setMessage("Match ended successfully");
  } catch (err) {
    setError(
      err.message ||
      "Failed to end match"
    );
  }
}
async function handleLockMatch() {
  const confirmed = window.confirm(
    "Lock this match?  Once locked, this match cannot be edited or scored further."
  );

  if (!confirmed) return;

  try {
    await api(
      `/api/matches/${selectedMatchId}/end`,
      {
        method: "POST",
        body: JSON.stringify({
        matchEndType: "Lock" })
      }
    );
    await loadMatches();
    await loadSelectedMatch(selectedMatchId);
    setMessage("Match ended successfully");
  } catch (err) {
    setError(
      err.message ||
      "Failed to end match"
    );
  }
}
async function handleAbandonMatch() {
  const confirmed = window.confirm(
    "Abandon this match?  Once abandoned, this match cannot be edited or scored further."
  );

  if (!confirmed) return;

  try {
    await api(
      `/api/matches/${selectedMatchId}/end`,
      {
        method: "POST",
        body: JSON.stringify({
        matchEndType: "Abandon" })
      }
    );
    await loadMatches();
    await loadSelectedMatch(selectedMatchId);
    setMessage("Match ended successfully");
  } catch (err) {
    setError(
      err.message ||
      "Failed to end match"
    );
  }
}
async function confirmBowlerChange() {
  try {
    const newBowlerId = Number(ballForm.bowlerId);

    if (!newBowlerId) {
      setError("Please select a new bowler.");
      return;
    }

    const selectedBowler = bowlingTeam?.players?.find(
      (p) => Number(p.id) === newBowlerId
    );

    await api(`/api/matches/${selectedMatchId}/change-bowler`, {
      method: "POST",
      body: JSON.stringify({
        bowlerId: newBowlerId
      })
    });

    setBallForm((prev) => ({
      ...prev,
      bowlerId: newBowlerId
    }));

    setMustChangeBowler(false);
    setShowBowlerModal(false);
    setPendingBallData(null);

    await loadSelectedMatch(selectedMatchId);
    await loadMatches();

    // IMPORTANT: do this AFTER loadSelectedMatch
    const selectedBowlerStats = stats?.bowling?.find(
  (row) => Number(row.playerId) === newBowlerId
  );

 setScoreboard((prev) => ({
  ...prev,
  currentState: {
    ...prev?.currentState,
    bowlerId: newBowlerId,
    bowlerName: selectedBowler?.name || "Selected Bowler",
    bowlerStats: selectedBowlerStats
      ? {
          runs: selectedBowlerStats.runs || 0,
          wickets: selectedBowlerStats.wickets || 0,
          overs: selectedBowlerStats.overs || "0.0"
        }
      : {
          runs: 0,
          wickets: 0,
          overs: "0.0"
        }
  }
}));

    setMessage("✅ Bowler change successful");
  } catch (err) {
    setError(err.message);
  }
}

function handleCloseBowlerModal() {
  if (mustChangeBowler) {
    setError("Please select a new bowler before scoring the next ball.");
    setShowBowlerModal(true);
    return;
  }

  setShowBowlerModal(false);
  setPendingBallData(null);
}
function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function isCompletedStatus(status) {
  const s = normalizeStatus(status);

  return (
    s === "COMPLETED" ||
    s === "COMPLETED_LOCKED" ||
    s === "LOCKED" ||
    s === "ABANDONED" ||
    s.includes("COMPLETED") ||
    s.includes("LOCKED")
  );
}

function isActiveStatus(status) {
  const s = normalizeStatus(status);

  return (
    s === "LIVE" ||
    s === "IN_PROGRESS" ||
    s === "STARTED"
  );
}

const activeMatches = matches.filter((m) =>
  isActiveStatus(m.status)
);

const completedMatches = matches.filter((m) =>
  isCompletedStatus(m.status)
);
function handleStartMatch(match) {
  setSelectedMatchId(String(match.id));
  setMatchForm((prev) => ({
    ...prev,
    matchId: String(match.id),
    teamAId: String(match.teamAId),
    teamBId: String(match.teamBId),
    battingFirstTeamId: ""
  }));
  setShowStartMatchModal(true);
}

async function confirmStartMatch() {
  if (!selectedMatchId || !startMatchData.battingFirstTeamId) {
    setError("Please select batting first team.");
    return;
  }

  await api(`/api/matches/${selectedMatchId}/start`, {
    method: "POST",
    body: JSON.stringify({
      battingFirstTeamId: Number(startMatchData.battingFirstTeamId)
    })
  });

  setShowStartMatchModal(false);
  setMessage("✅ Match started. Opening scoring...");

  await loadSelectedMatch(selectedMatchId);
  await loadMatches();

  setActiveTab("scoring");
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
const canCreateMatch =
  activeLeague?.teams?.length >= 2;

const selectedMatch = matches.find(
  (m) => String(m.id) === String(selectedMatchId)
); 
  /*const isMobile =
  typeof window !== "undefined" &&
  window.innerWidth < 768;
*/
return (
  <>
<div className="dashboard-tabs">
<Analytics />
  {permissionsLoading ? (
    <span>Loading permissions...</span>
  ) : (
    <>
      {permissions?.canViewManagement && (
        <button
          className={`dashboard-tab ${
            activeTab === "management"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("management")
          }
        >
          ⚙️ Leagues
        </button>
      )}

      {permissions?.canViewMatches && (
        <button
          className={`dashboard-tab ${
            activeTab === "matches"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("matches")
          }
        >
          📋 Matches
        </button>
      )}

      {permissions?.canViewScoring && (
        <button
          className={`dashboard-tab ${
            activeTab === "scoring"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("scoring")
          }
        >
          🏏 Scoring
        </button>
      )}
        <button
          className={`dashboard-tab ${
            activeTab === "Points"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("Points")
          }
        >
          🥇 Points
        </button>

      {permissions?.canViewStats && (
        <button
          className={`dashboard-tab ${
            activeTab === "stats"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("stats")
          }
        >
          📊 Stats
        </button>
      )}

      {permissions?.canManagePermissions && (
        <button
          className={`dashboard-tab ${
            activeTab === "permissions"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("permissions")
          }
        >
          🔐 Access
        </button>
      )}

      <button
        className="dashboard-tab"
        onClick={() =>
          setActiveTab("help")
        }
      >
        ❓ Help
      </button>

      <button
        className="dashboard-tab"
        onClick={() =>
          setActiveTab("about")
        }
      >
        ℹ️ About
      </button>
    </>
  )}
</div>

  {activeTab === "scoring" && (
<div className="scoring-layout">
<Card
  title="🏏 Match Center"
  defaultCollapsed={false}
  right={
    selectedMatchId ? (
      <button
        type="button"
        className="share-score-btn"
        onClick={handleShareMatch}
      >
        📤 Share - Spectator View
      </button>
    ) : null
  }
>
          <div className="active-league-banner">
          Active League:{" "}
          <strong>
    {leagues.find((l) => Number(l.id) === Number(activeLeagueId))?.name || "No league selected"}
          </strong>
        </div>
  {matches.length === 0 ? (
    <div className="match-empty-state">
      No matches yet. Create or start a match first.
    </div>
  ) : (
    <div className="match-center">
      <label className="match-select-label">
        <span>Select Match</span>

        <select
          value={selectedMatchId || ""}
          onChange={(e) => {
            setSelectedMatchId(e.target.value);
            setScoringSubTab("ADVANCED");
          }}
        >
          <option value="">Choose a match</option>

          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              #{match.id} • {match.teamAName} vs {match.teamBName}
            </option>
          ))}
        </select>
      </label>

      {selectedMatch && (
        <div className="selected-match-banner">
          <div>
            <strong>
              {selectedMatch.teamAName} vs {selectedMatch.teamBName}
            </strong>
            <span>
              {selectedMatch.battingFirstTeamName
                ? `Batting first: ${selectedMatch.battingFirstTeamName}`
                : "Batting first not decided"}
            </span>
          </div>

          <span className="pill">
            {selectedMatch.status}
          </span>
        </div>
      )}

      {selectedMatchId && (
        <div className="scoring-subtabs pretty">
          <button
            type="button"
            className={scoringSubTab === "ADVANCED" ? "active" : ""}
            onClick={() => setScoringSubTab("ADVANCED")}
          >
            <span>🎯</span>
            <strong>Scoring</strong>
          </button>

          <button
            type="button"
            className={scoringSubTab === "SCOREBOARD" ? "active" : ""}
            onClick={() => setScoringSubTab("SCOREBOARD")}
          >
            <span>🏏</span>
            <strong>Scoreboard</strong>
          </button>

          <button
  type="button"
  className={scoringSubTab === "COMMENTARY" ? "active" : ""}
  onClick={() => setScoringSubTab("COMMENTARY")}
>
  <span>📝</span>
  <strong>Commentary</strong>
</button>
        </div>
      )}
</div>
  )}
</Card>
{selectedMatchId && scoringSubTab === "SCOREBOARD" && (
  <Card title="🏟️ Professional Scoreboard" defaultCollapsed={false}>
    {!scoreboard ? (
      <p className="muted">Select a match to view scoreboard.</p>
    ) : (
      <div className="pro-scoreboard">
        <div className="pro-score-hero">
          <div>
            <h2>
              {scoreboard.match?.teamAName} vs {scoreboard.match?.teamBName}
            </h2>

            <p>
              Batting first: {scoreboard.match?.battingFirstTeamName} •{" "}
              {scoreboard.match?.oversPerInnings} overs • Powerplay:{" "}
              {scoreboard.match?.powerplayOversInnings}
            </p>
          </div>

          <span className="pill">{scoreboard.match?.status}</span>
        </div>

        <div className="innings-score-cards">
          {(scoreboard.innings || []).map((inn, idx) => (
            <div
              key={`innings-summary-${inn.number ?? idx}`}
              className={`innings-score-card ${
                Number(scoreboard.currentInnings) === Number(inn.number)
                  ? "active"
                  : ""
              }`}
            >
              <div className="innings-card-top">
                <span>Innings {inn.number}</span>
                <strong>
                  {inn.teamName || inn.battingTeamName || inn.team || "Team"}
                </strong>
              </div>

              <div className="innings-main-score">
                {inn.runs}/{inn.wickets}
              </div>

              <div className="innings-card-meta">
                <span>Overs: {inn.oversDisplay}</span>
                <span>RR: {inn.runRate}</span>
                <span>
                  PP: {inn.powerplay?.runs ?? 0}/{inn.powerplay?.wickets ?? 0}
                </span>
              </div>
            </div>
          ))}
        </div>

        {scoreboard.currentState && (
          <div className="current-match-strip">
            <div>
              <span>Current Innings</span>
              <strong>{scoreboard.currentInnings}</strong>
            </div>

            <div>
              <span>Striker</span>
              <strong>{scoreboard.currentState.strikerName}</strong>
            </div>

            <div>
              <span>Non-Striker</span>
              <strong>{scoreboard.currentState.nonStrikerName}</strong>
            </div>

            <div>
              <span>Bowler</span>
              <strong>{scoreboard.currentState.bowlerName || "-"}</strong>
            </div>

            <div>
              <span>Next Ball</span>
              <strong>
                {scoreboard.currentState.nextOverNo}.
                {scoreboard.currentState.nextBallInOver}
              </strong>
            </div>
          </div>
        )}

        {(scoreboard.innings || []).map((inn, innIdx) => (
          <div
            key={`innings-detail-${inn.number ?? innIdx}`}
            className="full-innings-card"
          >
            <div className="innings-section-header">
              <div>
                <h3>
                  Innings {inn.number}:{" "}
                  {inn.teamName || inn.battingTeamName || inn.team || "Team"}
                </h3>

                <p className="muted small">
                  {inn.runs}/{inn.wickets} in {inn.oversDisplay} overs • RR{" "}
                  {inn.runRate}
                </p>
              </div>
            </div>

            <CollapsibleSection title="🏏 Batting Scorecard" defaultOpen={true}>
              <div className="table-scroll">
                <table className="score-table pro-table">
                  <thead>
                    <tr>
                      <th>Batter</th>
                      <th>Dismissal</th>
                      <th>R</th>
                      <th>B</th>
                      <th>4s</th>
                      <th>6s</th>
                      <th>SR</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(inn.battingRows || inn.batting || []).length ? (
                      (inn.battingRows || inn.batting || []).map(
                        (row, rowIdx) => (
                          <tr
                            key={`bat-${inn.number ?? innIdx}-${
                              row.playerId ?? rowIdx
                            }-${rowIdx}`}
                          >
                            <td>
                              <strong>
                                {row.playerName}
                                {Number(scoreboard.currentState?.strikerId) ===
                                Number(row.playerId)
                                  ? " *"
                                  : ""}
                              </strong>
                            </td>
                            <td>{row.outs ? row.dismissal : "not out"}</td>
                            <td>{row.runs}</td>
                            <td>{row.balls}</td>
                            <td>{row.fours}</td>
                            <td>{row.sixes}</td>
                            <td>{row.strikeRate}</td>
                          </tr>
                        )
                      )
                    ) : (
                      <tr>
                        <td colSpan="7" className="muted">
                          Batting details not available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="🎯 Bowling Scorecard" defaultOpen={true}>
              <div className="table-scroll">
                <table className="score-table pro-table bowling-table">
                  <thead>
                    <tr>
                      <th>Bowler</th>
                      <th>O</th>
                      <th>M</th>
                      <th>R</th>
                      <th>W</th>
                      <th>Dots</th>
                      <th>Eco</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(inn.bowlingRows || inn.bowling || []).length ? (
                      (inn.bowlingRows || inn.bowling || []).map(
                        (row, rowIdx) => (
                          <tr
                            key={`bowl-${inn.number ?? innIdx}-${
                              row.playerId ?? rowIdx
                            }-${rowIdx}`}
                          >
                            <td>
                              <strong>{row.playerName}</strong>
                            </td>
                            <td>{row.overs}</td>
                            <td>{row.maidens || 0}</td>
                            <td>{row.runs}</td>
                            <td>{row.wickets}</td>
                            <td>{row.dots}</td>
                            <td>{row.economy}</td>
                          </tr>
                        )
                      )
                    ) : (
                      <tr>
                        <td colSpan="7" className="muted">
                          Bowling details not available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="💥 Fall of Wickets" defaultOpen={false}>
              {!inn.fallOfWickets?.length ? (
                <p className="muted">No wickets yet.</p>
              ) : (
                <div className="fow-list">
                  {inn.fallOfWickets.map((w, wicketIdx) => (
                    <div
                      key={`fow-${inn.number ?? innIdx}-${
                        w.wicketNumber ?? wicketIdx
                      }-${w.over ?? "over"}-${wicketIdx}`}
                      className="fow-chip"
                    >
                      <strong>
                        {w.score}-{w.wicketNumber}
                      </strong>
                      <span>{w.playerOut}</span>
                      <small>{w.over} ov</small>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection title="🤝 Partnerships" defaultOpen={false}>
              {!inn.partnerships?.length ? (
                <p className="muted">No partnerships yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="score-table pro-table">
                    <thead>
                      <tr>
                        <th>Batters</th>
                        <th>Runs</th>
                        <th>Balls</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {inn.partnerships.map((p, pIdx) => (
                        <tr
                          key={`partnership-${inn.number ?? innIdx}-${
                            p.batter1 || "b1"
                          }-${p.batter2 || "b2"}-${pIdx}`}
                        >
                          <td>
                            {p.batter1} & {p.batter2}
                          </td>
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
          </div>
        ))}

        <CollapsibleSection title="🕘 Ball-by-Ball Timeline" defaultOpen={true}>
          <div className="recent-balls pro-recent-balls">
            {!scoreboard.recentBalls?.length ? (
              <span className="muted">No deliveries yet</span>
            ) : (
              scoreboard.recentBalls.map((item, idx) => (
                <span
                  key={`recent-${item.id ?? item.label ?? "ball"}-${idx}`}
                  className="ball-timeline-chip"
                >
                  {item.label}
                </span>
              ))
            )}
          </div>
        </CollapsibleSection>
      </div>
    )}
  </Card>
)}
{selectedMatchId && scoringSubTab === "COMMENTARY" && (
  <Card title="📝 Ball-by-Ball Commentary" defaultCollapsed={false}>
    {!scoreboard ? (
      <p className="muted">Select a match to view commentary.</p>
    ) : !scoreboard.commentary?.length ? (
      <p className="muted">No commentary yet.</p>
    ) : (
      <div className="commentary-feed">
       {scoreboard.commentary.map((section, sectionIndex) => (
  <div
    key={`innings-${section.inningsNo}-${sectionIndex}`}
    className="commentary-innings-section"
  >
            <div className="commentary-innings-title">
              🏏 {section.title}
            </div>

 {section.items.map((item, itemIndex) => (
  <div
    key={`commentary-${section.inningsNo}-${item.id ?? itemIndex}`}
    className={`commentary-item ${
      item.type === "OVER_SUMMARY" ? "over-summary-item" : ""
    }`}
  >
                <div className="commentary-ball">
                  {item.over}
                </div>

                <div className="commentary-body">
                  <div className="commentary-main">
                    {item.text}
                  </div>

                  <div className="commentary-meta">
                    {item.score}
                  </div>
                      {item.type === "BALL" && (
      <div className="commentary-mini-score">
        <span>{item.strikerSummary}</span>
        <span>{item.nonStrikerSummary}</span>
        <span>{item.bowlerSummary}</span>
      </div>
    )}

    {item.type === "OVER_SUMMARY" && (
      <div className="commentary-over-summary">
        <strong>{item.score}</strong>
        <span>{item.bowlerSummary}</span>
      </div>
    )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    )}
  </Card>
)}
{selectedMatchId && scoringSubTab === "ADVANCED" && (          
<Card
  className="scoring-console"
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
<div className="live-feed-banner">
  {error ||
    message ||
    "🏏 Ready for next delivery"}
</div>
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
{!permissions?.canScoreMatch && (
<div>
   👉 You do not have permissions to score a match. Please check with your league owner to give you access to score for this match.
</div>
)}
{permissions?.canScoreMatch && (
<div className="quick-actions">
  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "0" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("0", () => quickNormalBall(0))}>0</button>
  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "1" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("1", () => quickNormalBall(1))}>1</button>
  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "2" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("2", () => quickNormalBall(2))}>2</button>
  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "3" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("3", () => quickNormalBall(3))}>3</button>
  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "4" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("4", () => quickNormalBall(4))}>4</button>
  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "6" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("6", () => quickNormalBall(6))}>6</button>

  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "Wd" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("Wd", () => quickExtra("WIDE"))}>Wd</button>

  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "Nb" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("Nb", () => quickExtra("NOBALL"))}>Nb</button>

  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "B" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("B", () => quickExtra("BYE"))}>B</button>

  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "LB" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("LB", () => quickExtra("LEGBYE"))}>LB</button>

  <button type="button" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} className={`chip ${activeQuickAction === "W" ? "chip-active" : ""}`} onClick={() => triggerQuickAction("W", () => quickWicket("BOWLED"))}>Wkt</button>
  <button type="button" className="chip" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} onClick={() => setShowRetiredHurtModal(true)}>RH</button>
 <button
    type="button"
    className="btn btn-outline"
    disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned}
    onClick={swapBatters}
  >
    ⇄ Swap
  </button>
  <button
    type="button"
    className="btn btn-danger scoring-btn"
    disabled={isMatchLocked}
    onClick={handleUndoBall}
  >
    ↩ Undo Ball
  </button>
{(isMatchCompleted || isMatchLocked) && (
  <button
    type="submit"
    form="add-ball-form"
    className="btn scoring-btn scoring-btn-primary"
    disabled
  >
    ✅ Match Ended
  </button>
)}
{(isMatchAbandoned) && (
  <button
    type="submit"
    form="add-ball-form"
    className="btn scoring-btn scoring-btn-primary"
    disabled
  >
    ⛔ Match Abandoned
  </button>
)}
{isMobile && (
<button
  type="button"
  className="advanced-sheet-btn"
  onClick={() => setShowAdvancedSheet(true)}
>
  <span className="advanced-sheet-icon">⚙️</span>

  <div className="advanced-sheet-text">
    <span className="advanced-sheet-title">
      Scoring Form
    </span>

    <span className="advanced-sheet-subtitle">
      Open advanced scoring screen
    </span>
  </div>

  <span className="advanced-sheet-arrow">
    →
  </span>
</button>
)}
</div>
)}
<div className="scoring-action-bar">
</div>
</div>

{permissions?.canScoreMatch  && (isMobile ? (
  <>
{showAdvancedSheet && (
  <>
    <div
      className="sheet-backdrop"
      onClick={() =>
        setShowAdvancedSheet(false)
      }
    />

    <div className="advanced-sheet">

      <div className="sheet-header">

        <div className="sheet-handle" />

        <h3>
          ⚙️ Scoring form for manual updates
        </h3>

        <button
          type="button"
          className="sheet-close"
          onClick={() =>
            setShowAdvancedSheet(false)
          }
        >
          ✕
        </button>

      </div>

      <div className="sheet-content">

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
  {/* Non Striker */}
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
{["CAUGHT", "STUMPED", "RUN_OUT"].includes(ballForm.wicketType) && (
  <label>
    <span>
      {ballForm.wicketType === "CAUGHT"
        ? "Caught By"
        : ballForm.wicketType === "STUMPED"
          ? "Stumped By / Wicketkeeper"
          : "Run Out By"}
    </span>

    <select
      value={ballForm.fielderId || ""}
      onChange={(e) =>
        setBallForm((prev) => ({
          ...prev,
          fielderId: e.target.value
        }))
      }
      disabled={!ballForm.isWicket}
    >
      <option value="">Select fielder</option>

      {(bowlingTeam?.players || []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  </label>
)}

{ballForm.wicketType === "RUN_OUT" && (
  <label>
    <span>Assisted By / Stumps Broken By</span>

    <select
      value={ballForm.assistantFielderId || ""}
      onChange={(e) =>
        setBallForm((prev) => ({
          ...prev,
          assistantFielderId: e.target.value
        }))
      }
      disabled={!ballForm.isWicket}
    >
      <option value="">Optional</option>

      {(bowlingTeam?.players || []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  </label>
)}
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

<div className="sheet-actions">
  <button
    type="button"
    className="btn btn-outline"
    onClick={() => setShowAdvancedSheet(false)}
  >
    Done
  </button>
</div>

      </div>
    </div>
  </>
)}
  </>
) : (
<CollapsibleSection
  title="🏏 Scoring Form"
  defaultOpen={false}
>
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
  {/* Non Striker */}
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
{["CAUGHT", "STUMPED", "RUN_OUT"].includes(ballForm.wicketType) && (
  <label>
    <span>
      {ballForm.wicketType === "CAUGHT"
        ? "Caught By"
        : ballForm.wicketType === "STUMPED"
          ? "Stumped By / Wicketkeeper"
          : "Run Out By"}
    </span>

    <select
      value={ballForm.fielderId || ""}
      onChange={(e) =>
        setBallForm((prev) => ({
          ...prev,
          fielderId: e.target.value
        }))
      }
      disabled={!ballForm.isWicket}
    >
      <option value="">Select fielder</option>

      {(bowlingTeam?.players || []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  </label>
)}

{ballForm.wicketType === "RUN_OUT" && (
  <label>
    <span>Assisted By / Stumps Broken By</span>

    <select
      value={ballForm.assistantFielderId || ""}
      onChange={(e) =>
        setBallForm((prev) => ({
          ...prev,
          assistantFielderId: e.target.value
        }))
      }
      disabled={!ballForm.isWicket}
    >
      <option value="">Optional</option>

      {(bowlingTeam?.players || []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  </label>
)}
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
              </CollapsibleSection>
)
    )}
            </>
          )}
        </Card>
)}
        {selectedMatchId && scoringSubTab === "STATS" && (
        <Card title="📊 Stats" defaultCollapsed={false}>
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
  <tr
  key={`bat-${inn.number}-${row.playerId}`}
>
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
   <tr
  key={`bat-${inn.number}-${row.playerId}`}
>
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
        )}        
{permissions?.canScoreMatch && (
<div>
  <div className="match-action-bar">
    <button
      type="button"
      className="btn btn-danger"
      disabled={isMatchLocked}
      onClick={handleLockMatch}
    >
      🔒 Lock Match
    </button>
{(!isMatchAbandoned && !isMatchCompleted && !isMatchLocked) && (
    <button
      type="button"
      className="btn btn-danger"
      disabled={isMatchLocked || isMatchCompleted}
      onClick={handleAbandonMatch}
    >
      ⛔ Abandon Match
    </button>
    
)}    
{(ballForm.inningsNo != 1 && !isMatchLocked && !isMatchAbandoned && !isMatchCompleted) && (
  <button
  type="button"
  className="btn btn-danger"
  onClick={handleEndMatch}
>
  🏁 End Match
</button>
)}
  </div>

  <div className="match-warning">
    ⚠️ Once locked, this match cannot be edited or scored further.
  </div>
</div>
)}
    </div>
)}
{activeTab === "matches" && (
  <div className="matches-page">
    {(message || error) && (
      <div className="match-alert">
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    )}

    <Card title="🏆 League">
      <label>
        <span>Active League</span>
        <select
          value={activeLeagueId || ""}
          onChange={(e) => {
            const value = e.target.value;
            setActiveLeagueId(value ? Number(value) : null);
            setSelectedMatchId("");
          }}
        >
          <option value="">Select League</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
      </label>
    <div className="matches-subtabs">
      <button
        type="button"
        className={matchesSubTab === "CREATE MATCH" ? "active" : ""}
        onClick={() => setMatchesSubTab("CREATE MATCH")}
      >
        ➕ Create
      </button>

      <button
        type="button"
        className={matchesSubTab === "ACTIVE" ? "active" : ""}
        onClick={() => setMatchesSubTab("ACTIVE")}
      >
        🟢 Active
      </button>

      <button
        type="button"
        className={matchesSubTab === "SCHEDULED" ? "active" : ""}
        onClick={() => setMatchesSubTab("SCHEDULED")}
      >
        📅 Scheduled
      </button>

      <button
        type="button"
        className={matchesSubTab === "COMPLETED" ? "active" : ""}
        onClick={() => setMatchesSubTab("COMPLETED")}
      >
        ✅ Completed
      </button>
    </div>
    </Card>
    {!activeLeagueId && (
      <Card title="📋 Matches">
        <div className="empty-state">
          Select a league to view or create matches.
        </div>
      </Card>
    )}

    {activeLeagueId && matchesSubTab === "CREATE MATCH" && (
      <Card title="➕ Create Match">
        <div className="active-league-banner">
          Active League:{" "}
          <strong>
    {leagues.find((l) => Number(l.id) === Number(activeLeagueId))?.name || "No league selected"}
          </strong>
        </div>

        <form className="form create-match-form" onSubmit={handleCreateMatch}>
          <div className="form-two-col">
            <label>
              <span>Team A</span>
              <select
                value={matchForm.teamAId || ""}
                onChange={(e) =>
                  setMatchForm((prev) => ({
                    ...prev,
                    teamAId: e.target.value
                  }))
                }
                required
              >
                <option value="">Select Team A</option>
                {teamsForMatch.map((team) => (
                  <option key={team.id} value={team.id}>
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
                  setMatchForm((prev) => ({
                    ...prev,
                    teamBId: e.target.value
                  }))
                }
                required
              >
                <option value="">Select Team B</option>
                {teamsForMatch.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
            >
              <option value="">Decide when match starts</option>
              {teams
                .filter((t) =>
                  [matchForm.teamAId, matchForm.teamBId].includes(String(t.id))
                )
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
            </select>
            <small className="muted">Optional for scheduled matches</small>
          </label>

          <label>
            <span>Scheduled Start</span>
            <input
              type="datetime-local"
              value={matchForm.scheduledAt || ""}
              onChange={(e) =>
                setMatchForm((prev) => ({
                  ...prev,
                  scheduledAt: e.target.value
                }))
              }
            />
            <small className="muted">Leave empty if date is not decided yet</small>
          </label>

          <div className="form-two-col">
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
          </div>

          <div className="form-two-col">
            <label>
              <span>Maximum wickets</span>
              <input
                type="number"
                value={matchForm.maxWicketsPerInnings}
                onChange={(e) =>
                  setMatchForm((prev) => ({
                    ...prev,
                    maxWicketsPerInnings: e.target.value
                  }))
                }
              />
              <small className="muted">Leave empty for unlimited</small>
            </label>

            <label>
              <span>Max overs per bowler</span>
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
              <small className="muted">Example: 4 in T20</small>
            </label>
          </div>

          {!permissions?.canScoreMatch ? (
            <div className="permission-warning">
              👉 You do not have permission to create a match.
            </div>
          ) : (
            <button type="submit" className="btn create-match-btn">
              Create Match
            </button>
          )}
        </form>
      </Card>
    )}

    {activeLeagueId && matchesSubTab === "ACTIVE" && (
      <Card title="🟢 Active Matches">
        {activeMatches.length === 0 ? (
          <div className="empty-state">No active matches found.</div>
        ) : (
          <div className="match-card-list">
            {activeMatches.map((match) => {
              const isSelected = String(selectedMatchId) === String(match.id);

              return (
                <div key={match.id} className={`match-tile ${isSelected ? "selected" : ""}`}>
                  <button
                    type="button"
                    className="match-tile-main"
                    onClick={() => {
                      setSelectedMatchId(String(match.id));
                      handleMatchSelect(match.id);
                    }}
                  >
<div className="match-tile-main">
  <div className="match-tile-top">
    <strong>
      {match.teamAName} vs {match.teamBName}
    </strong>

    <span className="pill">
      {match.status}
    </span>
  </div>

  <div className="match-meta compact">
    <span>
      🏏 Bat 1st: {match.battingFirstTeamName || "Not decided"}
    </span>

    <span>
      🎯 {match.oversPerInnings} overs match
    </span>

    <span>
      ⚾ Max wkts allowed: {match.maxWicketsPerInnings ?? "∞"}
    </span>

    <span>
      ⚡ Powerplay overs: {match.powerplayOversInnings ?? "∞"}
    </span>
  </div>
</div>
                    <div className="match-live-score">
                      🏏 Live Score:{" "}
                      <strong>
                        {match.scoreSummary || match.liveScore || "Open match to view score"}
                      </strong>
                    </div>
                  </button>

                  <div className="match-tile-actions">
                    {permissions?.canScoreMatch && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setSelectedMatchId(String(match.id));
                          handleMatchSelect(match.id);
                        }}
                      >
                        {isSelected ? "Scoring Open" : "Open Scoring"}
                      </button>
                    )}

                    {permissions?.canDeleteMatch && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => handleDeleteMatch(match.id)}
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
    )}

    {activeLeagueId && matchesSubTab === "SCHEDULED" && (
      <Card title="📅 Scheduled Matches">
        {scheduledMatches.length === 0 ? (
          <div className="empty-state">No scheduled matches found.</div>
        ) : (
          <div className="match-card-list">
            {scheduledMatches.map((match) => (
              <div key={match.id} className="match-tile">
                <div className="match-tile-main">
  <div className="match-tile-top">
    <strong>
      {match.teamAName} vs {match.teamBName}
    </strong>

    <span className="pill">
      {match.status}
    </span>
  </div>

  <div className="match-meta compact">
    <span>
      🏏 Bat 1st: {match.battingFirstTeamName || "Not decided"}
    </span>

    <span>
      🎯 {match.oversPerInnings} overs match
    </span>

    <span>
      ⚾ Max wkts allowed: {match.maxWicketsPerInnings ?? "∞"}
    </span>

    <span>
      ⚡ Powerplay overs: {match.powerplayOversInnings ?? "∞"}
    </span>
  </div>
                  <div className="match-scheduled-time">
                    📅 Scheduled:{" "}
                    <strong>
                      {match.scheduledAt
                        ? formatDate(match.scheduledAt)
                        : "Not decided yet"}
                    </strong>
                  </div>


                </div>

                <div className="match-tile-actions">
                  {permissions?.canScoreMatch && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleStartMatch(match)}
                    >
                      ▶ Start Match
                    </button>
                  )}

                  {permissions?.canDeleteMatch && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleDeleteMatch(match.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    )}

    {activeLeagueId && matchesSubTab === "COMPLETED" && (
      <Card title="✅ Completed Matches">
        {completedMatches.length === 0 ? (
          <div className="empty-state">No completed matches found.</div>
        ) : (
          <div className="match-card-list">
            {completedMatches.map((match) => (
              <div key={match.id} className="match-tile">
                <button
                  type="button"
                  className="match-tile-main"
                  onClick={() => {
                    setSelectedMatchId(String(match.id));
                    handleMatchSelect(match.id);
                  }}
                >
<div className="match-tile-main">
  <div className="match-tile-top">
    <strong>
      {match.teamAName} vs {match.teamBName}
    </strong>

    <span className="pill">
      {match.status}
    </span>
  </div>

  <div className="match-meta compact">
    <span>
      🏏 Bat 1st: {match.battingFirstTeamName || "Not decided"}
    </span>

    <span>
      🎯 {match.oversPerInnings} overs match
    </span>

    <span>
      ⚾ Max wkts allowed: {match.maxWicketsPerInnings ?? "∞"}
    </span>

    <span>
      ⚡ Powerplay overs: {match.powerplayOversInnings ?? "∞"}
    </span>
  </div>
</div>
<div className="match-final-score">
  <div>{match.firstInningsScore}</div>
  <div>{match.secondInningsScore}</div>
  🏆 <strong>{match.resultText}</strong>
</div>
                </button>

                <div className="match-tile-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setSelectedMatchId(String(match.id));
                      handleMatchSelect(match.id);
                    }}
                  >
                    View Match
                  </button>

                  {permissions?.canDeleteMatch && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleDeleteMatch(match.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    )}
  </div>
)}
{activeTab === "management" && (
 <div className="scoring-layout">

      <Card title="🏏 League Management">

<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 20,
  }}
>

  {/* LEAGUE CARD */}

  <div
    style={{
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 16,
    }}
  >
    <h3
      style={{
        marginTop: 0,
        marginBottom: 12,
      }}
    >
      🏆 Leagues
    </h3>

    <select
      value={activeLeagueId || ""}
      onChange={(e) => {
        setActiveLeagueId(e.target.value);
        setSelectedTeamId("");
      }}
      style={{
        width: "100%",
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

<div
  style={{
    display: "flex",
    gap: 10,
    marginTop: 12,
  }}
>
  <button
    className="btn"
    style={{
      flex: 1,
    }}
    onClick={() =>
      setShowLeagueModal(true)
    }
  >
    ➕ Create League
  </button>

  {selectedLeague &&
    permissions?.canDeleteLeague && (
      <button
        className="btn btn-danger"
        title={`Delete ${selectedLeague.name}`}
        onClick={() =>
          handleDeleteLeague(
            selectedLeague.id,
            selectedLeague.name
          )
        }
      >
        🗑️
      </button>
    )}
</div>
 <div
  className="success-banner"
  style={{
    marginTop:5,
    display: "flex",
    justifyContent: "flex-end",
  }}
>
{activeLeague && (
  <button
    className="btn btn-outline"
    title="Copy registration link"
    onClick={() =>
      generateInviteLink(activeLeague.id)
    }
  >
    🔗 Invitation link to{" "}
    <strong>{activeLeague.name}</strong>
  </button>
)}
</div>
  </div>

  {/* TEAM CARD */}

  <div
    style={{
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 16,
    }}
  >
    <h3
      style={{
        marginTop: 0,
        marginBottom: 12,
      }}
    >
      👥 Teams
    </h3>

    <select
      value={selectedTeamId || ""}
      onChange={(e) =>
        setSelectedTeamId(
          e.target.value
        )
      }
      disabled={!selectedLeague}
      style={{
        width: "100%",
      }}
    >
      <option value="">
        Select Team
      </option>

      {selectedLeague?.teams?.map(
        (team) => (
          <option
            key={team.id}
            value={team.id}
          >
            {team.name}
          </option>
        )
      )}
    </select>

    <div
      style={{
        display: "flex",
        gap: 10,
        marginTop: 12,
      }}
    >
      <button
        className="btn"
        style={{ flex: 1 }}
        disabled={!selectedLeague}
        onClick={() => {
          setTeamForm({
            name: "",
            leagueId:
              selectedLeague.id,
          });

          setShowAddTeam(true);
        }}
      >
        ➕ Add Team
      </button>

      {selectedTeam &&
        permissions?.canDeleteTeam && (
          <button
            className="btn btn-danger"
            onClick={() =>
              handleDeleteTeam(
                selectedTeam.id,
                selectedTeam.name
              )
            }
          >
            🗑️
          </button>
        )}
    </div>
  </div>

  {/* PLAYER CARD */}

  <div
    style={{
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 16,
    }}
  >
    <h3
      style={{
        marginTop: 0,
        marginBottom: 12,
      }}
    >
      🏏 Players
    </h3>

    {!selectedTeam && (
      <div
        style={{
          color: "#64748b",
        }}
      >
        Select a team to view players
      </div>
    )}

    {selectedTeam && (
      <>
        <div
          style={{
            maxHeight: 350,
            overflowY: "auto",
            border:
              "1px solid var(--border)",
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
          }}
        >
          {selectedTeam.players?.map(
            (player) => (
              <div
                key={player.id}
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom:
                    "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <span>
                  {player.name}
                </span>

                {permissions?.canDeletePlayer && (
                  <button
                    className="icon-btn danger"
                    title={`Delete ${player.name}`}
                    onClick={() =>
                      handleDeletePlayer(
                        player.id,
                        player.name
                      )
                    }
                  >
                    🗑️
                  </button>
                )}
              </div>
            )
          )}
        </div>

        <button
          className="btn"
          style={{
            width: "100%",
          }}
          onClick={() => {
            setPlayerLeagueId(
              activeLeagueId
            );

            setPlayerForm({
              names: "",
              leagueId:
                activeLeagueId,
              teamId:
                selectedTeamId,
            });

            setShowPlayerModal(true);
          }}
        >
          ➕ Add Players
        </button>
      </>
    )}
  </div>

  {/* CREATE MATCH CARD */}

  {canCreateMatch && (
    <div
      style={{
        padding: 18,
        borderRadius: 12,
        border:
          "1px solid #86efac",
        background:
          "rgba(34,197,94,0.10)",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        ✅ League setup complete
      </div>

      <div
        style={{
          marginBottom: 14,
        }}
      >
        You can now schedule matches
        from the Matches tab.
      </div>

      <button
        className="btn btn-primary"
        style={{
          width: "100%",
        }}
        onClick={() =>
          setActiveTab("matches")
        }
      >
        🏏 Create Match
      </button>
    </div>
  )}

</div>
</Card>
    <div className="grid-side">
        {(message || error) && (
          <Card title="ℹ️ Notifications" defaultCollapsed={false}>
            {message ? <p className="success">{message}</p> : null}
            {error ? <p className="error">{error}</p> : null}
          </Card>
        )}
    </div>
</div>    
)}
{activeTab === "Points" && (
  <Card title="🏆 Points" defaultCollapsed={false}>
         <div className="active-league-banner">
          Active League:{" "}
  <strong>
    {leagues.find((l) => Number(l.id) === Number(activeLeagueId))?.name || "No league selected"}
  </strong>
        </div>  
  {pointsTable.length === 0 ? (
    <p className="muted">No points table available yet.</p>
  ) : (
    <div className="table-scroll">
      <table className="score-table">
        <thead>
          <tr>
            <th>Team</th>
            <th>P</th>
            <th>W</th>
            <th>L</th>
            <th>T</th>
            <th>NR</th>
            <th>Pts</th>
            <th>NRR</th>
          </tr>
        </thead>

        <tbody>
          {pointsTable.map((row) => (
            <tr key={row.teamId}>
              <td>{row.teamName}</td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              <td>{row.tied}</td>
              <td>{row.noResult}</td>
              <td><strong>{row.points}</strong></td>
              <td>{row.nrr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</Card>
)}
{activeTab === "stats" && (
  <div className="stats-page">
    <Card title="📊 League Statistics" defaultCollapsed={false}>
      <div className="active-league-banner">
        Active League:{" "}
        <strong>
          {activeLeague?.name || "No league selected"}
        </strong>
      </div>

      <div className="stats-subtabs">
        <button
          type="button"
          className={statsSubTab === "BATTING" ? "active" : ""}
          onClick={() => setStatsSubTab("BATTING")}
        >
          🏏 Batting
        </button>

        <button
          type="button"
          className={statsSubTab === "BOWLING" ? "active" : ""}
          onClick={() => setStatsSubTab("BOWLING")}
        >
          🎯 Bowling
        </button>

        <button
          type="button"
          className={statsSubTab === "FIELDING" ? "active" : ""}
          onClick={() => setStatsSubTab("FIELDING")}
        >
          🧤 Fielding
        </button>

        <button
          type="button"
          className={statsSubTab === "RANKINGS" ? "active" : ""}
          onClick={() => setStatsSubTab("RANKINGS")}
        >
          🏆 Rankings
        </button>
      </div>
    </Card>

    {!activeLeagueId ? (
      <Card title="Select League">
        <p className="muted">Please select an active league first.</p>
      </Card>
    ) : !leagueStats ? (
      <Card title="Loading Stats">
        <p className="muted">Loading league statistics...</p>
      </Card>
    ) : (
      <>
        {statsSubTab === "BATTING" && (
          <Card title="🏏 Batting Records">
            {!leagueStats?.batting?.length ? (
              <p className="muted">No batting stats yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="score-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Team</th>
                      <th>M</th>
                      <th>Inn</th>
                      <th>Runs</th>
                      <th>Balls</th>
                      <th>Avg</th>
                      <th>SR</th>
                      <th>4s</th>
                      <th>6s</th>
                      <th>HS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {leagueStats.batting.map((row) => (
 <tr
  key={`bat-${inn.number}-${row.playerId}`}
>
                        <td>{row.playerName}</td>
                        <td>{row.teamName}</td>
                        <td>{row.matches}</td>
                        <td>{row.battingInnings}</td>
                        <td>{row.runs}</td>
                        <td>{row.balls}</td>
                        <td>{row.average}</td>
                        <td>{row.strikeRate}</td>
                        <td>{row.fours}</td>
                        <td>{row.sixes}</td>
                        <td>{row.highestScore}</td>
                        <td>{row.lastDismissal || "not out"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {statsSubTab === "BOWLING" && (
          <Card title="🎯 Bowling Records">
            {!leagueStats?.bowling?.length ? (
              <p className="muted">No bowling stats yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="score-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Team</th>
                      <th>M</th>
                      <th>Overs</th>
                      <th>Runs</th>
                      <th>Wkts</th>
                      <th>Eco</th>
                      <th>Avg</th>
                      <th>SR</th>
                      <th>Dots</th>
                      <th>Best</th>
                    </tr>
                  </thead>

                  <tbody>
                    {leagueStats.bowling.map((row) => (
  <tr
  key={`bat-${inn.number}-${row.playerId}`}
>
                        <td>{row.playerName}</td>
                        <td>{row.teamName}</td>
                        <td>{row.matches}</td>
                        <td>{row.bowlingOvers}</td>
                        <td>{row.bowlingRuns}</td>
                        <td>{row.wickets}</td>
                        <td>{row.economy}</td>
                        <td>{row.bowlingAverage}</td>
                        <td>{row.bowlingStrikeRate}</td>
                        <td>{row.dots}</td>
                        <td>{row.bestBowling}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {statsSubTab === "FIELDING" && (
          <Card title="🧤 Fielding Records">
            {!leagueStats?.fielding?.length ? (
              <p className="muted">No fielding stats yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="score-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Team</th>
                      <th>Catches</th>
                      <th>Run Outs</th>
                      <th>Stumpings</th>
                      <th>Assists</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {leagueStats.fielding.map((row) => (
   <tr
  key={`bat-${inn.number}-${row.playerId}`}
>
                        <td>{row.playerName}</td>
                        <td>{row.teamName}</td>
                        <td>{row.catches}</td>
                        <td>{row.runOuts}</td>
                        <td>{row.stumpings}</td>
                        <td>{row.assists}</td>
                        <td>
                          <strong>{row.fieldingTotal}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

{statsSubTab === "RANKINGS" && (
  <Card title="🏆 Rankings Hub">
    <div className="ranking-category-tabs">
      {Object.entries(rankingConfig).map(([key, config]) => (
        <button
          key={key}
          type="button"
          className={rankingType === key ? "active" : ""}
          onClick={() => setRankingType(key)}
        >
          <span>{config.icon}</span>
          {config.label}
        </button>
      ))}
    </div>

    {!selectedRanking.length ? (
      <p className="muted">No ranking data yet.</p>
    ) : (
      <>
        <div className="ranking-hero">
          {selectedRanking.slice(0, 3).map((row, index) => (
            <div
    key={`bowl-${inn.number}-${row.playerId}`}
              className={`ranking-podium podium-${index + 1}`}
            >
              <div className="podium-rank">
                #{index + 1}
              </div>

              <div className="podium-avatar">
                {currentRankingConfig.icon}
              </div>

              <strong>{row.playerName}</strong>

              <small>{row.teamName}</small>

              <div className="podium-value">
                {currentRankingConfig.value(row)}
              </div>
            </div>
          ))}
        </div>

        <div className="ranking-table-header">
          <h4>
            {currentRankingConfig.icon} {currentRankingConfig.title}
          </h4>
          <span>
            {selectedRanking.length} players
          </span>
        </div>

        <div className="table-scroll">
          <table className="score-table ranking-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Team</th>
                <th>Matches</th>
                <th>Value</th>
              </tr>
            </thead>

            <tbody>
              {selectedRanking.map((row, index) => (
  <tr
  key={`bat-${inn.number}-${row.playerId}`}
>
                  <td>
                    <strong>#{index + 1}</strong>
                  </td>
                  <td>{row.playerName}</td>
                  <td>{row.teamName}</td>
                  <td>{row.matches}</td>
                  <td>
                    <strong>
                      {currentRankingConfig.value(row)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}
  </Card>
)}
      </>
    )}
  </div>
)}
{activeTab === "permissions" && (
 <div className="scoring-layout">

      {/* MEMBER LIST */}
<Card title="👥 League Permissions">

  {!activeLeague && (
    <p>Select a league first.</p>
  )}

  {activeLeague && (
    <>
<div
  style={{
    padding: "16px",
    borderRadius: 12,
    border: "1px solid #93c5fd",
    marginBottom: 15,
  }}
>
  <h3
    style={{
      margin: 0,
      fontWeight: 700,
      fontSize: "1.1rem",
    }}
  >
    🔗 Invite Members to{" "}
    <span
      style={{
      }}
    >
      {activeLeague.name}
    </span>
  </h3>

  <div
    style={{
      marginTop: 8,
      fontSize: 14,
      lineHeight: 1.5,
    }}
  >
    Generate a registration link and share it
    with players, captains, scorers, and
    league administrators.
  </div>

  <div

  >
    <button
      className="btn"
      disabled={!activeLeague}
      onClick={() =>
        generateInviteLink(activeLeague.id)
      }
    >
      📋 Copy Registration Link
    </button>
  </div>
</div>
      <label>
        <strong>Member</strong>
      </label>
 <select
  value={selectedMember?.id || ""}
  onChange={(e) => {
    const member =
      activeLeague.members.find(
        (m) =>
          m.id === Number(e.target.value)
      );

    setSelectedMember(member);
    setShowPermissionModal(false);
  }}
>
        <option value="">
          Select Member
        </option>

        {activeLeague.members?.map(
          (member) => (
            <option
              key={member.id}
              value={member.id}
            >
              {member.user?.name} (
              {member.role})
            </option>
          )
        )}
      </select>
{!activeLeague?.members?.length && (
  <div
    style={{
      padding: 12,
      border: "1px solid #ddd",
      borderRadius: 8
    }}
  >
    No members found for this league.
  </div>
)}
{selectedMember && (
        <>
          <div
            style={{
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <h3>
              {selectedMember.user?.name}
            </h3>

            <div
              style={{
                color: "#666",
                marginBottom: 15,
              }}
            >
              {selectedMember.user?.email}
            </div>

            <label>
              <strong>Role</strong>
            </label>

            <select
              value={permissions.role || "VIEWER"}
              onChange={(e) =>
                updatePermission("role", e.target.value)
              }
              style={{
                width: "100%",
                marginTop: 8,
                marginBottom: 15,
              }}
            >
              <option value="OWNER">
                Owner
              </option>
              <option value="ADMIN">
                Admin
              </option>
              <option value="CAPTAIN">
                Captain
              </option>
              <option value="SCORER">
                Scorer
              </option>
              <option value="VIEWER">
                Viewer
              </option>
            </select>

            <button
              className="btn"
              onClick={() =>
                        //openPermissionEditor(selectedMember)
                        loadPermissions(selectedMember)
                      }
            >
              🔐 Edit Permissions
            </button>
          </div>
        </>
      )}
    </>
  )}

</Card>

 {/* MEMBER PERMISSIONS */}
{showPermissionModal && selectedMember && (
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
          checked={permissions.canViewDashboard ?? false}
          onChange={(e) =>
            updatePermission(
              "canViewDashboard",
              e.target.checked
            )
          }
        />
        <span>View Dashboard</span>
      </label>

      <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canViewMatches ?? false}
          onChange={(e) =>
            updatePermission(
              "canViewMatches",
              e.target.checked
            )
          }
        />
        <span>View Matches</span>
      </label>

      <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canViewScoring ?? false}
          onChange={(e) =>
            updatePermission(
              "canViewScoring",
              e.target.checked
            )
          }
        />
        <span>View Scoring</span>
      </label>

      <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canViewStats ?? false}
          onChange={(e) =>
            updatePermission(
              "canViewStats",
              e.target.checked
            )
          }
        />
        <span>View Stats</span>
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
          checked={permissions.canEditMatch ?? false}
          onChange={(e) =>
            updatePermission(
              "canEditMatch",
              e.target.checked
            )
          }
        />
        <span>Edit Match</span>
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
          checked={permissions.canEditScore ?? false}
          onChange={(e) =>
            updatePermission(
              "canEditScore",
              e.target.checked
            )
          }
        />
        <span>Edit Score</span>
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

      <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canSwapStrike ?? false}
          onChange={(e) =>
            updatePermission(
              "canSwapStrike",
              e.target.checked
            )
          }
        />
        <span>Swap Strike</span>
      </label>

      <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canRetirePlayer ?? false}
          onChange={(e) =>
            updatePermission(
              "canRetirePlayer",
              e.target.checked
            )
          }
        />
        <span>Retire Player</span>
      </label>

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canCreateTeam ?? false}
          onChange={(e) =>
            updatePermission(
              "canCreateTeam",
              e.target.checked
            )
          }
        />
        <span>Create Team</span>
      </label>

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canEditTeam ?? false}
          onChange={(e) =>
            updatePermission(
              "canEditTeam",
              e.target.checked
            )
          }
        />
        <span>Edit Team</span>
      </label>

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canDeleteTeam ?? false}
          onChange={(e) =>
            updatePermission(
              "canDeleteTeam",
              e.target.checked
            )
          }
        />
        <span>Delete Team</span>
      </label>

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canCreatePlayer ?? false}
          onChange={(e) =>
            updatePermission(
              "canCreatePlayer",
              e.target.checked
            )
          }
        />
        <span>Create Player</span>
      </label>

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canDeletePlayer ?? false}
          onChange={(e) =>
            updatePermission(
              "canDeletePlayer",
              e.target.checked
            )
          }
        />
        <span>Delete Player</span>
      </label>

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canEditPlayer ?? false}
          onChange={(e) =>
            updatePermission(
              "canEditPlayer",
              e.target.checked
            )
          }
        />
        <span>Edit Player</span>
      </label>    

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canCreateLeague ?? false}
          onChange={(e) =>
            updatePermission(
              "canCreateLeague",
              e.target.checked
            )
          }
        />
        <span>Create League</span>
      </label>  

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canEditLeague ?? false}
          onChange={(e) =>
            updatePermission(
              "canEditLeague",
              e.target.checked
            )
          }
        />
        <span>Edit League</span>
      </label>  

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canDeleteLeague ?? false}
          onChange={(e) =>
            updatePermission(
              "canDeleteLeague",
              e.target.checked
            )
          }
        />
        <span>Delete League</span>
      </label>  

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canEndMatch ?? false}
          onChange={(e) =>
            updatePermission(
              "canEndMatch",
              e.target.checked
            )
          }
        />
        <span>End Match</span>
      </label>  

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canAbandonMatch ?? false}
          onChange={(e) =>
            updatePermission(
              "canAbandonMatch",
              e.target.checked
            )
          }
        />
        <span>Abandon Match</span>
      </label>  

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canLockMatch ?? false}
          onChange={(e) =>
            updatePermission(
              "canLockMatch",
              e.target.checked
            )
          }
        />
        <span>Lock Match</span>
      </label>  

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canManageMembers ?? false}
          onChange={(e) =>
            updatePermission(
              "canManageMembers",
              e.target.checked
            )
          }
        />
        <span>Manage Members</span>
      </label>  

        <label className="permission-item">
        <input
          type="checkbox"
          checked={permissions.canManagePermissions ?? false}
          onChange={(e) =>
            updatePermission(
              "canManagePermissions",
              e.target.checked
            )
          }
        />
        <span>Manage Permissions</span>
      </label>  


    </div>

    <div className="permission-actions">
      <button
        className="btn"
        onClick={() => savePermissions(selectedMember)}
      >
        💾 Save Permissions
      </button>
    </div>

  </Card>
)}
    </div>
)}
{activeTab === "help" && (
  <Card title="❓ Cricket Studio Help Center">

    {/* Hero */}
    <div
      style={{

        padding: 24,
        borderRadius: 12,
        marginBottom: 24,
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 10,
        }}
      >
        🏏 Welcome to Cricket Studio
      </h2>

      <p
        style={{
          margin: 0,
          opacity: 0.95,
          fontSize: 16,
          lineHeight: 1.6,
        }}
      >
        Follow the steps below to create
        your league, add teams and players,
        schedule matches, and start live
        scoring.
      </p>
    </div>

    {/* Setup Journey */}
    <h3
      style={{
        marginBottom: 16,
      }}
    >
      🚀 Quick Start Guide
    </h3>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(260px,1fr))",
        gap: 16,
      }}
    >

      {/* Step 1 */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          boxShadow:
            "0 2px 8px rgba(15,23,42,0.06)",
        }}
      >
        <h3>🏆 Step 1</h3>

        <h4>Create League</h4>

        <p>
          Open the Management tab and click
          <strong> Create League</strong>.
        </p>

        <p>
          Every team, player, and match
          belongs to a league.
        </p>
      </div>

      {/* Step 2 */}
      <div
        style={{

          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          boxShadow:
            "0 2px 8px rgba(15,23,42,0.06)",
        }}
      >
        <h3>👥 Step 2</h3>

        <h4>Add Teams</h4>

        <p>
          Select a league and click
          <strong> Add Team</strong>.
        </p>

        <p>
          You need at least two teams before
          a match can be created.
        </p>
      </div>

      {/* Step 3 */}
      <div
        style={{

          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          boxShadow:
            "0 2px 8px rgba(15,23,42,0.06)",
        }}
      >
        <h3>🏏 Step 3</h3>

        <h4>Add Players</h4>

        <p>
          Click <strong>Add Players</strong>,
          select a team, and paste player
          names one per line.
        </p>

        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",

            fontFamily: "monospace",
            fontSize: 13,
          }}
        >
          Virat Kohli
          <br />
          Rohit Sharma
          <br />
          MS Dhoni
          <br />
          KL Rahul
        </div>
      </div>

      {/* Step 4 */}
      <div
        style={{

          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          boxShadow:
            "0 2px 8px rgba(15,23,42,0.06)",
        }}
      >
        <h3>📅 Step 4</h3>

        <h4>Create Match</h4>

        <p>
          Navigate to the Matches tab and
          click
          <strong> Create Match</strong>.
        </p>

        <p>
          Select Team A and Team B from the
          chosen league.
        </p>
      </div>

      {/* Step 5 */}
      <div
        style={{

          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          boxShadow:
            "0 2px 8px rgba(15,23,42,0.06)",
        }}
      >
        <h3>🎯 Step 5</h3>

        <h4>Start Live Scoring</h4>

        <p>
          After creating a match, click the
          match from the Matches tab.
        </p>

        <p>
          The selected match automatically
          becomes available in the Live
          Scoring tab.
        </p>
      </div>

    </div>

    {/* Pro Tips */}
    <div
      style={{
        marginTop: 28,

        border: "1px solid #93c5fd",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <h3
        style={{
          marginTop: 0,
        }}
      >
        💡 Pro Tips
      </h3>

      <ul
        style={{
          marginBottom: 0,
          lineHeight: 1.8,
        }}
      >
        <li>
          Create at least 2 teams before
          creating a match.
        </li>

        <li>
          Add players in bulk using the
          multi-line text area.
        </li>

        <li>
          Select a match before opening Live
          Scoring.
        </li>

        <li>
          Use League Permissions to assign
          scorers and captains.
        </li>
      </ul>
    </div>

    {/* Roles */}
    <div
      style={{
        marginTop: 24,

        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.06)",
      }}
    >
      <h3
        style={{
          marginTop: 0,
        }}
      >
        🔐 Roles & Permissions
      </h3>

      <p>
        League Owners and Admins can manage
        members and control access levels.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 12,
        }}
      >
        <span className="badge">OWNER</span>
        <span className="badge">ADMIN</span>
        <span className="badge">CAPTAIN</span>
        <span className="badge">SCORER</span>
        <span className="badge">ANALYST</span>
        <span className="badge">VIEWER</span>
      </div>
    </div>

    {/* FAQ */}
    <div
      style={{
        marginTop: 24,

        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
        boxShadow:
          "0 2px 8px rgba(15,23,42,0.06)",
      }}
    >
      <h3
        style={{
          marginTop: 0,
        }}
      >
        ❓ Frequently Asked Questions
      </h3>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <strong>
            Why don't I see my teams?
          </strong>
          <br />
          Re-select the league from the
          dropdown.
        </div>

        <div>
          <strong>
            Players are not saving?
          </strong>
          <br />
          Ensure a team is selected before
          clicking Save Players.
        </div>

        <div>
          <strong>
            Why can't I create a match?
          </strong>
          <br />
          The selected league must contain
          at least two teams.
        </div>

        <div>
          <strong>
            Live scoring page is empty?
          </strong>
          <br />
          Open the Matches tab and click a
          match first.
        </div>

        <div>
          <strong>
            Can I add players in bulk?
          </strong>
          <br />
          Yes. Paste one player name per
          line in the Add Players popup.
        </div>
      </div>
    </div>

  </Card>
)}
{activeTab === "about" && (
  <Card title="ℹ️ About Cricket Studio">

    {/* Hero */}
    <div
      style={{

        padding: 24,
        borderRadius: 12,
        marginBottom: 24,
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 10,
        }}
      >
        🏏 Cricket Studio
      </h2>

      <p
        style={{
          margin: 0,
          fontSize: 16,
          opacity: 0.9,
          lineHeight: 1.7,
        }}
      >
        A complete cricket league management
        and live scoring platform designed
        for clubs, leagues, academies, and
        tournament organizers.
      </p>
    </div>

    {/* Mission */}
    <div
      style={{

        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h3>🎯 Our Mission</h3>

      <p>
        Cricket Studio aims to simplify the
        management of cricket leagues,
        matches, teams, players, and scoring
        into a single easy-to-use platform.
      </p>

      <p>
        Whether you're organizing a local
        tournament or managing a full league,
        Cricket Studio helps you stay focused
        on the game.
      </p>
    </div>

    {/* Features */}
    <div
      style={{

        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h3>🚀 Key Features</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(250px,1fr))",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div>🏆 League Management</div>
        <div>👥 Team Management</div>
        <div>🏏 Player Management</div>
        <div>📅 Match Scheduling</div>
        <div>🎯 Live Ball-by-Ball Scoring</div>
        <div>🔐 Role Based Access</div>
        <div>📊 Statistics Dashboard</div>
        <div>📱 Mobile Friendly Design</div>
      </div>
    </div>

    {/* Current Version */}
    <div
      style={{

        border: "1px solid #93c5fd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h3>📦 Current Release</h3>

      <p>
        <strong>Version:</strong> MVP 1.0
      </p>

      <p>
        Current functionality includes:
      </p>

      <ul>
        <li>League creation</li>
        <li>Team creation</li>
        <li>Bulk player imports</li>
        <li>Match scheduling</li>
        <li>Live scoring</li>
        <li>League permissions</li>
      </ul>
    </div>

    {/* Roadmap */}
    <div
      style={{

        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h3>🛣️ Upcoming Features</h3>

      <ul
        style={{
          lineHeight: 2,
        }}
      >
        <li>📈 Advanced Match Statistics</li>
        <li>🏅 Player Rankings</li>
        <li>🏆 Tournament Brackets</li>
        <li>📊 Analytics Dashboard</li>
        <li>📱 Push Notifications</li>
        <li>🎥 Match Highlights</li>
        <li>☁️ Offline Sync Support</li>
        <li>📺 Public Scoreboards</li>
      </ul>
    </div>

    {/* Technology */}
    <div
      style={{

        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h3>⚙️ Built With</h3>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <span className="badge">
          Next.js
        </span>

        <span className="badge">
          React
        </span>

        <span className="badge">
          Prisma
        </span>

        <span className="badge">
          PostgreSQL
        </span>

        <span className="badge">
          NextAuth
        </span>
      </div>
    </div>

    {/* Footer */}
    <div
      style={{
        textAlign: "center",
        padding: 20,
        color: "#64748b",
        borderTop:
          "1px solid #e5e7eb",
      }}
    >
      <h3>🏏 Cricket Studio</h3>

      <p>
        Manage Leagues. Score Matches.
        Grow Cricket.
      </p>

      <p
        style={{
          fontSize: 13,
        }}
      >
        © 2026 Cricket Studio
      </p>
    </div>

  </Card>
)}
{showLeagueModal && (
  <div className="league-modal-backdrop">
    <div className="league-modal">

      <div className="league-modal-header">
        <div>
          <h3>🏆 Create League</h3>
          <p>
            Organize teams, fixtures and standings
            under a new league.
          </p>
        </div>

        <button
          className="icon-btn"
          onClick={() =>
            setShowLeagueModal(false)
          }
        >
          ✕
        </button>
      </div>

      <div className="league-modal-body">
        <label className="league-label">
          League Name
        </label>

        <input
          className="league-input"
          type="text"
          value={leagueName}
          onChange={(e) =>
            setLeagueName(e.target.value)
          }
          placeholder="e.g. Summer Premier League 2026"
          autoFocus
        />
      </div>

      <div className="league-modal-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() =>
            setShowLeagueModal(false)
          }
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn"
          disabled={!leagueName.trim()}
          onClick={handleCreateLeague}
        >
          ➕ Create League
        </button>
      </div>

    </div>
  </div>
)}
{showBowlerModal && (
  <div className="bowler-modal-backdrop">
    <div className="bowler-modal">

      <div className="bowler-modal-header">
        <div>
          <h3>🏏 Change Bowler</h3>
          <p>
            Select a different bowler for the next over
          </p>
        </div>

        <button
          className="icon-btn"
          onClick={handleCloseBowlerModal}
        >
          ✕
        </button>
      </div>

      <div className="bowler-warning">
        Same bowler cannot bowl consecutive overs.
      </div>

      <div className="bowler-list">
        {bowlingTeam?.players
          ?.filter(
            (player) =>
              String(player.id) !==
              String(
                pendingBallData?.bowlerId
              )
          )
          .map((player) => (
            <button
              key={player.id}
              className={`bowler-option ${
                String(ballForm.bowlerId) ===
                String(player.id)
                  ? "selected"
                  : ""
              }`}
              onClick={() =>
                setBallForm((prev) => ({
                  ...prev,
                  bowlerId: player.id
                }))
              }
            >
              <div className="bowler-avatar">
                🏏
              </div>

              <div>
                <div className="bowler-name">
                  {player.name}
                </div>
              </div>
            </button>
          ))}
      </div>

      <div className="bowler-modal-actions">
<button
  className="btn btn-outline"
  onClick={handleCloseBowlerModal}
>
  {mustChangeBowler ? "Select Bowler Required" : "Cancel"}
</button>

        <button
          className="btn"
          disabled={!ballForm.bowlerId}
          onClick={confirmBowlerChange}
        >
          Continue →
        </button>
      </div>

    </div>
  </div>
)}
{showAddTeam && (
  <div className="modal-backdrop">
    <div className="modal-card">

      <h3>🏏 Add Team</h3>

        <p
          style={{
            opacity: 0.75,
            marginBottom: 20
          }}
        >
          Create a new team in the selected league.
        </p>

      <form onSubmit={handleAddTeam}>

        <input
          type="text"
          placeholder="Team Name"
          value={teamForm.name}
          onChange={(e) =>
            setTeamForm((prev) => ({
              ...prev,
              name: e.target.value
            }))
          }
          required
        />

<div className="modal-actions">
  <button
    type="button"
    className="btn btn-outline"
    onClick={() =>
      setShowAddTeam(false)
    }
  >
    Cancel
  </button>

  <button
    type="submit"
    className="btn"
  >
    Save Team
  </button>
</div>

      </form>

    </div>
  </div>
)}
{showPlayerModal && (
  <div className="modal-backdrop">
    <div className="modal-card">

<h3>👥 Add Players</h3>

<p
  style={{
    opacity: 0.75,
    marginBottom: 20
  }}
>
  Add multiple players, one name per line.
</p>
      <form onSubmit={handleAddPlayers}>

        <label>
          League
        </label>

        <select
          value={playerLeagueId || ""}
          onChange={(e) => {
            const leagueId =
              Number(e.target.value);

            setPlayerLeagueId(
              leagueId
            );

            setPlayerForm((prev) => ({
              ...prev,
              leagueId,
              teamId: "",
            }));
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

        <label>
          Team
        </label>

<select
  value={selectedPlayerTeamId}
  onChange={(e) =>
    setSelectedPlayerTeamId(
      Number(e.target.value)
    )
  }
>
          <option value="">
            Select Team
          </option>

          {selectedPlayerLeague
            ?.teams?.map((team) => (
              <option
                key={team.id}
                value={team.id}
              >
                {team.name}
              </option>
            ))}
        </select>

        <label>
          Players
        </label>

<textarea
  rows={8}
  className="modal-textarea"
  placeholder={`Virat Kohli
Rohit Sharma
MS Dhoni
KL Rahul`}
  value={playerForm.names || ""}
  onChange={(e) =>
    setPlayerForm((prev) => ({
      ...prev,
      names: Number(e.target.value),
    }))
  }
  required
/>

<div className="modal-actions">
  <button
    type="button"
    className="btn btn-outline"
    onClick={() =>
      setShowPlayerModal(false)
    }
  >
    Cancel
  </button>

  <button
    type="submit"
    className="btn"
  >
    Save Players
  </button>
</div>

      </form>

    </div>
  </div>
)}
{showWicketModal && (
  <div className="modal-backdrop">
    <div className="modal-card">
      <h3>🏏 Wicket Details</h3>

      <p style={{ opacity: 0.75, marginBottom: 16 }}>
        Select dismissal type, fielder details, player out, and replacement batter.
      </p>

      <label>
        <span>Wicket Type</span>

        <select
          value={ballForm.wicketType || ""}
          onChange={(e) => {
            const wicketType = e.target.value;

            setBallForm((prev) => ({
              ...prev,
              wicketType,
              dismissedPlayerId:
                wicketType === "RUN_OUT"
                  ? ""
                  : prev.strikerId,
              fielderId: "",
              assistantFielderId: "",
              wicketNote: ""
            }));

            if (wicketType !== "RUN_OUT") {
              setRunOutRuns(null);
            }
          }}
        >
          {WICKET_TYPES.filter((x) => x !== "NONE").map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {ballForm.wicketType === "RUN_OUT" && (
        <div className="runout-panel">
          <h4>🏏 RUN OUT</h4>

          <p className="muted">
            How many runs were completed before the run out?
          </p>

          <div className="runout-runs-grid">
            {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
              <button
                key={runs}
                type="button"
                className={`btn ${
                  runOutRuns === runs ? "btn-selected" : "btn-outline"
                }`}
                onClick={() => {
                  setRunOutRuns(runs);

                  setBallForm((prev) => ({
                    ...prev,
                    runsOffBat: runs,
                    extras: 0,
                    extraType: "NONE"
                  }));
                }}
              >
                {runs}
              </button>
            ))}
          </div>

          {runOutRuns !== null && (
            <div className="runout-summary">
              <strong>
                Selected: Run Out + {runOutRuns}{" "}
                {runOutRuns === 1 ? "run" : "runs"}
              </strong>

              <div>
                {runOutRuns % 2 === 1
                  ? "ℹ️ Batters crossed. Strike will rotate. If not, click SWAP after this action."
                  : "ℹ️ Strike remains unchanged. If not, click SWAP after this action."}
              </div>
            </div>
          )}

          {runOutRuns !== null && (
            <label style={{ marginTop: 12 }}>
              <span>Who is out?</span>

              <select
                value={ballForm.dismissedPlayerId || ""}
                onChange={(e) =>
                  setBallForm((prev) => ({
                    ...prev,
                    dismissedPlayerId: e.target.value
                  }))
                }
              >
                <option value="">Select player out</option>

                <option value={ballForm.strikerId}>
                  Striker ({scoreboard?.currentState?.strikerName})
                </option>

                <option value={ballForm.nonStrikerId}>
                  Non-Striker ({scoreboard?.currentState?.nonStrikerName})
                </option>
              </select>
            </label>
          )}
        </div>
      )}

      {["CAUGHT", "STUMPED", "RUN_OUT"].includes(ballForm.wicketType) && (
        <label style={{ marginTop: 12 }}>
          <span>
            {ballForm.wicketType === "CAUGHT"
              ? "Caught By"
              : ballForm.wicketType === "STUMPED"
                ? "Stumped By / Wicketkeeper"
                : "Run Out By"}
          </span>

          <select
            value={ballForm.fielderId || ""}
            onChange={(e) =>
              setBallForm((prev) => ({
                ...prev,
                fielderId: e.target.value
              }))
            }
          >
            <option value="">Select fielder</option>

            {(bowlingTeam?.players || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {ballForm.wicketType === "RUN_OUT" && (
        <label style={{ marginTop: 12 }}>
          <span>Assisted By / Stumps Broken By</span>

          <select
            value={ballForm.assistantFielderId || ""}
            onChange={(e) =>
              setBallForm((prev) => ({
                ...prev,
                assistantFielderId: e.target.value
              }))
            }
          >
            <option value="">Optional</option>

            {(bowlingTeam?.players || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {["OTHER", "RETIRED_OUT"].includes(ballForm.wicketType) && (
        <label style={{ marginTop: 12 }}>
          <span>Wicket Note</span>

          <input
            type="text"
            value={ballForm.wicketNote || ""}
            onChange={(e) =>
              setBallForm((prev) => ({
                ...prev,
                wicketNote: e.target.value
              }))
            }
            placeholder="Example: obstructing the field"
          />
        </label>
      )}

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
          <option value="">Select New Batter</option>

          {availableNewBatters.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setShowWicketModal(false);
            setRunOutRuns(null);

            setBallForm((prev) => ({
              ...prev,
              isWicket: false,
              wicketType: "NONE",
              dismissedPlayerId: "",
              newBatterId: "",
              runsOffBat: 0,
              extras: 0,
              fielderId: "",
              assistantFielderId: "",
              wicketNote: ""
            }));
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => confirmWicket()}
        >
          Confirm Wicket
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

      <p style={{ opacity: 0.75 }}>
        Select total extra runs
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(60px,1fr))",
          gap: 10,
          marginTop: 16
        }}
      >
        {(
          selectedExtraType === "WIDE"
            ? ["WD", "WD+1", "WD+2", "WD+3", "WD+4", "WD+5", "WD+6"]
            : selectedExtraType === "NOBALL"
              ? ["NB", "NB+1", "NB+2", "NB+3", "NB+4", "NB+5", "NB+6"]
              : [1, 2, 3, 4, 5, 6, 7]
        ).map((runs) => (
          <button
            key={runs}
            type="button"
            className="btn"
            onClick={() => confirmExtra(runs)}
          >
            {runs}
          </button>
        ))}
      </div>

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setShowExtrasModal(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
{showPlayerModal && (
  <div className="modal-backdrop">
    <div className="modal-card">

      <h3>👥 Add Players</h3>

      <form onSubmit={handleBulkAddPlayers}>

        <label>
          <span>League</span>

          <input
            value={activeLeague?.name || ""}
            disabled
          />
        </label>

        <label>
          <span>Team</span>

          <input
            value={selectedTeam?.name || ""}
            disabled
          />
        </label>

        <label>
          <span>Players</span>

<textarea
  rows={10}
  placeholder={`Virat Kohli
Rohit Sharma
MS Dhoni
KL Rahul`}
  value={playerForm.names || ""}
  onChange={(e) =>
    setPlayerForm((prev) => ({
      ...prev,
      names: e.target.value,
    }))
  }
  required
/>
        </label>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            type="submit"
            className="btn"
          >
            Save Players
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() =>
              setShowPlayerModal(false)
            }
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  </div>
)}
{showStartMatchModal && (
  <div className="modal-backdrop">
    <div className="modal-card">
      <h3>▶ Start Match</h3>

      <p className="muted">
        Select batting first team before starting the match.
      </p>

      <label>
        <span>Batting First</span>
        <select
          value={startMatchData.battingFirstTeamId || ""}
          onChange={(e) =>
            setStartMatchData((prev) => ({
              ...prev,
              battingFirstTeamId: e.target.value
            }))
          }
          required
        >
          <option value="">Select batting first team</option>

          {teams
            .filter((t) =>
              [
                String(selectedMatch?.teamAId),
                String(selectedMatch?.teamBId)
              ].includes(String(t.id))
            )
            .map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
        </select>
      </label>

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setShowStartMatchModal(false)}
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn"
          onClick={confirmStartMatch}
        >
          Start Match
        </button>
      </div>
    </div>
  </div>
)}
{showRetiredHurtModal && (
  <div className="modal-backdrop">
    <div className="modal-card">
<h3>🚑 Retired Hurt</h3>

<p
  style={{
    opacity: 0.75,
    marginBottom: 20
  }}
>
  Choose the retiring batter and select a replacement.
</p>

      <label>
        Who is retiring?
      </label>

<div   style={{
    display: "grid",
    gap: 10,
    marginBottom: 20
  }} className="retired-hurt-options">
<button
  type="button"
  className={`btn ${
    retiredPlayerType === "STRIKER"
      ? "btn-selected"
      : "btn-outline"
  }`}
  onClick={() => {
    setRetiredPlayerType("STRIKER");
    setReplacementPlayerId("");
    setShowRetiredHurtModal(true);
  }}
>
  ✅ Retire Striker (
  {scoreboard?.currentState?.strikerName}
  )
</button>

<button
  type="button"
  className={`btn ${
    retiredPlayerType === "NON_STRIKER"
      ? "btn-selected"
      : "btn-outline"
  }`}
  onClick={() => {
    setRetiredPlayerType("NON_STRIKER");
    setReplacementPlayerId("");
    setShowRetiredHurtModal(true);
  }}
>
  ✅ Retire Non-Striker (
  {scoreboard?.currentState?.nonStrikerName}
  )
</button>
</div>

      <label>
        Replacement Batter
      </label>

      <select
        value={replacementPlayerId}
        onChange={(e) =>
          setReplacementPlayerId(
            e.target.value
          )
        }
      >
        <option value="">
          Select Batter
        </option>

        {battingTeam?.players
          ?.filter(
            (p) =>
              p.id !==
                Number(
                  ballForm.strikerId
                ) &&
              p.id !==
                Number(
                  ballForm.nonStrikerId
                )
          )
          .map((player) => (
            <option
              key={player.id}
              value={player.id}
            >
              {player.name}
            </option>
          ))}
      </select>

<div className="modal-actions">
  <button
    className="btn btn-outline"
    onClick={() =>
      setShowRetiredHurtModal(false)
    }
  >
    Cancel
  </button>

  <button
    className="btn"
    onClick={handleRetiredHurtSubmit}
  >
    Confirm Replacement
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