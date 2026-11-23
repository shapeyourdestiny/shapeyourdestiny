import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Generate a URL-friendly slug from a district name
 */
export function generateLinkSlug(districtName) {
  return districtName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Get a survey send by link slug (for public pages)
 * Uses admin client to bypass RLS
 */
export async function getSendByLinkSlug(surveySlug, linkSlug) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("survey_sends")
    .select(`
      id,
      survey_slug,
      district_id,
      link_slug,
      schools,
      closes_at,
      status,
      districts:district_id (
        id,
        name
      )
    `)
    .eq("survey_slug", surveySlug)
    .eq("link_slug", linkSlug)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Error fetching send by link slug:", error);
    return null;
  }

  return data;
}

/**
 * Get all sends for a survey (admin only)
 */
export async function getSurveySends(surveySlug) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("survey_sends")
    .select(`
      id,
      survey_slug,
      district_id,
      link_slug,
      schools,
      closes_at,
      status,
      created_at,
      districts:district_id (
        id,
        name
      )
    `)
    .eq("survey_slug", surveySlug)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching survey sends:", error);
    return [];
  }

  return data || [];
}

/**
 * Get a send by district ID (to check if one already exists)
 */
export async function getSendByDistrictId(surveySlug, districtId) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("survey_sends")
    .select(`
      id,
      survey_slug,
      district_id,
      link_slug,
      schools,
      closes_at,
      status,
      districts:district_id (
        id,
        name
      )
    `)
    .eq("survey_slug", surveySlug)
    .eq("district_id", districtId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Error fetching send by district:", error);
    return null;
  }

  return data;
}

/**
 * Create a new survey send
 */
export async function createSurveySend({
  surveySlug,
  districtId,
  districtName,
  schools,
  closesAt = null,
}) {
  const adminClient = createAdminClient();
  const linkSlug = generateLinkSlug(districtName);

  const { data, error } = await adminClient
    .from("survey_sends")
    .insert({
      survey_slug: surveySlug,
      district_id: districtId,
      link_slug: linkSlug,
      schools,
      closes_at: closesAt,
      status: "open",
    })
    .select(`
      id,
      survey_slug,
      district_id,
      link_slug,
      schools,
      closes_at,
      status,
      districts:district_id (
        id,
        name
      )
    `)
    .single();

  if (error) {
    console.error("Error creating survey send:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update a survey send
 */
export async function updateSurveySend(sendId, updates) {
  const adminClient = createAdminClient();

  const updateData = {};
  if (updates.schools !== undefined) updateData.schools = updates.schools;
  if (updates.closesAt !== undefined) updateData.closes_at = updates.closesAt;
  if (updates.status !== undefined) updateData.status = updates.status;

  const { data, error } = await adminClient
    .from("survey_sends")
    .update(updateData)
    .eq("id", sendId)
    .select(`
      id,
      survey_slug,
      district_id,
      link_slug,
      schools,
      closes_at,
      status,
      districts:district_id (
        id,
        name
      )
    `)
    .single();

  if (error) {
    console.error("Error updating survey send:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Delete a survey send
 */
export async function deleteSurveySend(sendId) {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("survey_sends")
    .delete()
    .eq("id", sendId);

  if (error) {
    console.error("Error deleting survey send:", error);
    throw new Error(error.message);
  }

  return true;
}

/**
 * Check if a send is open (status is open and not past closes_at)
 */
export function isSendOpen(send) {
  if (!send) return false;
  if (send.status !== "open") return false;
  if (send.closes_at && new Date(send.closes_at) < new Date()) return false;
  return true;
}

/**
 * Get response counts by district for a survey
 */
export async function getResponseCountsByDistrict(surveySlug) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("survey_responses")
    .select("district_id")
    .eq("survey_slug", surveySlug);

  if (error) {
    console.error("Error fetching response counts:", error);
    return {};
  }

  const counts = {};
  for (const row of data || []) {
    const key = row.district_id || "no-district";
    counts[key] = (counts[key] || 0) + 1;
  }

  return counts;
}

/**
 * Get all districts (for the send dialog)
 */
export async function getAllDistricts() {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("districts")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("Error fetching districts:", error);
    return [];
  }

  return data || [];
}

/**
 * Get schools for a district
 */
export async function getSchoolsForDistrict(districtId) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("schools")
    .select("id, name")
    .eq("district_id", districtId)
    .order("name");

  if (error) {
    console.error("Error fetching schools for district:", error);
    return [];
  }

  return data || [];
}
