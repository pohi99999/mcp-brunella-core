
import os
import google.oauth2.credentials
import google_auth_oauthlib.flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# A sz'kséges hozzáférési körök (scopes)
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/drive"
]

CLIENT_SECRETS_FILE = "G:\\Brunella\\client_secret_608181723722-v2qrf64eq8lksbih9dk5fc1f7t9ksnop.apps.googleusercontent.com.json"
TOKEN_FILE = "G:\\Brunella\\token.json"

def authenticate():
    """
    Elvégzi a felhasználó hitelesítést a Google API-khoz.
    """
    creds = None
    # A token.json fájl tárolja a felhasználó hozzáférési és frissítési tokenjeit.
    # Automatikusan létrejön, amikor a hitelesítési folyamat elöször lefut.
    if os.path.exists(TOKEN_FILE):
        creds = google.oauth2.credentials.Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    # Ha nincsenek (}érvényes) hitelesítő adatok, engedjük, hogy a felhasználó bejelentkezzen.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(google.auth.transport.requests.Request())
        else:
            flow = google_auth_oauthlib.flow.InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRETS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        # Mentsük el a hitelesítő adatokat a következő futtatáshoz
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
    
    return creds

if __name__ == '__main__':
    creds = authenticate()
    print("Sikeres hitelesítés!")
    print("A hitelesítő adatok a 'token.json' fájlba mentve.")

    # Teszteljük a kapcsolatot a Gmail és Drive API-kkal
    try:
        gmail_service = build('gmail', 'v1', credentials=creds)
        profile = gmail_service.users().getProfile(userId='me').execute()
        print(f"\nSikeresen kapcsolódva a Gmailhez. Felhasználó: {profile['emailAddress']}")

        drive_service = build('drive', 'v3', credentials=creds)
        about = drive_service.about().get(fields='user').execute()
        print(f"Sikeresen kapcsolódva a Google Drive-hoz. Felhasználó: {about['user']['emailAddress']}")

    except HttpError as error:
        print(f"Hiba történt: {error}")
