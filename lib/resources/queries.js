import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Get a resource by key.
 */
export async function getResource(key) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("resources")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error("Error fetching resource:", error);
    return null;
  }

  return data;
}

/**
 * Get all resources.
 */
export async function getAllResources() {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("resources")
    .select("*")
    .order("key");

  if (error) {
    console.error("Error fetching resources:", error);
    return [];
  }

  return data || [];
}

/**
 * List files in the resources bucket for a given prefix.
 * Used to show version history.
 */
export async function listResourceFiles(prefix) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .storage
    .from("resources")
    .list(prefix, {
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) {
    console.error("Error listing resource files:", error);
    return [];
  }

  return data || [];
}

/**
 * Get count of instructors who have opened the current version of a resource.
 */
export async function getResourceOpenCount(resourceKey, versionLabel) {
  if (!resourceKey || !versionLabel) return 0;

  const adminClient = createAdminClient();

  const { count, error } = await adminClient
    .from("resource_opens")
    .select("*", { count: "exact", head: true })
    .eq("resource_key", resourceKey)
    .eq("version_label", versionLabel);

  if (error) {
    console.error("Error counting resource opens:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get count of active instructors.
 */
export async function getActiveInstructorCount() {
  const adminClient = createAdminClient();

  const { count, error } = await adminClient
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "instructor")
    .eq("status", "active");

  if (error) {
    console.error("Error counting instructors:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Format updated_at date as "Mon YYYY"
 */
export function formatResourceDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Format date as "Mon D, YYYY" or "Today"
 */
export function formatResourceDateFull(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const today = new Date();

  // Check if it's today
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return "Today";
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Format file size in KB or MB
 */
export function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Calculate next version label from current one.
 * e.g., "v1.1" -> "v1.2", "v2.0" -> "v2.1"
 */
export function getNextVersion(currentVersion) {
  if (!currentVersion) return "";

  // Match pattern like "v1.1" or "v2.0"
  const match = currentVersion.match(/^v(\d+)\.(\d+)$/i);
  if (!match) return "";

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  return `v${major}.${minor + 1}`;
}
