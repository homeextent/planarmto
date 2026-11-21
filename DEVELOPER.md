# Developer & Git Cheat Sheet

## Branch & Release Workflow (`staging` → `main`)
- **Active Development Branch (`staging`):** All feature work, bug fixes, refactors, and AI agent sessions (**Antigravity** and **Roo Code**) MUST run on the **`staging`** branch.
- **Protected Production Branch (`main`):** Never commit experimental or unverified edits directly to `main`. `main` represents the verified WordPress production release (`planar-mto.zip`).
- **AI Agent Pre-Flight Rule:** Before modifying any files, Antigravity and Roo Code must verify `git branch --show-current` is `staging` (if on `main`, run `git checkout staging` first) and must never run `npm run build:zip` on `main` without explicit user sign-off after testing on `staging`.

**Standard Development Loop (on `staging`)**
```bash
git checkout staging
git add .
git commit -m "feat: description of work"
git push
```

## Production Release Loop (`staging` → `main` → WordPress ZIP)

1. Verify all changes locally in `npm run dev` (http://localhost:3000/) and run `npm run lint` (`tsc --noEmit`).
2. Merge `staging` into `main`, tag the release, build the WordPress plugin archive (`../../builds/planar-mto.zip`), and immediately switch back to `staging`:

```bash
git checkout main
git pull origin main
git merge staging
git tag v2.14.0
git push origin main --tags
npm run build:zip
git checkout staging
```

## Local Development
- Start local dev server: `npm run dev`
- Open local preview in browser: http://localhost:3000/
- Type-check TypeScript without emitting files: `npm run lint`
- Install new package: `npm install <package-name>`
- Run build check: `npm run build`
- Build WP Plugin Package (from `main` only): `npm run build:zip` (Compiles React assets and exports `planar-mto.zip` to builds directory `../../builds/`)
- Deploy WP Plugin: Upload `planar-mto.zip` via WP Admin > Plugins > Add New > Upload Plugin > Replace current with uploaded
- Flush WP Permalinks: Go to Settings > Permalinks and click Save Changes (required if `/planarmto` endpoint returns 404)

## Multi-Tenant Development & API (v2.1.0+)
- Storage Abstraction: `src/utils/storage.ts` automatically switches between WordPress REST API and localStorage based on `isWP()`.
- REST API: Custom namespace `planarmto/v1` handles project CRUD, branding, and global rates.
- Database: `wp_planarmto_projects` stores user-scoped data indexed by `tenant_id` (`get_current_user_id()`).
- Testing: When developing locally (`npm run dev`), the system uses localStorage. To test MySQL persistence, build and install the plugin on a WordPress instance.

## Git Basics & Terminal Usage
- Check current branch and modified/staged files: `git status`
- Switch to staging branch: `git checkout staging`
- Stage all changes for commit: `git add .`
- Commit changes with message: `git commit -m "feat: description of work"`
- Push commits to GitHub: `git push`
- Pull latest changes from remote: `git pull`
- Terminal Prompt Tip: Do NOT copy the terminal prefix (e.g., `jeremy@jeremy-pc:...$`). Only type/paste the text that appears after the `$` symbol.

## Git Advanced & Project Backups
- Create clean `.zip` archive of committed code outside root: `git archive -o ../planarMTO.zip HEAD`
- Create `.zip` archive including uncommitted edits: `zip -r ../project-backup.zip . -x "*.git*" "node_modules/*"`
- Create and switch to new branch: `git checkout -b branch-name`
- Discard uncommitted edits on a single file: `git checkout -- <path/to/file>`
- Undo last commit (keep local edits): `git reset --soft HEAD~1`
- View commit log history: `git log --oneline`

## Hard Reset Local Branch to Match GitHub
To completely discard all local modifications, delete untracked files, and reset your active branch (`staging`) to match GitHub:

```bash
git fetch origin
git reset --hard origin/staging
git clean -fd
```
*(Replace `origin/staging` with `origin/main` if resetting `main`.)*

- `git fetch origin`: Downloads the latest state and commit history from GitHub without touching local working files.
- `git reset --hard origin/staging`: Forces local tracked files to match `origin/staging`, permanently discarding all uncommitted local modifications.
- `git clean -fd`: Removes all untracked files and directories created locally during build or test runs.

## System & VS Code Troubleshooting
- Reload VS Code extension host: `Ctrl + Shift + P` -> Developer: Reload Window
- Toggle Developer Console: Help > Toggle Developer Tools
- Force kill VS Code (run in Linux terminal `Ctrl + Alt + T`): `pkill -9 -f code`
- Reopen project from terminal: `code /media/jeremy/MEDIA/dev/repos/planarmto`
- Verify Ripgrep installation: `rg --version`

## Roo Code Workflow
- Branch Check: Confirm `git branch` is on `staging` before starting any task.
- Mode Selection: Use Architect Mode for codebase audits and handoffs, then switch to Code Mode for multi-file edits.
- Model Selection: Use `gemini-flash-latest` with thinking tokens capped (~3,000–4,000) and auto-condense threshold set to 40%.
- Start New Session: Click the `+` (New Task) icon at top-right before starting a new feature sprint or release packaging step.

## Repository Maintenance Protocol
Following the completion and user approval of any feature, bug fix, or architectural modification on `staging` (prior to merging to `main`), the codebase build process must systematically update:
- `README.md`: If new UI controls, toolbar options, or workflow capabilities are added.
- `SYSTEM_BIBLE.md`: If mathematical formulas, topological algorithms, calculation logic, or data structures are altered.
- `CHANGELOG.md`: Generate a new semantic version entry (`[vX.X.X]`) documenting feature releases, refactors, and QA resolutions.