import { createClient } from "@/lib/supabase/server";
import Header from "../components/Header";
import Footer from "../components/Footer";
import JoinClient from "./JoinClient";

export const metadata = {
  title: "Join Our Team - Shape Your Destiny",
  description: "Apply to teach wellness, yoga and sports to kids at schools across the Inland Empire.",
};

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const supabase = await createClient();

  // Check if hiring is open
  const { data: settings } = await supabase
    .from("hiring_settings")
    .select("hiring_open")
    .eq("id", 1)
    .single();

  const hiringOpen = settings?.hiring_open ?? true;

  return (
    <>
      <Header />
      <main>
        <JoinClient hiringOpen={hiringOpen} />
      </main>
      <Footer />
    </>
  );
}
