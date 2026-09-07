import re

path = "./app/pilot-study/[id]/columns/page.tsx"

with open(path, "r") as f:
    content = f.read()

pattern = re.compile(
    r'(<button type="button" onClick=\{\(\) => deleteConstruct\(c\.id\)\}[^>]*>\s*'
    r'×\s*'
    r'</button>\s*'
    r'</span>\s*'
    r')\)\)\)(\s*</div>)'
)

new_content, count = pattern.subn(r'\1)))}\2', content)

if count == 0:
    print("STOPPED — pattern not found. No changes written.")
else:
    with open(path, "w") as f:
        f.write(new_content)
    print(f"Fixed {count} occurrence(s) successfully.")
