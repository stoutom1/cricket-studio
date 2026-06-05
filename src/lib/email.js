import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY
);
export async function sendResetPasswordEmail(
  email,
  name,
  resetLink
)  {
  console.log("resetLink check in route", resetLink);
  console.log("name check in route", name);
  console.log("email check in route", email);
  
  await resend.emails.send({
    from:
      process.env.EMAIL_FROM,

    to: email,

    subject:
      "Reset your Cricket Studio password",

    html: `
      <h2>Hello ${name}</h2>

      <p>
        Click the link below to
        reset your password.
      </p>

      <a href="${resetLink}">
        Reset Password
      </a>

      <p>
        This link expires in
        30 minutes.
      </p>
    `
  });
}