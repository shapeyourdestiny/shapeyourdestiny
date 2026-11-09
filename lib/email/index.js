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
 * Send email when a note is shared with an instructor
 */
export async function sendSharedNoteEmail({ to, firstName, noteType }) {
  const inboxUrl = `${BASE_URL}/instructor/inbox`;

  const typeLabel = noteType === "review" ? "review" : "note";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 16px 0;">
      You have a new ${typeLabel} waiting for you in the Shape Your Destiny app.
    </p>
    ${emailButton("View in Inbox", inboxUrl)}
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #4A5170;">
      If you have any questions, reach out to the office.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "New Message",
    heading: `You have a new ${typeLabel} from Shape Your Destiny`,
    bodyHtml,
  });

  const text = buildEmailText({
    heading: `You have a new ${typeLabel} from Shape Your Destiny`,
    bodyText: `Hi ${firstName},

You have a new ${typeLabel} waiting for you in the Shape Your Destiny app.

View it here: ${inboxUrl}

If you have any questions, reach out to the office.`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: `You have a new ${typeLabel} from Shape Your Destiny`,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send shared note email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send an announcement email to instructors
 */
export async function sendAnnouncementEmail({ to, title, body: messageBody, senderName }) {
  const inboxUrl = `${BASE_URL}/instructor/inbox`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      ${messageBody.replace(/\n/g, "<br>")}
    </p>
    ${emailButton("View in Inbox", inboxUrl)}
  `;

  const html = buildEmailHTML({
    eyebrow: `From ${senderName}`,
    heading: title,
    bodyHtml,
  });

  const text = buildEmailText({
    heading: title,
    bodyText: `${messageBody}

View in inbox: ${inboxUrl}`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: title,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send announcement email:", error);
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

/**
 * Send payroll reminder email to configured recipients
 */
export async function sendPayrollReminderEmail({ to, periodRange, dueDate, payday, periodsCount, payrollUrl }) {
  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const daysUntilDue = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
  const urgencyLabel = daysUntilDue <= 1 ? "due tomorrow" : daysUntilDue <= 3 ? "due soon" : `due in ${daysUntilDue} days`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      ${periodsCount > 1 ? `There are <strong>${periodsCount} pay periods</strong> waiting for approval.` : `A pay period is waiting for approval.`}
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background: #EAF1FC; border-radius: 12px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 4px 0;">
                <span style="font-size: 12px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Period</span><br>
                <span style="color: #16193B; font-weight: 600;">${periodRange}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 4px 0;">
                <span style="font-size: 12px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Approval Deadline</span><br>
                <span style="color: #16193B; font-weight: 600;">${formatDate(dueDate)}</span>
                <span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: ${daysUntilDue <= 1 ? "#FDE8E6" : "#FEF3E2"}; color: ${daysUntilDue <= 1 ? "#E0594C" : "#E08A3C"}; font-size: 12px; font-weight: 600; border-radius: 4px;">
                  ${urgencyLabel}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 4px 0;">
                <span style="font-size: 12px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Payday</span><br>
                <span style="color: #16193B; font-weight: 600;">${formatDate(payday)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${emailButton("Review Payroll", payrollUrl)}
    <p style="margin: 24px 0 0 0; font-size: 13px; color: #8B93A8;">
      Approve payroll before the deadline to ensure instructors are paid on time.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "Payroll Reminder",
    heading: periodsCount > 1 ? `${periodsCount} periods need approval` : "Payroll needs approval",
    bodyHtml,
  });

  const text = buildEmailText({
    heading: periodsCount > 1 ? `${periodsCount} periods need approval` : "Payroll needs approval",
    bodyText: `${periodsCount > 1 ? `There are ${periodsCount} pay periods waiting for approval.` : "A pay period is waiting for approval."}

Period: ${periodRange}
Approval Deadline: ${formatDate(dueDate)} (${urgencyLabel})
Payday: ${formatDate(payday)}

Review payroll: ${payrollUrl}

Approve payroll before the deadline to ensure instructors are paid on time.`,
  });

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) {
    console.warn("No recipients for payroll reminder email");
    return { success: true, id: null };
  }

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: recipients,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: periodsCount > 1 ? `Payroll: ${periodsCount} periods need approval` : `Payroll needs approval - ${periodRange}`,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send payroll reminder email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send email to admins when a new application is submitted
 */
export async function sendNewApplicationEmail({ application, adminEmails }) {
  const { first_name, last_name, email, phone, resume_name } = application;
  const applicationUrl = `${BASE_URL}/admin/applications?id=${application.id}`;

  const resumeType = resume_name?.toLowerCase().endsWith(".pdf") ? "PDF" : "Word";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      ${first_name} applied on the Join Our Team page. Open it to see their resume and add notes.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background: #EAF1FC; border-radius: 12px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 4px 0;">
                <span style="font-size: 12px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Email</span><br>
                <a href="mailto:${email}" style="color: #1F3F91; text-decoration: none;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 4px 0;">
                <span style="font-size: 12px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Phone</span><br>
                <a href="tel:${phone}" style="color: #1F3F91; text-decoration: none;">${phone}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 4px 0;">
                <span style="font-size: 12px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">Resume</span><br>
                <span style="color: #16193B; font-weight: 600;">Yes (${resumeType})</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${emailButton("Open application", applicationUrl)}
    <p style="margin: 24px 0 0 0; font-size: 13px; color: #8B93A8;">
      You can reply to this email to write to ${first_name} directly.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "New Application",
    heading: `New application from ${first_name} ${last_name}`,
    bodyHtml,
  });

  const text = buildEmailText({
    heading: `New application from ${first_name} ${last_name}`,
    bodyText: `${first_name} applied on the Join Our Team page. Open it to see their resume and add notes.

Email: ${email}
Phone: ${phone}
Resume: Yes (${resumeType})

Open application: ${applicationUrl}

You can reply to this email to write to ${first_name} directly.`,
  });

  const recipients = Array.isArray(adminEmails) ? adminEmails.filter(Boolean) : [adminEmails].filter(Boolean);
  if (recipients.length === 0) {
    console.warn("No recipients for new application email");
    return { success: true, id: null };
  }

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: recipients,
    replyTo: email,
    subject: `New instructor application: ${first_name} ${last_name}`,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send new application email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send confirmation email to applicant
 */
export async function sendApplicationReceivedEmail({ application }) {
  const { first_name, email } = application;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hi ${first_name},
    </p>
    <p style="margin: 0 0 16px 0;">
      We got your application to teach with Shape Your Destiny. We'll be in touch.
    </p>
    <p style="margin: 24px 0 0 0; font-size: 13px; color: #8B93A8;">
      Questions? Just reply to this email.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "Application Received",
    heading: `Thanks for applying, ${first_name}!`,
    bodyHtml,
  });

  const text = buildEmailText({
    heading: `Thanks for applying, ${first_name}!`,
    bodyText: `Hi ${first_name},

We got your application to teach with Shape Your Destiny. We'll be in touch.

Questions? Just reply to this email.`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: "We got your application",
    html,
    text,
  });

  if (error) {
    console.error("Failed to send application received email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}

/**
 * Send email to substitute instructor when assigned to cover a class.
 * Groups multiple sessions into a single email.
 *
 * @param {Object} options
 * @param {Object} options.sub - The substitute instructor profile
 * @param {string} options.sub.email - Sub's email address
 * @param {string} options.sub.full_name - Sub's full name
 * @param {Object} options.absentInstructor - The instructor being covered
 * @param {string} options.absentInstructor.full_name - Absent instructor's full name
 * @param {Array} options.sessions - Array of session details
 * @param {string} options.sessions[].date - Session date (YYYY-MM-DD)
 * @param {string} options.sessions[].time - Session time
 * @param {string} options.sessions[].schoolName - School name
 * @param {string} options.sessions[].schoolAddress - School address (optional)
 * @param {string} options.sessions[].program - Program type (e.g., "Wellness", "Soccer")
 */
export async function sendSubAssignedEmail({ sub, absentInstructor, sessions }) {
  const firstName = sub.full_name?.split(" ")[0] || "there";
  const absentFirstName = absentInstructor.full_name?.split(" ")[0] || "an instructor";

  // Format dates for display
  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  // Build session list HTML
  const sessionListHtml = sessions
    .map((s) => {
      const dateStr = formatDate(s.date);
      const addressLine = s.schoolAddress
        ? `<br /><span style="color: #8B93A8; font-size: 14px;">${s.schoolAddress}</span>`
        : "";
      return `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #DCE8FB;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #16193B;">
              ${dateStr} at ${s.time}
            </p>
            <p style="margin: 0; color: #4A5170;">
              ${s.schoolName} &middot; ${s.program || "Wellness"}${addressLine}
            </p>
          </td>
        </tr>
      `;
    })
    .join("");

  // Build session list for plain text
  const sessionListText = sessions
    .map((s) => {
      const dateStr = formatDate(s.date);
      const addressLine = s.schoolAddress ? `\n   ${s.schoolAddress}` : "";
      return `- ${dateStr} at ${s.time}\n   ${s.schoolName} · ${s.program || "Wellness"}${addressLine}`;
    })
    .join("\n\n");

  const sessionsWord = sessions.length === 1 ? "class" : "classes";
  const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://shapeyourdestiny.co"}/instructor/dashboard`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 16px 0;">
      You've been assigned to cover ${sessions.length} ${sessionsWord} for ${absentFirstName}:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background: #F8FAFD; border-radius: 12px; overflow: hidden;">
      ${sessionListHtml}
    </table>
    <p style="margin: 16px 0 0 0;">
      Check your dashboard for the full schedule.
    </p>
    ${emailButton("View Your Schedule", dashboardUrl)}
    <p style="margin: 24px 0 0 0; font-size: 13px; color: #8B93A8;">
      Questions about this assignment? Reply to this email.
    </p>
  `;

  const html = buildEmailHTML({
    eyebrow: "Sub Assignment",
    heading: `You're covering for ${absentFirstName}`,
    bodyHtml,
  });

  const text = buildEmailText({
    heading: `You're covering for ${absentFirstName}`,
    bodyText: `Hi ${firstName},

You've been assigned to cover ${sessions.length} ${sessionsWord} for ${absentFirstName}:

${sessionListText}

Check your dashboard for the full schedule:
${dashboardUrl}

Questions about this assignment? Reply to this email.`,
  });

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: sub.email,
    replyTo: "destiny@shapeyourdestiny.co",
    subject: `You're covering ${sessions.length} ${sessionsWord} for ${absentFirstName}`,
    html,
    text,
  });

  if (error) {
    console.error("Failed to send sub assigned email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { success: true, id: data?.id };
}