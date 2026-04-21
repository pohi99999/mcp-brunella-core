# Conductor - Quick Start

## What Just Happened?

The Conductor extension just scaffolded this directory structure:

```
agentic-workflow/
├── .agents/           # Agent prompt templates
│   ├── test-writer/
│   ├── test-runner/
│   ├── ux-reviewer/
│   ├── code-reviewer/
│   ├── security-reviewer/
│   ├── spec-validator/
│   └── auto-fixer/
├── .issues/           # Generated issues (ISSUE-*.md, UX-*.md, etc.)
├── .test_state/       # Agent state tracking
├── start-agent.sh     # Launch individual agents
├── start-all.sh       # Launch all agents in tmux
└── mega-orchestrator.sh  # Deterministic workflow
```

## Next Steps

### 1. Fill Out HANDOFF.md

Edit `HANDOFF.md` in your project root to describe what you've built.

### 2. Start Claude Code and Load Commands

Open a terminal in your project root and run:

```bash
claude
```

Then tell Claude to learn the Conductor commands:

```
You: Read CLAUDE.md to learn about Conductor commands
```

Now you can use commands like:
- `Conductor: write tests`
- `Conductor: run tests`
- `Conductor: ux-review`
- `Conductor: code-review`
- `Conductor: security-review`
- `Conductor: spec-check`
- `Conductor: fix all`

### 3. Write Your First Code

Build something! For example:

```
You: Build a login page with email/password and a remember me checkbox
```

### 4. Run Quality Checks

Once you have code, run Conductor commands:

```
You: Conductor: write tests
# Test Writer analyzes your code and writes appropriate tests

You: Conductor: run tests
# Test Runner executes tests and creates ISSUE-*.md for each failure

You: Conductor: ux-review
# UX Reviewer captures screenshots and creates UX-*.md issues for accessibility/design problems

You: Conductor: code-review
# Code Reviewer analyzes code quality and creates CODE-*.md issues for violations

You: Conductor: security-review
# Security Reviewer audits for vulnerabilities and creates SEC-*.md issues

You: Conductor: spec-check
# Spec Validator checks implementation against SPEC.md and creates SPEC-*.md issues for gaps

You: Conductor: fix all
# Auto-Fixer reads all open issues and fixes them automatically
```

### 5. View Issues in Sidebar

Agents create issue files in `agentic-workflow/.issues/` as they find problems:
- ISSUE-*.md (test failures)
- UX-*.md (accessibility/design issues)
- CODE-*.md (code quality violations)
- SEC-*.md (security vulnerabilities)
- SPEC-*.md (specification gaps)

View them in the "Conductor" panel in VS Code sidebar:
- See "Open Issues" and "Resolved Issues" tree views
- Click "Fix This" to auto-fix individual issues
- Click "Fix All" on a group to fix all issues in that category

### 4. Use with Claude Code

If using Claude Code CLI, you can use natural language commands:

- "test" - Write and run tests
- "ux" - Review UX/accessibility
- "code review" - Analyze code quality
- "security" - Audit security vulnerabilities
- "mega" - Run complete deterministic workflow
- "fix all" - Auto-fix all open issues

See `CLAUDE.md` for full command reference.

## Learn More

- Read agent configurations in `.agents/<agent-name>/agent.md`
- Check `CLAUDE.md` for command reference
- Issues appear in `.issues/` directory

**Happy coding! 🚀**
