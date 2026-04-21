Tracks Sync — Google Sheets / Linear integration
===============================================

Purpose
-------
This utility exports the repository's track metadata (conductor/tracks/*) into a Google Sheets spreadsheet daily and optionally enriches rows with matching Linear issues.

Quick start
-----------
1. Create a Google Sheets spreadsheet and add a sheet named "Tracks".
2. Create a Google service account with the "Sheets API" enabled and grant it edit access to the spreadsheet (share the sheet with the service account email).
3. Add the service account JSON as a secret in GitHub Actions named `GOOGLE_SERVICE_ACCOUNT_JSON` or set it locally as `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON text) or `GOOGLE_SERVICE_ACCOUNT_FILE` (path to file).
4. Set the spreadsheet ID in env `SHEET_ID` (or `TRACKS_SHEET_ID` / `GOOGLE_SHEET_ID`).
5. (Optional) Add `LINEAR_API_KEY` as a secret to enrich rows with Linear issue links.

Run locally
-----------
Install dependencies:

```bash
npm ci
```

Run the sync once (example using env vars):

```bash
export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":...}'
export SHEET_ID="1aBcD..."
export LINEAR_API_KEY="linear_secret"
node ./scripts/export_tracks_to_sheet.js
```

GitHub Actions
--------------
The workflow `.github/workflows/daily-tracks-sync.yml` will run daily and whenever manually dispatched. Add the following repository secrets:

- `GOOGLE_SERVICE_ACCOUNT_JSON` — the JSON contents of the service account key
- `TRACKS_SHEET_ID` — the target spreadsheet ID
- `LINEAR_API_KEY` — (optional) Linear personal API key

Notes & mapping
---------------
- The script scans `conductor/tracks/*/meta.json` and falls back to heuristics when metadata is missing.
- Output columns: id, title, status, owner, updated_at, link, notes, linear_links
- If your track metadata uses different field names, the script will attempt to map `status`, `state`, `phase`, `owner`, `assignee`.

Extending / Linear mapping
-------------------------
The Linear integration performs a simple search (GraphQL) for issues whose text matches the track title. For more robust mapping, extend `fetchLinearMatches()` in `scripts/export_tracks_to_sheet.js` to query by label, project, or custom fields.
