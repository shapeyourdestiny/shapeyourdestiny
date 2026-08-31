"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendIncidentReportNotification } from "@/lib/email";

/**
 * Create an incident report (called by instructor form)
 */
export async function createIncidentReport(data) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

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

  // Prepare the insert data
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

  // Insert the report
  const { data: report, error: insertError } = await supabase
    .from("incident_reports")
    .insert(insertData)
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating incident report:", insertError);
    return { error: "Failed to submit report. Please try again." };
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

  // Get all admin emails
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
    try {
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
    } catch (emailError) {
      console.error("Failed to send incident report notification:", emailError);
      // Don't fail the submission if email fails
    }
  }

  revalidatePath("/admin/incident-reports");

  return { success: true, id: report.id };
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

  // Build unique school list with session info
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
    } else {
      schoolMap.set(key, {
        id: school.id,
        name: school.name,
        sessions: [sessionLabel],
      });
    }
  });

  // Convert to array and format labels
  return Array.from(schoolMap.values()).map((school) => ({
    id: school.id,
    name: school.name,
    label: `${school.name} (${school.sessions.join(", ")})`,
  }));
}
