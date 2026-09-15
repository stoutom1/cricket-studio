export const metadata = {
  title: "About Cric4All | Community Cricket Scoring & League Management",
  description:
    "Learn how Cric4All supports community cricket with live scoring, league management, player statistics, communications, kit tracking, birthdays, inactivity alerts and public spectator experiences.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <main className="editorial-page">
      <article className="editorial-card">
        <p className="editorial-kicker">ABOUT CRIC4ALL</p>
        <h1>Helping community cricket keep a better record of the game</h1>

        <p className="editorial-lead">
          Cric4All is a comprehensive cricket scoring and league-management
          platform designed for clubs, leagues, academies, tournaments and
          local cricket communities. It is operated by VSJ Serv LLC and brings
          match-day scoring, season administration, player history,
          communication and spectator experiences together in one platform.
        </p>

        <h2>Why Cric4All exists</h2>
        <p>
          Community cricket often relies on volunteers. A scorer may also be a
          player, captain or organizer, and a ground may not have dependable
          connectivity. Players still want accurate scorecards and season
          statistics, organizers need practical tools between matches, and
          spectators want an easy way to follow the game. Cric4All connects
          those jobs instead of treating scoring as an isolated counter.
        </p>

        <h2>Match scoring and match-day tools</h2>
        <p>
          Cric4All records the match ball by ball so one delivery can update
          the team score, batter, bowler, strike, partnership and match state
          together. The scorer workflow is designed to support both ordinary
          games and situations that need more than a basic scoreboard.
        </p>
        <ul>
          <li>Ball-by-ball live scoring with runs, extras and wickets</li>
          <li>Striker, non-striker and bowler management with scoring safeguards</li>
          <li>Undo and correction workflows when a delivery needs to be changed</li>
          <li>Offline-friendly scoring and synchronization when connectivity returns</li>
          <li>Powerplay tracking, bowling spells, maidens and partnerships</li>
          <li>Fall of wickets and over-by-over match summaries</li>
          <li>Rain interruptions and DLS-related match workflows</li>
          <li>Super Over support for tied matches</li>
          <li>Match sharing and public live spectator scoreboards</li>
          <li>TV Mode for a larger spectator-friendly live scoreboard</li>
        </ul>

        <h2>League, team and season management</h2>
        <p>
          A match belongs to a larger cricket season. Cric4All gives league
          organizers a place to maintain the structure around the scorecard so
          fixtures, results and statistics stay connected over time.
        </p>
        <ul>
          <li>Create and manage leagues, teams and player rosters</li>
          <li>Create fixtures and configure innings length and match settings</li>
          <li>Maintain standings, results and season history</li>
          <li>Use role-based access for owners, admins, captains, scorers, analysts and viewers</li>
          <li>Invite members with league-specific roles and permissions</li>
          <li>Manage league resources and information used by the cricket community</li>
          <li>Use Match Center views after a game for results and post-match context</li>
        </ul>

        <h2>Community operations beyond the scorecard</h2>
        <p>
          Running a cricket group also involves responsibilities that happen
          before and after the first ball. Cric4All includes league tools for
          recurring community tasks instead of forcing organizers to track
          everything separately.
        </p>
        <ul>
          <li>
            <strong>Birthday management:</strong> maintain player birthdays and
            support configured birthday reminders and greetings.
          </li>
          <li>
            <strong>Kit tracking:</strong> assign kit responsibility, keep a
            record of the current holder and support match-related kit reminders.
          </li>
          <li>
            <strong>Player inactivity:</strong> identify players who have not
            recorded qualifying match activity for a configured period and
            support league inactivity alerts.
          </li>
          <li>
            <strong>Notifications:</strong> support configured SMS and WhatsApp
            communication workflows where the appropriate recipient consent
            and league settings are present.
          </li>
          <li>
            <strong>Resources:</strong> organize useful league information and
            material alongside the operational parts of the competition.
          </li>
        </ul>

        <h2>Player statistics, achievements and cricket history</h2>
        <p>
          Completed matches become more useful when their events contribute to
          a player's and league's longer history. Cric4All turns recorded
          deliveries into batting, bowling and contextual views that can be
          revisited after match day.
        </p>
        <ul>
          <li>Batting, bowling and partnership statistics</li>
          <li>Leaderboards, records, awards and milestones</li>
          <li>Recent form, streaks and Player Pulse views</li>
          <li>Player cards and Player Journey history</li>
          <li>Player comparisons and rivalry views</li>
          <li>Team and season analytics from completed league matches</li>
          <li>A personal Your Cricket dashboard for linked player accounts</li>
        </ul>

        <h2>Public and spectator experience</h2>
        <p>
          Public Cric4All pages are separate from private scoring and
          administration controls. Where a league chooses to be public,
          spectators can follow useful cricket information without receiving
          scorer or administrator access.
        </p>
        <ul>
          <li>Public league discovery through Explore</li>
          <li>Live spectator match sharing</li>
          <li>Completed scorecards, results and Match Center information</li>
          <li>Public standings, statistics, leaders, records and milestones</li>
          <li>Season-oriented views that keep completed matches useful after the final ball</li>
        </ul>

        <h2>Our mission</h2>
        <p>
          Our mission is to make cricket scoring simple, powerful and
          accessible while giving community cricket a useful digital record
          that extends beyond the scoreboard. Cric4All is built around real
          workflows such as live scoring, unreliable connectivity, rain
          interruptions, league administration, player communication and the
          need to share a match with people who are not at the ground.
        </p>

        <p className="editorial-note">
          Feature availability can depend on league configuration, permissions,
          public/private settings and communication consent.
        </p>
      </article>
    </main>
  );
}
