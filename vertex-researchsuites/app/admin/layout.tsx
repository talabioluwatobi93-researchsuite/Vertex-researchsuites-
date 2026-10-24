import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/features", label: "Features" },
  { href: "/admin/withdrawals", label: "Withdrawals" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/money", label: "Money" },
  { href: "/admin/ambassadors", label: "Ambassadors" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div style={{ display: "flex", gap: 8, padding: "10px 16px", background: "#FFFFFF", borderBottom: "1px solid #EEEEEE", overflowX: "auto" }}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #EEEEEE", color: "#333333", fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
            {l.label}
          </Link>
        ))}
      </div>
      {children}
    </>
  );
}
