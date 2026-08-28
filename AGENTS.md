# AGENTS.md

Repository-wide instructions for AI coding agents (Claude Code, Cursor, and others). This file is the single source of truth for Git conventions in this repo — other agent config files (`CLAUDE.md`, `.cursor/rules/*.mdc`) point back here instead of restating the rules.

## Git Workflow

### Branch naming convention

```
<type>/<short-kebab-case-description>
```

Allowed types:

- `feat` — new feature
- `fix` — bug fix
- `refactor` — code restructuring without changing behavior
- `chore` — tooling, dependencies, configuration
- `docs` — documentation
- `test` — tests only

Examples:

```
feat/apple-auth
feat/growth-carousel
feat/subscription-paywall
fix/login-crash
fix/keyboard-overlap
refactor/auth-flow
chore/update-dependencies
test/auth-flow
```

Branch naming rules:

- Always lowercase.
- Always use kebab-case after the `/`.
- Keep the description concise, ideally 2–5 words.
- Do not include Jira/ticket numbers in the branch name unless explicitly asked.
- Never make feature changes directly on `main`.
- One logical task should normally equal one branch and one PR.
- Do not mix unrelated work into an existing task branch.

### Agent behavior

Before modifying code for a new task:

1. Inspect the current Git branch and working tree.
2. Determine whether the requested work belongs to the current branch.
3. Categorize the task as `feat`, `fix`, `refactor`, `chore`, `docs`, or `test`.
4. Generate an appropriate branch name using the convention above.
5. If currently on `main`, create/switch to the new task branch before modifying files.
6. If currently on a different task branch:
   - continue on it only if the new work clearly belongs to the same logical task;
   - otherwise do not mix the work into that branch.
7. If there are uncommitted user changes, do not discard, reset, overwrite, stash, or otherwise alter them without permission.

### Parallel agent workflow

Principle:

```
1 task = 1 branch = 1 worktree = 1 agent session = 1 PR
```

When multiple independent Claude/Cursor agents may work concurrently:

- each independent task should have its own Git branch;
- prefer a separate Git worktree for each concurrent task;
- do not have multiple agents modify the same working directory concurrently;
- avoid parallelizing tasks that heavily modify the same files;
- never delete another agent's branch or worktree automatically.

If a task is being started specifically as parallel work, use a worktree when practical.

### Commits

Use Conventional Commit types for the message header:

```
feat: add subscription paywall
fix: correct carousel scaling
refactor: simplify auth state
chore: update dependencies
test: add auth flow tests
```

- Keep commits focused on one coherent change.
- Do not create commits unless explicitly asked to, unless existing repository instructions already authorize automatic commits.

> **Repo-specific requirement:** this repository has no Jira tracker — do not add a `G3P-XXXXX` or any other ticket reference to commits or branch names. See `.claude/commands/commit.md` for subject-length/case rules; the Conventional Commit types above are the baseline, not a replacement for it.

### Pull requests

Suggested PR title format (same as the commit header):

```
feat: add subscription paywall
fix: prevent login crash
```

- A PR should represent one logical change.
