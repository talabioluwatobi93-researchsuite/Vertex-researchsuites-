import sys

results_path = "./vertex-researchsuites/app/pilot-study/[id]/results/page.tsx"
route_path = "./vertex-researchsuites/app/api/pilot-study/calculate/route.ts"

with open(results_path, "r") as f:
    r = f.read()

r_replacements = [
    (
        "import { createClient } from '@supabase/supabase-js'",
        "import { createClient } from '@supabase/supabase-js'\nimport { CITATION_STYLES, CitationStyleValue } from '@/lib/citationStyles'"
    ),
    (
        "const [citationStyle, setCitationStyle] = useState<'6th' | '7th'>('7th')",
        "const [citationStyle, setCitationStyle] = useState<CitationStyleValue | ''>('APA7')"
    ),
    (
        "apa: '6th' | '7th'",
        "apa: CitationStyleValue"
    ),
    (
        "setCitationStyle(data.results.citationStyle || '7th')",
        "setCitationStyle(data.results.citationStyle || 'APA7')"
    ),
    (
        "data.interpretations || { reliability: '' }, data.citationStyle || '7th')",
        "data.interpretations || { reliability: '' }, data.citationStyle || 'APA7')"
    ),
    (
        "const citationLabel = citationStyle === '6th' ? 'APA 6th Edition' : 'APA 7th Edition'",
        "const citationLabel = CITATION_STYLES.find((s) => s.value === citationStyle)?.label || 'Not selected'"
    ),
    (
        "const table1Label = citationStyle === '6th' ? 'Table 1' : 'Table 1'",
        "const table1Label = 'Table 1'"
    ),
    (
        "const table2Label = citationStyle === '6th' ? 'Table 2' : 'Table 2'",
        "const table2Label = 'Table 2'"
    ),
    (
        "{citationStyle === '6th'\n              ? `Note. Alpha values above .70 are considered acceptable for pilot testing.`\n              : `Note. α values above .70 are considered acceptable for pilot testing.`}",
        "{`Note. \u03b1 values above .70 are considered acceptable for pilot testing.`}"
    ),
]

missing = []
for old, new in r_replacements:
    if old not in r:
        missing.append(old[:60])
    else:
        r = r.replace(old, new, 1)

with open(route_path, "r") as f:
    a = f.read()

a_replacements = [
    (
        "const citationStyle: string = session.citation_style || '7th'",
        "const citationStyle: string = session.citation_style || 'APA7'"
    ),
]

for old, new in a_replacements:
    if old not in a:
        missing.append(old[:60])
    else:
        a = a.replace(old, new, 1)

if missing:
    print("STOPPED — these expected blocks were not found, no changes were written:")
    for m in missing:
        print(f"  - {m}...")
    sys.exit(1)

with open(results_path, "w") as f:
    f.write(r)
with open(route_path, "w") as f:
    f.write(a)

print("All replacements applied successfully to both files.")
