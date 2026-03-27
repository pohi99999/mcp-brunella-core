import os
import base64
import pickle
from typing import List
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']


def authenticate_gmail():
    creds = None
    if os.path.exists('token.json'):
        with open('token.json', 'rb') as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'wb') as token:
            pickle.dump(creds, token)
    return creds


def fetch_invoice_emails(service, query='has:attachment filename:pdf') -> List[dict]:
    results = service.users().messages().list(userId='me', q=query).execute()
    messages = results.get('messages', [])
    emails = []
    for msg in messages:
        msg_data = service.users().messages().get(userId='me', id=msg['id']).execute()
        emails.append(msg_data)
    return emails


def save_pdf_attachments(service, emails: List[dict], save_dir='invoices'):
    os.makedirs(save_dir, exist_ok=True)
    for email in emails:
        for part in email.get('payload', {}).get('parts', []):
            if part.get('filename', '').endswith('.pdf'):
                att_id = part['body'].get('attachmentId')
                if att_id:
                    att = service.users().messages().attachments().get(userId='me', messageId=email['id'], id=att_id).execute()
                    data = base64.urlsafe_b64decode(att['data'].encode('UTF-8'))
                    filepath = os.path.join(save_dir, part['filename'])
                    with open(filepath, 'wb') as f:
                        f.write(data)
                    print(f'Saved: {filepath}')


def main():
    creds = authenticate_gmail()
    service = build('gmail', 'v1', credentials=creds)
    emails = fetch_invoice_emails(service)
    save_pdf_attachments(service, emails)

if __name__ == '__main__':
    main()
