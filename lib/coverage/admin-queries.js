"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendCoverageClaimNotification, sendCoverageClaimAdminNotification } from "@/lib/email";
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
 * Get coverage stats for the Requests tab
 */
export async function getCoverageStats() {
  const supabase = await createClient();
  const today = formatDate(new Date());

  // Get date 3 days from now
  const urgentDate = new Date();
  urgentDate.setDate(urgentDate.getDate() + 3);
  const urgentDateStr = formatDate(urgentDate);

  // Get start of current month
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = formatDate(monthStart);

  // Count urgent (open and within 3 days)
  const { count: urgentCount } = await supabase
    .from("coverage_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .gte("date", today)
    .lte("date", urgentDateStr);

  // Count open
  const { count: openCount } = await supabase
    .from("coverage_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .gte("date", today);

  // Count covered this month
  const { count: coveredThisMonth } = await supabase
    .from("coverage_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "claimed")
    .gte("date", monthStartStr);

  return {
    urgent: urgentCount || 0,
    open: openCount || 0,
    coveredThisMonth: coveredThisMonth || 0,
  };
}

/**
 * Get frequent requester alert (if anyone has 3+ requests this month)
 */
export async function getFrequentRequesterAlert() {
  const supabase = await createClient();

  // Get start of current month
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = formatDate(monthStart);

  // Get all requests this month grouped by requester
  const { data: requests } = await supabase
    .from("coverage_requests")
    .select(`
      requested_by,
      requester:requested_by (
        id,
        full_name
      )
    `)
    .gte("created_at", monthStartStr)
    .neq("status", "cancelled");

  if (!requests || requests.length === 0) return null;

  // Count by requester
  const counts = {};
  requests.forEach((r) => {
    const id = r.requested_by;
    if (!counts[id]) {
      counts[id] = {
        id,
        name: r.requester?.full_name || "Unknown",
        count: 0,
      };
    }
    counts[id].count++;
  });

  // Find anyone with 3+ requests
  const frequent = Object.values(counts)
    .filter((c) => c.count >= 3)
    .sort((a, b) => b.count - a.count)[0];

  return frequent || null;
}

/**
 * Get all coverage requests for the admin list
 */
export async function getAllCoverageRequests(filter = "all") {
  const supabase = await createClient();
  const today = formatDate(new Date());

  // Get date 3 days from now for urgent marking
  const urgentDate = new Date();
  urgentDate.setDate(urgentDate.getDate() + 3);
  const urgentDateStr = formatDate(urgentDate);

  let query = supabase
    .from("coverage_requests")
    .select(`
      id,
      class_id,
      date,
      status,
      note,
      created_at,
      requested_by,
      posted_by,
      claimed_by,
      claimed_at,
      classes:class_id (
        id,
        time,
        program,
        schools:school_id (
          id,
          name
        )
      ),
      requester:requested_by (
        id,
        full_name
      ),
      poster:posted_by (
        id,
        full_name
      ),
      claimer:claimed_by (
        id,
        full_name
      )
    `)
    .gte("date", today)
    .neq("status", "cancelled")
    .order("date", { ascending: true });

  if (filter === "open") {
    query = query.eq("status", "open");
  } else if (filter === "covered") {
    query = query.eq("status", "claimed");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching coverage requests:", error);
    return [];
  }

  return (data || []).map((req) => ({
    id: req.id,
    classId: req.class_id,
    date: req.date,
    status: req.status,
    note: req.note,
    createdAt: req.created_at,
    time: req.classes?.time,
    school: req.classes?.schools
      ? {
          id: req.classes.schools.id,
          name: req.classes.schools.name,
        }
      : null,
    program: req.classes?.program
      ? {
          name: req.classes.program === "wellness" ? "Youth Wellness" : "Soccer",
        }
      : null,
    requester: req.requester
      ? {
          id: req.requester.id,
          name: req.requester.full_name,
        }
      : null,
    postedBy: req.poster
      ? {
          id: req.poster.id,
          name: req.poster.full_name,
        }
      : null,
    claimer: req.claimer
      ? {
          id: req.claimer.id,
          name: req.claimer.full_name,
        }
      : null,
    claimedAt: req.claimed_at,
    isUrgent: req.status === "open" && req.date <= urgentDateStr,
  }));
}

/**
 * Get all active instructors for the assign picker
 */
export async function getActiveInstructors() {
  const supabase = await createClient();

  // Get instructors
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("status", "active")
    .eq("role", "instructor")
    .order("full_name");

  if (profilesError) {
    console.error("Error fetching instructors:", profilesError);
    return [];
  }

  if (!profiles || profiles.length === 0) {
    return [];
  }

  // Get their district assignments
  const profileIds = profiles.map((p) => p.id);
  const { data: assignments, error: assignmentsError } = await supabase
    .from("instructor_districts")
    .select(`
      profile_id,
      districts:district_id (
        id,
        name,
        color
      )
    `)
    .in("profile_id", profileIds);

  if (assignmentsError) {
    console.error("Error fetching instructor districts:", assignmentsError);
    // Return instructors without districts
    return profiles.map((p) => ({
      id: p.id,
      name: p.full_name,
      districts: [],
    }));
  }

  // Group assignments by profile_id
  const districtsByProfile = {};
  (assignments || []).forEach((a) => {
    if (!districtsByProfile[a.profile_id]) {
      districtsByProfile[a.profile_id] = [];
    }
    if (a.districts) {
      districtsByProfile[a.profile_id].push({
        id: a.districts.id,
        name: a.districts.name,
        color: a.districts.color,
      });
    }
  });

  return profiles.map((p) => ({
    id: p.id,
    name: p.full_name,
    districts: districtsByProfile[p.id] || [],
  }));
}

/**
 * Admin assigns coverage to an instructor (atomic operation)
 */
export async function adminAssignCoverage(coverageId, instructorId) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Verify current user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    return { error: "Only admins can assign coverage" };
  }

  // Get the instructor's profile
  const { data: instructorProfile } = await supabase
    .from("profiles")
    .select("id, full_name, status")
    .eq("id", instructorId)
    .single();

  if (!instructorProfile || instructorProfile.status !== "active") {
    return { error: "Instructor not found or not active" };
  }

  // Get coverage request details
  const { data: coverageRequest, error: fetchError } = await supabase
    .from("coverage_requests")
    .select(`
      id,
      class_id,
      date,
      status,
      requested_by,
      classes:class_id (
        time,
        schools:school_id (
          name,
          address
        )
      ),
      requester:requested_by (
        id,
        full_name
      )
    `)
    .eq("id", coverageId)
    .single();

  if (fetchError || !coverageRequest) {
    return { error: "Coverage request not found" };
  }

  if (coverageRequest.status !== "open") {
    return { error: "This coverage request is no longer open" };
  }

  // Cannot assign to the requester
  if (coverageRequest.requested_by === instructorId) {
    return { error: "Cannot assign coverage to the requester" };
  }

  // Atomic assign: UPDATE with WHERE status='open'
  const { data: updated, error: updateError } = await adminClient
    .from("coverage_requests")
    .update({
      status: "claimed",
      claimed_by: instructorId,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", coverageId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Error assigning coverage:", updateError);
    return { error: "Failed to assign coverage" };
  }

  if (!updated) {
    return { error: "This coverage request was just claimed by someone else" };
  }

  // Send email notifications
  const schoolName = coverageRequest.classes?.schools?.name || "Unknown School";
  const sessionTime = coverageRequest.classes?.time || "TBD";
  const requesterName = coverageRequest.requester?.full_name || "Instructor";

  // Get requester's email for notification
  const { data: requesterAuth } = await adminClient.auth.admin.getUserById(
    coverageRequest.requested_by
  );

  // Send notification to requester
  if (requesterAuth?.user?.email) {
    try {
      await sendCoverageClaimNotification({
        to: requesterAuth.user.email,
        requesterName,
        claimerName: instructorProfile.full_name,
        schoolName,
        date: coverageRequest.date,
        time: sessionTime,
      });
    } catch (emailError) {
      console.error("Failed to send coverage claim notification to requester:", emailError);
    }
  }

  // Get other admin emails (not the current admin doing the assign) for notification
  try {
    const { data: admins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .neq("id", user.id); // Exclude current admin

    const adminEmails = [];
    for (const admin of admins || []) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(admin.id);
      if (authUser?.user?.email) {
        adminEmails.push(authUser.user.email);
      }
    }

    if (adminEmails.length > 0) {
      await sendCoverageClaimAdminNotification({
        requesterName,
        claimerName: instructorProfile.full_name,
        schoolName,
        date: coverageRequest.date,
        time: sessionTime,
        adminEmails,
      });
    }
  } catch (emailError) {
    console.error("Failed to send coverage claim notification to admins:", emailError);
  }

  revalidatePath("/admin/coverage");
  revalidatePath("/instructor/coverage");

  return { success: true };
}

/**
 * Get coverage trends for the Trends tab
 */
export async function getCoverageTrends(period = "90") {
  const supabase = await createClient();

  // Calculate date range based on period
  let startDate;
  const today = new Date();

  if (period === "30") {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === "90") {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 90);
  } else {
    // School year: Aug 1 of current school year
    const month = today.getMonth();
    const year = month >= 7 ? today.getFullYear() : today.getFullYear() - 1;
    startDate = new Date(year, 7, 1); // August 1
  }

  const startDateStr = formatDate(startDate);
  const todayStr = formatDate(today);

  // Get all requests in range
  const { data: requests } = await supabase
    .from("coverage_requests")
    .select("id, status, created_at, claimed_at")
    .gte("date", startDateStr)
    .lte("date", todayStr)
    .neq("status", "cancelled");

  if (!requests || requests.length === 0) {
    return {
      fillRate: 0,
      avgTimeToCover: 0,
      totalRequests: 0,
      totalCovered: 0,
    };
  }

  const totalRequests = requests.length;
  const covered = requests.filter((r) => r.status === "claimed");
  const totalCovered = covered.length;
  const fillRate = totalRequests > 0 ? Math.round((totalCovered / totalRequests) * 100) : 0;

  // Calculate average time to cover (in hours)
  let totalHours = 0;
  let countWithTime = 0;
  covered.forEach((r) => {
    if (r.created_at && r.claimed_at) {
      const created = new Date(r.created_at);
      const claimed = new Date(r.claimed_at);
      const hours = (claimed - created) / (1000 * 60 * 60);
      if (hours >= 0 && hours < 24 * 30) {
        // Sanity check: within 30 days
        totalHours += hours;
        countWithTime++;
      }
    }
  });
  const avgTimeToCover = countWithTime > 0 ? (totalHours / countWithTime).toFixed(1) : 0;

  return {
    fillRate,
    avgTimeToCover: parseFloat(avgTimeToCover),
    totalRequests,
    totalCovered,
  };
}

/**
 * Get monthly request chart data (6 months trailing)
 */
export async function getMonthlyRequestChart() {
  const supabase = await createClient();

  // Get 6 months of data
  const months = [];
  const today = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      label: date.toLocaleDateString("en-US", { month: "short" }),
      total: 0,
      covered: 0,
    });
  }

  // Get all requests in range
  const startDate = new Date(months[0].year, months[0].month, 1);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const { data: requests } = await supabase
    .from("coverage_requests")
    .select("id, status, date")
    .gte("date", formatDate(startDate))
    .lte("date", formatDate(endDate))
    .neq("status", "cancelled");

  if (requests) {
    requests.forEach((r) => {
      const reqDate = new Date(r.date + "T00:00:00");
      const monthData = months.find(
        (m) => m.year === reqDate.getFullYear() && m.month === reqDate.getMonth()
      );
      if (monthData) {
        monthData.total++;
        if (r.status === "claimed") {
          monthData.covered++;
        }
      }
    });
  }

  return months.map((m) => ({
    label: m.label,
    total: m.total,
    covered: m.covered,
  }));
}

/**
 * Get frequent requesters ranked list
 */
export async function getFrequentRequesters(period = "90") {
  const supabase = await createClient();

  // Calculate date range
  let startDate;
  const today = new Date();

  if (period === "30") {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === "90") {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 90);
  } else {
    const month = today.getMonth();
    const year = month >= 7 ? today.getFullYear() : today.getFullYear() - 1;
    startDate = new Date(year, 7, 1);
  }

  const startDateStr = formatDate(startDate);

  // Get all requests in range
  const { data: requests } = await supabase
    .from("coverage_requests")
    .select(`
      requested_by,
      requester:requested_by (
        id,
        full_name
      )
    `)
    .gte("date", startDateStr)
    .neq("status", "cancelled");

  if (!requests || requests.length === 0) return [];

  // Count by requester
  const counts = {};
  requests.forEach((r) => {
    const id = r.requested_by;
    if (!counts[id]) {
      counts[id] = {
        id,
        name: r.requester?.full_name || "Unknown",
        count: 0,
      };
    }
    counts[id].count++;
  });

  // Get total sessions for rate calculation
  // For now, we'll estimate based on class_assignments count
  const requesterIds = Object.keys(counts);
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select("profile_id")
    .in("profile_id", requesterIds);

  const sessionCounts = {};
  if (assignments) {
    assignments.forEach((a) => {
      sessionCounts[a.profile_id] = (sessionCounts[a.profile_id] || 0) + 1;
    });
  }

  // Calculate rates and sort
  const ranked = Object.values(counts)
    .map((c) => {
      // Estimate total sessions (assignments * 10 weeks average)
      const totalSessions = (sessionCounts[c.id] || 1) * 10;
      const rate = Math.round((c.count / totalSessions) * 100);
      return {
        ...c,
        rate: `${rate}% of sessions`,
        isFlag: rate >= 10, // Flag if 10% or more
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return ranked;
}

/**
 * Get most reliable coverers ranked list
 */
export async function getReliableCoverers(period = "90") {
  const supabase = await createClient();

  // Calculate date range
  let startDate;
  const today = new Date();

  if (period === "30") {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === "90") {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 90);
  } else {
    const month = today.getMonth();
    const year = month >= 7 ? today.getFullYear() : today.getFullYear() - 1;
    startDate = new Date(year, 7, 1);
  }

  const startDateStr = formatDate(startDate);

  // Get all claimed requests in range
  const { data: requests } = await supabase
    .from("coverage_requests")
    .select(`
      claimed_by,
      claimer:claimed_by (
        id,
        full_name
      )
    `)
    .gte("date", startDateStr)
    .eq("status", "claimed");

  if (!requests || requests.length === 0) return [];

  // Count by claimer
  const counts = {};
  requests.forEach((r) => {
    if (!r.claimed_by) return;
    const id = r.claimed_by;
    if (!counts[id]) {
      counts[id] = {
        id,
        name: r.claimer?.full_name || "Unknown",
        count: 0,
      };
    }
    counts[id].count++;
  });

  // Sort and return top 5
  const ranked = Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return ranked;
}

/**
 * Get all districts for the admin coverage post modal
 */
export async function getDistrictsForCoverage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("districts")
    .select("id, name, color")
    .order("name");

  if (error) {
    console.error("Error fetching districts:", error);
    return [];
  }

  return data || [];
}

/**
 * Get schools for a specific district
 */
export async function getSchoolsForDistrict(districtId) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schools")
    .select("id, name")
    .eq("district_id", districtId)
    .order("name");

  if (error) {
    console.error("Error fetching schools:", error);
    return [];
  }

  return data || [];
}

/**
 * Get classes for a specific school with their assigned instructors
 */
export async function getClassesForSchool(schoolId) {
  const supabase = await createClient();

  // Get classes
  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select(`
      id,
      days,
      time,
      program,
      start_date,
      target_sessions
    `)
    .eq("school_id", schoolId)
    .order("time");

  if (classError) {
    console.error("Error fetching classes:", classError);
    return [];
  }

  if (!classes || classes.length === 0) {
    return [];
  }

  // Get instructors assigned to these classes
  const classIds = classes.map((c) => c.id);
  const { data: assignments, error: assignError } = await supabase
    .from("class_assignments")
    .select(`
      class_id,
      slot_type,
      profiles:profile_id (
        id,
        full_name
      )
    `)
    .in("class_id", classIds)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  if (assignError) {
    console.error("Error fetching class assignments:", assignError);
  }

  // Group assignments by class
  const assignmentsByClass = {};
  (assignments || []).forEach((a) => {
    if (!assignmentsByClass[a.class_id]) {
      assignmentsByClass[a.class_id] = [];
    }
    if (a.profiles) {
      assignmentsByClass[a.class_id].push({
        id: a.profiles.id,
        name: a.profiles.full_name,
        slot: a.slot_type,
      });
    }
  });

  // Format for display
  const DAYS_SHORT = { Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri" };

  return classes.map((c) => {
    const daysStr = c.days?.map((d) => DAYS_SHORT[d] || d).join("/") || "";
    const programName = c.program === "wellness" ? "Youth Wellness" : "Soccer";

    return {
      id: c.id,
      label: `${daysStr} ${c.time} · ${programName}`,
      days: c.days,
      time: c.time,
      program: c.program,
      startDate: c.start_date,
      targetSessions: c.target_sessions,
      instructors: assignmentsByClass[c.id] || [],
    };
  });
}

/**
 * Get upcoming occurrence dates for a class
 */
export async function getClassOccurrenceDates(classId, startDate, targetSessions, days) {
  const supabase = await createClient();
  const today = formatDate(new Date());

  // Get holidays and off-days
  const { data: holidays } = await supabase
    .from("holidays")
    .select("date")
    .gte("date", today);

  const { data: offDays } = await supabase
    .from("program_off_days")
    .select("date")
    .gte("date", today);

  const holidaySet = new Set((holidays || []).map((h) => h.date));
  const offDaySet = new Set((offDays || []).map((o) => o.date));

  // Get existing coverage requests for this class
  const { data: existingCoverage } = await supabase
    .from("coverage_requests")
    .select("date, status")
    .eq("class_id", classId)
    .in("status", ["open", "claimed"])
    .gte("date", today);

  const coveredDates = new Set(
    (existingCoverage || []).map((c) => c.date)
  );

  // Compute occurrences
  const occurrences = computeClassOccurrences(
    startDate,
    days,
    targetSessions,
    holidaySet,
    offDaySet
  );

  // Filter to future dates and exclude already covered dates
  const futureDates = occurrences
    .filter((dateStr) => dateStr >= today && !coveredDates.has(dateStr))
    .slice(0, 12); // Limit to next 12 occurrences

  // Format for dropdown
  const DAYS_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return futureDates.map((dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    const dow = DAYS_FULL[date.getDay()];
    const month = MONTHS[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    return {
      value: dateStr,
      label: `${dow}, ${month} ${day}, ${year}`,
    };
  });
}

/**
 * Admin creates a coverage request (posts to board on behalf of instructor)
 */
export async function adminCreateCoverageRequest(classId, date, instructorId, note = null) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Verify current user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    return { error: "Only admins can post coverage requests" };
  }

  // Verify the instructor exists and is active
  const { data: instructorProfile } = await supabase
    .from("profiles")
    .select("id, full_name, status")
    .eq("id", instructorId)
    .single();

  if (!instructorProfile) {
    return { error: "Instructor not found" };
  }

  // Check if a coverage request already exists for this session
  const { data: existing } = await supabase
    .from("coverage_requests")
    .select("id, status")
    .eq("class_id", classId)
    .eq("date", date)
    .in("status", ["open", "claimed"])
    .maybeSingle();

  if (existing) {
    return { error: "A coverage request already exists for this session" };
  }

  // Create the coverage request
  const { data, error } = await adminClient
    .from("coverage_requests")
    .insert({
      class_id: classId,
      date,
      requested_by: instructorId,
      posted_by: user.id,
      note: note?.trim() || null,
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating coverage request:", error);
    return { error: "Failed to create coverage request" };
  }

  revalidatePath("/admin/coverage");
  revalidatePath("/instructor/coverage");
  revalidatePath("/instructor/dashboard");

  return { success: true, id: data.id };
}

/**
 * Admin cancels a coverage request
 */
export async function adminCancelCoverageRequest(coverageId) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Verify current user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    return { error: "Only admins can cancel coverage requests" };
  }

  // Get the coverage request
  const { data: coverageRequest, error: fetchError } = await supabase
    .from("coverage_requests")
    .select("id, status")
    .eq("id", coverageId)
    .single();

  if (fetchError || !coverageRequest) {
    return { error: "Coverage request not found" };
  }

  if (coverageRequest.status === "cancelled") {
    return { error: "Coverage request is already cancelled" };
  }

  // Update status to cancelled
  const { error: updateError } = await adminClient
    .from("coverage_requests")
    .update({ status: "cancelled" })
    .eq("id", coverageId);

  if (updateError) {
    console.error("Error cancelling coverage request:", updateError);
    return { error: "Failed to cancel coverage request" };
  }

  revalidatePath("/admin/coverage");
  revalidatePath("/instructor/coverage");
  revalidatePath("/instructor/dashboard");

  return { success: true };
}
