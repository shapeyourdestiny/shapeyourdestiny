import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InstructorShell from "./components/InstructorShell";
import styles from "./layout.module.css";

export const metadata = {
  title: "Instructor Portal | Shape Your Destiny",
  description: "Instructor dashboard for Shape Your Destiny.",
};

export default async function InstructorLayout({ children }) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/instructor-login");
  }

  // Try fetching with status column, fall back to archived if it doesn't exist
  let profile;
  const { data: profileWithStatus, error: statusError } = await supabase
    .from("profiles")
    .select("full_name, role, status, avatar_url")
    .eq("id", user.id)
    .single();

  // Check if error is about missing column
  const isColumnError = statusError && (
    statusError.message?.includes("status") ||
    statusError.message?.includes("column") ||
    statusError.code === "42703"
  );

  if (isColumnError) {
    // status column doesn't exist, fall back to archived
    const { data: profileWithArchived } = await supabase
      .from("profiles")
      .select("full_name, role, archived, avatar_url")
      .eq("id", user.id)
      .single();

    profile = profileWithArchived
      ? { ...profileWithArchived, status: profileWithArchived.archived ? "archived" : "active" }
      : null;
  } else {
    profile = profileWithStatus;
  }

  // Redirect admins to admin dashboard
  if (profile?.role === "admin") {
    redirect("/admin/dashboard");
  }

  // Redirect archived instructors to login with error
  if (profile?.status === "archived" || profile?.archived === true) {
    redirect("/instructor-login?error=archived");
  }

  return (
    <div className={styles.layout}>
      <InstructorShell profile={profile} />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
