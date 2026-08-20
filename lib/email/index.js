import { Resend } from "resend";
import { buildEmailHTML, emailButton, emailInfoBox } from "./template";

const resend = new Resend(process.env.RESEND_API_KEY);

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shapeyourdestiny.co";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Shape Your Destiny <onboarding@resend.dev>";

/**
 * Send an invite email to a new instructor/admin
 */
export async function sendInviteEmail({ to, code, role }) {
  const registerUrl = `${BASE_URL}/instructor-login/register?code=${encodeURIComponent(code)}`;

  const roleBadgeColor = role === "admin" ? "#D8AE4B" : "#3E8FA0";
  const roleBadgeBg = role === "admin" ? "rgba(216, 174, 75, 0.15)" : "rgba(62, 143, 160, 0.15)";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      You've been invited to join Shape Your Destiny as an
      <span style="display: inline-block; padding: 4px 12px; background: ${roleBadgeBg}; color: ${roleBadgeColor}; font-weight: 700; font-size: 12px; border-radius: 999px; text-transform: capitalize;">
        ${role}
      </span>
    </p>
    <p style="margin: 0 0 8px 0;">
      Click the button below to create your account and get started.
    </p>
    ${emailButton("Create Your Account", registerUrl)}
    <p style="margin: 24px 0 8px 0; font-size: 14px; color: #4A5170;">
      Or enter this code manually at registration:
    </p>
    ${emailInfoBox("Your Invite Code", code)}
  `;

  const html = buildEmailHTML({
    eyebrow: "Instructor Portal",
    heading: "You're invited to join the team",
    bodyHtml,
  });

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `You're invited to join Shape Your Destiny as an ${role}`,
    html,
  });

  if (error) {
    console.error("Failed to send invite email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send internal notification for contact form submission
 */
export async function sendContactNotification({ name, email, phone, org, message, reason, reasonLabel }) {
  const bodyHtml = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #EAF1FC;">
          <strong style="color: #4A5170; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Name</strong><br>
          <span style="color: #16193B;">${name}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #EAF1FC;">
          <strong style="color: #4A5170; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Email</strong><br>
          <a href="mailto:${email}" style="color: #1F3F91;">${email}</a>
        </td>
      </tr>
      ${phone ? `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #EAF1FC;">
          <strong style="color: #4A5170; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Phone</strong><br>
          <a href="tel:${phone}" style="color: #1F3F91;">${phone}</a>
        </td>
      </tr>
      ` : ''}
      ${org ? `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #EAF1FC;">
          <strong style="color: #4A5170; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Organization</strong><br>
          <span style="color: #16193B;">${org}</span>
        </td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 16px 0 0 0;">
          <strong style="color: #4A5170; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Message</strong><br>
          <p style="margin: 8px 0 0 0; color: #16193B; white-space: pre-wrap;">${message}</p>
        </td>
      </tr>
    </table>
  `;

  const html = buildEmailHTML({
    eyebrow: "New Inquiry",
    heading: reasonLabel || "New contact form submission",
    bodyHtml,
  });

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ["destiny@shapeyourdestiny.co", "heather@shapeyourdestiny.co"],
    replyTo: email,
    subject: `New inquiry from ${name}: ${reasonLabel || reason}`,
    html,
  });

  if (error) {
    console.error("Failed to send contact notification:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send confirmation email to contact form submitter
 */
export async function sendContactConfirmation({ name, email, message, reasonLabel }) {
  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hi ${name.split(' ')[0]},
    </p>
    <p style="margin: 0 0 16px 0;">
      Thanks for reaching out! We've received your message and wanted to confirm it came through.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background: #F8FAFD; border-radius: 12px; padding: 16px 20px;">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">
            Your inquiry about
          </p>
          <p style="margin: 0 0 12px 0; font-weight: 600; color: #16193B;">
            ${reasonLabel}
          </p>
          <p style="margin: 0; font-size: 14px; color: #4A5170; font-style: italic;">
            "${message.length > 150 ? message.substring(0, 150) + '...' : message}"
          </p>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 16px 0;">
      We'll get back to you within 24-48 hours on business days.
    </p>
    <p style="margin: 0; color: #4A5170; font-size: 14px;">
      In the meantime, if you have any urgent questions, feel free to reach us directly at <a href="mailto:destiny@shapeyourdestiny.co" style="color: #1F3F91;">destiny@shapeyourdestiny.co</a>.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "Thanks For Reaching Out",
    heading: "We got your message",
    bodyHtml,
  });

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "We received your message - Shape Your Destiny",
    html,
  });

  if (error) {
    console.error("Failed to send contact confirmation:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}
