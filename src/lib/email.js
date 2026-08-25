import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

export async function sendWelcomeEmail(
  email,
  name
) {
  const result =
    await resend.emails.send({
      from:
        process.env.EMAIL_FROM,

      to: email,

      subject:
        "Welcome to Cric4All 🏏",

html: `
<div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:40px 20px;">
  <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

    <div style="background:#0f172a;padding:30px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;">
        🏏 Cric4All
      </h1>

      <p style="color:#cbd5e1;margin-top:10px;">
        Score Matches. Manage Leagues. Share Cricket.
      </p>
    </div>

    <div style="padding:40px;">
      <h2 style="margin-top:0;color:#111827;">
        Welcome ${name}!
      </h2>

      <p style="color:#374151;font-size:16px;">
        Your Cric4All account has been created successfully.
      </p>

      <p style="color:#374151;">
        You can now:
      </p>

      <ul style="line-height:30px;color:#111827;">
        <li>🏆 Create leagues and tournaments</li>
        <li>👥 Manage teams and players</li>
        <li>🏏 Score matches live</li>
        <li>📊 Track player statistics</li>
        <li>📱 Share live scorecards</li>
        <li>🔐 Manage league permissions</li>
      </ul>

      <div style="text-align:center;margin:40px 0;">
        <a
          href="https://cric4all.app"
          style="
            background:#16a34a;
            color:white;
            padding:14px 28px;
            text-decoration:none;
            border-radius:8px;
            font-weight:bold;
          "
        >
          Open Cric4All
        </a>
      </div>

      <div style="
        background:#f8fafc;
        border-left:4px solid #16a34a;
        padding:16px;
        border-radius:8px;
      ">
        <strong>Security Notice</strong><br/>
        Your account is protected by encrypted authentication.
        Never share your password with anyone.
      </div>

      <p style="margin-top:30px;color:#6b7280;">
        Thank you for joining the Cric4All community.
      </p>

      <p style="color:#111827;">
        The Cric4All Team
      </p>
    </div>

    <div style="
      background:#f8fafc;
      padding:20px;
      text-align:center;
      color:#6b7280;
      font-size:13px;
    ">
      © 2026 Cric4All<br/>
      https://cric4all.app
    </div>

  </div>
</div>
`
    });


}

export async function sendResetPasswordEmail(
  email,
  name,
  resetLink
) {
  const result =
    await resend.emails.send({
      from:
        process.env.EMAIL_FROM,

      to: email,

      subject:
        "Reset your Cric4All password",

html: `
<div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:40px 20px;">
  <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

    <div style="background:#0f172a;padding:30px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;">
        🔒 Cric4All Security
      </h1>
    </div>

    <div style="padding:40px;">
      <h2 style="margin-top:0;">
        Hello ${name},
      </h2>

      <p style="font-size:16px;color:#374151;">
        We received a request to reset your Cric4All password.
      </p>

      <p style="color:#374151;">
        Click the secure button below to create a new password.
      </p>

      <div style="text-align:center;margin:40px 0;">
        <a
          href="${resetLink}"
          style="
            background:#dc2626;
            color:white;
            padding:14px 28px;
            text-decoration:none;
            border-radius:8px;
            font-weight:bold;
          "
        >
          Reset Password
        </a>
      </div>

      <div style="
        background:#fef2f2;
        border-left:4px solid #dc2626;
        padding:16px;
        border-radius:8px;
        color:#7f1d1d;
      ">
        This link expires automatically for your security.
      </div>

      <p style="margin-top:30px;color:#374151;">
        If you did not request this password reset, you can safely ignore this email.
      </p>

      <p style="color:#374151;">
        No changes will be made to your account unless you click the button above.
      </p>

      <p style="margin-top:30px;">
        Cric4All Security Team
      </p>
    </div>

    <div style="
      background:#f8fafc;
      padding:20px;
      text-align:center;
      color:#6b7280;
      font-size:13px;
    ">
      © 2026 Cric4All<br/>
      https://cric4all.app
    </div>

  </div>
</div>
`
    });


}
export async function sendEmailVerificationEmail(
  email,
  name,
  verificationLink,
  {
    leagueName = null,
    roleLabel = null,
  } = {}
) {
  const safeName = String(name || "there")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const inviteContext =
    leagueName
      ? `
        <div style="margin:20px 0;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;color:#1e3a8a;">
          <strong>League invitation preserved</strong><br/>
          ${String(leagueName).replace(/</g, "&lt;").replace(/>/g, "&gt;")}${
            roleLabel
              ? ` · ${String(roleLabel).replace(/</g, "&lt;").replace(/>/g, "&gt;")}`
              : ""
          }
          <br/><span style="font-size:13px;">Your invitation will be applied automatically after your email is verified, as long as the invitation is still valid.</span>
        </div>
      `
      : "";

  return resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify your Cric4All email address 🏏",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:40px 20px;">
        <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#0f172a;padding:30px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;">🏏 Cric4All</h1>
            <p style="color:#cbd5e1;margin:10px 0 0;">Verify your account to continue</p>
          </div>

          <div style="padding:36px;">
            <h2 style="margin-top:0;color:#111827;">Hi ${safeName},</h2>

            <p style="color:#374151;font-size:16px;line-height:1.6;">
              Please verify that you own this email address to finish creating your Cric4All account.
            </p>

            ${inviteContext}

            <div style="text-align:center;margin:34px 0;">
              <a
                href="${verificationLink}"
                style="display:inline-block;background:#16a34a;color:white;padding:14px 26px;text-decoration:none;border-radius:9px;font-weight:bold;"
              >
                Verify my Cric4All account
              </a>
            </div>

            <div style="background:#f8fafc;border-left:4px solid #0ea5e9;padding:15px;border-radius:8px;color:#334155;line-height:1.5;">
              This verification link expires in 24 hours. If you did not create a Cric4All account, you can safely ignore this email.
            </div>

            <p style="margin-top:28px;color:#64748b;font-size:13px;line-height:1.6;">
              For your security, Cric4All never asks you to send your password by email.
            </p>
          </div>

          <div style="background:#f8fafc;padding:18px;text-align:center;color:#6b7280;font-size:13px;">
            © 2026 Cric4All · cric4all.app
          </div>
        </div>
      </div>
    `,
  });
}
