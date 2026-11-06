import { Resend } from "resend";
import { buildEmailHTML, buildEmailText, emailButton, emailInfoBox } from "./template";

// Lazy-initialize Resend client to avoid build-time errors
let resendClient = null;
function getResend() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shapeyourdestiny.co";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Shape Your Destiny <destiny@shapeyourdestiny.co>";

/**
 * Send an invite email to a pre-added instructor (profile already exists)
 * Different from sendInviteEmail - this is for the "add before sign-up" flow
 */
export async function sendProfileInviteEmail({ to, code, fullName }) {
  const registerUrl = `${BASE_URL}/instructor-login/register?code=${encodeURIComponent(code)}`;
  const firstName = fullName.split(" ")[0];

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 16px 0;">
      You've been added to the Shape Your Destiny team! Your staff profile is already live on our website.
    </p>
    <p style="margin: 0 0 8px 0;">
      Click the button below to create your account and access the instructor portal.
    </p>
    ${emailButton("Create Your Account", registerUrl)}
    <p style="margin: 24px 0 8px 0; font-size: 14px; color: #4A5170;">
      Or enter this code manually at registration:
    </p>
    ${emailInfoBox("Your Invite Code", code)}
    <p style="margin: 24px 0 0 0; font-size: 13px; color: #8B93A8;">
      This invite expires in 30 days. If you have any questions, reply to this email.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "Welcome to the Team",
    heading: "Your profile is ready",
    bodyHtml,
  });

  const text = buildEmailText({
    heading: "Your profile is ready",
    bodyText: `Hi ${firstName},

You've been added to the Shape Your Destiny team! Your staff profile is already live on our website.

Create your account here:
${registerUrl}

Or enter this code manually at registration:
${code}

This invite expires in 30 days. If you have any questions, reply to this email.`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: `${firstName}, your Shape Your Destiny profile is ready`,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send profile invite email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

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

  const text = buildEmailText({
    heading: "You're invited to join the team",
    bodyText: `You've been invited to join Shape Your Destiny as an ${role}.

Create your account here:
${registerUrl}

Or enter this code manually at registration:
${code}`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: `You're invited to join Shape Your Destiny as an ${role}`,
    html,
    text,
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

  const textParts = [
    `Name: ${name}`,
    `Email: ${email}`,
  ];
  if (phone) textParts.push(`Phone: ${phone}`);
  if (org) textParts.push(`Organization: ${org}`);
  textParts.push("", `Message:`, message);

  const text = buildEmailText({
    heading: reasonLabel || "New contact form submission",
    bodyText: textParts.join("\n"),
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: ["destiny@shapeyourdestiny.co", "heather@shapeyourdestiny.co"],
    replyTo: email,
    subject: `New inquiry from ${name}: ${reasonLabel || reason}`,
    html,
    text,
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
/**
 * Send welcome email when an account is created manually by admin
 */
export async function sendWelcomeEmail({ to, fullName, role }) {
  const loginUrl = `${BASE_URL}/instructor-login`;
  const firstName = fullName.split(' ')[0];

  const roleBadgeColor = role === "admin" ? "#D8AE4B" : "#3E8FA0";
  const roleBadgeBg = role === "admin" ? "rgba(216, 174, 75, 0.15)" : "rgba(62, 143, 160, 0.15)";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 16px 0;">
      Your account has been created for the Shape Your Destiny instructor portal as an
      <span style="display: inline-block; padding: 4px 12px; background: ${roleBadgeBg}; color: ${roleBadgeColor}; font-weight: 700; font-size: 12px; border-radius: 999px; text-transform: capitalize;">
        ${role}
      </span>
    </p>
    <p style="margin: 0 0 8px 0;">
      You can now log in using your email address and the password provided to you by your administrator.
    </p>
    ${emailButton("Log In to Your Account", loginUrl)}
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #4A5170;">
      If you didn't expect this email or have questions, please contact your administrator.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "Welcome to the Team",
    heading: "Your account is ready",
    bodyHtml,
  });

  const text = buildEmailText({
    heading: "Your account is ready",
    bodyText: `Hi ${firstName},

Your account has been created for the Shape Your Destiny instructor portal as an ${role}.

You can now log in using your email address and the password provided to you by your administrator.

Log in here: ${loginUrl}

If you didn't expect this email or have questions, please contact your administrator.`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: "Your Shape Your Destiny account is ready",
    html,
    text,
  });

  if (error) {
    console.error("Failed to send welcome email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send notification to admins when an incident report is submitted
 */
export async function sendIncidentReportNotification({
  severity,
  type,
  occurredAt,
  schoolName,
  submitterName,
  firstAidAdministered,
  staffNotified,
  staffNotifiedName,
  parentNotified,
  whatHappened,
  actionsTaken,
  adminEmails,
}) {
  const incidentUrl = `${BASE_URL}/admin/incident-reports`;

  // Format the date/time
  const dateObj = new Date(occurredAt);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const formattedDate = `${days[dateObj.getDay()]}, ${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
  const formattedTime = dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Build severity badge
  const severityColors = {
    minor: { bg: "rgba(62, 143, 160, 0.15)", text: "#2C6E7D" },
    moderate: { bg: "rgba(242, 166, 94, 0.15)", text: "#E08A3C" },
    serious: { bg: "rgba(224, 89, 76, 0.15)", text: "#E0594C" },
  };
  const sevColor = severityColors[severity] || severityColors.minor;

  // Format staff notified with name if provided
  let staffNotifiedDisplay = staffNotified ? "Yes" : "No";
  if (staffNotified && staffNotifiedName) {
    staffNotifiedDisplay = `Yes, ${staffNotifiedName}`;
  }

  // Format parent notified
  const parentNotifiedDisplay = parentNotified === "yes" ? "Yes" : parentNotified === "no" ? "No" : "N/A";

  // Build info table
  const infoTableHtml = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background: #EAF1FC; border-radius: 12px;">
      <tr>
        <td style="padding: 16px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 4px 0; width: 50%; vertical-align: top;">
                <span style="font-size: 11px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Severity</span><br>
                <span style="display: inline-block; margin-top: 4px; padding: 3px 10px; background: ${sevColor.bg}; color: ${sevColor.text}; font-weight: 700; font-size: 12px; border-radius: 999px; text-transform: capitalize;">
                  ${severity}
                </span>
              </td>
              <td style="padding: 4px 0; width: 50%; vertical-align: top;">
                <span style="font-size: 11px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Type</span><br>
                <span style="color: #16193B; font-weight: 600;">${type}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 4px 0; vertical-align: top;">
                <span style="font-size: 11px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Date & Time</span><br>
                <span style="color: #16193B;">${formattedDate} at ${formattedTime}</span>
              </td>
              <td style="padding: 12px 0 4px 0; vertical-align: top;">
                <span style="font-size: 11px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">School</span><br>
                <span style="color: #16193B;">${schoolName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 4px 0; vertical-align: top;">
                <span style="font-size: 11px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Filed By</span><br>
                <span style="color: #16193B;">${submitterName}</span>
              </td>
              <td style="padding: 12px 0 4px 0; vertical-align: top;">
                <span style="font-size: 11px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">First Aid Administered</span><br>
                <span style="color: #16193B;">${firstAidAdministered ? "Yes" : "No"}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 4px 0; vertical-align: top;">
                <span style="font-size: 11px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Staff Notified</span><br>
                <span style="color: #16193B;">${staffNotifiedDisplay}</span>
              </td>
              <td style="padding: 12px 0 4px 0; vertical-align: top;">
                <span style="font-size: 11px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Parent/Guardian Notified</span><br>
                <span style="color: #16193B;">${parentNotifiedDisplay}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const bodyHtml = `
    ${infoTableHtml}
    <div style="margin: 24px 0;">
      <p style="margin: 0 0 8px 0; font-size: 11px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">
        What Happened
      </p>
      <p style="margin: 0; color: #16193B; white-space: pre-wrap; line-height: 1.6;">
        ${whatHappened}
      </p>
    </div>
    <div style="margin: 24px 0;">
      <p style="margin: 0 0 8px 0; font-size: 11px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">
        Actions Taken
      </p>
      <p style="margin: 0; color: #16193B; white-space: pre-wrap; line-height: 1.6;">
        ${actionsTaken}
      </p>
    </div>
    ${emailButton("Review Incident Report", incidentUrl)}
  `;

  // Subject line differs based on severity
  const isSerious = severity === "serious";
  const subject = isSerious
    ? `Urgent: Serious Incident Reported — ${schoolName}`
    : `Incident Reported — ${schoolName}`;
  const heading = isSerious
    ? "Serious Incident Reported"
    : "Incident Reported";

  const html = buildEmailHTML({
    eyebrow: "Incident Report",
    heading,
    bodyHtml,
  });

  const text = buildEmailText({
    heading,
    bodyText: `Severity: ${severity}
Type: ${type}
Date & Time: ${formattedDate} at ${formattedTime}
School: ${schoolName}
Filed By: ${submitterName}
First Aid Administered: ${firstAidAdministered ? "Yes" : "No"}
Staff Notified: ${staffNotifiedDisplay}
Parent/Guardian Notified: ${parentNotifiedDisplay}

WHAT HAPPENED
${whatHappened}

ACTIONS TAKEN
${actionsTaken}

Review this report: ${incidentUrl}`,
  });

  const recipients = adminEmails.filter(Boolean);
  if (recipients.length === 0) {
    console.warn("No admin emails provided for incident report notification");
    return { success: true, id: null };
  }

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: recipients,
    replyTo: "destiny@shapeyourdestiny.co",
    subject,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send incident report notification:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({ to, resetLink }) {
  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      We received a request to reset your password for your Shape Your Destiny instructor account.
    </p>
    <p style="margin: 0 0 8px 0;">
      Click the button below to create a new password:
    </p>
    ${emailButton("Reset Password", resetLink)}
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #4A5170;">
      This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "Password Recovery",
    heading: "Reset your password",
    bodyHtml,
  });

  const text = buildEmailText({
    heading: "Reset your password",
    bodyText: `We received a request to reset your password for your Shape Your Destiny instructor account.

Click the link below to create a new password:
${resetLink}

This link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: "Reset your password - Shape Your Destiny",
    html,
    text,
  });

  if (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send notification email to substitute instructor about their assignment
 * @param {Object} sub - The substitute instructor profile
 * @param {Array} sessions - Array of session objects they're covering
 */
export async function sendSubAssignedEmail({ sub, sessions }) {
  if (!sub?.email || !sessions?.length) {
    console.warn("Missing sub email or sessions for sub assignment notification");
    return { success: false, error: "Missing required data" };
  }

  const dashboardUrl = `${BASE_URL}/instructor`;
  const firstName = sub.full_name?.split(" ")[0] || "there";

  // Format sessions for display
  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  // Build session cards HTML
  const sessionCardsHtml = sessions.map((session) => `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 12px 0; background: #EAF1FC; border-radius: 10px; border-left: 4px solid #3E8FA0;">
      <tr>
        <td style="padding: 14px 16px;">
          <p style="margin: 0 0 4px 0; font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 15px; color: #16193B;">
            ${formatDate(session.date)} at ${session.time}
          </p>
          <p style="margin: 0 0 4px 0; font-size: 14px; color: #16193B;">
            ${session.schoolName}
          </p>
          ${session.address ? `
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #4A5170;">
            ${session.address}
          </p>
          ` : ""}
          ${session.coInstructor ? `
          <p style="margin: 8px 0 0 0; font-size: 13px; color: #4A5170;">
            Co-teaching with ${session.coInstructor}
          </p>
          ` : ""}
        </td>
      </tr>
    </table>
  `).join("");

  // Subject line varies based on number of sessions
  const sessionCount = sessions.length;
  const subject = sessionCount === 1
    ? `You're covering a class on ${formatDate(sessions[0].date)}`
    : `You're covering ${sessionCount} classes`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 16px 0;">
      You've been assigned to cover ${sessionCount === 1 ? "a class" : `${sessionCount} classes`}.
      Here are the details:
    </p>
    ${sessionCardsHtml}
    <p style="margin: 20px 0 8px 0;">
      View your full schedule in the instructor portal:
    </p>
    ${emailButton("Go to My Schedule", dashboardUrl)}
    <p style="margin: 24px 0 0 0; font-size: 13px; color: #8B93A8;">
      If you have any questions, please reach out to your coordinator.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "Class Coverage",
    heading: subject,
    bodyHtml,
  });

  // Plain text version
  const sessionsText = sessions.map((session) =>
    `${formatDate(session.date)} at ${session.time}\n${session.schoolName}${session.address ? `\n${session.address}` : ""}${session.coInstructor ? `\nCo-teaching with ${session.coInstructor}` : ""}`
  ).join("\n\n");

  const text = buildEmailText({
    heading: subject,
    bodyText: `Hi ${firstName},

You've been assigned to cover ${sessionCount === 1 ? "a class" : `${sessionCount} classes`}. Here are the details:

${sessionsText}

View your full schedule: ${dashboardUrl}

If you have any questions, please reach out to your coordinator.`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: sub.email,
    replyTo: "destiny@shapeyourdestiny.co",
    subject,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send sub assignment email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

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

  const messagePreview = message.length > 150 ? message.substring(0, 150) + "..." : message;

  const text = buildEmailText({
    heading: "We got your message",
    bodyText: `Hi ${name.split(" ")[0]},

Thanks for reaching out! We've received your message and wanted to confirm it came through.

Your inquiry about: ${reasonLabel}
"${messagePreview}"

We'll get back to you within 24-48 hours on business days.

In the meantime, if you have any urgent questions, feel free to reach us directly at destiny@shapeyourdestiny.co.`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: "We received your message - Shape Your Destiny",
    html,
    text,
  });

  if (error) {
    console.error("Failed to send contact confirmation:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}
