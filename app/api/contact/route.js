import { NextResponse } from "next/server";
import { sendContactNotification, sendContactConfirmation } from "@/lib/email/index";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { getClientIP } from "@/lib/security/rate-limit";

const REASON_LABELS = {
  school: "Bring the program to my school",
  corporate: "Corporate wellness for my staff",
  general: "General questions",
  support: "Support with an existing program",
};

// Rate limiting store (in-memory, resets on cold start)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5; // Max submissions per window

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record) {
    rateLimitStore.set(ip, { count: 1, firstRequest: now });
    return false;
  }

  // Reset if window has passed
  if (now - record.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { count: 1, firstRequest: now });
    return false;
  }

  // Increment and check
  record.count++;
  return record.count > RATE_LIMIT_MAX;
}

// Clean up old entries periodically (every 100 requests)
let requestCount = 0;
function cleanupRateLimitStore() {
  requestCount++;
  if (requestCount % 100 === 0) {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore) {
      if (now - record.firstRequest > RATE_LIMIT_WINDOW) {
        rateLimitStore.delete(ip);
      }
    }
  }
}

export async function POST(request) {
  try {
    cleanupRateLimitStore();

    const body = await request.json();
    const { name, email, phone, org, message, reason, website, _ts, turnstileToken } = body;

    // Honeypot check - if filled, silently reject (return success to not alert spammers)
    if (website) {
      return NextResponse.json({ success: true });
    }

    // Time-based check - form submitted too quickly (< 2 seconds = likely bot)
    if (_ts && Date.now() - _ts < 2000) {
      return NextResponse.json({ success: true });
    }

    // Verify Turnstile token
    const clientIP = getClientIP(request);
    const turnstileResult = await verifyTurnstileToken(turnstileToken, clientIP);
    if (!turnstileResult.success) {
      return NextResponse.json(
        { error: turnstileResult.error || "Please complete the security check" },
        { status: 400 }
      );
    }

    // Rate limiting (in-memory fallback - keep as secondary protection)
    if (isRateLimited(clientIP)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    const reasonLabel = REASON_LABELS[reason] || reason;

    // Send internal notification to team
    try {
      await sendContactNotification({
        name,
        email,
        phone,
        org,
        message,
        reason,
        reasonLabel,
      });
    } catch (error) {
      console.error("Failed to send contact notification:", error);
      return NextResponse.json(
        { error: "Failed to process submission" },
        { status: 500 }
      );
    }

    // Send confirmation to submitter (non-critical - log failure but don't fail request)
    try {
      await sendContactConfirmation({
        name,
        email,
        message,
        reasonLabel,
      });
    } catch (error) {
      console.error("Failed to send confirmation email to submitter:", error);
      // Don't fail the request - the inquiry was still received
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to process submission" },
      { status: 500 }
    );
  }
}
