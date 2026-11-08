import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getScheduleData } from "@/lib/schedule/queries";
import ScheduleBoard from "./ScheduleBoard";

export const metadata = {
  title: "Schedule Board | Admin | Shape Your Destiny",
};

export default async function AdminSchedulePage() {
  const supabase = await createClient();

  // Check admin role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/instructor-login");
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/instructor/dashboard");
  }

  // Fetch schedule data
  const scheduleData = await getScheduleData();

  return <ScheduleBoard initialData={scheduleData} />;
}
