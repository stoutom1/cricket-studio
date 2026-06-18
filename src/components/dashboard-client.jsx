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
const [aiAnalysis, setAiAnalysis] = useState("");
const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);
const [showMatchCreatedModal, setShowMatchCreatedModal] = useState(false);
const [createdMatchInfo, setCreatedMatchInfo] = useState(null);
const [contextFilters, setContextFilters] = useState({teamIds: [],matchIds: [],playerNames: [],statuses: [],roles: [],seriesIds: [],years: []});
const [openFilter, setOpenFilter] = useState(null);
const [filterSearch, setFilterSearch] = useState("");
const [filterCategory, setFilterCategory] = useState("teams");
const [seriesList, setSeriesList] = useState([]);
const [selectedSeriesId, setSelectedSeriesId] = useState("");
const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
const [seriesForm, setSeriesForm] = useState({name: "",year: new Date().getFullYear(),description: ""});
const [showSeriesModal, setShowSeriesModal] = useState(false);
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
useEffect(() => {
  setContextFilters({
    teamIds: [],
    matchIds: [],
    playerNames: [],
    statuses: [],
    roles: [],
    seriesIds: [],
    years: []
  });

  setOpenFilter(null);
}, [activeLeagueId]);
useEffect(() => {
  loadSeries();
}, [activeLeagueId]);

const selectedSeries = seriesList.find(
  (s) => Number(s.id) === Number(selectedSeriesId)
);

async function loadAiAnalysis(matchId) {
  try {
    setAiAnalysisLoading(true);

    const data = await api(`/api/matches/${matchId}/ai-analysis`);

    setAiAnalysis(data.analysis || "");
    setShowAiAnalysisModal(true);
  } catch (err) {
    setError(err.message);
  } finally {
    setAiAnalysisLoading(false);
  }
}
async function loadSeries() {
  if (!activeLeagueId) return;

  const data = await api(`/api/series?leagueId=${activeLeagueId}`);

  setSeriesList(data || []);
}
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
      name: leagueName,
      visibility: leagueForm.visibility || "PRIVATE"
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
    label: "Top Performers",
    icon: "⭐",
    title: "Top Performers",
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
 //alert(JSON.stringify(playerForm));


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


 /* const availableNewBatters = useMemo(() => {
    if (!battingTeam) return [];
    return battingTeam.players.filter(
      (p) =>
        String(p.id) !== String(ballForm.strikerId) &&
        String(p.id) !== String(ballForm.nonStrikerId)
    );
  }, [battingTeam, ballForm.strikerId, ballForm.nonStrikerId]);
*/
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
      : null,
  seriesId: matchForm.seriesId || selectedSeriesId || null,
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
      const teamA = teams.find(
          (t) => Number(t.id) === Number(match.teamAId)
        );

        const teamB = teams.find(
          (t) => Number(t.id) === Number(match.teamBId)
        );

        setCreatedMatchInfo({
          ...match,
          teamAName: teamA?.name,
          teamBName: teamB?.name,
        });

      setShowMatchCreatedModal(true);
      //setMatchesSubTab("SCHEDULED");

      await Promise.all([
        loadMatches(),
        loadSelectedMatch(created.id)
      ]);
      //await loadMatches();
      //setSelectedMatchId(String(match.id));
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

const updatedBoard = await api(`/api/scoreboard/${selectedMatchId}`);

const updatedActiveInnings =
  updatedBoard?.innings?.[
    Number(updatedBoard?.currentInnings || data.inningsNo) - 1
  ];

const updatedMaxLegalBalls =
  Number(updatedBoard?.match?.oversPerInnings || 0) * 6;

const updatedIsSecondInnings =
  Number(updatedBoard?.currentInnings || data.inningsNo) === 2;

const updatedIsFinalBallBowled =
  updatedIsSecondInnings &&
  updatedMaxLegalBalls > 0 &&
  Number(updatedActiveInnings?.legalBalls || 0) >= updatedMaxLegalBalls;

const updatedIsChaseComplete =
  updatedIsSecondInnings &&
  updatedBoard?.summary?.target &&
  Number(updatedActiveInnings?.runs || 0) >= Number(updatedBoard.summary.target);

if (updatedIsFinalBallBowled || updatedIsChaseComplete) {
  setShowBowlerModal(false);
  setMustChangeBowler(false);
  setPendingBallData(null);
  setMessage(
    "🏁 Match ended. Review the scorecard, then click Lock Match to preserve the final scoreboard."
  );
  return;
}

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
const availableNewBatters = useMemo(() => {
  if (!battingTeam?.players?.length) return [];

  const balls =
    matchDetail?.balls ||
    scoreboard?.balls ||
    scoreboard?.match?.balls ||
    [];

  const legitimatelyOutIds = new Set(
    balls
      .filter((ball) => {
        const dismissedPlayerId = Number(ball.dismissedPlayerId);
        if (!dismissedPlayerId) return false;

        const wicketType = String(ball.wicketType || "")
          .trim()
          .toUpperCase();

        return (
          Boolean(ball.isWicket) &&
          wicketType !== "RETIRED_HURT"
        );
      })
      .map((ball) => Number(ball.dismissedPlayerId))
  );

  return battingTeam.players.filter((player) => {
    const playerId = Number(player.id);

    if (playerId === Number(ballForm.strikerId)) return false;
    if (playerId === Number(ballForm.nonStrikerId)) return false;
    if (legitimatelyOutIds.has(playerId)) return false;

    return true;
  });
}, [
  battingTeam,
  ballForm.strikerId,
  ballForm.nonStrikerId,
  matchDetail,
  scoreboard,
]);

/*console.log("NEW BATTER DEBUG", {
  ballsCount: matchDetail?.balls?.length,
  dismissed: matchDetail?.balls
    ?.filter((b) => b.dismissedPlayerId)
    ?.map((b) => ({
      dismissedPlayerId: b.dismissedPlayerId,
      wicketType: b.wicketType,
      isWicket: b.isWicket,
    })),
  availableNewBatters: availableNewBatters.map((p) => p.name),
});
*/
const availableReplacementBatters = useMemo(() => {
  if (!battingTeam?.players?.length) return [];

  const balls =
    matchDetail?.balls ||
    scoreboard?.balls ||
    scoreboard?.match?.balls ||
    [];

  const legitimatelyOutIds = new Set(
    balls
      .filter((ball) => {
        if (!ball.dismissedPlayerId) return false;

        const wicketType = String(ball.wicketType || "")
          .trim()
          .toUpperCase();

        return Boolean(ball.isWicket) && wicketType !== "RETIRED_HURT";
      })
      .map((ball) => Number(ball.dismissedPlayerId))
  );

  return battingTeam.players.filter((player) => {
    const playerId = Number(player.id);

    if (playerId === Number(ballForm.strikerId)) return false;
    if (playerId === Number(ballForm.nonStrikerId)) return false;
    if (legitimatelyOutIds.has(playerId)) return false;

    return true;
  });
}, [
  battingTeam,
  ballForm.strikerId,
  ballForm.nonStrikerId,
  matchDetail,
  scoreboard,
]);
function getNextAvailableBatter(players, strikerId, nonStrikerId, balls = []) {
  if (!players?.length) return null;

  const legitimatelyOutIds = new Set(
    balls
      .filter((ball) => {
        if (!ball.dismissedPlayerId) return false;

        const wicketType = String(ball.wicketType || "").toUpperCase();

        return (
          ball.isWicket &&
          wicketType !== "RETIRED_HURT"
        );
      })
      .map((ball) => Number(ball.dismissedPlayerId))
  );

  return players.find((player) => {
    const playerId = Number(player.id);

    return (
      playerId !== Number(strikerId) &&
      playerId !== Number(nonStrikerId) &&
      !legitimatelyOutIds.has(playerId)
    );
  });
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
const normalizedMatchStatus = String(
  scoreboard?.match?.status || ""
)
  .trim()
  .replace(/[\s-]+/g, "_")
  .toUpperCase();

const canShowAiAnalysis =
  normalizedMatchStatus === "COMPLETED" ||
  normalizedMatchStatus === "COMPLETED_LOCKED";

const activeInnings = useMemo(() => {
  const innings = scoreboard?.innings || [];

  if (!innings.length) return null;

  const currentInningsNo =
    Number(scoreboard?.currentInnings) ||
    Number(ballForm?.inningsNo) ||
    1;

  return innings[currentInningsNo - 1] || innings[0];
}, [scoreboard, ballForm?.inningsNo]);

const maxLegalBalls =
  Number(matchDetail?.oversPerInnings || scoreboard?.match?.oversPerInnings || 0) * 6;

const activeInningsLegalBalls =
  Number(activeInnings?.legalBalls || 0);

const isSecondInnings =
  Number(scoreboard?.currentInnings || ballForm?.inningsNo) === 2;

const isFinalBallBowled =
  isSecondInnings &&
  maxLegalBalls > 0 &&
  activeInningsLegalBalls >= maxLegalBalls;

const isChaseComplete =
  isSecondInnings &&
  scoreboard?.summary?.target &&
  Number(activeInnings?.runs || 0) >= Number(scoreboard.summary.target);

const isMatchReadyToLock =
  isFinalBallBowled ||
  isChaseComplete ||
  ["COMPLETED", "COMPLETED_LOCKED", "ABANDONED"].includes(
    String(scoreboard?.match?.status || "").toUpperCase()
  );



const canCreateMatch =
  activeLeague?.teams?.length >= 2;

const selectedMatch = matches.find(
  (m) => String(m.id) === String(selectedMatchId)
);
const selectedMatchStatus = String(selectedMatch?.status || "")
  .trim()
  .replace(/[\s-]+/g, "_")
  .toUpperCase();

const isSelectedMatchCompleted =
  //selectedMatchStatus === "COMPLETED" ||
  selectedMatchStatus === "COMPLETED_LOCKED";

const effectiveScoringSubTab =
  isSelectedMatchCompleted && scoringSubTab === "ADVANCED"
    ? "SCOREBOARD"
    : scoringSubTab;
/*useEffect(() => {
  const status = String(selectedMatch?.status || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  const isCompleted =
    status === "COMPLETED" ||
    status === "COMPLETED_LOCKED";

  if (isCompleted && scoringSubTab === "ADVANCED") {
    setScoringSubTab("SCOREBOARD");
  }
}, [selectedMatch, scoringSubTab]); 
*/
/*const isMobile =
  typeof window !== "undefined" &&
  window.innerWidth < 768;
*/
function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function toggleFilterValue(type, value) {
  setContextFilters((prev) => {
    const exists = prev[type].includes(value);

    return {
      ...prev,
      [type]: exists
        ? prev[type].filter((v) => v !== value)
        : [...prev[type], value]
    };
  });
}

async function handleDeleteSeries(seriesId, seriesName) {
  const ok = window.confirm(
    `Delete series "${seriesName}"? This cannot be undone.`
  );

  if (!ok) return;

  try {
    await api(`/api/series/${seriesId}`, {
      method: "DELETE"
    });

    setSelectedSeriesId("");

    setContextFilters((prev) => ({
      ...prev,
      seriesIds: [],
      years: []
    }));

    await loadSeries();

    setMessage(`Series "${seriesName}" deleted successfully.`);
  } catch (err) {
    setError(err.message || "Failed to delete series.");
  }
}

function clearContextFilters() {
  setContextFilters({
    teamIds: [],
    matchIds: [],
    playerNames: [],
    statuses: [],
    roles: [],
    seriesIds: [],
    years: []
  });
}
function matchPassesContextFilters(match) {
  const teamIds = (contextFilters.teamIds || []).map(Number);
  const matchIds = (contextFilters.matchIds || []).map(Number);
  const statuses = (contextFilters.statuses || []).map(normalizeStatus);
  const seriesIds = (contextFilters.seriesIds || []).map(Number);
  const years = (contextFilters.years || []).map(Number);

  if (
    teamIds.length &&
    !teamIds.includes(Number(match.teamAId)) &&
    !teamIds.includes(Number(match.teamBId))
  ) {
    return false;
  }

  if (matchIds.length && !matchIds.includes(Number(match.id))) {
    return false;
  }

  if (statuses.length && !statuses.includes(normalizeStatus(match.status))) {
    return false;
  }

  if (seriesIds.length && !seriesIds.includes(Number(match.seriesId))) {
    return false;
  }

  if (years.length) {
    const matchYear =
      Number(match.year) ||
      Number(match.seriesYear) ||
      new Date(match.createdAt).getFullYear();

    if (!years.includes(matchYear)) {
      return false;
    }
  }

  return true;
}
const isSurpriseLeague =
  String(activeLeague?.name || "")
    .trim()
    .toLowerCase() === "surprise cricket league";

const availablePlayersForFilter = (() => {
  const map = new Map();

  const selectedTeamIds = contextFilters.teamIds.map(Number);

  const activeLeagueTeams = (teams || []).filter((team) => {
    const isInActiveLeague =
      Number(team.leagueId) === Number(activeLeagueId);

    if (!isInActiveLeague) return false;

    if (!isSurpriseLeague && selectedTeamIds.length) {
      return selectedTeamIds.includes(Number(team.id));
    }

    return true;
  });

  activeLeagueTeams.forEach((team) => {
    (team.players || []).forEach((player) => {
      const normalizedName = String(player.name || "")
        .trim()
        .toLowerCase();

      if (!normalizedName) return;

      if (!map.has(normalizedName)) {
        map.set(normalizedName, {
          name: player.name.trim(),
          normalizedName,
          teams: new Set()
        });
      }

      map.get(normalizedName).teams.add(team.name);
    });
  });

  return [...map.values()]
    .map((player) => ({
      ...player,
      teamNames: [...player.teams].sort()
    }))
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
})();

function playerPassesContextFilters(row) {
  const teamIds = contextFilters.teamIds.map(Number);
  const playerNames = contextFilters.playerNames || [];

  if (teamIds.length) {
    const selectedTeamNames = teams
      .filter((t) => teamIds.includes(Number(t.id)))
      .map((t) =>
        String(t.name || "")
          .trim()
          .toLowerCase()
      );

    const rowTeamId = Number(row.teamId);

    const rowTeamName = String(row.teamName || "")
      .trim()
      .toLowerCase();

    const rowTeamNames = String(
      row.teamNames ||
        row.teams ||
        row.teamName ||
        ""
    )
      .split(/[,&/|]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);

    const matchesTeamId = teamIds.includes(rowTeamId);

    const matchesTeamName =
      selectedTeamNames.includes(rowTeamName) ||
      rowTeamNames.some((name) =>
        selectedTeamNames.includes(name)
      );

    if (!matchesTeamId && !matchesTeamName) {
      return false;
    }
  }

  if (playerNames.length) {
    const rowName = String(row.playerName || "")
      .trim()
      .toLowerCase();

    if (!playerNames.includes(rowName)) {
      return false;
    }
  }

  return true;
}

const rankedSelectedRanking =
  (selectedRanking || []).map((row, index) => ({
    ...row,
    actualRank: index + 1
  }));

const filteredSelectedRanking =
  rankedSelectedRanking.filter(playerPassesContextFilters);

function pointsPassesContextFilters(row) {
  const teamIds = contextFilters.teamIds.map(Number);

  if (
    teamIds.length &&
    !teamIds.includes(Number(row.teamId))
  ) {
    return false;
  }

  return true;
}
const availablePlayers = (() => {
  const map = new Map();

  const addPlayer = (row) => {
    if (!row?.playerId) return;

    map.set(Number(row.playerId), {
      id: Number(row.playerId),
      name: row.playerName,
      teamId: Number(row.teamId),
      teamName: row.teamName
    });
  };

  (leagueStats?.batting || []).forEach(addPlayer);
  (leagueStats?.bowling || []).forEach(addPlayer);
  (leagueStats?.fielding || []).forEach(addPlayer);

  return [...map.values()].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
})();

const filteredActiveMatches =
  activeMatches.filter(matchPassesContextFilters);

const filteredScheduledMatches =
  scheduledMatches.filter(matchPassesContextFilters);

const filteredCompletedMatches =
  completedMatches.filter(matchPassesContextFilters);

const rankedBatting =
  (leagueStats?.batting || []).map((row, index) => ({
    ...row,
    actualRank: index + 1
  }));

const rankedBowling =
  (leagueStats?.bowling || []).map((row, index) => ({
    ...row,
    actualRank: index + 1
  }));

const rankedFielding =
  (leagueStats?.fielding || []).map((row, index) => ({
    ...row,
    actualRank: index + 1
  }));

const filteredBatting =
  rankedBatting.filter(playerPassesContextFilters);

const filteredBowling =
  rankedBowling.filter(playerPassesContextFilters);

const filteredFielding =
  rankedFielding.filter(playerPassesContextFilters);

const filteredPointsTable =
  pointsTable?.filter(pointsPassesContextFilters) || [];

const uniqueMatchesForFilter = (() => {
  const map = new Map();

  (matches || []).forEach((match) => {
    if (!match?.id) return;
    map.set(Number(match.id), match);
  });

  return [...map.values()];
})();  
const selectedYears = (contextFilters.years || []).map(Number);
const selectedSeriesIds = (contextFilters.seriesIds || []).map(Number);
const selectedTeamIds = (contextFilters.teamIds || []).map(Number);

const filteredSeriesForContextLens = (seriesList || [])
  .filter((series) => {
    if (
      selectedYears.length &&
      !selectedYears.includes(Number(series.year))
    ) {
      return false;
    }

    return true;
  });

const filteredMatchesForContextLens = uniqueMatchesForFilter
  .filter((match) => {
    const selectedYears = (contextFilters.years || []).map(Number);
    const selectedSeriesIds = (contextFilters.seriesIds || []).map(Number);
    const selectedTeamIds = (contextFilters.teamIds || []).map(Number);
    const selectedStatuses = (contextFilters.statuses || []).map(normalizeStatus);

    if (
      selectedYears.length &&
      !selectedYears.includes(
        Number(match.seriesYear) ||
          new Date(match.createdAt).getFullYear()
      )
    ) {
      return false;
    }

    if (
      selectedSeriesIds.length &&
      !selectedSeriesIds.includes(Number(match.seriesId))
    ) {
      return false;
    }

    if (
      selectedTeamIds.length &&
      !selectedTeamIds.includes(Number(match.teamAId)) &&
      !selectedTeamIds.includes(Number(match.teamBId))
    ) {
      return false;
    }

    if (
      selectedStatuses.length &&
      !selectedStatuses.includes(normalizeStatus(match.status))
    ) {
      return false;
    }

    return true;
  });
  
function ContextLens() {
  const totalFilters =
    (contextFilters.teamIds?.length || 0) +
    (contextFilters.matchIds?.length || 0) +
    (contextFilters.playerNames?.length || 0) +
    (contextFilters.statuses?.length || 0) +
    (contextFilters.roles?.length || 0) +
    (contextFilters.seriesIds?.length || 0) +
    (contextFilters.years?.length || 0);

  return (
    <div className="smart-filter-pill">
      <button
        type="button"
        className="smart-filter-main"
        onClick={() => setOpenFilter("filterCenter")}
      >
        <span className="smart-filter-icon">🔎</span>

        <span className="smart-filter-text">
          <strong>Smart Filters</strong>
          <small>
            {totalFilters
              ? `${totalFilters} active`
              : "All records"}
          </small>
        </span>

        <span className="smart-filter-action">
          Open
        </span>
      </button>

      {totalFilters > 0 && (
        <button
          type="button"
          className="smart-filter-reset"
          onClick={() => {
            clearContextFilters();
            setFilterSearch("");
            setFilterCategory("teams");
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}

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
{!isSelectedMatchCompleted && (
  <button
    type="button"
    className={effectiveScoringSubTab === "ADVANCED" ? "active" : ""}
    onClick={() => setScoringSubTab("ADVANCED")}
  >
    <span>🎯</span>
    <strong>Scoring</strong>
  </button>
)}
          <button
            type="button"
            className={effectiveScoringSubTab === "SCOREBOARD" ? "active" : ""}
            onClick={() => setScoringSubTab("SCOREBOARD")}
          >
            <span>🏏</span>
            <strong>Scoreboard</strong>
          </button>

          <button
  type="button"
  className={effectiveScoringSubTab === "COMMENTARY" ? "active" : ""}
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
{selectedMatchId && effectiveScoringSubTab === "SCOREBOARD" && (
  <Card title="🏟️ Professional Scoreboard" defaultCollapsed={false}>
    {!scoreboard ? (
      <p className="muted">Select a match to view scoreboard.</p>
    ) : (
            <>
              {scoreboard?.summary?.statusText && (
          <div className="single-line-scoreboard">
            <span className="status-chip">
              📌 {scoreboard.summary.statusText}
            </span>
          </div>
        )}
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

        {scoreboard.currentState && !(
  selectedMatch &&
  ["COMPLETED", "COMPLETED_LOCKED"].includes(
    String(selectedMatch.status || "").toUpperCase()
  )
) &&(
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
                            <td>{row.dismissal !== "not out"? row.dismissal: "not out"}</td>
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
                        {w.score}
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
      </div>
      </>
    )}
  </Card>
)}
{selectedMatchId && effectiveScoringSubTab === "COMMENTARY" && (
  <Card title="🎙️ Live Match Commentary" defaultCollapsed={false}>
    {!scoreboard ? (
      <p className="muted">Select a match to view commentary.</p>
    ) : !scoreboard.commentary?.length ? (
      <div className="commentary-empty">
        📝 No commentary yet. Start scoring to build the live timeline.
      </div>
    ) : (
      <>
        {scoreboard?.summary?.statusText && (
          <div className="single-line-scoreboard">
            <span className="status-chip">
              📌 {scoreboard.summary.statusText}
            </span>
          </div>
        )}

        <div className="commentary-feed pretty-commentary">
          {scoreboard.commentary.map((section, sectionIndex) => (
            <div
              key={`innings-${section.inningsNo}-${sectionIndex}`}
              className="commentary-innings-section"
            >
              <div className="commentary-innings-title">
                <span>🏏</span>
                <strong>{section.title}</strong>
              </div>

              {section.items.map((item, itemIndex) => (
                <div
                  key={`commentary-${section.inningsNo}-${item.id ?? itemIndex}`}
                  className={`commentary-item pretty-commentary-item ${
                    item.type === "OVER_SUMMARY" ? "over-summary-item" : ""
                  }`}
                >
                  <div
                    className={`commentary-ball ${
                      item.badgeClass || ""
                    }`}
                  >
                    {item.badge || item.over}
                  </div>

                  <div className="commentary-body">
                    <div className="commentary-main">
                      {item.text}
                    </div>



                    {item.type === "BALL" && item.badge !== "END" &&(
                      <div className="commentary-mini-score">
                        <span>{item.score}</span>
                        <span>🏏 {item.strikerSummary}</span>
                        <span>🏃 {item.nonStrikerSummary}</span>
                        <span>🎯 {item.bowlerSummary}</span>
                      </div>
                    )}

                    {item.type === "OVER_SUMMARY" && (
                      <div className="commentary-over-summary">
                        <strong>{item.score}</strong>
                        <span>🎯 {item.bowlerSummary}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    )}
  </Card>
)}
{!isSelectedMatchCompleted && scoringSubTab === "ADVANCED" &&(          
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
  {isMatchReadyToLock ? (
  <div className="match-ended-banner">
    <strong>🏁 Match complete</strong>
    <span>
      Review the scorecard and click <b>Lock Match</b> to preserve the final result.
    </span>
  </div>
) : (
  <div className="ready-delivery live-feed-banner">
  {error ||
    message ||
    "🏏 Ready for next delivery"}
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
  defaultOpen={true}
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
{permissions?.canScoreMatch && !(
  selectedMatch &&
  ["COMPLETED_LOCKED"].includes(
    String(selectedMatch.status || "").toUpperCase()
  )
) &&(
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
           <ContextLens />
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
        <div className="optional-series-tip">
  <strong>💡 Series are optional</strong>
  <span>
    Use a series only when this match belongs to a tournament, cup, season, or year.
  </span>
</div>
        <div>
        <form className="form create-match-form" onSubmit={handleCreateMatch}>
          <div>
 <label>
  <span>Series / Season</span>

  <select
    value={matchForm.seriesId || ""}
    onChange={(e) =>
      setMatchForm((prev) => ({
        ...prev,
        seriesId: e.target.value,
      }))
    }
  >
    <option value="">No Series (Optional)</option>

    {seriesList.map((series) => (
      <option key={series.id} value={series.id}>
        {series.name} • {series.year}
      </option>
    ))}
  </select>

  <small className="field-help">
    Optional. Leave as No Series for friendly, practice, or standalone matches.
  </small>
</label>
          </div>
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
        </div>
      </Card>
    )}

    {activeLeagueId && matchesSubTab === "ACTIVE" && (
      <Card title="🟢 Active Matches">
        {activeMatches.length === 0 ? (
          <div className="empty-state">No active matches found.</div>
        ) : (
          <div className="match-card-list">
            {filteredActiveMatches.map((match) => {
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
            {filteredScheduledMatches.map((match) => (
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
      <div className="completed-match-list">
        {filteredCompletedMatches.map((match) => {
          const normalizedStatus = String(match.status || "")
            .trim()
            .replace(/[\s-]+/g, "_")
            .toUpperCase();

          const canShowAi =
            normalizedStatus === "COMPLETED" ||
            normalizedStatus === "COMPLETED_LOCKED";

          return (
            <div key={match.id} className="completed-match-card">
              <div className="completed-match-main">
                <div className="completed-match-header">
                  <div>
                    <h3>
                      {match.teamAName} <span>vs</span> {match.teamBName}
                    </h3>

                    <div className="completed-match-status-row">
                      <span className="status-pill">{match.status}</span>
                      <span className="mini-pill">
                        🎯 {match.oversPerInnings} overs
                      </span>
                    </div>
                  </div>

                  <div className="completed-match-actions">
                    <button
                      type="button"
                      className="view-match-btn"
                      onClick={() => {
                        setSelectedMatchId(String(match.id));
                        handleMatchSelect(match.id);
                      }}
                    >
                      🏟️ View
                    </button>

                    {canShowAi && (
                      <button
                        type="button"
                        className="mini-action-btn ai-mini-btn"
                        disabled={aiAnalysisLoading}
                        onClick={() => loadAiAnalysis(match.id)}
                      >
                        {aiAnalysisLoading
                          ? "⏳ Generating..."
                          : "🤖 AI Insights"}
                      </button>
                    )}

                    {permissions?.canDeleteMatch && (
                      <button
                        type="button"
                        className="mini-action-btn danger-mini-btn"
                        onClick={() => handleDeleteMatch(match.id)}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="completed-score-box">
                  <div className="innings-score-line">
                    <span>1st Innings</span>
                    <strong>{match.firstInningsScore}</strong>
                  </div>

                  <div className="innings-score-line">
                    <span>2nd Innings</span>
                    <strong>{match.secondInningsScore}</strong>
                  </div>
                </div>

                <div className="completed-result-strip">
                  🏆 <strong>{match.resultText}</strong>
                </div>

                <div className="completed-match-meta">
                  <span>
                    🏏 Bat 1st: {match.battingFirstTeamName || "Not decided"}
                  </span>
                  <span>
                    ⚾ Max wkts: {match.maxWicketsPerInnings ?? "∞"}
                  </span>
                  <span>
                    ⚡ Powerplay: {match.powerplayOversInnings ?? "∞"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </Card>
)}
  </div>
)}
{activeTab === "management" && (
  <div className="management-page">
    <Card title="🏏 League Management">
      <div className="mgmt-clean-shell">

        {/* LEAGUE */}
        <section className="mgmt-clean-card">
          <div className="mgmt-clean-head">
            <div>
              <h3>🏆 League</h3>
              <p>Select your active league and share invite/public links.</p>
            </div>
          </div>

          <label className="mgmt-field">
            <span>👇 Choose a league to manage</span>
            <select
              value={activeLeagueId || ""}
              onChange={(e) => {
                setActiveLeagueId(e.target.value);
                setSelectedTeamId("");
                setSelectedSeriesId("");
              }}
            >
              <option value="">Select League</option>

              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name} • {league.visibility || "PRIVATE"}
                </option>
              ))}
            </select>
          </label>

          <div className="mgmt-clean-actions">
            <button
              type="button"
              className="mgmt-clean-btn"
              onClick={() => setShowLeagueModal(true)}
            >
              ➕ Create League
            </button>
            {selectedLeague && permissions?.canDeleteLeague && (
              <button
                type="button"
                className="mgmt-clean-danger"
                title={`Delete ${selectedLeague.name}`}
                onClick={() =>
                  handleDeleteLeague(selectedLeague.id, selectedLeague.name)
                }
              >
                🗑️
              </button>
            )}
            {activeLeague && (
              <button
                type="button"
                className="mgmt-clean-btn"
                onClick={() => generateInviteLink(activeLeague.id)}
              >
                🔗 Copy Invite Link
              </button>
            )}

            {activeLeague &&
              activeLeague.visibility !== "PRIVATE" &&
              activeLeague.slug && (
                <button
                  type="button"
                  className="mgmt-clean-btn"
                  onClick={() => {
                    const url = `${window.location.origin}/public/leagues/${activeLeague.slug}`;
                    navigator.clipboard.writeText(url);
                    setMessage("Public league link copied.");
                    showToast("success", "✅ Public league link copied.");
                  }}
                >
                  🌐 Copy Public View Link
                </button>
              )}
          </div>
        </section>

        {/* SERIES */}
        <section className="mgmt-clean-card">
          <div className="mgmt-clean-head">
            <div>
              <h3>📅 Series / Season</h3>
              <p>Optional. Group matches into tournaments, cups, seasons, or years.</p>
            </div>
          </div>

          <label className="mgmt-field">
            <span>👇 Choose a series or leave optional</span>
            <select
              value={selectedSeriesId || ""}
              disabled={!activeLeagueId}
              onChange={(e) => {
                const seriesId = e.target.value;
                setSelectedSeriesId(seriesId);

                const selected = seriesList.find(
                  (s) => Number(s.id) === Number(seriesId)
                );

                setContextFilters((prev) => ({
                  ...prev,
                  seriesIds: seriesId ? [Number(seriesId)] : [],
                  years: selected ? [Number(selected.year)] : [],
                }));
              }}
            >
              <option value="">No Series Selected (Optional)</option>

              {seriesList.map((series) => (
                <option key={series.id} value={series.id}>
                  {series.name} • {series.year} • {series.status || "ACTIVE"}
                </option>
              ))}
            </select>

            <small className="mgmt-clean-help">
              <strong>Series are optional.</strong>
              <span>
                Create a series only if you want to group matches into a tournament,
                cup, season, or year. You can still create matches without a series.
              </span>
            </small>
          </label>

          <div className="mgmt-clean-actions">
            <button
              type="button"
              className="mgmt-clean-btn"
              disabled={!activeLeagueId}
              onClick={() => setShowSeriesModal(true)}
            >
              ➕ Create Series
            </button>

            {selectedSeries && (
              <button
                type="button"
                className="mgmt-clean-danger"
                title={`Delete ${selectedSeries.name}`}
                onClick={() =>
                  handleDeleteSeries(selectedSeries.id, selectedSeries.name)
                }
              >
                🗑️
              </button>
            )}
          </div>
        </section>

        {/* TEAMS */}
        <section className="mgmt-clean-card">
          <div className="mgmt-clean-head">
            <div>
              <h3>👥 Teams</h3>
              <p>Select or add teams under the active league.</p>
            </div>
          </div>

          <label className="mgmt-field">
            <span>👇 Choose a team to manage players</span>
            <select
              value={selectedTeamId || ""}
              disabled={!selectedLeague}
              onChange={(e) => setSelectedTeamId(e.target.value)}
            >
              <option value="">
                {selectedLeague ? "Select Team" : "Select league first"}
              </option>

              {selectedLeague?.teams?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mgmt-clean-actions">
            <button
              type="button"
              className="mgmt-clean-btn"
              disabled={!selectedLeague}
              onClick={() => {
                setTeamForm({
                  name: "",
                  leagueId: selectedLeague.id,
                });

                setShowAddTeam(true);
              }}
            >
              ➕ Add Team
            </button>

            {selectedTeam && permissions?.canDeleteTeam && (
              <button
                type="button"
                className="mgmt-clean-danger"
                onClick={() =>
                  handleDeleteTeam(selectedTeam.id, selectedTeam.name)
                }
              >
                🗑️
              </button>
            )}
          </div>
        </section>

 {/* PLAYERS */}
<section className="mgmt-clean-card player-manager-card">
  <div className="player-manager-head">
    <div>
      <h3>🏏 Players</h3>
      <p>
        {selectedTeam
          ? `${selectedTeam.players?.length || 0} players ready for ${selectedTeam.name}`
          : "Select a team to view, add, or manage players."}
      </p>
    </div>

    {selectedTeam && (
      <div className="player-count-pill">
        👥 {selectedTeam.players?.length || 0}
      </div>
    )}
  </div>

  {!selectedTeam ? (
    <div className="player-empty-state">
      <div className="player-empty-icon">👥</div>
      <strong>No team selected yet</strong>
      <span>Choose a team above to view and add players.</span>
    </div>
  ) : (
    <>
      <div className="player-team-banner">
        <div>
          <strong>{selectedTeam.name}</strong>
          <span>Team roster</span>
        </div>

        <button
          type="button"
          className="player-add-btn"
          onClick={() => {
            setPlayerLeagueId(activeLeagueId);

            setPlayerForm({
              names: "",
              leagueId: activeLeagueId,
              teamId: selectedTeamId,
            });

            setShowPlayerModal(true);
          }}
        >
          ➕ Add Players
        </button>
      </div>

      {!selectedTeam.players?.length ? (
        <div className="player-empty-state compact">
          <div className="player-empty-icon">🏏</div>
          <strong>No players yet</strong>
          <span>Add players in bulk by pasting one name per line.</span>
        </div>
      ) : (
        <div className="pretty-player-list">
          {selectedTeam.players.map((player, index) => (
            <div key={player.id} className="pretty-player-row">
              <div className="player-avatar">
                {String(player.name || "?").trim().charAt(0).toUpperCase()}
              </div>

              <div className="player-info">
                <strong>{player.name}</strong>
                <span>Player #{index + 1}</span>
              </div>

              {permissions?.canDeletePlayer && (
                <button
                  type="button"
                  className="player-delete-btn"
                  title={`Delete ${player.name}`}
                  onClick={() =>
                    handleDeletePlayer(player.id, player.name)
                  }
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )}
</section>

        {/* NEXT STEP */}
        {canCreateMatch && (
          <section className="mgmt-clean-ready">
            <div>
              <strong>✅ League setup complete</strong>
              <p>You can now schedule matches from the Matches tab.</p>
            </div>

            <button
              type="button"
              className="mgmt-clean-btn"
              onClick={() => setActiveTab("matches")}
            >
              🏏 Create Match
            </button>
          </section>
        )}
      </div>
    </Card>

    {(message || error) && (
      <Card title="ℹ️ Notifications" defaultCollapsed={false}>
        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </Card>
    )}
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
            <ContextLens />
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
          {filteredPointsTable.map((row) => (
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
    <ContextLens />
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
      <div className="pretty-stats-list">
        {filteredBatting.map((row, idx) => (
          <div
            key={`league-bat-${row.playerId ?? row.playerName}-${idx}`}
            className="pretty-stat-card"
          >
            <div className="pretty-stat-rank">#{row.actualRank}</div>

            <div className="pretty-stat-main">
              <strong>{row.playerName}</strong>
              <small>{row.teamName}</small>
            </div>

            <div className="pretty-stat-highlight">
              <strong>{row.runs}</strong>
              <small>Runs</small>
            </div>

            <div className="pretty-stat-grid">
              <span>M {row.matches}</span>
              <span>Inn {row.battingInnings}</span>
              <span>B {row.balls}</span>
              <span>Avg {row.average}</span>
              <span>SR {row.strikeRate}</span>
              <span>4s {row.fours}</span>
              <span>6s {row.sixes}</span>
              <span>HS {row.highestScore}</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
)}

{statsSubTab === "BOWLING" && (
  <Card title="🎯 Bowling Records">
    {!leagueStats?.bowling?.length ? (
      <p className="muted">No bowling stats yet.</p>
    ) : (
      <div className="pretty-stats-list">
        {filteredBowling.map((row, idx) => (
          <div
            key={`league-bowl-${row.playerId ?? row.playerName}-${idx}`}
            className="pretty-stat-card"
          >
            <div className="pretty-stat-rank">#{row.actualRank}</div>

            <div className="pretty-stat-main">
              <strong>{row.playerName}</strong>
              <small>{row.teamName}</small>
            </div>

            <div className="pretty-stat-highlight">
              <strong>{row.wickets}</strong>
              <small>Wkts</small>
            </div>

            <div className="pretty-stat-grid">
              <span>M {row.matches}</span>
              <span>O {row.bowlingOvers}</span>
              <span>R {row.bowlingRuns}</span>
              <span>Eco {row.economy}</span>
              <span>Avg {row.bowlingAverage}</span>
              <span>SR {row.bowlingStrikeRate}</span>
              <span>Dots {row.dots}</span>
              <span>Best {row.bestBowling}</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
)}

{statsSubTab === "FIELDING" && (
  <Card title="🧤 Fielding Records">
    {!leagueStats?.fielding?.length ? (
      <p className="muted">No fielding stats yet.</p>
    ) : (
      <div className="pretty-stats-list">
        {filteredFielding.map((row, idx) => (
          <div
            key={`league-field-${row.playerId ?? row.playerName}-${idx}`}
            className="pretty-stat-card"
          >
            <div className="pretty-stat-rank">#{row.actualRank}</div>

            <div className="pretty-stat-main">
              <strong>{row.playerName}</strong>
              <small>{row.teamName}</small>
            </div>

            <div className="pretty-stat-highlight">
              <strong>{row.fieldingTotal}</strong>
              <small>Total</small>
            </div>

            <div className="pretty-stat-grid">
              <span>Catches {row.catches}</span>
              <span>Run Outs {row.runOuts}</span>
              <span>Stumpings {row.stumpings}</span>
              <span>Assists {row.assists}</span>
            </div>
          </div>
        ))}
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

    {!filteredSelectedRanking.length ? (
      <p className="muted">No ranking data yet.</p>
    ) : (
      <>
        <div className="ranking-hero">
          {filteredSelectedRanking.slice(0, 3).map((row, index) => (
            <div
              key={`ranking-podium-${rankingType}-${row.playerId ?? row.playerName}-${index}`}
              className={`ranking-podium podium-${index + 1}`}
            >
              <div className="podium-rank">#{row.actualRank}</div>
              <div className="podium-avatar">{currentRankingConfig.icon}</div>
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
          <span>{filteredSelectedRanking.length} players</span>
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
              {filteredSelectedRanking.map((row, index) => (
                <tr
                  key={`ranking-row-${rankingType}-${row.playerId ?? row.playerName}-${index}`}
                >
                  <td>
                    <strong>#{row.actualRank}</strong>
                  </td>
                  <td>{row.playerName}</td>
                  <td>{row.teamName}</td>
                  <td>{row.matches}</td>
                  <td>
                    <strong>{currentRankingConfig.value(row)}</strong>
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
  <Card title="❓ Cric4All Help Center">
    <div className="help-page">
      <div className="help-hero">
        <div>
          <h2>🏏 Welcome to Cric4All</h2>
          <p>
            Create leagues, add teams and players, organize series, schedule
            matches, score live games, share public scorecards, track points,
            view rankings, and generate AI-powered match insights.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">🚀 Quick Start Guide</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>🏆 Step 1</h3>
          <h4>Create or Select League</h4>
          <p>
            Open the <strong>Leagues</strong> tab and choose your active league.
            Every team, player, series, match, points table, and stat belongs to
            a league.
          </p>
        </div>

        <div className="help-card">
          <h3>🌐 Step 2</h3>
          <h4>Choose League Visibility</h4>
          <p>
            Keep leagues <strong>Private</strong>, make them{" "}
            <strong>Unlisted</strong> for people with the link, or make them{" "}
            <strong>Public</strong> so they can appear on the Explore page.
          </p>
        </div>

        <div className="help-card">
          <h3>📅 Step 3</h3>
          <h4>Create Series / Season</h4>
          <p>
            Series are optional. Use them to group matches by tournament, cup,
            season, or year. You can still create matches without a series.
          </p>
        </div>

        <div className="help-card">
          <h3>👥 Step 4</h3>
          <h4>Add Teams</h4>
          <p>
            Select your active league and add teams. You need at least two teams
            before creating a match.
          </p>
        </div>

        <div className="help-card">
          <h3>🏏 Step 5</h3>
          <h4>Add Players</h4>
          <p>
            Select a team and use the Add Players popup. Paste multiple player
            names, one per line.
          </p>

          <div className="help-code-box">
            Virat Kohli
            <br />
            Rohit Sharma
            <br />
            MS Dhoni
            <br />
            KL Rahul
          </div>
        </div>

        <div className="help-card">
          <h3>📋 Step 6</h3>
          <h4>Create / Schedule Match</h4>
          <p>
            Go to <strong>Matches → Create Match</strong>. Series is optional.
            Scheduled matches can be created first and started later.
          </p>
        </div>

        <div className="help-card">
          <h3>▶ Step 7</h3>
          <h4>Start Match</h4>
          <p>
            Open the <strong>Scheduled</strong> tab, click{" "}
            <strong>Start Match</strong>, select batting first, and begin live
            scoring.
          </p>
        </div>

        <div className="help-card">
          <h3>🎯 Step 8</h3>
          <h4>Score Live</h4>
          <p>
            Use the <strong>Scoring</strong> tab for runs, extras, wickets, run
            outs, retired hurt, bowler changes, and striker rotation.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">🧭 Main Tabs</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>🏆 Leagues</h3>
          <p>
            Manage leagues, series, teams, players, invite links, public view
            links, and league visibility.
          </p>
        </div>

        <div className="help-card">
          <h3>📋 Matches</h3>
          <p>
            Matches are separated into <strong>Create</strong>,{" "}
            <strong>Active</strong>, <strong>Scheduled</strong>, and{" "}
            <strong>Completed</strong>.
          </p>
        </div>

        <div className="help-card">
          <h3>🎯 Scoring</h3>
          <p>
            Score live balls, extras, wickets, fielding details, retired hurt,
            run outs, bowler changes, and striker rotation.
          </p>
        </div>

        <div className="help-card">
          <h3>📈 Points</h3>
          <p>
            Track standings with matches played, wins, losses, ties, points, and
            team performance.
          </p>
        </div>

        <div className="help-card">
          <h3>📊 Stats</h3>
          <p>
            View batting, bowling, fielding, and rankings including top run
            scorers, wicket takers, six hitters, strike rate, economy, and
            all-rounders.
          </p>
        </div>

        <div className="help-card">
          <h3>🔐 Access</h3>
          <p>
            Manage league members, roles, and permissions for owners, admins,
            captains, scorers, analysts, and viewers.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">🔎 Smart Filters</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>🎛️ Context Lens</h3>
          <p>
            Use Smart Filters to filter by teams, matches, players, status,
            series, and year across Matches, Points, and Stats.
          </p>
        </div>

        <div className="help-card">
          <h3>📅 Series & Year Filters</h3>
          <p>
            Selecting a year filters series. Selecting a series filters matches,
            points, stats, and rankings where applicable.
          </p>
        </div>

        <div className="help-card">
          <h3>👥 Team & Player Filters</h3>
          <p>
            Team filters narrow matches, points, player stats, and rankings.
            Player filters work by player name across teams.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">🌐 Public League Features</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>🔒 Private</h3>
          <p>
            Private leagues are visible only to authorized league members.
          </p>
        </div>

        <div className="help-card">
          <h3>🔗 Unlisted</h3>
          <p>
            Unlisted leagues are view-only public pages that open only when
            someone has the direct link.
          </p>
        </div>

        <div className="help-card">
          <h3>🌐 Public</h3>
          <p>
            Public leagues can appear on the Explore page and can be viewed by
            everyone.
          </p>
        </div>

        <div className="help-card">
          <h3>🧭 Explore</h3>
          <p>
            The Explore page shows public leagues and supports searching by
            league, team, series, or year.
          </p>
        </div>

        <div className="help-card">
          <h3>📈 Public Points Table</h3>
          <p>
            Public league pages show standings so spectators can follow team
            performance.
          </p>
        </div>

        <div className="help-card">
          <h3>🏆 Public Leaders</h3>
          <p>
            Public league pages can show top performers such as most runs, most
            wickets, most sixes, strike rate, and economy.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">🏏 Scoring Features</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>➕ Extras</h3>
          <p>
            Supports wides, no-balls, byes, and leg-byes. No-ball runs off the
            bat are credited to the striker.
          </p>
        </div>

        <div className="help-card">
          <h3>🚨 Wickets</h3>
          <p>
            Supports bowled, caught, LBW, run out, stumped, hit wicket, retired
            hurt, retired out, and other dismissal types.
          </p>
        </div>

        <div className="help-card">
          <h3>🧤 Fielding Details</h3>
          <p>
            Capture caught by, stumped by, run out by, and assisted fielder
            details for better scorecards and stats.
          </p>
        </div>

        <div className="help-card">
          <h3>🎯 Bowler Change</h3>
          <p>
            At the end of an over, the app prompts for a new bowler and helps
            prevent invalid consecutive overs.
          </p>
        </div>

        <div className="help-card">
          <h3>🤝 Partnerships</h3>
          <p>
            Scoreboards show partnership runs, balls, current partnerships, and
            wicket-ending partnerships.
          </p>
        </div>

        <div className="help-card">
          <h3>💥 Fall of Wickets</h3>
          <p>
            Fall of wickets shows score, wicket number, player out, and over.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">✨ Match Tools</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>🤖 AI Match Insights</h3>
          <p>
            For completed or locked matches, generate AI analysis covering match
            summary, turning points, top performers, partnerships, pressure
            moments, and team takeaways.
          </p>
        </div>

        <div className="help-card">
          <h3>📤 Share Match</h3>
          <p>
            Share live scores, commentary, scorecards, match status, and stats
            using match sharing links.
          </p>
        </div>

        <div className="help-card">
          <h3>🔒 Lock Match</h3>
          <p>
            Locked matches prevent further scoring changes and are treated as
            finalized scorecards.
          </p>
        </div>
      </div>

      <div className="help-tip-box">
        <h3>💡 Pro Tips</h3>

        <ul>
          <li>Use the Leagues tab first: league → series → teams → players.</li>
          <li>Series are optional. Use them only for cups, seasons, tournaments, or years.</li>
          <li>Create at least two teams before creating a match.</li>
          <li>Add players before starting a match for accurate stats.</li>
          <li>Use Scheduled matches for future games.</li>
          <li>Use Smart Filters to focus on a team, player, series, year, or match status.</li>
          <li>Use public league links when you want spectators to view league pages.</li>
          <li>Use Explore only for leagues you are comfortable making public.</li>
          <li>Completed matches automatically open the scoreboard instead of scoring.</li>
          <li>Use AI Match Insights only after the match is completed.</li>
        </ul>
      </div>

      <div className="help-card full">
        <h3>🔐 Roles & Permissions</h3>

        <p>
          League Owners and Admins can manage users, teams, matches, scoring,
          series, public visibility, and access levels. Scorers can score
          matches, captains can help manage team-related actions, analysts can
          review stats, and viewers can follow league information.
        </p>

        <div className="help-badges">
          <span className="badge">OWNER</span>
          <span className="badge">ADMIN</span>
          <span className="badge">CAPTAIN</span>
          <span className="badge">SCORER</span>
          <span className="badge">ANALYST</span>
          <span className="badge">VIEWER</span>
        </div>
      </div>

      <div className="help-card full">
        <h3>❓ Frequently Asked Questions</h3>

        <div className="help-faq">
          <div>
            <strong>Where do I create leagues and teams?</strong>
            <br />
            Use the <strong>Leagues</strong> tab.
          </div>

          <div>
            <strong>Is Series required?</strong>
            <br />
            No. Series is optional. Leave it blank for friendly, practice, or
            standalone matches.
          </div>

          <div>
            <strong>Why don't I see my teams?</strong>
            <br />
            Re-select the active league from the dropdown.
          </div>

          <div>
            <strong>Why can't I create a match?</strong>
            <br />
            Make sure the active league has at least two teams.
          </div>

          <div>
            <strong>Why is batting first not required during match creation?</strong>
            <br />
            Future scheduled matches can be created first. Batting first can be
            selected when starting the match.
          </div>

          <div>
            <strong>Why is Scoring hidden for a completed match?</strong>
            <br />
            Completed and locked matches are finalized, so the app opens the
            scoreboard instead.
          </div>

          <div>
            <strong>What is the difference between Public and Unlisted?</strong>
            <br />
            Unlisted opens only by direct link. Public can appear on the Explore
            page.
          </div>

          <div>
            <strong>Can spectators view the league?</strong>
            <br />
            Yes. Set the league to Unlisted or Public and copy the public view
            link.
          </div>

          <div>
            <strong>Can I add players in bulk?</strong>
            <br />
            Yes. Paste one player name per line in the Add Players popup.
          </div>

          <div>
            <strong>When can I use AI Match Insights?</strong>
            <br />
            AI Insights are available only for completed or completed locked
            matches.
          </div>
        </div>
      </div>
    </div>
  </Card>
)}
{activeTab === "about" && (
  <Card title="ℹ️ About Cric4All">
    <div className="about-page">
      <div className="about-hero">
        <div>
          <h2>🏏 Cric4All</h2>
          <p>
            A modern cricket scoring, league management, public score sharing,
            and statistics platform built for clubs, leagues, academies,
            tournaments, and community cricket.
          </p>
        </div>
      </div>

      <div className="about-card about-mission">
        <h3>🎯 Our Mission</h3>
        <p>
          Cric4All makes cricket easier to organize, score, follow, and share.
          It brings leagues, teams, players, matches, series, points tables,
          rankings, scorecards, commentary, and public league pages into one
          simple platform.
        </p>
        <p>
          Whether you are running a weekend tournament, a yearly league, an
          academy game, or a friendly match, Cric4All helps organizers, scorers,
          captains, players, and spectators stay connected to the game.
        </p>
      </div>

      <h3 className="about-section-title">🚀 What Cric4All Helps You Do</h3>

      <div className="about-feature-grid">
        <div className="about-feature">🏆 League Management</div>
        <div className="about-feature">📅 Series / Season Management</div>
        <div className="about-feature">👥 Team Management</div>
        <div className="about-feature">🏏 Player Management</div>
        <div className="about-feature">📋 Match Scheduling</div>
        <div className="about-feature">🎯 Live Ball-by-Ball Scoring</div>
        <div className="about-feature">🏟️ Professional Match Center</div>
        <div className="about-feature">🎙️ Ball-by-Ball Commentary</div>
        <div className="about-feature">📊 Player & League Statistics</div>
        <div className="about-feature">🏆 Rankings Hub</div>
        <div className="about-feature">📈 Points Table</div>
        <div className="about-feature">🔎 Smart Filters / Context Lens</div>
        <div className="about-feature">🌐 Public League Pages</div>
        <div className="about-feature">🧭 Explore Public Leagues</div>
        <div className="about-feature">🤖 AI Post-Match Insights</div>
        <div className="about-feature">🔐 Role-Based Access</div>
      </div>

      <div className="about-card">
        <h3>📦 Current Release</h3>

        <div className="release-badge-row">
          <span className="release-badge">MVP 1.0</span>
          <span className="release-badge">Live Scoring Ready</span>
          <span className="release-badge">Public Pages Ready</span>
          <span className="release-badge">Mobile Friendly</span>
        </div>

        <p>Current functionality includes:</p>

        <div className="about-list-grid">
          <span>✅ League creation</span>
          <span>✅ Private, Unlisted, and Public leagues</span>
          <span>✅ Public league view links</span>
          <span>✅ Explore page for public leagues</span>
          <span>✅ Series / season creation</span>
          <span>✅ Team creation</span>
          <span>✅ Beautiful bulk player imports</span>
          <span>✅ Scheduled matches</span>
          <span>✅ Start match workflow</span>
          <span>✅ Optional series while creating matches</span>
          <span>✅ Live scoring</span>
          <span>✅ Wides, no-balls, byes, leg-byes</span>
          <span>✅ Wickets, run outs, stumpings, retired hurt</span>
          <span>✅ Scoreboard and match center</span>
          <span>✅ Commentary timeline</span>
          <span>✅ Points table</span>
          <span>✅ Batting, bowling, fielding stats</span>
          <span>✅ Rankings and league leaders</span>
          <span>✅ Smart Filters / Context Lens</span>
          <span>✅ AI match insights</span>
        </div>
      </div>

      <div className="about-card">
        <h3>🌐 Public Cricket Experience</h3>

        <p>
          Cric4All now supports public-facing cricket pages so leagues can share
          scores, teams, series, results, standings, and leaders with spectators.
        </p>

        <div className="about-workflow-grid">
          <div>
            <strong>Private Leagues</strong>
            <p>Visible only to league members with proper access.</p>
          </div>

          <div>
            <strong>Unlisted Leagues</strong>
            <p>View-only public pages that open only with a direct link.</p>
          </div>

          <div>
            <strong>Public Leagues</strong>
            <p>Can appear on the Explore page for anyone to discover.</p>
          </div>

          <div>
            <strong>Explore Page</strong>
            <p>Find public leagues by league name, team, series, or year.</p>
          </div>
        </div>
      </div>

      <div className="about-card">
        <h3>🏟️ Built for Real Cricket Workflows</h3>

        <div className="about-workflow-grid">
          <div>
            <strong>For Organizers</strong>
            <p>
              Create leagues, series, teams, matches, invite links, visibility
              settings, roles, and permissions.
            </p>
          </div>

          <div>
            <strong>For Scorers</strong>
            <p>
              Score every ball with runs, extras, wickets, fielders, bowler
              changes, retired hurt, innings tracking, and commentary.
            </p>
          </div>

          <div>
            <strong>For Players</strong>
            <p>
              Track batting, bowling, fielding records, rankings, leaders, and
              performance history.
            </p>
          </div>

          <div>
            <strong>For Spectators</strong>
            <p>
              Follow public league pages, live scores, match status,
              commentary, scorecards, results, points, and leaders.
            </p>
          </div>
        </div>
      </div>

      <div className="about-card">
        <h3>🧠 Smart Match Features</h3>

        <p>
          Cric4All goes beyond basic scoring. Completed matches can include
          AI-powered analysis, professional scorecards, innings-wise data,
          player rankings, fielding records, public leaders, and detailed
          ball-by-ball commentary.
        </p>

        <div className="about-highlight-row">
          <span>🤖 AI Analysis</span>
          <span>📊 Stats</span>
          <span>🎙️ Commentary</span>
          <span>🏆 Rankings</span>
          <span>📈 Points Table</span>
          <span>🔎 Smart Filters</span>
          <span>🌐 Public Pages</span>
        </div>
      </div>

      <div className="about-card">
        <h3>🛣️ Roadmap</h3>

        <div className="about-list-grid">
          <span>📱 Push notifications</span>
          <span>☁️ Offline scoring sync</span>
          <span>🏆 Tournament brackets</span>
          <span>🎥 Match highlights</span>
          <span>📺 Public scoreboard upgrades</span>
          <span>👥 Public team pages</span>
          <span>🏏 Public player profiles</span>
          <span>📊 Advanced analytics dashboard</span>
          <span>🔍 SEO upgrades for public league pages</span>
          <span>📲 Android app packaging</span>
          <span>🍎 iOS app packaging</span>
        </div>
      </div>

      <div className="about-card">
        <h3>⚙️ Built With</h3>

        <div className="about-tech-row">
          <span className="badge">Next.js</span>
          <span className="badge">React</span>
          <span className="badge">Prisma</span>
          <span className="badge">PostgreSQL</span>
          <span className="badge">NextAuth</span>
          <span className="badge">OpenAI</span>
          <span className="badge">Vercel</span>
          <span className="badge">Capacitor</span>
        </div>
      </div>

      <div className="about-footer">
        <h3>🏏 Cric4All</h3>
        <p>Manage Leagues. Score Matches. Share Live Cricket.</p>
        <p className="about-copy">© 2026 Cric4All</p>
      </div>
    </div>
  </Card>
)}
{showLeagueModal && (
  <div className="league-modal-backdrop">
    <div className="modal-card app-modal-card">

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
      <div className="league-modal-body">
<label>
  <span>League Visibility</span>

  <select
    value={leagueForm.visibility || "PRIVATE"}
    onChange={(e) =>
      setLeagueForm((prev) => ({
        ...prev,
        visibility: e.target.value,
      }))
    }
  >
    <option value="PRIVATE">🔒 Private - Members only</option>
    <option value="UNLISTED">🔗 Unlisted - Anyone with link can view</option>
    <option value="PUBLIC">🌐 Public - Everyone can view</option>
  </select>

  <small className="field-help">
    You can keep the league private or allow view-only public access.
  </small>
</label>
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
    <div className="modal-card app-modal-card">

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
    <div className="add-player-pro-modal">
      <div className="add-player-pro-hero">
        <div className="add-player-pro-icon">🏏</div>

        <div>
          <h3>Add Players</h3>
          <p>Build your team roster quickly. Paste one player name per line.</p>
        </div>

        <button
          type="button"
          className="add-player-pro-close"
          onClick={() => setShowPlayerModal(false)}
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleAddPlayers} className="add-player-pro-form">
        <div className="add-player-pro-grid">
          <label>
            <span>🏆 League</span>
            <select
              value={playerLeagueId || ""}
              onChange={(e) => {
                const leagueId = Number(e.target.value);

                setPlayerLeagueId(leagueId);

                setPlayerForm((prev) => ({
                  ...prev,
                  leagueId,
                  teamId: "",
                }));
              }}
            >
              <option value="">Choose League</option>

              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>👥 Team</span>
            <select
              value={selectedPlayerTeamId || ""}
              onChange={(e) =>
                setSelectedPlayerTeamId(Number(e.target.value))
              }
            >
              <option value="">Choose Team</option>

              {selectedPlayerLeague?.teams?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="add-player-pro-textarea-wrap">
          <div className="add-player-pro-label-row">
            <span>✍️ Player Names</span>
            <strong>
              {(playerForm.names || "")
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean).length}{" "}
              ready
            </strong>
          </div>

          <textarea
            rows={8}
            className="add-player-pro-textarea"
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

        <div className="add-player-pro-tip">
          💡 Tip: You can paste names from WhatsApp, Excel, Notes, or any list.
        </div>

        <div className="add-player-pro-actions">
          <button
            type="button"
            className="add-player-pro-cancel"
            onClick={() => setShowPlayerModal(false)}
          >
            Cancel
          </button>

          <button type="submit" className="add-player-pro-save">
            ✅ Save Players
          </button>
        </div>
      </form>
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
{showAiAnalysisModal && (
  <div className="modal-backdrop">
    <div className="ai-analysis-modal">
      <div className="ai-analysis-modal-header">
        <h3>🤖 AI Match Insights</h3>

        <button
          type="button"
          className="icon-btn"
          onClick={() => setShowAiAnalysisModal(false)}
        >
          ✕
        </button>
      </div>

<div className="ai-analysis-content pretty-ai-analysis">
  {aiAnalysis
    .split("\n")
    .filter((line) => line.trim())
    .map((line, idx) => {
      const isHeading =
        line.startsWith("🏆") ||
        line.startsWith("🔑") ||
        line.startsWith("🏏") ||
        line.startsWith("🎯") ||
        line.startsWith("🤝") ||
        line.startsWith("💥") ||
        line.startsWith("📊");

      return isHeading ? (
        <h4 key={`ai-heading-${idx}`}>
          {line}
        </h4>
      ) : (
        <p key={`ai-line-${idx}`}>
          {line.replace(/^[-*]\s*/, "")}
        </p>
      );
    })}
</div>

      <div className="modal-actions">
        <button
          type="button"
          className="btn"
          onClick={() => setShowAiAnalysisModal(false)}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}
{showMatchCreatedModal && (
  <div className="modal-backdrop">
    <div className="match-created-modal">
      <div className="match-created-icon">✅</div>

      <h3>Match Created Successfully!</h3>

      <p>
        Your match has been added to the Scheduled tab.
      </p>

      {createdMatchInfo && (
        <div className="created-match-preview">
          <strong>
            {createdMatchInfo.teamAName || "Team A"} vs{" "}
            {createdMatchInfo.teamBName || "Team B"}
          </strong>

          <span>
            🎯 {createdMatchInfo.oversPerInnings} overs
          </span>
        </div>
      )}

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setShowMatchCreatedModal(false)}
        >
          Stay Here
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => {
            setShowMatchCreatedModal(false);
            setMatchesSubTab("SCHEDULED");
          }}
        >
          Go to Scheduled Matches
        </button>
      </div>
    </div>
  </div>
)}
{openFilter === "filterCenter" && (
  <div className="modal-backdrop">
    <div className="filter-center-modal">
      <div className="filter-center-header">
        <div>
          <h3>🔎 Filter Command Center</h3>
          <p>Search, select, and narrow your cricket data quickly.</p>
        </div>

        <button type="button" className="btn" onClick={() => setOpenFilter(null)}>
          ✕
        </button>
      </div>

      <input
        className="filter-search"
        value={filterSearch}
        onChange={(e) => setFilterSearch(e.target.value)}
        placeholder="Search teams, players, matches..."
      />

      <div className="filter-category-tabs">
        {["teams", "players", "matches", "series", "years", "statuses"].map((cat) => (
          <button
            key={cat}
            type="button"
            className={filterCategory === cat ? "active" : ""}
            onClick={() => setFilterCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="filter-results-panel">
        {/* render category results here */}
        {filterCategory === "teams" &&
  teams
    .filter((t) => Number(t.leagueId) === Number(activeLeagueId))
    .filter((t) =>
      t.name.toLowerCase().includes(filterSearch.toLowerCase())
    )
    .map((team) => (
      <button
        key={team.id}
        type="button"
        className={
          contextFilters.teamIds.includes(Number(team.id))
            ? "filter-row active"
            : "filter-row"
        }
onClick={() => {
  toggleFilterValue("teamIds", Number(team.id));

  setContextFilters((prev) => ({
    ...prev,
    playerNames: [],
    matchIds: []
  }));
}}
      >
        <span>🏏 {team.name}</span>
        <small>{team.players?.length || 0} players</small>
      </button>
    ))}
    {filterCategory === "players" &&
  availablePlayersForFilter
    .filter((p) =>
      p.name.toLowerCase().includes(filterSearch.toLowerCase())
    )
    .map((player) => (
      <button
        key={player.normalizedName}
        type="button"
        className={
          contextFilters.playerNames.includes(player.normalizedName)
            ? "filter-row active"
            : "filter-row"
        }
        onClick={() =>
          toggleFilterValue("playerNames", player.normalizedName)
        }
      >
        <span>👤 {player.name}</span>
      </button>
    ))}
{filterCategory === "matches" &&
  filteredMatchesForContextLens
    .filter((m) =>
      `${m.teamAName} ${m.teamBName} ${m.id} ${m.seriesName || ""} ${m.status || ""}`
        .toLowerCase()
        .includes(filterSearch.toLowerCase())
    )
    .map((match) => (
      <button
        key={match.id}
        type="button"
        className={
          contextFilters.matchIds.includes(Number(match.id))
            ? "filter-row active"
            : "filter-row"
        }
        onClick={() => toggleFilterValue("matchIds", Number(match.id))}
      >
        <span>
          #{match.id} {match.teamAName} vs {match.teamBName}
        </span>
        <small>
          {match.seriesName ? `${match.seriesName} • ` : ""}
          {String(match.status || "").replaceAll("_", " ")}
        </small>
      </button>
    ))}
{filterCategory === "series" &&
  filteredSeriesForContextLens
    .filter((s) =>
      `${s.name} ${s.year}`
        .toLowerCase()
        .includes(filterSearch.toLowerCase())
    )
    .map((series) => (
      <button
        key={series.id}
        type="button"
        className={
          contextFilters.seriesIds.includes(Number(series.id))
            ? "filter-row active"
            : "filter-row"
        }
onClick={() => {
  const seriesId = Number(series.id);

  setContextFilters((prev) => {
    const seriesIds = prev.seriesIds.includes(seriesId)
      ? prev.seriesIds.filter((id) => Number(id) !== seriesId)
      : [...prev.seriesIds, seriesId];

    return {
      ...prev,
      seriesIds,
      matchIds: []
    };
  });

  setFilterCategory("matches");
}}
      >
        <span>🏆 {series.name}</span>
        <small>{series.year}</small>
      </button>
    ))}
    {filterCategory === "years" &&
  [...new Set(seriesList.map((s) => Number(s.year)))]
    .sort((a, b) => b - a)
    .map((year) => (
      <button
        key={year}
        type="button"
        className={
          contextFilters.years.includes(Number(year))
            ? "filter-row active"
            : "filter-row"
        }
onClick={() => {
  const yearNumber = Number(year);

  setContextFilters((prev) => {
    const years = prev.years.includes(yearNumber)
      ? prev.years.filter((y) => Number(y) !== yearNumber)
      : [...prev.years, yearNumber];

    return {
      ...prev,
      years,
      seriesIds: [],
      matchIds: []
    };
  });

  setFilterCategory("series");
}}
      >
        <span>📅 {year}</span>
      </button>
    ))}
    {filterCategory === "statuses" &&
  ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "COMPLETED_LOCKED"].map(
    (status) => (
      <button
        key={status}
        type="button"
        className={
          contextFilters.statuses.includes(status)
            ? "filter-row active"
            : "filter-row"
        }
        onClick={() => toggleFilterValue("statuses", status)}
      >
        <span>📌 {status.replaceAll("_", " ")}</span>
      </button>
    )
  )}
      </div>

      <div className="filter-center-footer">
<button
  type="button"
  className="btn"
  onClick={() => {
    clearContextFilters();
    setFilterSearch("");
    setFilterCategory("teams");
  }}
>
  Clear All
</button>

        <button type="button" className="btn" onClick={() => setOpenFilter(null)}>
          Apply Filters
        </button>
      </div>
    </div>
  </div>
)}
{showSeriesModal && (
  <div className="modal-backdrop">
    <div className="modal-card app-modal-card">
      <h3>📅 Create Series</h3>

      <p className="muted">
        Create a tournament, season, cup, or yearly series under the selected league.
      </p>

      <label>
        <span>Series Name</span>
        <input
          value={seriesForm.name}
          onChange={(e) =>
            setSeriesForm((prev) => ({
              ...prev,
              name: e.target.value
            }))
          }
          placeholder="Summer Cup"
        />
      </label>

      <label>
        <span>Year</span>
        <input
          type="number"
          value={seriesForm.year}
          onChange={(e) =>
            setSeriesForm((prev) => ({
              ...prev,
              year: e.target.value
            }))
          }
        />
      </label>

      <label>
        <span>Description</span>
        <input
          value={seriesForm.description}
          onChange={(e) =>
            setSeriesForm((prev) => ({
              ...prev,
              description: e.target.value
            }))
          }
          placeholder="Optional"
        />
      </label>

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setShowSeriesModal(false)}
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn"
          onClick={async () => {
            const created = await api("/api/series", {
              method: "POST",
              body: JSON.stringify({
                ...seriesForm,
                leagueId: activeLeagueId
              })
            });

            setSeriesForm({
              name: "",
              year: new Date().getFullYear(),
              description: ""
            });

            setShowSeriesModal(false);
            await loadSeries();

            setSelectedSeriesId(String(created.id));
          }}
        >
          Create Series
        </button>
      </div>
    </div>
  </div>
)}
{showWicketModal && (
  <div className="modal-backdrop">
    <div className="modal-card app-modal-card">
      <h3>🏏 Wicket Details</h3>

      <p style={{ opacity: 0.75, marginBottom: 16 }}>
        Select dismissal type, runs if run out, player out, fielder details,
        and replacement batter.
      </p>

      <label>
        <span>Wicket Type</span>
        <select
          value={ballForm.wicketType || ""}
          onChange={(e) =>
            setBallForm((prev) => ({
              ...prev,
              wicketType: e.target.value,
              dismissedPlayerId:
                e.target.value === "RUN_OUT"
                  ? prev.dismissedPlayerId || prev.strikerId
                  : prev.strikerId,
            }))
          }
        >
          {WICKET_TYPES.filter((x) => x !== "NONE").map((type) => (
            <option key={type} value={type}>
              {type.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>

      {ballForm.wicketType === "RUN_OUT" && (
        <>
          <label style={{ marginTop: 12 }}>
            <span>Runs Completed Before Run Out</span>

            <div className="quick-run-grid">
              {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
 <button
  key={runs}
  type="button"
  className={`runout-btn ${
    Number(runOutRuns) === runs ? "selected" : ""
  }`}
  onClick={() => setRunOutRuns(runs)}
>
  RO + {runs}
</button>
              ))}
            </div>
          </label>

          <label style={{ marginTop: 12 }}>
            <span>Who is Out?</span>

            <select
              value={ballForm.dismissedPlayerId || ""}
              onChange={(e) =>
                setBallForm((prev) => ({
                  ...prev,
                  dismissedPlayerId: e.target.value,
                }))
              }
            >
              <option value="">Select Player Out</option>

              {battingTeam?.players
                ?.filter(
                  (p) =>
                    String(p.id) === String(ballForm.strikerId) ||
                    String(p.id) === String(ballForm.nonStrikerId)
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {String(p.id) === String(ballForm.strikerId)
                      ? " — Striker"
                      : " — Non-striker"}
                  </option>
                ))}
            </select>
          </label>
        </>
      )}

      {["CAUGHT", "STUMPED", "RUN_OUT"].includes(ballForm.wicketType) && (
        <label style={{ marginTop: 12 }}>
          <span>
            {ballForm.wicketType === "CAUGHT"
              ? "Caught By"
              : ballForm.wicketType === "STUMPED"
              ? "Stumped By"
              : "Run Out By"}
          </span>

          <select
            value={ballForm.fielderId || ""}
            onChange={(e) =>
              setBallForm((prev) => ({
                ...prev,
                fielderId: e.target.value,
              }))
            }
          >
            <option value="">Select Fielder</option>

            {bowlingTeam?.players?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {ballForm.wicketType === "RUN_OUT" && (
        <label style={{ marginTop: 12 }}>
          <span>Assistant Fielder Optional</span>

          <select
            value={ballForm.assistantFielderId || ""}
            onChange={(e) =>
              setBallForm((prev) => ({
                ...prev,
                assistantFielderId: e.target.value,
              }))
            }
          >
            <option value="">No Assistant Fielder</option>

            {bowlingTeam?.players?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label style={{ marginTop: 12 }}>
        <span>New Batter</span>

        <select
          value={ballForm.newBatterId || ""}
          onChange={(e) =>
            setBallForm((prev) => ({
              ...prev,
              newBatterId: e.target.value,
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

      <label style={{ marginTop: 12 }}>
        <span>Wicket Note Optional</span>

        <input
          type="text"
          value={ballForm.wicketNote || ""}
          placeholder="Example: Direct hit from cover"
          onChange={(e) =>
            setBallForm((prev) => ({
              ...prev,
              wicketNote: e.target.value,
            }))
          }
        />
      </label>

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setShowWicketModal(false);
            setRunOutRuns(0);

            setBallForm((prev) => ({
              ...prev,
              isWicket: false,
              wicketType: "NONE",
              dismissedPlayerId: "",
              newBatterId: "",
              fielderId: "",
              assistantFielderId: "",
              wicketNote: "",
            }));
          }}
        >
          Cancel
        </button>

        <button type="button" className="btn" onClick={() => confirmWicket()}>
          Confirm Wicket
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

 {availableReplacementBatters.map((player) => (
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