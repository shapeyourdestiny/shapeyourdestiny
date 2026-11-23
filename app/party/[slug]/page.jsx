import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PartyClient from "./PartyClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    return { title: "Not Found" };
  }

  return {
    title: event.title,
    robots: { index: false, follow: false },
  };
}

async function getEventBySlug(slug) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("team_events")
    .select(`
      id,
      type,
      title,
      event_date,
      start_time,
      end_time,
      location,
      details,
      status,
      public_rsvp,
      public_slug,
      allow_guests,
      note,
      highlight,
      location_url,
      created_by,
      creator:created_by (
        id,
        full_name
      )
    `)
    .eq("public_slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error fetching event:", error);
    return null;
  }

  return data;
}

export default async function PartyPage({ params }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  // 404 if event not found or public RSVP is off
  if (!event || !event.public_rsvp) {
    notFound();
  }

  // Check if event is cancelled
  const isCancelled = event.status === "cancelled";

  // Check if event has started (Pacific time)
  const eventDateTime = new Date(`${event.event_date}T${event.start_time}`);
  // Convert to Pacific
  const pacificOffset = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const nowPacific = new Date(pacificOffset);
  const hasStarted = nowPacific >= eventDateTime;

  // Get creator's first name
  const creatorFirstName = event.creator?.full_name?.split(" ")[0] || "the team";

  return (
    <PartyClient
      event={event}
      slug={slug}
      creatorFirstName={creatorFirstName}
      isCancelled={isCancelled}
      hasStarted={hasStarted}
    />
  );
}
