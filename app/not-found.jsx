import Link from "next/link";
import Header from "./components/Header";
import Footer from "./components/Footer";

export const metadata = {
  title: "Page Not Found | Shape Your Destiny",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "4rem 1.5rem",
          textAlign: "center",
          minHeight: "60vh",
        }}
      >
        <div
          style={{
            fontSize: "5rem",
            fontWeight: 700,
            color: "var(--navy)",
            lineHeight: 1,
            marginBottom: "1rem",
            fontFamily: "var(--font-baloo), 'Baloo 2', sans-serif",
          }}
        >
          404
        </div>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 600,
            color: "var(--navy)",
            marginBottom: "0.75rem",
            fontFamily: "var(--font-baloo), 'Baloo 2', sans-serif",
          }}
        >
          Page Not Found
        </h1>
        <p
          style={{
            fontSize: "1.1rem",
            color: "var(--slate)",
            marginBottom: "2rem",
            maxWidth: "28rem",
          }}
        >
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It may have been
          moved or no longer exists.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/" className="btn btnPrimary">
            Go to Home
          </Link>
          <Link
            href="/contact"
            className="btn"
            style={{
              background: "transparent",
              border: "2px solid var(--navy)",
              color: "var(--navy)",
            }}
          >
            Contact Us
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
