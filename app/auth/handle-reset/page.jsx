"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function HandleResetPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createClient();

      // Check if we have a session (Supabase client auto-handles hash fragments)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Session error:", sessionError);
        setError("Your reset link has expired. Please request a new one.");
        setTimeout(() => router.push("/forgot-password?error=expired"), 2000);
        return;
      }

      if (session) {
        // Session established, redirect to reset password page
        router.push("/reset-password");
        return;
      }

      // No session yet - the Supabase client might still be processing
      // Wait a moment and check again
      setTimeout(async () => {
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (retrySession) {
          router.push("/reset-password");
        } else {
          setError("Your reset link has expired. Please request a new one.");
          setTimeout(() => router.push("/forgot-password?error=expired"), 2000);
        }
      }, 1000);
    };

    handleAuth();
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--tint)",
      padding: "20px",
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "40px",
        textAlign: "center",
        maxWidth: "400px",
      }}>
        {error ? (
          <>
            <p style={{ color: "#d32f2f", marginBottom: "16px" }}>{error}</p>
            <p style={{ color: "#666" }}>Redirecting...</p>
          </>
        ) : (
          <>
            <div style={{
              width: "40px",
              height: "40px",
              border: "3px solid var(--navy)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }} />
            <p style={{ color: "#666" }}>Verifying your reset link...</p>
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </>
        )}
      </div>
    </div>
  );
}
