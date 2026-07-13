"use client";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";
import { EXTRA_TYPES, getPlayerName, WICKET_TYPES } from "@/lib/scoring";
import "@/app/globals.css";
import { useRouter } from "next/navigation";
import {formatMatchDateTime,getMatchTimelineText,} from "@/lib/date";
import { buildMatchInsights } from "@/lib/match-insights";
import Link from "next/link";

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
function MobileBattingCards({ rows = [], currentStrikerId }) {
  if (!rows.length) {
    return <p className="muted">Batting details not available yet.</p>;
  }

  return (
    <div className="mobile-scorecard-list">
      {rows.map((row, index) => (
        <div className="mobile-player-card" key={`mobile-bat-${row.playerId || index}`}>
          <div className="mobile-player-top">
            <strong>
              {row.playerName}
              {Number(currentStrikerId) === Number(row.playerId) ? " *" : ""}
            </strong>
            <span>{row.runs} ({row.balls})</span>
          </div>

          <div className="mobile-dismissal">
            {row.dismissal && row.dismissal !== "not out"
              ? row.dismissal
              : "not out"}
          </div>

<div className="mobile-stat-rail">
  <span><b>{row.fours}</b> 4s</span>
  <span><b>{row.sixes}</b> 6s</span>
  <span><b>{row.strikeRate}</b> SR</span>
</div>
        </div>
      ))}
    </div>
  );
}

function MobileBowlingCards({ rows = [] }) {
  if (!rows.length) {
    return <p className="muted">Bowling details not available yet.</p>;
  }

  return (
    <div className="mobile-scorecard-list">
      {rows.map((row, index) => (
        <div className="mobile-player-card" key={`mobile-bowl-${row.playerId || index}`}>
          <div className="mobile-player-top">
            <strong>{row.playerName}</strong>
            <span>
              {row.overs}-{row.maidens || 0}-{row.runs}-{row.wickets}
            </span>
          </div>

 <div className="mobile-stat-rail">
  <span><b>{row.wides || 0}</b> Wd</span>
  <span><b>{row.noBalls || 0}</b> Nb</span>
  <span><b>{row.economy}</b> Eco</span>
</div>
        </div>
      ))}
    </div>
  );
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
//const [seriesForm, setSeriesForm] = useState({name: "",year: new Date().getFullYear(),description: ""});
const [seriesForm, setSeriesForm] = useState({name: "",year: new Date().getFullYear(),status: "ACTIVE",});
const [editingSeries, setEditingSeries] = useState(null);
const [showSeriesModal, setShowSeriesModal] = useState(false);
const [showDeliverySetupModal, setShowDeliverySetupModal] = useState(false);
const [deliverySetupReason, setDeliverySetupReason] = useState("");
const [pendingDeliverySetupAfterStart, setPendingDeliverySetupAfterStart] = useState(false);
const [pendingSecondInningsSetup, setPendingSecondInningsSetup] = useState(false);
const [isSavingBall, setIsSavingBall] = useState(false);
const [pressedScoreKey, setPressedScoreKey] = useState("");
const [optimisticScoreboard, setOptimisticScoreboard] = useState(null);
const [selectedExtraOption, setSelectedExtraOption] = useState("");
const [showCorrectionModal, setShowCorrectionModal] =useState(false);
const [scorerMode, setScorerMode] = useState(false);
const [scorerDrawer, setScorerDrawer] = useState(null);
const [voiceRecording, setVoiceRecording] = useState(false);
const [voiceBusy, setVoiceBusy] = useState(false);
const [voiceMessage, setVoiceMessage] = useState("");
const [voiceRecorder, setVoiceRecorder] = useState(null);
const [voiceChunks, setVoiceChunks] = useState([]);
const [correctionForm, setCorrectionForm] = useState({
  inningsNo: "1",
  afterBallId: "",
  retiredPlayerId: "",
  replacementPlayerId: "",
  replacementOutBallId: "",
  newBatterAfterReplacementId: "",
});
const [lastCorrectionId, setLastCorrectionId] = useState(null);
const [showKeeperChangeModal, setShowKeeperChangeModal] = useState(false);
const [keeperChangeForm, setKeeperChangeForm] = useState({newKeeperId: "",note: "",});
const [showEditMatchModal, setShowEditMatchModal] = useState(false);
const [editingMatch, setEditingMatch] = useState(null);
const [editMatchForm, setEditMatchForm] = useState({
  scheduledAt: "",
  oversPerInnings: 20,
  powerplayOversInnings: 6,
  maxWicketsPerInnings: "",
  maxOversPerBowler: "",
  seriesId: "",
  teamAId: "",
  teamBId: "",
  teamACaptainId: "",
  teamBCaptainId: "",
  teamAWicketKeeperId: "",
  teamBWicketKeeperId: "",
});
const [correctionStatus, setCorrectionStatus] = useState("");
const [correctionSaving, setCorrectionSaving] = useState(false);
const [rollbackSaving, setRollbackSaving] = useState(false);
const [leagueStatsLoading, setLeagueStatsLoading] = useState(false);
const [pendingMatchesSubTab, setPendingMatchesSubTab] = useState("");
const [instantDeliveryStatus, setInstantDeliveryStatus] = useState("");
const [showPublicLeagueDrawer, setShowPublicLeagueDrawer] = useState(false);
const [showFollowedLeaguesDrawer, setShowFollowedLeaguesDrawer] =  useState(false);
const [showMatchPicker, setShowMatchPicker] = useState(false);
const [overCompleteNotice, setOverCompleteNotice] = useState("");
const [voiceScoringOn, setVoiceScoringOn] = useState(false);
const [voiceStatus, setVoiceStatus] = useState("");
const [voiceSupported, setVoiceSupported] = useState(false);
const [dashboardReady, setDashboardReady] = useState(false);
const [showEditTeamModal, setShowEditTeamModal] = useState(false);
const [editingTeam, setEditingTeam] = useState(null);
const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
const [editingPlayer, setEditingPlayer] = useState(null);
const [editPlayerName, setEditPlayerName] = useState("");
const [teamEditName, setTeamEditName] = useState("");
const [showTransferPlayerModal, setShowTransferPlayerModal] = useState(false);
const [transferPlayer, setTransferPlayer] = useState(null);
const [transferTeamId, setTransferTeamId] = useState("");
const [pageVisible, setPageVisible] = useState(true);
const [ballSaveInFlight, setBallSaveInFlight] = useState(false);
const [tabsScrolled, setTabsScrolled] = useState(false);
const [endInningsAfterWicket, setEndInningsAfterWicket] = useState(false);
const [userActivity, setUserActivity] = useState(null);
const [userActivityLoading, setUserActivityLoading] = useState(false);
const [auditLogs, setAuditLogs] = useState([]);
const [auditLogsLoading, setAuditLogsLoading] = useState(false);
const [showCorrectionCenter, setShowCorrectionCenter] = useState(false);
const [correctionType, setCorrectionType] = useState("TRANSFER_BATTER_RUNS");
const [correctionReason, setCorrectionReason] = useState("");
const [correctionHistory, setCorrectionHistory] = useState([]);
const [correctionLoading, setCorrectionLoading] = useState(false);
const [correctionInnings, setCorrectionInnings] = useState(1);
const [activeScoreboardInnings, setActiveScoreboardInnings] = useState(1);
const [openPlayerActionId, setOpenPlayerActionId] = useState(null);
const [selectedAuditLeagueKey, setSelectedAuditLeagueKey] = useState("ALL");
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

useEffect(() => {
  if (!session?.user?.email) return;

  const sendHeartbeat = () => {
    if (document.visibilityState !== "visible") return;

    fetch("/api/user/heartbeat", {
      method: "POST",
    }).catch(() => {});
  };

  sendHeartbeat();

  const interval = setInterval(sendHeartbeat, 2 * 60 * 1000);

  return () => clearInterval(interval);
}, [session?.user?.email]);

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
  function onVisibilityChange() {
    setPageVisible(document.visibilityState === "visible");
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  onVisibilityChange();

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}, []);

useEffect(() => {
  function handleVisibilityChange() {
    setPageVisible(document.visibilityState === "visible");
  }

  handleVisibilityChange();
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}, []);

useEffect(() => {
  if (activeTab !== "Points" || !activeLeagueId) return;
  loadPointsTable(activeLeagueId);
}, [activeTab, activeLeagueId]);

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
useEffect(() => {
  if (activeTab !== "matches") return;
  if (!pendingMatchesSubTab) return;

  setMatchesSubTab(pendingMatchesSubTab);
  setPendingMatchesSubTab("");
}, [activeTab, pendingMatchesSubTab]);
const selectedSeries = seriesList.find(
  (s) => Number(s.id) === Number(selectedSeriesId)
);

useEffect(() => {
  if (activeTab !== "admin") return;
  loadUserActivity();
}, [activeTab]);
useEffect(() => {
  if (activeTab !== "admin") return;

  loadUserActivity();
  loadAuditLogs();
}, [activeTab, activeLeagueId]);

const battingTeamForCorrection =
  correctionInnings === 1
    ? matchDetail?.battingFirstTeamId === matchDetail?.teamA?.id
      ? matchDetail?.teamA
      : matchDetail?.teamB
    : matchDetail?.battingFirstTeamId === matchDetail?.teamA?.id
      ? matchDetail?.teamB
      : matchDetail?.teamA;

const bowlingTeamForCorrection =
  correctionInnings === 1
    ? matchDetail?.battingFirstTeamId === matchDetail?.teamA?.id
      ? matchDetail?.teamB
      : matchDetail?.teamA
    : matchDetail?.battingFirstTeamId === matchDetail?.teamA?.id
      ? matchDetail?.teamA
      : matchDetail?.teamB;

async function loadUserActivity() {
  try {
    setUserActivityLoading(true);
    const data = await api("/api/admin/user-activity");
    setUserActivity(data);
  } catch (err) {
    setError(err.message || "Failed to load user activity.");
  } finally {
    setUserActivityLoading(false);
  }
}
async function loadAuditLogs() {
  try {
    setAuditLogsLoading(true);

    //const query = await api("/api/audit-logs");

    const data = await api("/api/audit-logs");
    setAuditLogs(Array.isArray(data) ? data : []);
  } catch (err) {
    setError(err.message || "Failed to load audit logs.");
  } finally {
    setAuditLogsLoading(false);
  }
}

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
  async function initializeDashboard() {
    try {
      setDashboardReady(false);

      const loadedLeagues = await loadLeagues(null);
      await loadTeams();

      const res = await fetch("/api/me");
      const meData = await res.json();

      const preferredLeagueId = meData?.activeLeagueId
        ? Number(meData.activeLeagueId)
        : loadedLeagues?.[0]?.id
        ? Number(loadedLeagues[0].id)
        : null;

      if (preferredLeagueId) {
        setActiveLeagueId(preferredLeagueId);
        await loadMyLeaguePermissions(preferredLeagueId);
        await loadMatches(preferredLeagueId);
      }

      setSelectedMatchId("");
      setPreferencesLoaded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setDashboardReady(true);
    }
  }

  initializeDashboard();
}, []);
useEffect(() => {
  if (!activeLeagueId) return;
  if (!["matches", "scoring"].includes(activeTab)) return;

  loadMatches(activeLeagueId);
}, [activeTab, activeLeagueId]);

useEffect(() => {
  if (!activeLeagueId) return;
  if (activeTab !== "management") return;

  loadSeries();
}, [activeTab, activeLeagueId]);
/*useEffect(() => {
    async function loadUserPreferences() {
      const res = await fetch("/api/me");

      if (!res.ok) {
        setPreferencesLoaded(true);
        return;
      }

      const data = await res.json();

      setActiveLeagueId(data.activeLeagueId ?? null);

setSelectedMatchId("");

      setPreferencesLoaded(true);
    }

    loadUserPreferences();
  }, []);
*/
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
    setShowDeliverySetupModal(false);
setPendingDeliverySetupAfterStart(false);
setPendingSecondInningsSetup(false);
setDeliverySetupReason("");
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
    activeTab === "matches" &&
    !matchesSubTab
  ) {
    setMatchesSubTab("SCHEDULED");
  }
}, [activeTab]);

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
async function loadLeagueStats(leagueId = activeLeagueId) {
  if (!leagueId) return;

  try {
    setLeagueStatsLoading(true);
    const data = await api(`/api/leagues/${leagueId}/stats`);
    setLeagueStats(data);
  } catch (err) {
    console.error("Load league stats failed:", err);
    setError("Failed to load league stats");
  } finally {
    setLeagueStatsLoading(false);
  }
}

const captaincyRows =
  leagueStats?.captaincy?.length
    ? leagueStats.captaincy
    : stats?.captaincy || [];

const wicketkeepingRows =
  leagueStats?.wicketkeeping?.length
    ? leagueStats.wicketkeeping
    : stats?.wicketkeeping || [];
    
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
  status: "SCHEDULED",
  teamACaptainId: "",
  teamBCaptainId: "",
  teamAWicketKeeperId: "",
  teamBWicketKeeperId: ""
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

async function loadMatches(leagueId = activeLeagueId) {
  try {
    if (!leagueId) {
      setMatches([]);
      setSelectedMatchId("");
      return;
    }

    const data = await api(
      `/api/matches?leagueId=${leagueId}`
    );
    setMatches(Array.isArray(data) ? data : data.matches || []);

    const leagueMatches = data.filter(
      (m) =>
        String(m.leagueId) === String(leagueId)
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

    await refreshPlayerLists();

setShowPlayerModal(false);
setPlayerForm((prev) => ({
  ...prev,
  names: "",
}));
showToast("success", "✅ Players added.");
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
async function savePlayerName() {

  await api(`/api/players/${editingPlayer.id}`,{

    method:"PATCH",

    body:JSON.stringify({

      name:editPlayerName.trim()

    })

  });
await refreshPlayerLists();

setShowEditPlayerModal(false);
setEditingPlayer(null);
setEditPlayerName("");
showToast("success", "✅ Player updated.");
  await loadTeams();

  showToast("success","✅ Player updated.");

  setShowEditPlayerModal(false);

  setEditingPlayer(null);

}  
function openEditPlayer(player) {
  setEditingPlayer(player);
  setEditPlayerName(player.name);
  setShowEditPlayerModal(true);
}
function buildLiveMatchCenter(scoreboard) {
  if (!scoreboard) return null;

  const currentInningsNo = Number(scoreboard.currentInnings || 1);

  const innings =
    scoreboard.innings?.find(
      (inn) => Number(inn.number) === currentInningsNo
    ) || scoreboard.innings?.[currentInningsNo - 1];

  if (!innings) return null;

  const runs = Number(innings.runs || 0);
  const wickets = Number(innings.wickets || 0);
  const legalBalls = Number(innings.legalBalls || 0);
  const oversPerInnings = Number(scoreboard.match?.oversPerInnings || 0);
  const maxBalls = oversPerInnings * 6;

  const oversDisplay = innings.oversDisplay || "0.0";
  const crr =
    legalBalls > 0 ? ((runs / legalBalls) * 6).toFixed(2) : "0.00";

  const target = Number(scoreboard.summary?.target || 0);
  const isSecondInnings = currentInningsNo === 2;

  const ballsRemaining =
    maxBalls > 0 ? Math.max(maxBalls - legalBalls, 0) : 0;

  const runsRequired =
    isSecondInnings && target > 0
      ? Math.max(target - runs, 0)
      : 0;

  const rrr =
    isSecondInnings && ballsRemaining > 0 && runsRequired > 0
      ? ((runsRequired / ballsRemaining) * 6).toFixed(2)
      : "-";

  const projected =
    legalBalls > 0 && maxBalls > 0
      ? Math.round((runs / legalBalls) * maxBalls)
      : runs;

  const currentPartnership =
    [...(innings.partnerships || [])]
      .reverse()
      .find((p) => p.ongoing) ||
    [...(innings.partnerships || [])].at(-1);

  const recentBalls =
    scoreboard.recentBalls?.slice(0, 6)?.map((ball) => {
      const label = ball.label || "";
      return (
        label.split(" ").slice(1).join(" ") || label
      ).replace(/[()]/g, "");
    }) || [];

  return {
    inningsNo: currentInningsNo,
    runs,
    wickets,
    oversDisplay,
    crr,
    rrr,
    projected,
    target,
    ballsRemaining,
    runsRequired,
    recentBalls,
    partnershipRuns: currentPartnership?.runs ?? 0,
    partnershipBalls: currentPartnership?.balls ?? 0,
    isSecondInnings,
  };
}

function getInstantDeliveryStatus(data) {
  const runs = Number(data.runsOffBat || 0);
  const extras = Number(data.extras || 0);
  const extraType = String(data.extraType || "NONE");
  const wicketType = String(data.wicketType || "NONE");

  if (data.isWicket) {
    if (wicketType === "RETIRED_HURT") {
      return "🏥 Retired hurt recorded.";
    }

    return "☝️ Wicket recorded.";
  }

  if (extraType === "WIDE") {
    return `⚪ Wide recorded${extras ? ` • ${extras} extra${extras > 1 ? "s" : ""}` : ""}.`;
  }

  if (extraType === "NOBALL") {
    return `🟡 No-ball recorded${extras ? ` • ${extras} extra${extras > 1 ? "s" : ""}` : ""}.`;
  }

  if (extraType === "BYE") {
    return `🏃 Bye recorded • ${extras} run${extras === 1 ? "" : "s"} added.`;
  }

  if (extraType === "LEGBYE") {
    return `🦵 Leg bye recorded • ${extras} run${extras === 1 ? "" : "s"} added.`;
  }

  if (runs === 0) {
    return "🟢 Dot ball recorded.";
  }

  if (runs === 4) {
    return "🔥 FOUR! Ball recorded and 4 runs added.";
  }

  if (runs === 6) {
    return "🚀 SIX! Ball recorded and 6 runs added.";
  }

  return `🏏 Ball recorded • ${runs} run${runs > 1 ? "s" : ""} added to the total.`;
}

async function openEditMatchModal(match) {
  try {
    const fullMatch = await api(`/api/matches/${match.id}`);

    setEditingMatch(fullMatch);

    setEditMatchForm({
      scheduledAt: fullMatch.scheduledAt
        ? new Date(fullMatch.scheduledAt).toISOString().slice(0, 16)
        : "",

      oversPerInnings: fullMatch.oversPerInnings || 20,
      powerplayOversInnings: fullMatch.powerplayOversInnings || 0,
      maxWicketsPerInnings: fullMatch.maxWicketsPerInnings || "",
      maxOversPerBowler: fullMatch.maxOversPerBowler || "",
      seriesId: fullMatch.seriesId || "",
      teamAId: String(match.teamAId || ""),
      teamBId: String(match.teamBId || ""),

      teamACaptainId: fullMatch.teamACaptainId
        ? String(fullMatch.teamACaptainId)
        : "",
      teamBCaptainId: fullMatch.teamBCaptainId
        ? String(fullMatch.teamBCaptainId)
        : "",
      teamAWicketKeeperId: fullMatch.teamAWicketKeeperId
        ? String(fullMatch.teamAWicketKeeperId)
        : "",
      teamBWicketKeeperId: fullMatch.teamBWicketKeeperId
        ? String(fullMatch.teamBWicketKeeperId)
        : "",
    });

    setShowEditMatchModal(true);
  } catch (err) {
    setError(err.message || "Unable to load match details.");
  }
}
async function handleUpdateScheduledMatch(e) {
  e.preventDefault();

  if (!editingMatch?.id) return;

  const teamAId = Number(editMatchForm.teamAId);
const teamBId = Number(editMatchForm.teamBId);

if (
  !Number.isInteger(teamAId) ||
  teamAId <= 0 ||
  !Number.isInteger(teamBId) ||
  teamBId <= 0
) {
  alert("Please select both teams.");
  return;
}

if (teamAId === teamBId) {
  alert("Team A and Team B must be different.");
  return;
}

  try {
    await api(`/api/matches/${editingMatch.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduledAt: editMatchForm.scheduledAt
          ? new Date(editMatchForm.scheduledAt).toISOString()
          : null,
        oversPerInnings: Number(editMatchForm.oversPerInnings),
        powerplayOversInnings: Number(editMatchForm.powerplayOversInnings || 0),
        maxWicketsPerInnings: editMatchForm.maxWicketsPerInnings
          ? Number(editMatchForm.maxWicketsPerInnings)
          : null,
        maxOversPerBowler: editMatchForm.maxOversPerBowler
          ? Number(editMatchForm.maxOversPerBowler)
          : null,
        seriesId: editMatchForm.seriesId || null,
        
        teamAId,
        teamBId,

        teamACaptainId: editMatchForm.teamACaptainId
          ? Number(editMatchForm.teamACaptainId)
          : null,
        teamBCaptainId: editMatchForm.teamBCaptainId
          ? Number(editMatchForm.teamBCaptainId)
          : null,
        teamAWicketKeeperId: editMatchForm.teamAWicketKeeperId
          ? Number(editMatchForm.teamAWicketKeeperId)
          : null,
        teamBWicketKeeperId: editMatchForm.teamBWicketKeeperId
          ? Number(editMatchForm.teamBWicketKeeperId)
          : null,
      }),
    });

    await loadMatches();
    await loadLeagueStats(activeLeagueId);

    if (selectedMatchId && Number(selectedMatchId) === Number(editingMatch.id)) {
      await loadSelectedMatch(selectedMatchId);
    }

    setShowEditMatchModal(false);
    setEditingMatch(null);
    setMessage("✅ Scheduled match updated");
  } catch (err) {
    setError(err.message);
  }
}
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
function buildCaptainStats(matches) {
  const captainMap = new Map();

  for (const match of matches || []) {
    const status = String(match.status || "").toUpperCase();

    if (!["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(status)) continue;

    const statusText = String(match.statusText || "").toLowerCase();

    const captains = [
      {
        playerId: match.teamACaptainId,
        teamName: match.teamA?.name,
      },
      {
        playerId: match.teamBCaptainId,
        teamName: match.teamB?.name,
      },
    ].filter((c) => c.playerId);

    for (const captain of captains) {
      if (!captainMap.has(Number(captain.playerId))) {
        captainMap.set(Number(captain.playerId), {
          playerId: Number(captain.playerId),
          played: 0,
          won: 0,
          lost: 0,
        });
      }

      const row = captainMap.get(Number(captain.playerId));
      row.played += 1;

      if (statusText.includes(String(captain.teamName || "").toLowerCase())) {
        row.won += 1;
      } else if (!statusText.includes("tied")) {
        row.lost += 1;
      }
    }
  }

  return [...captainMap.values()];
}
function buildWicketKeeperStats(matches) {
  const keeperMap = new Map();

  for (const match of matches || []) {
    const keepers = [
      match.teamAWicketKeeperId,
      match.teamBWicketKeeperId,
    ].filter(Boolean);

    for (const keeperId of keepers) {
      if (!keeperMap.has(Number(keeperId))) {
        keeperMap.set(Number(keeperId), {
          playerId: Number(keeperId),
          catches: 0,
          stumpings: 0,
          runOuts: 0,
          dismissals: 0,
        });
      }
    }

    for (const ball of match.balls || []) {
      const wicketType = String(ball.wicketType || "").toUpperCase();

      const fielderId = Number(ball.fielderId || 0);
      const assistantFielderId = Number(ball.assistantFielderId || 0);

      if (keeperMap.has(fielderId)) {
        const row = keeperMap.get(fielderId);

        if (wicketType === "CAUGHT") row.catches += 1;
        if (wicketType === "STUMPED") row.stumpings += 1;
        if (wicketType === "RUN_OUT") row.runOuts += 1;
      }

      if (keeperMap.has(assistantFielderId)) {
        const row = keeperMap.get(assistantFielderId);

        if (wicketType === "RUN_OUT") row.runOuts += 1;
      }
    }
  }

  return [...keeperMap.values()].map((row) => ({
    ...row,
    dismissals: row.catches + row.stumpings + row.runOuts,
  }));
}
function flashScoreButton(key, callback) {
  setPressedScoreKey(key);
callback();
  window.setTimeout(() => {
    setPressedScoreKey("");
  }, 180);
}
function previewScoreboardAfterBall(board, data) {
  if (!board?.innings?.length) return board;

  const inningsNo =
    Number(data.inningsNo || board.currentInnings || 1);

  const inningsIndex = inningsNo - 1;

  const totalRuns =
    Number(data.runsOffBat || 0) +
    Number(data.extras || 0);

  const isLegal =
    data.extraType !== "WIDE" &&
    data.extraType !== "NOBALL" &&
    data.wicketType !== "RETIRED_HURT";

  const isRealWicket =
    Number(data.isWicket) &&
    data.wicketType !== "RETIRED_HURT";

  const copy =
    typeof structuredClone === "function"
      ? structuredClone(board)
      : JSON.parse(JSON.stringify(board));

  const innings = copy.innings?.[inningsIndex];

  if (!innings) return board;

  const nextBallLabel = (() => {
  const legalBalls = Number(innings.legalBalls || 0);
  const nextLegalBall = isLegal ? legalBalls + 1 : legalBalls;

  const over = Math.floor(nextLegalBall / 6);
  const ball = nextLegalBall % 6 || 6;

  let result = String(totalRuns);

  if (data.wicketType === "RETIRED_HURT") {
    result = "RH";
  } else if (isRealWicket) {
    result = "W";
  } else if (data.extraType === "WIDE") {
    result = totalRuns > 1 ? `WD+${totalRuns - 1}` : "WD";
  } else if (data.extraType === "NOBALL") {
    result = Number(data.runsOffBat || 0) > 0
      ? `NB+${data.runsOffBat}`
      : "NB";
  } else if (data.extraType === "BYE") {
    result = `B${data.extras || ""}`;
  } else if (data.extraType === "LEGBYE") {
    result = `LB${data.extras || ""}`;
  }

  return `${over}.${ball} ${result}`;
})();

  innings.runs = Number(innings.runs || 0) + totalRuns;

  if (isRealWicket) {
    innings.wickets = Number(innings.wickets || 0) + 1;
  }

  if (isLegal) {
    innings.legalBalls = Number(innings.legalBalls || 0) + 1;

    const overs = Math.floor(innings.legalBalls / 6);
    const balls = innings.legalBalls % 6;

    innings.oversDisplay = `${overs}.${balls}`;
  }
const currentState = copy.currentState;

if (currentState) {
  const batRuns = Number(data.runsOffBat || 0);
  const extras = Number(data.extras || 0);

  if (currentState.strikerStats) {
    currentState.strikerStats.runs =
      Number(currentState.strikerStats.runs || 0) + batRuns;

    if (isLegal) {
      currentState.strikerStats.balls =
        Number(currentState.strikerStats.balls || 0) + 1;
    }

    currentState.strikerStats.strikeRate =
      currentState.strikerStats.balls
        ? (
            (Number(currentState.strikerStats.runs || 0) /
              Number(currentState.strikerStats.balls || 1)) *
            100
          ).toFixed(2)
        : "0.00";
  }

  if (currentState.bowlerStats) {
    const bowlerRuns =
      data.extraType === "BYE" || data.extraType === "LEGBYE"
        ? 0
        : batRuns + extras;

    currentState.bowlerStats.runs =
      Number(currentState.bowlerStats.runs || 0) + bowlerRuns;

    if (isLegal) {
function oversToBalls(oversValue) {
  const [oversPart, ballsPart] = String(oversValue || "0.0")
    .split(".")
    .map(Number);

  return (oversPart || 0) * 6 + (ballsPart || 0);
}

const previousBowlerBalls =
  currentState.bowlerStats.balls != null
    ? Number(currentState.bowlerStats.balls)
    : oversToBalls(currentState.bowlerStats.overs);

const currentBalls = previousBowlerBalls + 1;

      currentState.bowlerStats.balls = currentBalls;
      currentState.bowlerStats.overs =
        `${Math.floor(currentBalls / 6)}.${currentBalls % 6}`;
    }

    if (isRealWicket) {
      currentState.bowlerStats.wickets =
        Number(currentState.bowlerStats.wickets || 0) + 1;
    }
  }
}
copy.recentBalls = [
  {
    id: `optimistic-${Date.now()}`,
    label: nextBallLabel,
    optimistic: true,
  },
  ...(copy.recentBalls || []),
].slice(0, 20);

  return copy;
}
async function loadPointsTable(leagueId) {
  if (!leagueId) return;

  const data = await api(`/api/leagues/${leagueId}/points-table`);
  setPointsTable(data);
}

async function applyRetiredHurtCorrection({
  inningsNo,
  afterSequence,
  retiredPlayerId,
  replacementPlayerId,
}) {
  try {
    setCorrectionSaving(true);

setCorrectionStatus(
  "🏏 Replaying innings..."
);
    const result = await api(
      `/api/matches/${selectedMatchId}/corrections/retired-hurt`,
      {
        method: "POST",
body: JSON.stringify({
  inningsNo: correctionForm.inningsNo,
  afterBallId: correctionForm.afterBallId,
  retiredPlayerId: correctionForm.retiredPlayerId,
  replacementPlayerId: correctionForm.replacementPlayerId,
  replacementOutBallId: correctionForm.replacementOutBallId,
  newBatterAfterReplacementId: correctionForm.newBatterAfterReplacementId,
}),
      }
    );
    setCorrectionStatus(
  "✅ Scorecard recalculated."
);
setTimeout(() => {
  setShowCorrectionModal(false);
}, 1500);
setLastCorrectionId(result.correctionId);
    await loadSelectedMatch(selectedMatchId);
    await loadMatches();
    await loadLeagueStats(activeLeagueId);
    setShowCorrectionModal(false);

setMessage(
  `✅ Correction applied

• ${result.updatedBalls} deliveries replayed
• Trinadh retired hurt inserted
• Batting order recalculated

Rollback available.`
);
    showToast?.(
  "success",
  "Correction completed successfully."
);

  } catch (err) {
    setError(err.message);
  } finally{
    setCorrectionSaving(false);
  }
}

async function rollbackCorrection(correctionId) {
  try {
    setRollbackSaving(true);

setCorrectionStatus(
  "↩️ Restoring original scorecard..."
);
    await api(
      `/api/matches/${selectedMatchId}/corrections/${correctionId}/rollback`,
      { method: "POST" }
    );
    setCorrectionStatus(
  "✅ Rollback completed."
);

setRollbackSaving(false);

setLastCorrectionId(null);
    await loadSelectedMatch(selectedMatchId);
    await loadMatches();

    setMessage("↩️ Correction rolled back successfully.");
    showToast?.(
  "success",
  "Rollback completed successfully."
);
  } catch (err) {
    setError(err.message);
  }
}
async function handleShareMatch() {
  if (!scoreboard) return;

  const shareCode = scoreboard?.match?.shareCode;
  const shareUrl = `${window.location.origin}/live/${shareCode}`;

  const innings =
    scoreboard.innings?.[scoreboard.innings.length - 1];

  const leagueName =
    scoreboard.match?.leagueName ||
    activeLeague?.name ||
    "Cric4All";

  const teamA = scoreboard.match?.teamAName || "Team A";
  const teamB = scoreboard.match?.teamBName || "Team B";

  const scoreLine = innings
    ? `${innings.teamName || ""} ${innings.runs ?? 0}/${innings.wickets ?? 0} (${innings.oversDisplay || "0.0"} ov)`
    : "Score loading...";

  const statusText =
    scoreboard.summary?.statusText ||
    scoreboard.summary?.targetText ||
    "Follow the live scorecard for updates.";

  const shareText = `
🏏 LIVE CRICKET MATCH

${leagueName}
${teamA} 🆚 ${teamB}

━━━━━━━━━━━━━━━━━━
📊 LIVE SCORE

${scoreLine}
${statusText}

━━━━━━━━━━━━━━━━━━
📲 Watch LIVE Scorecard

${shareUrl}

━━━━━━━━━━━━━━━━━━
🏏 Cric4All — Live Cricket Scoring, Scorecards & Player Stats
`.trim();

  try {
    if (navigator.share) {
      await navigator.share({
        title: `${teamA} vs ${teamB}`,
        text: shareText,
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareText);
      showToast?.("success", "📋 Live score message copied.");
    }
  } catch (err) {
    console.error(err);
  }
}
const loadLeagues = async (leagueIdToValidate = null) => {
  const response = await fetch("/api/leagues");
  const data = await response.json();

  setLeagues(data || []);

  const idToCheck = leagueIdToValidate ?? activeLeagueId;

  if (idToCheck) {
    const refreshedLeague = data.find(
      (l) => String(l.id) === String(idToCheck)
    );

    if (!refreshedLeague) {
      setActiveLeagueId(null);
      setSelectedTeamId("");
    }
  }

  return data || [];
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

async function loadSelectedMatch(matchId, options = {}) {
  const {
    loadDetail = false,
    loadStatsData = false,
    syncBallForm = true,
  } = options;

  if (!matchId) {
    setMatchDetail(null);
    setScoreboard(null);
    setStats({ batting: [], bowling: [] });
    return;
  }

  fetch("/api/user/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activeLeagueId,
      activeMatchId: matchId,
    }),
  }).catch(() => {});

  const board = await api(`/api/scoreboard/${matchId}`);
  setScoreboard(board);

  if (syncBallForm && board?.currentState && !showDeliverySetupModal) {
    setBallForm((prev) => ({
      ...prev,
      strikerId: board.currentState.strikerId ?? prev.strikerId,
      nonStrikerId: board.currentState.nonStrikerId ?? prev.nonStrikerId,
      bowlerId: board.currentState.bowlerId ?? prev.bowlerId,
    }));
  }

  if (loadDetail) {
    const detail = await api(`/api/matches/${matchId}`);
    setMatchDetail(detail);
  }

  if (loadStatsData) {
    const statData = await api(`/api/stats/${matchId}`);
    setStats(statData);
  }
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
    if (selectedMatchId) {
       if (!pageVisible) return;
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

useEffect(() => {
  if (showDeliverySetupModal) return;
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
      await refreshPlayerLists();
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
  teamACaptainId: matchForm.teamACaptainId
  ? Number(matchForm.teamACaptainId)
  : null,

teamBCaptainId: matchForm.teamBCaptainId
  ? Number(matchForm.teamBCaptainId)
  : null,

teamAWicketKeeperId: matchForm.teamAWicketKeeperId
  ? Number(matchForm.teamAWicketKeeperId)
  : null,

teamBWicketKeeperId: matchForm.teamBWicketKeeperId
  ? Number(matchForm.teamBWicketKeeperId)
  : null,
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
  status: "SCHEDULED",
  seriesId: "",
  teamACaptainId: "",
  teamBCaptainId: "",
  teamAWicketKeeperId: "",
  teamBWicketKeeperId: "",
});

const teamA = teams.find(
  (t) => Number(t.id) === Number(match.teamAId)
);

const teamB = teams.find(
  (t) => Number(t.id) === Number(match.teamBId)
);

const created = {
  ...match,
  teamAName: teamA?.name,
  teamBName: teamB?.name,
};

setCreatedMatchInfo(created);

await loadMatches(activeLeagueId);

setShowMatchCreatedModal(true);
setMessage("");
setError("");

showToast?.("success", "✅ Match created successfully.");
    } catch (err) {
      setError(err.message);
    }
  }

async function handleStartMatch(match) {
  if (!match?.id) {
    setError("Match was not found.");
    return;
  }

  try {
    setMessage("");
    setError("");

    const matchId = Number(match.id);

    setSelectedMatchId(String(matchId));
    setEditingMatch(match);
    setStartMatchData({
      matchId: String(matchId),
      battingFirstTeamId:
        match.battingFirstTeamId || match.battingFirstTeam?.id || "",
    });

    const battingFirstTeamId =
      match.battingFirstTeamId || match.battingFirstTeam?.id || "";

    if (!battingFirstTeamId) {
      setShowStartMatchModal(true);
      return;
    }

    await api(`/api/matches/${matchId}/start`, {
      method: "POST",
      body: JSON.stringify({
        battingFirstTeamId: Number(battingFirstTeamId),
      }),
    });

    await loadMatches(activeLeagueId);

    await openScoringAfterBattingFirst(matchId);
  } catch (err) {
    setError(err.message || "Unable to start match.");
  }
}
  
const isMatchCompleted = scoreboard?.match?.status === "COMPLETED";
const isMatchLocked = scoreboard?.match?.status ===  "COMPLETED_LOCKED";
const isMatchCorrected = scoreboard?.match?.status ===  "COMPLETED_CORRECTED";
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
async function handleEndFirstInnings() {
  if (!selectedMatchId) return;

  const confirmed = window.confirm(
  "End 1st innings and start 2nd innings setup?\n\nUse this when the batting side is finished before all scheduled overs are bowled."
);

  if (!confirmed) return;

  try {
    await api(`/api/matches/${selectedMatchId}/end-innings`, {
      method: "POST",
    });

    await loadSelectedMatch(selectedMatchId);

    setBallForm((prev) => ({
      ...prev,
      inningsNo: "2",
      strikerId: "",
      nonStrikerId: "",
      bowlerId: "",
    }));

    setDeliverySetupReason(
      "🏏 2nd innings is ready. Select the opening striker, non-striker, and bowler before scoring."
    );

    setShowDeliverySetupModal(true);

    setMessage("✅ First innings ended. Set up the 2nd innings.");
  } catch (err) {
    setError(err.message);
  }
}
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
setOverCompleteNotice("");

  if (ballSaveInFlight) return;

  if (scoreboard?.match?.status === "COMPLETED") {
    setError("Match has already ended");
    return;
  }

  if (!selectedMatchId) {
    setError("Please select a match");
    return;
  }
const safeInningsNo =
  pendingSecondInningsSetup || Number(ballForm?.inningsNo) === 2
    ? 2
    : getSafeScoringInningsNo(scoreboard, data);

data = {
  ...data,
  inningsNo: safeInningsNo,
};
  if (
    !ballForm.strikerId ||
    !ballForm.nonStrikerId ||
    !ballForm.bowlerId
  ) {
    setDeliverySetupReason(
      "Please select striker, non-striker, and bowler before scoring this ball."
    );
    setShowDeliverySetupModal(true);
    return;
  }

  if (isSavingBall) return;

  setIsSavingBall(true);
  setOptimisticScoreboard(previewScoreboardAfterBall(scoreboard, data));

  try {
    const instantMessage = getInstantDeliveryStatus(data);
    setInstantDeliveryStatus(instantMessage);
/*console.log("SUBMIT BALL INNINGS DEBUG", {
  formInningsNo: ballForm?.inningsNo,
  dataInningsNo: data?.inningsNo,
  boardCurrentInnings: scoreboard?.currentInnings,
  boardStateInningsNo: scoreboard?.currentState?.inningsNo,
});
*/
    const savedBall = await api("/api/balls", {
      method: "POST",
      body: JSON.stringify(data),
    });
if (scoreboard?.currentState && !showDeliverySetupModal) {  
setBallForm((prev) => ({
  ...prev,
  inningsNo: Number(data.inningsNo),
  extraType: "NONE",
  runsOffBat: "0",
  extras: "0",
  isWicket: false,
  wicketType: "NONE",
  newBatterId: "",
  dismissedPlayerId: "",
  note: "",
  fielderId: "",
  assistantFielderId: "",
  wicketNote: "",
}));
  }
    setShowAdvancedSheet(false);

    const updatedBoard = await api(`/api/scoreboard/${selectedMatchId}`);

    const updatedCurrentInningsNo = Number(
      updatedBoard?.currentInnings || data.inningsNo
    );

    const updatedActiveInnings =
      updatedBoard?.innings?.[updatedCurrentInningsNo - 1];

    const updatedMaxLegalBalls =
      Number(updatedBoard?.match?.oversPerInnings || 0) * 6;

    const updatedIsSecondInnings = updatedCurrentInningsNo === 2;

    const updatedIsFinalBallBowled =
      updatedIsSecondInnings &&
      updatedMaxLegalBalls > 0 &&
      Number(updatedActiveInnings?.legalBalls || 0) >= updatedMaxLegalBalls;

    const updatedTarget = Number(updatedBoard?.summary?.target || 0);
    const updatedRuns = Number(updatedActiveInnings?.runs || 0);

    const updatedIsChaseComplete =
      updatedIsSecondInnings &&
      updatedTarget > 0 &&
      updatedRuns >= updatedTarget;

    const firstInningsJustEnded =
  Number(data.inningsNo) === 1 &&
  savedBall?.inningsEnded === true &&
  Number(savedBall?.nextInningsNo) === 2 &&
  ["OVERS_COMPLETED", "ALL_OUT"].includes(savedBall?.inningsEndedReason);

await loadSelectedMatch(selectedMatchId, {
  syncBallForm: true,
});

const overJustCompleted =
  data.extraType !== "WIDE" &&
  data.extraType !== "NOBALL" &&
  Number(scoreboard?.currentState?.nextBallInOver) === 6;

//const legalBalls =
//  scoreboard.currentState.legalBalls + 1;

//const completedOvers = Math.floor(legalBalls / 6);

if (scorerMode && overJustCompleted) {
//  setOverCompleteNotice(
//`✅ Over complete `
    //    `✅ Over complete • ${legalBalls ?? 0}/${data.wickets ?? 0} • ${data.oversDisplay ?? 0} ov`
//  );
  setOverCompleteNotice("");

} else {
  setOverCompleteNotice("");
}

    setOptimisticScoreboard(null);
    setInstantDeliveryStatus("");

if (firstInningsJustEnded) {
  setShowBowlerModal(false);
  setShowDeliverySetupModal(false);
  setMustChangeBowler(false);
  setPendingBallData(null);
  setOptimisticScoreboard(null);
  setInstantDeliveryStatus("");

await loadSelectedMatch(selectedMatchId, {
  syncBallForm: false,
});
  //await loadMatches();

  setPendingSecondInningsSetup(true);
if (scoreboard?.currentState && !showDeliverySetupModal) { 
  setBallForm((prev) => ({
    ...prev,
    inningsNo: 2,
    strikerId: "",
    nonStrikerId: "",
    bowlerId: "",
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
    wicketNote: "",
  }));
}
  setDeliverySetupReason(
    "🏏 2nd innings is ready. Select the opening striker, non-striker, and bowler before scoring."
  );

  setMessage("✅ 1st innings ended. Setup 2nd innings to continue scoring.");

  setTimeout(() => {

    setShowDeliverySetupModal(true);
  }, 200);

  return;
}
if (scoreboard?.currentState && !showDeliverySetupModal) { 
    setBallForm((prev) => ({
      ...prev,
      inningsNo: Number(data.inningsNo),
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
      wicketNote: "",
    }));
  }
    if (updatedIsFinalBallBowled || updatedIsChaseComplete) {
      setShowBowlerModal(false);
      setMustChangeBowler(false);
      setPendingBallData(null);

      setMessage(
        "🏁 Match ended. Review the scorecard, then click Lock Match to preserve the final scoreboard."
      );

      //await loadMatches();
      //await loadLeagueStats(activeLeagueId);
      return;
    }

    const wasLegalLastBallOfOver =
      data.extraType !== "WIDE" &&
      data.extraType !== "NOBALL" &&
      Number(scoreboard?.currentState?.nextBallInOver) === 6;

    if (wasLegalLastBallOfOver) {
      setPendingBallData(null);
      setMustChangeBowler(true);
      setShowBowlerModal(true);
      return;
    }

    setMessage(instantMessage);
  } catch (err) {
    setOptimisticScoreboard(null);
    setInstantDeliveryStatus("");

    if (err.message?.includes("BOWLER_CONSECUTIVE_OVER")) {
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
          data.isWicket && data.wicketType !== "RETIRED_HURT" ? 1 : 0,

        wicketType: data.isWicket ? data.wicketType : "NONE",

        dismissedPlayerId: data.isWicket
          ? Number(data.dismissedPlayerId || data.strikerId)
          : null,

        newBatterId: data.newBatterId ? Number(data.newBatterId) : null,

        note: data.note,
        matchStatus: data.matchStatus,
      });

      setShowBowlerModal(true);
      return;
    }

    setError(err.message);
    showToast("error", err.message);
  } finally {
    setIsSavingBall(false);
    setInstantDeliveryStatus("");
  }
}
  
async function selectLeague(league) {
  setShowDeliverySetupModal(false);
setPendingDeliverySetupAfterStart(false);
setPendingSecondInningsSetup(false);
setDeliverySetupReason("");
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
setSelectedExtraOption(String(extraRuns));
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
    setSelectedExtraOption("");
  } catch (err) {
    setError(err.message);
  }
}
async function quickWicket(type = "BOWLED") {
  setRunOutRuns(type === "RUN_OUT" ? 0 : null);
  setEndInningsAfterWicket(false);
  setBallForm((prev) => ({
    ...prev,
    isWicket: true,
    wicketType: type,
    dismissedPlayerId: type === "RUN_OUT" ? prev.dismissedPlayerId || prev.strikerId : prev.strikerId,
    newBatterId: "",
    fielderId: "",
    assistantFielderId: "",
    wicketNote: "",
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

    if (!dismissedPlayerId) {
      setError("Please select who is out.");
      return;
    }

const noMoreBattersAvailable =
  Array.isArray(wicketNewBatterOptions) &&
  wicketNewBatterOptions.length === 0;

if (
  !endInningsAfterWicket &&
  !ballForm.newBatterId &&
  !noMoreBattersAvailable
) {
  setError("Please select a new batter or choose end innings.");
  return;
}

const selectedNewBatterIsValid =
  endInningsAfterWicket ||
  noMoreBattersAvailable ||
  wicketNewBatterOptions.some(
    (player) => String(player.id) === String(ballForm.newBatterId)
  );

if (!selectedNewBatterIsValid) {
  setError("Invalid new batter selected. Please select a valid replacement batter or choose end innings.");
  setBallForm((prev) => ({
    ...prev,
    newBatterId: "",
  }));
  return;
}
    const runsOffBat = isRunOut
      ? Number(runOutRuns)
      : Number(ballForm.runsOffBat || 0);

    const dismissedPlayer = battingTeam?.players?.find(
      (p) => Number(p.id) === dismissedPlayerId
    );

    const newBatter = noMoreBattersAvailable
      ? null
      : battingTeam?.players?.find(
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
        ballForm.isWicket && ballForm.wicketType !== "RETIRED_HURT" ? 1 : 0,

      wicketType: ballForm.isWicket ? ballForm.wicketType : "NONE",

      dismissedPlayerId,
      /* newBatterId: noMoreBattersAvailable
        ? null
        : Number(ballForm.newBatterId),
      */
newBatterId:
  endInningsAfterWicket || noMoreBattersAvailable
    ? null
    : Number(ballForm.newBatterId),

endInningsAfterWicket: Boolean(endInningsAfterWicket),

      note: ballForm.note,
      matchStatus: scoreboard?.match?.status,

      fielderId: ballForm.fielderId ? Number(ballForm.fielderId) : null,

      assistantFielderId: ballForm.assistantFielderId
        ? Number(ballForm.assistantFielderId)
        : null,

      wicketNote: ballForm.wicketNote || null,
    });

    const wicketText = ballForm.wicketType
      ?.replaceAll("_", " ")
      ?.toLowerCase();
const shouldOpenSecondInningsSetup =
  Boolean(endInningsAfterWicket) &&
  Number(ballForm.inningsNo) === 1;

 if (noMoreBattersAvailable) {
  setMessage(
    `🚨 ${dismissedPlayer?.name || "Batter"} is out (${wicketText}). ${
      runsOffBat
    } ${runsOffBat === 1 ? "run" : "runs"} awarded. Innings ended.`
  );
} else {
  setMessage(
    `🚨 ${dismissedPlayer?.name || "Batter"} is out (${wicketText}). ${
      runsOffBat
    } ${runsOffBat === 1 ? "run" : "runs"} awarded. ${
      newBatter?.name || "New batter"
    } comes in.`
  );
}

/* CRITICAL FIX: refresh after every wicket */
await loadSelectedMatch(selectedMatchId, {
  loadDetail: true,
  loadStatsData: true,
  syncBallForm: !shouldOpenSecondInningsSetup,
});

if (shouldOpenSecondInningsSetup) {
  setBallForm((prev) => ({
    ...prev,
    inningsNo: "2",
    strikerId: "",
    nonStrikerId: "",
    bowlerId: "",
    isWicket: false,
    wicketType: "NONE",
    dismissedPlayerId: "",
    newBatterId: "",
    runsOffBat: "0",
    extras: "0",
    extraType: "NONE",
  }));

  setDeliverySetupReason(
    "1st innings ended. Select opening striker, non-striker, and bowler for the 2nd innings."
  );

  setShowWicketModal(false);
  setPendingDeliverySetupAfterStart(true);
  setShowDeliverySetupModal(true);
}

await loadMatches(activeLeagueId);

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
  runsOffBat: "0",
  extras: "0",
  extraType: "NONE",
}));
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

await loadSelectedMatch(matchId, {
  loadDetail: true,
  loadStatsData: true,
  syncBallForm: true,
});

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
function getWicketDismissedPlayerId(form) {
  const wicketType = String(form?.wicketType || "").toUpperCase();

  if (wicketType === "RUN_OUT") {
    return Number(form?.dismissedPlayerId || 0);
  }

  return Number(form?.dismissedPlayerId || form?.strikerId || 0);
}
function getWicketDismissedPlayerId(form) {
  const wicketType = String(form?.wicketType || "").toUpperCase();

  if (wicketType === "RUN_OUT") {
    return Number(form?.dismissedPlayerId || 0);
  }

  return Number(form?.dismissedPlayerId || form?.strikerId || 0);
}

function getUniqueBalls(...sources) {
  const map = new Map();

  sources.flat().filter(Boolean).forEach((ball) => {
    const key = ball.id || ball.sequence || `${ball.inningsNo}-${ball.overNo}-${ball.ballInOver}`;
    map.set(String(key), ball);
  });

  return [...map.values()];
}

const availableNewBatters = useMemo(() => {
  if (!battingTeam?.players?.length) return [];

  const inningsNo = Number(ballForm.inningsNo || scoreboard?.currentInnings || 1);

  const allBalls = getUniqueBalls(
    matchDetail?.balls || [],
    scoreboard?.balls || [],
    scoreboard?.match?.balls || []
  ).filter((ball) => Number(ball.inningsNo || inningsNo) === inningsNo);

  const alreadyOutIds = new Set(
    allBalls
      .filter((ball) => {
        const dismissedPlayerId = Number(ball.dismissedPlayerId);
        if (!dismissedPlayerId) return false;

        const wicketType = String(ball.wicketType || "").trim().toUpperCase();

        return Boolean(ball.isWicket) && wicketType !== "RETIRED_HURT";
      })
      .map((ball) => Number(ball.dismissedPlayerId))
  );

  const strikerId = Number(ballForm.strikerId || 0);
  const nonStrikerId = Number(ballForm.nonStrikerId || 0);
  const dismissedPlayerId = getWicketDismissedPlayerId(ballForm);

  return battingTeam.players.filter((player) => {
    const playerId = Number(player.id);

    if (!playerId) return false;
    if (alreadyOutIds.has(playerId)) return false;
    if (playerId === strikerId) return false;
    if (playerId === nonStrikerId) return false;
    if (dismissedPlayerId && playerId === dismissedPlayerId) return false;

    return true;
  });
}, [
  battingTeam?.players,
  ballForm.inningsNo,
  ballForm.strikerId,
  ballForm.nonStrikerId,
  ballForm.dismissedPlayerId,
  ballForm.wicketType,
  matchDetail?.balls,
  scoreboard?.balls,
  scoreboard?.match?.balls,
  scoreboard?.currentInnings,
]);
const wicketNewBatterOptions = useMemo(() => {
  if (!battingTeam?.players?.length) return [];

  const inningsNo = Number(ballForm.inningsNo || scoreboard?.currentInnings || 1);

  const activeInnings =
    scoreboard?.innings?.find((inn) => Number(inn.number) === inningsNo) ||
    scoreboard?.innings?.[inningsNo - 1];

  const scorecardRows =
    activeInnings?.battingRows ||
    activeInnings?.batting ||
    activeInnings?.battingStats ||
    [];

  const alreadyOutIds = new Set();

  scorecardRows.forEach((row) => {
    const dismissal = String(row.dismissal || "").trim().toLowerCase();

if (
  dismissal &&
  dismissal !== "not out" &&
  dismissal !== "-" &&
  !dismissal.includes("retired hurt")
) {
  alreadyOutIds.add(Number(row.playerId));
}
  });

  const currentStrikerId = Number(ballForm.strikerId || 0);
  const currentNonStrikerId = Number(ballForm.nonStrikerId || 0);
  const currentDismissedId = Number(
    ballForm.wicketType === "RUN_OUT"
      ? ballForm.dismissedPlayerId
      : ballForm.dismissedPlayerId || ballForm.strikerId
  );

  return battingTeam.players.filter((player) => {
    const playerId = Number(player.id);

    if (!playerId) return false;
    if (alreadyOutIds.has(playerId)) return false;
    if (playerId === currentStrikerId) return false;
    if (playerId === currentNonStrikerId) return false;
    if (currentDismissedId && playerId === currentDismissedId) return false;

    return true;
  });
}, [
  battingTeam?.players,
  scoreboard?.innings,
  scoreboard?.currentInnings,
  ballForm.inningsNo,
  ballForm.strikerId,
  ballForm.nonStrikerId,
  ballForm.dismissedPlayerId,
  ballForm.wicketType,
]);
useEffect(() => {
  if (!ballForm.isWicket) return;
  if (!ballForm.newBatterId) return;

  const stillAllowed = wicketNewBatterOptions.some(
    (player) => String(player.id) === String(ballForm.newBatterId)
  );

  if (!stillAllowed) {
    setBallForm((prev) => ({
      ...prev,
      newBatterId: "",
    }));
  }
}, [
  ballForm.isWicket,
  ballForm.newBatterId,
  availableNewBatters,
]);

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
  if (!leagueId) return;

  try {
    setPermissionsLoading(true);

    const data = await api(
      `/api/leagues/${leagueId}/permissions/me`
    );

    setPermissions(data.permissions);
  } catch (err) {
    console.error(err);

    const selected = leagues.find(
      (l) => String(l.id) === String(leagueId)
    );

    if (selected?.isFollowing && !selected?.role && !selected?.membershipRole) {
      setPermissions({
        canViewDashboard: true,
        canViewStats: true,
        canViewMatches: true,
        canViewManagement: false,
        canViewScoring: false,
        canCreateLeague: false,
        canCreateTeam: false,
        canCreateMatch: false,
        canDeleteLeague: false,
        canDeleteTeam: false,
        canDeletePlayer: false,
        canDeleteMatch: false,
        canScoreMatch: false,
        canEditScore: false,
        canUndoBall: false,
      });
    } else {
      setPermissions(null);
      setError(err.message);
    }
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
          bowlerId: newBowlerId,
          inningsNo: Number(ballForm.inningsNo),
          strikerId: Number(ballForm.strikerId),
          nonStrikerId: Number(ballForm.nonStrikerId),
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
    s === "COMPLETED_CORRECTED" ||
    s === "COMPLETED_ABANDONED" ||
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



async function confirmStartMatch() {
  const matchId = Number(startMatchData.matchId || selectedMatchId);

  if (!matchId || !startMatchData.battingFirstTeamId) {
    setError("Please select batting first team.");
    return;
  }

  try {
    await api(`/api/matches/${matchId}/start`, {
      method: "POST",
      body: JSON.stringify({
        battingFirstTeamId: Number(startMatchData.battingFirstTeamId),
      }),
    });

    setShowStartMatchModal(false);
    setMessage("✅ Match started. Opening scoring...");

    await loadMatches(activeLeagueId);

    await openScoringAfterBattingFirst(matchId);
  } catch (err) {
    setError(err.message || "Unable to start match.");
  }
}
useEffect(() => {
  if (!pendingDeliverySetupAfterStart) return;
  if (activeTab !== "scoring") return;
  if (!selectedMatchId) return;
  if (!scoreboard?.match) return;
  if (!matchDetail) return;
  if (showStartMatchModal) return;

  const hasBalls =
    (matchDetail?.balls || []).length > 0;

  if (hasBalls) {
    setPendingDeliverySetupAfterStart(false);
    return;
  }

  setDeliverySetupReason(
    "Select opening striker, non-striker, and bowler before scoring the first ball."
  );

  setShowDeliverySetupModal(true);
  setPendingDeliverySetupAfterStart(false);
}, [
  pendingDeliverySetupAfterStart,
  activeTab,
  selectedMatchId,
  scoreboard?.match?.id,
  matchDetail?.id,
  showStartMatchModal,
]);

useEffect(() => {
  if (activeTab !== "scoring") return;

  if (!selectedMatchId) {
    setMatchDetail(null);
    setScoreboard(null);
    setStats({ batting: [], bowling: [] });
    setOptimisticScoreboard(null);
    setShowAdvancedSheet(false);
    setShowBowlerModal(false);
    setShowWicketModal(false);
    setShowExtrasModal(false);
    setShowRetiredHurtModal(false);
  }
}, [activeTab, selectedMatchId]);

useEffect(() => {
  if (!pendingSecondInningsSetup) return;

  setShowDeliverySetupModal(true);
  setPendingSecondInningsSetup(false);
}, [pendingSecondInningsSetup]);



const scoringMatches = useMemo(() => {
  let list = [...(matches || [])];

  if (activeLeagueId) {
    list = list.filter(
      (match) => Number(match.leagueId) === Number(activeLeagueId)
    );
  }

  if (contextFilters?.seriesIds?.length) {
    list = list.filter((match) =>
      contextFilters.seriesIds.includes(Number(match.seriesId))
    );
  }

  if (contextFilters?.years?.length) {
    list = list.filter((match) => {
      const matchDate =
        match.startedAt || match.scheduledAt || match.endedAt || match.createdAt;

      if (!matchDate) return false;

      return contextFilters.years.includes(new Date(matchDate).getFullYear());
    });
  }

  return sortMatchesForSelection(list);
}, [matches, activeLeagueId, contextFilters]);

useEffect(() => {
  if (!selectedMatchId) return;

  const stillExists = scoringMatches.some(
    (match) => Number(match.id) === Number(selectedMatchId)
  );

  if (!stillExists) {
    setSelectedMatchId("");
    setMatchDetail(null);
    setScoreboard(null);
    setOptimisticScoreboard(null);
  }
}, [scoringMatches, selectedMatchId]);

function triggerQuickAction(actionKey, callback) {
  setActiveQuickAction(actionKey);

  callback();

  setTimeout(() => {
    setActiveQuickAction(null);
  }, 50); // was 400
}

const editMatchLeagueTeams = useMemo(() => {
  if (!editingMatch) return [];

  const targetLeagueId = Number(
    editingMatch.leagueId || activeLeagueId
  );

  return [...(teams || [])]
    .filter(
      (team) =>
        Number(team.leagueId) === targetLeagueId
    )
    .sort((first, second) =>
      String(first.name || "").localeCompare(
        String(second.name || ""),
        undefined,
        {
          sensitivity: "base",
          numeric: true,
        }
      )
    );
}, [teams, editingMatch, activeLeagueId]);

const editTeamA = useMemo(
  () =>
    editMatchLeagueTeams.find(
      (team) =>
        Number(team.id) ===
        Number(editMatchForm.teamAId)
    ) || null,
  [editMatchLeagueTeams, editMatchForm.teamAId]
);

const editTeamB = useMemo(
  () =>
    editMatchLeagueTeams.find(
      (team) =>
        Number(team.id) ===
        Number(editMatchForm.teamBId)
    ) || null,
  [editMatchLeagueTeams, editMatchForm.teamBId]
);

const displayScoreboard = optimisticScoreboard || scoreboard;

const matchInsights = buildMatchInsights(displayScoreboard);

const liveMatchCenter =
  buildLiveMatchCenter(displayScoreboard || scoreboard);

const normalizedMatchStatus = String(
  scoreboard?.match?.status || ""
)
  .trim()
  .replace(/[\s-]+/g, "_")
  .toUpperCase();

const canShowAiAnalysis =
  normalizedMatchStatus === "COMPLETED" ||
  normalizedMatchStatus === "COMPLETED_LOCKED" ||
  normalizedMatchStatus === "COMPLETED_CORRECTED";

const activeInnings = useMemo(() => {
  const innings = displayScoreboard?.innings || [];

  if (!innings.length) return null;

  const currentInningsNo =
    Number(displayScoreboard?.currentInnings) ||
    Number(ballForm?.inningsNo) ||
    1;

  return innings[currentInningsNo - 1] || innings[0];
}, [displayScoreboard, ballForm?.inningsNo]);


const recentBalls =
  displayScoreboard?.recentBalls || [];
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
  ["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED", "ABANDONED"].includes(
    String(scoreboard?.match?.status || "").toUpperCase()
  );

const currentInningsNo = Number(scoreboard?.currentInnings || ballForm.inningsNo || 1);

const activeInningsBalls =
  scoreboard?.innings?.[currentInningsNo - 1]?.balls || 0;

const needsDeliverySetup =
  activeTab === "scoring" &&
  scoringSubTab === "ADVANCED" &&
  matchDetail &&
  scoreboard &&
  !isMatchReadyToLock &&
  (
    !ballForm.strikerId ||
    !ballForm.nonStrikerId ||
    !ballForm.bowlerId
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
function getNextBallLabel() {
  const state = scoreboard?.currentState;

  if (!state) return "-";

  if (state.nextBallLabel) {
    return state.nextBallLabel;
  }

  if (
    state.nextOver !== undefined &&
    state.nextBallInOver !== undefined
  ) {
    return `${state.nextOver}.${state.nextBallInOver}`;
  }

  if (
    state.nextOverNo !== undefined &&
    state.nextBallInOver !== undefined
  ) {
    return `${state.nextOverNo}.${state.nextBallInOver}`;
  }

  if (
    state.nextOverNo !== undefined &&
    state.nextBallNo !== undefined
  ) {
    return `${state.nextOverNo}.${state.nextBallNo}`;
  }

  return "-";
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
const currentBowlerStats =
  displayScoreboard?.currentState?.bowlerStats;
const bowlerChangeScore = {
  score: activeInnings
    ? `${activeInnings.runs}/${activeInnings.wickets}`
    : "-",
  overs: activeInnings?.oversDisplay || "0.0",
  crr: liveMatchCenter?.crr || "-",
};
const previousOverInfo = (() => {
  const latestBall = recentBalls?.[0];

  if (!latestBall) {
    return {
      overNo: "",
      balls: [],
    };
  }

  const label = String(latestBall.label || "");
  const overNo = label.split(".")[0];

  const balls = (recentBalls || [])
    .filter((ball) => {
      const ballLabel = String(ball.label || "");
      return ballLabel.split(".")[0] === overNo;
    })
    .reverse();

  return {
    overNo,
    balls,
  };
})();

function getMatchOptionLabel(match) {
  const teams = `${match.teamAName || "Team A"} vs ${
    match.teamBName || "Team B"
  }`;

  const status = String(match.status || "")
    .replaceAll("_", " ")
    .toUpperCase();

  const timeline = getMatchTimelineText(match);

  const score =
    match.scoreSummary ||
    match.liveScore ||
    `${match.oversPerInnings || "-"} overs`;

    if (match.status === "COMPLETED_LOCKED") {
        return `${teams} • ${status} • ${score}`;
    }
    if (match.status === "COMPLETED") {
        return `${teams} • ${status} • ${score}`;
    }
    if (match.status === "COMPLETED_CORRECTED") {
        return `${teams} • ${status} • ${score}`;
    }
    if (match.status === "ABANDONED") {
        return `${teams} • ${status}`;
    }
    if (match.status === "SCHEDULED") {
        return `${teams} • ${status} • ${timeline}`;
    }
    if (match.status === "IN_PROGRESS") {
        return `${teams} • ${status} • ${timeline} • ${score}`;
    }else{
            return `${teams} • ${status} • ${timeline}` // • ${score};
    }   
}

function getMatchSortTime(match) {
  return new Date(
    match.startedAt ||
      match.scheduledAt ||
      match.endedAt ||
      match.createdAt ||
      0
  ).getTime();
}

function sortMatchesForSelection(matches) {
  const statusRank = {
    IN_PROGRESS: 1,
    ACTIVE: 1,
    SCHEDULED: 2,
    COMPLETED: 3,
    COMPLETED_LOCKED: 3,
    COMPLETED_CORRECTED: 3,
    ABANDONED: 4,
  };

  return [...matches].sort((a, b) => {
    const aStatus = String(a.status || "").toUpperCase();
    const bStatus = String(b.status || "").toUpperCase();

    const rankDiff =
      (statusRank[aStatus] || 9) - (statusRank[bStatus] || 9);

    if (rankDiff !== 0) return rankDiff;

    if (aStatus === "SCHEDULED") {
      return getMatchSortTime(a) - getMatchSortTime(b);
    }

    return getMatchSortTime(b) - getMatchSortTime(a);
  });
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
    [...(team.players || [])]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((player) => {
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
useEffect(() => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  setVoiceSupported(Boolean(SpeechRecognition));
}, []);
function handleVoiceCommand(command) {
  const text = String(command || "").toLowerCase().trim();

  if (!scorerMode) return;
  if (isSavingBall || isMatchCompleted || isMatchLocked || isMatchAbandoned) return;

  if (text.includes("dot") || text.includes("zero")) {
    quickNormalBall(0);
  } else if (text.includes("one") || text.includes("single")) {
    quickNormalBall(1);
  } else if (text.includes("two")) {
    quickNormalBall(2);
  } else if (text.includes("three")) {
    quickNormalBall(3);
  } else if (text.includes("four")) {
    quickNormalBall(4);
  } else if (text.includes("six")) {
    quickNormalBall(6);
  } else if (text.includes("wide")) {
    quickExtra("WIDE");
  } else if (text.includes("no ball") || text.includes("noball")) {
    quickExtra("NOBALL");
  } else if (text.includes("leg bye")) {
    quickExtra("LEGBYE");
  } else if (text.includes("bye")) {
    quickExtra("BYE");
  } else if (text.includes("wicket")) {
    quickWicket("BOWLED");
  } else if (text.includes("undo")) {
    handleUndoBall();
  } else {
    setVoiceStatus(`Heard: "${command}"`);
  }
}
useEffect(() => {
  if (!voiceScoringOn || !scorerMode) return;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setVoiceStatus("Voice scoring is not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    setVoiceStatus("🎙️ Listening...");
  };

  recognition.onresult = (event) => {
    const transcript =
      event.results[event.results.length - 1][0].transcript;

    setVoiceStatus(`Heard: ${transcript}`);
    handleVoiceCommand(transcript);
  };

  recognition.onerror = (event) => {
    setVoiceStatus(`Voice error: ${event.error}`);
  };

  recognition.onend = () => {
    if (voiceScoringOn && scorerMode) {
      try {
        recognition.start();
      } catch {setVoiceStatus("");}
    }
  };

  recognition.start();

  return () => {
    recognition.onend = null;
    recognition.stop();
  };
}, [
  voiceScoringOn,
  scorerMode,
  isSavingBall,
  isMatchCompleted,
  isMatchLocked,
  isMatchAbandoned,
]);

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

function normalizeStatName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function combineCaptaincyRows(rows = [], shouldCombine = false) {
  if (!shouldCombine) return rows || [];

  const map = new Map();

  rows.forEach((row) => {
    const key = normalizeStatName(row.playerName);
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        ...row,
        playerIds: new Set(),
        teamNamesSet: new Set(),
        played: 0,
        won: 0,
        lost: 0,
      });
    }

    const combined = map.get(key);

    if (row.playerId) combined.playerIds.add(Number(row.playerId));
    if (row.teamName) combined.teamNamesSet.add(row.teamName);

    combined.played += Number(row.played || 0);
    combined.won += Number(row.won || 0);
    combined.lost += Number(row.lost || 0);
  });

  return [...map.values()].map((row) => ({
    ...row,
    playerId: [...row.playerIds][0],
    teamName: [...row.teamNamesSet].sort().join(" / "),
    teamNames: [...row.teamNamesSet].sort().join(" / "),
    winPct: row.played ? ((row.won / row.played) * 100).toFixed(1) : "0.0",
  }));
}

function combineWicketkeepingRows(rows = [], shouldCombine = false) {
  if (!shouldCombine) return rows || [];

  const map = new Map();

  rows.forEach((row) => {
    const key = normalizeStatName(row.playerName);
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        ...row,
        playerIds: new Set(),
        teamNamesSet: new Set(),
        catches: 0,
        stumpings: 0,
        runOuts: 0,
        dismissals: 0,
      });
    }

    const combined = map.get(key);

    if (row.playerId) combined.playerIds.add(Number(row.playerId));
    if (row.teamName) combined.teamNamesSet.add(row.teamName);

    combined.catches += Number(row.catches || 0);
    combined.stumpings += Number(row.stumpings || 0);
    combined.runOuts += Number(row.runOuts || 0);
  });

  return [...map.values()].map((row) => ({
    ...row,
    playerId: [...row.playerIds][0],
    teamName: [...row.teamNamesSet].sort().join(" / "),
    teamNames: [...row.teamNamesSet].sort().join(" / "),
    dismissals:
      Number(row.catches || 0) +
      Number(row.stumpings || 0) +
      Number(row.runOuts || 0),
  }));
}  

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

const combinedCaptaincy = combineCaptaincyRows(
  captaincyRows || [],
  isSurpriseLeague
);

const combinedWicketkeeping = combineWicketkeepingRows(
  wicketkeepingRows || [],
  isSurpriseLeague
);

const filteredCaptaincy = combinedCaptaincy.filter(playerPassesContextFilters);

const filteredWicketkeeping =
  combinedWicketkeeping.filter(playerPassesContextFilters);

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

const correctionInningsNo = Number(correctionForm.inningsNo || 1);

const correctionBattingTeamId =
  correctionInningsNo === 1
    ? matchDetail?.battingFirstTeamId
    : matchDetail?.teamAId === matchDetail?.battingFirstTeamId
    ? matchDetail?.teamBId
    : matchDetail?.teamAId;

const correctionBattingTeam =
  Number(matchDetail?.teamAId) === Number(correctionBattingTeamId)
    ? matchDetail?.teamA
    : matchDetail?.teamB;

const correctionPlayers =
  (correctionBattingTeam?.players || []).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

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
  async function handleWicketKeeperChange() {
  try {
    const bowlingTeamId =
      Number(ballForm.inningsNo) === 1
        ? Number(matchDetail?.teamAId) === Number(matchDetail?.battingFirstTeamId)
          ? matchDetail?.teamBId
          : matchDetail?.teamAId
        : Number(matchDetail?.teamAId) === Number(matchDetail?.battingFirstTeamId)
        ? matchDetail?.teamAId
        : matchDetail?.teamBId;

    await api(`/api/matches/${selectedMatchId}/wicketkeeper-change`, {
      method: "POST",
      body: JSON.stringify({
        inningsNo: keeperChangeForm.inningsNo,
        afterSequence: keeperChangeForm.afterSequence || scoreboard?.currentState?.lastSequence || 0,
        teamId: bowlingTeamId,
        newKeeperId: keeperChangeForm.newKeeperId,
        note: keeperChangeForm.note,
      }),
    });

    await loadSelectedMatch(selectedMatchId);
    setShowKeeperChangeModal(false);
    setMessage("✅ Wicketkeeper changed successfully.");
  } catch (err) {
    setError(err.message);
  }
}
async function handleLiveWicketKeeperChange() {
  try {
    if (!selectedMatchId) {
      setError("Please select a match first.");
      return;
    }

    if (!keeperChangeForm.newKeeperId) {
      setError("Please select the new wicketkeeper.");
      return;
    }

    await api(`/api/matches/${selectedMatchId}/wicketkeeper-change`, {
      method: "POST",
      body: JSON.stringify({
        inningsNo: ballForm.inningsNo,
        newKeeperId: keeperChangeForm.newKeeperId,
        note: keeperChangeForm.note,
      }),
    });

    await loadSelectedMatch(selectedMatchId);
    await loadMatches();
    await loadLeagueStats(activeLeagueId);

    setShowKeeperChangeModal(false);
    setKeeperChangeForm({
      newKeeperId: "",
      note: "",
    });

    setMessage("✅ Wicketkeeper changed from this point onward.");
  } catch (err) {
    setError(err.message);
  }
}

const scoringComboMatches = (() => {
  let list = [...(matches || [])];

  const seriesIds = contextFilters?.seriesIds || [];
  const years = contextFilters?.years || [];
  const statuses = contextFilters?.statuses || [];
  const teamIds = contextFilters?.teamIds || [];
  const matchIds = contextFilters?.matchIds || [];

  if (activeLeagueId) {
    list = list.filter(
      (match) => Number(match.leagueId) === Number(activeLeagueId)
    );
  }

  if (statuses.length) {
    list = list.filter((match) =>
      statuses
        .map((s) => String(s).toUpperCase())
        .includes(String(match.status || "").toUpperCase())
    );
  }

  if (teamIds.length) {
    list = list.filter(
      (match) =>
        teamIds.map(Number).includes(Number(match.teamAId)) ||
        teamIds.map(Number).includes(Number(match.teamBId))
    );
  }

  if (matchIds.length) {
    list = list.filter((match) =>
      matchIds.map(Number).includes(Number(match.id))
    );
  }

  if (seriesIds.length) {
    list = list.filter((match) =>
      seriesIds.map(Number).includes(Number(match.seriesId))
    );
  }

  if (years.length) {
    list = list.filter((match) => {
      const dateValue =
        match.startedAt ||
        match.scheduledAt ||
        match.endedAt ||
        match.createdAt;

      if (!dateValue) return false;

      return years.map(Number).includes(new Date(dateValue).getFullYear());
    });
  }

  return sortMatchesForSelection(list);
})();

useEffect(() => {
  if (!selectedMatchId) return;

  const exists = scoringComboMatches.some(
    (match) => Number(match.id) === Number(selectedMatchId)
  );

  if (!exists) {
    setSelectedMatchId("");
    setMatchDetail(null);
    setScoreboard(null);
    setOptimisticScoreboard(null);
  }
}, [contextFilters, activeLeagueId, selectedMatchId, matches]);

async function handleScoringMatchSelect(matchId) {
  if (!matchId) {
    setSelectedMatchId("");
    setMatchDetail(null);
    setScoreboard(null);
    setOptimisticScoreboard(null);
    return;
  }

  const match = scoringComboMatches.find(
    (m) => Number(m.id) === Number(matchId)
  );

  if (!match) {
    setError("Selected match was not found.");
    return;
  }

  const status = String(match.status || "").toUpperCase();
  const isScheduled = status === "SCHEDULED";

  if (isScheduled) {
    setSelectedMatchId(String(match.id));
    setEditingMatch(match);

    const hasBattingFirst =
      match.battingFirstTeamId ||
      match.battingFirstTeam?.id;

    if (!hasBattingFirst) {
      setMatchDetail(null);
      setScoreboard(null);
      setOptimisticScoreboard(null);
      setShowStartMatchModal(true);
      return;
    }
  }

  await handleMatchSelect(match.id);
}
async function openScoringAfterBattingFirst(matchId) {
  const safeMatchId = Number(matchId);

  if (!safeMatchId) {
    setError("Match was not found.");
    return;
  }

  setMessage("");
  setError("");

  setSelectedMatchId(String(safeMatchId));
  setActiveTab("scoring");
  setScoringSubTab("ADVANCED");

  setBallForm((prev) => ({
    ...prev,
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
    wicketNote: "",
  }));

  await loadSelectedMatch(safeMatchId, {
    loadDetail: true,
    loadStatsData: false,
    syncBallForm: false,
  });

  setDeliverySetupReason(
    "Select opening striker, non-striker, and bowler before scoring the first ball."
  );

  setPendingDeliverySetupAfterStart(true);
}

const setupTeamA = matchDetail?.teamA;
const setupTeamB = matchDetail?.teamB;

const setupTeamAId = Number(matchDetail?.teamAId || setupTeamA?.id);
const setupTeamBId = Number(matchDetail?.teamBId || setupTeamB?.id);
const setupBattingFirstTeamId = Number(
  matchDetail?.battingFirstTeamId ||
    scoreboard?.match?.battingFirstTeamId ||
    selectedMatch?.battingFirstTeamId
);

const setupInningsNo = Number(ballForm?.inningsNo || 1);

const setupBattingTeamId =
  setupInningsNo === 1
    ? setupBattingFirstTeamId
    : setupBattingFirstTeamId === setupTeamAId
    ? setupTeamBId
    : setupTeamAId;

const setupBowlingTeamId =
setupBattingTeamId === setupTeamAId ? setupTeamBId : setupTeamAId;

const setupBatters =
  Number(matchDetail?.teamAId) === setupBattingTeamId
    ? matchDetail?.teamA?.players || []
    : matchDetail?.teamB?.players || [];

const setupBowlers =
  Number(matchDetail?.teamAId) === setupBowlingTeamId
    ? matchDetail?.teamA?.players || []
    : matchDetail?.teamB?.players || [];

function playerNameFromTeam(team, playerId) {
  const id = Number(playerId);
  const players = team?.players || [];
  const player = players.find(
    (p) => Number(p.id) === id
  );

  return player?.name || "-";
}

function getAvailableNewBatters(battingTeam, ballForm, recentBalls = []) {
  const unavailableIds = new Set();

  recentBalls.forEach((ball) => {
    if (ball.dismissedPlayerId) {
      unavailableIds.add(Number(ball.dismissedPlayerId));
    }
  });

  if (ballForm?.dismissedPlayerId) {
    unavailableIds.add(Number(ballForm.dismissedPlayerId));
  }

  return (battingTeam?.players || []).filter((player) => {
    const id = Number(player.id);

    return (
      id !== Number(ballForm.strikerId) &&
      id !== Number(ballForm.nonStrikerId) &&
      !unavailableIds.has(id)
    );
  });
}
const availableNewBatters1 = getAvailableNewBatters(
  battingTeam,
  ballForm,
  recentBalls
);

const noNewBatterAvailable =
  ballForm?.dismissedPlayerId &&
  wicketNewBatterOptions.length === 0;

function getSafeScoringInningsNo(board, form) {
  const inningsFromBoard = Number(
    board?.currentInnings ||
      board?.currentState?.inningsNo ||
      board?.activeInningsNo ||
      0
  );

  if (inningsFromBoard === 1 || inningsFromBoard === 2) {
    return inningsFromBoard;
  }

  const inningsFromForm = Number(form?.inningsNo || 0);

  if (inningsFromForm === 1 || inningsFromForm === 2) {
    return inningsFromForm;
  }

  return 1;
}
  useEffect(() => {
  if (!scorerMode) return;

  window.addEventListener("keydown", handleScorerKeyPress);

  return () => {
    window.removeEventListener("keydown", handleScorerKeyPress);
  };
}, [
  scorerMode,
  isSavingBall,
  isMatchCompleted,
  isMatchLocked,
  isMatchAbandoned,
  ballForm,
  scoreboard,
]);
const lastScoredBall = recentBalls?.[0];

const lastBallText = lastScoredBall?.label
  ? String(lastScoredBall.label)
      .split(" ")
      .slice(1)
      .join(" ")
      .replace(/[()]/g, "") || lastScoredBall.label
  : "Waiting for first ball";

  function handleScorerKeyPress(e) {
  if (!scorerMode) return;
  if (isSavingBall || isMatchCompleted || isMatchLocked || isMatchAbandoned) return;

  const tag = document.activeElement?.tagName?.toLowerCase();
  if (["input", "select", "textarea"].includes(tag)) return;

  const key = e.key.toLowerCase();

  if (key === "0") quickNormalBall(0);
  if (key === "1") quickNormalBall(1);
  if (key === "2") quickNormalBall(2);
  if (key === "3") quickNormalBall(3);
  if (key === "4") quickNormalBall(4);
  if (key === "6") quickNormalBall(6);

  if (key === "w") quickWicket("BOWLED");
  if (key === "d") quickExtra("WIDE");
  if (key === "n") quickExtra("NOBALL");
  if (key === "b") quickExtra("BYE");
  if (key === "l") quickExtra("LEGBYE");

  if (key === "u") handleUndoBall();
}
async function startVoiceScoring() {
  try {
    if (!scorerMode) {
      setVoiceMessage("Open Scorer Mode first.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const recorder = new MediaRecorder(stream);
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());

      const audioBlob = new Blob(chunks, { type: "audio/webm" });
      await sendVoiceCommand(audioBlob);
    };

    recorder.start();
    setVoiceRecorder(recorder);
    setVoiceChunks(chunks);
    setVoiceRecording(true);
    setVoiceMessage("🎙️ Listening...");
  } catch (err) {
    setVoiceMessage("Microphone permission denied or unavailable.");
  }
}

function stopVoiceScoring() {
  if (voiceRecorder && voiceRecorder.state !== "inactive") {
    voiceRecorder.stop();
  }

  setVoiceRecording(false);
}
async function sendVoiceCommand(audioBlob) {
  try {
    setVoiceBusy(true);
    setVoiceMessage("Understanding command...");

    const formData = new FormData();
    formData.append("audio", audioBlob, "voice-command.webm");

    const res = await fetch("/api/voice-score", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Voice scoring failed");
    }

    setVoiceMessage(`Heard: ${data.transcript}`);

    executeVoiceCommand(data.command);
    
  } catch (err) {
    setVoiceMessage(err.message);
  } finally {
    setVoiceBusy(false);
  }
}

function executeVoiceCommand(command) {
  if (!command || !command.action) return;

  if (isSavingBall || isMatchCompleted || isMatchLocked || isMatchAbandoned) {
    setVoiceMessage("Cannot score right now.");
    return;
  }

  switch (command.action) {
    case "RUN":
      quickNormalBall(Number(command.runs || 0));
      break;

    case "WIDE":
      quickExtra("WIDE", Number(command.runs || 1));
      break;

    case "NOBALL":
      quickExtra("NOBALL", Number(command.runs || 1));
      break;

    case "BYE":
      quickExtra("BYE", Number(command.runs || 1));
      break;

    case "LEGBYE":
      quickExtra("LEGBYE", Number(command.runs || 1));
      break;

    case "WICKET":
      quickWicket(command.wicketType || "BOWLED");
      break;

    case "UNDO":
      handleUndoBall();
      break;

    case "SWAP":
      swapBatters();
      break;

    case "RETIRED_HURT":
      setShowRetiredHurtModal(true);
      break;

    default:
      setVoiceMessage("Command not understood. Try: one, four, wide, wicket.");
  }
}

async function refreshPlayerLists() {
  await loadTeams();

  if (activeLeagueId) {
    await loadLeagues();
  }
}
const shouldPollMatch =
  pageVisible &&
  selectedMatchId &&
  activeTab === "scoring" &&
  effectiveScoringSubTab === "ADVANCED" &&
  !isMatchCompleted &&
  !isMatchLocked;

/*  useEffect(() => {
  if (!shouldPollMatch) return;
if (!pageVisible) return;
  const id = setInterval(() => {
    loadSelectedMatch(selectedMatchId);
  }, 5000);

  return () => clearInterval(id);
}, [shouldPollMatch, selectedMatchId]);
*/
useEffect(() => {
  if (!selectedMatchId) return;
  if (!pageVisible) return;
  if (ballSaveInFlight) return;
  if (showDeliverySetupModal) return;

  const interval = setInterval(() => {
    loadSelectedMatch(selectedMatchId, {
      syncBallForm: false,
    });
  }, 8000);

  return () => clearInterval(interval);
}, [
  selectedMatchId,
  pageVisible,
  ballSaveInFlight,
  showDeliverySetupModal,
]);

useEffect(() => {
  if (!dashboardReady) return;
  if (activeTab !== "Points") return;
  if (!activeLeagueId) return;

  loadPointsTable(activeLeagueId);
}, [dashboardReady, activeTab, activeLeagueId]);

useEffect(() => {
  if (!dashboardReady) return;
  if (activeTab !== "stats") return;
  if (!activeLeagueId) return;

  loadLeagueStats(activeLeagueId);
}, [dashboardReady, activeTab, activeLeagueId]);

function safeSetJsonState(setter) {
  return (next) => {
    setter((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(next)) {
        return prev;
      }
      return next;
    });
  };
}
useEffect(() => {
  return () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
  };
}, []);
useEffect(() => {
  if (!scorerMode) {
    setVoiceScoringOn(false);
    try {
      recognitionRef.current?.stop?.();
    } catch {}
  }
}, [scorerMode]);

function startBrowserVoiceScore() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setVoiceStatus("Voice scoring is not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => setVoiceStatus("🎙️ Listening...");

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    setVoiceStatus(`Heard: ${transcript}`);
    handleVoiceCommand(transcript);
  };

  recognition.onerror = (event) => {
    setVoiceStatus(`Voice error: ${event.error}`);
  };

  recognition.onend = () => setVoiceStatus("");

  recognition.start();
}

const matchEnded =
  ["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(
    String(scoreboard?.match?.status || "").toUpperCase()
  );

const teamsInLeague =
  teams.filter(
    (t) => String(t.leagueId) === String(activeLeagueId)
  ) || [];

const minimumTeamsReady = teamsInLeague.length >= 2;

const minimumPlayersReady =
  minimumTeamsReady &&
  teamsInLeague.every(
    (team) =>
      (team.players?.length || 0) >= 2
  );

const leagueReadyForMatches =
  minimumTeamsReady &&
  minimumPlayersReady;

async function loadCorrectionHistory(matchId = selectedMatchId) {
  if (!matchId) return;

  const data = await api(`/api/matches/${matchId}/corrections`);
  setCorrectionHistory(Array.isArray(data) ? data : []);
}

async function applyCorrection() {
  if (!selectedMatchId) return;
setCorrectionError("");
  try {
    setCorrectionLoading(true);

    await api(`/api/matches/${selectedMatchId}/corrections`, {
      method: "POST",
      body: JSON.stringify({
        correctionType,
        payload: {
  ...correctionForm,
  inningsNo: correctionInnings,
},
        reason: correctionReason,
      }),
    });

    await loadSelectedMatch(selectedMatchId, {
      loadDetail: true,
      loadStatsData: true,
      syncBallForm: true,
    });

    await loadCorrectionHistory(selectedMatchId);

    setCorrectionReason("");
    setCorrectionForm({});

    showToast("success", "✅ Scorecard correction applied.");
  } catch (err) {
  const message = err.message || "Correction failed.";
  setCorrectionError(message);
  showToast("error", message);
  } finally {
    setCorrectionLoading(false);
  }
}

async function rollbackCorrection(correctionId) {
  if (!selectedMatchId) return;

  if (!confirm("Rollback this correction?")) return;

  try {
    await api(`/api/matches/${selectedMatchId}/corrections/${correctionId}/rollback`, {
      method: "POST",
    });

    await loadSelectedMatch(selectedMatchId, {
      loadDetail: true,
      loadStatsData: true,
      syncBallForm: true,
    });

    await loadCorrectionHistory(selectedMatchId);

    showToast("success", "↩️ Correction rolled back.");
  } catch (err) {
    setError(err.message);
    showToast("error", err.message);
  }
}

function getTeamById(teamId) {
  if (!matchDetail) return null;

  if (String(matchDetail.teamA?.id) === String(teamId)) {
    return matchDetail.teamA;
  }

  if (String(matchDetail.teamB?.id) === String(teamId)) {
    return matchDetail.teamB;
  }

  return null;
}

const battingFirstTeamId =
  matchDetail?.battingFirstTeamId ||
  matchDetail?.battingFirstTeam?.id ||
  selectedMatch?.battingFirstTeamId;

const teamAId = matchDetail?.teamA?.id;
const teamBId = matchDetail?.teamB?.id;

const battingPlayersForCorrection =
  battingTeamForCorrection?.players || [];

const bowlingPlayersForCorrection =
  bowlingTeamForCorrection?.players || [];

async function openCorrectionCenter(matchIdFromButton = null) {
  const matchIdToUse =
    Number(matchIdFromButton) ||
    Number(selectedMatchId) ||
    Number(selectedMatch?.id) ||
    Number(scoreboard?.match?.id) ||
    Number(matchDetail?.id);

  if (!matchIdToUse) {
    setError("Please select a match first.");
    return;
  }

  setSelectedMatchId(String(matchIdToUse));

  await loadSelectedMatch(matchIdToUse, {
    loadDetail: true,
    loadStatsData: true,
    syncBallForm: false,
  });

  await loadCorrectionHistory(matchIdToUse);

  setCorrectionInnings(1);
  setCorrectionForm({});
  setCorrectionReason("");
  setShowCorrectionCenter(true);
}

const wicketBallsForCorrection =
  (matchDetail?.balls || [])
    .filter(
      (ball) =>
        Number(ball.inningsNo) === Number(correctionInnings) &&
        Boolean(ball.isWicket)
    )
    .sort((a, b) => Number(a.sequence) - Number(b.sequence));

const oversForCorrection = [
  ...new Set(
    (matchDetail?.balls || [])
      .filter((b) => Number(b.inningsNo) === Number(correctionInnings))
      .map((b) => Number(b.overNo))
      .filter((n) => !Number.isNaN(n))
  ),
].sort((a, b) => a - b);

const [correctionError, setCorrectionError] = useState("");

const retiredHurtBallsForCorrection = (matchDetail?.balls || [])
  .filter(
    (ball) =>
      Number(ball.inningsNo) === Number(correctionInnings) &&
      String(ball.wicketType || "").toUpperCase() === "RETIRED_HURT"
  )
  .sort((a, b) => Number(a.sequence) - Number(b.sequence));

const scoreboardInnings = scoreboard?.innings || [];

const activeInningsForScoreboard =
  scoreboardInnings.find(
    (inn) => Number(inn.number) === Number(activeScoreboardInnings)
  ) || scoreboardInnings[0];

  
const auditLeagueGroups = Object.values(
  (auditLogs || []).reduce((groups, log) => {
    const key = String(log.leagueId ?? log.leagueName ?? "NO_LEAGUE");

    const label =
      log.leagueName ||
      (log.leagueId ? `League #${log.leagueId}` : "System / No League");

    if (!groups[key]) {
      groups[key] = {
        key,
        label,
        logs: [],
      };
    }

    groups[key].logs.push(log);
    return groups;
  }, {})
);

const visibleAuditLogs =
  selectedAuditLeagueKey === "ALL"
    ? auditLogs
    : auditLeagueGroups.find(
        (group) => String(group.key) === String(selectedAuditLeagueKey)
      )?.logs || [];

const groupedRecentLogins = Object.values(
  (userActivity?.recentLogins || []).reduce((groups, login) => {
    const key = login.userId || login.email || login.id;

    if (!groups[key]) {
      groups[key] = {
        key,
        name: login.name || "Unknown User",
        email: login.email,
        logins: [],
      };
    }

    groups[key].logins.push(login);
    return groups;
  }, {})
);      

async function handleSaveSeries(e) {
  e.preventDefault();

  const isEditing = Boolean(editingSeries?.id);

  const url = isEditing
    ? `/api/series/${editingSeries.id}`
    : "/api/series";

  const method = isEditing ? "PATCH" : "POST";

  await api(url, {
    method,
    body: JSON.stringify({
      leagueId: activeLeagueId,
      name: seriesForm.name.trim(),
      year: Number(seriesForm.year),
      status: seriesForm.status || "ACTIVE",
    }),
  });

  setShowSeriesModal(false);
  setEditingSeries(null);
  setSeriesForm({
    name: "",
    year: new Date().getFullYear(),
    status: "ACTIVE",
  });

  await loadSeries(activeLeagueId);
}

async function handleDeleteSeries(seriesId, seriesName) {
  const confirmed = window.confirm(
    `Delete series "${seriesName}"?\n\nThis is only allowed when no matches are linked to this series.`
  );

  if (!confirmed) return;

  try {
    await api(`/api/series/${seriesId}`, {
      method: "DELETE",
    });

    if (String(selectedSeriesId) === String(seriesId)) {
      setSelectedSeriesId("");
    }

    await loadSeries(activeLeagueId);
  } catch (err) {
    console.error("Delete series failed:", err);
    alert(err.message || "Series cannot be deleted.");
  }
}

const canUseAvailabilityBuilder =
  Boolean(permissions?.canUseTeamBuilder) ||
  Boolean(permissions?.canScoreMatch);

async function handleShareScheduledMatch(match) {
  const shareCode =
    match?.shareCode ||
    match?.sharecode ||
    match?.publicShareCode;

  if (!shareCode) {
    alert("Share code is not available for this match.");
    return;
  }

  const shareUrl = `${window.location.origin}/live/${shareCode}`;

  const shareText = `🏏 ${match.teamAName} vs ${match.teamBName}

📅 ${
    match.scheduledAt
      ? formatDate(match.scheduledAt)
      : "Schedule not decided"
  }

Follow the live score on Cric4All:
${shareUrl}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: `${match.teamAName} vs ${match.teamBName}`,
        text: shareText,
        url: shareUrl,
      });

      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    alert("Match link copied.");
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("Share scheduled match failed:", error);
      alert("Unable to share this match right now.");
    }
  }
}

async function handleShareActiveMatch(match) {
  const shareCode =
    match?.shareCode ||
    match?.sharecode ||
    match?.publicShareCode;

  if (!shareCode) {
    alert("Share code is not available for this match.");
    return;
  }

  const shareUrl = `${window.location.origin}/live/${shareCode}`;

  const shareText = `🏏 ${match.teamAName} vs ${match.teamBName}

Follow the live score on Cric4All:
${shareUrl}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: `${match.teamAName} vs ${match.teamBName}`,
        text: shareText,
        url: shareUrl,
      });

      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    alert("Live match link copied.");
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("Share active match failed:", error);
      alert("Unable to share this match right now.");
    }
  }
}

function MobileMatchSetup({ match, includeTimeline = false }) {
  return (
    <details className="mobile-match-setup">
      <summary className="mobile-match-setup-summary">
        <div>
          <span className="mobile-match-setup-icon">⚙️</span>

          <span>
            <strong>Match Setup & Roles</strong>
            <small>Rules, captains and wicketkeepers</small>
          </span>
        </div>

        <i>⌄</i>
      </summary>

      <div className="mobile-match-setup-body">
        <div className="mobile-match-facts">
          <div>
            <span>🏏 Bat first</span>
            <strong>
              {match.battingFirstTeamName || "Not decided"}
            </strong>
          </div>

          <div>
            <span>🎯 Overs</span>
            <strong>{match.oversPerInnings}</strong>
          </div>

          <div>
            <span>⚾ Wickets</span>
            <strong>
              {match.maxWicketsPerInnings ?? "∞"}
            </strong>
          </div>

          <div>
            <span>⚡ Powerplay</span>
            <strong>
              {match.powerplayOversInnings ?? 0}
            </strong>
          </div>

          <div>
            <span>🎳 Max / Bowler</span>
            <strong>
              {match.maxOversPerBowler ?? "∞"}
            </strong>
          </div>
        </div>

        <div className="mobile-match-role-list">
          <div>
            <span>🧤 {match.teamAName}</span>
            <strong>
              {match.teamAWicketKeeperName ||
                "Wicketkeeper not selected"}
            </strong>
          </div>

          <div>
            <span>🧤 {match.teamBName}</span>
            <strong>
              {match.teamBWicketKeeperName ||
                "Wicketkeeper not selected"}
            </strong>
          </div>

          <div>
            <span>👑 {match.teamAName}</span>
            <strong>
              {match.teamACaptainName ||
                "Captain not selected"}
            </strong>
          </div>

          <div>
            <span>👑 {match.teamBName}</span>
            <strong>
              {match.teamBCaptainName ||
                "Captain not selected"}
            </strong>
          </div>
        </div>

        {includeTimeline &&
          (match.startedAt ||
            match.endedAt ||
            match.lockedAt) && (
            <div className="mobile-match-timeline">
              {match.startedAt && (
                <div>
                  <span>Started</span>
                  <strong>
                    {formatMatchDateTime(match.startedAt)}
                  </strong>
                </div>
              )}

              {match.endedAt && (
                <div>
                  <span>Ended</span>
                  <strong>
                    {formatMatchDateTime(match.endedAt)}
                  </strong>
                </div>
              )}

              {match.lockedAt && (
                <div>
                  <span>Locked</span>
                  <strong>
                    {formatMatchDateTime(match.lockedAt)}
                  </strong>
                </div>
              )}
            </div>
          )}
      </div>
    </details>
  );
}

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
<div className={`dashboard-tabs-wrap ${tabsScrolled ? "scrolled" : ""}`}>

<div
  className="dashboard-tabs"
  onScroll={(e) => {
    if (e.currentTarget.scrollLeft > 10) {
      setTabsScrolled(true);
    }
  }}
>
{!dashboardReady || permissionsLoading ? (
  <div className="dashboard-tabs-loading">
    Loading dashboard...
  </div>
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
onClick={() => {
  setActiveTab("stats");
  loadLeagueStats(activeLeagueId);
}}
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
          className={`dashboard-tab ${
            activeTab === "help"
              ? "active"
              : ""
          }`}
        onClick={() =>
          setActiveTab("help")
        }
      >
        ❓ Help
      </button>

      <button
          className={`dashboard-tab ${
            activeTab === "about"
              ? "active"
              : ""
          }`}
        onClick={() =>
          setActiveTab("about")
        }
      >
        ℹ️ About
      </button>
{session?.user?.email === "surprisecricket11@gmail.com" && (
  <button
    className={`dashboard-tab ${activeTab === "admin" ? "active" : ""}`}
    onClick={() => setActiveTab("admin")}
  >
    🛡️ Admin
  </button>
)}
    </>
  )}
</div>
</div>

  {activeTab === "scoring" && (
<div className="scoring-layout">

<Card
  title="🏏 Match Center"
  defaultCollapsed={true}
>
<div className="match-center compact-match-center"> 
<div className="match-command-single">
  <div className="match-command-top">
    <div className="match-command-league-inline">
      <span>🏆 League</span>
      <strong>
        {leagues.find((l) => Number(l.id) === Number(activeLeagueId))?.name ||
          "No league selected"}
      </strong>
    </div>

    <div className="match-command-context">
      <ContextLens />
    </div>
  </div>

  <button
    type="button"
    className="match-command-selected full"
    onClick={() => setShowMatchPicker((prev) => !prev)}
  >
    <div>
      <span>🏏 Match</span>
      <strong>
        {selectedMatch
          ? `${selectedMatch.teamAName} vs ${selectedMatch.teamBName}`
          : "Choose a match"}
      </strong>
      <small>
        {selectedMatch
          ? `${selectedMatch.status || "SCHEDULED"} • ${
              selectedMatch.battingFirstTeamName
                ? `Bat 1st: ${selectedMatch.battingFirstTeamName}`
                : "Batting first not decided"
            }`
          : "Tap to select active, scheduled, or completed match"}
      </small>
    </div>

    <b>{showMatchPicker ? "⌃" : "⌄"}</b>
  </button>

  {showMatchPicker && (
    <div className="match-choice-panel match-choice-panel-wow inside">
      {scoringComboMatches.map((match) => (
        <button
          key={match.id}
          type="button"
          className={`match-choice-card ${
            String(selectedMatchId) === String(match.id) ? "active" : ""
          }`}
          onClick={() => {
            handleScoringMatchSelect(match.id);
            setShowMatchPicker(false);
          }}
        >
          <div>
            <strong>{match.teamAName} vs {match.teamBName}</strong>
            <span>{getMatchOptionLabel(match)}</span>
          </div>

          <b>{String(selectedMatchId) === String(match.id) ? "✓" : "→"}</b>
        </button>
      ))}
    </div>
  )}
</div>
</div>
</Card>
<Card title = "Score Details" 
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
{selectedMatchId && (
  <div className="score-hub-shell">
    {matchDetail && (
      <details className="match-setup-wow">
        <summary className="match-setup-wow-summary">
          <div className="match-setup-wow-left">
            <div className="match-setup-wow-icon">📋</div>

            <div className="match-setup-wow-text">
              <div className="match-setup-wow-title-row">
                <span>Match Setup</span>
                <b>▼</b>
              </div>

              <small>
                {selectedMatch
                  ? `${selectedMatch.teamAName} vs ${selectedMatch.teamBName}`
                  : "Tap to view match details"}
              </small>
            </div>
          </div>

          <div className="match-setup-wow-status">
            {selectedMatch?.status || "MATCH"}
          </div>
        </summary>

        <div className="match-setup-wow-body">
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

              <span className="pill">{selectedMatch.status}</span>
            </div>
          )}

          <div className="match-setup-grid">
            <div>
              <span>Overs</span>
              <strong>{matchDetail?.oversPerInnings || "-"}</strong>
            </div>

            <div>
              <span>Wickets</span>
              <strong>{matchDetail?.maxWicketsPerInnings || "Unlimited"}</strong>
            </div>

            <div>
              <span>Powerplay</span>
              <strong>{matchDetail?.powerplayOversInnings ?? 0}</strong>
            </div>

            <div>
              <span>Max / Bowler</span>
              <strong>{matchDetail?.maxOversPerBowler || "Unlimited"}</strong>
            </div>
          </div>

          <div className="match-officials-pills">
            <div className="team-official-pill">
              <strong>{matchDetail?.teamA?.name || "Team A"}</strong>
              <span>
                🧢 {playerNameFromTeam(matchDetail?.teamA, matchDetail?.teamACaptainId)}
              </span>
              <span>
                🧤 {playerNameFromTeam(matchDetail?.teamA, matchDetail?.teamAWicketKeeperId)}
              </span>
            </div>

            <div className="team-official-pill">
              <strong>{matchDetail?.teamB?.name || "Team B"}</strong>
              <span>
                🧢 {playerNameFromTeam(matchDetail?.teamB, matchDetail?.teamBCaptainId)}
              </span>
              <span>
                🧤 {playerNameFromTeam(matchDetail?.teamB, matchDetail?.teamBWicketKeeperId)}
              </span>
            </div>
          </div>
        </div>
      </details>
    )}

<div
  className={`score-hub-tabs wow-main-tabs ${
    isSelectedMatchCompleted ? "completed-mode" : "live-mode"
  }`}
>
  {!isSelectedMatchCompleted && (
    <button
      type="button"
      className={`wow-score-tab scoring-tab ${
        effectiveScoringSubTab === "ADVANCED" ? "active" : ""
      }`}
      onClick={() => setScoringSubTab("ADVANCED")}
    >
      <span className="wow-tab-icon">🎯</span>
      <span className="wow-tab-copy">
        <strong>Scoring</strong>
        <small>Score balls live</small>
      </span>
    </button>
  )}

  <button
    type="button"
    className={`wow-score-tab scoreboard-tab ${
      effectiveScoringSubTab === "SCOREBOARD" ? "active" : ""
    }`}
    onClick={() => setScoringSubTab("SCOREBOARD")}
  >
    <span className="wow-tab-icon">🏏</span>
    <span className="wow-tab-copy">
      <strong>Scoreboard</strong>
      <small>Full scorecard</small>
    </span>
  </button>

  <button
    type="button"
    className={`wow-score-tab commentary-tab ${
      effectiveScoringSubTab === "COMMENTARY" ? "active" : ""
    }`}
    onClick={() => setScoringSubTab("COMMENTARY")}
  >
    <span className="wow-tab-icon">📝</span>
    <span className="wow-tab-copy">
      <strong>Commentary</strong>
      <small>Ball by ball</small>
    </span>
  </button>
</div>
  </div>
)}
{selectedMatchId && effectiveScoringSubTab === "SCOREBOARD" && (
<Card title="🏟️ Scoreboard" defaultCollapsed={false}>
  {!scoreboard ? (
    <p className="muted">Select a match to view scoreboard.</p>
  ) : (
    <>
                  <div className="pro-score-hero compact-score-hero">
                <div>
                  <h3>
                    {scoreboard.match?.teamAName} vs {scoreboard.match?.teamBName}
                  </h3>
                  </div>  
                  <div>                
                  <span className="pill scoreboard-status-top" align="right">
                    {scoreboard.match?.status}
                  </span>

                </div>
              </div>
      {matchInsights && (
        <div className="match-insights-card">
          {matchInsights.resultText && (
            <div className="insight-result">
              <span>🏆 Match Result</span>
              <strong>{matchInsights.resultText}</strong>
            </div>
          )}

          {matchInsights.potm && (
            <div className="insight-mini">
              <span>⭐ Player of the Match</span>
              <strong>{matchInsights.potm.playerName}</strong>
              <small>
                {matchInsights.potm.summary?.join(" & ") || "Top performer"}
              </small>
            </div>
          )}

          {matchInsights.winProbability && (
            <div className="insight-mini">
              <span>📈 Win Probability</span>

              <div className="win-prob-row">
                <b>{matchInsights.winProbability.bowlingTeam}</b>
                <div className="win-prob-track">
                  <i
                    style={{
                      width: `${matchInsights.winProbability.bowlingChance}%`,
                    }}
                  />
                </div>
                <b>{matchInsights.winProbability.bowlingChance}%</b>
              </div>

              <div className="win-prob-row">
                <b>{matchInsights.winProbability.battingTeam}</b>
                <div className="win-prob-track chase">
                  <i
                    style={{
                      width: `${matchInsights.winProbability.battingChance}%`,
                    }}
                  />
                </div>
                <b>{matchInsights.winProbability.battingChance}%</b>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pro-scoreboard">
        {(() => {
          const scoreboardInnings = scoreboard.innings || [];

          const activeInningsForScoreboard =
            scoreboardInnings.find(
              (x, idx) =>
        Number(x.number ?? idx + 1) === Number(activeScoreboardInnings)
    ) || scoreboardInnings[0];

          const activeInnIdx = scoreboardInnings.findIndex(
           (x, idx) =>
      Number(x.number ?? idx + 1) === Number(activeScoreboardInnings)
  );
  if (!activeInningsForScoreboard) return null;

const inningsNo = Number(activeInningsForScoreboard?.number ?? activeInnIdx + 1);

const teamAId = Number(matchDetail?.teamAId);
const teamBId = Number(matchDetail?.teamBId);
const battingFirstTeamId = Number(matchDetail?.battingFirstTeamId);

const inningsTeamName =
  activeInningsForScoreboard?.teamName ||
  activeInningsForScoreboard?.battingTeamName ||
  activeInningsForScoreboard?.team ||
  "";

let activeBattingTeamId =
  Number(activeInningsForScoreboard?.battingTeamId) ||
  Number(activeInningsForScoreboard?.teamId) ||
  null;

if (!activeBattingTeamId && inningsTeamName) {
  if (inningsTeamName === matchDetail?.teamAName) {
    activeBattingTeamId = teamAId;
  } else if (inningsTeamName === matchDetail?.teamBName) {
    activeBattingTeamId = teamBId;
  }
}

if (!activeBattingTeamId) {
  activeBattingTeamId =
    inningsNo === 1
      ? battingFirstTeamId
      : battingFirstTeamId === teamAId
        ? teamBId
        : teamAId;
}

const isTeamABatting = Number(activeBattingTeamId) === Number(teamAId);

const captainId = isTeamABatting
  ? matchDetail?.teamACaptainId ?? matchDetail?.teamAcaptainId
  : matchDetail?.teamBCaptainId ?? matchDetail?.teamBcaptainId;

const wicketKeeperId = isTeamABatting
  ? matchDetail?.teamAWicketKeeperId
  : matchDetail?.teamBWicketKeeperId;

const captainName = isTeamABatting
  ? matchDetail?.teamACaptainName
  : matchDetail?.teamBCaptainName;

const wicketKeeperName = isTeamABatting
  ? matchDetail?.teamAWicketKeeperName
  : matchDetail?.teamBWicketKeeperName;

const playerRoleBadge = (row) => {
  const badges = [];

  const samePlayer = (roleId, roleName) => {
    if (roleId && row.playerId && Number(row.playerId) === Number(roleId)) {
      return true;
    }

    return (
      roleName &&
      row.playerName &&
      String(row.playerName).trim().toLowerCase() ===
        String(roleName).trim().toLowerCase()
    );
  };

  if (samePlayer(captainId, captainName)) {
    badges.push("(c)");
  }

  if (samePlayer(wicketKeeperId, wicketKeeperName)) {
    badges.push("(wk)");
  }

  return badges.length ? ` ${badges.join(" ")}` : "";
};

          return (
            <>
<div className="innings-score-cards clickable-innings-cards">
  {(scoreboard.innings || []).map((inn, idx) => {
    const inningsNo = Number(inn.number ?? idx + 1);
    const isActive = Number(activeScoreboardInnings) === inningsNo;

    return (
      <button
        type="button"
        key={`innings-summary-${inningsNo}`}
        className={`innings-score-card innings-click-card ${
          isActive ? "active" : ""
        }`}
        onClick={() => setActiveScoreboardInnings(inningsNo)}
      >
<div className="innings-tab-header">
  <span>Tap • Inn {inningsNo}</span>
  {isActive && <b>✓</b>}
</div>

<div className="innings-tab-team">
  {inn.teamName || inn.battingTeamName || inn.team || "Team"}
</div>

<div className="innings-tab-main">
  <strong>{inn.runs}/{inn.wickets}</strong>
</div>

<div className="innings-bottom-row">
  {inn.oversDisplay} ov • RR {inn.runRate}
</div>
      </button>
    );
  })}
</div>

              {scoreboard.currentState &&
                !(
                  selectedMatch &&
                  [
                    "COMPLETED",
                    "COMPLETED_LOCKED",
                    "COMPLETED_CORRECTED",
                  ].includes(String(selectedMatch.status || "").toUpperCase())
                ) && (
                  <>
                    <div className="innings-state-grid compact-innings-state">
                      <div className="innings-mini-box">
                        <span>🏏 Innings</span>
                        <strong>
                          {scoreboard?.currentState?.inningsNo ||
                            scoreboard?.currentInnings ||
                            ballForm?.inningsNo ||
                            "-"}
                        </strong>
                      </div>

                      <div className="innings-mini-box">
                        <span>Next Ball</span>
                        <strong>
                          {scoreboard?.currentState?.nextBallLabel ||
                            `${
                              scoreboard?.currentState?.nextOverNo ??
                              scoreboard?.currentState?.nextOver ??
                              0
                            }.${
                              scoreboard?.currentState?.nextBallInOver ??
                              scoreboard?.currentState?.nextBallNo ??
                              0
                            }`}
                        </strong>
                      </div>

                      <div className="innings-mini-box striker-box">
                        <span>⚡ Striker</span>
                        <strong>
                          {scoreboard?.currentState?.strikerName || "-"}
                          {scoreboard?.currentState?.strikerStats && (
                            <b>
                              {scoreboard.currentState.strikerStats.runs || 0} (
                              {scoreboard.currentState.strikerStats.balls || 0})
                            </b>
                          )}
                        </strong>
                      </div>

                      <div className="innings-mini-box striker-box">
                        <span>🏃 Non-Striker</span>
                        <strong>
                          {scoreboard?.currentState?.nonStrikerName || "-"}
                          {scoreboard?.currentState?.nonStrikerStats && (
                            <b>
                              {scoreboard.currentState.nonStrikerStats.runs || 0} (
                              {scoreboard.currentState.nonStrikerStats.balls || 0})
                            </b>
                          )}
                        </strong>
                      </div>

                      <div className="innings-mini-box bowler-box">
                        <span>🎯 Bowler</span>
                        <strong>
                          {scoreboard?.currentState?.bowlerName || "-"}
                          {scoreboard?.currentState?.bowlerStats && (
                            <b>
                              {scoreboard.currentState.bowlerStats.wickets || 0}/
                              {scoreboard.currentState.bowlerStats.runs || 0} (
                              {scoreboard.currentState.bowlerStats.overs || "0.0"})
                            </b>
                          )}
                        </strong>
                      </div>
                    </div>

                    {/* Mobile compact live state */}
                    <div className="live-match-state compact-live-state">
                      <div className="live-top-strip">
                        <div>
                          <span>🏏 Inn</span>
                          <strong>
                            {scoreboard?.currentState?.inningsNo ||
                              scoreboard?.currentInnings ||
                              ballForm?.inningsNo ||
                              "-"}
                          </strong>
                        </div>

                        <div>
                          <span>Next</span>
                          <strong>
                            {scoreboard?.currentState?.nextBallLabel ||
                              `${
                                scoreboard?.currentState?.nextOverNo ??
                                scoreboard?.currentState?.nextOver ??
                                0
                              }.${
                                scoreboard?.currentState?.nextBallInOver ??
                                scoreboard?.currentState?.nextBallNo ??
                                0
                              }`}
                          </strong>
                        </div>
                      </div>

                      <div className="compact-player-row striker">
                        <span>⚡ Striker</span>
                        <strong>{scoreboard?.currentState?.strikerName || "-"}</strong>
                        <b>
                          {scoreboard?.currentState?.strikerStats
                            ? `${
                                scoreboard.currentState.strikerStats.runs || 0
                              } (${scoreboard.currentState.strikerStats.balls || 0})`
                            : ""}
                        </b>
                      </div>

                      <div className="compact-player-row non-striker">
                        <span>🏃 Non-striker</span>
                        <strong>
                          {scoreboard?.currentState?.nonStrikerName || "-"}
                        </strong>
                        <b>
                          {scoreboard?.currentState?.nonStrikerStats
                            ? `${
                                scoreboard.currentState.nonStrikerStats.runs || 0
                              } (${scoreboard.currentState.nonStrikerStats.balls || 0})`
                            : ""}
                        </b>
                      </div>

                      <div className="compact-player-row bowler">
                        <span>🎯 Bowler</span>
                        <strong>{scoreboard?.currentState?.bowlerName || "-"}</strong>
                        <b>
                          {scoreboard?.currentState?.bowlerStats
                            ? `${
                                scoreboard.currentState.bowlerStats.wickets || 0
                              }/${scoreboard.currentState.bowlerStats.runs || 0} (${
                                scoreboard.currentState.bowlerStats.overs || "0.0"
                              })`
                            : ""}
                        </b>
                      </div>
                    </div>
                  </>
                )}

              {activeInningsForScoreboard && (
<div
  key={`innings-detail-${activeInningsForScoreboard.number ?? activeInnIdx}`}
  className="full-innings-card active-innings-tab-panel"
>
                  <div className="innings-section-header">
                    <div>
                      <h3>
                        Innings {activeInningsForScoreboard.number}: {" "}
                        {activeInningsForScoreboard.teamName ||
                          activeInningsForScoreboard.battingTeamName ||
                          activeInningsForScoreboard.team ||
                          "Team"}
                      </h3>
                    </div>
                                          <div className="innings-tab-header">
                      <small>
                        Extras: {activeInningsForScoreboard.extras?.total ?? 0} • Wd {" "}
                        {activeInningsForScoreboard.extras?.wides ?? 0} • Nb {" "}
                        {activeInningsForScoreboard.extras?.noBalls ?? 0} • B {" "}
                        {activeInningsForScoreboard.extras?.byes ?? 0} • LB {" "}
                        {activeInningsForScoreboard.extras?.legByes ?? 0}
                      </small>
                      </div>
                  </div>
                  <details className="scorecard-wow-collapse">
                    <summary className="scorecard-wow-summary">
                      <div className="scorecard-wow-left">
                        <span className="scorecard-wow-icon">🏏</span>
                        <div>
                          <strong>Batting Scorecard</strong>
                          <small>Tap to view batting details</small>
                        </div>
                      </div>
                      <span className="scorecard-wow-caret">⌄</span>
                    </summary>

                    <div className="scorecard-wow-content">
                      <MobileBattingCards
                        rows={
                          activeInningsForScoreboard.battingRows ||
                          activeInningsForScoreboard.batting ||
                          []
                        }
                        currentStrikerId={scoreboard.currentState?.strikerId}
                      />

                      <div className="score-table-scroll desktop-score-table">
                        <table className="score-table sticky-first-col pro-table">
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
                            {(
                              activeInningsForScoreboard.battingRows ||
                              activeInningsForScoreboard.batting ||
                              []
                            ).length ? (
                              (
                                activeInningsForScoreboard.battingRows ||
                                activeInningsForScoreboard.batting ||
                                []
                              ).map((row, rowIdx) => (
                                <tr
                                  key={`bat-${
                                    activeInningsForScoreboard.number ?? activeInnIdx
                                  }-${row.playerId ?? rowIdx}-${rowIdx}`}
                                >
                                  <td>
                                    <strong>
                                      {row.playerName}
                                        {playerRoleBadge(row)}
                                        {Number(scoreboard.currentState?.strikerId) === Number(row.playerId)
                                          ? " *"
                                          : ""}
                                    </strong>
                                  </td>
                                  <td>
                                    {row.dismissal !== "not out"
                                      ? row.dismissal
                                      : "not out"}
                                  </td>
                                  <td>{row.runs}</td>
                                  <td>{row.balls}</td>
                                  <td>{row.fours}</td>
                                  <td>{row.sixes}</td>
                                  <td>{row.strikeRate}</td>
                                </tr>
                              ))
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
                    </div>
                  </details>

                  <details className="scorecard-wow-collapse">
                    <summary className="scorecard-wow-summary">
                      <div className="scorecard-wow-left">
                        <span className="scorecard-wow-icon">🎯</span>
                        <div>
                          <strong>Bowling Scorecard</strong>
                          <small>Tap to view bowling figures</small>
                        </div>
                      </div>
                      <span className="scorecard-wow-caret">⌄</span>
                    </summary>

                    <div className="scorecard-wow-content">
                      <MobileBowlingCards
                        rows={
                          activeInningsForScoreboard.bowlingRows ||
                          activeInningsForScoreboard.bowling ||
                          []
                        }
                      />

                      <div className="score-table-scroll desktop-score-table">
                        <table className="score-table sticky-first-col pro-table bowling-table">
                          <thead>
                            <tr>
                              <th>Bowler</th>
                              <th>O</th>
                              <th>R</th>
                              <th>W</th>
                              <th>Wd</th>
                              <th>Nb</th>
                              <th>Eco</th>
                            </tr>
                          </thead>

                          <tbody>
                            {(
                              activeInningsForScoreboard.bowlingRows ||
                              activeInningsForScoreboard.bowling ||
                              []
                            ).length ? (
                              (
                                activeInningsForScoreboard.bowlingRows ||
                                activeInningsForScoreboard.bowling ||
                                []
                              ).map((row, rowIdx) => (
                                <tr
                                  key={`bowl-${
                                    activeInningsForScoreboard.number ?? activeInnIdx
                                  }-${row.playerId ?? rowIdx}-${rowIdx}`}
                                >
                                  <td>
                                    <strong>{row.playerName}</strong>
                                  </td>
                                  <td>{row.overs}</td>
                                  <td>{row.runs}</td>
                                  <td>{row.wickets}</td>
                                  <td>{row.wides || 0}</td>
                                  <td>{row.noBalls || 0}</td>
                                  <td>{row.economy}</td>
                                </tr>
                              ))
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
                    </div>
                  </details>

                  <details className="scorecard-wow-collapse">
                    <summary className="scorecard-wow-summary">
                      <div className="scorecard-wow-left">
                        <span className="scorecard-wow-icon">💥</span>
                        <div>
                          <strong>Fall of Wickets</strong>
                          <small>Tap to view wicket timeline</small>
                        </div>
                      </div>
                      <span className="scorecard-wow-caret">⌄</span>
                    </summary>

                    <div className="scorecard-wow-content">
                      {!activeInningsForScoreboard.fallOfWickets?.length ? (
                        <p className="muted">No wickets yet.</p>
                      ) : (
                        <div className="fow-list">
                          {activeInningsForScoreboard.fallOfWickets.map(
                            (w, wicketIdx) => (
                              <div
                                key={`fow-${
                                  activeInningsForScoreboard.number ?? activeInnIdx
                                }-${w.wicketNumber ?? wicketIdx}-${
                                  w.over ?? "over"
                                }-${wicketIdx}`}
                                className="fow-chip"
                              >
                                <strong>{w.score}</strong>
                                <span>{w.playerOut}</span>
                                <small>{w.over} ov</small>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </details>

<details className="scorecard-wow-collapse">
  <summary className="scorecard-wow-summary">
    <div className="scorecard-wow-left">
      <span className="scorecard-wow-icon">🤝</span>
      <div>
        <strong>Partnerships</strong>
        <small>Tap to view batting partnerships</small>
      </div>
    </div>
    <span className="scorecard-wow-caret">⌄</span>
  </summary>

  <div className="scorecard-wow-content">
    {!activeInningsForScoreboard.partnerships?.length ? (
      <p className="muted">No partnerships yet.</p>
    ) : (
      <>
        <div className="mobile-partnership-list">
          {activeInningsForScoreboard.partnerships.map((p, pIdx) => (
            <div
              key={`mobile-partnership-${activeInningsForScoreboard.number ?? activeInnIdx}-${pIdx}`}
              className="mobile-partnership-card"
            >
              <div className="mobile-partnership-title">
                <strong>{p.batter1 || "Batter 1"}</strong>
                <span>+</span>
                <strong>{p.batter2 || "Batter 2"}</strong>
              </div>

              <div className="mobile-partnership-stats">
                <div>
                  <span>Runs</span>
                  <strong>{p.runs ?? 0}</strong>
                </div>
                <div>
                  <span>Balls</span>
                  <strong>{p.balls ?? 0}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{p.ongoing ? "Current" : `Wkt ${p.wicketNumber ?? "-"}`}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="score-table-scroll desktop-partnership-table">
          <table className="score-table sticky-first-col pro-table">
            <thead>
              <tr>
                <th>Batters</th>
                <th>Runs</th>
                <th>Balls</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activeInningsForScoreboard.partnerships.map((p, pIdx) => (
                <tr
                  key={`partnership-${activeInningsForScoreboard.number ?? activeInnIdx}-${p.batter1 || "b1"}-${
                    p.batter2 || "b2"
                  }-${pIdx}`}
                >
                  <td>{p.batter1} & {p.batter2}</td>
                  <td>{p.runs}</td>
                  <td>{p.balls}</td>
                  <td>{p.ongoing ? "Current" : `wicket ${p.wicketNumber}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}
  </div>
</details>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </>
  )}
</Card>

)}
{selectedMatchId && effectiveScoringSubTab === "COMMENTARY" && (
  <Card title="🎙️ Commentary" defaultCollapsed={false}>
    {!scoreboard ? (
      <p className="muted">Select a match to view commentary.</p>
    ) : !scoreboard.commentary?.length ? (
      <div className="commentary-empty">
        📝 No commentary yet. Start scoring to build the live timeline.
      </div>
    ) : (
      <>
        {matchInsights && (
          <div className="match-insights-card">
            {matchInsights.resultText && (
              <div className="insight-result">
                <span>🏆 Match Result</span>
                <strong>{matchInsights.resultText}</strong>
              </div>
            )}

            {matchInsights.potm && (
              <div className="insight-mini">
                <span>⭐ Player of the Match</span>
                <strong>{matchInsights.potm.playerName}</strong>
                <small>
                  {matchInsights.potm.summary?.join(" & ") || "Top performer"}
                </small>
              </div>
            )}

            {matchInsights.winProbability && (
              <div className="insight-mini">
                <span>📈 Win Probability</span>

                <div className="win-prob-row">
                  <b>{matchInsights.winProbability.bowlingTeam}</b>
                  <div className="win-prob-track">
                    <i style={{ width: `${matchInsights.winProbability.bowlingChance}%` }} />
                  </div>
                  <b>{matchInsights.winProbability.bowlingChance}%</b>
                </div>

                <div className="win-prob-row">
                  <b>{matchInsights.winProbability.battingTeam}</b>
                  <div className="win-prob-track chase">
                    <i style={{ width: `${matchInsights.winProbability.battingChance}%` }} />
                  </div>
                  <b>{matchInsights.winProbability.battingChance}%</b>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="commentary-feed pretty-commentary">
          {scoreboard.commentary.map((section, sectionIndex) => (
<details
  key={`innings-${section.inningsNo}-${sectionIndex}`}
  className="innings-wow-collapse"
>
  <summary className="innings-wow-summary">
    <div className="innings-wow-left">
      <span className="innings-wow-icon">🏏</span>

      <div>
        <strong>{section.title}</strong>
        <small>Tap to view detailed ball-by-ball commentary</small>
      </div>
    </div>

    <div className="innings-wow-right">
      <span className="innings-wow-count">
        {section.items?.length || 0} updates
      </span>
      <span className="innings-wow-caret">⌄</span>
    </div>
  </summary>

  <div className="commentary-innings-section innings-wow-content">
    {section.items.map((item, itemIndex) => (
      <div
        key={`commentary-${section.inningsNo}-${item.id ?? itemIndex}`}
        className={`commentary-item pretty-commentary-item ${
          item.type === "OVER_SUMMARY" ? "over-summary-item" : ""
        }`}
      >
        <div className={`commentary-ball ${item.badgeClass || ""}`}>
          {item.badge || item.over}
        </div>

        <div className="commentary-body">
          {item.type === "BALL" && item.badge !== "END" ? (
            <details className="commentary-inline-details">
              <summary className="commentary-inline-summary">
                <span className="commentary-main">{item.text}</span>
                <span className="commentary-inline-score">{item.score}</span>
                <span className="commentary-inline-caret">⌄</span>
              </summary>

              <div className="commentary-inline-stats">
                <span>🏏 {item.strikerSummary}</span>
                <span>🏃 {item.nonStrikerSummary}</span>
                <span>🎯 {item.bowlerSummary}</span>
              </div>
            </details>
          ) : item.type === "OVER_SUMMARY" ? (
            <details className="commentary-inline-details">
              <summary className="commentary-inline-summary">
                <span className="commentary-main">{item.text}</span>
                <span className="commentary-inline-score">{item.score}</span>
                <span className="commentary-inline-caret">⌄</span>
              </summary>

              <div className="commentary-inline-stats">
                <span>🎯 {item.bowlerSummary}</span>
              </div>
            </details>
          ) : (
            <div className="commentary-main">{item.text}</div>
          )}
        </div>
      </div>
    ))}
  </div>
</details>
          ))}
        </div>
      </>
    )}
  </Card>
)}
{selectedMatchId && !isSelectedMatchCompleted && scoringSubTab === "ADVANCED" && ( 
<Card
  className="scoring-console"
  title="🎯 Advanced Scoring"
  defaultCollapsed={false}
    right={
    selectedMatchId && !isSelectedMatchCompleted ? (
        <>
<div className="advanced-scoring-actions">
  <button type="button" className="scorer-mode-btn" onClick={() => {setScorerMode(true); setScorerDrawer(null);}}>🎯 Scorer Mode</button>
</div>
          </>
    ) : null
  }
>
          {!matchDetail ? (
            <p className="muted">Please select a match to view scoring, scoreboard, and commentary.</p>
          ) : (
            <>
<div className={scorerMode ? "scorer-mode-shell active" : ""}>
  {scorerMode && (
    <div className="scorer-mode-banner">
      🎯 Scorer Mode Active
    </div>
  )}

  <div className={scorerMode ? "scorer-wow-console scorer-mode-flat" : "tv-score-console scorer-wow-console"}>
  {liveMatchCenter && (
    <>
      {displayScoreboard && (
        <div className="match-insights-card scorer-insights-strip">
          {matchInsights.resultText && (
            <div className="insight-result">
              <span>🏆 Match Result</span>
              <strong>{matchInsights.resultText}</strong>
            </div>
          )}

          {matchInsights.potm && (
            <div className="insight-mini">
              <span>⭐ POTM</span>
              <strong>{matchInsights.potm.playerName}</strong>
            </div>
          )}

          {matchInsights.winProbability && (
            <div className="insight-mini">
              <span>📈 Win Probability</span>
              <strong>
                {matchInsights.winProbability.battingTeam}{" "}
                {matchInsights.winProbability.battingChance}%
              </strong>
            </div>
          )}
        </div>
      )}

      <div className="scorer-live-hud">
        <div className="scorer-hud-main">
          <div>
            <span className="tv-live-pill">● LIVE</span>
            <strong>
              {liveMatchCenter.runs}/{liveMatchCenter.wickets}
            </strong>
            <small>
              Inn {liveMatchCenter.inningsNo} • {liveMatchCenter.oversDisplay} ov
            </small>
          </div>

          <div className="scorer-hud-status">
            {displayScoreboard?.summary?.statusText || "Ready for next ball"}
          </div>
        </div>
          {!matchEnded && scoreboard?.currentState && (
  <>
        <div className="scorer-hud-players">

          <div className="striker">
            <span>⚡ Striker</span>
            <strong>{displayScoreboard?.currentState?.strikerName || "-"}</strong>
            <b>
              {displayScoreboard?.currentState?.strikerStats
                ? `${displayScoreboard.currentState.strikerStats.runs} (${displayScoreboard.currentState.strikerStats.balls})`
                : "0 (0)"}
            </b>
          </div>

          
          <div className="non-striker ">
            <span>🏃 Non-striker</span>
            <strong>{displayScoreboard?.currentState?.nonStrikerName || "-"}</strong>
            <b>
              {displayScoreboard?.currentState?.nonStrikerStats
                ? `${displayScoreboard.currentState.nonStrikerStats.runs} (${displayScoreboard.currentState.nonStrikerStats.balls})`
                : "0 (0)"}
            </b>
          </div>

          <div className="bowler">
            <span>🎯 Bowler</span>
            <strong>{displayScoreboard?.currentState?.bowlerName || "-"}</strong>
            <b>
              {displayScoreboard?.currentState?.bowlerStats
                ? `${displayScoreboard.currentState.bowlerStats.wickets}/${displayScoreboard.currentState.bowlerStats.runs} (${displayScoreboard.currentState.bowlerStats.overs} ov)`
                : "0/0"}
            </b>
          </div>

        </div>

        <div className="scorer-hud-metrics">
          <span>CRR <b>{liveMatchCenter.crr}</b></span>
          <span>RRR <b>{liveMatchCenter.rrr}</b></span>
          <span>Proj <b>{liveMatchCenter.projected}</b></span>
          <span>P’ship <b>{liveMatchCenter.partnershipRuns} ({liveMatchCenter.partnershipBalls})</b></span>
        </div>
  </>
)}        
      </div>
      {needsDeliverySetup ? (
        <div className="tv-status-banner setup">
          <strong>🎯 Setup required</strong>
          <span>
            {Number(ballForm.inningsNo) === 2
              ? "2nd innings is ready. Select striker, non-striker, and bowler."
              : "Select striker, non-striker, and bowler before scoring."}
          </span>

          <button
            type="button"
            className="mgmt-clean-btn"
            onClick={() => setShowDeliverySetupModal(true)}
          >
            Setup Delivery
          </button>
        </div>
      ) : (
        !(
          selectedMatch &&
          ["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(
            String(selectedMatch.status || "").toUpperCase()
          )
        ) && (
          <div
          >
            {error ||
              instantDeliveryStatus ||
              message ||
              overCompleteNotice ||
              "🏏 Ready for next delivery"}
                      </div>
        )
      )}

      <div className="scorer-recent-wow">
        <span>
          Recent <small>last 10</small>
        </span>

        <div className="recent-ball-strip">
          {recentBalls.length ? (
            recentBalls.slice(0, 10).map((ball, index) => {
              const label = ball.label || "";
              const recent10 = recentBalls.slice(0, 10);
              const currentOver = label.split(".")[0];

              const prevOver =
                index > 0
                  ? recent10[index - 1]?.label?.split(".")[0]
                  : currentOver;

              const ballResult = (
                label.split(" ").slice(1).join(" ") || label
              ).replace(/[()]/g, "");

              return (
                <React.Fragment key={ball.id || index}>
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
      </div>
      {liveMatchCenter?.isSecondInnings && liveMatchCenter?.target > 0 && (
        <div className="tv-chase-mini scorer-chase-wow">
          <span>Target <b>{liveMatchCenter.target}</b></span>
          <span>Need <b>{liveMatchCenter.runsRequired}</b></span>
          <span>Balls <b>{liveMatchCenter.ballsRemaining}</b></span>
        </div>
      )}
    </>
  )}
  {scorerMode && (
  <div className={`scorer-workspace ${scorerDrawer ? "open" : ""}`}>
    <div className="scorer-workspace-panel">
      <div className="scorer-workspace-head">
        <strong>
          {scorerDrawer === "scoreboard"
            ? "📊 Scoreboard"
            : scorerDrawer === "commentary"
            ? "📝 Commentary"
            : scorerDrawer === "setup"
            ? "⚙️ Match Setup"
            : ""}
        </strong>

        <button type="button" onClick={() => setScorerDrawer(null)}>
          ✕
        </button>
      </div>

      <div className="scorer-workspace-body">
  {scorerDrawer === "scoreboard" && (
  <div className="scorer-scoreboard-panel">
    {(() => {
      const currentInningsNo = Number(scoreboard?.currentInnings || 1);
      const activeInnings =
        scoreboard?.innings?.[currentInningsNo - 1] ||
        scoreboard?.innings?.[0];

      const battingRows =
        activeInnings?.battingStats ||
        activeInnings?.battingRows ||
        [];

      const bowlingRows =
        activeInnings?.bowlingStats ||
        activeInnings?.bowlingRows ||
        [];

      const topBatters = [...battingRows]
        .filter((p) => Number(p.runs || 0) > 0)
        .sort((a, b) => Number(b.runs || 0) - Number(a.runs || 0))
        .slice(0, 3);

      const topBowlers = [...bowlingRows]
        .filter((p) => Number(p.wickets || 0) > 0 || Number(p.runs || 0) > 0)
        .sort((a, b) => {
          const wicketDiff =
            Number(b.wickets || 0) - Number(a.wickets || 0);

          if (wicketDiff !== 0) return wicketDiff;

          return Number(a.runs || 0) - Number(b.runs || 0);
        })
        .slice(0, 3);

      return (
        <>
          <div className="scorer-scoreboard-summary">
            <div className="drawer-stat-card score-main">
              <span>Score</span>
              <strong>
                {activeInnings?.runs ?? 0}/{activeInnings?.wickets ?? 0}
              </strong>
              <small>
                Inn {currentInningsNo} • {activeInnings?.oversDisplay || "0.0"} ov
              </small>
            </div>

            <div className="drawer-stat-card">
              <span>Run Rate</span>
              <strong>{activeInnings?.runRate || "0.00"}</strong>
            </div>

            <div className="drawer-stat-card">
              <span>Powerplay</span>
              <strong>
                {activeInnings?.powerplay?.runs ?? 0}/
                {activeInnings?.powerplay?.wickets ?? 0}
              </strong>
            </div>

            {liveMatchCenter?.isSecondInnings && liveMatchCenter?.target > 0 ? (
              <div className="drawer-stat-card chase-card">
                <span>Chase</span>
                <strong>
                  Need {liveMatchCenter?.runsRequired ?? "-"}
                </strong>
                <small>
                  {liveMatchCenter?.ballsRemaining ?? "-"} balls left
                </small>
              </div>
            ) : (
              <div className="drawer-stat-card">
                <span>Projected</span>
                <strong>{liveMatchCenter?.projected || "-"}</strong>
              </div>
            )}
          </div>

          <div className="scorer-current-pair">
            <div className="current-player-mini striker">
              <span>⚡ Striker</span>
              <strong>{scoreboard?.currentState?.strikerName || "-"}</strong>
              <b>
                {scoreboard?.currentState?.strikerStats
                  ? `${scoreboard.currentState.strikerStats.runs} (${scoreboard.currentState.strikerStats.balls})`
                  : "0 (0)"}
              </b>
            </div>

            <div className="current-player-mini">
              <span>🏃 Non-striker</span>
              <strong>{scoreboard?.currentState?.nonStrikerName || "-"}</strong>
              <b>
                {scoreboard?.currentState?.nonStrikerStats
                  ? `${scoreboard.currentState.nonStrikerStats.runs} (${scoreboard.currentState.nonStrikerStats.balls})`
                  : "0 (0)"}
              </b>
            </div>

            <div className="current-player-mini bowler">
              <span>🎯 Bowler</span>
              <strong>{scoreboard?.currentState?.bowlerName || "-"}</strong>
              <b>
                {scoreboard?.currentState?.bowlerStats
                  ? `${scoreboard.currentState.bowlerStats.wickets}/${scoreboard.currentState.bowlerStats.runs} (${scoreboard.currentState.bowlerStats.overs} ov)`
                  : "0/0"}
              </b>
            </div>
          </div>

          <div className="scorer-scoreboard-columns">
            <div className="mini-score-table-card">
              <div className="mini-score-table-head">
                <strong>🏏 Top Batters</strong>
                <span>Runs</span>
              </div>

              {topBatters.length ? (
                topBatters.map((p) => (
                  <div key={p.playerId || p.playerName} className="mini-score-row">
                    <span>{p.playerName || p.name}</span>
                    <strong>
                      {p.runs} ({p.balls})
                    </strong>
                  </div>
                ))
              ) : (
                <div className="mini-empty-row">No batting stats yet</div>
              )}
            </div>

            <div className="mini-score-table-card">
              <div className="mini-score-table-head">
                <strong>🎯 Top Bowlers</strong>
                <span>Figures</span>
              </div>

              {topBowlers.length ? (
                topBowlers.map((p) => (
                  <div key={p.playerId || p.playerName} className="mini-score-row">
                    <span>{p.playerName || p.name}</span>
                    <strong>
                      {p.wickets}/{p.runs} ({p.overs})
                    </strong>
                  </div>
                ))
              ) : (
                <div className="mini-empty-row">No bowling stats yet</div>
              )}
            </div>
          </div>

          <div className="scorer-scoreboard-footer">
            <span>
              Partnership:{" "}
              <b>
                {liveMatchCenter?.partnershipRuns ?? 0} (
                {liveMatchCenter?.partnershipBalls ?? 0})
              </b>
            </span>

            <span>
              CRR: <b>{liveMatchCenter?.crr || "0.00"}</b>
            </span>

            {liveMatchCenter?.rrr && liveMatchCenter?.rrr !== "—" && (
              <span>
                RRR: <b>{liveMatchCenter.rrr}</b>
              </span>
            )}
          </div>
        </>
      );
    })()}
  </div>
)}

{scorerDrawer === "commentary" && (
  <div className="scorer-commentary-panel">
    <div className="scorer-commentary-summary">
      <div>
        <span>Current Score</span>
        <strong>
          {liveMatchCenter?.runs ?? 0}/{liveMatchCenter?.wickets ?? 0}
        </strong>
      </div>

      <div>
        <span>Overs</span>
        <strong>{liveMatchCenter?.oversDisplay || "0.0"}</strong>
      </div>

      <div>
        <span>CRR</span>
        <strong>{liveMatchCenter?.crr || "0.00"}</strong>
      </div>

      {liveMatchCenter?.isSecondInnings && liveMatchCenter?.target > 0 && (
        <div>
          <span>Need</span>
          <strong>
            {liveMatchCenter?.runsRequired ?? "-"} from{" "}
            {liveMatchCenter?.ballsRemaining ?? "-"}
          </strong>
        </div>
      )}
    </div>

    <div className="scorer-commentary-list">
      {scoreboard?.recentBalls?.length ? (
        scoreboard.recentBalls.slice(0, 18).map((ball, index) => {
          const label = ball.label || "";
          const cleanBallText =
            label
              .split(" ")
              .slice(1)
              .join(" ")
              .replace(/[()]/g, "") || "-";

          const isWicket =
            cleanBallText.toUpperCase().includes("W") &&
            !cleanBallText.toUpperCase().includes("WD");

          const isBoundary =
            cleanBallText === "4" || cleanBallText === "6";

          const isExtra =
            cleanBallText.toUpperCase().includes("WD") ||
            cleanBallText.toUpperCase().includes("NB") ||
            cleanBallText.toUpperCase().includes("LB") ||
            cleanBallText.toUpperCase() === "B";

          return (
            <div
              key={ball.id || index}
              className={`scorer-commentary-item ${
                isWicket
                  ? "wicket"
                  : isBoundary
                  ? "boundary"
                  : isExtra
                  ? "extra"
                  : ""
              }`}
            >
              <div className="commentary-ball-badge">
                {cleanBallText}
              </div>

              <div className="commentary-ball-main">
                <strong>{label}</strong>

                <span>
                  {ball.text ||
                    ball.note ||
                    (isWicket
                      ? "Wicket recorded"
                      : isBoundary
                      ? "Boundary scored"
                      : isExtra
                      ? "Extra run"
                      : "Delivery recorded")}
                </span>
              </div>
            </div>
          );
        })
      ) : (
        <div className="scorer-commentary-empty">
          No commentary yet. Score the first ball to start the match story.
        </div>
      )}
    </div>
  </div>
)}

{scorerDrawer === "setup" && (
  <div className="scorer-setup-panel">
    <div className="scorer-drawer-grid">
      <div className="drawer-stat-card">
        <span>Overs / Innings</span>
        <strong>{matchDetail?.oversPerInnings || "-"}</strong>
      </div>

      <div className="drawer-stat-card">
        <span>Powerplay</span>
        <strong>{matchDetail?.powerplayOversInnings ?? 0}</strong>
      </div>

      <div className="drawer-stat-card">
        <span>Wickets</span>
        <strong>{matchDetail?.maxWicketsPerInnings || "∞"}</strong>
      </div>

      <div className="drawer-stat-card">
        <span>Max / Bowler</span>
        <strong>{matchDetail?.maxOversPerBowler || "∞"}</strong>
      </div>

      <div className="drawer-stat-card">
        <span>Status</span>
        <strong>{selectedMatch?.status || matchDetail?.status || "-"}</strong>
      </div>

      <div className="drawer-stat-card">
        <span>Batting First</span>
        <strong>
          {selectedMatch?.battingFirstTeamName ||
            playerNameFromTeam(matchDetail?.teamA, matchDetail?.battingFirstTeamId) ||
            "Not decided"}
        </strong>
      </div>
    </div>

    <div className="scorer-officials-grid">
      <div className="scorer-official-card">
        <strong>{matchDetail?.teamA?.name || "Team A"}</strong>

        <span>
          🧢 Captain:{" "}
          {playerNameFromTeam(matchDetail?.teamA, matchDetail?.teamACaptainId) ||
            "Not selected"}
        </span>

        <span>
          🧤 WK:{" "}
          {playerNameFromTeam(matchDetail?.teamA, matchDetail?.teamAWicketKeeperId) ||
            "Not selected"}
        </span>
      </div>

      <div className="scorer-official-card">
        <strong>{matchDetail?.teamB?.name || "Team B"}</strong>

        <span>
          🧢 Captain:{" "}
          {playerNameFromTeam(matchDetail?.teamB, matchDetail?.teamBCaptainId) ||
            "Not selected"}
        </span>

        <span>
          🧤 WK:{" "}
          {playerNameFromTeam(matchDetail?.teamB, matchDetail?.teamBWicketKeeperId) ||
            "Not selected"}
        </span>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  </div>
)}  
{permissions?.canScoreMatch && (
  <div className="scorer-actions-panel">
<div className="quick-actions scorer-run-buttons scorer-mobile-pad">
  {[0, 1, 2, 3, 4, 6].map((run) => (
    <button
      key={run}
      type="button"
      disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned}
      className={`chip score-chip ${activeQuickAction === String(run) ? "chip-active" : ""}`}
      onClick={() => triggerQuickAction(String(run), () => quickNormalBall(run))}
    >
      {run}
    </button>
  ))}

  <button type="button" className={`chip score-chip ${activeQuickAction === "Wd" ? "chip-active" : ""}`} disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} onClick={() => triggerQuickAction("Wd", () => quickExtra("WIDE"))}>Wd</button>
  <button type="button" className={`chip score-chip ${activeQuickAction === "Nb" ? "chip-active" : ""}`} disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} onClick={() => triggerQuickAction("Nb", () => quickExtra("NOBALL"))}>Nb</button>
  <button type="button" className={`chip score-chip ${activeQuickAction === "B" ? "chip-active" : ""}`} disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} onClick={() => triggerQuickAction("B", () => quickExtra("BYE"))}>B</button>
  <button type="button" className={`chip score-chip ${activeQuickAction === "LB" ? "chip-active" : ""}`} disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} onClick={() => triggerQuickAction("LB", () => quickExtra("LEGBYE"))}>LB</button>

  <button type="button" className={`chip score-chip score-wide ${activeQuickAction === "W" ? "chip-active" : ""}`} disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} onClick={() => triggerQuickAction("W", () => quickWicket("BOWLED"))}>Wkt</button>

  <button type="button" className="chip score-chip score-wide chip-retired-hurt" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} onClick={() => setShowRetiredHurtModal(true)}>Rtd H</button>

  <button type="button" className="chip score-chip score-wide chip-swap" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} onClick={swapBatters}>⇄ Swap</button>

  <button
    type="button"
    className="chip score-chip score-wide score-undo"
    disabled={isMatchLocked}
    onClick={handleUndoBall}
  >
    ↩ Undo
  </button>
</div>

    <div className="mobile-secondary-actions scorer-secondary-row">
      <button type="button" className="btn btn-outline action-change-wk" disabled={isMatchCompleted || isMatchLocked || isMatchAbandoned} onClick={() => setShowKeeperChangeModal(true)}>
        🧤 Change WK
      </button>

      {lastCorrectionId && (
        <button type="button" className={`btn btn-outline ${rollbackSaving ? "btn-loading" : ""}`} disabled={rollbackSaving} onClick={() => rollbackCorrection(lastCorrectionId)}>
          {rollbackSaving ? "Restoring..." : "Rollback"}
        </button>
      )}
      {Number(ballForm.inningsNo) === 1 &&
        scoreboard?.match?.status !== "COMPLETED" &&
        scoreboard?.match?.status !== "COMPLETED_LOCKED" &&
        scoreboard?.match?.status !== "COMPLETED_CORRECTED" && (
          <button type="button" className="end-innings-pill action-end-innings" onClick={handleEndFirstInnings}>
            <span>🛑 End 1st Innings</span>
            <small>Finished batting?</small>
          </button>
        )}
    </div>
  </div>
)}
    {(isMatchCompleted || isMatchLocked || isMatchCorrected) && (
      <button type="submit" form="add-ball-form" className="btn scoring-btn scoring-btn-primary" disabled>
        ✅ Match Ended
      </button>
    )}

    {isMatchAbandoned && (
      <button type="submit" form="add-ball-form" className="btn scoring-btn scoring-btn-primary" disabled>
        ⛔ Match Abandoned
      </button>
    )}
{scorerMode && voiceStatus && (
  <div className="voice-score-status">
    {voiceStatus}
  </div>
)}

{!isMobile && (
  <>
      Keyboard shortcuts: 0 1 2 3 4 6 • W wicket • D wide • N no-ball • U undo
</>
)}
      </div>

{permissions?.canScoreMatch  && (isMobile ? (
  <>
    <button
  type="button"
  className="chip score-chip score-wide"
  onClick={() => setShowAdvancedSheet(true)}
>
  ⚙️ Scoring Form
</button>
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
 onChange={(e) => {
  const nextType = e.target.value;

  setRunOutRuns(nextType === "RUN_OUT" ? 0 : null);

  setBallForm((prev) => ({
    ...prev,
    wicketType: nextType,
    dismissedPlayerId:
      nextType === "RUN_OUT"
        ? prev.dismissedPlayerId || prev.strikerId
        : prev.strikerId,
    newBatterId: "",
    fielderId: "",
    assistantFielderId: "",
  }));
}}
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
                    {WICKET_TYPES
  .filter((type) => type !== "RETIRED_HURT")
  .map((type) => (
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
                    {wicketNewBatterOptions.map((p) => (
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
                    {WICKET_TYPES
  .filter((type) => type !== "RETIRED_HURT")
  .map((type) => (
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
{scorerMode && (
  <div className="scorer-dock-area">
    <div className="scorer-quick-dock compact">
      <button
        type="button"
        className={scorerDrawer === "scoreboard" ? "active" : ""}
        onClick={() =>
          setScorerDrawer((prev) => (prev === "scoreboard" ? null : "scoreboard"))
        }
      >
        <span className="dock-icon">📊</span>
        <span className="dock-text">Scorecard</span>
      </button>

      <button
        type="button"
        className={scorerDrawer === "commentary" ? "active" : ""}
        onClick={() =>
          setScorerDrawer((prev) => (prev === "commentary" ? null : "commentary"))
        }
      >
        <span className="dock-icon">📝</span>
        <span className="dock-text">Commentary</span>
      </button>

      <button
        type="button"
        className={scorerDrawer === "setup" ? "active" : ""}
        onClick={() =>
          setScorerDrawer((prev) => (prev === "setup" ? null : "setup"))
        }
      >
        <span className="dock-icon">⚙️</span>
        <span className="dock-text">Setup</span>
      </button>

      <button
        type="button"
        className="voice-btn"
        onClick={startBrowserVoiceScore}
      >
        <span className="dock-icon">🎤</span>
        <span className="dock-text">Voice</span>
      </button>

      <button type="button" onClick={() => setScorerMode(false)}>
        <span className="dock-icon">✕</span>
        <span className="dock-text">Exit</span>
      </button>
    </div>

    {(voiceMessage || voiceStatus) && (
      <div className="voice-score-message compact">
        {voiceMessage || voiceStatus}
      </div>
    )}
  </div>
)}     
    </div>
            </>            
          )}

        </Card>
)}        
{selectedMatchId && permissions?.canScoreMatch && !(
  selectedMatch &&
  ["COMPLETED_LOCKED"].includes(
    String(selectedMatch.status || "").toUpperCase()
  )
) &&(
<div>
  <div className="match-control-bar">
    <button
      type="button"
      className="match-control-btn lock"
      disabled={isMatchLocked}
      onClick={handleLockMatch}
    >
        <span>🔒</span>
    <label>Lock</label>
    </button>
{(!isMatchAbandoned && !isMatchCompleted && !isMatchLocked) && (
    <button
      type="button"
      className="match-control-btn abandon"
      disabled={isMatchLocked || isMatchCompleted}
      onClick={handleAbandonMatch}
    >
      <span>⛔</span>
    <label>Abandon</label>
    </button>
    
)}    
{(ballForm.inningsNo != 1 && !isMatchLocked && !isMatchAbandoned && !isMatchCompleted) && (
  <button
  type="button"
  className="match-control-btn end"
  onClick={handleEndMatch}
>
      <span>🏁</span>
    <label>End Match</label>
</button>
)}
  </div>

  <div className="match-warning">
    ⚠️ Once locked, this match cannot be edited or scored further.
  </div>
</div>
)}</Card>
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
    {!activeLeagueId && (
      <Card title="📋 Matches">
        <div className="empty-state">
          Select a league to view or create matches.
        </div>
      </Card>
    )}
<Card title = "Matches">
<div className="matches-command-center">
  <div className="match-league-picker">
    <div>
      <span className="command-kicker">🏆 Active League</span>
      <strong>
        {leagues.find((l) => Number(l.id) === Number(activeLeagueId))?.name ||
          "Select a league"}
      </strong>
      </div>
      <div className="combo-visual-cue" aria-hidden="true">
  <span className="combo-ripple" />
</div>
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

    <span className="picker-arrow">⌄</span>
  </div>

  <div className="match-filter-action">
    <ContextLens />
  </div>
</div>

<div className="matches-subtabs pro-match-tabs">
  {[
    ["CREATE MATCH", "➕", "Create"],
    ["ACTIVE", "🟢", "Active"],
    ["SCHEDULED", "📅", "Scheduled"],
    ["COMPLETED", "✅", "Completed"],
  ].map(([key, icon, label]) => (
    <button
      key={key}
      type="button"
      className={matchesSubTab === key ? "active" : ""}
      onClick={() => setMatchesSubTab(key)}
    >
      <span className="tab-icon">{icon}</span>
      <span className="tab-label">{label}</span>
    </button>
  ))}
</div> 
    {activeLeagueId && matchesSubTab === "CREATE MATCH" && (
<Card title="➕ Create Match">
  <form className="form create-match-form pro-create-match-form" onSubmit={handleCreateMatch}>
    <div className="create-match-topbar">
      <div>
        <span>Active League</span>
        <strong>
          {leagues.find((l) => Number(l.id) === Number(activeLeagueId))?.name ||
            "No league selected"}
        </strong>
      </div>

      <div>
        <span>Series</span>
        <small>Optional for tournaments, cups, seasons, or years.</small>
      </div>
    </div>

    <section className="create-match-section">
      <h3>🏆 Match Info</h3>

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
      </label>

      <div className="form-two-col">
        <label>
          <span>Team A</span>
          <select
            value={matchForm.teamAId || ""}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                teamAId: e.target.value,
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
                teamBId: e.target.value,
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

      <div className="form-two-col">
        <label>
          <span>Batting First</span>
          <select
            value={matchForm.battingFirstTeamId || ""}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                battingFirstTeamId: e.target.value,
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
        </label>

        <label>
          <span>Scheduled Start</span>
          <input
            type="datetime-local"
            value={matchForm.scheduledAt || ""}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                scheduledAt: e.target.value,
              }))
            }
          />
        </label>
      </div>
    </section>

    <section className="create-match-section">
      <h3>👥 Captains & Wicketkeepers</h3>

      <div className="form-two-col">
        <label>
          <span>Team A Captain</span>
          <select
            value={matchForm.teamACaptainId || ""}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                teamACaptainId: e.target.value,
              }))
            }
          >
            <option value="">Optional</option>
            {teams
              .find((t) => Number(t.id) === Number(matchForm.teamAId))
              ?.players?.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
        </label>

        <label>
          <span>Team B Captain</span>
          <select
            value={matchForm.teamBCaptainId || ""}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                teamBCaptainId: e.target.value,
              }))
            }
          >
            <option value="">Optional</option>
            {teams
              .find((t) => Number(t.id) === Number(matchForm.teamBId))
              ?.players?.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
        </label>

        <label>
          <span>Team A Wicketkeeper</span>
          <select
            value={matchForm.teamAWicketKeeperId || ""}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                teamAWicketKeeperId: e.target.value,
              }))
            }
          >
            <option value="">Optional</option>
            {teams
              .find((t) => Number(t.id) === Number(matchForm.teamAId))
              ?.players?.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
        </label>

        <label>
          <span>Team B Wicketkeeper</span>
          <select
            value={matchForm.teamBWicketKeeperId || ""}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                teamBWicketKeeperId: e.target.value,
              }))
            }
          >
            <option value="">Optional</option>
            {teams
              .find((t) => Number(t.id) === Number(matchForm.teamBId))
              ?.players?.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
        </label>
      </div>
    </section>

    <section className="create-match-section">
      <h3>⚙️ Match Rules</h3>

      <div className="form-two-col">
        <label>
          <span>Overs / Innings</span>
          <input
            type="number"
            min="1"
            value={matchForm.oversPerInnings}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                oversPerInnings: e.target.value,
              }))
            }
            required
          />
        </label>

        <label>
          <span>Powerplay Overs</span>
          <input
            type="number"
            min="0"
            value={matchForm.powerplayOversInnings}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                powerplayOversInnings: e.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Max Wickets</span>
          <input
            type="number"
            value={matchForm.maxWicketsPerInnings}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                maxWicketsPerInnings: e.target.value,
              }))
            }
          />
          <small className="muted">Empty = unlimited</small>
        </label>

        <label>
          <span>Max/Bowler</span>
          <input
            type="number"
            min="1"
            value={matchForm.maxOversPerBowler}
            onChange={(e) =>
              setMatchForm((prev) => ({
                ...prev,
                maxOversPerBowler: e.target.value,
              }))
            }
          />
          <small className="muted">Example: 4 in T20</small>
        </label>
      </div>
    </section>

    {!permissions?.canScoreMatch ? (
      <div className="permission-warning">
        👉 You do not have permission to create a match.
      </div>
    ) : (
      <button type="submit" className="btn create-match-btn pro-create-submit">
        ✅ Create Match
      </button>
    )}
  </form>
</Card>
    )}

{activeLeagueId && matchesSubTab === "ACTIVE" && (
  <Card title="🟢 Active Matches">
    {activeMatches.length === 0 ? (
      <div className="empty-state">
        No active matches found.
      </div>
    ) : (
      <>
        {/* =====================================================
            DESKTOP / LAPTOP VIEW
            Existing layout remains unchanged
        ====================================================== */}
        <div className="matches-desktop-only">
          <div className="pro-active-list">
            {filteredActiveMatches.map((match) => {
              const isSelected =
                String(selectedMatchId) === String(match.id);

              const shareCode =
                match?.shareCode ||
                match?.sharecode ||
                match?.publicShareCode;

              return (
                <article
                  key={`desktop-active-${match.id}`}
                  className={`pro-active-card ${
                    isSelected ? "selected" : ""
                  }`}
                >
                  <div className="pro-active-card-topbar">
                    <div className="active-status-row">
                      <span className="status-pill live-status-pill">
                        ● {match.status}
                      </span>

                      <button
                        type="button"
                        className="active-share-icon-btn"
                        title="Share spectator link"
                        aria-label={`Share ${match.teamAName} versus ${match.teamBName}`}
                        onClick={() =>
                          handleShareActiveMatch(match)
                        }
                        disabled={!shareCode}
                      >
                        📤
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="pro-active-main"
                    onClick={() => {
                      setSelectedMatchId(String(match.id));
                      handleMatchSelect(match.id);
                    }}
                  >
                    <div className="pro-active-header">
                      <div className="pro-active-main-info">
                        <h3>
                          {match.teamAName}
                          <b>vs</b>
                          {match.teamBName}
                        </h3>

                        <p>
                          🕒 {getMatchTimelineText(match)}
                        </p>
                      </div>

                      <div className="pro-live-score-box">
                        <span>Live Score</span>

                        <strong>
                          {match.scoreSummary ||
                            match.liveScore ||
                            "Open match to view"}
                        </strong>
                      </div>
                    </div>
                  </button>

                  <div className="pro-active-actions">
                    {permissions?.canScoreMatch && (
                      <button
                        type="button"
                        className={`start-match-btn ${
                          isSelected ? "is-open" : ""
                        }`}
                        onClick={() => {
                          setSelectedMatchId(
                            String(match.id)
                          );
                          handleMatchSelect(match.id);
                        }}
                      >
                        {isSelected
                          ? "✅ Scoring Open"
                          : "🏏 Open Scoring"}
                      </button>
                    )}

                    {permissions?.canDeleteMatch && (
                      <button
                        type="button"
                        className="mini-action-btn danger-mini-btn"
                        title={`Delete ${match.teamAName} vs ${match.teamBName}`}
                        aria-label={`Delete ${match.teamAName} versus ${match.teamBName}`}
                        onClick={() =>
                          handleDeleteMatch(match.id)
                        }
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  <details className="active-match-facts-collapse">
                    <summary className="active-match-facts-summary">
                      <div className="active-match-facts-summary-left">
                        <span className="active-match-facts-icon">
                          ⚙️
                        </span>

                        <div>
                          <strong>
                            Match Setup & Team Roles
                          </strong>

                          <small>
                            Overs, wickets, powerplay,
                            captains and wicketkeepers
                          </small>
                        </div>
                      </div>

                      <div className="active-match-facts-summary-right">
                        <span className="active-match-facts-count">
                          9 details
                        </span>

                        <span className="active-match-facts-arrow">
                          ⌄
                        </span>
                      </div>
                    </summary>

                    <div className="active-match-facts-grid">
                      <div className="active-match-fact-item">
                        <span>🏏 Batting First</span>
                        <strong>
                          {match.battingFirstTeamName ||
                            "Not decided"}
                        </strong>
                      </div>

                      <div className="active-match-fact-item">
                        <span>🎯 Overs</span>
                        <strong>
                          {match.oversPerInnings}
                        </strong>
                      </div>

                      <div className="active-match-fact-item">
                        <span>⚾ Wickets</span>
                        <strong>
                          {match.maxWicketsPerInnings ??
                            "∞"}
                        </strong>
                      </div>

                      <div className="active-match-fact-item">
                        <span>⚡ Powerplay</span>
                        <strong>
                          {match.powerplayOversInnings ??
                            0}
                        </strong>
                      </div>

                      <div className="active-match-fact-item">
                        <span>🎳 Max / Bowler</span>
                        <strong>
                          {match.maxOversPerBowler ??
                            "∞"}
                        </strong>
                      </div>

                      <div className="active-match-fact-item role-item">
                        <span>
                          🧤 {match.teamAName} Wicketkeeper
                        </span>
                        <strong>
                          {match.teamAWicketKeeperName ||
                            "Not selected"}
                        </strong>
                      </div>

                      <div className="active-match-fact-item role-item">
                        <span>
                          🧤 {match.teamBName} Wicketkeeper
                        </span>
                        <strong>
                          {match.teamBWicketKeeperName ||
                            "Not selected"}
                        </strong>
                      </div>

                      <div className="active-match-fact-item role-item">
                        <span>
                          👑 {match.teamAName} Captain
                        </span>
                        <strong>
                          {match.teamACaptainName ||
                            "Not selected"}
                        </strong>
                      </div>

                      <div className="active-match-fact-item role-item">
                        <span>
                          👑 {match.teamBName} Captain
                        </span>
                        <strong>
                          {match.teamBCaptainName ||
                            "Not selected"}
                        </strong>
                      </div>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </div>

        {/* =====================================================
            MOBILE VIEW
            New compact and sleek design
        ====================================================== */}
        <div className="matches-mobile-only">
<div className="mobile-wow-match-list">
  {filteredActiveMatches.map((match) => {
    const isSelected =
      String(selectedMatchId) === String(match.id);

    const shareCode =
      match?.shareCode ||
      match?.sharecode ||
      match?.publicShareCode;

    const statusLabel = String(match.status || "ACTIVE")
      .replaceAll("_", " ")
      .trim();

    return (
      <article
        key={`mobile-active-${match.id}`}
        className={`mobile-wow-card mobile-wow-active ${
          isSelected ? "is-selected" : ""
        }`}
      >
        {/* Header */}
        <div className="mobile-wow-top">
          <span className="mobile-wow-status live">
            <i />
            {statusLabel}
          </span>

          <button
            type="button"
            className="mobile-wow-icon-btn"
            title="Share spectator link"
            aria-label={`Share ${match.teamAName} versus ${match.teamBName}`}
            onClick={() => handleShareActiveMatch(match)}
            disabled={!shareCode}
          >
            📤
          </button>
        </div>

        {/* Teams */}
        <div className="mobile-wow-teams">
          <strong>{match.teamAName}</strong>
          <span>VS</span>
          <strong>{match.teamBName}</strong>
        </div>

        <div className="mobile-wow-subtitle">
          🕒 {getMatchTimelineText(match)}
        </div>

        {/* Large live-score presentation */}
        <button
          type="button"
          className="mobile-wow-live-score"
          onClick={() => {
            setSelectedMatchId(String(match.id));
            handleMatchSelect(match.id);
          }}
        >
          <div>
            <span>
              <i />
              Live score
            </span>

            <strong>
              {match.scoreSummary ||
                match.liveScore ||
                "Tap to view live score"}
            </strong>
          </div>

          <b>›</b>
        </button>

        {/* Actions */}
        <div className="mobile-wow-actions">
          {permissions?.canScoreMatch && (
            <button
              type="button"
              className={`mobile-wow-primary ${
                isSelected ? "is-open" : ""
              }`}
              onClick={() => {
                setSelectedMatchId(String(match.id));
                handleMatchSelect(match.id);
              }}
            >
              {isSelected
                ? "✅ Continue Scoring"
                : "🏏 Open Scoring"}
            </button>
          )}

          {permissions?.canDeleteMatch && (
            <button
              type="button"
              className="mobile-wow-delete"
              title="Delete match"
              aria-label={`Delete ${match.teamAName} versus ${match.teamBName}`}
              onClick={() => handleDeleteMatch(match.id)}
            >
              🗑️
            </button>
          )}
        </div>

        {/* One simple expandable area */}
        <details className="mobile-wow-details">
          <summary>
            <div>
              <span>⚙️</span>

              <strong>Match Setup & Team Roles</strong>
            </div>

            <i>⌄</i>
          </summary>

          <div className="mobile-wow-details-body">
            <div className="mobile-wow-rule-list">
              <div>
                <span>Batting first</span>
                <strong>
                  {match.battingFirstTeamName || "Not decided"}
                </strong>
              </div>

              <div>
                <span>Overs</span>
                <strong>{match.oversPerInnings}</strong>
              </div>

              <div>
                <span>Wickets</span>
                <strong>
                  {match.maxWicketsPerInnings ?? "Unlimited"}
                </strong>
              </div>

              <div>
                <span>Powerplay</span>
                <strong>
                  {match.powerplayOversInnings ?? 0}
                </strong>
              </div>

              <div>
                <span>Max overs / bowler</span>
                <strong>
                  {match.maxOversPerBowler ?? "Unlimited"}
                </strong>
              </div>
            </div>

            <div className="mobile-wow-role-section">
              <h4>Team Roles</h4>

              <div>
                <span>🧤 {match.teamAName} wicketkeeper</span>
                <strong>
                  {match.teamAWicketKeeperName ||
                    "Not selected"}
                </strong>
              </div>

              <div>
                <span>👑 {match.teamAName} captain</span>
                <strong>
                  {match.teamACaptainName ||
                    "Not selected"}
                </strong>
              </div>

              <div>
                <span>🧤 {match.teamBName} wicketkeeper</span>
                <strong>
                  {match.teamBWicketKeeperName ||
                    "Not selected"}
                </strong>
              </div>

              <div>
                <span>👑 {match.teamBName} captain</span>
                <strong>
                  {match.teamBCaptainName ||
                    "Not selected"}
                </strong>
              </div>
            </div>
          </div>
        </details>
      </article>
    );
  })}
</div>
        </div>
      </>
    )}
  </Card>
)}

 {activeLeagueId && matchesSubTab === "SCHEDULED" && (
  <Card title="📅 Scheduled Matches">
    {scheduledMatches.length === 0 ? (
      <div className="empty-state">
        No scheduled matches found.
      </div>
    ) : (
      <>
        {/* =====================================================
            DESKTOP / LAPTOP VIEW
            Keep existing layout and functionality
        ====================================================== */}
        <div className="matches-desktop-only">
          <div className="pro-scheduled-list">
            {filteredScheduledMatches.map((match) => {
              const shareCode =
                match?.shareCode ||
                match?.sharecode ||
                match?.publicShareCode;

              return (
                <article
                  key={`desktop-scheduled-${match.id}`}
                  className="pro-scheduled-card"
                >
                  <div className="pro-scheduled-header">
                    <div className="pro-scheduled-main-info">
                      <div className="scheduled-card-topline">
                        <span className="status-pill">
                          {match.status}
                        </span>

                        <button
                          type="button"
                          className="active-share-icon-btn"
                          title="Share spectator link"
                          aria-label={`Share ${match.teamAName} versus ${match.teamBName}`}
                          onClick={() =>
                            handleShareScheduledMatch(match)
                          }
                          disabled={!shareCode}
                        >
                          📤
                        </button>
                      </div>

                      <h3>
                        {match.teamAName}
                        <b>vs</b>
                        {match.teamBName}
                      </h3>

                      <p>
                        📅{" "}
                        {match.scheduledAt
                          ? formatDate(match.scheduledAt)
                          : "Schedule not decided"}
                      </p>
                    </div>

                    <div className="pro-scheduled-actions">
                      {permissions?.canScoreMatch && (
                        <button
                          type="button"
                          className="start-match-btn"
                          onClick={() =>
                            handleStartMatch(match)
                          }
                        >
                          ▶ Start
                        </button>
                      )}

                      {normalizeStatus(match.status) ===
                        "SCHEDULED" && (
                        <button
                          type="button"
                          className="mini-action-btn"
                          onClick={() =>
                            openEditMatchModal(match)
                          }
                        >
                          ✏️ Edit
                        </button>
                      )}

                      {permissions?.canDeleteMatch && (
                        <button
                          type="button"
                          className="mini-action-btn danger-mini-btn"
                          title={`Delete ${match.teamAName} vs ${match.teamBName}`}
                          aria-label={`Delete ${match.teamAName} versus ${match.teamBName}`}
                          onClick={() =>
                            handleDeleteMatch(match.id)
                          }
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  <details className="scheduled-facts-wow">
                    <summary className="scheduled-facts-wow-summary">
                      <div>
                        <strong>
                          📌 Match Setup & Roles
                        </strong>

                        <small>
                          Click to view match rules,
                          captains & wicketkeepers
                        </small>
                      </div>

                      <span>⌄</span>
                    </summary>

                    <div className="scheduled-facts-wow-grid">
                      <div>
                        <span>🏏 Bat 1st</span>
                        <strong>
                          {match.battingFirstTeamName ||
                            "Not decided"}
                        </strong>
                      </div>

                      <div>
                        <span>🎯 Overs</span>
                        <strong>
                          {match.oversPerInnings}
                        </strong>
                      </div>

                      <div>
                        <span>⚾ Wickets</span>
                        <strong>
                          {match.maxWicketsPerInnings ??
                            "∞"}
                        </strong>
                      </div>

                      <div>
                        <span>⚡ Powerplay</span>
                        <strong>
                          {match.powerplayOversInnings ??
                            0}
                        </strong>
                      </div>

                      <div>
                        <span>🎳 Max / Bowler</span>
                        <strong>
                          {match.maxOversPerBowler ??
                            "∞"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          🧤 {match.teamAName} WK
                        </span>
                        <strong>
                          {match.teamAWicketKeeperName ||
                            "Not selected"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          🧤 {match.teamBName} WK
                        </span>
                        <strong>
                          {match.teamBWicketKeeperName ||
                            "Not selected"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          👑 {match.teamAName} Captain
                        </span>
                        <strong>
                          {match.teamACaptainName ||
                            "Not selected"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          👑 {match.teamBName} Captain
                        </span>
                        <strong>
                          {match.teamBCaptainName ||
                            "Not selected"}
                        </strong>
                      </div>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </div>

        {/* =====================================================
            MOBILE VIEW
            New compact scheduled card
        ====================================================== */}
        <div className="matches-mobile-only">
<div className="mobile-wow-match-list">
  {filteredScheduledMatches.map((match) => {
    const shareCode =
      match?.shareCode ||
      match?.sharecode ||
      match?.publicShareCode;

    return (
      <article
        key={`mobile-scheduled-${match.id}`}
        className="mobile-wow-card mobile-wow-scheduled"
      >
        {/* Header */}
        <div className="mobile-wow-top">
          <span className="mobile-wow-status scheduled">
            📅 Scheduled
          </span>

          <button
            type="button"
            className="mobile-wow-icon-btn"
            title="Share spectator link"
            aria-label={`Share ${match.teamAName} versus ${match.teamBName}`}
            onClick={() => handleShareScheduledMatch(match)}
            disabled={!shareCode}
          >
            📤
          </button>
        </div>

        {/* Teams */}
        <div className="mobile-wow-teams">
          <strong>{match.teamAName}</strong>
          <span>VS</span>
          <strong>{match.teamBName}</strong>
        </div>

        {/* Schedule presented as one strong readable line */}
        <div className="mobile-wow-schedule-line">
          <span>Match time</span>

          <strong>
            {match.scheduledAt
              ? formatDate(match.scheduledAt)
              : "Schedule not decided"}
          </strong>
        </div>

        {/* Actions */}
        <div className="mobile-wow-actions scheduled-actions">
          {permissions?.canScoreMatch && (
            <button
              type="button"
              className="mobile-wow-primary"
              onClick={() => handleStartMatch(match)}
            >
              ▶ Start Match
            </button>
          )}

          {normalizeStatus(match.status) === "SCHEDULED" && (
            <button
              type="button"
              className="mobile-wow-secondary"
              onClick={() => openEditMatchModal(match)}
            >
              ✏️ Edit
            </button>
          )}

          {permissions?.canDeleteMatch && (
            <button
              type="button"
              className="mobile-wow-delete"
              title="Delete match"
              aria-label={`Delete ${match.teamAName} versus ${match.teamBName}`}
              onClick={() => handleDeleteMatch(match.id)}
            >
              🗑️
            </button>
          )}
        </div>

        {/* One expandable area */}
        <details className="mobile-wow-details">
          <summary>
            <div>
              <span>⚙️</span>

              <strong>Match Setup & Team Roles</strong>
            </div>

            <i>⌄</i>
          </summary>

          <div className="mobile-wow-details-body">
            <div className="mobile-wow-rule-list">
              <div>
                <span>Batting first</span>
                <strong>
                  {match.battingFirstTeamName || "Not decided"}
                </strong>
              </div>

              <div>
                <span>Overs</span>
                <strong>{match.oversPerInnings}</strong>
              </div>

              <div>
                <span>Wickets</span>
                <strong>
                  {match.maxWicketsPerInnings ?? "Unlimited"}
                </strong>
              </div>

              <div>
                <span>Powerplay</span>
                <strong>
                  {match.powerplayOversInnings ?? 0}
                </strong>
              </div>

              <div>
                <span>Max overs / bowler</span>
                <strong>
                  {match.maxOversPerBowler ?? "Unlimited"}
                </strong>
              </div>
            </div>

            <div className="mobile-wow-role-section">
              <h4>Team Roles</h4>

              <div>
                <span>🧤 {match.teamAName} wicketkeeper</span>
                <strong>
                  {match.teamAWicketKeeperName ||
                    "Not selected"}
                </strong>
              </div>

              <div>
                <span>👑 {match.teamAName} captain</span>
                <strong>
                  {match.teamACaptainName ||
                    "Not selected"}
                </strong>
              </div>

              <div>
                <span>🧤 {match.teamBName} wicketkeeper</span>
                <strong>
                  {match.teamBWicketKeeperName ||
                    "Not selected"}
                </strong>
              </div>

              <div>
                <span>👑 {match.teamBName} captain</span>
                <strong>
                  {match.teamBCaptainName ||
                    "Not selected"}
                </strong>
              </div>
            </div>
          </div>
        </details>
      </article>
    );
  })}
</div>
        </div>
      </>
    )}
  </Card>
)}

{activeLeagueId && matchesSubTab === "COMPLETED" && (
<Card title="✅ Match History">
  {completedMatches.length === 0 ? (
    <div className="empty-state">No completed matches found.</div>
  ) : (
    <div className="completed-match-list pro-completed-list">
      {filteredCompletedMatches.map((match, index) => {
        const battingFirstTeamName =
  match.battingFirstTeamName ||
  match.teamAName;
const matchNumber = filteredCompletedMatches.length - index;
const bowlingSecondTeamName =
  battingFirstTeamName === match.teamAName
    ? match.teamBName
    : match.teamAName;
        const normalizedStatus = String(match.status || "")
          .trim()
          .replace(/[\s-]+/g, "_")
          .toUpperCase();
        
const teamAScore = match.firstInningsTeamName === match.teamAName
  ? match.firstInningsScore
  : match.secondInningsScore;

const teamBScore = match.firstInningsTeamName === match.teamBName
  ? match.firstInningsScore
  : match.secondInningsScore;
const firstTeamName =
  match.battingFirstTeamName || match.firstInningsTeamName || match.teamAName;

const secondTeamName =
  firstTeamName === match.teamAName ? match.teamBName : match.teamAName;

const firstTeamScore = match.firstInningsScore;
const secondTeamScore = match.secondInningsScore;

const cleanScore = (score) =>
  String(score || "")
    .replace(`${match.teamAName}:`, "")
    .replace(`${match.teamBName}:`, "")
    .trim();

    const playedDate =
  match.endedAt || match.startedAt || match.createdAt;

const playedDateLabel = playedDate
  ? new Date(playedDate).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).replace(" at ", ", ")
  : "Date unavailable";

        const canShowAi =
          normalizedStatus === "COMPLETED" ||
          normalizedStatus === "COMPLETED_CORRECTED" ||
          normalizedStatus === "COMPLETED_LOCKED";

        const renderActions = () => (
          <div className="completed-actions-bar">
            <button
              type="button"
              className="completed-action-btn"
              onClick={() => {
                setSelectedMatchId(String(match.id));
                handleMatchSelect(match.id);
              }}
            >
              <span>📊</span>
              <b>Scorecard</b>
            </button>

            {canShowAi && (
              <button
                type="button"
                className="completed-action-btn"
                disabled={aiAnalysisLoading}
                onClick={() => loadAiAnalysis(match.id)}
              >
                <span>🤖</span>
                <b>{aiAnalysisLoading ? "Working..." : "AI Review"}</b>
              </button>
            )}

            {permissions?.canScoreMatch && (
              <button
                type="button"
                className="completed-action-btn"
                onClick={() => openCorrectionCenter(match.id)}
              >
                <span>✏️</span>
                <b>Corrections</b>
              </button>
            )}

            {permissions?.canDeleteMatch && (
              <button
                type="button"
                className="completed-action-btn completed-danger-btn"
                onClick={() => handleDeleteMatch(match.id)}
              >
                <span>🗑️</span>
                <b>Delete</b>
              </button>
            )}
          </div>
        );

        const renderSetupDetails = () => (
          <details className="match-facts-wow completed-setup-row">
            <summary className="match-facts-wow-summary">
              <div className="match-facts-wow-left">
                <span className="match-facts-wow-icon">📌</span>
                <div>
                  <strong>Match Setup & Timeline</strong>
                  <small>Overs, wickets, powerplay, and match times</small>
                </div>
              </div>

              <span className="match-facts-wow-caret">⌄</span>
            </summary>

            <div className="match-facts-wow-content">
              <div className="match-facts-grid">
                <div>
                  <span>🏏 Bat 1st</span>
                  <strong>{match.battingFirstTeamName || "Not decided"}</strong>
                </div>

                <div>
                  <span>🎯 Overs</span>
                  <strong>{match.oversPerInnings}</strong>
                </div>

                <div>
                  <span>⚾ Wickets</span>
                  <strong>{match.maxWicketsPerInnings ?? "∞"}</strong>
                </div>

                <div>
                  <span>⚡ Powerplay</span>
                  <strong>{match.powerplayOversInnings ?? 0}</strong>
                </div>

                <div>
                  <span>🎳 Max / Bowler</span>
                  <strong>{match.maxOversPerBowler ?? "∞"}</strong>
                </div>
              </div>

              {(match?.startedAt || match?.endedAt || match?.lockedAt) && (
                <div className="match-timeline-wow">
                  {match?.startedAt && (
                    <div>
                      <span>Started</span>
                      <strong>{formatMatchDateTime(match.startedAt)}</strong>
                    </div>
                  )}

                  {match?.endedAt && (
                    <div>
                      <span>Ended</span>
                      <strong>{formatMatchDateTime(match.endedAt)}</strong>
                    </div>
                  )}

                  {match?.lockedAt && (
                    <div>
                      <span>Locked</span>
                      <strong>{formatMatchDateTime(match.lockedAt)}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>
        );

        return (
          <article key={match.id} className="completed-scorecard-card">
            <div className="completed-desktop-card">
<div className="completed-scorecard-top">
  <div className="completed-top-left">
    <span className="completed-match-chip">
      Match #{matchNumber}
    </span>

    <span className="completed-status-chip">
      {match.status}
    </span>
  </div>

  <div className="completed-top-right">
    {match.shareCode && (
      <button
        type="button"
        className="completed-view-match-btn"
        onClick={() =>
          window.open(
            `https://cric4all.app/live/${match.shareCode}`,
            "_blank"
          )
        }
      >
        🏏 Open Match
      </button>
    )}

    <span className="completed-date-chip">
      📅 {playedDateLabel}
    </span>
  </div>
</div>

<div className="completed-scorecard-hero compact-teams-line">
  <strong>{battingFirstTeamName}</strong>
  <span>vs</span>
  <strong>{bowlingSecondTeamName}</strong>
</div>

              <div className="completed-winner-banner">
                🏆 {match.resultText || "Result unavailable"}
              </div>

              <div className="completed-innings-row">
                <div className="completed-innings-box">
                  <span>1st Innings</span>
                  <strong>{match.firstInningsScore}</strong>
                </div>

                <div className="completed-innings-box">
                  <span>2nd Innings</span>
                  <strong>{match.secondInningsScore}</strong>
                </div>
              </div>

              {renderActions()}
              {renderSetupDetails()}
            </div>

<details className="completed-mobile-card">
  <summary className="completed-mobile-summary">
<div className="completed-mobile-meta-wow">
  <div className="completed-mobile-meta-top">
    <span className="mobile-match-chip">Match #{matchNumber}</span>
    <span className="mobile-status-chip">{match.status}</span>  
  </div>

  <div className="completed-top-right">
    {match.shareCode && (
      <button
        type="button"
        className="completed-view-match-btn"
        onClick={() =>
          window.open(
            `https://cric4all.app/live/${match.shareCode}`,
            "_blank"
          )
        }
      >
        🏏 View
      </button>
    )}

    <span className="mobile-date-chip">
      📅 {playedDateLabel}
    </span>
  </div>
</div>

    <div className="completed-mobile-teams-grid">
      <div className="mobile-team-score">
        <strong>{firstTeamName}</strong>
        <small>{cleanScore(firstTeamScore)}</small>
      </div>

      <div className="mobile-team-score right">
        <strong>{secondTeamName}</strong>
        <small>{cleanScore(secondTeamScore)}</small>
      </div>
    </div>

    <div className="completed-mobile-vs">
      <span></span>
      <b>VS</b>
      <span></span>
    </div>

    <div className="completed-mobile-result-clean">
      🏆 {match.resultText || "Result unavailable"}
    </div>

    <div className="completed-mobile-expand">
      <span>⚙️ Actions & Details</span>
      <b>⌄</b>
    </div>
  </summary>

  <div className="completed-mobile-expanded">
    {renderActions()}
    {renderSetupDetails()}
  </div>
</details>
          </article>
        );
      })}
    </div>
  )}
</Card>
)}
</Card>
  </div> 
)}
{activeTab === "management" && (
  <div className="management-page">
    <Card title="🏏 League Management">
      <div className="mgmt-clean-shell">

{/* LEAGUE */}
<section className="mgmt-clean-card league-mobile-wow-card">
  <div className="mgmt-clean-head">
    <div>
      <h3>🏆 League</h3>
      <p>Select your active league and share invite/public links.</p>
    </div>
  </div>

  <label className="compact-league-picker mobile-landing-league-picker">
    <span className="league-label">🏆 Active League</span>

    <div className="league-select-wrapper compact mobile-league-select-wow">
      <div className="league-current-info">
        <div className="league-current-name">
          {activeLeague?.name || "Select League"}
        </div>

        <span className={`league-visibility ${activeLeague?.visibility?.toLowerCase()}`}>
          {activeLeague?.visibility === "PUBLIC"
            ? "🌍 Public"
            : activeLeague?.visibility === "UNLISTED"
            ? "🔗 Unlisted"
            : "🔒 Private"}
        </span>

        <small className="mobile-league-guidance">
          Choose a league first. Then go to Matches to create or score a match.
        </small>
      </div>

      <div className="combo-visual-cue" aria-hidden="true">
        <span className="combo-ripple" />
      </div>

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

      <div className="league-dropdown-icon">⌄</div>
    </div>
  </label>

<div className="mobile-league-next-step">
  <div>
    <strong>
      {leagueReadyForMatches
        ? "🏏 Ready to play!"
        : "⚙️ Complete Setup"}
    </strong>

    <span>
      {leagueReadyForMatches
        ? "Your league is ready. Create or manage matches."
        : !minimumTeamsReady
        ? "Create at least 2 teams."
        : "Each team needs at least 2 players."}
    </span>
  </div>

  <button
    type="button"
    disabled={!leagueReadyForMatches}
    onClick={() => {
      setActiveTab("matches");
      setMatchesSubTab("CREATE MATCH");
    }}
  >
    {leagueReadyForMatches
      ? "Go to Matches →"
      : "Complete Setup"}
  </button>
</div>

  <div className="mgmt-clean-actions league-actions-desktop">
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
            const url = `${window.location.origin}/leagues/${activeLeague.slug}`;
            navigator.clipboard.writeText(url);
            setMessage("Public league link copied.");
            showToast("success", "✅ Public league link copied.");
          }}
        >
          🌐 Copy Public View Link
        </button>
      )}

    <button
      type="button"
      className="mgmt-clean-btn"
      onClick={() => setShowFollowedLeaguesDrawer(true)}
    >
      ⭐ Followed Leagues
    </button>

    <button
      type="button"
      className="mgmt-clean-btn public-discover-btn"
      onClick={() => setShowPublicLeagueDrawer(true)}
    >
      🌐 Discover Public Leagues
    </button>
  </div>

  <details className="mobile-league-more-actions">
    <summary>More league actions</summary>

    <div className="mobile-league-actions-grid">
      <button type="button" onClick={() => setShowLeagueModal(true)}>
        ➕ Create
      </button>

      {activeLeague && (
        <button type="button" onClick={() => generateInviteLink(activeLeague.id)}>
          🔗 Invite
        </button>
      )}

      {activeLeague &&
        activeLeague.visibility !== "PRIVATE" &&
        activeLeague.slug && (
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/leagues/${activeLeague.slug}`;
              navigator.clipboard.writeText(url);
              setMessage("Public league link copied.");
              showToast("success", "✅ Public league link copied.");
            }}
          >
            🌐 Public Link
          </button>
        )}

      <button type="button" onClick={() => setShowFollowedLeaguesDrawer(true)}>
        ⭐ Followed
      </button>

      <button type="button" onClick={() => setShowPublicLeagueDrawer(true)}>
        🌐 Discover
      </button>

      {selectedLeague && permissions?.canDeleteLeague && (
        <button
          type="button"
          className="danger"
          onClick={() =>
            handleDeleteLeague(selectedLeague.id, selectedLeague.name)
          }
        >
          🗑️ Delete
        </button>
      )}
    </div>
  </details>
</section>

        {/* SERIES */}
        <section className="mgmt-clean-card">
          <div className="mgmt-clean-head">
            <div>
              <h3>📅 Series / Season</h3>
              <p>Optional. Group matches into tournaments, cups, seasons, or years.</p>
            </div>
          </div>

<label className="mgmt-field mgmt-select-field">
            <span>👇 Choose a series or leave optional</span>
            <div className="select-action-hint">
  <span>Tap to choose</span>
  <b>⌄</b>
</div>
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

<div className="mgmt-clean-actions series-actions-row">
  <button
    type="button"
    className="mgmt-clean-btn"
    disabled={!activeLeagueId}
    onClick={() => {
      setEditingSeries(null);
      setSeriesForm({
        name: "",
        year: new Date().getFullYear(),
        status: "ACTIVE",
      });
      setShowSeriesModal(true);
    }}
  >
    ➕ Create Series
  </button>

  {selectedSeries && (
    <>
      <button
        type="button"
        className="mgmt-clean-btn secondary"
          onClick={() => {
            setEditingSeries(selectedSeries);
            setSeriesForm({
              name: selectedSeries.name || "",
              year: selectedSeries.year || new Date().getFullYear(),
              status: selectedSeries.status || "ACTIVE",
            });
            setShowSeriesModal(true);
          }}
      >
        ✏️ Edit Series
      </button>

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
    </>
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

<label className="mgmt-field mgmt-select-field">
            <span>👇 Choose a team to manage players</span>
            <div className="select-action-hint">
  <span>Tap to choose</span>
  <b>⌄</b>
</div>
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
{selectedTeamId && permissions?.canEditTeam && selectedTeam && (
  <button
    type="button"
    className="mgmt-clean-btn"
    onClick={() => {
      setEditingTeam(selectedTeam);
      setTeamEditName(selectedTeam.name || "");
      setShowEditTeamModal(true);
    }}
  >
    ✏️ Edit Team
  </button>
)}
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
{activeLeagueId && canUseAvailabilityBuilder && (
<button
  type="button"
  className="league-team-builder-btn"
onClick={() => {
  window.location.href = `/ai-team-splitter?leagueId=${activeLeagueId}`;
}}
>
  <span>⚖️</span>

  <div>
    <strong>Availability & Team Builder</strong>
    <small>
      Create Poll • Split Teams • Captain Suggestions
    </small>
  </div>

  <div className="team-builder-arrow">
    →
  </div>
</button>
)}
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
{[...(selectedTeam.players || [])]
  .sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      sensitivity: "base",
      numeric: true,
    })
  )
  .map((player, index) => (
    <div key={player.id} className="pretty-player-row">
      <div className="player-avatar">
        {String(player.name || "?").trim().charAt(0).toUpperCase()}
      </div>

      <div className="player-info">
        <strong>{player.name}</strong>
        <span>Player #{index + 1}</span>
      </div>

      <div className="player-row-actions desktop-player-actions">
        {permissions?.canEditPlayer && (
          <button
            type="button"
            className="mini-action-btn"
            title="Edit Player"
            onClick={() => openEditPlayer(player)}
          >
            ✏️
          </button>
        )}

        {permissions?.canEditPlayer && (
          <button
            type="button"
            className="mini-action-btn"
            title="Move Player"
            onClick={() => {
              setTransferPlayer(player);
              setTransferTeamId("");
              setShowTransferPlayerModal(true);
            }}
          >
            🔁
          </button>
        )}

        {permissions?.canDeletePlayer && (
          <button
            type="button"
            className="player-delete-btn"
            title={`Delete ${player.name}`}
            onClick={() => handleDeletePlayer(player.id, player.name)}
          >
            🗑️
          </button>
        )}
      </div>

<details
  className="mobile-player-actions"
  open={openPlayerActionId === player.id}
  onToggle={(e) => {
    setOpenPlayerActionId(e.currentTarget.open ? player.id : null);
  }}
>
  <summary>⚙️</summary>

        <div className="mobile-player-actions-menu">
          {permissions?.canEditPlayer && (
            <button type="button"   onClick={() => {
    setOpenPlayerActionId(null);
    openEditPlayer(player);
  }}>
             <span>✏️</span>
            <span>Edit Player</span>
            </button>
          )}

          {permissions?.canEditPlayer && (
            <button
              type="button"
              onClick={() => {
                setOpenPlayerActionId(null);
                setTransferPlayer(player);
                setTransferTeamId("");
                setShowTransferPlayerModal(true);
              }}
            >
              <span>🔁</span>
              <span>Move Player</span>
            </button>
          )}

          {permissions?.canDeletePlayer && (
            <button
              type="button"
              className="danger"
              onClick={() => {
                setOpenPlayerActionId(null);
                handleDeletePlayer(player.id, player.name);
              }}
            >
              <span>🗑️</span>
              <span>Delete Player</span>
            </button>
          )}
        </div>
      </details>
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
onClick={() => {
  setPendingMatchesSubTab("CREATE MATCH");
  setActiveTab("matches");
}}
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
  <div className="active-league-mini">
      <span>League</span>
      <strong>
        {leagues.find((l) => Number(l.id) === Number(activeLeagueId))?.name ||
          "No league selected"}
      </strong>
    </div> 
  {pointsTable.length === 0 ? (
    <p className="muted">No points table available yet.</p>
  ) : (
    <div className="score-table-scroll">
            <ContextLens />
      <table className="score-table sticky-first-col">
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
    {leagueStatsLoading && (
  <div className="live-feed-banner">
    📊 Refreshing latest stats...
  </div>
)}
    <Card title="📊 League Statistics" defaultCollapsed={false}>
  <div className="active-league-mini">
      <span>League</span>
      <strong>
        {leagues.find((l) => Number(l.id) === Number(activeLeagueId))?.name ||
          "No league selected"}
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
          className={statsSubTab === "CAPTAINCY" ? "active" : ""}
          onClick={() => setStatsSubTab("CAPTAINCY")}
        >
          🧢 Captaincy
        </button>
        <button
          type="button"
          className={statsSubTab === "WICKETKEEPING" ? "active" : ""}
          onClick={() => setStatsSubTab("WICKETKEEPING")}
        >
          🧤 Wicketkeeping
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
      <div className="compact-stats-list">
        {filteredBatting.map((row, idx) => (
          <details
            key={`league-bat-${row.playerId ?? row.playerName}-${idx}`}
            className="compact-stat-card"
          >
            <summary className="compact-stat-summary">
              <span className="compact-rank">#{row.actualRank}</span>

              <span className="compact-player">
                <strong>{row.playerName}</strong>
                <small>{row.teamName}</small>
              </span>

              <span className="compact-highlight">
                <strong>{row.runs}</strong>
                <small>Runs</small>
              </span>

              <span className="compact-toggle">⌄</span>
            </summary>

            <div className="compact-stat-grid">
              <span>M {row.matches}</span>
              <span>Inn {row.battingInnings}</span>
              <span>B {row.balls}</span>
              <span>Avg {row.average}</span>
              <span>SR {row.strikeRate}</span>
              <span>4s {row.fours}</span>
              <span>6s {row.sixes}</span>
              <span>HS {row.highestScore}</span>
            </div>
          </details>
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
      <div className="compact-stats-list">
        {filteredBowling.map((row, idx) => (
          <details
            key={`league-bowl-${row.playerId ?? row.playerName}-${idx}`}
            className="compact-stat-card"
          >
            <summary className="compact-stat-summary">
              <span className="compact-rank">#{row.actualRank}</span>

              <span className="compact-player">
                <strong>{row.playerName}</strong>
                <small>{row.teamName}</small>
              </span>

              <span className="compact-highlight">
                <strong>{row.wickets}</strong>
                <small>Wkts</small>
              </span>

              <span className="compact-toggle">⌄</span>
            </summary>

            <div className="compact-stat-grid">
              <span>M {row.matches}</span>
              <span>O {row.bowlingOvers}</span>
              <span>R {row.bowlingRuns}</span>
              <span>Eco {row.economy}</span>
              <span>Avg {row.bowlingAverage}</span>
              <span>SR {row.bowlingStrikeRate}</span>
              <span>Dots {row.dots}</span>
              <span>Best {row.bestBowling}</span>
            </div>
          </details>
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
      <div className="compact-stats-list">
        {filteredFielding.map((row, idx) => (
          <details
            key={`league-field-${row.playerId ?? row.playerName}-${idx}`}
            className="compact-stat-card"
          >
            <summary className="compact-stat-summary">
              <span className="compact-rank">#{row.actualRank}</span>

              <span className="compact-player">
                <strong>{row.playerName}</strong>
                <small>{row.teamName}</small>
              </span>

              <span className="compact-highlight">
                <strong>{row.fieldingTotal}</strong>
                <small>Total</small>
              </span>

              <span className="compact-toggle">⌄</span>
            </summary>

            <div className="compact-stat-grid">
              <span>Catches {row.catches}</span>
              <span>Run Outs {row.runOuts}</span>
              <span>Stumpings {row.stumpings}</span>
              <span>Assists {row.assists}</span>
            </div>
          </details>
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

        <div className="score-table-scroll">
          <table className="score-table sticky-first-col ranking-table">
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
{statsSubTab === "CAPTAINCY" && (
  <Card title="🧢 Captaincy Records">
    {!filteredCaptaincy.length ? (
      <div className="mgmt-clean-empty">No captaincy stats yet.</div>
    ) : (
      <div className="compact-stats-list">
        {[...filteredCaptaincy]
          .sort((a, b) => {
            const aWinPct = a.winPct
              ? Number(a.winPct)
              : a.played
              ? (a.won / a.played) * 100
              : 0;

            const bWinPct = b.winPct
              ? Number(b.winPct)
              : b.played
              ? (b.won / b.played) * 100
              : 0;

            return (
              bWinPct - aWinPct ||
              (b.won || 0) - (a.won || 0) ||
              (b.played || 0) - (a.played || 0)
            );
          })
          .map((row, idx) => {
            const winPct =
              row.winPct ||
              (row.played
                ? ((row.won / row.played) * 100).toFixed(1)
                : "0.0");

            return (
              <details
                key={`league-captain-${row.playerId ?? row.playerName}-${idx}`}
                className="compact-stat-card"
              >
                <summary className="compact-stat-summary">
                  <span className="compact-rank">#{idx + 1}</span>

                  <span className="compact-player">
                    <strong>{row.playerName}</strong>
                    <small>{row.teamName}</small>
                  </span>

                  <span className="compact-highlight">
                    <strong>{winPct}%</strong>
                    <small>Win</small>
                  </span>

                  <span className="compact-toggle">⌄</span>
                </summary>

                <div className="compact-stat-grid">
                  <span>M {row.played}</span>
                  <span>Won {row.won}</span>
                  <span>Lost {row.lost}</span>
                  <span>Win % {winPct}</span>
                </div>
              </details>
            );
          })}
      </div>
    )}
  </Card>
)}
{statsSubTab === "WICKETKEEPING" && (
  <Card title="🧤 Wicketkeeping Records">
    {!filteredWicketkeeping.length ? (
      <div className="mgmt-clean-empty">No wicketkeeping stats yet.</div>
    ) : (
      <div className="compact-stats-list">
        {[...filteredWicketkeeping]
          .sort(
            (a, b) =>
              (b.dismissals || 0) - (a.dismissals || 0) ||
              (b.catches || 0) - (a.catches || 0) ||
              (b.stumpings || 0) - (a.stumpings || 0) ||
              (b.runOuts || 0) - (a.runOuts || 0)
          )
          .map((row, idx) => (
            <details
              key={`league-keeper-${row.playerId ?? row.playerName}-${idx}`}
              className="compact-stat-card"
            >
              <summary className="compact-stat-summary">
                <span className="compact-rank">#{idx + 1}</span>

                <span className="compact-player">
                  <strong>{row.playerName}</strong>
                  <small>{row.teamName}</small>
                </span>

                <span className="compact-highlight">
                  <strong>{row.dismissals}</strong>
                  <small>Total</small>
                </span>

                <span className="compact-toggle">⌄</span>
              </summary>

              <div className="compact-stat-grid">
                <span>Catches {row.catches}</span>
                <span>Stumpings {row.stumpings}</span>
                <span>Run Outs {row.runOuts}</span>
                <span>Total {row.dismissals}</span>
              </div>
            </details>
          ))}
      </div>
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
            matches, score live games, use Scorer Mode, share spectator links,
            track points, view rankings, manage permissions, review audit logs,
            monitor user activity, and generate AI-powered match insights.
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
            Every team, player, series, match, points table, permission, stat,
            and audit record belongs to a league.
          </p>
        </div>

        <div className="help-card">
          <h3>✅ Step 2</h3>
          <h4>Complete Minimum Setup</h4>
          <p>
            Create at least <strong>2 teams</strong> and add at least{" "}
            <strong>2 players per team</strong> before creating a match. The
            mobile landing page guides users when setup is incomplete.
          </p>
        </div>

        <div className="help-card">
          <h3>🌐 Step 3</h3>
          <h4>Choose League Visibility</h4>
          <p>
            Keep leagues <strong>Private</strong>, make them{" "}
            <strong>Unlisted</strong> for direct-link viewing, or make them{" "}
            <strong>Public</strong> so they can appear on Explore.
          </p>
        </div>

        <div className="help-card">
          <h3>📅 Step 4</h3>
          <h4>Create Series / Season</h4>
          <p>
            Series are optional. Use them for tournaments, cups, seasons, or
            years. Friendly matches can be created without a series.
          </p>
        </div>

        <div className="help-card">
          <h3>👥 Step 5</h3>
          <h4>Add Teams & Players</h4>
          <p>
            Add teams first, then use bulk player import to paste multiple
            players at once, one player per line.
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
            Go to <strong>Matches → Create Match</strong>. Add overs, powerplay,
            max wickets, max overs per bowler, captains, wicketkeepers, and
            optional series.
          </p>
        </div>

        <div className="help-card">
          <h3>▶ Step 7</h3>
          <h4>Start Match</h4>
          <p>
            Open the <strong>Scheduled</strong> tab, click{" "}
            <strong>Start Match</strong>, select batting first, complete delivery
            setup, and begin live scoring.
          </p>
        </div>

        <div className="help-card">
          <h3>📤 Step 8</h3>
          <h4>Share With Spectators</h4>
          <p>
            Use <strong>Share - Spectator View</strong> to share a professional
            live score message with score, match status, live link, and Cric4All
            branding.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">🧭 Main Tabs</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>🏆 Leagues</h3>
          <p>
            Manage leagues, series, teams, players, invite links, public view
            links, followed leagues, public discovery, visibility, roles, and
            permissions.
          </p>
        </div>

        <div className="help-card">
          <h3>📋 Matches</h3>
          <p>
            Matches are separated into <strong>Create</strong>,{" "}
            <strong>Active</strong>, <strong>Scheduled</strong>, and{" "}
            <strong>Completed</strong>. Completed matches can generate AI
            reviews.
          </p>
        </div>

        <div className="help-card">
          <h3>🎯 Scoring</h3>
          <p>
            Score live balls, extras, wickets, run outs, retired hurt, bowler
            changes, keeper changes, striker swaps, innings ending, and match
            control actions.
          </p>
        </div>

        <div className="help-card">
          <h3>🥇 Points</h3>
          <p>
            Track standings with matches played, wins, losses, ties, points, and
            team performance.
          </p>
        </div>

        <div className="help-card">
          <h3>📊 Stats</h3>
          <p>
            View batting, bowling, fielding, captaincy, wicketkeeping, rankings,
            top run scorers, wicket takers, six hitters, strike rate, economy,
            and all-rounders.
          </p>
        </div>

        <div className="help-card">
          <h3>🔐 Access</h3>
          <p>
            Manage league members, roles, and permissions for owners, admins,
            captains, scorers, analysts, and viewers.
          </p>
        </div>

        <div className="help-card">
          <h3>🛡️ Admin</h3>
          <p>
            Owner-only Admin Center shows online users, recent logins, 24-hour
            login activity, and audit logs for sensitive league and match
            actions.
          </p>
        </div>

        <div className="help-card">
          <h3>👤 Account</h3>
          <p>
            Use the account icon near Sign Out to view your Cric4All account,
            quick actions, dashboard shortcut, Explore shortcut, and sign-out
            option.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">⚡ Scorer Mode</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>🎯 Quick Buttons</h3>
          <p>
            Record 0, 1, 2, 3, 4, 6, wides, no-balls, byes, leg-byes, wickets,
            retired hurt, swaps, and undo from a focused scoring workspace.
          </p>
        </div>

        <div className="help-card">
          <h3>🏏 Main Scoring Tabs</h3>
          <p>
            Scoring, Scoreboard, and Commentary are presented as prominent tabs
            so scorers can quickly switch between live scoring, full scorecard,
            and ball-by-ball history.
          </p>
        </div>

        <div className="help-card">
          <h3>📊 Scoreboard Panel</h3>
          <p>
            View current score, overs, run rate, chase requirement, striker,
            non-striker, bowler, top batters, top bowlers, and partnership.
          </p>
        </div>

        <div className="help-card">
          <h3>📝 Commentary Panel</h3>
          <p>
            View recent ball-by-ball commentary with score summary, overs, CRR,
            chase requirement, boundaries, wickets, and extras highlighted.
          </p>
        </div>

        <div className="help-card">
          <h3>📋 Match Setup Panel</h3>
          <p>
            Match Setup is collapsed by default. Expand it to check overs,
            powerplay, wickets, max overs per bowler, batting first, match
            status, captains, and wicketkeepers.
          </p>
        </div>

        <div className="help-card">
          <h3>✅ Over Complete Notice</h3>
          <p>
            After an over finishes, Cric4All shows a compact over-complete status
            without interrupting the bowler change workflow.
          </p>
        </div>

        <div className="help-card">
          <h3>🎤 Voice Scoring</h3>
          <p>
            Voice scoring supports commands like dot, one, two, four, six, wide,
            no ball, bye, leg bye, wicket, and undo inside Scorer Mode when the
            browser supports microphone input.
          </p>
        </div>

        <div className="help-card">
          <h3>📱 Mobile Experience</h3>
          <p>
            Mobile scoring uses compact layouts, larger primary scoring controls,
            swipe hints for dashboard tabs, and optimized views for quick
            match-day use.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">🏏 Scoring Features</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>➕ Extras</h3>
          <p>
            Supports wides, no-balls, byes, and leg-byes. No-ball runs off the
            bat are credited to the striker correctly.
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
          <h3>🛑 End Innings After Wicket</h3>
          <p>
            For short lineups or leagues with large rosters, scorers can mark a
            batter out and end the innings without selecting a random non-playing
            replacement batter.
          </p>
        </div>

        <div className="help-card">
          <h3>🧤 Fielding Details</h3>
          <p>
            Capture caught by, stumped by, run out by, assistant fielder, and
            wicketkeeper changes for better scorecards and stats.
          </p>
        </div>

        <div className="help-card">
          <h3>🎯 Bowler Change</h3>
          <p>
            At the end of an over, the app prompts for a new bowler and helps
            prevent the same bowler from bowling consecutive overs.
          </p>
        </div>

        <div className="help-card">
          <h3>🤝 Partnerships</h3>
          <p>
            Scoreboards show partnership runs, balls, current partnerships, and
            wicket-ending partnerships for each innings.
          </p>
        </div>

        <div className="help-card">
          <h3>💥 Fall of Wickets</h3>
          <p>
            Fall of wickets shows score, wicket number, player out, and over.
            Mobile tables support horizontal swipe with the first column locked.
          </p>
        </div>

        <div className="help-card">
          <h3>↩️ Undo & Corrections</h3>
          <p>
            Authorized users can undo the latest ball and use correction flows
            for special cases such as retired hurt adjustments and scoring
            fixes.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">📊 Scorecards & Mobile Tables</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>🏏 Batting Scorecard</h3>
          <p>
            View batter runs, balls, boundaries, strike rate, and dismissal
            details. On mobile, swipe sideways for more stats.
          </p>
        </div>

        <div className="help-card">
          <h3>🎳 Bowling Scorecard</h3>
          <p>
            View overs, maidens, runs, wickets, wides, no-balls, and economy.
          </p>
        </div>

        <div className="help-card">
          <h3>🤝 Partnerships</h3>
          <p>
            Partnership tables keep names readable and support mobile swiping for
            detailed innings data.
          </p>
        </div>

        <div className="help-card">
          <h3>📌 Sticky First Column</h3>
          <p>
            Batting, bowling, partnerships, and fall-of-wickets tables keep the
            first column locked so users can understand rows while swiping.
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

        <div className="help-card">
          <h3>🏏 Match Finder</h3>
          <p>
            Match filters include useful details such as teams, series, status,
            score summary, result, and date so users can find the right match
            quickly.
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
          <h3>⭐ Followed Leagues</h3>
          <p>
            Users can access followed leagues from the Leagues area to quickly
            return to public leagues they care about.
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

        <div className="help-card">
          <h3>📲 Android App</h3>
          <p>
            Cric4All is available as a mobile-friendly web app and Android app,
            making live scoring easier on phones during match day.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">✨ Match Tools</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>🤖 AI Match Insights</h3>
          <p>
            For completed or locked matches, generate AI analysis covering match
            summary, MVP, turning points, momentum, top performers, partnerships,
            pressure moments, and team takeaways.
          </p>
        </div>

        <div className="help-card">
          <h3>📤 Share Match</h3>
          <p>
            Share live scores using a polished message that includes league,
            teams, score, match status, live scorecard link, and Cric4All
            branding.
          </p>
        </div>

        <div className="help-card">
          <h3>✏️ Edit Scheduled Match</h3>
          <p>
            Update scheduled date/time, series, overs, powerplay, max wickets,
            max overs per bowler, captains, and wicketkeepers.
          </p>
        </div>

        <div className="help-card">
          <h3>🔒 Lock Match</h3>
          <p>
            Locked matches prevent further scoring changes and are treated as
            finalized scorecards.
          </p>
        </div>

        <div className="help-card">
          <h3>⛔ Abandon Match</h3>
          <p>
            Use abandon only when a match should stop without normal completion.
          </p>
        </div>

        <div className="help-card">
          <h3>🏁 End Match / Innings</h3>
          <p>
            End the first innings manually if needed, or end the match when
            scoring is complete.
          </p>
        </div>
      </div>

      <h3 className="help-section-title">🛡️ Admin & Integrity</h3>

      <div className="help-grid">
        <div className="help-card">
          <h3>🟢 Online Users</h3>
          <p>
            Owner-only Admin Center can show users who are currently active using
            last-seen heartbeat tracking.
          </p>
        </div>

        <div className="help-card">
          <h3>🕒 Recent Logins</h3>
          <p>
            Track last login time and recent login history so owners can see who
            has logged in during the last 24 hours or recent period.
          </p>
        </div>

        <div className="help-card">
          <h3>📜 Audit Logs</h3>
          <p>
            Audit logs record important actions such as creating, editing,
            deleting, locking, abandoning, ending matches, and permission
            changes.
          </p>
        </div>

        <div className="help-card">
          <h3>🔐 Data Integrity</h3>
          <p>
            Admin logging helps league owners understand who changed important
            data and when, improving trust and accountability.
          </p>
        </div>
      </div>

      <div className="help-tip-box">
        <h3>💡 Pro Tips</h3>

        <ul>
          <li>Use the Leagues tab first: league → series → teams → players.</li>
          <li>Create at least two teams before creating a match.</li>
          <li>Add at least two players per team before creating a match.</li>
          <li>Series are optional. Use them only for cups, seasons, tournaments, or years.</li>
          <li>Add players before starting a match for accurate stats.</li>
          <li>Use Scheduled matches for future games.</li>
          <li>Use Scorer Mode during live scoring to avoid scrolling.</li>
          <li>Use the Scoring, Scoreboard, and Commentary tabs during live scoring.</li>
          <li>Expand Match Setup only when you need match configuration details.</li>
          <li>Use Smart Filters to focus on a team, player, series, year, or match status.</li>
          <li>Use public league links when you want spectators to view league pages.</li>
          <li>Use Share - Spectator View for professional live match links.</li>
          <li>Use Explore only for leagues you are comfortable making public.</li>
          <li>Completed matches automatically open the scoreboard instead of scoring.</li>
          <li>Use AI Match Insights only after the match is completed.</li>
          <li>Use Admin Center to review user activity and audit logs.</li>
        </ul>
      </div>

      <div className="help-card full">
        <h3>🔐 Roles & Permissions</h3>

        <p>
          League Owners and Admins can manage users, teams, matches, scoring,
          series, public visibility, audit activity, and access levels. Scorers
          can score matches, captains can help manage team-related actions,
          analysts can review stats, and viewers can follow league information.
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
            Confirm the active league from the league dropdown and make sure
            your teams belong to that league.
          </div>

          <div>
            <strong>Why can't I create a match?</strong>
            <br />
            Make sure the active league has at least two teams, at least two
            players per team, and that your role has match creation permission.
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
            <strong>What is Scorer Mode?</strong>
            <br />
            Scorer Mode is a focused scoring workspace with quick buttons,
            scoreboard, commentary, setup panels, and reduced scrolling.
          </div>

          <div>
            <strong>Can I end an innings if no more real batters are available?</strong>
            <br />
            Yes. Use the end-innings-after-wicket option in the wicket modal
            instead of selecting a non-playing roster member.
          </div>

          <div>
            <strong>Can I share a live match?</strong>
            <br />
            Yes. Use <strong>Share - Spectator View</strong> from the scoring or
            match setup area.
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

          <div>
            <strong>Can I edit a scheduled match?</strong>
            <br />
            Yes. Scheduled matches can be edited before or around match setup,
            including overs, powerplay, series, captains, and wicketkeepers.
          </div>

          <div>
            <strong>Can I see who changed important data?</strong>
            <br />
            Yes. Owners can use Admin Center audit logs to review important
            actions such as match locks, deletes, edits, abandoned matches, and
            permission changes.
          </div>

          <div>
            <strong>Can I see who logged in recently?</strong>
            <br />
            Yes. Owners can view recent login activity and currently active
            users in Admin Center.
          </div>

          <div>
            <strong>Can I score by voice?</strong>
            <br />
            Voice scoring support is being introduced inside Scorer Mode and
            depends on browser microphone support.
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
          <div className="about-kicker">🏏 Built for cricket communities</div>

          <h2>🏏 Cric4All</h2>

          <p>
            A modern cricket scoring, league management, live spectator sharing,
            AI match review, statistics, admin activity, and audit tracking
            platform built for clubs, leagues, academies, tournaments, and
            community cricket.
          </p>

          <div className="release-badge-row">
            <span className="release-badge">Live Scoring</span>
            <span className="release-badge">Scorer Mode</span>
            <span className="release-badge">AI Insights</span>
            <span className="release-badge">Android App</span>
            <span className="release-badge">Admin Center</span>
          </div>
        </div>
      </div>

      <div className="about-card about-mission">
        <h3>🎯 Our Mission</h3>
        <p>
          Cric4All makes cricket easier to organize, score, follow, review, and
          share. It brings leagues, teams, players, matches, series, scorecards,
          commentary, points tables, rankings, permissions, public league pages,
          live spectator links, audit logs, and user activity into one simple
          platform.
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
        <div className="about-feature">⚡ Scorer Mode Workspace</div>
        <div className="about-feature">📝 Ball-by-Ball Commentary</div>
        <div className="about-feature">📊 Live Scoreboard Panels</div>
        <div className="about-feature">🏟️ Spectator Score Sharing</div>
        <div className="about-feature">🤖 AI Post-Match Review</div>
        <div className="about-feature">📈 Points Table</div>
        <div className="about-feature">🏆 Rankings Hub</div>
        <div className="about-feature">🔎 Smart Filters / Context Lens</div>
        <div className="about-feature">🌐 Public League Pages</div>
        <div className="about-feature">🧭 Explore Public Leagues</div>
        <div className="about-feature">⭐ Followed Leagues</div>
        <div className="about-feature">🔐 Role-Based Access</div>
        <div className="about-feature">🛡️ Admin Center</div>
        <div className="about-feature">📜 Audit Logs</div>
        <div className="about-feature">🟢 Login Activity</div>
        <div className="about-feature">📱 Android App</div>
      </div>

      <div className="about-card">
        <h3>📦 Current Release</h3>

        <div className="release-badge-row">
          <span className="release-badge">MVP 1.0+</span>
          <span className="release-badge">Live Scoring Ready</span>
          <span className="release-badge">Public Pages Ready</span>
          <span className="release-badge">Android Production Ready</span>
        </div>

        <p>Current functionality includes:</p>

        <div className="about-list-grid">
          <span>✅ League creation</span>
          <span>✅ Private, Unlisted, and Public leagues</span>
          <span>✅ Public league view links</span>
          <span>✅ Explore page for public leagues</span>
          <span>✅ Followed leagues</span>
          <span>✅ Series / season creation</span>
          <span>✅ Team creation and editing</span>
          <span>✅ Player creation and editing</span>
          <span>✅ Bulk player imports</span>
          <span>✅ Scheduled matches</span>
          <span>✅ Start match workflow</span>
          <span>✅ Delivery setup workflow</span>
          <span>✅ Optional series while creating matches</span>
          <span>✅ Match editing for scheduled games</span>
          <span>✅ Captains and wicketkeepers</span>
          <span>✅ Custom overs per innings</span>
          <span>✅ Optional max wickets</span>
          <span>✅ Optional max overs per bowler</span>
          <span>✅ Powerplay tracking</span>
          <span>✅ Live scoring</span>
          <span>✅ Wides, no-balls, byes, leg-byes</span>
          <span>✅ Wickets, run outs, stumpings, retired hurt</span>
          <span>✅ End innings after wicket option</span>
          <span>✅ Striker and non-striker management</span>
          <span>✅ Bowler change workflow</span>
          <span>✅ Keeper change workflow</span>
          <span>✅ Undo ball</span>
          <span>✅ End innings / end match</span>
          <span>✅ Lock and abandon match controls</span>
          <span>✅ Scoreboard and match center</span>
          <span>✅ Commentary timeline</span>
          <span>✅ Professional share message</span>
          <span>✅ Sticky first-column score tables</span>
          <span>✅ Swipeable mobile scorecards</span>
          <span>✅ Points table</span>
          <span>✅ Batting, bowling, fielding stats</span>
          <span>✅ Captaincy and wicketkeeping stats</span>
          <span>✅ Rankings and league leaders</span>
          <span>✅ Smart Filters / Context Lens</span>
          <span>✅ AI match insights</span>
          <span>✅ Voice scoring foundation</span>
          <span>✅ Account details page</span>
          <span>✅ Admin activity center</span>
          <span>✅ Audit logs</span>
          <span>✅ Login activity tracking</span>
        </div>
      </div>

      <div className="about-card">
        <h3>⚡ Scorer Mode</h3>

        <p>
          Cric4All includes a focused scorer workspace designed for match day.
          Scorers can stay on one screen, record balls quickly, view live score
          context, open scoreboard, commentary, and setup panels, and continue
          scoring without losing flow.
        </p>

        <div className="about-highlight-row">
          <span>🎯 Quick Score Buttons</span>
          <span>📊 Inline Scoreboard</span>
          <span>📝 Commentary Panel</span>
          <span>📋 Collapsible Match Setup</span>
          <span>✅ Over Complete Notice</span>
          <span>🎤 Voice Score Ready</span>
        </div>
      </div>

      <div className="about-card">
        <h3>🤖 AI Match Review</h3>

        <p>
          Completed matches can be reviewed with AI-powered insights so players,
          captains, and organizers can quickly understand the story of the
          match.
        </p>

        <div className="about-workflow-grid">
          <div>
            <strong>Summary</strong>
            <p>Quickly understand how the match unfolded.</p>
          </div>

          <div>
            <strong>MVP</strong>
            <p>Highlight top performers and impact players.</p>
          </div>

          <div>
            <strong>Turning Points</strong>
            <p>Identify key overs, wickets, partnerships, and momentum shifts.</p>
          </div>

          <div>
            <strong>Momentum</strong>
            <p>Review pressure points and chase/build-up story.</p>
          </div>
        </div>
      </div>

      <div className="about-card">
        <h3>🌐 Public Cricket Experience</h3>

        <p>
          Cric4All supports public-facing cricket pages so leagues can share
          live scores, teams, series, results, standings, rankings, and leaders
          with spectators.
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
            <strong>Spectator View</strong>
            <p>Share live match links with fans, players, and families.</p>
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
              settings, roles, permissions, and review important activity.
            </p>
          </div>

          <div>
            <strong>For Scorers</strong>
            <p>
              Score every ball with runs, extras, wickets, fielders, bowler
              changes, retired hurt, innings tracking, quick actions, and
              commentary.
            </p>
          </div>

          <div>
            <strong>For Players</strong>
            <p>
              Track batting, bowling, fielding records, rankings, leaders,
              captaincy, wicketkeeping, and performance history.
            </p>
          </div>

          <div>
            <strong>For Spectators</strong>
            <p>
              Follow live scores, public leagues, match status, commentary,
              scorecards, results, points, and leaders.
            </p>
          </div>
        </div>
      </div>

      <div className="about-card">
        <h3>🛡️ Admin & Data Integrity</h3>

        <p>
          Cric4All includes owner-focused tools to help maintain trust,
          accountability, and league integrity.
        </p>

        <div className="about-workflow-grid">
          <div>
            <strong>Recent Logins</strong>
            <p>See who logged in recently and who is active now.</p>
          </div>

          <div>
            <strong>Audit Logs</strong>
            <p>Track important create, edit, delete, lock, abandon, and end actions.</p>
          </div>

          <div>
            <strong>Admin Center</strong>
            <p>Review online users, 24-hour logins, and system activity.</p>
          </div>

          <div>
            <strong>Account Details</strong>
            <p>Users can quickly access dashboard, Explore, and account actions.</p>
          </div>
        </div>
      </div>

      <div className="about-card">
        <h3>🧠 Smart Match Features</h3>

        <p>
          Cric4All goes beyond basic scoring with professional match cards,
          live scoring state, chase requirements, partnerships, fall of wickets,
          over summaries, mobile-friendly score tables, public score sharing,
          and post-match intelligence.
        </p>

        <div className="about-highlight-row">
          <span>🤖 AI Analysis</span>
          <span>📊 Stats</span>
          <span>📝 Commentary</span>
          <span>🏆 Rankings</span>
          <span>📈 Points Table</span>
          <span>🔎 Smart Filters</span>
          <span>🌐 Public Pages</span>
          <span>📱 Mobile Scoring</span>
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
          <span>🎤 Enhanced voice scoring</span>
          <span>📲 Android app improvements</span>
          <span>🍎 iOS app packaging</span>
          <span>💳 Premium league tools</span>
          <span>📤 Export scorecards and stats</span>
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
          <span className="badge">Google Play</span>
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
{activeTab === "admin" && (
  <Card title="🛡️ Admin Center">
    <div className="admin-center-grid">
      <div className="admin-activity-card">
        <h3>🟢 Online Now</h3>

        {userActivityLoading ? (
          <p className="muted">Loading activity...</p>
        ) : !userActivity?.onlineUsers?.length ? (
          <p className="muted">No users online right now.</p>
        ) : (
          <div className="admin-user-list">
            {userActivity.onlineUsers.map((user) => (
              <div key={user.id} className="admin-user-row">
                <div>
                  <strong>{user.name || "Unknown User"}</strong>
                  <span>{user.email}</span>
                </div>
                <small>Active now</small>
              </div>
            ))}
          </div>
        )}
      </div>

<div className="admin-activity-card">
  <h3>🕒 Recent Logins</h3>

  {!groupedRecentLogins.length ? (
    <p className="muted">No logins in the last 24 hours.</p>
  ) : (
    <div className="admin-login-group-list">
      {groupedRecentLogins.map((group) => (
        <details key={group.key} className="admin-login-group">
          <summary className="admin-login-group-summary">
            <div>
              <strong>{group.name}</strong>
              <span>{group.email}</span>
            </div>

            <div className="admin-login-count">
              <b>{group.logins.length}</b>
              <small>logins</small>
              <i>⌄</i>
            </div>
          </summary>

          <div className="admin-login-events">
            {group.logins.map((login) => (
              <div key={login.id} className="admin-login-event">
                <span>🔐 Login</span>
                <strong>{formatDate(login.loginAt)}</strong>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )}
</div>

      <div className="admin-activity-card admin-stat-card">
        <h3>📈 Activity Summary</h3>

        <div className="admin-stat-grid">
          <div>
            <span>Online</span>
            <strong>{userActivity?.onlineUsers?.length || 0}</strong>
          </div>

          <div>
            <span>24h Logins</span>
            <strong>{userActivity?.loginCount24h || 0}</strong>
          </div>
        </div>
      </div>
    </div>
<div className="admin-activity-card admin-audit-card">
  <div className="admin-card-title-row">
    <h3>📜 Audit Logs</h3>
  </div>

  {auditLogsLoading ? (
    <p className="muted">Loading audit logs...</p>
  ) : !auditLogs.length ? (
    <p className="muted">No audit logs found.</p>
  ) : (
    <>
<div className="audit-league-tabs">
  <button
    type="button"
    className={selectedAuditLeagueKey === "ALL" ? "active" : ""}
    onClick={() => setSelectedAuditLeagueKey("ALL")}
  >
    🌐 All <span>{auditLogs.length}</span>
  </button>

  {auditLeagueGroups.map((group) => (
    <button
      type="button"
      key={group.key}
      className={
        String(selectedAuditLeagueKey) === String(group.key) ? "active" : ""
      }
      onClick={() => setSelectedAuditLeagueKey(String(group.key))}
    >
      🏆 {group.label} <span>{group.logs.length}</span>
    </button>
  ))}
</div>

      <div className="admin-audit-list">
        {visibleAuditLogs.map((log) => (
          <div key={log.id} className="admin-audit-row">
            <div className="admin-audit-main">
              <strong>{log.action?.replaceAll("_", " ")}</strong>
              <span>{log.description || "No description available."}</span>

              <small>
                🏆 {log.leagueName || "System / No League"} • 👤{" "}
                {log.actorName || log.actorEmail || "Unknown user"}
                {log.actorEmail ? ` • ${log.actorEmail}` : ""}
              </small>
            </div>

            <div className="admin-audit-meta">
              <span>{log.entityType || "SYSTEM"}</span>
              <small>{formatDate(log.createdAt)}</small>
            </div>
          </div>
        ))}
      </div>
    </>
  )}
</div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            loadUserActivity();
            loadAuditLogs();
          }}
        >
          🔄 Refresh Activity
        </button>
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
<div className="live-popup-snapshot">
  <div className="live-popup-topline">
    <span className="live-dot">● LIVE</span>
    <span className="live-popup-over">Over {bowlerChangeScore.overs}</span>
  </div>

  <div className="live-popup-main">
    <div>
      <span>Current Score</span>
      <strong>{bowlerChangeScore.score}</strong>
    </div>

    <div>
      <span>CRR</span>
      <strong>{bowlerChangeScore.crr}</strong>
    </div>
  </div>

  <div className="live-popup-recent">
    <div className="live-popup-recent-head">
      <span>Previous Over</span>
      <b>{previousOverInfo.overNo}</b>
    </div>

    <div className="live-popup-balls">
      {previousOverInfo.balls.length ? (
        previousOverInfo.balls.map((ball) => {
          const label = ball.label || "";
          const result = (
            label.split(" ").slice(1).join(" ") || label
          ).replace(/[()]/g, "");

          const ballClass =
            result === "W"
              ? "wicket"
              : result === "4"
              ? "four"
              : result === "6"
              ? "six"
              : result.toUpperCase().includes("WD")
              ? "wide"
              : result.toUpperCase().includes("NB")
              ? "noball"
              : "";

          return (
            <b key={ball.id} className={ballClass}>
              {result}
            </b>
          );
        })
      ) : (
        <small>No balls yet</small>
      )}
    </div>
  </div>
</div>
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

                setSelectedPlayerTeamId("");
              }}
              required
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
              onChange={(e) => {
                const teamId = Number(e.target.value);

                setSelectedPlayerTeamId(teamId);

                setPlayerForm((prev) => ({
                  ...prev,
                  teamId,
                }));
              }}
              required
              disabled={!playerLeagueId}
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

          <button
            type="submit"
            className="add-player-pro-save"
            disabled={!playerLeagueId || !selectedPlayerTeamId}
          >
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
<div className="live-popup-snapshot">
  <div className="live-popup-topline">
    <span className="live-dot">● LIVE</span>
    <span className="live-popup-over">Over {bowlerChangeScore.overs}</span>
  </div>

  <div className="live-popup-main">
    <div>
      <span>Current Score</span>
      <strong>{bowlerChangeScore.score}</strong>
    </div>

    <div>
      <span>CRR</span>
      <strong>{bowlerChangeScore.crr}</strong>
    </div>
  </div>

  <div className="live-popup-recent">
    <div className="live-popup-recent-head">
      <span>Previous Over</span>
      <b>{previousOverInfo.overNo}</b>
    </div>

    <div className="live-popup-balls">
      {previousOverInfo.balls.length ? (
        previousOverInfo.balls.map((ball) => {
          const label = ball.label || "";
          const result = (
            label.split(" ").slice(1).join(" ") || label
          ).replace(/[()]/g, "");

          const ballClass =
            result === "W"
              ? "wicket"
              : result === "4"
              ? "four"
              : result === "6"
              ? "six"
              : result.toUpperCase().includes("WD")
              ? "wide"
              : result.toUpperCase().includes("NB")
              ? "noball"
              : "";

          return (
            <b key={ball.id} className={ballClass}>
              {result}
            </b>
          );
        })
      ) : (
        <small>No balls yet</small>
      )}
    </div>
  </div>
</div>
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
            className = "extra-choice-btn"
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
{showMatchCreatedModal && createdMatchInfo && (
  <div className="modal-backdrop">
    <div className="match-created-modal match-created-modal-pro">
      <button
        type="button"
        className="edit-modal-close"
        onClick={() => {
          setShowMatchCreatedModal(false);
          setCreatedMatchInfo(null);
        }}
      >
        ✕
      </button>

      <div className="match-created-icon">✅</div>

      <h3>Match Created Successfully!</h3>

      <p>
        {createdMatchInfo.teamAName || "Team A"} vs{" "}
        {createdMatchInfo.teamBName || "Team B"} has been added to Scheduled matches.
      </p>

      <div className="post-create-actions">
<button
  type="button"
  className="btn btn-primary"
onClick={async () => {
  setShowMatchCreatedModal(false);
  await handleStartMatch(createdMatchInfo);
}}
>
  🏏 Start Scoring
</button>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setShowMatchCreatedModal(false);
            setCreatedMatchInfo(null);
            setMatchesSubTab("SCHEDULED");
            setActiveTab("matches");
          }}
        >
          📅 View Scheduled
        </button>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setShowMatchCreatedModal(false);
            setCreatedMatchInfo(null);
            setMessage("");
            setError("");
            setMatchesSubTab("CREATE MATCH");
            setActiveTab("matches");
          }}
        >
          ➕ Add Another Match
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
    .filter((m) => {
      const searchText = [
        m.teamAName,
        m.teamBName,
        m.id,
        m.seriesName,
        m.status,
        m.battingFirstTeamName,
        m.scoreSummary,
        m.liveScore,
        m.resultText,
        m.firstInningsScore,
        m.secondInningsScore,
        m.scheduledAt,
        m.startedAt,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(filterSearch.toLowerCase());
    })
    .map((match) => {
      const matchDate =
        match.scheduledAt ||
        match.startedAt ||
        match.createdAt;

      const dateText = matchDate
        ? formatMatchDateTime(matchDate)
        : "Date TBD";

      const scoreText =
        match.scoreSummary ||
        match.liveScore ||
        [match.firstInningsScore, match.secondInningsScore]
          .filter(Boolean)
          .join(" vs ");

      return (
        <button
          key={match.id}
          type="button"
          className={
            contextFilters.matchIds.includes(Number(match.id))
              ? "filter-row smart-match-row active"
              : "filter-row smart-match-row"
          }
          onClick={() => toggleFilterValue("matchIds", Number(match.id))}
        >
          <span className="smart-match-title">
            🏏 {match.teamAName} vs {match.teamBName}
          </span>

          <small className="smart-match-extra">
            {scoreText
              ? `📊 ${scoreText}`
              : match.battingFirstTeamName
              ? `🏏 Bat 1st: ${match.battingFirstTeamName}`
              : `Match #${match.id}`}
          </small>
          <small className="smart-match-meta">
            <b>{String(match.status || "").replaceAll("_", " ")}</b>
            {" • "}
            {dateText}
            {match.seriesName ? ` • ${match.seriesName}` : ""}
          </small>
        </button>
      );
    })} 
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
  ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].map(
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
      <h3>{editingSeries ? "✏️ Edit Series" : "📅 Create Series"}</h3>

      <p className="muted">
        {editingSeries
          ? "Update the selected series details."
          : "Create a tournament, season, cup, or yearly series under the selected league."}
      </p>

      <label>
        <span>Series Name</span>
        <input
          value={seriesForm.name}
          onChange={(e) =>
            setSeriesForm((prev) => ({
              ...prev,
              name: e.target.value,
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
              year: e.target.value,
            }))
          }
        />
      </label>

      <label>
        <span>Description</span>
        <input
          value={seriesForm.description || ""}
          onChange={(e) =>
            setSeriesForm((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
          placeholder="Optional"
        />
      </label>

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setShowSeriesModal(false);
            setEditingSeries(null);
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn"
          onClick={async () => {
            const isEditing = Boolean(editingSeries?.id);

            const saved = await api(
              isEditing ? `/api/series/${editingSeries.id}` : "/api/series",
              {
                method: isEditing ? "PATCH" : "POST",
                body: JSON.stringify({
                  ...seriesForm,
                  leagueId: activeLeagueId,
                  year: Number(seriesForm.year),
                }),
              }
            );

            setSeriesForm({
              name: "",
              year: new Date().getFullYear(),
              description: "",
            });

            setEditingSeries(null);
            setShowSeriesModal(false);
            await loadSeries(activeLeagueId);

            setSelectedSeriesId(String(saved.id));
          }}
        >
          {editingSeries ? "Save Changes" : "Create Series"}
        </button>
      </div>
    </div>
  </div>
)}
{showWicketModal && (
<div className="modal-backdrop wicket-modal-backdrop">
  <div className="modal-card app-modal-card wicket-modal-card">
    <button
  type="button"
  className="wicket-modal-close"
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
  ✕
</button>
<div className="live-popup-snapshot">
  <div className="live-popup-topline">
    <span className="live-dot">● LIVE</span>
    <span className="live-popup-over">Over {bowlerChangeScore.overs}</span>
  </div>

  <div className="live-popup-main">
    <div>
      <span>Current Score</span>
      <strong>{bowlerChangeScore.score}</strong>
    </div>

    <div>
      <span>CRR</span>
      <strong>{bowlerChangeScore.crr}</strong>
    </div>
  </div>

  <div className="live-popup-recent">
    <div className="live-popup-recent-head">
      <span>Previous Over</span>
      <b>{previousOverInfo.overNo}</b>
    </div>

    <div className="live-popup-balls">
      {previousOverInfo.balls.length ? (
        previousOverInfo.balls.map((ball) => {
          const label = ball.label || "";
          const result = (
            label.split(" ").slice(1).join(" ") || label
          ).replace(/[()]/g, "");

          const ballClass =
            result === "W"
              ? "wicket"
              : result === "4"
              ? "four"
              : result === "6"
              ? "six"
              : result.toUpperCase().includes("WD")
              ? "wide"
              : result.toUpperCase().includes("NB")
              ? "noball"
              : "";

          return (
            <b key={ball.id} className={ballClass}>
              {result}
            </b>
          );
        })
      ) : (
        <small>No balls yet</small>
      )}
    </div>
  </div>
</div>
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
 {WICKET_TYPES
  .filter(
    (x) =>
      x !== "NONE" &&
      x !== "RETIRED_HURT"
  )
  .map((type) => (
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
    newBatterId: "",
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
          disabled={!ballForm.isWicket || endInningsAfterWicket}
        >
          <option value="">Select New Batter</option>
          {availableNewBatters.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="wicket-end-innings-option">
  <input
    type="checkbox"
    checked={endInningsAfterWicket}
    onChange={(e) => {
      const checked = e.target.checked;

      setEndInningsAfterWicket(checked);

      if (checked) {
        setBallForm((prev) => ({
          ...prev,
          newBatterId: "",
        }));
      }
    }}
  />

  <span>
    🛑 No more batters available — end innings after this wicket
  </span>
</label>
        {noNewBatterAvailable && (
  <div className="wicket-final-batter-note">
    🏁 No new batter available. This wicket will end the innings.
  </div>
)}
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

      <div className="modal-actions wicket-modal-actions">
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

        <button type="button" className="btn"  onClick={() => confirmWicket()}>
          Confirm Wicket
        </button>
      </div>
    </div>
  </div>
)}
{showDeliverySetupModal && (
  <div className="modal-backdrop">
    <div className="add-player-pro-modal">
<div className="live-popup-snapshot">
  <div className="live-popup-topline">
    <span className="live-dot">● LIVE</span>
    <span className="live-popup-over">Over {bowlerChangeScore.overs}</span>
  </div>

  <div className="live-popup-main">
    <div>
      <span>Current Score</span>
      <strong>{bowlerChangeScore.score}</strong>
    </div>

    <div>
      <span>CRR</span>
      <strong>{bowlerChangeScore.crr}</strong>
    </div>
  </div>

  <div className="live-popup-recent">
    <div className="live-popup-recent-head">
      <span>Previous Over</span>
      <b>{previousOverInfo.overNo}</b>
    </div>

    <div className="live-popup-balls">
      {previousOverInfo.balls.length ? (
        previousOverInfo.balls.map((ball) => {
          const label = ball.label || "";
          const result = (
            label.split(" ").slice(1).join(" ") || label
          ).replace(/[()]/g, "");

          const ballClass =
            result === "W"
              ? "wicket"
              : result === "4"
              ? "four"
              : result === "6"
              ? "six"
              : result.toUpperCase().includes("WD")
              ? "wide"
              : result.toUpperCase().includes("NB")
              ? "noball"
              : "";

          return (
            <b key={ball.id} className={ballClass}>
              {result}
            </b>
          );
        })
      ) : (
        <small>No balls yet</small>
      )}
    </div>
  </div>
</div>
      <div className="add-player-pro-hero">
        <div className="add-player-pro-icon">🎯</div>

        <div>
          <h3>Setup Next Delivery</h3>
          <p>{deliverySetupReason}</p>
        </div>

        <button
          type="button"
          className="add-player-pro-close"
          onClick={() => {
  const safeInningsNo = getSafeScoringInningsNo(scoreboard, ballForm);

  setBallForm((prev) => ({
    ...prev,
    inningsNo: safeInningsNo,
  }));

  setShowDeliverySetupModal(false);
}}
        >
          ✕
        </button>
      </div>

      <div className="add-player-pro-form">
        <label className="player-modal-field">
          <span>🏏 Striker</span>
          <select
            value={ballForm.strikerId || ""}
            onChange={(e) =>
              setBallForm((prev) => ({
                ...prev,
                strikerId: e.target.value,
              }))
            }
          >
            <option value="">Choose striker</option>
            {setupBatters.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="player-modal-field">
          <span>🏏 Non-striker</span>
          <select
            value={ballForm.nonStrikerId || ""}
            onChange={(e) =>
              setBallForm((prev) => ({
                ...prev,
                nonStrikerId: e.target.value,
              }))
            }
          >
            <option value="">Choose non-striker</option>
            {setupBatters.filter((p) => String(p.id) !== String(ballForm.strikerId))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>

        <label className="player-modal-field">
          <span>🎯 Bowler</span>
          <select
            value={ballForm.bowlerId || ""}
            onChange={(e) =>
              setBallForm((prev) => ({
                ...prev,
                bowlerId: e.target.value,
              }))
            }
          >
            <option value="">Choose bowler</option>
            {setupBowlers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="player-modal-actions">
          <button
            type="button"
            className="player-modal-save"
            disabled={
              !ballForm.strikerId ||
              !ballForm.nonStrikerId ||
              !ballForm.bowlerId ||
              String(ballForm.strikerId) === String(ballForm.nonStrikerId)
            }
onClick={() => {
  const setupInningsNo = Number(ballForm?.inningsNo || 1);

  setBallForm((prev) => ({
    ...prev,
    inningsNo: setupInningsNo,
    strikerId: String(prev.strikerId || ballForm.strikerId),
    nonStrikerId: String(prev.nonStrikerId || ballForm.nonStrikerId),
    bowlerId: String(prev.bowlerId || ballForm.bowlerId),
  }));

  setPendingSecondInningsSetup(false);
  setShowDeliverySetupModal(false);
}}
          >
            ✅ Ready to Score
          </button>
        </div>
      </div>
    </div>
  </div>
)}
{showEditMatchModal && editingMatch && (
  <div className="modal-backdrop edit-match-backdrop-v3">
    <div className="edit-match-modal-v3">
      <div className="edit-match-hero-v3">
        <div className="edit-match-hero-left">
          <span className="edit-match-kicker-v3">📅 Scheduled Match</span>

          <h2>Edit Match Details</h2>

<div className="edit-match-vs-v3">
  <span>
    {editTeamA?.name ||
      editingMatch.teamAName ||
      "Team A"}
  </span>

  <b>VS</b>

  <span>
    {editTeamB?.name ||
      editingMatch.teamBName ||
      "Team B"}
  </span>
</div>
        </div>

        <button
          type="button"
          className="edit-modal-close-v3"
          onClick={() => {
            setShowEditMatchModal(false);
            setEditingMatch(null);
          }}
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleUpdateScheduledMatch} className="edit-match-form-v3">
        <section className="edit-panel-v3 edit-teams-panel-v3">
  <div className="edit-panel-title-v3">
    <strong>🏏 Participating Teams</strong>

    <span>
      Choose two different teams from this league. Player role
      options will refresh automatically.
    </span>
  </div>

  <div className="edit-team-picker-grid-v3">
    <label className="edit-field-v3">
      <span>Team A</span>

      <select
        value={editMatchForm.teamAId}
        onChange={(event) => {
          const nextTeamAId = event.target.value;

          setEditMatchForm((previous) => ({
            ...previous,
            teamAId: nextTeamAId,

            // Clear old Team A player roles because
            // they may not belong to the newly selected team.
            teamACaptainId: "",
            teamAWicketKeeperId: "",
          }));
        }}
        required
      >
        <option value="">Select Team A</option>

        {editMatchLeagueTeams
          .filter(
            (team) =>
              Number(team.id) !==
              Number(editMatchForm.teamBId)
          )
          .map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
      </select>
    </label>

    <div className="edit-team-picker-vs-v3">
      <span>VS</span>
    </div>

    <label className="edit-field-v3">
      <span>Team B</span>

      <select
        value={editMatchForm.teamBId}
        onChange={(event) => {
          const nextTeamBId = event.target.value;

          setEditMatchForm((previous) => ({
            ...previous,
            teamBId: nextTeamBId,

            // Clear old Team B player roles because
            // they may not belong to the newly selected team.
            teamBCaptainId: "",
            teamBWicketKeeperId: "",
          }));
        }}
        required
      >
        <option value="">Select Team B</option>

        {editMatchLeagueTeams
          .filter(
            (team) =>
              Number(team.id) !==
              Number(editMatchForm.teamAId)
          )
          .map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
      </select>
    </label>
  </div>

  <div className="edit-team-change-note-v3">
    <span>ℹ️</span>

    <div>
      <strong>Teams are switched, not renamed</strong>

      <small>
        This changes which existing teams participate in this
        scheduled match. It does not change any team’s saved name.
      </small>
    </div>
  </div>
</section>
        <section className="edit-panel-v3">
          <div className="edit-panel-title-v3">
            <strong>⚙️ Match Settings</strong>
            <span>Update schedule, overs, wickets and bowling limits.</span>
          </div>

          <div className="edit-match-grid-v3">
            <label className="edit-field-v3 wide">
              <span>Scheduled Date/Time</span>
              <input
                type="datetime-local"
                value={editMatchForm.scheduledAt}
                onChange={(e) =>
                  setEditMatchForm((prev) => ({
                    ...prev,
                    scheduledAt: e.target.value,
                  }))
                }
              />
            </label>

            <label className="edit-field-v3 wide">
              <span>Series</span>
              <select
                value={editMatchForm.seriesId}
                onChange={(e) =>
                  setEditMatchForm((prev) => ({
                    ...prev,
                    seriesId: e.target.value,
                  }))
                }
              >
                <option value="">No Series</option>
                {seriesList.map((series) => (
                  <option key={series.id} value={series.id}>
                    {series.name} {series.year ? `(${series.year})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="edit-field-v3">
              <span>🎯 Overs</span>
              <input
                type="number"
                min="1"
                value={editMatchForm.oversPerInnings}
                onChange={(e) =>
                  setEditMatchForm((prev) => ({
                    ...prev,
                    oversPerInnings: e.target.value,
                  }))
                }
              />
            </label>

            <label className="edit-field-v3">
              <span>⚡ Powerplay</span>
              <input
                type="number"
                min="0"
                value={editMatchForm.powerplayOversInnings}
                onChange={(e) =>
                  setEditMatchForm((prev) => ({
                    ...prev,
                    powerplayOversInnings: e.target.value,
                  }))
                }
              />
            </label>

            <label className="edit-field-v3">
              <span>☝️ Max Wickets</span>
              <input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={editMatchForm.maxWicketsPerInnings}
                onChange={(e) =>
                  setEditMatchForm((prev) => ({
                    ...prev,
                    maxWicketsPerInnings: e.target.value,
                  }))
                }
              />
            </label>

            <label className="edit-field-v3">
              <span>🎳 Max Overs/Bowler</span>
              <input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={editMatchForm.maxOversPerBowler}
                onChange={(e) =>
                  setEditMatchForm((prev) => ({
                    ...prev,
                    maxOversPerBowler: e.target.value,
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="edit-panel-v3">
          <div className="edit-panel-title-v3">
            <strong>🧢 Captains & Wicketkeepers</strong>
            <span>Select optional officials for each team.</span>
          </div>

          <div className="edit-role-grid-v3">
<div className="edit-team-role-card-v3 team-a">
  <div className="team-role-card-head-v3">
    <span>A</span>

    <strong>
      {editTeamA?.name || "Select Team A"}
    </strong>
  </div>

  <label className="edit-field-v3">
    <span>🧢 Captain</span>

    <select
      value={editMatchForm.teamACaptainId}
      disabled={!editTeamA}
      onChange={(event) =>
        setEditMatchForm((previous) => ({
          ...previous,
          teamACaptainId: event.target.value,
        }))
      }
    >
      <option value="">
        {editTeamA
          ? "Select Captain"
          : "Select Team A first"}
      </option>

      {(editTeamA?.players || [])
        .slice()
        .sort((first, second) =>
          String(first.name || "").localeCompare(
            String(second.name || ""),
            undefined,
            {
              sensitivity: "base",
              numeric: true,
            }
          )
        )
        .map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
    </select>
  </label>

  <label className="edit-field-v3">
    <span>🧤 Wicketkeeper</span>

    <select
      value={editMatchForm.teamAWicketKeeperId}
      disabled={!editTeamA}
      onChange={(event) =>
        setEditMatchForm((previous) => ({
          ...previous,
          teamAWicketKeeperId:
            event.target.value,
        }))
      }
    >
      <option value="">
        {editTeamA
          ? "Select Wicketkeeper"
          : "Select Team A first"}
      </option>

      {(editTeamA?.players || [])
        .slice()
        .sort((first, second) =>
          String(first.name || "").localeCompare(
            String(second.name || ""),
            undefined,
            {
              sensitivity: "base",
              numeric: true,
            }
          )
        )
        .map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
    </select>
  </label>
</div>
            <div className="edit-team-role-card-v3 team-b">
  <div className="team-role-card-head-v3">
    <span>B</span>

    <strong>
      {editTeamB?.name || "Select Team B"}
    </strong>
  </div>

  <label className="edit-field-v3">
    <span>🧢 Captain</span>

    <select
      value={editMatchForm.teamBCaptainId}
      disabled={!editTeamB}
      onChange={(event) =>
        setEditMatchForm((previous) => ({
          ...previous,
          teamBCaptainId: event.target.value,
        }))
      }
    >
      <option value="">
        {editTeamB
          ? "Select Captain"
          : "Select Team B first"}
      </option>

      {(editTeamB?.players || [])
        .slice()
        .sort((first, second) =>
          String(first.name || "").localeCompare(
            String(second.name || ""),
            undefined,
            {
              sensitivity: "base",
              numeric: true,
            }
          )
        )
        .map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
    </select>
  </label>

  <label className="edit-field-v3">
    <span>🧤 Wicketkeeper</span>

    <select
      value={editMatchForm.teamBWicketKeeperId}
      disabled={!editTeamB}
      onChange={(event) =>
        setEditMatchForm((previous) => ({
          ...previous,
          teamBWicketKeeperId:
            event.target.value,
        }))
      }
    >
      <option value="">
        {editTeamB
          ? "Select Wicketkeeper"
          : "Select Team B first"}
      </option>

      {(editTeamB?.players || [])
        .slice()
        .sort((first, second) =>
          String(first.name || "").localeCompare(
            String(second.name || ""),
            undefined,
            {
              sensitivity: "base",
              numeric: true,
            }
          )
        )
        .map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
    </select>
  </label>
</div>
          </div>
        </section>

        <div className="edit-match-actions-v3">
          <button
            type="button"
            className="edit-cancel-btn-v3"
            onClick={() => {
              setShowEditMatchModal(false);
              setEditingMatch(null);
            }}
          >
            Cancel
          </button>

          <button type="submit" className="edit-save-btn-v3">
            💾 Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{showKeeperChangeModal && (
  <div className="modal-backdrop">
    <div className="correction-modal">
      <div className="bowler-change-score-card">
  <div>
    <span>Current Score</span>
    <strong>{bowlerChangeScore.score}</strong>
  </div>

  <div>
    <span>Overs</span>
    <strong>{bowlerChangeScore.overs}</strong>
  </div>

  <div>
    <span>CRR</span>
    <strong>{bowlerChangeScore.crr}</strong>
  </div>

  <div className="bowler-change-recent">
    <span>Previous Over • {previousOverInfo.overNo}</span>
    <div>
      {previousOverInfo.balls.length ? (
        previousOverInfo.balls.map((ball) => {
          const label = ball.label || "";
          const result = (
            label.split(" ").slice(1).join(" ") || label
          ).replace(/[()]/g, "");

          return <b key={ball.id}>{result}</b>;
        })
      ) : (
        <small>No balls yet</small>
      )}
    </div>
  </div>
</div>
      <div className="correction-header">
        <h2>🧤 Change Wicketkeeper</h2>

        <button
          type="button"
          className="edit-modal-close-v2"
          onClick={() => setShowKeeperChangeModal(false)}
        >
          ✕
        </button>
      </div>

      <div className="form-grid">
        <label>
          <span>New Wicketkeeper</span>
          <select
            value={keeperChangeForm.newKeeperId}
            onChange={(e) =>
              setKeeperChangeForm((prev) => ({
                ...prev,
                newKeeperId: e.target.value,
              }))
            }
          >
            <option value="">Select wicketkeeper</option>
            {(bowlingTeam?.players || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Note</span>
          <input
            value={keeperChangeForm.note}
            onChange={(e) =>
              setKeeperChangeForm((prev) => ({
                ...prev,
                note: e.target.value,
              }))
            }
            placeholder="Optional"
          />
        </label>
      </div>

      <div className="edit-match-actions-v2">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setShowKeeperChangeModal(false)}
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleLiveWicketKeeperChange}
        >
          Save WK Change
        </button>
      </div>
    </div>
  </div>
)}
{showFollowedLeaguesDrawer && (
  <div className="public-league-drawer-backdrop">
    <aside className="public-league-drawer">
      <div className="public-league-drawer-head">
        <div>
          <h3>⭐ Followed Leagues</h3>
          <p>Your followed public leagues will appear here.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowFollowedLeaguesDrawer(false)}
        >
          ✕
        </button>
      </div>

      <a href="/explore" className="public-league-explore-card">
        <strong>Explore public leagues</strong>
        <span>Find leagues to follow from the public Explore page.</span>
        <b>Open Explore →</b>
      </a>
    </aside>
  </div>
)}
{showPublicLeagueDrawer && (
  <div className="public-league-drawer-backdrop">
    <aside className="public-league-drawer">
      <div className="public-league-drawer-head">
        <div>
          <h3>🌐 Public Leagues</h3>
          <p>Browse public leagues without adding them to your workspace.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowPublicLeagueDrawer(false)}
        >
          ✕
        </button>
      </div>

      <a href="/explore" className="public-league-explore-card">
        <strong>Explore all public leagues</strong>
        <span>View leagues, teams, matches, stats, and live scorecards.</span>
        <b>Open Explore →</b>
      </a>
    </aside>
  </div>
)}
{showEditTeamModal && editingTeam && (
<div className="modal-backdrop">

<div className="rename-modal">

<button
className="rename-close"
onClick={()=>{
setShowEditTeamModal(false);
setEditingTeam(null);
}}
>
✕
</button>

<div className="rename-icon">
🏏
</div>

<h2>Rename Team</h2>

<p>
Update your team name.
This will be visible everywhere in the league.
</p>

<label>

<span>TEAM NAME</span>

<input
value={teamEditName}
placeholder="Enter team name"
onChange={(e)=>setTeamEditName(e.target.value)}
/>

</label>

<div className="rename-note">
💡 Team names must be unique within a league.
</div>

<div className="rename-actions">

<button
className="btn btn-outline"
onClick={()=>{
setShowEditTeamModal(false);
setEditingTeam(null);
}}
>
Cancel
</button>

<button
className="btn btn-primary"
onClick={async()=>{

try{

await api(`/api/teams/${editingTeam.id}`,{
method:"PATCH",
body:JSON.stringify({
name:teamEditName.trim()
})
});

await loadTeams();
await loadLeagues();

setShowEditTeamModal(false);
setEditingTeam(null);

showToast("success","✅ Team renamed.");

}
catch(err){

setError(err.message);
showToast("error",err.message);

}

}}
>
💾 Save Changes
</button>

</div>

</div>

</div>
)}
{showEditPlayerModal && editingPlayer && (

<div className="modal-backdrop">

<div className="rename-modal">

<button
className="rename-close"
onClick={()=>{
setShowEditPlayerModal(false);
setEditingPlayer(null);
}}
>
✕
</button>

<div className="rename-icon">
👤
</div>

<h2>Rename Player</h2>

<p>
Update the player's display name.
Statistics and match history remain unchanged.
</p>

<label>

<span>PLAYER NAME</span>

<input
value={editPlayerName}
placeholder="Enter player name"
onChange={(e)=>setEditPlayerName(e.target.value)}
/>

</label>

<div className="rename-note">
🏏 Player statistics are preserved.
</div>

<div className="rename-actions">

<button
className="btn btn-outline"
onClick={()=>{
setShowEditPlayerModal(false);
setEditingPlayer(null);
}}
>
Cancel
</button>

<button
className="btn btn-primary"
onClick={savePlayerName}
>
💾 Save Changes
</button>

</div>

</div>

</div>

)}
{showTransferPlayerModal && transferPlayer && (
  <div className="modal-backdrop">
    <div className="rename-modal">
      <button
        type="button"
        className="rename-close"
        onClick={() => {
          setShowTransferPlayerModal(false);
          setTransferPlayer(null);
          setTransferTeamId("");
        }}
      >
        ✕
      </button>

      <div className="rename-icon">🔁</div>

      <h2>Move Player</h2>

      <p>
        Move <strong>{transferPlayer.name}</strong> to another team in the same league.
      </p>

      <label>
        <span>NEW TEAM</span>

        <select
          value={transferTeamId}
          onChange={(e) => setTransferTeamId(e.target.value)}
        >
          <option value="">Select Team</option>

          {teams
            .filter((team) => Number(team.leagueId) === Number(activeLeagueId))
            .filter((team) => Number(team.id) !== Number(transferPlayer.teamId))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
        </select>
      </label>

      <div className="rename-note">
        Player stats and match history will stay attached to this player.
      </div>

      <div className="rename-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setShowTransferPlayerModal(false);
            setTransferPlayer(null);
            setTransferTeamId("");
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn btn-primary"
          disabled={!transferTeamId}
          onClick={async () => {
            await api(`/api/players/${transferPlayer.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                teamId: Number(transferTeamId),
              }),
            });

            await refreshPlayerLists();

            setShowTransferPlayerModal(false);
            setTransferPlayer(null);
            setTransferTeamId("");

            showToast("success", "✅ Player moved.");
          }}
        >
          🔁 Move Player
        </button>
      </div>
    </div>
  </div>
)}
{showCorrectionCenter && matchDetail && (
  <div className="modal-backdrop">
    <div className="correction-center-modal">
      <div className="correction-center-header">
        <div>
          <h3>✏️ Scorecard Correction Center</h3>
          <p>Correct completed match details safely without changing innings totals accidentally.</p>
        </div>
        {correctionError && (
  <div className="correction-error-box">
    ⚠️ {correctionError}
  </div>
)}

        <button
          type="button"
          className="icon-btn"
          onClick={() => setShowCorrectionCenter(false)}
        >
          ✕
        </button>
      </div>

      <div className="correction-type-tabs">
        {[
          ["TRANSFER_BATTER_RUNS", "🏏 Batting"],
          ["REASSIGN_OVER_BOWLER", "🎳 Bowling"],
          ["CHANGE_FIELDER", "🧤 Fielding"],
          ["RETIRED_HURT", "🩹 Retired Hurt"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={correctionType === key ? "active" : ""}
            onClick={() => {
              setCorrectionType(key);
              setCorrectionForm({});
              setCorrectionError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
<label>
  <span>Innings</span>

<select
  value={correctionInnings}
  onChange={(e) => {
    setCorrectionInnings(Number(e.target.value));
    setCorrectionForm({});
  }}
>
    <option value={1}>
      1st Innings
    </option>

    <option value={2}>
      2nd Innings
    </option>
  </select>
</label>
{correctionType === "RETIRED_HURT" && (
  <div className="retired-hurt-wow-layout">
    <section className="retired-hurt-main-panel">
      <div className="retired-hurt-panel-head">
        <div>
          <h4>🩹 Retired Hurt Correction</h4>
          <p>
            Correct the batter flow after a retired hurt event while preserving
            innings score integrity.
          </p>
        </div>
      </div>

      <div className="retired-hurt-form-grid">
        <label className="retired-hurt-field retired-hurt-wide-field">
          <span>① Retired Hurt Event</span>
          <select
            value={correctionForm.retiredBallId || ""}
onChange={(e) => {
  const retiredBallId = e.target.value;

  const selectedBall = retiredHurtBallsForCorrection.find(
    (ball) => String(ball.id) === String(retiredBallId)
  );

  setCorrectionForm((prev) => ({
    ...prev,
    retiredBallId,
    retiredPlayerId: selectedBall?.dismissedPlayerId || "",
    replacementPlayerId: selectedBall?.newBatterId || "",
  }));

  setCorrectionError("");
}}
          >
            <option value="">Select retired hurt event</option>

            {retiredHurtBallsForCorrection.map((ball) => {
              const retiredPlayer =
                battingPlayersForCorrection.find(
                  (p) => Number(p.id) === Number(ball.dismissedPlayerId)
                )?.name || "Retired batter";

              return (
                <option key={ball.id} value={ball.id}>
                  {ball.overNo}.{ball.ballInOver} • {retiredPlayer}
                </option>
              );
            })}
          </select>
        </label>

        <label className="retired-hurt-field">
          <span>② Retired Batter</span>
          <select
            value={correctionForm.retiredPlayerId || ""}
            onChange={(e) =>
              setCorrectionForm((prev) => ({
                ...prev,
                retiredPlayerId: e.target.value,
              }))
            }
          >
            <option value="">Select retired batter</option>

            {battingPlayersForCorrection.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} ({battingTeamForCorrection?.name})
              </option>
            ))}
          </select>
        </label>

        <div className="retired-hurt-flow-connector">
          <span>→</span>
        </div>

        <label className="retired-hurt-field">
          <span>③ Replacement Batter</span>
          <select
            value={correctionForm.replacementPlayerId || ""}
            onChange={(e) =>
              setCorrectionForm((prev) => ({
                ...prev,
                replacementPlayerId: e.target.value,
              }))
            }
          >
            <option value="">Select replacement batter</option>

            {battingPlayersForCorrection.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} ({battingTeamForCorrection?.name})
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>

    <aside className="retired-hurt-preview-panel">
      <h4>✨ What Cric4All will update</h4>

      <div className="retired-hurt-check-list">
        <div>✅ The retired hurt event will be corrected, and future affected balls will be updated only if needed.</div>
        <div>✅ Innings total will not be accidentally changed.</div>
        <div>✅ Retired batter can still return later.</div>
        <div>✅ Scorecard, stats, and commentary refresh from corrected ball data.</div>
        <div>✅ Full rollback is available from Correction History.</div>
      </div>
    </aside>
  </div>
)}
      {correctionType === "TRANSFER_BATTER_RUNS" && (
        <div className="correction-form-grid">
          <label>
            <span>From Batter</span>
            <select
              value={correctionForm.fromPlayerId || ""}
              onChange={(e) =>
                setCorrectionForm((p) => ({ ...p, fromPlayerId: e.target.value }))
              }
            >
<option value="">Select batter</option>
{battingPlayersForCorrection.map((player) => (
  <option key={player.id} value={player.id}>
    {player.name} ({battingTeamForCorrection?.name})
  </option>
))}
            </select>
          </label>

          <label>
            <span>To Batter</span>
            <select
              value={correctionForm.toPlayerId || ""}
              onChange={(e) =>
                setCorrectionForm((p) => ({ ...p, toPlayerId: e.target.value }))
              }
            >
<option value="">Select batter</option>
{battingPlayersForCorrection.map((player) => (
  <option key={player.id} value={player.id}>
    {player.name} ({battingTeamForCorrection?.name})
  </option>
))}
            </select>
          </label>

          <label>
            <span>Runs to Transfer</span>
            <input
              type="number"
              min="1"
              value={correctionForm.runs || ""}
              onChange={(e) =>
                setCorrectionForm((p) => ({ ...p, runs: e.target.value }))
              }
            />
          </label>
        </div>
      )}

      {correctionType === "REASSIGN_OVER_BOWLER" && (
        <div className="correction-form-grid">
<label>
  <span>Over</span>
  <select
    value={correctionForm.overNo || ""}
    onChange={(e) =>
      setCorrectionForm((p) => ({ ...p, overNo: e.target.value }))
    }
  >
    <option value="">Select over</option>
    {oversForCorrection.map((overNo) => (
<option key={overNo} value={overNo}>
    Over {Number(overNo) + 1}
</option>
    ))}
  </select>
</label>

          <label>
            <span>Correct Bowler</span>
            <select
              value={correctionForm.newBowlerId || ""}
              onChange={(e) =>
                setCorrectionForm((p) => ({ ...p, newBowlerId: e.target.value }))
              }
            >
<option value="">Select bowler</option>
{bowlingPlayersForCorrection.map((player) => (
  <option key={player.id} value={player.id}>
    {player.name} ({bowlingTeamForCorrection?.name})
  </option>
))}
            </select>
          </label>
        </div>
      )}

      {correctionType === "CHANGE_FIELDER" && (
        <div className="correction-form-grid">
<label>
  <span>Dismissal</span>

  <select
    value={correctionForm.ballId || ""}
    onChange={(e) =>
      setCorrectionForm((p) => ({
        ...p,
        ballId: e.target.value,
      }))
    }
  >
    <option value="">Select dismissal</option>

    {wicketBallsForCorrection.map((ball) => (
      <option key={ball.id} value={ball.id}>
        {Number(ball.overNo) + 1}.{ball.ballInOver} •{" "}
        {String(ball.wicketType || "WICKET").replaceAll("_", " ")}
        {ball.dismissedPlayer?.name ? ` • ${ball.dismissedPlayer.name}` : ""}
      </option>
    ))}
  </select>
</label>

          <label>
            <span>Correct Fielder</span>
            <select
              value={correctionForm.fielderId || ""}
              onChange={(e) =>
                setCorrectionForm((p) => ({ ...p, fielderId: e.target.value }))
              }
            >
<option value="">Select fielder</option>
{bowlingPlayersForCorrection.map((player) => (
  <option key={player.id} value={player.id}>
    {player.name} ({bowlingTeamForCorrection?.name})
  </option>
))}
            </select>
          </label>

          <label>
            <span>Assistant Fielder Optional</span>
            <select
              value={correctionForm.assistantFielderId || ""}
              onChange={(e) =>
                setCorrectionForm((p) => ({ ...p, assistantFielderId: e.target.value }))
              }
            >
              <option value="">None</option>
              {[...(bowlingTeamForCorrection?.players || []), ...(battingTeamForCorrection?.players || [])].map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

<label className="correction-reason">
  <span>Reason for correction</span>
  <textarea
    value={correctionReason}
    onChange={(e) => setCorrectionReason(e.target.value)}
    placeholder="Example: Retired hurt replacement was assigned incorrectly."
  />
</label>

      <div className="correction-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setShowCorrectionCenter(false)}
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn"
          disabled={correctionLoading}
          onClick={applyCorrection}
        >
          {correctionLoading ? "Applying..." : "Apply Correction"}
        </button>
      </div>

      <div className="correction-history">
        <h4>📜 Correction History</h4>

        {!correctionHistory.length ? (
          <p className="muted">No corrections yet.</p>
        ) : (
          correctionHistory.map((c) => (
            <div key={c.id} className="correction-history-row">
              <div>
                <strong>{c.correctionLabel || c.correctionType}</strong>
                <span>{c.reason || "No reason provided."}</span>
                <small>
                  {c.correctedByName || c.correctedByEmail || "Unknown"} •{" "}
                  {formatDate(c.createdAt)}
                </small>
              </div>

              {!c.revertedAt && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => rollbackCorrection(c.id)}
                >
                  ↩ Rollback
                </button>
              )}

              {c.revertedAt && <small>Reverted</small>}
            </div>
          ))
        )}
      </div>
    </div>
  </div>
)}
{showRetiredHurtModal && (
  <div className="modal-backdrop">
    <div className="modal-card">
<div className="live-popup-snapshot">
  <div className="live-popup-topline">
    <span className="live-dot">● LIVE</span>
    <span className="live-popup-over">Over {bowlerChangeScore.overs}</span>
  </div>

  <div className="live-popup-main">
    <div>
      <span>Current Score</span>
      <strong>{bowlerChangeScore.score}</strong>
    </div>

    <div>
      <span>CRR</span>
      <strong>{bowlerChangeScore.crr}</strong>
    </div>
  </div>

  <div className="live-popup-recent">
    <div className="live-popup-recent-head">
      <span>Previous Over</span>
      <b>{previousOverInfo.overNo}</b>
    </div>

    <div className="live-popup-balls">
      {previousOverInfo.balls.length ? (
        previousOverInfo.balls.map((ball) => {
          const label = ball.label || "";
          const result = (
            label.split(" ").slice(1).join(" ") || label
          ).replace(/[()]/g, "");

          const ballClass =
            result === "W"
              ? "wicket"
              : result === "4"
              ? "four"
              : result === "6"
              ? "six"
              : result.toUpperCase().includes("WD")
              ? "wide"
              : result.toUpperCase().includes("NB")
              ? "noball"
              : "";

          return (
            <b key={ball.id} className={ballClass}>
              {result}
            </b>
          );
        })
      ) : (
        <small>No balls yet</small>
      )}
    </div>
  </div>
</div>
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
{correctionSaving && (
  <div className="correction-overlay">
    <div className="correction-card">
      <div className="spinner" />

      <h3>Recalculating Scorecard</h3>

      <p>
        Replaying deliveries from 7.1 onwards.
      </p>
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