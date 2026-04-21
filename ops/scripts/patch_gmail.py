import re

with open('scripts/gmail_iszapfalo_extract.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Backup
with open('scripts/gmail_iszapfalo_extract.py.bak', 'w', encoding='utf-8') as f:
    f.writelines(lines)

content = ''.join(lines)

# 1. After IMAP4_SSL line, add socket timeout
content = content.replace(
    'mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)\n    mail.login',
    'mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)\n    mail.socket().settimeout(60)\n    mail.login'
)

# 2. Remove [Gmail]/All Mail from folders
content = content.replace(
    '"[Gmail]/All Mail"',
    '# "[Gmail]/All Mail"  # Skipped: duplicates + timeout risk'
)

# 3. Fix: Remove the iszapfalo accent search that causes ascii error
# Find and comment out the line with iszapfal\u00f3
new_lines = []
for line in content.split('\n'):
    if 'iszapfal\u00f3' in line and 'SUBJECT' in line:
        new_lines.append(line.replace("f'(SUBJECT", "# f'(SUBJECT") + "  # non-ASCII removed")
    else:
        new_lines.append(line)
content = '\n'.join(new_lines)

with open('scripts/gmail_iszapfalo_extract.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patches applied successfully!")
