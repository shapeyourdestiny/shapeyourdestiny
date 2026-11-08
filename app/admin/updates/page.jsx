import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAdminAnnouncements,
  getSchoolsWithClasses,
  getActiveInstructors,
  getPrograms,
  getDistricts,
} from "@/lib/admin/announcements";
import UpdatesClient from "./UpdatesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Updates | Admin | Shape Your Destiny",
};

export default async function AdminUpdatesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin-login");
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const [announcements, schools, instructors, programs, districts] = await Promise.all([
    getAdminAnnouncements(),
    getSchoolsWithClasses(),
    getActiveInstructors(),
    getPrograms(),
    getDistricts(),
  ]);

  return (
    <UpdatesClient
      announcements={announcements}
      schools={schools}
      instructors={instructors}
      programs={programs}
      districts={districts}
      adminName={profile.full_name?.split(" ")[0] || "Admin"}
    />
  );
}
