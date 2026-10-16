export function receiptNumber(seq: number | string | null | undefined, createdAt: string): string | null {
  if (seq === null || seq === undefined || seq === '') return null
  const n = Number(seq)
  if (!Number.isFinite(n) || n < 0) return null
  const year = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric' }).format(new Date(createdAt))
  return 'VR-' + year + '-' + String(Math.trunc(n)).padStart(6, '0')
}

export function receiptDate(iso: string): string {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
  return s + ' WAT'
}

export function naira(amount: number | string): string {
  return '\u20A6' + Number(amount).toLocaleString('en-NG')
}
