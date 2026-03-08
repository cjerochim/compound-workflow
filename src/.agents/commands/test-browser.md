---
name: test-browser
description: Run browser tests on pages affected by current PR or branch
argument-hint: "[PR number, branch name, or 'current' for current branch]"
---

# Browser Test Command

Run end-to-end browser tests on pages affected by a PR or branch changes using agent-browser CLI.

## CRITICAL: Use agent-browser CLI Only

Do not use browser MCP automation tools.

This command uses the `agent-browser` CLI exclusively. The agent-browser CLI is a Bash-based tool from Vercel that runs headless Chromium. It is NOT the same as Chrome browser automation via MCP.

If you find yourself reaching for browser automation tools outside of `agent-browser`, STOP. Use `agent-browser` Bash commands instead.

## Guardrails

- Use the agent-browser CLI only; do not use other browser automation (e.g. MCP).
- Do not modify application code; validate only (run tests, capture snapshots, report).

## Introduction

<role>QA Engineer specializing in browser-based end-to-end testing</role>

This command tests affected pages in a real browser, catching issues that unit tests miss:
- JavaScript integration bugs
- CSS/layout regressions
- User workflow breakages
- Console errors

## Prerequisites

<requirements>
- Local development server running (use your repo's dev command)
- agent-browser CLI installed (see Setup below)
- Git repository with changes to test
</requirements>

Portability notes:

- If `gh` is unavailable, use `current` mode and derive changed files from `git diff`.
- If the default branch is not `main`, use `default_branch` from the Repo Config Block in `AGENTS.md` or fall back to `master`.
- If the dev server URL is not `http://localhost:3000`, use `dev_server_url` from the Repo Config Block in `AGENTS.md`.

Branching note:

- Prefer testing the branch you are currently on.
- Only switch branches (or create a worktree) when the user explicitly asks to test a different branch/PR.

## Setup

**Check installation:**
```bash
command -v agent-browser >/dev/null 2>&1 && echo "Installed" || echo "NOT INSTALLED"
```

**Install if needed:**
```bash
npm install -g agent-browser
agent-browser install  # Downloads Chromium (~160MB)
```

See the `agent-browser` skill for detailed usage.

## Main Tasks

### 0. Resolve Defaults (ALWAYS FIRST)

Determine:

- Read `AGENTS.md` and look for the "Repo Config Block" YAML.
- `server_url`: from `dev_server_url`, else default `http://localhost:3000`
- `default_branch`: from `default_branch`, else try `main`, else `master`

Announce:

- Server URL you will test against
- Branch you are currently on
- How you will determine changed files

### 1. Verify agent-browser Installation

Before starting ANY browser testing, verify agent-browser is installed:

```bash
command -v agent-browser >/dev/null 2>&1 && echo "Ready" || (echo "Installing..." && npm install -g agent-browser && agent-browser install)
```

If installation fails, inform the user and stop.

### 2. Ask Browser Mode

<ask_browser_mode>

Before starting tests, ask user if they want to watch the browser:

Use AskQuestion with:
- Question: "Do you want to watch the browser tests run?"
- Options:
  1. **Headed (watch)** - Opens visible browser window so you can see tests run
  2. **Headless (faster)** - Runs in background, faster but invisible

Store the choice and use `--headed` flag when user selects "Headed".

</ask_browser_mode>

### 3. Determine Test Scope

<test_target> $ARGUMENTS </test_target>

<determine_scope>

**If PR number provided:**
```bash
gh pr view [number] --json files -q '.files[].path'
```

If `gh` is not available, ask the user for a branch name or use `current`.

**If 'current' or empty:**

Prefer the upstream tracking branch if available:

```bash
git diff --name-only @{upstream}...HEAD
```

If upstream is not configured, fall back to the configured default branch:

```bash
git diff --name-only "origin/${default_branch}"...HEAD
```

If neither is available, fall back to the last commit:

```bash
git diff --name-only HEAD~1..HEAD
```

**If branch name provided:**

If you are already on that branch, treat it like `current`.

If you are not on that branch, ask whether to switch branches or use a worktree via `git-worktree`.

To compute changed files for that branch (once checked out):

```bash
git diff --name-only "origin/${default_branch}"...HEAD
```

</determine_scope>

### 3. Map Files to Routes

<file_to_route_mapping>

Map changed files to testable routes.

This mapping is repo-specific. Prefer project conventions first.

If the repo does not have an obvious file->route mapping, ask the user for 3-10 URLs to validate.

Examples of starting heuristics:

- Backend API changes: validate at least one happy-path request and one error path (if a browser route exists, validate it too).
- UI component changes: validate at least one page that renders the component.
- Router changes: validate affected routes directly.
- Shared layout/styling changes: validate at least the homepage + 1-3 key flows.

Build a list of URLs to test based on the mapping.

</file_to_route_mapping>

### 4. Verify Server is Running

<check_server>

Before testing, verify the local server is accessible:

```bash
agent-browser open http://localhost:3000
agent-browser snapshot -i
```

If `dev_server_url` is configured in `AGENTS.md`, use that instead of `http://localhost:3000`.

If server is not running, inform user:
```markdown
**Server not running**

Please start your development server:
- Use the repo's dev command (see `AGENTS.md` if configured)

Then run `/test-browser` again.
```

</check_server>

### 5. Test Each Affected Page

<test_pages>

For each affected route, use agent-browser CLI commands (NOT Chrome MCP):

**Step 1: Navigate and capture snapshot**
```bash
agent-browser open "http://localhost:3000/[route]"
agent-browser snapshot -i
```

**Step 2: For headed mode (visual debugging)**
```bash
agent-browser --headed open "http://localhost:3000/[route]"
agent-browser --headed snapshot -i
```

**Step 3: Verify key elements**
- Use `agent-browser snapshot -i` to get interactive elements with refs
- Page title/heading present
- Primary content rendered
- No error messages visible
- Forms have expected fields

**Step 4: Test critical interactions**
```bash
agent-browser click @e1  # Use ref from snapshot
agent-browser snapshot -i
```

**Step 5: Take screenshots**
```bash
agent-browser screenshot page-name.png
agent-browser screenshot --full page-name-full.png  # Full page
```

</test_pages>

### 6. Human Verification (When Required)

<human_verification>

Pause for human input when testing touches:

| Flow Type | What to Ask |
|-----------|-------------|
| OAuth | "Please sign in with [provider] and confirm it works" |
| Email | "Check your inbox for the test email and confirm receipt" |
| Payments | "Complete a test purchase in sandbox mode" |
| SMS | "Verify you received the SMS code" |
| External APIs | "Confirm the [service] integration is working" |

Use AskQuestion:
```markdown
**Human Verification Needed**

This test touches the [flow type]. Please:
1. [Action to take]
2. [What to verify]

Did it work correctly?
1. Yes - continue testing
2. No - describe the issue
```

</human_verification>

### 7. Handle Failures

<failure_handling>

When a test fails:

1. **Document the failure:**
   - Screenshot the error state: `agent-browser screenshot error.png`
   - Note the exact reproduction steps

2. **Ask user how to proceed:**
   ```markdown
   **Test Failed: [route]**

   Issue: [description]
   Console errors: [if any]

   How to proceed?
   1. Fix now - I'll help debug and fix
   2. Create todo - Add to todos/ for later
   3. Skip - Continue testing other pages
   ```

3. **If "Fix now":**
   - Investigate the issue
   - Propose a fix
   - Apply fix
   - Re-run the failing test

4. **If "Create todo":**
   - Create `{id}-pending-p1-browser-test-{description}.md`
   - Continue testing

5. **If "Skip":**
   - Log as skipped
   - Continue testing

</failure_handling>

### 8. Test Summary

<test_summary>

After all tests complete, present summary:

```markdown
## Browser Test Results

**Test Scope:** PR #[number] / [branch name]
**Server:** http://localhost:3000

### Pages Tested: [count]

| Route | Status | Notes |
|-------|--------|-------|
| `/users` | Pass | |
| `/settings` | Pass | |
| `/dashboard` | Fail | Console error: [msg] |
| `/checkout` | Skip | Requires payment credentials |

### Console Errors: [count]
- [List any errors found]

### Human Verifications: [count]
- OAuth flow: Confirmed
- Email delivery: Confirmed

### Failures: [count]
- `/dashboard` - [issue description]

### Created Todos: [count]
- `005-pending-p1-browser-test-dashboard-error.md`

### Result: [PASS / FAIL / PARTIAL]
```

</test_summary>

## Quick Usage Examples

```bash
# Test current branch changes
/test-browser

# Test specific PR
/test-browser 847

# Test specific branch
/test-browser feature/new-dashboard
```

## agent-browser CLI Reference

Always use these Bash commands.

```bash
# Navigation
agent-browser open <url>           # Navigate to URL
agent-browser back                 # Go back
agent-browser close                # Close browser

# Snapshots (get element refs)
agent-browser snapshot -i          # Interactive elements with refs (@e1, @e2, etc.)
agent-browser snapshot -i --json   # JSON output

# Interactions (use refs from snapshot)
agent-browser click @e1            # Click element
agent-browser fill @e1 "text"      # Fill input
agent-browser type @e1 "text"      # Type without clearing
agent-browser press Enter          # Press key

# Screenshots
agent-browser screenshot out.png       # Viewport screenshot
agent-browser screenshot --full out.png # Full page screenshot

# Headed mode (visible browser)
agent-browser --headed open <url>      # Open with visible browser
agent-browser --headed click @e1       # Click in visible browser

# Wait
agent-browser wait @e1             # Wait for element
agent-browser wait 2000            # Wait milliseconds
```
