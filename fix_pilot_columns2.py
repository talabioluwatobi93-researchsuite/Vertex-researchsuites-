import re
import sys

path = "./vertex-researchsuites/app/pilot-study/[id]/columns/page.tsx"

with open(path, "r") as f:
    content = f.read()

pattern = re.compile(
    r'( *)<option value="7th">APA 7th Edition</option>\n *<option value="6th">APA 6th Edition</option>'
)

match = pattern.search(content)
if not match:
    print("STOPPED — the <option> block was not found even with flexible whitespace matching.")
    print("Run: grep -n '<option value=\"7th\"' ./vertex-researchsuites/app/pilot-study/\\[id\\]/columns/page.tsx")
    print("and paste the exact line back.")
    sys.exit(1)

indent = match.group(1)
replacement = (
    f'{indent}<option value="">Select citation style</option>\n'
    f'{indent}{{CITATION_STYLES.map((style) => (\n'
    f'{indent}  <option key={{style.value}} value={{style.value}}>{{style.label}}</option>\n'
    f'{indent}))}}'
)

content = pattern.sub(replacement, content, count=1)

with open(path, "w") as f:
    f.write(content)

print("Option block replaced successfully.")
