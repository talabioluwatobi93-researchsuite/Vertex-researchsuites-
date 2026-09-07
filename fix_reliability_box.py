import sys

path = "./vertex-researchsuites/app/pilot-study/[id]/columns/page.tsx"

with open(path, "r") as f:
    content = f.read()

replacements = [
    (
        "setCitationStyle(e.target.value as '6th' | '7th')",
        "setCitationStyle(e.target.value as CitationStyleValue)"
    ),
    (
        "const [includeDemographics, setIncludeDemographics] = useState(true)",
        "const [includeDemographics, setIncludeDemographics] = useState(true)\n  const [questionnairesShared, setQuestionnairesShared] = useState<number | ''>('')\n  const [responsesReceived, setResponsesReceived] = useState<number | ''>('')"
    ),
    (
        "citation_style: citationStyle,",
        "citation_style: citationStyle,\n        questionnaires_shared: questionnairesShared || null,\n        responses_received: responsesReceived || null,"
    ),
    (
        "</select>\n          </div>",
        "</select>\n          </div>\n\n          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>\n            <p style={{ color: '#333333', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Reliability input (optional)</p>\n            <p style={{ color: '#777777', fontSize: '12px', marginBottom: '12px' }}>Add these if you want your response rate calculated in the report.</p>\n            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>\n              <input\n                type=\"number\"\n                placeholder=\"Questionnaires shared\"\n                value={questionnairesShared}\n                onChange={(e) => setQuestionnairesShared(e.target.value === '' ? '' : Number(e.target.value))}\n                style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px' }}\n              />\n              <input\n                type=\"number\"\n                placeholder=\"Responses received\"\n                value={responsesReceived}\n                onChange={(e) => setResponsesReceived(e.target.value === '' ? '' : Number(e.target.value))}\n                style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px' }}\n              />\n            </div>\n            {questionnairesShared && responsesReceived ? (\n              <p style={{ color: '#333333', fontSize: '12px', fontWeight: 600 }}>\n                Response rate: {((Number(responsesReceived) / Number(questionnairesShared)) * 100).toFixed(1)}%\n              </p>\n            ) : null}\n          </div>"
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

print("Reliability input box added successfully.")
