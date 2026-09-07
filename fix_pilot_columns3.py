import sys

path = "./vertex-researchsuites/app/pilot-study/[id]/columns/page.tsx"

with open(path, "r") as f:
    content = f.read()

replacements = [
    (
        "import { createClient } from '@supabase/supabase-js'",
        "import { createClient } from '@supabase/supabase-js'\nimport { CITATION_STYLES, CitationStyleValue } from '@/lib/citationStyles'"
    ),
    (
        "const [columnHeaders, setColumnHeaders] = useState<string[]>([])",
        "const [columnHeaders, setColumnHeaders] = useState<string[]>([])\n  const [rawData, setRawData] = useState<any[][]>([])"
    ),
    (
        ".select('column_headers')",
        ".select('column_headers, raw_data')"
    ),
    (
        "setColumnHeaders(data.column_headers || [])",
        "setColumnHeaders(data.column_headers || [])\n      setRawData(data.raw_data || [])"
    ),
    (
        "const [citationStyle, setCitationStyle] = useState<'6th' | '7th'>('7th')",
        "const [citationStyle, setCitationStyle] = useState<CitationStyleValue | ''>('')"
    ),
    (
        "if (!hasScaleConstruct) {\n      setErrorMsg('Please add at least one Scale construct (Demographics alone cannot be tested for reliability).')\n      return\n    }\n\n    setSaving(true)",
        "if (!hasScaleConstruct) {\n      setErrorMsg('Please add at least one Scale construct (Demographics alone cannot be tested for reliability).')\n      return\n    }\n\n    const nonNumericConstruct = usedConstructs.find((c) => {\n      if (c.role !== 'Scale') return false\n      return c.columnIndexes.some((colIndex) =>\n        rawData.some((row) => {\n          const value = row[colIndex]\n          if (value === '' || value === null || value === undefined) return false\n          return isNaN(Number(value))\n        })\n      )\n    })\n    if (nonNumericConstruct) {\n      setErrorMsg(`\"${nonNumericConstruct.name}\" contains text instead of numbers. Please convert its responses to numeric codes (e.g. \"Strongly Agree\" -> 5) before continuing.`)\n      return\n    }\n\n    setSaving(true)"
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

print("All 6 remaining replacements applied successfully.")
