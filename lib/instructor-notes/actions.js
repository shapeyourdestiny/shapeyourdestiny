"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendSharedNoteEmail } from "@/lib/email";

/**
 * Helper to verify caller is admin.
 */
async function verifyAdmin(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", isAdmin: false, userId: null };
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin") {
    return { error: "Forbidden", isAdmin: false, userId: null };
  }

  return { isAdmin: true, userId: user.id, profileId: callerProfile.id };
}

/**
 * Validate note details based on type.
 */
function validateNoteDetails(type, details) {
  switch (type) {
    case "review":
      // Ratings should be 1-5
      if (details.ratings) {
        for (const [key, value] of Object.entries(details.ratings)) {
          if (typeof value === "number" && (value < 1 || value > 5)) {
            return { error: `Invalid rating for ${key}` };
          }
        }
      }
      break;

    case "pay":
      if (details.rate_to !== undefined && details.rate_to !== null) {
        const rate = parseFloat(details.rate_to);
        if (isNaN(rate) || rate < 0) {
          return { error: "Invalid pay rate" };
        }
      }
      break;

    case "disciplinary":
      const validSteps = ["verbal", "written", "final", "suspension"];
      if (details.step && !validSteps.includes(details.step)) {
        return { error: "Invalid disciplinary step" };
      }
      break;
  }

  return { valid: true };
}

/**
 * Create a new instructor note.
 */
export async function createNote(profileId, data) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  // Validate required fields
  if (!data.type) {
    return { error: "Note type is required" };
  }

  const title = (data.title || "").trim();
  if (!title) {
    return { error: "Title is required" };
  }

  // Validate details based on type
  const validation = validateNoteDetails(data.type, data.details || {});
  if (validation.error) {
    return { error: validation.error };
  }

  const adminClient = createAdminClient();

  // Prepare the note data
  const noteData = {
    profile_id: profileId,
    type: data.type,
    title,
    note_date: data.note_date || new Date().toISOString().split("T")[0],
    body: (data.body || "").trim() || null,
    details: data.details || {},
    follow_up_date: data.follow_up_date || null,
    created_by: auth.profileId,
  };

  const { data: newNote, error } = await adminClient
    .from("instructor_notes")
    .insert(noteData)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating note:", error);
    return { error: "Failed to create note" };
  }

  // If this is a pay note, update the instructor_pay_rates table
  if (data.type === "pay" && data.details?.rate_to !== undefined) {
    const { error: payError } = await adminClient
      .from("instructor_pay_rates")
      .upsert({
        profile_id: profileId,
        rate_per_class: parseFloat(data.details.rate_to),
        updated_at: new Date().toISOString(),
        updated_by: auth.profileId,
      }, {
        onConflict: "profile_id",
      });

    if (payError) {
      console.error("Error updating pay rate:", payError);
      // Don't fail the note creation, just log the error
    }
  }

  revalidatePath(`/admin/instructors/${profileId}`);
  revalidatePath("/admin/instructors");

  return { success: true, noteId: newNote.id };
}

/**
 * Update an existing instructor note.
 * This triggers the version history snapshot via database trigger.
 */
export async function updateNote(noteId, data) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // First get the existing note to find the profile_id
  const { data: existingNote, error: fetchError } = await adminClient
    .from("instructor_notes")
    .select("profile_id, type")
    .eq("id", noteId)
    .single();

  if (fetchError || !existingNote) {
    return { error: "Note not found" };
  }

  // Validate details if provided
  if (data.details) {
    const validation = validateNoteDetails(existingNote.type, data.details);
    if (validation.error) {
      return { error: validation.error };
    }
  }

  // Build update object
  const updateData = {};

  if (data.title !== undefined) {
    const title = (data.title || "").trim();
    if (!title) {
      return { error: "Title is required" };
    }
    updateData.title = title;
  }

  if (data.note_date !== undefined) {
    updateData.note_date = data.note_date;
  }

  if (data.body !== undefined) {
    updateData.body = (data.body || "").trim() || null;
  }

  if (data.details !== undefined) {
    updateData.details = data.details;
  }

  if (data.follow_up_date !== undefined) {
    updateData.follow_up_date = data.follow_up_date || null;
  }

  if (Object.keys(updateData).length === 0) {
    return { error: "No changes provided" };
  }

  const { error } = await adminClient
    .from("instructor_notes")
    .update(updateData)
    .eq("id", noteId);

  if (error) {
    console.error("Error updating note:", error);
    return { error: "Failed to update note" };
  }

  // If this is a pay note and rate changed, update pay rates
  if (existingNote.type === "pay" && data.details?.rate_to !== undefined) {
    const { error: payError } = await adminClient
      .from("instructor_pay_rates")
      .upsert({
        profile_id: existingNote.profile_id,
        rate_per_class: parseFloat(data.details.rate_to),
        updated_at: new Date().toISOString(),
        updated_by: auth.profileId,
      }, {
        onConflict: "profile_id",
      });

    if (payError) {
      console.error("Error updating pay rate:", payError);
    }
  }

  revalidatePath(`/admin/instructors/${existingNote.profile_id}`);
  revalidatePath("/admin/instructors");

  return { success: true };
}

/**
 * Archive a note (soft delete).
 */
export async function archiveNote(noteId) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Get the profile_id for revalidation
  const { data: note, error: fetchError } = await adminClient
    .from("instructor_notes")
    .select("profile_id")
    .eq("id", noteId)
    .single();

  if (fetchError || !note) {
    return { error: "Note not found" };
  }

  const { error } = await adminClient
    .from("instructor_notes")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: auth.profileId,
    })
    .eq("id", noteId);

  if (error) {
    console.error("Error archiving note:", error);
    return { error: "Failed to archive note" };
  }

  revalidatePath(`/admin/instructors/${note.profile_id}`);
  revalidatePath("/admin/instructors");

  return { success: true };
}

/**
 * Restore an archived note.
 */
export async function restoreNote(noteId) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Get the profile_id for revalidation
  const { data: note, error: fetchError } = await adminClient
    .from("instructor_notes")
    .select("profile_id")
    .eq("id", noteId)
    .single();

  if (fetchError || !note) {
    return { error: "Note not found" };
  }

  const { error } = await adminClient
    .from("instructor_notes")
    .update({
      archived_at: null,
      archived_by: null,
    })
    .eq("id", noteId);

  if (error) {
    console.error("Error restoring note:", error);
    return { error: "Failed to restore note" };
  }

  revalidatePath(`/admin/instructors/${note.profile_id}`);
  revalidatePath("/admin/instructors");

  return { success: true };
}

/**
 * Permanently delete a note (for testing/cleanup).
 */
export async function deleteNote(noteId) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Get the profile_id for revalidation
  const { data: note, error: fetchError } = await adminClient
    .from("instructor_notes")
    .select("profile_id")
    .eq("id", noteId)
    .single();

  if (fetchError || !note) {
    return { error: "Note not found" };
  }

  // Delete associated files from storage first
  const { data: files } = await adminClient
    .from("instructor_note_files")
    .select("storage_path")
    .eq("note_id", noteId);

  if (files && files.length > 0) {
    const paths = files.map((f) => f.storage_path);
    await adminClient.storage.from("instructor-notes").remove(paths);
  }

  // Delete the note (cascades to files and versions)
  const { error } = await adminClient
    .from("instructor_notes")
    .delete()
    .eq("id", noteId);

  if (error) {
    console.error("Error deleting note:", error);
    return { error: "Failed to delete note" };
  }

  revalidatePath(`/admin/instructors/${note.profile_id}`);
  revalidatePath("/admin/instructors");

  return { success: true };
}

/**
 * Mark a follow-up as complete.
 */
export async function completeFollowUp(noteId, followUpNote = null) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Get the profile_id for revalidation
  const { data: note, error: fetchError } = await adminClient
    .from("instructor_notes")
    .select("profile_id")
    .eq("id", noteId)
    .single();

  if (fetchError || !note) {
    return { error: "Note not found" };
  }

  const { error } = await adminClient
    .from("instructor_notes")
    .update({
      follow_up_done_at: new Date().toISOString(),
      follow_up_note: followUpNote?.trim() || null,
    })
    .eq("id", noteId);

  if (error) {
    console.error("Error completing follow-up:", error);
    return { error: "Failed to complete follow-up" };
  }

  revalidatePath(`/admin/instructors/${note.profile_id}`);
  revalidatePath("/admin/instructors");

  return { success: true };
}

/**
 * Upload a file attachment to a note.
 */
export async function uploadNoteFile(noteId, formData) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { error: "No file provided" };
  }

  const adminClient = createAdminClient();

  // Get the note to verify it exists and get profile_id
  const { data: note, error: fetchError } = await adminClient
    .from("instructor_notes")
    .select("profile_id")
    .eq("id", noteId)
    .single();

  if (fetchError || !note) {
    return { error: "Note not found" };
  }

  // Create unique filename
  const ext = file.name.split(".").pop();
  const timestamp = Date.now();
  const storagePath = `${note.profile_id}/${noteId}/${timestamp}.${ext}`;

  // Upload to storage
  const { error: uploadError } = await adminClient.storage
    .from("instructor-notes")
    .upload(storagePath, file);

  if (uploadError) {
    console.error("Error uploading file:", uploadError);
    return { error: "Failed to upload file" };
  }

  // Create file record
  const { data: fileRecord, error: insertError } = await adminClient
    .from("instructor_note_files")
    .insert({
      note_id: noteId,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      created_by: auth.profileId,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating file record:", insertError);
    // Try to clean up uploaded file
    await adminClient.storage.from("instructor-notes").remove([storagePath]);
    return { error: "Failed to save file record" };
  }

  revalidatePath(`/admin/instructors/${note.profile_id}`);

  return { success: true, fileId: fileRecord.id };
}

/**
 * Remove a file attachment from a note.
 */
export async function removeNoteFile(fileId) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Get the file record
  const { data: file, error: fetchError } = await adminClient
    .from("instructor_note_files")
    .select("storage_path, note_id, notes:note_id(profile_id)")
    .eq("id", fileId)
    .single();

  if (fetchError || !file) {
    return { error: "File not found" };
  }

  // Delete from storage
  const { error: deleteStorageError } = await adminClient.storage
    .from("instructor-notes")
    .remove([file.storage_path]);

  if (deleteStorageError) {
    console.error("Error deleting file from storage:", deleteStorageError);
    // Continue to delete the record anyway
  }

  // Delete the record
  const { error: deleteError } = await adminClient
    .from("instructor_note_files")
    .delete()
    .eq("id", fileId);

  if (deleteError) {
    console.error("Error deleting file record:", deleteError);
    return { error: "Failed to delete file" };
  }

  if (file.notes?.profile_id) {
    revalidatePath(`/admin/instructors/${file.notes.profile_id}`);
  }

  return { success: true };
}

/**
 * Get a signed URL for a file.
 */
export async function getFileUrl(fileId) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Get the file record
  const { data: file, error: fetchError } = await adminClient
    .from("instructor_note_files")
    .select("storage_path, file_name")
    .eq("id", fileId)
    .single();

  if (fetchError || !file) {
    return { error: "File not found" };
  }

  // Generate signed URL (valid for 1 hour)
  const { data: signedData, error: signError } = await adminClient.storage
    .from("instructor-notes")
    .createSignedUrl(file.storage_path, 3600);

  if (signError || !signedData?.signedUrl) {
    console.error("Error creating signed URL:", signError);
    return { error: "Failed to generate file URL" };
  }

  return { success: true, url: signedData.signedUrl, fileName: file.file_name };
}

/**
 * Share a note with the instructor.
 * Only works for review, recognition, and disciplinary notes.
 */
export async function shareNote(noteId, sendEmail = true) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Get the note
  const { data: note, error: fetchError } = await adminClient
    .from("instructor_notes")
    .select(`
      id, profile_id, type, title, shared_at, archived_at,
      instructor:profile_id (id, full_name, email)
    `)
    .eq("id", noteId)
    .single();

  if (fetchError || !note) {
    return { error: "Note not found" };
  }

  // Only certain types can be shared
  const shareableTypes = ["review", "recognition", "disciplinary"];
  if (!shareableTypes.includes(note.type)) {
    return { error: "This type of note cannot be shared" };
  }

  // Can't share archived notes
  if (note.archived_at) {
    return { error: "Cannot share an archived note" };
  }

  // Update the note
  const { error: updateError } = await adminClient
    .from("instructor_notes")
    .update({
      shared_at: new Date().toISOString(),
      shared_by: auth.profileId,
      unshared_at: null, // Clear if re-sharing
    })
    .eq("id", noteId);

  if (updateError) {
    console.error("Error sharing note:", updateError);
    return { error: "Failed to share note" };
  }

  // Send email notification
  if (sendEmail && note.instructor?.email) {
    try {
      await sendSharedNoteEmail({
        to: note.instructor.email,
        firstName: note.instructor.full_name?.split(" ")[0] || "there",
        noteType: note.type,
      });
    } catch (emailError) {
      console.error("Failed to send share email:", emailError);
      // Don't fail the action if email fails
    }
  }

  revalidatePath(`/admin/instructors/${note.profile_id}`);
  revalidatePath("/admin/inbox");

  return { success: true };
}

/**
 * Unshare a note from the instructor.
 */
export async function unshareNote(noteId) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Get the note
  const { data: note, error: fetchError } = await adminClient
    .from("instructor_notes")
    .select("id, profile_id, shared_at")
    .eq("id", noteId)
    .single();

  if (fetchError || !note) {
    return { error: "Note not found" };
  }

  if (!note.shared_at) {
    return { error: "Note is not shared" };
  }

  // Update the note
  const { error: updateError } = await adminClient
    .from("instructor_notes")
    .update({
      unshared_at: new Date().toISOString(),
    })
    .eq("id", noteId);

  if (updateError) {
    console.error("Error unsharing note:", updateError);
    return { error: "Failed to unshare note" };
  }

  revalidatePath(`/admin/instructors/${note.profile_id}`);
  revalidatePath("/admin/inbox");

  return { success: true };
}

/**
 * Mark an instructor reply/acknowledgment as done in admin inbox.
 */
export async function markReplyDone(noteId) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Get the note
  const { data: note, error: fetchError } = await adminClient
    .from("instructor_notes")
    .select("id, profile_id")
    .eq("id", noteId)
    .single();

  if (fetchError || !note) {
    return { error: "Note not found" };
  }

  // Mark as done
  const { error: updateError } = await adminClient
    .from("instructor_notes")
    .update({
      admin_marked_done_at: new Date().toISOString(),
      admin_marked_done_by: auth.profileId,
    })
    .eq("id", noteId);

  if (updateError) {
    console.error("Error marking reply done:", updateError);
    return { error: "Failed to mark as done" };
  }

  revalidatePath(`/admin/instructors/${note.profile_id}`);
  revalidatePath("/admin/inbox");

  return { success: true };
}
