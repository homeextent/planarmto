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
* Create clean `.zip` archive of committed code outside root: `git archive -o ../project-backup.zip HEAD`
* Create `.zip` archive including uncommitted edits: `zip -r ../project-backup.zip . -x "*.git*" "node_modules/*"`
* Create and switch to new branch: `git checkout -b branch-name`
* Switch back to main branch: `git checkout main`
* Discard uncommitted edits on a file: `git checkout -- <path/to/file>`
* Undo last commit (keep local edits): `git reset --soft HEAD~1`
* View commit log history: `git log --oneline`

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