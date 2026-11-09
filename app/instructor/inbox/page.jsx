import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInstructorInbox } from "@/lib/instructor/inbox";
import InboxClient from "./InboxClient";

export const metadata = {
  title: "Inbox | Shape Your Destiny",
  description: "Your messages and updates.",
};

export default async function InstructorInboxPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/instructor-login");
  }

  // Get profile for header avatar
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("full_name, avatar_url")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  let inboxData;
  try {
    inboxData = await getInstructorInbox();
  } catch (error) {
    console.error("Error fetching inbox:", error);
    inboxData = {
      updates: [],
      shoutOuts: [],
      unreadUpdates: 0,
      unreadShoutOuts: 0,
      sharedNotes: [],
      recentSessions: [],
    };
  }

  return <InboxClient inboxData={inboxData} profile={profile} />;
}
