import base64
from email.mime.text import MIMEText
from fastmcp import FastMCP
from src.utils.google_auth import get_service

# Inicializáljuk az MCP szervert
mcp = FastMCP("Google Workspace")

@mcp.tool()
def gmail_send_email(to: str, subject: str, body: str) -> str:
    """
    Küld egy emailt a megadott címzettnek.
    
    Args:
        to: A címzett email címe.
        subject: Az email tárgya.
        body: Az email szövege.
    """
    try:
        service = get_service('gmail', 'v1')
        if not service:
            return "Hiba: Nem sikerült csatlakozni a Gmail szolgáltatáshoz."

        message = MIMEText(body)
        message['to'] = to
        message['subject'] = subject
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        
        message_body = {'raw': raw_message}
        sent_message = service.users().messages().send(userId='me', body=message_body).execute()
        
        return f"Email elküldve! Message Id: {sent_message['id']}"
    except Exception as e:
        return f"Hiba az email küldésekor: {str(e)}"

@mcp.tool()
def gmail_read_emails(limit: int = 5) -> str:
    """
    Listázza a legutóbbi beérkező leveleket.
    
    Args:
        limit: A listázandó levelek maximális száma (alapértelmezett: 5).
    """
    try:
        service = get_service('gmail', 'v1')
        if not service:
            return "Hiba: Nem sikerült csatlakozni a Gmail szolgáltatáshoz."

        results = service.users().messages().list(userId='me', labelIds=['INBOX'], maxResults=limit).execute()
        messages = results.get('messages', [])

        if not messages:
            return "Nincsenek új üzenetek."

        output = []
        for message in messages:
            msg = service.users().messages().get(userId='me', id=message['id']).execute()
            headers = msg['payload']['headers']
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Nincs tárgy')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Ismeretlen feladó')
            snippet = msg.get('snippet', '')
            output.append(f"- [{sender}]: {subject} ({snippet})")

        return "\n".join(output)
    except Exception as e:
        return f"Hiba a levelek olvasásakor: {str(e)}"

@mcp.tool()
def drive_list_files(page_size: int = 10) -> str:
    """
    Listázza a Google Drive-on található fájlokat.
    
    Args:
        page_size: A listázandó fájlok maximális száma (alapértelmezett: 10).
    """
    try:
        service = get_service('drive', 'v3')
        if not service:
            return "Hiba: Nem sikerült csatlakozni a Drive szolgáltatáshoz."

        results = service.files().list(
            pageSize=page_size, fields="nextPageToken, files(id, name, mimeType)").execute()
        items = results.get('files', [])

        if not items:
            return "Nincsenek fájlok."

        output = []
        for item in items:
            output.append(f"- {item['name']} ({item['mimeType']}) [ID: {item['id']}]")

        return "\n".join(output)
    except Exception as e:
        return f"Hiba a fájlok listázásakor: {str(e)}"

if __name__ == "__main__":
    mcp.run()
