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
 * Send confirmation email to contact form submitter
 */
/**
 * Send notification when someone claims a coverage request
 */
export async function sendCoverageClaimNotification({
  to,
  requesterName,
  claimerName,
  schoolName,
  date,
  time,
}) {
  const dashboardUrl = `${BASE_URL}/instructor/dashboard`;
  const firstName = requesterName.split(" ")[0];

  // Format the date nicely
  const dateObj = new Date(date + "T00:00:00");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const formattedDate = `${days[dateObj.getDay()]}, ${months[dateObj.getMonth()]} ${dateObj.getDate()}`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 16px 0;">
      Great news! <strong>${claimerName}</strong> has agreed to cover your session.
    </p>
    ${emailInfoBox("Session Details", `
      <strong>${schoolName}</strong><br>
      ${formattedDate} at ${time}
    `)}
    <p style="margin: 16px 0;">
      You're all set for this date. The session will now appear on ${claimerName.split(" ")[0]}'s schedule instead of yours.
    </p>
    ${emailButton("View Your Schedule", dashboardUrl)}
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #4A5170;">
      If you have any questions, please reach out to ${claimerName.split(" ")[0]} directly or contact your administrator.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "Coverage Confirmed",
    heading: "Your session is covered",
    bodyHtml,
  });

  const text = buildEmailText({
    heading: "Your session is covered",
    bodyText: `Hi ${firstName},

Great news! ${claimerName} has agreed to cover your session.

Session Details:
${schoolName}
${formattedDate} at ${time}

You're all set for this date. The session will now appear on ${claimerName.split(" ")[0]}'s schedule instead of yours.

View your schedule: ${dashboardUrl}

If you have any questions, please reach out to ${claimerName.split(" ")[0]} directly or contact your administrator.`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: `Coverage confirmed: ${claimerName} is covering your ${formattedDate} session`,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send coverage claim notification:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send notification to admins when a new coverage request is posted
 */
export async function sendCoverageRequestNotification({
  requesterName,
  schoolName,
  date,
  time,
  adminEmails,
}) {
  const coverageUrl = `${BASE_URL}/admin/coverage`;

  // Format the date nicely
  const dateObj = new Date(date + "T00:00:00");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const formattedDate = `${days[dateObj.getDay()]}, ${months[dateObj.getMonth()]} ${dateObj.getDate()}`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      <strong>${requesterName}</strong> has requested coverage for an upcoming session.
    </p>
    ${emailInfoBox("Session Details", `
      <strong>${schoolName}</strong><br>
      ${formattedDate} at ${time}
    `)}
    <p style="margin: 16px 0;">
      The request is now visible on the Coverage Board for other instructors to pick up.
    </p>
    ${emailButton("View Coverage Board", coverageUrl)}
  `;

  const html = buildEmailHTML({
    eyebrow: "Coverage Request",
    heading: "New coverage request posted",
    bodyHtml,
  });

  const text = buildEmailText({
    heading: "New coverage request posted",
    bodyText: `${requesterName} has requested coverage for an upcoming session.

Session Details:
${schoolName}
${formattedDate} at ${time}

The request is now visible on the Coverage Board for other instructors to pick up.

View Coverage Board: ${coverageUrl}`,
  });

  // Send to all admin emails
  const recipients = adminEmails.filter(Boolean);
  if (recipients.length === 0) {
    console.warn("No admin emails provided for coverage request notification");
    return { success: true, id: null };
  }

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: recipients,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: `Coverage needed: ${requesterName} - ${formattedDate}`,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send coverage request notification:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send notification to admins when a coverage request is claimed
 */
export async function sendCoverageClaimAdminNotification({
  requesterName,
  claimerName,
  schoolName,
  date,
  time,
  adminEmails,
}) {
  const coverageUrl = `${BASE_URL}/admin/coverage`;

  // Format the date nicely
  const dateObj = new Date(date + "T00:00:00");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const formattedDate = `${days[dateObj.getDay()]}, ${months[dateObj.getMonth()]} ${dateObj.getDate()}`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      <strong>${claimerName}</strong> has picked up coverage for a session originally assigned to <strong>${requesterName}</strong>.
    </p>
    ${emailInfoBox("Session Details", `
      <strong>${schoolName}</strong><br>
      ${formattedDate} at ${time}
    `)}
    <p style="margin: 16px 0; color: #4FA347;">
      <strong>This coverage request is now resolved.</strong>
    </p>
    ${emailButton("View Coverage Board", coverageUrl)}
  `;

  const html = buildEmailHTML({
    eyebrow: "Coverage Filled",
    heading: "Coverage request picked up",
    bodyHtml,
  });

  const text = buildEmailText({
    heading: "Coverage request picked up",
    bodyText: `${claimerName} has picked up coverage for a session originally assigned to ${requesterName}.

Session Details:
${schoolName}
${formattedDate} at ${time}

This coverage request is now resolved.

View Coverage Board: ${coverageUrl}`,
  });

  // Send to all admin emails
  const recipients = adminEmails.filter(Boolean);
  if (recipients.length === 0) {
    console.warn("No admin emails provided for coverage claim admin notification");
    return { success: true, id: null };
  }

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: recipients,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: `Coverage filled: ${claimerName} covering for ${requesterName} - ${formattedDate}`,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send coverage claim admin notification:", error);
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
