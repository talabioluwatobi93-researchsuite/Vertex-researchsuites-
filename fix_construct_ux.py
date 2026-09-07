import sys

path = "./vertex-researchsuites/app/pilot-study/[id]/columns/page.tsx"

with open(path, "r") as f:
    content = f.read()

replacements = [
    (
        """              <input
                type="number"
                value={scaleMax}
                onChange={(e) => setScaleMax(Number(e.target.value))}
                style={{ width: '60px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE' }}
              />
            </div>
          </div>""",
        """              <input
                type="number"
                value={scaleMax}
                onChange={(e) => setScaleMax(Number(e.target.value))}
                style={{ width: '60px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #EEEEEE' }}
              />
            </div>
            <p style={{ color: '#777777', fontSize: '12px', marginTop: '8px' }}>
              Your scale: {scaleMin} to {scaleMax} ({scaleMax - scaleMin + 1} points)
            </p>
          </div>"""
    ),
    (
        """          {constructs.map((c) => (
            <span key={c.id} style={{ display: 'inline-block', backgroundColor: '#F9F9F9', border: '1px solid #EEEEEE', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#333333', marginRight: '6px', marginBottom: '6px' }}>
              {c.name} · {c.role} ({c.columnIndexes.length})
            </span>
          )))}""",
        """          {constructs.map((c) => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F9F9F9', border: '1px solid #EEEEEE', borderRadius: '20px', padding: '4px 8px 4px 12px', fontSize: '12px', color: '#333333', marginRight: '6px', marginBottom: '6px' }}>
              {c.name} · {c.role} ({c.columnIndexes.length})
              <button
                type="button"
                onClick={() => deleteConstruct(c.id)}
                style={{ background: 'none', border: 'none', color: '#C0392B', cursor: 'pointer', fontSize: '14px', fontWeight: 700, padding: '0 4px', lineHeight: 1 }}
                aria-label={`Remove ${c.name}`}
              >
                ×
              </button>
            </span>
          )))}"""
    ),
    (
        "  const addConstruct = () => {",
        """  const deleteConstruct = (constructId: string) => {
    setConstructs((prev) => prev.filter((c) => c.id !== constructId))
    setAssignments((prev) => {
      const updated = { ...prev }
      Object.keys(updated).forEach((colIndex) => {
        if (updated[Number(colIndex)] === constructId) {
          delete updated[Number(colIndex)]
        }
      })
      return updated
    })
  }

  const addConstruct = () => {"""
    ),
]

missing = []
for old, new in replacements:
    if old not in content:
        missing.append(old[:60])
    else:
        content = content.replace(old, new, 1)

if missing:
    print("STOPPED — these expected blocks were not found, no changes were written:")
    for m in missing:
        print(f"  - {m}...")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Both fixes applied successfully.")
