import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNewApplicationEmail, sendApplicationReceivedEmail } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { PDFDocument } from "pdf-lib";
import crypto from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const RATE_LIMIT_IP_COUNT = 3;
const RATE_LIMIT_IP_WINDOW_HOURS = 1;
const RATE_LIMIT_EMAIL_WINDOW_HOURS = 24;
const MIN_SUBMIT_TIME_MS = 3000; // 3 seconds

/**
 * Check file type by magic bytes
 */
function getFileTypeFromBytes(buffer) {
  const bytes = new Uint8Array(buffer.slice(0, 8));

  // PDF: starts with %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "pdf";
  }

  // DOC (OLE Compound Document): D0 CF 11 E0 A1 B1 1A E1
  if (
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  ) {
    return "doc";
  }

  // DOCX (ZIP): 50 4B 03 04 or 50 4B 05 06 or 50 4B 07 08
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    if (
      (bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08)
    ) {
      return "docx";
    }
  }

  return null;
}

/**
 * Sanitize filename for storage
 */
function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/__+/g, "_")
    .slice(0, 100);
}

/**
 * Hash IP for rate limiting (salted)
 */
function hashIP(ip) {
  const salt = process.env.IP_HASH_SALT || "syd-applications-salt";
  return crypto.createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);
}

/**
 * Compress PDF using pdf-lib
 * Returns the smaller of original or compressed
 */
async function compressPDF(buffer) {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    const compressedBytes = await pdfDoc.save({ useObjectStreams: true });

    const originalSize = buffer.byteLength;
    const compressedSize = compressedBytes.byteLength;

    console.log(`resume ${(originalSize / 1024 / 1024).toFixed(1)} MB -> ${(compressedSize / 1024 / 1024).toFixed(1)} MB`);

    // Return smaller version
    if (compressedSize < originalSize) {
      return Buffer.from(compressedBytes);
    }
    return buffer;
  } catch (error) {
    console.error("PDF compression failed, using original:", error.message);
    return buffer;
  }
}

export async function POST(request) {
  const adminClient = createAdminClient();

  try {
    // Parse form data
    const formData = await request.formData();

    // Check honeypot field
    const honeypot = formData.get("website");
    if (honeypot) {
      // Bot detected - return success but do nothing
      return NextResponse.json({ success: true });
    }

    // Check for too-fast submission
    const pageLoadTime = formData.get("_plt");
    if (pageLoadTime) {
      const loadTime = parseInt(pageLoadTime, 10);
      const now = Date.now();
      if (now - loadTime < MIN_SUBMIT_TIME_MS) {
        // Too fast - likely bot, return success but do nothing
        return NextResponse.json({ success: true });
      }
    }

    // Verify Turnstile token
    const turnstileToken = formData.get("cf-turnstile-response");
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const turnstileResult = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileResult.success) {
      return NextResponse.json(
        { errors: { turnstile: "Please complete the verification" } },
        { status: 400 }
      );
    }

    // Get form fields
    const firstName = (formData.get("firstName") || "").trim();
    const lastName = (formData.get("lastName") || "").trim();
    const email = (formData.get("email") || "").trim().toLowerCase();
    const phone = (formData.get("phone") || "").trim();
    const message = (formData.get("message") || "").trim().slice(0, 1000);
    const ageConfirm = formData.get("ageConfirm") === "true";
    const file = formData.get("resume");

    // Validate required fields
    const errors = {};

    if (!firstName) errors.firstName = "Add your first name";
    if (!lastName) errors.lastName = "Add your last name";
    if (!email) {
      errors.email = "Add your email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid email";
    }
    if (!phone) errors.phone = "Add your phone number";
    if (!ageConfirm) errors.ageConfirm = "Confirm you are 18 or older";

    // Validate file
    if (!file || !(file instanceof File) || file.size === 0) {
      errors.resume = "Upload your resume";
    } else {
      if (file.size > MAX_FILE_SIZE) {
        errors.resume = "File must be under 10 MB";
      }

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "doc", "docx"].includes(ext)) {
        errors.resume = "Upload a PDF or Word document";
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Check if hiring is open
    const { data: settings } = await adminClient
      .from("hiring_settings")
      .select("hiring_open, notify_emails")
      .eq("id", 1)
      .single();

    if (!settings?.hiring_open) {
      return NextResponse.json(
        { error: "We're not hiring right now. Check back soon." },
        { status: 400 }
      );
    }

    // Hash IP for rate limiting (ip already extracted above for Turnstile)
    const ipHash = hashIP(ip);

    // Check IP rate limit
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_IP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { count: ipCount } = await adminClient
      .from("instructor_applications")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", oneHourAgo);

    if (ipCount >= RATE_LIMIT_IP_COUNT) {
      return NextResponse.json(
        { error: "Too many applications. Please try again later." },
        { status: 429 }
      );
    }

    // Check for existing application with same email in last 24 hours
    const oneDayAgo = new Date(Date.now() - RATE_LIMIT_EMAIL_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: existingApp } = await adminClient
      .from("instructor_applications")
      .select("id, resume_path")
      .eq("email", email)
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Read file buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Verify file type by magic bytes
    const detectedType = getFileTypeFromBytes(fileBuffer);
    if (!detectedType) {
      return NextResponse.json(
        { errors: { resume: "Invalid file type. Upload a PDF or Word document." } },
        { status: 400 }
      );
    }

    // Compress PDF if applicable
    let finalBuffer = fileBuffer;
    if (detectedType === "pdf") {
      finalBuffer = await compressPDF(fileBuffer);
    }

    const finalSize = finalBuffer.byteLength;

    // Generate safe filename
    const random = crypto.randomBytes(8).toString("hex");
    const safeName = sanitizeFilename(file.name);

    console.log("Existing app check:", { existingApp, email });

    if (existingApp) {
      // Already applied recently - show helpful message
      return NextResponse.json(
        {
          error: "We already have your application. If you need to make changes or have questions, please email heather@shapeyourdestiny.co"
        },
        { status: 400 }
      );
    }

    // Create new application
    // First, create a placeholder to get the ID for the storage path
    console.log("Creating new application for:", email);
    const { data: newApp, error: insertError } = await adminClient
      .from("instructor_applications")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        message: message || null,
        resume_path: "pending",
        resume_name: file.name,
        resume_size: finalSize,
        ip_hash: ipHash,
      })
      .select("id")
      .single();

    console.log("Insert result:", { newApp, insertError });

    if (insertError) {
      console.error("Failed to create application:", insertError);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    // Upload resume with application ID in path
    const storagePath = `applications/${newApp.id}/${random}-${safeName}`;

    const { error: uploadError } = await adminClient.storage
      .from("resumes")
      .upload(storagePath, finalBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // Clean up the application row
      await adminClient.from("instructor_applications").delete().eq("id", newApp.id);
      console.error("Failed to upload resume:", uploadError);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    // Update with actual storage path
    await adminClient
      .from("instructor_applications")
      .update({ resume_path: storagePath })
      .eq("id", newApp.id);

    // Send emails (don't fail the request if emails fail)
    const application = {
      id: newApp.id,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      resume_name: file.name,
    };

    try {
      // Get admin emails - use notify_emails if set, otherwise all admins
      let adminEmails = settings?.notify_emails || [];

      if (adminEmails.length === 0) {
        const { data: admins } = await adminClient
          .from("profiles")
          .select("email")
          .eq("role", "admin")
          .not("email", "is", null);

        adminEmails = (admins || []).map((a) => a.email).filter(Boolean);
      }

      if (adminEmails.length > 0) {
        await sendNewApplicationEmail({ application, adminEmails });
      }
    } catch (emailError) {
      console.error("Failed to send admin notification:", emailError);
    }

    try {
      await sendApplicationReceivedEmail({ application });
    } catch (emailError) {
      console.error("Failed to send applicant confirmation:", emailError);
    }

    return NextResponse.json({ success: true, firstName });
  } catch (error) {
    console.error("Application submission error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
