"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendIncidentReportNotification } from "@/lib/email";

/**
 * Create an incident report (called by instructor form)
 */
export async function createIncidentReport(data) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Unauthorized" };
    }

  // Get submitter's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: "Profile not found" };
  }

  // Prepare the insert data (base fields that always exist)
  const insertData = {
    submitted_by: user.id,
    severity: data.severity,
    type: data.type,
    occurred_at: data.occurredAt,
    school_id: data.schoolId || null,
    location_note: data.locationNote || null,
    involved: data.involved || null,
    what_happened: data.whatHappened,
    actions_taken: data.actionsTaken,
    first_aid_administered: data.firstAidAdministered,
    staff_notified: data.staffNotified,
    staff_notified_name: data.staffNotified ? (data.staffNotifiedName || null) : null,
    parent_notified: data.parentNotified,
    witnesses: data.witnesses || null,
  };

  // Add new fields if provided (these columns may not exist until schema is updated)
  // The insert will include them, and if columns don't exist, we'll fall back
  if (data.coInstructorId !== undefined) insertData.co_instructor_id = data.coInstructorId || null;
  if (data.coInstructorOverride !== undefined) insertData.co_instructor_override = data.coInstructorOverride || null;
  if (data.activityContext !== undefined) insertData.activity_context = data.activityContext || null;
  if (data.photoUrl !== undefined) insertData.photo_url = data.photoUrl || null;
  if (data.certified !== undefined) insertData.certified = data.certified || false;

  // Insert the report - try with new fields first, fall back if columns don't exist
  let report;
  let insertError;

  ({ data: report, error: insertError } = await supabase
    .from("incident_reports")
    .insert(insertData)
    .select("id")
    .single());

  // If insert failed due to unknown column, retry without new fields
  // Check for various error formats from Supabase/PostgREST
  const isColumnError = insertError && (
    insertError.code === "PGRST204" ||
    insertError.code === "42703" ||
    insertError.message?.includes("column") ||
    insertError.message?.includes("does not exist") ||
    insertError.message?.includes("undefined")
  );

  if (isColumnError) {
    console.warn("New columns not found, retrying without them:", insertError.message);
    const baseData = {
      submitted_by: user.id,
      severity: data.severity,
      type: data.type,
      occurred_at: data.occurredAt,
      school_id: data.schoolId || null,
      location_note: data.locationNote || null,
      involved: data.involved || null,
      what_happened: data.whatHappened,
      actions_taken: data.actionsTaken,
      first_aid_administered: data.firstAidAdministered,
      staff_notified: data.staffNotified,
      staff_notified_name: data.staffNotified ? (data.staffNotifiedName || null) : null,
      parent_notified: data.parentNotified,
      witnesses: data.witnesses || null,
    };

    ({ data: report, error: insertError } = await supabase
      .from("incident_reports")
      .insert(baseData)
      .select("id")
      .single());
  }

  if (insertError) {
    console.error("Error creating incident report:", insertError);
    return { error: `Failed to submit report: ${insertError.message}` };
  }

  // Get school name for email
  let schoolName = "Other / not during a session";
  if (data.schoolId) {
    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", data.schoolId)
      .single();
    if (school) {
      schoolName = school.name;
    }
  }

  // Get all admin emails and send notification (don't fail submission if this fails)
  try {
    const adminClient = createAdminClient();
    const { data: admins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    const adminEmails = [];
    for (const admin of admins || []) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(admin.id);
      if (authUser?.user?.email) {
        adminEmails.push(authUser.user.email);
      }
    }

    // Send email notification to all admins
    if (adminEmails.length > 0) {
      await sendIncidentReportNotification({
        severity: data.severity,
        type: data.type,
        occurredAt: data.occurredAt,
        schoolName,
        submitterName: profile.full_name,
        firstAidAdministered: data.firstAidAdministered,
        staffNotified: data.staffNotified,
        staffNotifiedName: data.staffNotifiedName,
        parentNotified: data.parentNotified,
        whatHappened: data.whatHappened,
        actionsTaken: data.actionsTaken,
        adminEmails,
      });
    }
  } catch (emailError) {
    console.error("Failed to send incident report notification:", emailError);
    // Don't fail the submission if email/admin lookup fails
  }

  revalidatePath("/admin/incident-reports");

  return { success: true, id: report.id };
  } catch (err) {
    console.error("Unexpected error in createIncidentReport:", err);
    return { error: `Failed to submit report: ${err.message || "Unknown error"}` };
  }
}

/**
 * Get incident reports for admin dashboard
 */
export async function getIncidentReports(filters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("incident_reports")
    .select(`
      id,
      severity,
      type,
      occurred_at,
      school_id,
      location_note,
      involved,
      what_happened,
      actions_taken,
      first_aid_administered,
      staff_notified,
      staff_notified_name,
      parent_notified,
      witnesses,
      status,
      admin_notes,
      reviewed_by,
      reviewed_at,
      created_at,
      submitter:submitted_by (
        id,
        full_name
      ),
      school:school_id (
        id,
        name
      )
    `)
    .order("occurred_at", { ascending: false });

  // Apply status filter
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  // Apply serious filter
  if (filters.seriousOnly) {
    query = query.eq("severity", "serious");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching incident reports:", error);
    return [];
  }

  return (data || []).map((report) => ({
    id: report.id,
    severity: report.severity,
    type: report.type,
    occurredAt: report.occurred_at,
    schoolId: report.school_id,
    locationNote: report.location_note,
    school: report.school ? { id: report.school.id, name: report.school.name } : null,
    involved: report.involved,
    whatHappened: report.what_happened,
    actionsTaken: report.actions_taken,
    firstAidAdministered: report.first_aid_administered,
    staffNotified: report.staff_notified,
    staffNotifiedName: report.staff_notified_name,
    parentNotified: report.parent_notified,
    witnesses: report.witnesses,
    status: report.status,
    adminNotes: report.admin_notes,
    reviewedBy: report.reviewed_by,
    reviewedAt: report.reviewed_at,
    createdAt: report.created_at,
    submitter: report.submitter
      ? { id: report.submitter.id, name: report.submitter.full_name }
      : null,
  }));
}

/**
 * Get incident stats for admin dashboard
 */
export async function getIncidentStats() {
  const supabase = await createClient();

  // Get start of current month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString();

  // Count serious & unreviewed
  const { count: seriousUnreviewed } = await supabase
    .from("incident_reports")
    .select("id", { count: "exact", head: true })
    .eq("severity", "serious")
    .eq("status", "open");

  // Count awaiting review (status = 'open')
  const { count: awaitingReview } = await supabase
    .from("incident_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  // Count filed this month
  const { count: filedThisMonth } = await supabase
    .from("incident_reports")
    .select("id", { count: "exact", head: true })
    .gte("created_at", monthStartStr);

  return {
    seriousUnreviewed: seriousUnreviewed || 0,
    awaitingReview: awaitingReview || 0,
    filedThisMonth: filedThisMonth || 0,
  };
}

/**
 * Get count of open incident reports (for sidebar badge)
 */
export async function getOpenIncidentCount() {
  const supabase = await createClient();

  const { count } = await supabase
    .from("incident_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  return count || 0;
}

/**
 * Update incident status (admin action)
 */
export async function updateIncidentStatus(reportId, status, adminNotes) {
  const supabase = await createClient();

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
    return { error: "Only admins can update incident reports" };
  }

  // Build update data
  const updateData = {
    status,
    admin_notes: adminNotes || null,
  };

  // Set reviewed_by and reviewed_at when status changes to reviewed or closed
  if (status === "reviewed" || status === "closed") {
    updateData.reviewed_by = user.id;
    updateData.reviewed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("incident_reports")
    .update(updateData)
    .eq("id", reportId);

  if (error) {
    console.error("Error updating incident report:", error);
    return { error: "Failed to update report" };
  }

  revalidatePath("/admin/incident-reports");

  return { success: true };
}

/**
 * Get instructor's assigned schools for the incident form
 * Also returns class IDs for co-instructor lookup
 */
export async function getInstructorSchools() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Get schools through class assignments
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select(`
      classes:class_id (
        id,
        time,
        days,
        school:school_id (
          id,
          name
        )
      )
    `)
    .eq("profile_id", user.id);

  if (!assignments || assignments.length === 0) {
    return [];
  }

  // Build unique school list with session info and class IDs
  const schoolMap = new Map();
  const DAYS_SHORT = { Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri" };

  assignments.forEach((a) => {
    const classInfo = a.classes;
    if (!classInfo?.school) return;

    const school = classInfo.school;
    const daysStr = classInfo.days?.map((d) => DAYS_SHORT[d] || d).join("/") || "";
    const sessionLabel = `${daysStr} ${classInfo.time} session`;

    // Use school id as key, append session info
    const key = school.id;
    if (schoolMap.has(key)) {
      const existing = schoolMap.get(key);
      if (!existing.sessions.includes(sessionLabel)) {
        existing.sessions.push(sessionLabel);
      }
      if (!existing.classIds.includes(classInfo.id)) {
        existing.classIds.push(classInfo.id);
      }
    } else {
      schoolMap.set(key, {
        id: school.id,
        name: school.name,
        sessions: [sessionLabel],
        classIds: [classInfo.id],
      });
    }
  });

  // Convert to array and format labels
  return Array.from(schoolMap.values()).map((school) => ({
    id: school.id,
    name: school.name,
    label: `${school.name} (${school.sessions.join(", ")})`,
    classIds: school.classIds,
  }));
}

/**
 * Get co-instructor for a given school (looks up the other instructor in shared classes)
 */
export async function getCoInstructorForSchool(schoolId) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !schoolId) {
    return null;
  }

  // Find classes at this school that the current user is assigned to
  const { data: myAssignments } = await supabase
    .from("class_assignments")
    .select(`
      class_id,
      classes:class_id (
        school_id
      )
    `)
    .eq("profile_id", user.id);

  if (!myAssignments) return null;

  // Get class IDs at this school
  const classIds = myAssignments
    .filter((a) => a.classes?.school_id === schoolId)
    .map((a) => a.class_id);

  if (classIds.length === 0) return null;

  // Find other instructors assigned to these classes
  const { data: coAssignments } = await supabase
    .from("class_assignments")
    .select(`
      profile_id,
      profiles:profile_id (
        id,
        full_name
      )
    `)
    .in("class_id", classIds)
    .neq("profile_id", user.id)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  if (!coAssignments || coAssignments.length === 0) return null;

  // Return the first co-instructor found
  const coInstructor = coAssignments[0]?.profiles;
  if (!coInstructor) return null;

  return {
    id: coInstructor.id,
    name: coInstructor.full_name,
    initials: coInstructor.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
  };
}

/**
 * Upload incident photo to Supabase Storage
 */
export async function uploadIncidentPhoto(formData) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { error: "No file provided" };
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "Invalid file type. Please upload a JPEG, PNG, or WebP image." };
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { error: "File too large. Maximum size is 10MB." };
  }

  // Generate unique filename
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from("incident-photos")
    .upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Error uploading photo:", error);
    return { error: "Failed to upload photo. Please try again." };
  }

  return { path: data.path };
}
