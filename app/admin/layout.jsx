import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "./components/Sidebar";
import styles from "./layout.module.css";

export const metadata = {
  title: "Admin | Shape Your Destiny",
  description: "Admin dashboard for Shape Your Destiny.",
};

export default async function AdminLayout({ children }) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/instructor-login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/instructor/dashboard");
  }

  return (
    <div className={styles.layout}>
      <Sidebar profile={profile} />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
