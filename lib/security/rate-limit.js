import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

const IP_HASH_SALT = process.env.IP_HASH_SALT || "syd-rate-limit-salt";

/**
 * Hash an IP address for privacy-preserving rate limiting.
 */
export function hashIP(ip) {
  return crypto.createHash("sha256").update(IP_HASH_SALT + ip).digest("hex").slice(0, 32);
}

/**
 * Get the client IP from request headers.
 */
export function getClientIP(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;
  return "unknown";
}

/**
 * Check rate limit against database.
 *
 * @param {Object} options
 * @param {string} options.key - Unique key for this rate limit (e.g., "contact:ip:abc123")
 * @param {number} options.limit - Maximum requests allowed
 * @param {number} options.windowMinutes - Time window in minutes
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: Date}>}
 */
export async function checkRateLimit({ key, limit, windowMinutes }) {
  const supabase = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  // Get current count in window
  const { count, error } = await supabase
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", windowStart.toISOString());

  if (error) {
    console.error("Rate limit check failed:", error);
    // Fail open - allow the request but log the error
    return { allowed: true, remaining: limit, resetAt: new Date(now.getTime() + windowMinutes * 60 * 1000) };
  }

  const currentCount = count || 0;
  const allowed = currentCount < limit;
  const remaining = Math.max(0, limit - currentCount);
  const resetAt = new Date(now.getTime() + windowMinutes * 60 * 1000);

  // If allowed, record this request
  if (allowed) {
    await supabase.from("rate_limits").insert({ key, created_at: now.toISOString() });
  }

  return { allowed, remaining, resetAt };
}

/**
 * Clean up old rate limit entries (call periodically).
 * @param {number} olderThanMinutes - Delete entries older than this many minutes
 */
export async function cleanupRateLimits(olderThanMinutes = 60) {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const { error } = await supabase
    .from("rate_limits")
    .delete()
    .lt("created_at", cutoff.toISOString());

  if (error) {
    console.error("Rate limit cleanup failed:", error);
  }
}
