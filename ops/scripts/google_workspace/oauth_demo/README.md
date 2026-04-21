Google Workspace OAuth demo (Gmail: last 5 emails)

Purpose
-------
Small Node.js demo to perform an OAuth2 code exchange and call the Gmail API to list the last 5 messages (snippets). Intended for local development only.

Prerequisites
-------------
- Node.js (v18+ recommended)
- A Google Cloud project with OAuth 2.0 Client ID (type: Web application)
  - Ensure Redirect URI includes: http://localhost:5678/rest/oauth2-credential/callback
- Do NOT commit client_secret or token.json to source control.

Setup
-----
1. Install dependencies

```bash
cd scripts\google_workspace\oauth_demo
npm init -y
npm install googleapis
```

2. Set environment variables

On PowerShell (example):

```powershell
$env:GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID'
$env:GOOGLE_CLIENT_SECRET = 'YOUR_CLIENT_SECRET'
$env:PORT = '5678'
$env:REDIRECT_PATH = '/rest/oauth2-credential/callback'
node oauth_server.js
```

On cmd.exe (example):

```cmd
set GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
set GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
set PORT=5678
set REDIRECT_PATH=/rest/oauth2-credential/callback
node oauth_server.js
```

Usage
-----
- Run the server as above. The script prints an authorization URL. Open it in your browser and consent to Gmail scope.
- After consent Google will redirect to the callback URL. The server will exchange the code for tokens and save them to token.json in this folder.
- The script then calls Gmail API and prints up to 5 message snippets to the console.

Security notes
--------------
- token.json contains access_token and refresh_token. Keep it private and do not commit to git.
- For production use, store secrets and tokens in a secure vault (e.g., Azure Key Vault, AWS Secrets Manager, HashiCorp Vault).

Alternatives
------------
- If you prefer not to provide client_secret here, run the OAuth flow on a separate server that holds the secret and simply provide the resulting tokens to this machine via a secure channel.

Troubleshooting
---------------
- If you see ERR_INVALID_CLIENT or redirect_mismatch errors, check that the redirect URI registered in Google Cloud matches the URL printed by the server exactly (including port and path).
- If Gmail API returns permission errors, ensure the OAuth consent screen is configured and the account you're using has access.

Next steps
----------
- Optionally, add dotenv support for local .env files (do NOT commit .env with secrets).
- Integrate refresh token persistence and token refresh handling for longer-running demos.

