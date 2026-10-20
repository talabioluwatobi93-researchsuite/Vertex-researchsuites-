import MaintenanceGate from "@/components/MaintenanceGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MaintenanceGate flagKey="referrals">{children}</MaintenanceGate>
}
