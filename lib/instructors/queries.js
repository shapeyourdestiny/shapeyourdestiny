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
 * Get list of all instructors with session counts, district info, and staff page data.
 * Used for the admin instructors list page.
 */
export async function getInstructorsList() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Fetch all instructor profiles with staff page fields
  let profiles;
  let profilesError;

  const { data: profilesWithStatus, error: statusError } = await supabase
    .from("profiles")
    .select(`
      id, full_name, role, status, created_at, phone,
      cpr_expiration, food_handler_expiration,
      display_name, title, bio, headshot_path,
      staff_section, staff_sort_order, show_on_staff_page, staff_quote
    `)
    .in("role", ["instructor", "admin"])
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
  const districtListByInstructor = {};
  (instructorDistricts || []).forEach((id) => {
    if (!districtsByInstructor[id.profile_id]) {
      districtsByInstructor[id.profile_id] = [];
      districtListByInstructor[id.profile_id] = [];
    }
    if (id.districts?.name) {
      districtsByInstructor[id.profile_id].push(id.districts.name);
      districtListByInstructor[id.profile_id].push({
        id: id.district_id,
        name: id.districts.name,
      });
    }
  });

  // Get programs per instructor from class assignments
  const { data: classAssignments } = await supabase
    .from("class_assignments")
    .select("profile_id, classes:class_id(program)")
    .in("profile_id", profileIds);

  const programsByInstructor = {};
  (classAssignments || []).forEach((ca) => {
    if (!programsByInstructor[ca.profile_id]) {
      programsByInstructor[ca.profile_id] = new Set();
    }
    if (ca.classes?.program) {
      programsByInstructor[ca.profile_id].add(ca.classes.program);
    }
  });

  // Get emails from auth.users
  const emailMap = {};
  for (const profile of profiles) {
    try {
      const { data: authUser } = await adminClient.auth.admin.getUserById(profile.id);
      if (authUser?.user?.email) {
        emailMap[profile.id] = authUser.user.email;
      }
    } catch (e) {
      // Skip if user doesn't exist
    }
  }

  // Generate headshot URLs
  const headshotUrls = {};
  for (const profile of profiles) {
    if (profile.headshot_path) {
      const { data: signedData } = await adminClient.storage
        .from("staff-headshots")
        .createSignedUrl(profile.headshot_path, 3600); // 1 hour
      headshotUrls[profile.id] = signedData?.signedUrl || null;
    }
  }

  // Build final list with all data
  return profiles.map((profile) => {
    const showOnStaffPage = profile.show_on_staff_page ?? true;
    const isActive = profile.status === "active";
    const hasHeadshot = !!profile.headshot_path;
    const hasBio = !!profile.bio;

    // Determine staff page label
    let staffPageLabel = "Off the site";
    let staffPageStatus = "off";
    if (profile.status === "invited") {
      staffPageLabel = "After sign-up";
      staffPageStatus = "pending";
    } else if (isActive) {
      if (showOnStaffPage) {
        staffPageLabel = "Live";
        staffPageStatus = "live";
        if (!hasHeadshot && !hasBio) {
          staffPageLabel = "Live";
          staffPageStatus = "live-incomplete";
        }
      } else {
        staffPageLabel = "Hidden";
        staffPageStatus = "hidden";
      }
    }

    // Needs profile = Live but missing photo or bio
    const needsProfile = staffPageStatus === "live" && (!hasHeadshot || !hasBio);

    return {
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      status: profile.status || "active",
      sessionCount: sessionCounts[profile.id] || 0,
      districts: districtsByInstructor[profile.id]?.join(", ") || "—",
      districtList: districtListByInstructor[profile.id] || [],
      programs: Array.from(programsByInstructor[profile.id] || []),
      created_at: profile.created_at,
      email: emailMap[profile.id] || null,
      phone: profile.phone,
      cpr_expiration: profile.cpr_expiration,
      food_handler_expiration: profile.food_handler_expiration,
      // Staff page fields
      display_name: profile.display_name,
      title: profile.title,
      bio: profile.bio,
      headshot_path: profile.headshot_path,
      headshotUrl: headshotUrls[profile.id] || null,
      staff_section: profile.staff_section || "instructor",
      staff_sort_order: profile.staff_sort_order || 0,
      show_on_staff_page: showOnStaffPage,
      staff_quote: profile.staff_quote,
      staffPageLabel,
      staffPageStatus,
      needsProfile,
      hasHeadshot,
      hasBio,
    };
  });
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
    .select(`
      id, full_name, role, status, phone, cpr_expiration, food_handler_expiration, created_at,
      display_name, title, bio, headshot_path, staff_section, staff_sort_order, show_on_staff_page, staff_quote
    `)
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
        cpr_expiration: null,
        food_handler_expiration: null,
        display_name: null,
        title: null,
        bio: null,
        headshot_path: null,
        staff_section: "instructor",
        staff_sort_order: 0,
        show_on_staff_page: true,
        staff_quote: null,
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

  // Get headshot signed URL if exists
  let headshotUrl = null;
  if (profile.headshot_path) {
    const { data: signedData } = await adminClient.storage
      .from("staff-headshots")
      .createSignedUrl(profile.headshot_path, 300);
    headshotUrl = signedData?.signedUrl || null;
  }

  // Determine staff page live status
  let staffLiveStatus = "Deactivated";
  if (profile.status === "active") {
    staffLiveStatus = profile.show_on_staff_page ? "Live" : "Hidden";
  }

  return {
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
    status: profile.status || "active",
    phone: profile.phone,
    email,
    cpr_expiration: profile.cpr_expiration,
    food_handler_expiration: profile.food_handler_expiration,
    created_at: profile.created_at,
    totalSessions,
    sessionsByProgram,
    districts,
    upcomingSessions: nextSessions,
    upcomingCount: upcomingSessions.length,
    // Staff page fields
    display_name: profile.display_name,
    title: profile.title,
    bio: profile.bio,
    headshot_path: profile.headshot_path,
    headshotUrl,
    staff_section: profile.staff_section || "instructor",
    staff_sort_order: profile.staff_sort_order || 0,
    show_on_staff_page: profile.show_on_staff_page ?? true,
    staff_quote: profile.staff_quote,
    staffLiveStatus,
  };
}
