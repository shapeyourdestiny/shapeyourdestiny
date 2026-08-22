import { createClient } from "@/lib/supabase/server";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/instructor/dashboard");
  }

  // Fetch schedule data
  const scheduleData = await getScheduleData();

  return <ScheduleBoard initialData={scheduleData} />;
}
