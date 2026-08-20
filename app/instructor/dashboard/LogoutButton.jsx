"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/instructor-login");
  };

  return (
    <button
      onClick={handleLogout}
      className="btn btnPrimary"
      disabled={loading}
    >
      {loading ? "Logging out..." : "Log Out"}
    </button>
  );
}
