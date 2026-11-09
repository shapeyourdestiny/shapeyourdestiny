import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, hashIP, getClientIP } from "@/lib/security/rate-limit";
import crypto from "crypto";

// Rate limit settings
const IP_LIMIT = 5;
const IP_WINDOW_MINUTES = 15;
const EMAIL_LIMIT = 10;
const EMAIL_WINDOW_MINUTES = 60;

/**
 * Hash email for privacy-preserving rate limiting
 */
function hashEmail(email) {
  const salt = process.env.IP_HASH_SALT || "syd-rate-limit-salt";
  return crypto.createHash("sha256").update(salt + email.toLowerCase()).digest("hex").slice(0, 32);
}

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const ip = getClientIP(request);
    const ipHash = hashIP(ip);
    const emailHash = hashEmail(normalizedEmail);

    // Check IP rate limit
    const ipLimit = await checkRateLimit({
      key: `login:ip:${ipHash}`,
      limit: IP_LIMIT,
      windowMinutes: IP_WINDOW_MINUTES,
    });

    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    // Check email rate limit
    const emailLimit = await checkRateLimit({
      key: `login:email:${emailHash}`,
      limit: EMAIL_LIMIT,
      windowMinutes: EMAIL_WINDOW_MINUTES,
    });

    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts for this account. Please try again later." },
        { status: 429 }
      );
    }

    // Attempt login
    const supabase = await createClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      // Check for specific error types
      if (signInError.message.toLowerCase().includes("email not confirmed")) {
        return NextResponse.json(
          { error: "email_not_confirmed", message: "Your email hasn't been confirmed yet." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Invalid email or password. Please try again." },
        { status: 401 }
      );
    }

    // Get user role
    const adminClient = createAdminClient();
    const userId = signInData.user?.id;

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    const role = profile?.role || "instructor";
    const redirectUrl = role === "admin" ? "/admin/dashboard" : "/instructor/dashboard";

    return NextResponse.json({
      success: true,
      role,
      redirectUrl,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
