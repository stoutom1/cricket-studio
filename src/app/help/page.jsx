import Link from "next/link";

export const metadata = {
  title: "Cric4All Help Guide | Scoring, Leagues & Community Tools",
  description:
    "Step-by-step Cric4All help for leagues, teams, players, live scoring, permissions, statistics, birthdays, kit tracking, inactivity alerts, notifications and spectator sharing.",
  alternates: {
    canonical: "/help",
  },
};

export default function HelpPage() {
  return (
    <main className="page-container help-guide-page">
      <h1>📖 Cric4All Help Guide</h1>
      <p>
        Follow these steps to manage leagues, teams, matches, live scoring and
        the community tools available around a Cric4All league.
      </p>

      <hr />

      <section>
        <h2>1️⃣ Create a League</h2>
        <p>A league is the top-level container for everything else.</p>
        <ol>
          <li>Go to Dashboard</li>
          <li>Open the Leagues tab</li>
          <li>Click Create League</li>
          <li>Enter a league name</li>
          <li>Save</li>
        </ol>
        <p>The newly created league becomes your Active League automatically.</p>
      </section>

      <hr />

      <section>
        <h2>2️⃣ Create Teams</h2>
        <ol>
          <li>Select your Active League</li>
          <li>Open the Teams tab</li>
          <li>Click Create Team</li>
          <li>Enter the team name</li>
          <li>Save</li>
        </ol>
        <p>Teams belong to the Active League.</p>
      </section>

      <hr />

      <section>
        <h2>3️⃣ Add Players</h2>
        <ol>
          <li>Open the Players tab</li>
          <li>Select the Team</li>
          <li>Click Add Player</li>
          <li>Enter the player details</li>
          <li>Save</li>
        </ol>
        <p>
          Player records power team selection, scoring and the statistics that
          are built from completed matches.
        </p>
      </section>

      <hr />

      <section>
        <h2>4️⃣ Create a Match</h2>
        <ol>
          <li>Open the Matches tab</li>
          <li>Click Create Match</li>
          <li>Select Team A and Team B</li>
          <li>Choose the batting-first team when required</li>
          <li>Enter the overs per innings and other available match settings</li>
          <li>Save</li>
        </ol>
        <p>Only teams from the Active League can be selected.</p>
      </section>

      <hr />

      <section>
        <h2>5️⃣ Live Scoring</h2>
        <ol>
          <li>Open Scoring</li>
          <li>Select the match</li>
          <li>Select striker and non-striker</li>
          <li>Select the opening bowler</li>
          <li>Start scoring</li>
        </ol>
        <h3>Common scoring actions</h3>
        <ul>
          <li>Runs from 0–6</li>
          <li>Wide and no-ball extras</li>
          <li>Byes and leg byes</li>
          <li>Wickets</li>
          <li>Undo/correct a delivery</li>
          <li>Strike and batter changes</li>
          <li>Bowler changes between overs</li>
          <li>Retire batter workflows</li>
        </ul>
        <p>
          Depending on match configuration, Cric4All can also support
          powerplays, rain/DLS workflows and a Super Over. Offline-friendly
          scoring helps the scorer continue when ground connectivity is
          unreliable and synchronize when connectivity returns.
        </p>
      </section>

      <hr />

      <section>
        <h2>6️⃣ League Permissions</h2>
        <ol>
          <li>Open Permissions for the Active League</li>
          <li>Choose the member</li>
          <li>Select the appropriate role</li>
          <li>Review available permissions</li>
          <li>Save</li>
        </ol>
        <h3>Roles used by Cric4All</h3>
        <ul>
          <li>OWNER</li>
          <li>ADMIN</li>
          <li>CAPTAIN</li>
          <li>SCORER</li>
          <li>ANALYST</li>
          <li>VIEWER</li>
        </ul>
        <p>
          Access is role- and permission-dependent. League owners have the
          broadest league-management controls.
        </p>
      </section>

      <hr />

      <section>
        <h2>7️⃣ Invite Users</h2>
        <ol>
          <li>Open League Management</li>
          <li>Create an invite link for an allowed role</li>
          <li>Copy the link</li>
          <li>Send it to the intended user</li>
        </ol>
        <p>
          A recipient can register or sign in and use the valid invite link to
          join the league with the role/permissions allowed by that invitation.
        </p>
      </section>

      <hr />

      <section>
        <h2>8️⃣ Statistics, Records and Player Views</h2>
        <p>
          Scored matches feed Cric4All's cricket history. Depending on the
          league and available match data, views can include:
        </p>
        <ul>
          <li>Batting and bowling statistics</li>
          <li>Partnerships and match summaries</li>
          <li>Leaderboards and records</li>
          <li>Awards and milestones</li>
          <li>Recent form, streaks and Player Pulse</li>
          <li>Player cards and Player Journey</li>
          <li>Player comparison and rivalry views</li>
          <li>Team and season-oriented analytics</li>
        </ul>
      </section>

      <hr />

      <section>
        <h2>9️⃣ Birthday Management</h2>
        <p>
          League birthday tools help organizers maintain player birthday
          information and, when configured, use Cric4All's birthday
          communication workflows.
        </p>
        <ol>
          <li>Open the Birthdays area for the Active League</li>
          <li>Review or maintain player birthday information</li>
          <li>Configure the available birthday/reminder preferences</li>
          <li>Use communication features only for recipients with the required consent</li>
        </ol>
      </section>

      <hr />

      <section>
        <h2>🔟 Kit Tracking and Match Responsibility</h2>
        <p>
          Kit Tracking helps a league record who is responsible for shared
          cricket kit and coordinate responsibility around upcoming matches.
        </p>
        <ul>
          <li>Open Kit Tracking from the league tools</li>
          <li>Review the current or upcoming kit responsibility</li>
          <li>Assign responsibility through the available match/league workflow</li>
          <li>Use configured reminders where communication consent is available</li>
        </ul>
      </section>

      <hr />

      <section>
        <h2>1️⃣1️⃣ Player Inactivity</h2>
        <p>
          Player Inactivity tools help authorized league administrators review
          players who have not recorded qualifying match activity for the
          configured period.
        </p>
        <ul>
          <li>Open Player Inactivity from the league tools</li>
          <li>Review the inactive-player preview before taking action</li>
          <li>Configure available inactivity-alert settings if authorized</li>
          <li>Use manual alert checks when appropriate</li>
        </ul>
        <p>
          Inactivity is an administrative aid; the league administrator should
          review a player's circumstances before removing or changing a roster.
        </p>
      </section>

      <hr />

      <section>
        <h2>1️⃣2️⃣ Notifications and Communications</h2>
        <p>
          Cric4All includes communication workflows used by features such as
          birthdays, kit responsibility and player-activity reminders.
        </p>
        <ul>
          <li>SMS and/or WhatsApp may be used by configured workflows</li>
          <li>Availability depends on league settings and the specific feature</li>
          <li>Recipient phone information and applicable opt-in/consent are required</li>
          <li>Users can use supported opt-out mechanisms for applicable messages</li>
        </ul>
      </section>

      <hr />

      <section>
        <h2>1️⃣3️⃣ Public Sharing, Explore and TV Mode</h2>
        <p>
          Public experiences are designed for spectators and are kept separate
          from private scorer and administrator controls.
        </p>
        <ul>
          <li>Share a live match spectator link when available</li>
          <li>Use public league pages for fixtures, results and cricket statistics</li>
          <li>Discover public competitions through Explore</li>
          <li>Use TV Mode for a larger live-score presentation</li>
          <li>Use Match Center after completed matches for post-match information</li>
        </ul>
      </section>

      <hr />

      <section>
        <h2>1️⃣4️⃣ League Resources</h2>
        <p>
          The Resources area can be used to keep useful league information and
          material accessible alongside the competition's operational tools.
          Availability and management controls depend on league permissions.
        </p>
      </section>

      <hr />

      <section>
        <h2>1️⃣5️⃣ Super Admin Features</h2>
        <ul>
          <li>System-level league, team and match oversight</li>
          <li>Administrative/system settings available to Super Admin</li>
          <li>Audit and operational information exposed by the Super Admin tools</li>
        </ul>
      </section>

      <hr />

      <section>
        <h2>1️⃣6️⃣ Typical Cric4All Workflow</h2>
        <pre>
{`Create League
   ↓
Create Teams and Players
   ↓
Configure Roles / League Tools
   ↓
Create Match
   ↓
Assign Match Responsibilities
   ↓
Start Live Scoring
   ↓
Share Spectator View
   ↓
Complete Match
   ↓
Review Match Center / Statistics
   ↓
Continue Season Management`}
        </pre>
      </section>

      <section className="help-related-guides">
        <h2>Related public guides</h2>
        <p>
          <Link href="/guides/cricket-scoring">Read the cricket scoring guide →</Link>
        </p>
        <p>
          <Link href="/guides/league-management">Read the league management guide →</Link>
        </p>
      </section>

      <br />
      <Link href="/dashboard">← Back to Dashboard</Link>
    </main>
  );
}
