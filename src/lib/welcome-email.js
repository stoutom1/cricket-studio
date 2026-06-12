import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendWelcomeEmail({ to, name, leagues = [] }) {
  const firstName = name || "there";

  const leagueText =
    leagues.length > 0
      ? `
You have already been added to the following league(s):

${leagues.map((league) => `• ${league.name}`).join("\n")}
`
      : `
You are not assigned to any league yet.

If you were invited to a league, please accept the invitation link or contact your league admin.
`;

  const text = `
Hi ${firstName},

Welcome to Cric4All! 🏏

Your account has been successfully created.

${leagueText}

You can log in here:
https://cric4all.app/login

With Cric4All, you can:
• Score matches ball-by-ball
• View live scorecards
• Track batting and bowling stats
• Manage leagues, teams, and players
• Share live scores with spectators

Thank you for joining Cric4All.

Play. Score. Connect.

The Cric4All Team
https://cric4all.app
`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2>Welcome to Cric4All! 🏏</h2>

      <p>Hi ${firstName},</p>

      <p>Your account has been successfully created.</p>

      ${
        leagues.length > 0
          ? `
            <p>You have already been added to the following league(s):</p>
            <ul>
              ${leagues.map((league) => `<li>${league.name}</li>`).join("")}
            </ul>
          `
          : `
            <p>You are not assigned to any league yet.</p>
            <p>If you were invited to a league, please accept the invitation link or contact your league admin.</p>
          `
      }

      <p>
        <a href="https://cric4all.app/login" style="background:#0f172a;color:white;padding:10px 16px;text-decoration:none;border-radius:6px">
          Log in to Cric4All
        </a>
      </p>

      <p>With Cric4All, you can score matches, manage teams, view live scorecards, and track cricket stats.</p>

      <p>Play. Score. Connect.</p>

      <p>The Cric4All Team<br />https://cric4all.app</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Welcome to Cric4All – You're Ready to Play!",
    text,
    html,
  });
}