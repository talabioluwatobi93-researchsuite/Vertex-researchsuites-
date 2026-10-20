import BackButton from '@/components/BackButton'

import MaintenanceGate from "@/components/MaintenanceGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackButton />
      <MaintenanceGate flagKey="quantitative-analysis">{children}</MaintenanceGate>
    </>
  )
}
