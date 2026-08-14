import BackButton from '@/components/BackButton'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackButton />
      {children}
    </>
  )
}
