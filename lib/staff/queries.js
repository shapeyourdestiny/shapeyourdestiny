import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Static staff data for the /our-team page.
 * Uses local images from /public/Images/
 */
const STATIC_STAFF = {
  leadership: [
    {
      id: "destiny",
      display_name: "Destiny",
      title: "Founder",
      bio: "Destiny founded Camp Shape after seeing firsthand how many kids in her community lacked access to basic wellness education. A certified health coach and youth advocate, she has spent over a decade building programs that meet kids where they are — with no judgment, no barriers, and a whole lot of energy.",
      headshotUrl: "/Images/destiny.png",
      programs: [],
    },
    {
      id: "heather",
      display_name: "Heather",
      title: "Director of Operations",
      bio: null,
      headshotUrl: "/Images/heather.png",
      programs: ["wellness"],
    },
  ],
  instructors: [
    {
      id: "alexis",
      display_name: "Alexis",
      title: "Instructor",
      bio: null,
      headshotUrl: "/Images/alexis.png",
      programs: ["soccer", "wellness"],
    },
    {
      id: "maylena",
      display_name: "Maylena",
      title: "Instructor",
      bio: null,
      headshotUrl: "/Images/maylena.png",
      programs: ["soccer", "wellness"],
    },
    {
      id: "leila",
      display_name: "Leila",
      title: "Soccer Coach",
      bio: null,
      headshotUrl: "/Images/leila.png",
      programs: ["soccer"],
    },
    {
      id: "jose",
      display_name: "Jose",
      title: "Soccer Coach",
      bio: null,
      headshotUrl: "/Images/jose.png",
      programs: ["soccer"],
    },
    {
      id: "luis",
      display_name: "Luis",
      title: "Soccer Coach",
      bio: null,
      headshotUrl: "/Images/luis.png",
      programs: ["soccer"],
    },
    {
      id: "eihab",
      display_name: "Eihab",
      title: "Soccer Coach",
      bio: "A former professional soccer player and youth coach with over 22 years of playing and coaching experience. Eihab holds AFC B & C Coaching Licenses, AFC Physical Fitness certifications, and FIFA Guardians certification. He has worked with youth players through the Manchester City Soccer Schools program and is passionate about developing technical skills, confidence, teamwork, and a love for the game.",
      headshotUrl: "/Images/eihab.png",
      programs: ["soccer"],
    },
  ],
};

/**
 * Get public staff data for the /our-team page.
 * Returns static staff data with local images.
 */
export async function getPublicStaff() {
  const { leadership, instructors } = STATIC_STAFF;

  // Collect unique programs that are in use
  const programSet = new Set();
  instructors.forEach((p) => {
    (p.programs || []).forEach((prog) => programSet.add(prog));
  });
  const programs = Array.from(programSet).sort();

  return { leadership, instructors, programs };
}

/**
 * Get staff profile data for admin editing.
 * Includes all staff-page fields plus the current visibility status.
 */
export async function getStaffProfileForAdmin(profileId) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      status,
      display_name,
      title,
      bio,
      headshot_path,
      staff_section,
      staff_sort_order,
      show_on_staff_page,
      staff_quote
    `)
    .eq("id", profileId)
    .single();

  if (error || !profile) {
    console.error("Error fetching staff profile:", error);
    return null;
  }

  // Get headshot signed URL for preview
  let headshotUrl = null;
  if (profile.headshot_path) {
    const { data: signedData } = await adminClient.storage
      .from("staff-headshots")
      .createSignedUrl(profile.headshot_path, 300);
    headshotUrl = signedData?.signedUrl || null;
  }

  // Derive programs from class assignments
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select("classes:class_id(program)")
    .eq("profile_id", profileId);

  const programSet = new Set();
  (assignments || []).forEach((a) => {
    if (a.classes?.program) {
      programSet.add(a.classes.program);
    }
  });

  // Determine live status badge
  let liveStatus = "Deactivated";
  if (profile.status === "active") {
    liveStatus = profile.show_on_staff_page ? "Live" : "Hidden";
  }

  return {
    ...profile,
    headshotUrl,
    programs: Array.from(programSet),
    liveStatus,
  };
}
