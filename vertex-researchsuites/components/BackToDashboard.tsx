import Link from "next/link";

export default function BackToDashboard() {
  return (
    <div style={{ margin: "0 0 16px" }}>
      <Link href="/dashboard" style={{ display: "inline-block", background: "#D4AF37", color: "#333333", fontWeight: 700, padding: "10px 16px", borderRadius: 10, textDecoration: "none" }}>
        Back to Dashboard
      </Link>
      <p style={{ color: "#777777", fontSize: 12, margin: "6px 0 0" }}>You can log out from your dashboard.</p>
    </div>
  );
}
