export type AuditTheme = { name?: string | null; description?: string | null }

// Builds the "Coding procedure" paragraph only from the saved theme list.
// Returns null when nothing can be reported. No transcript text is used.
export function procedureStatement(themes: AuditTheme[] | null | undefined): string | null {
  const list = Array.isArray(themes) ? themes.filter((t) => t && String(t.name || '').trim()) : []
  if (list.length === 0) return null
  const k = list.length
  const allDefined = list.every((t) => String(t.description || '').trim().length > 0)
  return (
    'Coding procedure. Themes were applied to the transcript through automated coding, using a codebook of ' +
    k + (k === 1 ? ' theme' : ' themes') + ', each with a name' + (allDefined ? ' and definition' : '') +
    '. The consistency of this coding is reported below.'
  )
}
