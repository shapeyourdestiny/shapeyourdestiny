import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTodayLA } from "@/lib/payroll/schedule.js";
import { getPastSessions } from "@/lib/instructor/past-classes.js";
import PastClassesClient from "./PastClassesClient";

export const metadata = {
  title: "Past Classes | Shape Your Destiny",
  description: "Thank your team and share feedback on your classes.",
};

export default async function PastClassesPage({ searchParams }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/instructor-login");
  }

  // Get profile
  let profile = null;
  const { data: profileByUserId } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("user_id", user.id)
    .single();

  if (profileByUserId) {
    profile = profileByUserId;
  } else {
    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", user.id)
      .single();
    profile = profileById;
  }

  if (!profile) {
    redirect("/instructor-login");
  }

  // Allow dev override for testing: ?today=YYYY-MM-DD
  const params = await searchParams;
  let today = getTodayLA();
  if (process.env.NODE_ENV === "development" && params?.today) {
    today = params.today;
  }

  // Get past sessions (4 weeks back)
  const { sessions, lastClass } = await getPastSessions(profile.id, 4, today);

  return (
    <PastClassesClient
      profile={profile}
      sessions={sessions}
      lastClass={lastClass}
    />
  );
}
