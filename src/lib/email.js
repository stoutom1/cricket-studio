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
        "Welcome to Cricket Studio 🏏",

      html: `
        <h2>Welcome ${name}!</h2>

        <p>
          Your Cricket Studio account
          has been created successfully.
        </p>

        <p>
          You can now:
        </p>

        <ul>
          <li>Create leagues</li>
          <li>Manage teams</li>
          <li>Score matches live</li>
          <li>Track player statistics</li>
        </ul>

        <p>
          Happy scoring!
        </p>

        <p>
          Cricket Studio Team
        </p>
      `
    });

  console.log(
    "WELCOME EMAIL:",
    result
  );
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
        "Reset your Cricket Studio password",

      html: `
        <h2>Hello ${name}</h2>

        <p>
          Click below to reset your password.
        </p>

        <a href="${resetLink}">
          Reset Password
        </a>
      `
    });

  console.log(
    "RESET EMAIL:",
    result
  );
}