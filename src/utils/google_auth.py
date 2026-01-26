import os
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppAppFlow
from googleapiclient.discovery import build

# Ha módosítjuk a scope-okat, törölni kell a token.json fájlt.
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
]

CREDENTIALS_FILE = 'credentials.json'
TOKEN_FILE = 'token.json'

def get_credentials():
    """Megszerzi és visszaadja a hitelesítő adatokat."""
    creds = None
    # A token.json tárolja a felhasználói hozzáférési és frissítési tokeneket.
    # Ez automatikusan létrejön az első sikeres hitelesítéskor.
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    # Ha nincs (érvényes) hitelesítő adat, akkor be kell jelentkezni.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                raise FileNotFoundError(f"A hitelesítő fájl ({CREDENTIALS_FILE}) nem található. Kérlek töltsd le a Google Cloud Console-ból.")
            
            flow = InstalledAppAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Mentsük el a hitelesítő adatokat a következő futtatáshoz
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
            
    return creds

def get_service(api_name, api_version):
    """Létrehoz egy Google API szolgáltatást."""
    creds = get_credentials()
    try:
        service = build(api_name, api_version, credentials=creds)
        return service
    except Exception as e:
        print(f"Hiba történt a(z) {api_name} szolgáltatás létrehozásakor: {e}")
        return None
