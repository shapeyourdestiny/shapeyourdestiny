"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Verify caller is admin.
 */
async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated", isAdmin: false };
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: "Only admins can do this", isAdmin: false };
  }

  return { isAdmin: true, profileId: profile.id, adminClient };
}

/**
 * Generate a URL-safe key from a title.
 */
function generateKey(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/**
 * Validate URL is https.
 */
function isValidHttpsUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

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
  const auth = await verifyAdmin();
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const { profileId, adminClient } = auth;

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
      updated_by: profileId,
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
  const auth = await verifyAdmin();
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const { data, error } = await auth.adminClient
    .storage
    .from("resources")
    .createSignedUrl(filePath, 300);

  if (error) {
    console.error("Error creating signed URL:", error);
    return { error: "Failed to create download link" };
  }

  return { url: data.signedUrl };
}

/**
 * Create a new resource (file or link).
 */
export async function createResource(data) {
  const auth = await verifyAdmin();
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const { adminClient, profileId } = auth;

  // Validate required fields
  const title = (data.title || "").trim();
  if (!title) {
    return { error: "Title is required" };
  }
  if (title.length > 60) {
    return { error: "Title must be 60 characters or less" };
  }

  const subtitle = (data.subtitle || "").trim();
  if (subtitle.length > 80) {
    return { error: "Description must be 80 characters or less" };
  }

  const kind = data.kind || "file";
  if (!["file", "link"].includes(kind)) {
    return { error: "Invalid resource type" };
  }

  const icon = data.icon || "book";
  if (!["book", "shield", "video", "link", "form", "folder"].includes(icon)) {
    return { error: "Invalid icon" };
  }

  // For links, validate URL
  let url = null;
  if (kind === "link") {
    url = (data.url || "").trim();
    if (!url) {
      return { error: "URL is required for links" };
    }
    if (!isValidHttpsUrl(url)) {
      return { error: "URL must start with https://" };
    }
  }

  // Generate key from title
  let key = generateKey(title);

  // Check if key exists
  const { data: existing } = await adminClient
    .from("resources")
    .select("key")
    .eq("key", key)
    .maybeSingle();

  if (existing) {
    // Add random suffix
    key = `${key}-${Date.now().toString(36)}`;
  }

  // Get max sort_order
  const { data: maxRow } = await adminClient
    .from("resources")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxRow?.sort_order || 0) + 10;

  // Create the resource
  const resourceData = {
    key,
    title,
    subtitle: subtitle || null,
    kind,
    icon,
    url,
    sort_order: sortOrder,
    visible: true,
    created_at: new Date().toISOString(),
    updated_by: profileId,
  };

  const { data: newResource, error: insertError } = await adminClient
    .from("resources")
    .insert(resourceData)
    .select("*")
    .single();

  if (insertError) {
    console.error("Error creating resource:", insertError);
    return { error: "Failed to create resource" };
  }

  revalidatePath("/instructor/forms");
  revalidatePath("/admin/resources");

  return { success: true, resource: newResource };
}

/**
 * Update a resource.
 */
export async function updateResource(key, data) {
  const auth = await verifyAdmin();
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const { adminClient, profileId } = auth;

  // Build update object
  const updateData = { updated_by: profileId };

  if (data.title !== undefined) {
    const title = (data.title || "").trim();
    if (!title) {
      return { error: "Title is required" };
    }
    if (title.length > 60) {
      return { error: "Title must be 60 characters or less" };
    }
    updateData.title = title;
  }

  if (data.subtitle !== undefined) {
    const subtitle = (data.subtitle || "").trim();
    if (subtitle.length > 80) {
      return { error: "Description must be 80 characters or less" };
    }
    updateData.subtitle = subtitle || null;
  }

  if (data.icon !== undefined) {
    if (!["book", "shield", "video", "link", "form", "folder"].includes(data.icon)) {
      return { error: "Invalid icon" };
    }
    updateData.icon = data.icon;
  }

  if (data.url !== undefined) {
    const url = (data.url || "").trim();
    if (url && !isValidHttpsUrl(url)) {
      return { error: "URL must start with https://" };
    }
    updateData.url = url || null;
  }

  if (data.visible !== undefined) {
    updateData.visible = !!data.visible;
  }

  if (data.sort_order !== undefined) {
    updateData.sort_order = data.sort_order;
  }

  const { error: updateError } = await adminClient
    .from("resources")
    .update(updateData)
    .eq("key", key);

  if (updateError) {
    console.error("Error updating resource:", updateError);
    return { error: "Failed to update resource" };
  }

  revalidatePath("/instructor/forms");
  revalidatePath("/admin/resources");

  return { success: true };
}

/**
 * Archive a resource (soft delete).
 */
export async function archiveResource(key) {
  const auth = await verifyAdmin();
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const { adminClient } = auth;

  // Don't allow archiving handbook or lesson_plans
  if (["handbook", "lesson_plans"].includes(key)) {
    return { error: "This resource cannot be removed" };
  }

  const { error: updateError } = await adminClient
    .from("resources")
    .update({ archived_at: new Date().toISOString() })
    .eq("key", key);

  if (updateError) {
    console.error("Error archiving resource:", updateError);
    return { error: "Failed to remove resource" };
  }

  revalidatePath("/instructor/forms");
  revalidatePath("/admin/resources");

  return { success: true };
}

/**
 * Swap sort orders of two resources.
 */
export async function swapResourceOrder(key1, key2) {
  const auth = await verifyAdmin();
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const { adminClient } = auth;

  // Get both resources
  const { data: resources, error: fetchError } = await adminClient
    .from("resources")
    .select("key, sort_order")
    .in("key", [key1, key2]);

  if (fetchError || !resources || resources.length !== 2) {
    return { error: "Resources not found" };
  }

  const r1 = resources.find(r => r.key === key1);
  const r2 = resources.find(r => r.key === key2);

  // Swap sort orders
  const { error: e1 } = await adminClient
    .from("resources")
    .update({ sort_order: r2.sort_order })
    .eq("key", key1);

  const { error: e2 } = await adminClient
    .from("resources")
    .update({ sort_order: r1.sort_order })
    .eq("key", key2);

  if (e1 || e2) {
    console.error("Error swapping order:", e1 || e2);
    return { error: "Failed to reorder resources" };
  }

  revalidatePath("/instructor/forms");
  revalidatePath("/admin/resources");

  return { success: true };
}
