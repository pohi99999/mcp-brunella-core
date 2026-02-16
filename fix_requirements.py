import os

try:
    with open('requirements.txt', 'rb') as f:
        raw = f.read()

    # Detect encoding
    if raw.startswith(b'\xff\xfe'):
        content = raw.decode('utf-16le')
    elif raw.startswith(b'\xfe\xff'):
        content = raw.decode('utf-16be')
    else:
        content = raw.decode('utf-8')

    if 'aiofiles' not in content:
        print("aiofiles not found. Adding it.")
        # Determine strict version if possible, or just add unpinned/pinned
        # Based on pyproject.toml which has aiofiles>=24.0.0
        # Let's add it at the end
        new_content = content.rstrip() + "\naiofiles>=24.1.0\n"

        with open('requirements.txt', 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("requirements.txt updated and saved as UTF-8")
    else:
        print("aiofiles already present.")
        # Re-save as UTF-8 anyway to fix encoding issues for other tools
        with open('requirements.txt', 'w', encoding='utf-8') as f:
            f.write(content)
        print("requirements.txt converted to UTF-8")

except Exception as e:
    print(f"Error: {e}")
