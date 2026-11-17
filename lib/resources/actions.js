"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Extract page count from PDF buffer by parsing the PDF structure.
 * Looks for /Count entries in the page tree.
 */
function extractPageCount(buffer) {
  try {
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder("latin1").decode(bytes);

    // Look for /Count N in the PDF (page tree root)
    const countMatches = text.match(/\/Count\s+(\d+)/g);
    if (countMatches && countMatches.length > 0) {
      // Find the largest count (root page tree)
      let maxCount = 0;
      for (const match of countMatches) {
        const num = parseInt(match.match(/\d+/)[0], 10);
        if (num > maxCount) maxCount = num;
      }
      if (maxCount > 0) return maxCount;
    }

    // Fallback: count /Type /Page entries
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    if (pageMatches) {
      return pageMatches.length;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Upload a new version of a resource (e.g., employee handbook).
 *
 * @param {string} key - Resource key (e.g., "handbook")
 * @param {FormData} formData - Form data with file and versionLabel
 */
export async function uploadResource(key, formData) {
  const supabase = await createClient();

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check admin role
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: "Only admins can upload resources" };
  }

  const file = formData.get("file");
  const versionLabel = formData.get("versionLabel");

  if (!file || !(file instanceof File)) {
    return { error: "No file provided" };
  }

  // Check file size (10 MB max)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { error: "File is too large. Maximum size is 10 MB." };
  }

  // Read first bytes to verify PDF magic number
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);

  if (magic !== "%PDF") {
    return { error: "File must be a PDF. Please upload a valid PDF file." };
  }

  // Extract page count
  const pageCount = extractPageCount(buffer);

  // Create safe filename
  const timestamp = Date.now();
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");
  const filePath = `${key}/${timestamp}-${safeName}`;

  // Upload to storage
  const { error: uploadError } = await adminClient
    .storage
    .from("resources")
    .upload(filePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return { error: "Failed to upload file. Please try again." };
  }

  // Update the resources table with file metadata
  const { error: updateError } = await adminClient
    .from("resources")
    .update({
      file_path: filePath,
      version_label: versionLabel || null,
      file_name: file.name,
      file_size: file.size,
      page_count: pageCount,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("key", key);

  if (updateError) {
    console.error("Update error:", updateError);
    return { error: "File uploaded but failed to update record." };
  }

  revalidatePath("/instructor/forms");
  revalidatePath("/admin/resources");

  return { success: true, filePath, pageCount };
}

/**
 * Get version history for a resource.
 */
export async function getResourceHistory(key) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .storage
    .from("resources")
    .list(key, {
      sortBy: { column: "created_at", order: "desc" },
      limit: 10,
    });

  if (error) {
    console.error("Error listing files:", error);
    return [];
  }

  return (data || []).filter(f => f.name && f.name.endsWith(".pdf"));
}

/**
 * Create a signed URL for a specific file (for admin viewing old versions).
 */
export async function getSignedUrl(filePath) {
  const supabase = await createClient();

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check admin role
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: "Only admins can access this" };
  }

  const { data, error } = await adminClient
    .storage
    .from("resources")
    .createSignedUrl(filePath, 300);

  if (error) {
    console.error("Error creating signed URL:", error);
    return { error: "Failed to create download link" };
  }

  return { url: data.signedUrl };
}
