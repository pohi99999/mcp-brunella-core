with open("scripts/gmail_iszapfalo_extract.py", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the double comma
content = content.replace("IMAP SUBJECT search,,", "IMAP SUBJECT search,")

# Add socket timeout reset before each fetch
old_fetch = """                    try:
                        status, msg_data = mail.fetch(msg_id, "(RFC822)")
                        if status != "OK":
                            continue"""
new_fetch = """                    try:
                        import socket as _socket
                        mail.socket().settimeout(30)
                        status, msg_data = mail.fetch(msg_id, "(RFC822)")
                        if status != "OK":
                            continue"""
content = content.replace(old_fetch, new_fetch)

with open("scripts/gmail_iszapfalo_extract.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Additional fixes applied")
