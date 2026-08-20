# Developer & Git Cheat Sheet

**Local Development**
* Start local dev server: `npm run dev`
* Open local preview in browser: `http://localhost:3000/`
* Install new package: `npm install <package-name>`
* Run build check: `npm run build`

---

**Git Basics & Terminal Usage**
* View modified/staged files: `git status`
* Stage all changes for commit: `git add .`
* Commit changes with message: `git commit -m "feat: description of work"`
* Push commits to GitHub: `git push`
* Pull latest changes from remote: `git pull`
* **Terminal Prompt Tip:** Do NOT copy the terminal prefix (e.g., `jeremy@jeremy-pc:...$`). Only type/paste the text that appears *after* the `$` symbol.

---

**Git Advanced & Project Backups**
* Create clean `.zip` archive of committed code outside root: `git archive -o ../planarMTO.zip HEAD`
* Create `.zip` archive including uncommitted edits: `zip -r ../project-backup.zip . -x "*.git*" "node_modules/*"`
* Create and switch to new branch: `git checkout -b branch-name`
* Switch back to main branch: `git checkout main`
* Discard uncommitted edits on a file: `git checkout -- <path/to/file>`
* Undo last commit (keep local edits): `git reset --soft HEAD~1`
* View commit log history: `git log --oneline`

---
**To completely discard all local modifications, delete any newly created untracked files (like new folders or build files), and reset your local directory to match your GitHub repository, run these three commands in your terminal:**


* git fetch origin
* git reset --hard origin/main
* git clean -fd

**What these commands do:**

* git fetch origin: Downloads the latest state and commit history from your remote GitHub repository without touching your local working files.
* git reset --hard origin/main: Forces your local tracked files to match the main branch on GitHub, permanently discarding all uncommitted local modifications.
* git clean -fd: Removes all untracked files and directories created during your plugin build attempt (such as planar-mto.php, build output folders, or temporary .zip files).
---

**System & VS Code Troubleshooting**
* Reload VS Code extension host: `Ctrl + Shift + P` -> `Developer: Reload Window`
* Toggle Developer Console: `Help > Toggle Developer Tools`
* Force kill VS Code (run in Linux terminal `Ctrl + Alt + T`): `pkill -9 -f code`
* Reopen project from terminal: `code /media/jeremy/MEDIA/GITHUB/planarmto`
* Verify Ripgrep installation: `rg --version`

---

**Roo Code Workflow**
* Mode Selection: Ensure **Code Mode** is selected for multi-file edits.
* Model Selection: Use **gemini-2.5-flash** or **gemini-3-flash-preview**.
* Start New Session: Click the `+` (New Task) icon at top-right before starting a new feature sprint.

---

**Repository Maintenance Protocol**
Following the completion and user approval of any feature, bug fix, or architectural modification, the codebase build process must systematically update:
*   `README.md`: If new UI controls, toolbar options, or workflow capabilities are added.
*   `SYSTEM_BIBLE.md`: If mathematical formulas, topological algorithms, calculation logic, or data structures are altered.
*   `CHANGELOG.md`: Generate a new semantic version entry ([vX.X.X]) documenting feature releases, refactors, and QA resolutions.
