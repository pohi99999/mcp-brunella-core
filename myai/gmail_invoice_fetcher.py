# -*- coding: utf-8 -*-
'''Simple IMAP invoice fetcher stub used by Phase 3 skeleton.

The real implementation will connect to an IMAP server, download attachments and
return structured invoice artifacts. This stub returns deterministic example
payloads for local development and tests.
'''
from typing import List, Dict, Any


def fetch_invoices_from_imap() -> List[Dict[str, Any]]:
    '''
    Stub that simulates fetching invoice attachments from an IMAP mailbox.

    Returns:
        A list of dict objects representing fetched invoices. Each dict contains:
            - 'filename': str
            - 'content_bytes': bytes
            - 'metadata': dict
    '''
    # Deterministic example payload for unit tests and local flows
    return [
        {
            'filename': 'invoice-0001.xml',
            'content_bytes': b'<Invoice>...</Invoice>',
            'metadata': {'source': 'imap_stub', 'message_id': 'stub-1'},
        }
    ]


if __name__ == '__main__':
    print(fetch_invoices_from_imap())
import os
import json
import base64
from typing import List
from dotenv import load_dotenv
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from myai.utils.google_credentials import resolve_google_workspace_oauth_paths

load_dotenv()

SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
]


def authenticate_gmail():
    """Authenticate with Gmail using OAuth2 credentials.

    Token is stored in JSON format (google.oauth2.credentials.Credentials.to_json())
    rather than pickle, which prevents arbitrary code execution if the token file
    is tampered with (CWE-502).
    """
    workspace_oauth_paths = resolve_google_workspace_oauth_paths()
    creds = None
    if os.path.exists(workspace_oauth_paths.token_path):
        with open(workspace_oauth_paths.token_path, 'r', encoding='utf-8') as token:
            creds = Credentials.from_authorized_user_info(json.load(token), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                workspace_oauth_paths.credentials_path,
                SCOPES,
            )
            creds = flow.run_local_server(port=0)
        token_dir = os.path.dirname(workspace_oauth_paths.preferred_token_path)
        if token_dir:
            os.makedirs(token_dir, exist_ok=True)
        with open(workspace_oauth_paths.preferred_token_path, 'w', encoding='utf-8') as token:
            token.write(creds.to_json())
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
