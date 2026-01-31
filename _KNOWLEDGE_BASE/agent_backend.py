# requirements: google-api-python-client, google-auth, flask
from flask import Flask, request
from google.oauth2 import service_account # Keep for potential future use, but not used in the new function
import google.auth # New import
from googleapiclient.discovery import build
import os

# A googleint.txt alapján a szükséges scope-ok
SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets'
]

def as_user(api, version):
    """Létrehoz egy API service klienst az alapértelmezett (ADC) hitelesítéssel."""
    print("Using Application Default Credentials for authentication.")
    # Az ADC automatikusan megtalálja a 'gcloud auth application-default login' által beállított hitelesítést.
    creds, project_id = google.auth.default(scopes=SCOPES)
    return build(api, version, credentials=creds, cache_discovery=False)

app = Flask(__name__)

@app.route("/")
def index():
    return "Pohi AI Agent Backend is running."

@app.route('/pubsub/gmail', methods=['POST'])
def gmail_push():
    """Fogadja a Pub/Sub üzeneteket a Gmail változásokról."""
    print("Received push notification from Gmail.")
    return ('', 204)

@app.route('/command', methods=['POST'])
def command():
    """Fogadja a parancsokat a Chat apptól vagy más forrásból."""
    data = request.get_json()
    intent = data.get('intent')
    print(f"Received command with intent: {intent}")
    
    if intent == "send_teaser":
        gmail = as_user('gmail', 'v1')
        # ... A tényleges logika ide kerül majd ...
        print("Attempting to call Gmail API...")
        return {'status': 'success', 'message': 'Teaser email logic would run here.'}
    
    return {'status': 'unknown_intent'}

if __name__ == '__main__':
    app.run(debug=True, port=5001)
