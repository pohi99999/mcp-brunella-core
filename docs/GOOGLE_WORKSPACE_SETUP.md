# Google Workspace API Setup Guide

Complete guide for enabling Google Workspace integration (Gmail, Drive, Sheets, Calendar) in Brunella Agent System.

## 📋 Prerequisites

- Google Cloud Platform account (free tier is sufficient)
- Google Workspace account (Gmail, Drive, etc.)
- BAS installed and configured

## 🚀 Quick Start (5 minutes)

### Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create New Project**:
   - Click "Select a Project" → "New Project"
   - Name: `Brunella Agent System` (or your choice)
   - Click "Create"

### Step 2: Enable Required APIs

In your new project, enable the following APIs:

1. **Navigate to**: https://console.cloud.google.com/apis/library
2. **Search and Enable** (one at a time):
   - ✅ **Gmail API** - https://console.cloud.google.com/apis/library/gmail.googleapis.com
   - ✅ **Google Sheets API** - https://console.cloud.google.com/apis/library/sheets.googleapis.com
   - ✅ **Google Drive API** - https://console.cloud.google.com/apis/library/drive.googleapis.com
   - ✅ **Google Calendar API** - https://console.cloud.google.com/apis/library/calendar-json.googleapis.com

**Pro Tip**: Click "Enable" on each, wait ~10 seconds, then move to the next.

### Step 3: Create OAuth 2.0 Credentials

1. **Go to Credentials**: https://console.cloud.google.com/apis/credentials
2. **Configure OAuth Consent Screen** (if prompted):
   - User Type: **External** (unless you have Google Workspace org)
   - App Name: `Brunella Agent System`
   - User Support Email: Your email
   - Developer Contact: Your email
   - Click "Save and Continue" → Skip scopes → Add your email as test user → "Save and Continue"

3. **Create Credentials**:
   - Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
   - Application Type: **Desktop app**
   - Name: `Brunella Desktop Client`
   - Click **"Create"**

4. **Download Credentials**:
   - Click the **Download** icon (⬇️) next to your new OAuth 2.0 Client
   - Save as: `f:\mcp-brunella-core\config\google_credentials.json`

**Example credentials structure** (yours will have real values):
```json
{
  "installed": {
    "client_id": "xxxxx-yyyyy.apps.googleusercontent.com",
    "project_id": "brunella-agent-system",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "GOCSPX-zzzzz",
    "redirect_uris": ["http://localhost"]
  }
}
```

### Step 4: Authenticate BAS with Google

Run the authentication command:

```bash
brunella workspace auth
```

**What happens:**
1. Browser opens to Google authorization page
2. Select your Google account
3. Accept permissions (Gmail, Drive, Sheets, Calendar)
4. Copy the authorization code from the browser
5. Paste it into the terminal
6. ✅ Token saved to `config/google_token.json`

**Security Note**: The token is stored locally and used for all API operations. Do NOT commit `google_token.json` to git (already in `.gitignore`).

### Step 5: Verify Authentication

Check your authentication status:

```bash
brunella workspace status
```

**Expected output:**
```
📊 Google Workspace Status

Credentials: ✔ Found
  f:\mcp-brunella-core\config\google_credentials.json
Token:       ✔ Found
  f:\mcp-brunella-core\config\google_token.json

Token Status: ✔ Valid
  Expires: 2026-02-20 18:45:33

✅ Ready to use Google Workspace APIs!
```

Test API connectivity:

```bash
brunella workspace test
```

**Expected output:**
```
🧪 Testing Google Workspace APIs

Testing Gmail API...
✔ Gmail: your.email@gmail.com
Testing Drive API...
✔ Drive: Access OK (123 files)
Testing Calendar API...
✔ Calendar: Access OK (3 calendars)

✅ All Google Workspace APIs are working!
```

## 🔧 Using Google Workspace in Agents

### Example: Email Draft Creation

```typescript
import { getWorkspaceClient } from '../tools/unifiedWorkspace.js';

const workspace = await getWorkspaceClient();

const { draftId, url } = await workspace.createEmailDraft({
  to: 'recipient@example.com',
  subject: 'Invoice Reminder',
  body: 'Dear client, your invoice is due...',
});

console.log(`Draft created: ${url}`);
```

### Example: Write to Google Sheets

```typescript
import { getWorkspaceClient } from '../tools/unifiedWorkspace.js';

const workspace = await getWorkspaceClient();

await workspace.performSheetOperation({
  spreadsheetId: '1ABC-DEF-GHI',
  range: 'Sheet1!A1:C1',
  values: [['Name', 'Email', 'Status']],
  operation: 'append',
});
```

### Example: Upload to Google Drive

```typescript
import { getWorkspaceClient } from '../tools/unifiedWorkspace.js';

const workspace = await getWorkspaceClient();

const { fileId, webViewLink } = await workspace.uploadFile({
  name: 'report.pdf',
  mimeType: 'application/pdf',
  localPath: './data/reports/report.pdf',
  parents: ['1FolderID_XYZ'], // Optional: Drive folder ID
});

console.log(`File uploaded: ${webViewLink}`);
```

### Example: Create Calendar Event

```typescript
import { getWorkspaceClient } from '../tools/unifiedWorkspace.js';

const workspace = await getWorkspaceClient();

const { eventId, htmlLink } = await workspace.createCalendarEvent({
  summary: 'Team Meeting',
  description: 'Discuss Q2 roadmap',
  start: {
    dateTime: '2026-02-25T10:00:00',
    timeZone: 'Europe/Budapest',
  },
  end: {
    dateTime: '2026-02-25T11:00:00',
    timeZone: 'Europe/Budapest',
  },
  attendees: [{ email: 'team@example.com' }],
});

console.log(`Event created: ${htmlLink}`);
```

## 🔒 Security Best Practices

### Credential Storage

- ✅ **DO**: Store `google_credentials.json` in `config/` (gitignored)
- ✅ **DO**: Store `google_token.json` in `config/` (gitignored)
- ❌ **DON'T**: Commit credentials to version control
- ❌ **DON'T**: Share credentials in chat/email

### Scopes & Permissions

The default scopes are:
- `https://www.googleapis.com/auth/gmail.modify` - Read/write/send Gmail
- `https://www.googleapis.com/auth/spreadsheets` - Read/write Sheets
- `https://www.googleapis.com/auth/drive` - Read/write Drive files
- `https://www.googleapis.com/auth/calendar` - Read/write Calendar events

**⚠️ Important**: These are broad permissions. For production, consider:
- Using more restrictive scopes (e.g., `gmail.readonly` instead of `gmail.modify`)
- Implementing service accounts for automation
- Regular token rotation

### Token Expiration

Tokens expire after ~1 hour. The client automatically refreshes them if a `refresh_token` is present.

**If authentication fails:**
```bash
brunella workspace auth  # Re-authenticate
```

## 🛠️ Troubleshooting

### "Failed to load Google credentials"

**Cause**: `google_credentials.json` not found or invalid.

**Solution**:
1. Download OAuth 2.0 credentials from Google Cloud Console
2. Save as `f:\mcp-brunella-core\config\google_credentials.json`
3. Verify structure matches the example above

### "Token expired" or "Invalid authentication credentials"

**Cause**: Token expired or revoked.

**Solution**:
```bash
brunella workspace auth  # Re-authenticate
```

### "The caller does not have permission"

**Cause**: API not enabled in Google Cloud Console.

**Solution**:
1. Go to https://console.cloud.google.com/apis/library
2. Search for the failing API (Gmail, Drive, etc.)
3. Click "Enable"

### "Access blocked: Request's scopes are too broad"

**Cause**: OAuth consent screen not configured for external users.

**Solution**:
1. Go to https://console.cloud.google.com/apis/credentials/consent
2. Add your email as a "Test User"
3. Re-run `brunella workspace auth`

### "Redirect URI mismatch"

**Cause**: OAuth client configured for wrong application type.

**Solution**:
1. Delete the OAuth 2.0 Client in Google Cloud Console
2. Create a new one with **Application Type: Desktop app**
3. Download new credentials

## 📚 Related Documentation

- [UnifiedWorkspaceClient API Reference](../src/tools/unifiedWorkspace.ts)
- [Google Workspace API Documentation](https://developers.google.com/workspace)
- [OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)

## 🔗 Useful Links

- **Google Cloud Console**: https://console.cloud.google.com/
- **Google Workspace APIs**: https://console.cloud.google.com/apis/library
- **OAuth Consent Screen**: https://console.cloud.google.com/apis/credentials/consent
- **Credentials**: https://console.cloud.google.com/apis/credentials

## 📝 Notes

- **Free Tier**: Google Cloud offers generous free quotas for API usage (sufficient for BAS)
- **Rate Limits**: Gmail API has a limit of 250 quota units/user/second (1 email = ~100 units)
- **Production**: For production deployments, consider service accounts and Workspace domain-wide delegation

---

**Need help?** Check the BAS documentation or open an issue on GitHub.
