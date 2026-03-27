import re

with open('scripts/gmail_iszapfalo_extract.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Remove the accented search that causes ASCII error
old1 = "f'(SUBJECT \"iszapfal\u00f3\" SINCE \"{DATE_SINCE}\" BEFORE \"{DATE_BEFORE}\")'"
new1 = "# Removed: non-ASCII chars fail in IMAP SUBJECT search"
content = content.replace(old1, new1 + ',')

# Fix 2: Remove [Gmail]/All Mail  
old2 = 'folders_to_search = ["INBOX", "[Gmail]/Sent Mail", "[Gmail]/All Mail"]'
new2 = 'folders_to_search = ["INBOX", "[Gmail]/Sent Mail"]  # Removed All Mail to avoid duplicates/timeouts'
content = content.replace(old2, new2)

# Fix 3: Add socket timeout
old3 = 'mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)\n    mail.login(GMAIL_USER, GMAIL_APP_PASSWORD)'
new3 = 'mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)\n    mail.socket().settimeout(30)  # 30s timeout\n    mail.login(GMAIL_USER, GMAIL_APP_PASSWORD)'
content = content.replace(old3, new3)

with open('scripts/gmail_iszapfalo_extract.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixes applied successfully')
