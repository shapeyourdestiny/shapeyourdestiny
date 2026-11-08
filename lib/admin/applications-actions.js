"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Verify the user is an admin and return their profile.
 */
async function verifyAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile || profile.role !== "admin") return null;
  return profile;
}

/**
 * Mark an application as opened (first time any admin views it).
 */
export async function markApplicationOpened(id) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const now = new Date().toISOString();

  // Only update if not already opened
  const { error } = await supabase
    .from("instructor_applications")
    .update({ opened_at: now })
    .eq("id", id)
    .is("opened_at", null);

  if (error) {
    console.error("Error marking application opened:", error);
    return { error: "Failed to mark as opened" };
  }

  // Mark as done in admin inbox
  await supabase
    .from("admin_inbox_done")
    .upsert({
      item_type: "application",
      item_id: id,
      done_by: admin.id,
      done_at: now,
    });

  revalidatePath("/admin/applications");
  revalidatePath("/admin/inbox");

  return { success: true };
}

/**
 * Update application status.
 */
export async function updateApplicationStatus(id, newStatus) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const validStatuses = ["new", "reviewing", "interview", "hired", "not_a_fit"];
  if (!validStatuses.includes(newStatus)) {
    return { error: "Invalid status" };
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("instructor_applications")
    .update({
      status: newStatus,
      status_changed_at: now,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating application status:", error);
    return { error: "Failed to update status" };
  }

  // Add system note
  const statusLabels = {
    new: "New",
    reviewing: "Reviewing",
    interview: "Interview",
    hired: "Hired",
    not_a_fit: "Not a fit",
  };

  const firstName = admin.full_name?.split(" ")[0] || "Admin";

  await supabase.from("instructor_application_notes").insert({
    application_id: id,
    author_id: admin.id,
    body: `${firstName} moved this to ${statusLabels[newStatus]}`,
    is_system: true,
  });

  revalidatePath("/admin/applications");

  return { success: true };
}

/**
 * Add a note to an application.
 */
export async function addApplicationNote(id, body) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const trimmedBody = (body || "").trim();
  if (!trimmedBody) {
    return { error: "Note cannot be empty" };
  }

  const { error } = await supabase.from("instructor_application_notes").insert({
    application_id: id,
    author_id: admin.id,
    body: trimmedBody,
    is_system: false,
  });

  if (error) {
    console.error("Error adding application note:", error);
    return { error: "Failed to add note" };
  }

  revalidatePath("/admin/applications");

  return { success: true };
}

/**
 * Get a signed URL for the resume.
 */
export async function getResumeSignedUrl(resumePath) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.storage
    .from("resumes")
    .createSignedUrl(resumePath, 600); // 10 minutes

  if (error) {
    console.error("Error creating signed URL:", error);
    return { error: "Failed to generate resume URL" };
  }

  return { url: data.signedUrl };
}

/**
 * Update hiring settings.
 */
export async function updateHiringSettings(settings) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const { hiring_open, notify_emails } = settings;

  const updateData = {
    updated_at: new Date().toISOString(),
  };

  if (typeof hiring_open === "boolean") {
    updateData.hiring_open = hiring_open;
  }

  if (Array.isArray(notify_emails)) {
    // Validate emails
    const validEmails = notify_emails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    updateData.notify_emails = validEmails;
  }

  const { error } = await supabase
    .from("hiring_settings")
    .update(updateData)
    .eq("id", 1);

  if (error) {
    console.error("Error updating hiring settings:", error);
    return { error: "Failed to update settings" };
  }

  revalidatePath("/admin/applications");
  revalidatePath("/join");

  return { success: true };
}

/**
 * Add applicant as instructor.
 * Uses the existing pre-create flow from lib/instructors/actions.js.
 */
export async function addApplicantAsInstructor(applicationId) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  // Get the application
  const { data: application, error: appError } = await supabase
    .from("instructor_applications")
    .select("id, first_name, last_name, email, phone, profile_id")
    .eq("id", applicationId)
    .single();

  if (appError || !application) {
    return { error: "Application not found" };
  }

  // Check if already added
  if (application.profile_id) {
    return { error: "Already added as instructor", profileId: application.profile_id };
  }

  // Check if instructor with this email already exists
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id, full_name")
    .eq("email", application.email.toLowerCase())
    .eq("role", "instructor")
    .single();

  if (existingProfile) {
    return {
      error: "There's already an instructor with this email",
      existingProfileId: existingProfile.id,
      existingName: existingProfile.full_name,
    };
  }

  // Create the instructor profile
  const fullName = `${application.first_name} ${application.last_name}`.trim();

  const { data: newProfile, error: insertError } = await adminClient
    .from("profiles")
    .insert({
      full_name: fullName,
      email: application.email.toLowerCase(),
      phone: application.phone,
      role: "instructor",
      status: "not_invited",
      staff_section: "instructor",
      show_on_staff_page: true,
      staff_sort_order: 999,
      user_id: null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating instructor profile:", insertError);
    return { error: "Failed to create instructor: " + insertError.message };
  }

  // Update application with profile_id
  await supabase
    .from("instructor_applications")
    .update({ profile_id: newProfile.id })
    .eq("id", applicationId);

  // Add system note
  const adminFirstName = admin.full_name?.split(" ")[0] || "Admin";
  await supabase.from("instructor_application_notes").insert({
    application_id: applicationId,
    author_id: admin.id,
    body: `${adminFirstName} added this person as an instructor`,
    is_system: true,
  });

  revalidatePath("/admin/applications");
  revalidatePath("/admin/instructors");

  return { success: true, profileId: newProfile.id };
}
