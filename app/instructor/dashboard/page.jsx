import { createClient } from "@/lib/supabase/server";
import {
  getNextSession,
  getInstructorClasses,
} from "@/lib/schedule/instructor-queries";
import styles from "./page.module.css";
import InstructorSchedule from "./InstructorSchedule";

export const metadata = {
  title: "My Schedule | Shape Your Destiny",
  description: "View your teaching schedule for Shape Your Destiny wellness program.",
};

export default async function InstructorDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Look up the profile by user_id (not by id)
  // This handles the case where profile.id ≠ profile.user_id for pre-created profiles
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError);
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>My Schedule</h1>
        <div className={styles.error}>
          Unable to load your profile. Please try refreshing the page.
        </div>
      </div>
    );
  }

  // Fetch schedule data using the profile ID
  let nextSession, instructorClasses;
  try {
    [nextSession, instructorClasses] = await Promise.all([
      getNextSession(profile.id),
      getInstructorClasses(profile.id),
    ]);
  } catch (e) {
    console.error("Error fetching dashboard data:", e);
    nextSession = null;
    instructorClasses = [];
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>My Schedule</h1>

      <InstructorSchedule
        nextSession={nextSession}
        classes={instructorClasses}
      />
    </div>
  );
}
