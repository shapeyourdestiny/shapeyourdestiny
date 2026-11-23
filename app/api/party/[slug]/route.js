import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashIP, getClientIP, checkRateLimit } from "@/lib/security/rate-limit";
import { sendPartyRsvpNotification } from "@/lib/email";

const MIN_SUBMIT_TIME_MS = 2000; // 2 seconds minimum
const RATE_LIMIT_COUNT = 10;
const RATE_LIMIT_WINDOW_MINUTES = 60;

export async function POST(request, { params }) {
  const { slug } = await params;

  try {
    const body = await request.json();
    const { name, attending, guestAdults, guestKids, note, forceUpdate, _plt, _hp } = body;

    // Check honeypot
    if (_hp) {
      return NextResponse.json({ success: true, id: "fake" });
    }

    // Check for too-fast submission
    if (_plt) {
      const loadTime = parseInt(_plt, 10);
      const now = Date.now();
      if (now - loadTime < MIN_SUBMIT_TIME_MS) {
        return NextResponse.json({ success: true, id: "fake" });
      }
    }

    const supabase = createAdminClient();

    // Look up event by slug
    const { data: event, error: eventError } = await supabase
      .from("team_events")
      .select("id, title, public_rsvp, allow_guests, event_date, start_time, status, created_by")
      .eq("public_slug", slug)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check public RSVP is enabled
    if (!event.public_rsvp) {
      return NextResponse.json({ error: "RSVPs are not open for this event" }, { status: 400 });
    }

    // Check event status
    if (event.status === "cancelled") {
      return NextResponse.json({ error: "This event was cancelled" }, { status: 400 });
    }

    // Check if event has started (Pacific time)
    const eventDateTime = new Date(`${event.event_date}T${event.start_time}`);
    const now = new Date();
    // Simple check - proper timezone handling would need more logic
    if (now >= eventDateTime) {
      return NextResponse.json({ error: "RSVPs are closed for this event" }, { status: 400 });
    }

    // Validate name
    const trimmedName = (name || "").trim();
    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json({ error: "Please enter your full name" }, { status: 400 });
    }
    if (trimmedName.length > 80) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    }

    // Validate attending
    if (typeof attending !== "boolean") {
      return NextResponse.json({ error: "Please indicate if you can attend" }, { status: 400 });
    }

    // Validate guest counts
    const adults = attending ? Math.max(0, Math.min(6, parseInt(guestAdults, 10) || 0)) : 0;
    const kids = attending ? Math.max(0, Math.min(10, parseInt(guestKids, 10) || 0)) : 0;

    // Validate note
    const trimmedNote = (note || "").trim().slice(0, 300) || null;

    // Rate limit check
    const ip = getClientIP(request);
    const ipHash = hashIP(ip);
    const rateLimit = await checkRateLimit({
      key: `party:${slug}:${ipHash}`,
      limit: RATE_LIMIT_COUNT,
      windowMinutes: RATE_LIMIT_WINDOW_MINUTES,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    // Check for existing RSVP with same name (case-insensitive)
    const normalizedName = trimmedName.toLowerCase().trim();
    const { data: existing } = await supabase
      .from("team_event_public_rsvps")
      .select("id, name")
      .eq("event_id", event.id)
      .ilike("name", normalizedName)
      .maybeSingle();

    // If name exists and forceUpdate is not true, ask user to confirm
    if (existing && !forceUpdate) {
      return NextResponse.json({
        nameConflict: true,
        existingName: existing.name,
      }, { status: 409 });
    }

    let rsvpId;
    let isUpdate = false;

    if (existing) {
      // Update existing RSVP
      const { data: updated, error: updateError } = await supabase
        .from("team_event_public_rsvps")
        .update({
          name: trimmedName, // Keep their capitalization preference
          attending,
          guest_adults: adults,
          guest_kids: kids,
          note: trimmedNote,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id")
        .single();

      if (updateError) {
        console.error("Error updating RSVP:", updateError);
        return NextResponse.json({ error: "Failed to update RSVP" }, { status: 500 });
      }

      rsvpId = updated.id;
      isUpdate = true;
    } else {
      // Insert new RSVP
      const { data: inserted, error: insertError } = await supabase
        .from("team_event_public_rsvps")
        .insert({
          event_id: event.id,
          name: trimmedName,
          attending,
          guest_adults: adults,
          guest_kids: kids,
          note: trimmedNote,
        })
        .select("id")
        .single();

      if (insertError) {
        // Check for unique constraint violation (race condition)
        if (insertError.code === "23505") {
          return NextResponse.json({
            nameConflict: true,
            existingName: trimmedName,
          }, { status: 409 });
        }
        console.error("Error creating RSVP:", insertError);
        return NextResponse.json({ error: "Failed to save RSVP" }, { status: 500 });
      }

      rsvpId = inserted.id;
    }

    // Send email notification (don't block on failure)
    try {
      // Get admin emails
      const { data: settings } = await supabase
        .from("hiring_settings")
        .select("notify_emails")
        .eq("id", 1)
        .single();

      let adminEmails = settings?.notify_emails || [];

      if (adminEmails.length === 0) {
        const { data: admins } = await supabase
          .from("profiles")
          .select("email")
          .eq("role", "admin")
          .not("email", "is", null);

        adminEmails = (admins || []).map((a) => a.email).filter(Boolean);
      }

      if (adminEmails.length > 0) {
        await sendPartyRsvpNotification({
          eventTitle: event.title,
          name: trimmedName,
          attending,
          guestAdults: adults,
          guestKids: kids,
          isUpdate,
          adminEmails,
        });
      }
    } catch (emailError) {
      console.error("Failed to send RSVP notification email:", emailError);
      // Don't fail the request
    }

    return NextResponse.json({ success: true, id: rsvpId });
  } catch (error) {
    console.error("Party RSVP error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
