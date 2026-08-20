/**
 * Shared Email Template System
 * ============================
 * All emails sent by this app should use buildEmailHTML() for consistency.
 * Do not write inline HTML in API routes - use this template instead.
 *
 * NOTE: NEXT_PUBLIC_SITE_URL must be set to the production domain (e.g., https://shapeyourdestiny.co)
 * for the logo image to load in email clients. Email requires full public URLs, not relative paths.
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shapeyourdestiny.co";
const LOGO_URL = `${BASE_URL}/Images/footer_logo_gold.png`;

/**
 * Bulletproof email button using table-based layout for Outlook compatibility
 */
export function emailButton(text, url) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 28px auto;">
      <tr>
        <td style="border-radius: 999px; background: #F2A65E;">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 999px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Info box for displaying label/value pairs (e.g., invite codes)
 */
export function emailInfoBox(label, value) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="background: #EAF1FC; border-radius: 12px; padding: 16px 20px; text-align: center;">
          <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #4A5170; text-transform: uppercase; letter-spacing: 0.05em;">
            ${label}
          </p>
          <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #1F3F91; letter-spacing: 0.05em;">
            ${value}
          </p>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Main email template builder
 * @param {Object} options
 * @param {string} options.eyebrow - Small uppercase text above heading
 * @param {string} options.heading - Main heading text
 * @param {string} options.bodyHtml - HTML content for the email body
 * @param {boolean} options.showLogo - Whether to show logo in header (default: true)
 */
export function buildEmailHTML({ eyebrow, heading, bodyHtml, showLogo = true }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #EAF1FC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #EAF1FC;">
    <tr>
      <td style="padding: 40px 20px;">
        <!-- Main Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(20, 44, 107, 0.12); overflow: hidden;">

          <!-- Header -->
          ${showLogo ? `
          <tr>
            <td style="background: #1F3F91; padding: 28px 40px; text-align: center;">
              <img src="${LOGO_URL}" alt="Shape Your Destiny" width="180" style="display: block; margin: 0 auto; max-width: 180px; height: auto;" />
            </td>
          </tr>
          ` : ''}

          <!-- Content -->
          <tr>
            <td style="padding: 40px 40px 32px 40px;">
              <!-- Eyebrow -->
              <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #1F3F91;">
                ${eyebrow}
              </p>

              <!-- Heading -->
              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #16193B; line-height: 1.3;">
                ${heading}
              </h1>

              <!-- Body Content -->
              <div style="font-size: 16px; line-height: 1.6; color: #16193B;">
                ${bodyHtml}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; border-top: 1px solid #DCE8FB;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #8B93A8; text-align: center;">
                Shape Your Destiny Youth Wellness Programs
              </p>
              <p style="margin: 0; font-size: 12px; color: #8B93A8; text-align: center;">
                Questions? Reply to this email or reach us at <a href="mailto:destiny@shapeyourdestiny.co" style="color: #1F3F91; text-decoration: none;">destiny@shapeyourdestiny.co</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
