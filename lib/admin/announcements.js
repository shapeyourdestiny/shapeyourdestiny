import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Get all announcements for the admin updates page.
 * Includes read stats for sent announcements.
 */
export async function getAdminAnnouncements() {
  const supabase = createAdminClient();

  // Get all non-archived announcements
  const { data: announcements, error } = await supabase
    .from("announcements")
    .select(`
      id,
      title,
      body,
      audience,
      send_email,
      status,
      send_at,
      sent_at,
      pinned_until,
      edited_at,
      emailed_at,
      last_reminded_at,
      created_at,
      created_by,
      creator:created_by (
        id,
        full_name
      )
    `)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching announcements:", error);
    return { sent: [], scheduled: [], drafts: [] };
  }

  // Get read counts for sent announcements
  const sentAnnouncements = (announcements || []).filter(a => a.status === "sent");
  const readCountsMap = new Map();

  if (sentAnnouncements.length > 0) {
    const announcementIds = sentAnnouncements.map(a => a.id);

    const { data: reads } = await supabase
      .from("inbox_reads")
      .select("item_id")
      .eq("item_type", "announcement")
      .in("item_id", announcementIds);

    // Count reads per announcement
    (reads || []).forEach(r => {
      const count = readCountsMap.get(r.item_id) || 0;
      readCountsMap.set(r.item_id, count + 1);
    });
  }

  // Group by status and add read counts
  const sent = [];
  const scheduled = [];
  const drafts = [];

  for (const announcement of announcements || []) {
    const processed = {
      ...announcement,
      creatorName: announcement.creator?.full_name?.split(" ")[0] || "Admin",
      readCount: readCountsMap.get(announcement.id) || 0,
    };

    if (announcement.status === "sent") {
      sent.push(processed);
    } else if (announcement.status === "scheduled") {
      scheduled.push(processed);
    } else if (announcement.status === "draft") {
      drafts.push(processed);
    }
  }

  return { sent, scheduled, drafts };
}

/**
 * Get schools with their classes for audience picker.
 */
export async function getSchoolsWithClasses() {
  const supabase = createAdminClient();

  const { data: schools, error } = await supabase
    .from("schools")
    .select(`
      id,
      name,
      classes (
        id,
        program,
        start_date
      )
    `)
    .order("name");

  if (error) {
    console.error("Error fetching schools:", error);
    return [];
  }

  // Filter to schools that have active classes
  return (schools || []).filter(school =>
    school.classes?.some(c => c.start_date)
  ).map(school => ({
    id: school.id,
    name: school.name,
    programs: [...new Set(school.classes.filter(c => c.start_date).map(c => c.program))],
  }));
}

/**
 * Get all active instructors for people picker.
 */
export async function getActiveInstructors() {
  const supabase = createAdminClient();

  const { data: instructors, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("role", "instructor")
    .eq("status", "active")
    .order("full_name");

  if (error) {
    console.error("Error fetching instructors:", error);
    return [];
  }

  return instructors || [];
}

/**
 * Get all districts for audience picker.
 */
export async function getDistricts() {
  const supabase = createAdminClient();

  const { data: districts, error } = await supabase
    .from("districts")
    .select("id, name, color")
    .order("name");

  if (error) {
    console.error("Error fetching districts:", error);
    return [];
  }

  return districts || [];
}

/**
 * Get distinct programs from classes.
 */
export async function getPrograms() {
  const supabase = createAdminClient();

  const { data: classes, error } = await supabase
    .from("classes")
    .select("program")
    .not("start_date", "is", null);

  if (error) {
    console.error("Error fetching programs:", error);
    return [];
  }

  // Get unique programs
  const programs = [...new Set((classes || []).map(c => c.program).filter(Boolean))];

  // Return in display order
  const order = ["wellness", "sports", "leadership"];
  return programs.sort((a, b) => {
    const aIdx = order.indexOf(a);
    const bIdx = order.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

/**
 * Get a single announcement by ID for editing.
 */
export async function getAnnouncementById(id) {
  const supabase = createAdminClient();

  const { data: announcement, error } = await supabase
    .from("announcements")
    .select(`
      id,
      title,
      body,
      audience,
      send_email,
      status,
      send_at,
      sent_at,
      pinned_until,
      edited_at,
      created_at,
      created_by,
      creator:created_by (
        id,
        full_name
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching announcement:", error);
    return null;
  }

  return {
    ...announcement,
    creatorName: announcement.creator?.full_name?.split(" ")[0] || "Admin",
  };
}

/**
 * Get audience description text for display.
 */
export function getAudienceText(audience, schools = [], instructors = [], districts = []) {
  if (!audience) return "No audience";

  const type = audience.type;

  if (type === "all") {
    return "Everyone";
  } else if (type === "program") {
    const program = audience.program;
    const labels = {
      wellness: "Wellness",
      sports: "Sports",
      leadership: "Leadership",
    };
    return labels[program] || program || "Unknown program";
  } else if (type === "district") {
    const districtIds = audience.district_ids || [];
    if (districtIds.length === 0) return "No districts selected";
    if (districtIds.length === 1) {
      const district = districts.find(d => d.id === districtIds[0]);
      return district?.name || "1 district";
    }
    return `${districtIds.length} districts`;
  } else if (type === "school") {
    const schoolIds = audience.school_ids || [];
    if (schoolIds.length === 0) return "No schools selected";
    if (schoolIds.length === 1) {
      const school = schools.find(s => s.id === schoolIds[0]);
      return school?.name || "1 school";
    }
    return `${schoolIds.length} schools`;
  } else if (type === "people") {
    const profileIds = audience.profile_ids || [];
    if (profileIds.length === 0) return "No people selected";
    if (profileIds.length === 1) {
      const instructor = instructors.find(i => i.id === profileIds[0]);
      return instructor?.full_name || "1 person";
    }
    return `${profileIds.length} people`;
  }

  return "Unknown audience";
}
