# GitHub Projects Documentation

## Overview

This directory contains configuration files for GitHub Projects used to track Brunella Agent System (BAS) development.

## Project Structure

### Brunella Development Board (`brunella-development.yml`)

Main project board for tracking all BAS development work, synchronized with `conductor/tracks.md`.

**Key Features:**
- **Status Tracking**: Backlog → Ready → In Progress → In Review → Done
- **Priority Levels**: Critical, High, Medium, Low
- **Track Organization**: Organized by development tracks
- **AI Agent Attribution**: Track which AI agent (Claude, Gemini, Copilot, Jules) worked on what
- **Progress Metrics**: Percentage completion tracking

## Usage

### For Humans

1. **Creating Issues for Tracks**:
   - Use issue templates in `.github/ISSUE_TEMPLATE/`
   - Select appropriate track and priority
   - Reference the conductor track ID

2. **Viewing Progress**:
   - Go to repository → Projects tab
   - Select "Brunella Development Board"
   - Use different views to see work organized by status, track, or priority

3. **Updating Status**:
   - Issues auto-update when PRs are opened/merged
   - Manually drag cards between columns in board view
   - Use labels to mark items as blocked

### For AI Agents

When working on a track:

1. **Check Project Board** for current status:
   ```bash
   gh project list --owner pohi99999
   gh project item-list <PROJECT_ID>
   ```

2. **Create Tracking Issue**:
   ```bash
   gh issue create \
     --title "[Track] Your Track Name" \
     --body "Description from conductor/tracks" \
     --label "track:your-track,priority:high"
   ```

3. **Update Progress** in issue comments:
   ```markdown
   **Progress Update:**
   - [x] Phase 1 complete
   - [x] Phase 2 complete
   - [ ] Phase 3 in progress (60%)
   ```

## Synchronization

### conductor/tracks.md → GitHub Projects

The `scripts/sync_github_projects.js` script synchronizes track data:

```bash
# Run synchronization
node scripts/sync_github_projects.js

# What it does:
# 1. Reads conductor/tracks.md
# 2. Creates/updates issues for each track
# 3. Sets appropriate labels and project fields
# 4. Updates progress percentages
```

### GitHub Projects → conductor/tracks.md

When closing issues or marking PRs as complete, manually update `conductor/tracks.md` to reflect the new status.

## Project Views

### 📊 Board View (Default)
Kanban-style board showing work by status. Best for daily standup and sprint planning.

### 🎯 By Track
Groups all work by track. Best for understanding progress on specific initiatives.

### 🔥 By Priority
Table view sorted by priority. Best for triaging and deciding what to work on next.

### ✅ Completed
Recently completed work. Best for retrospectives and reporting.

### 🤖 AI Agent Work
Shows only work assigned to AI agents. Best for monitoring automation.

## Labels

Labels automatically organize work:

### Track Labels
- `track:code-quality` - Code quality improvements
- `track:gold-protocol` - Gold Protocol implementation
- `track:agent-architect` - Agent architecture upgrades
- `track:cloudflare` - Cloudflare integration
- `track:dashboard` - Dashboard development
- `track:developer-agent` - Developer agent features
- `track:phoenix-protocol` - Phoenix Protocol
- `track:robotkez` - Robotkéz features

### Priority Labels
- `priority:critical` - Must be fixed immediately
- `priority:high` - Important work
- `priority:medium` - Standard priority
- `priority:low` - Nice to have

### Agent Labels
- `agent:claude` - Work done by Claude
- `agent:gemini` - Work done by Gemini
- `agent:copilot` - Work done by GitHub Copilot
- `agent:jules` - Work done by Jules

### Status Labels
- `blocked` - Cannot proceed due to dependencies
- `automated` - Created/updated by automation

## Automation

The following automations are configured:

1. **New issues** → Automatically added to project board in Backlog
2. **PR opened** → Move related issue to "In Review"
3. **PR merged** → Move issue to "Done"
4. **'blocked' label added** → Move to "Blocked" status

## Best Practices

### Creating Issues

✅ **DO:**
- Reference conductor track ID in title or body
- Add appropriate track and priority labels
- Include link to track folder
- Update regularly with progress

❌ **DON'T:**
- Create duplicate issues for same track
- Leave issues without labels
- Forget to close issues when work is complete

### Using Project Board

✅ **DO:**
- Keep status up to date
- Use drag-and-drop in board view
- Add comments on blocking issues
- Close completed work promptly

❌ **DON'T:**
- Leave stale issues open
- Have too many items "In Progress"
- Skip the "In Review" stage for PRs

## Integration with CI/CD

GitHub Actions workflows can interact with project boards:

```yaml
# Example: Auto-add new issues to project
- name: Add to project
  uses: actions/add-to-project@v0.5.0
  with:
    project-url: https://github.com/users/pohi99999/projects/1
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Troubleshooting

### Issue not appearing in project
- Check if issue has required labels
- Verify project automation is enabled
- Manually add issue to project

### Progress not syncing
- Run `node scripts/sync_github_projects.js`
- Check for errors in conductor/tracks.md format
- Verify track IDs match

### Labels not applying
- Check label exists in repository
- Verify label name matches exactly (case-sensitive)
- Create missing labels with `gh label create`

## Further Reading

- [GitHub Projects Documentation](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [conductor/workflow.md](../../conductor/workflow.md) - BAS workflow
- [conductor/tracks.md](../../conductor/tracks.md) - Active tracks
