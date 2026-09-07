import re

path = "./app/pilot-study/[id]/columns/page.tsx"

with open(path, "rb") as f:
    raw = f.read()

# Decode leniently, replacing any broken byte sequences instead of crashing
content = raw.decode("utf-8", errors="replace")

pattern = re.compile(
    r'<button type="button" onClick=\{\(\) => deleteConstruct\(c\.id\)\}.*?</button>\s*</span>\s*\)+\}?',
    re.DOTALL
)

replacement = (
    '<button type="button" onClick={() => deleteConstruct(c.id)} '
    'style={{ background: \'none\', border: \'none\', color: \'#C0392B\', cursor: \'pointer\', '
    'fontSize: \'14px\', fontWeight: 700, padding: \'0 4px\', lineHeight: 1 }} '
    'aria-label={`Remove ${c.name}`}>\n'
    '                \u00d7\n'
    '              </button>\n'
    '            </span>\n'
    '          )))}'
)

new_content, count = pattern.subn(replacement, content, count=1)

if count == 0:
    print("STOPPED — pattern not found. No changes written.")
else:
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Fixed successfully.")
