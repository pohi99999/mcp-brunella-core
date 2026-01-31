import os
import re

html_files = [
    'G:\\Felhasznalo\\Brunella\\giada-fervere-website-main\\index.html',
    'G:\\Felhasznalo\\Brunella\\giada-fervere-website-main\\rolam.html',
    'G:\\Felhasznalo\\Brunella\\giada-fervere-website-main\\alkotasaim.html',
    'G:\\Felhasznalo\\Brunella\\giada-fervere-website-main\\eloadasaim.html',
    'G:\\Felhasznalo\\Brunella\\giada-fervere-website-main\\rendezvenyek.html',
    'G:\\Felhasznalo\\Brunella\\giada-fervere-website-main\\kapcsolat.html'
]

img_pattern = re.compile(r'<img [^>]*>')
alt_pattern = re.compile(r'alt=("([^\"]*)"|\'([^\"]*)\')')

print("Hiányos ALT attribútumok a következő fájlokban:")

for file_path in html_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            images = img_pattern.findall(content)
            for i, img_tag in enumerate(images):
                alt_match = alt_pattern.search(img_tag)
                if not alt_match or not alt_match.group(2):
                    print(f"- Fájl: {os.path.basename(file_path)}, Sor: (kb. a {i+1}. kép), Kód: {img_tag}")
    except FileNotFoundError:
        print(f"- Hiba: A(z) {file_path} fájl nem található.")
    except Exception as e:
        print(f"- Hiba a(z) {file_path} fájl feldolgozása közben: {e}")
