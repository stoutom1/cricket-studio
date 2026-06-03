import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="page-container">
      <h1>📖 Cricket Studio Help Guide</h1>

      <p>
        Follow these steps to manage leagues,
        teams, matches and live scoring.
      </p>

      <hr />

      <section>
        <h2>1️⃣ Create a League</h2>

        <p>
          A league is the top-level container
          for everything else.
        </p>

        <ol>
          <li>Go to Dashboard</li>
          <li>Open Leagues tab</li>
          <li>Click Create League</li>
          <li>Enter a league name</li>
          <li>Save</li>
        </ol>

        <p>
          The newly created league becomes your
          Active League automatically.
        </p>
      </section>

      <hr />

      <section>
        <h2>2️⃣ Create Teams</h2>

        <ol>
          <li>Select your Active League</li>
          <li>Open Teams tab</li>
          <li>Click Create Team</li>
          <li>Enter team name</li>
          <li>Save</li>
        </ol>

        <p>
          Teams belong to the Active League.
        </p>
      </section>

      <hr />

      <section>
        <h2>3️⃣ Add Players</h2>

        <ol>
          <li>Open Players tab</li>
          <li>Select Team</li>
          <li>Click Add Player</li>
          <li>Enter player details</li>
          <li>Save</li>
        </ol>

        <p>
          A team must have players before a
          match can be created.
        </p>
      </section>

      <hr />

      <section>
        <h2>4️⃣ Create a Match</h2>

        <ol>
          <li>Open Matches tab</li>
          <li>Click Create Match</li>
          <li>Select Team A</li>
          <li>Select Team B</li>
          <li>Select Batting First Team</li>
          <li>Enter Overs Per Innings</li>
          <li>Save</li>
        </ol>

        <p>
          Only teams from the Active League can
          be selected.
        </p>
      </section>

      <hr />

      <section>
        <h2>5️⃣ Live Scoring</h2>

        <ol>
          <li>Open Scoring tab</li>
          <li>Select Match</li>
          <li>Select Striker</li>
          <li>Select Non-Striker</li>
          <li>Select Bowler</li>
          <li>Start Scoring</li>
        </ol>

        <h3>Available Actions</h3>

        <ul>
          <li>Runs (0–6)</li>
          <li>Wide</li>
          <li>No Ball</li>
          <li>Bye</li>
          <li>Leg Bye</li>
          <li>Wicket</li>
          <li>Undo Ball</li>
          <li>Swap Strike</li>
          <li>Retire Batter</li>
        </ul>
      </section>

      <hr />

      <section>
        <h2>6️⃣ League Permissions</h2>

        <ol>
          <li>Open Permissions tab</li>
          <li>Select Active League</li>
          <li>Choose a member</li>
          <li>Select Role</li>
          <li>Edit permissions</li>
          <li>Save</li>
        </ol>

        <h3>Available Roles</h3>

        <ul>
          <li>OWNER</li>
          <li>ADMIN</li>
          <li>CAPTAIN</li>
          <li>SCORER</li>
          <li>ANALYST</li>
          <li>VIEWER</li>
        </ul>

        <p>
          Owners can manage all permissions.
        </p>
      </section>

      <hr />

      <section>
        <h2>7️⃣ Invite Users</h2>

        <ol>
          <li>Open League Management</li>
          <li>Create Invite Link</li>
          <li>Copy Link</li>
          <li>Send to user</li>
        </ol>

        <p>
          New users can register and
          automatically join the league.
        </p>
      </section>

      <hr />

      <section>
        <h2>8️⃣ Statistics</h2>

        <ul>
          <li>Batting Statistics</li>
          <li>Bowling Statistics</li>
          <li>Partnership Statistics</li>
          <li>Leaderboards</li>
          <li>Match Summaries</li>
        </ul>
      </section>

      <hr />

      <section>
        <h2>9️⃣ Super Admin Features</h2>

        <ul>
          <li>View all leagues</li>
          <li>View all teams</li>
          <li>View all matches</li>
          <li>Manage system settings</li>
          <li>Audit logs</li>
        </ul>
      </section>

      <hr />

      <section>
        <h2>🔟 Typical Workflow</h2>

        <pre>
{`Create League
   ↓
Create Teams
   ↓
Add Players
   ↓
Create Match
   ↓
Start Live Scoring
   ↓
View Statistics
   ↓
Manage Permissions`}
        </pre>
      </section>

      <br />

      <Link href="/dashboard">
        ← Back to Dashboard
      </Link>
    </div>
  );
}