import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeClassOccurrences } from "@/lib/schedule/occurrences";

/**
 * Format a date as YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get list of all instructors with session counts and district info.
 * Used for the admin instructors list page.
 */
export async function getInstructorsList() {
  const supabase = await createClient();

  // Fetch all instructor profiles
  // Try with status column first, fall back to archived if status doesn't exist
  let profiles;
  let profilesError;

  const { data: profilesWithStatus, error: statusError } = await supabase
    .from("profiles")
    .select("id, full_name, status, created_at")
    .eq("role", "instructor")
    .order("created_at", { ascending: false });

  // Check if error is about missing column (status)
  const isColumnError = statusError && (
    statusError.message?.includes("status") ||
    statusError.message?.includes("column") ||
    statusError.code === "42703" // PostgreSQL undefined_column error
  );

  if (isColumnError) {
    // status column doesn't exist, fall back to archived
    const { data: profilesWithArchived, error: archivedError } = await supabase
      .from("profiles")
      .select("id, full_name, archived, created_at")
      .eq("role", "instructor")
      .order("created_at", { ascending: false });

    profiles = (profilesWithArchived || []).map((p) => ({
      ...p,
      status: p.archived ? "archived" : "active",
    }));
    profilesError = archivedError;
  } else {
    profiles = profilesWithStatus;
    profilesError = statusError;
  }

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    return [];
  }

  if (!profiles || profiles.length === 0) {
    return [];
  }

  const profileIds = profiles.map((p) => p.id);

  // Get session counts per instructor (count of class_assignments)
  const { data: assignments, error: assignmentsError } = await supabase
    .from("class_assignments")
    .select("profile_id, class_id")
    .in("profile_id", profileIds);

  if (assignmentsError) {
    console.error("Error fetching assignments:", assignmentsError);
  }

  // Count assignments per instructor
  const sessionCounts = {};
  (assignments || []).forEach((a) => {
    sessionCounts[a.profile_id] = (sessionCounts[a.profile_id] || 0) + 1;
  });

  // Get instructor-district relationships
  const { data: instructorDistricts, error: idError } = await supabase
    .from("instructor_districts")
    .select("profile_id, district_id, districts:district_id(name)")
    .in("profile_id", profileIds);

  if (idError) {
    console.error("Error fetching instructor districts:", idError);
  }

  // Group districts by instructor
  const districtsByInstructor = {};
  (instructorDistricts || []).forEach((id) => {
    if (!districtsByInstructor[id.profile_id]) {
      districtsByInstructor[id.profile_id] = [];
    }
    if (id.districts?.name) {
      districtsByInstructor[id.profile_id].push(id.districts.name);
    }
  });

  // Build final list
  return profiles.map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
    status: profile.status || "active",
    sessionCount: sessionCounts[profile.id] || 0,
    districts: districtsByInstructor[profile.id]?.join(", ") || "—",
    created_at: profile.created_at,
  }));
}

/**
 * Get detailed information about a single instructor.
 * Used for the admin instructor detail page.
 */
export async function getInstructorDetail(profileId) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Fetch profile - try with new columns, fall back if they don't exist
  let profile;
  let profileError;

  const { data: profileWithNew, error: newError } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, phone, cpr_expires, food_handler_expires, created_at")
    .eq("id", profileId)
    .single();

  // Check if error is about missing columns
  const isColumnError = newError && (
    newError.message?.includes("status") ||
    newError.message?.includes("phone") ||
    newError.message?.includes("column") ||
    newError.code === "42703" // PostgreSQL undefined_column error
  );

  if (isColumnError) {
    // New columns don't exist, fall back
    const { data: profileOld, error: oldError } = await supabase
      .from("profiles")
      .select("id, full_name, role, archived, created_at")
      .eq("id", profileId)
      .single();

    if (profileOld) {
      profile = {
        ...profileOld,
        status: profileOld.archived ? "archived" : "active",
        phone: null,
        cpr_expires: null,
        food_handler_expires: null,
      };
    }
    profileError = oldError;
  } else {
    profile = profileWithNew;
    profileError = newError;
  }

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError);
    return null;
  }

  // Get email from auth.users via admin client
  let email = null;
  try {
    const { data: authUser, error: authError } =
      await adminClient.auth.admin.getUserById(profileId);
    if (!authError && authUser?.user) {
      email = authUser.user.email;
    }
  } catch (err) {
    console.error("Error fetching auth user:", err);
  }

  // Get class assignments with class and school info
  const { data: assignments, error: assignmentsError } = await supabase
    .from("class_assignments")
    .select(`
      id,
      class_id,
      slot_type,
      classes:class_id (
        id,
        days,
        time,
        start_date,
        target_sessions,
        program,
        schools:school_id (
          id,
          name,
          districts:district_id (
            id,
            name
          )
        )
      )
    `)
    .eq("profile_id", profileId);

  if (assignmentsError) {
    console.error("Error fetching assignments:", assignmentsError);
  }

  const assignmentsList = assignments || [];

  // Calculate session breakdown by program
  const sessionsByProgram = { wellness: 0, soccer: 0 };
  assignmentsList.forEach((a) => {
    const program = a.classes?.program || "wellness";
    sessionsByProgram[program] = (sessionsByProgram[program] || 0) + 1;
  });

  // Calculate sessions per district
  const sessionsByDistrict = {};
  assignmentsList.forEach((a) => {
    const districtName = a.classes?.schools?.districts?.name;
    if (districtName) {
      sessionsByDistrict[districtName] =
        (sessionsByDistrict[districtName] || 0) + 1;
    }
  });

  // Get instructor's assigned districts
  const { data: instructorDistricts, error: idError } = await supabase
    .from("instructor_districts")
    .select("district_id, districts:district_id(name)")
    .eq("profile_id", profileId);

  if (idError) {
    console.error("Error fetching instructor districts:", idError);
  }

  const districts = (instructorDistricts || [])
    .filter((id) => id.districts?.name)
    .map((id) => ({
      id: id.district_id,
      name: id.districts.name,
      sessionCount: sessionsByDistrict[id.districts.name] || 0,
    }));

  // Fetch holidays for upcoming sessions calculation
  const { data: holidays, error: holidaysError } = await supabase
    .from("holidays")
    .select("date, name")
    .order("date");

  if (holidaysError) {
    console.error("Error fetching holidays:", holidaysError);
  }

  // Fetch program off days
  const { data: programOffDays, error: podError } = await supabase
    .from("program_off_days")
    .select("date, reason, program")
    .order("date");

  if (podError) {
    console.error("Error fetching program off days:", podError);
  }

  // Calculate upcoming sessions
  const today = formatDate(new Date());
  const upcomingSessions = [];

  assignmentsList.forEach((a) => {
    const cls = a.classes;
    if (!cls || !cls.start_date || !cls.days) return;

    const school = cls.schools;
    if (!school) return;

    // Filter holidays and off days for this class's program
    const classHolidays = (holidays || []).map((h) => ({
      date: h.date,
      name: h.name,
    }));

    const classOffDays = (programOffDays || [])
      .filter((od) => !od.program || od.program === cls.program)
      .map((od) => ({
        date: od.date,
        reason: od.reason,
      }));

    // Compute occurrences
    const result = computeClassOccurrences({
      startDate: cls.start_date,
      days: cls.days,
      targetSessions: cls.target_sessions,
      holidays: classHolidays,
      programOffDays: classOffDays,
      rangeEnd: null, // Use targetSessions to determine end
    });

    // Filter to future dates
    result.occurrences.forEach((occ) => {
      if (occ.date >= today) {
        upcomingSessions.push({
          date: occ.date,
          weekday: occ.weekday,
          time: cls.time,
          schoolName: school.name,
          schoolId: school.id,
          classId: cls.id,
          program: cls.program,
        });
      }
    });
  });

  // Sort by date and take first 5
  upcomingSessions.sort((a, b) => a.date.localeCompare(b.date));
  const nextSessions = upcomingSessions.slice(0, 5);

  // Total session count
  const totalSessions = assignmentsList.length;

  return {
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
    status: profile.status || "active",
    phone: profile.phone,
    email,
    cpr_expires: profile.cpr_expires,
    food_handler_expires: profile.food_handler_expires,
    created_at: profile.created_at,
    totalSessions,
    sessionsByProgram,
    districts,
    upcomingSessions: nextSessions,
    upcomingCount: upcomingSessions.length,
  };
}
