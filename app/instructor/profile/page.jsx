import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/instructors/self-service";
import ProfileClient from "./ProfileClient";

export const metadata = {
  title: "Profile | Shape Your Destiny",
  description: "Manage your instructor profile.",
};

export default async function InstructorProfilePage() {
  const profile = await getMyProfile();

  if (!profile) {
    redirect("/instructor-login");
  }

  // Fetch calendar feed
  const supabase = await createClient();
  const { data: calendarFeed } = await supabase
    .from("calendar_feeds")
    .select("*")
    .eq("profile_id", profile.id)
    .single();

  return <ProfileClient profile={profile} calendarFeed={calendarFeed} />;
}
