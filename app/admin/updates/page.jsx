import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAdminAnnouncements,
  getSchoolsWithClasses,
  getActiveInstructors,
  getPrograms,
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  const [announcements, schools, instructors, programs] = await Promise.all([
    getAdminAnnouncements(),
    getSchoolsWithClasses(),
    getActiveInstructors(),
    getPrograms(),
  ]);

  return (
    <UpdatesClient
      announcements={announcements}
      schools={schools}
      instructors={instructors}
      programs={programs}
      adminName={profile.full_name?.split(" ")[0] || "Admin"}
    />
  );
}
