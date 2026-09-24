import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Get public staff data for the /our-team page.
 * Uses the public_staff() function which enforces visibility rules.
 * Returns signed URLs for headshots.
 *
 * Uses admin client to avoid cookie access (for caching compatibility).
 * Falls back to direct query if migration hasn't been run yet.
 */
export async function getPublicStaff() {
  // Use admin client to avoid cookies (public_staff is a public function anyway)
  const adminClient = createAdminClient();

  // Try the security-definer function first
  let { data, error } = await adminClient.rpc("public_staff");

  // If function doesn't exist (migration not run), fall back to direct query
  if (error?.code === "PGRST202" || error?.message?.includes("could not find")) {
    console.log("public_staff() not found, using fallback query (run migration to fix)");

    // Fallback: query profiles directly (admin client bypasses RLS)
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select(`
        id, full_name, role, status,
        display_name, title, bio, headshot_path,
        staff_section, staff_sort_order, show_on_staff_page, staff_quote
      `)
      .eq("status", "active")
      .eq("role", "instructor")
      .order("staff_sort_order", { ascending: true });

    if (profilesError) {
      // Columns might not exist yet either
      if (profilesError.message?.includes("column")) {
        console.log("Staff columns not found (run migration)");
        return { leadership: [], instructors: [], programs: [] };
      }
      console.error("Error fetching profiles:", profilesError);
      return { leadership: [], instructors: [], programs: [] };
    }

    // Filter and transform
    data = (profiles || [])
      .filter((p) => p.show_on_staff_page !== false)
      .map((p) => ({
        id: p.id,
        display_name: p.display_name || p.full_name,
        title: p.title,
        bio: p.bio,
        headshot_path: p.headshot_path,
        staff_section: p.staff_section || "instructor",
        staff_sort_order: p.staff_sort_order || 0,
        staff_quote: p.staff_quote,
        programs: [], // Can't get programs without the function
      }));
    error = null;
  }

  if (error) {
    console.error("Error fetching public staff:", error);
    return { leadership: [], instructors: [], programs: [] };
  }

  if (!data || data.length === 0) {
    return { leadership: [], instructors: [], programs: [] };
  }

  // Generate signed URLs for headshots (5 minute expiry)
  const staffWithUrls = await Promise.all(
    data.map(async (person) => {
      let headshotUrl = null;
      if (person.headshot_path) {
        const { data: signedData } = await adminClient.storage
          .from("staff-headshots")
          .createSignedUrl(person.headshot_path, 300); // 5 minutes
        headshotUrl = signedData?.signedUrl || null;
      }
      return {
        ...person,
        headshotUrl,
      };
    })
  );

  // Split into leadership and instructors
  const leadership = staffWithUrls.filter((p) => p.staff_section === "leadership");
  const instructors = staffWithUrls.filter((p) => p.staff_section === "instructor");

  // Collect unique programs that are in use
  const programSet = new Set();
  instructors.forEach((p) => {
    (p.programs || []).forEach((prog) => programSet.add(prog));
  });
  const programs = Array.from(programSet).sort();

  return { leadership, instructors, programs };
}

/**
 * Get staff profile data for admin editing.
 * Includes all staff-page fields plus the current visibility status.
 */
export async function getStaffProfileForAdmin(profileId) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      status,
      display_name,
      title,
      bio,
      headshot_path,
      staff_section,
      staff_sort_order,
      show_on_staff_page,
      staff_quote
    `)
    .eq("id", profileId)
    .single();

  if (error || !profile) {
    console.error("Error fetching staff profile:", error);
    return null;
  }

  // Get headshot signed URL for preview
  let headshotUrl = null;
  if (profile.headshot_path) {
    const { data: signedData } = await adminClient.storage
      .from("staff-headshots")
      .createSignedUrl(profile.headshot_path, 300);
    headshotUrl = signedData?.signedUrl || null;
  }

  // Derive programs from class assignments
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select("classes:class_id(program)")
    .eq("profile_id", profileId);

  const programSet = new Set();
  (assignments || []).forEach((a) => {
    if (a.classes?.program) {
      programSet.add(a.classes.program);
    }
  });

  // Determine live status badge
  let liveStatus = "Deactivated";
  if (profile.status === "active") {
    liveStatus = profile.show_on_staff_page ? "Live" : "Hidden";
  }

  return {
    ...profile,
    headshotUrl,
    programs: Array.from(programSet),
    liveStatus,
  };
}
