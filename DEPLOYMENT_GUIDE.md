# First-Time Deployment Guide — Vacancy Management

This walks through deploying this app to a **brand-new** Power Platform tenant, from zero, assuming you've never touched Power Apps before. Follow it top to bottom — don't skip ahead. Budget about 45–60 minutes the first time.

For how the app is put together once it's running, see `ARCHITECTURE.md`.

---

## What you're actually setting up

This app has two halves, and you're deploying both:

1. **A database** (called "Dataverse" in Microsoft's world) — six tables that store communities, weekly vacancy reports, and the individual unit records inside each report, plus one small settings table.
2. **The app itself** — the thing people actually open and click around in, which reads and writes to that database.

You'll create the database first, then the app, then connect them together. Every step below is either "click around in a website" or "type a command in a terminal and press Enter" — nothing more exotic than that.

---

## Before you start: install three things

Do these in order. Each has a quick way to check it actually worked before moving on.

### 1. Node.js
Download and install from **https://nodejs.org** (pick the LTS version — the button that just says "Download").

**Check it worked:** open a terminal (see the box below if you don't know how) and type:
```bash
node --version
```
You should see something like `v22.x.x`. If you see "command not found" instead, close and reopen your terminal and try again.

> **Don't know how to open a terminal?** On Windows: press the Windows key, type `PowerShell`, press Enter. On Mac: press Cmd+Space, type `Terminal`, press Enter. You'll use this same window for every command in this guide.

### 2. Visual Studio Code (recommended, not strictly required)
Download from **https://code.visualstudio.com**. You'll use it later to edit a handful of files — it's free and makes that step much easier than a plain text editor.

### 3. Azure CLI
Download and install from **https://learn.microsoft.com/cli/azure/install-azure-cli** (pick the installer for your operating system).

**Check it worked:** in your terminal, type:
```bash
az --version
```
You should see version info printed, not an error.

### 4. PowerShell 7 (Windows users — Mac/Linux can skip this)
Even if you already have PowerShell on Windows, it's probably an older version (5.1) that comes built into Windows. You need the newer one:
```powershell
winget install Microsoft.PowerShell
```

**Check it worked:** close your terminal, reopen it, and type:
```powershell
pwsh --version
```
You should see `7.x.x`. From now on, whenever this guide says "open a PowerShell terminal," make sure you're running `pwsh`, not the plain `powershell` that comes built into Windows — mixing them up causes confusing errors later (the old one misreads special characters like em-dashes in these scripts and throws unrelated-looking syntax errors).

---

## Step 1 — Get the project files onto your computer

Ask whoever gave you access for the GitHub repository URL. Then either:

- **If you have the GitHub link:** go to the repository page in your browser → green **Code** button → **Download ZIP** → unzip it somewhere you'll remember.
- **If you have Git installed:** `git clone <the-repo-url>` in your terminal.

Either way, you should end up with a folder containing files like `package.json`, `ARCHITECTURE.md`, and a `src` folder.

### Open it and install dependencies

If you installed VS Code: open VS Code → **File → Open Folder** → select the project folder. Then open a terminal *inside VS Code* with **Terminal → New Terminal** — this automatically starts you in the right folder.

Otherwise, open your terminal and navigate into the folder manually:
```bash
cd path/to/the/project/folder
```

Then, either way, run:
```bash
npm install
```
This downloads everything the app needs to run. It'll print a lot of text and take a minute or two — that's normal.

---

## Step 2 — Create a Power Platform environment

An "environment" is Microsoft's term for an isolated workspace that holds your app and its database.

1. Go to **https://admin.powerplatform.microsoft.com** and sign in with your work account.
2. Click **Environments** in the left sidebar, then **+ New** near the top.
3. Give it a name (e.g. "Vacancy Management").
4. Choose **Sandbox** as the type (the safe default for a first deployment).
5. Under "Do you want to create a database for this environment?", choose **Yes**. Leave the other settings at their defaults and click through to finish.
6. Wait for it to finish provisioning (a minute or two).

**Write down your environment ID.** Click into the environment — the ID is the long string of letters/numbers in the browser's address bar, right after `environments/`. It looks like `12345678-abcd-1234-abcd-123456789012`.

> If you're deploying this into the **same** environment as another app that already has its own Dataverse database (for example, if your organization already runs a sibling Power Apps Code App), you can skip creating a new environment and reuse the existing one — just note its environment ID and Dataverse URL instead. That's how this app was originally built.

---

## Step 3 — Sign in with Azure CLI

Back in your terminal:
```bash
az login
```
This opens a browser window — sign in with the same work account. Once you see "Login succeeded" (or your account info printed) back in the terminal, close the browser tab and continue.

---

## Step 4 — Create the database tables

Find your **Dataverse URL** first: go back to `admin.powerplatform.microsoft.com`, click into your environment, and look for a URL that looks like `https://yourorg.crm.dynamics.com`.

Now run the two setup scripts, in order. **Open a `pwsh` terminal specifically**, navigate into the project folder, then:
```powershell
.\scripts\setup-dataverse.ps1 -OrgUrl "https://yourorg.crm.dynamics.com"
```
This creates five tables (Communities, Vacancy Reports, Unit Updates, Applicant Update History, Report Configuration). It prints progress as it goes, ending with something like:
```
Done! Publisher prefix is: abc123
```
**Write down that prefix** (yours will be different from `abc123`) — you'll need it repeatedly below.

Then run the second script, which creates the sixth table (a small settings table holding the portfolio vacancy goal) and seeds its one starting row:
```powershell
.\scripts\setup-appsettings-table.ps1 -OrgUrl "https://yourorg.crm.dynamics.com"
```
It automatically picks up the same publisher prefix — you don't need to tell it separately.

---

## Step 5 — Register the app

Back in a regular terminal (this command works in any terminal, `pwsh` or otherwise):
```bash
npx power-apps init -n "Vacancy Management" -e <your-environment-id>
```
Replace `<your-environment-id>` with the ID from Step 2.

This opens a browser window for sign-in — use the same work account. Once it completes, you'll have a new file called `power.config.json` in your project folder.

---

## Step 6 — Connect the app to its database tables

Replace `<prefix>` in every line below with the publisher prefix you wrote down in Step 4:
```bash
npx power-apps add-data-source -a dataverse -t <prefix>_communities -u https://yourorg.crm.dynamics.com
npx power-apps add-data-source -a dataverse -t <prefix>_vacancyreports -u https://yourorg.crm.dynamics.com
npx power-apps add-data-source -a dataverse -t <prefix>_unitupdates -u https://yourorg.crm.dynamics.com
npx power-apps add-data-source -a dataverse -t <prefix>_applicantupdatehistory -u https://yourorg.crm.dynamics.com
npx power-apps add-data-source -a dataverse -t <prefix>_reportconfiguration -u https://yourorg.crm.dynamics.com
npx power-apps add-data-source -a dataverse -t <prefix>_appsettings -u https://yourorg.crm.dynamics.com
```
Then two more — these are Microsoft's own built-in tables (no prefix), used only for the Admin-access check:
```bash
npx power-apps add-data-source -a dataverse -t systemuser -u https://yourorg.crm.dynamics.com
npx power-apps add-data-source -a dataverse -t role -u https://yourorg.crm.dynamics.com
```
Each command should complete with something like "Data source added successfully." (The `-u`/`--org-url` flag is required every time, even though the environment is already set in `power.config.json`.)

---

## Step 7 — Update the code to match your prefix (the one manual editing step)

The app's code currently expects the prefix `cr1e9` (from how it was originally built). Since yours is different, **seven files** need a find-and-replace — this app touches Dataverse from more places than some other Code Apps, so this step is a bit more involved than you might expect, but it's still entirely mechanical.

In VS Code, open each file below, press **Ctrl+H** (Windows) or **Cmd+H** (Mac) to open Find & Replace, check the **"Match Case"** option, and do both replacements in each one:

- Find `Cr1e9_` (capital C), replace with `<Prefix>_` — using your prefix with a **capital first letter**. Example: if your prefix is `abc123`, replace with `Abc123_`.
- Find `cr1e9_` (all lowercase), replace with `<prefix>_` — **all lowercase**.

Do this in:
- `src/types.ts`
- `src/hooks/useCommunities.ts`
- `src/hooks/useVacancyReports.ts`
- `src/hooks/useUnitUpdates.ts`
- `src/hooks/useAppSettings.ts`
- `src/hooks/usePriorityQueue.ts`
- `src/hooks/useUnitStreaks.ts`
- `src/hooks/useFastTrackUnits.ts`

Save each file (Ctrl+S / Cmd+S) when done. **Don't touch `src/hooks/useIsAdmin.ts`** — it only talks to the built-in `systemuser`/`role` tables, which have no prefix.

---

## Step 8 — Set up access control (two security roles, by hand)

Unlike some other Code Apps, this one doesn't have an automated script for this part — you'll create two Dataverse security roles through the portal. This gates two different things: whether someone can open the app and enter reports at all, and whether they see the Admin tab.

1. Go to **https://admin.powerplatform.microsoft.com**, click your environment, then **Settings → Users + permissions → Security roles**.
2. Click **+ New role**. Name it something like **"VM Staff"**. Under each of these tables, set the **Read** privilege to **Organization** level (this is a shared-portfolio app — everyone needs to see every community's data, not just their own), and set **Create** and **Write** to at least **User** level on `Vacancy Reports` and `Unit Updates` (so staff can submit reports):
   - Communities
   - Vacancy Reports
   - Unit Updates
   - App Settings
   - Applicant Update History
   - Report Configuration
3. Save it.
4. Click **+ New role** again. Name it **exactly** `APP - AH Vacancy Management Admin` — this exact string is checked by the app's code (`ADMIN_ROLE_NAME` in `src/hooks/useIsAdmin.ts`), so a typo here means nobody gets the Admin tab. Give this role **Write** access at Organization level on `App Settings` and `Communities`.
5. Save it.

> **If you'd rather use a different admin role name**, that's fine — just open `src/hooks/useIsAdmin.ts`, find the line `const ADMIN_ROLE_NAME = 'APP - AH Vacancy Management Admin';`, and change the string to match whatever you named the role. Rebuild and redeploy afterward (Step 10) for the change to take effect.

You'll assign these roles to actual people in Step 12, after the app exists to assign them to.

---

## Step 9 — Seed the community roster

The Communities table starts out empty — there's no built-in sample data. Pick one:

- **A handful of test communities:** just add a few rows directly in Dataverse (`make.powerapps.com` → your environment → Tables → `Communities` → Data → **+ New row**) to try the app out.
- **Your real roster from a SharePoint list:** export the list to CSV (Excel: File → Export, or SharePoint's own "Export to CSV"), then run:
  ```powershell
  .\scripts\import-communities-csv.ps1 -CsvPath "C:\path\to\export.csv" -OrgUrl "https://yourorg.crm.dynamics.com"
  ```
  This is safe to re-run any time your roster changes — it matches existing rows by Community Code and only adds/updates, never duplicates. It expects the exact column names a raw SharePoint CSV export produces (Title, Community Code, Administrator, Regional Property Supervisor, Director, Asset Manager, # of units) — see the comment block at the top of the script if your columns are named differently.

---

## Step 10 — Build and deploy

```bash
npm run build
npx power-apps push
```

The first command packages up the app; the second uploads it. When it finishes, it prints a URL — that's your live app.

---

## Step 11 — Open it and check it works

Open the URL printed in the last step. You should see the Vacancy Management app load with an empty (or test-data) list of communities. Try the **New Report** tab: pick a community, add a unit row, and save — if it saves without an error, the database connection is working. Then check **Priority Queue** and **Dashboard** show that report's numbers.

You won't see the **Admin** tab yet — that's expected, since you haven't assigned yourself a role (next step).

---

## Step 12 — Share it and assign roles

Sharing the app only lets people *open* it — it doesn't give them database permissions on its own, so without the role assignments below they'll hit a permissions error the moment they try to save anything.

1. Go to `https://make.powerapps.com`, find your app, click the **⋯** menu → **Share**, and add the people who need access.
2. Back in `admin.powerplatform.microsoft.com` → your environment → **Users + permissions → Users**, find each person (they need to have opened the app or otherwise signed into the environment at least once already, or the portal won't find them yet), open their record, and **Manage roles**:
   - Everyone who submits reports gets **VM Staff**.
   - Anyone who should see the Admin tab gets **VM Staff** *and* `APP - AH Vacancy Management Admin` (roles stack — this doesn't replace the base role).

---

## You're done

At this point you have a fully working, independently deployed copy of the app. From here:

- **To deploy a change later:** just `npm run build && npx power-apps push` again from this same folder.
- **To understand how the pieces fit together** once you're past initial setup, see `ARCHITECTURE.md`.
- **To change a Dataverse choice option's label** (e.g. renaming a status category), that's not something the app's own UI does — it needs a one-off Web API script similar to the setup scripts here, followed by re-running the `add-data-source` command for that table so the app's generated code picks up the new label. See `memory-bank.md` for a worked example if you need to do this.

---

## Troubleshooting

**TypeScript errors after Step 6:** The generated service names or column names don't match the hooks. Double-check the prefix replacements in Step 7 — a common mistake is replacing only the lowercase `cr1e9_` and missing a capitalized `Cr1e9_` (or vice versa).

**"Cannot find module '../generated/services/...'":** You skipped one of the eight `add-data-source` commands in Step 6, or a table name was misspelled. Re-run the missing one.

**Admin tab never shows up, even for someone you assigned the admin role to:** Almost always a name mismatch — the role's name in Dataverse must match `ADMIN_ROLE_NAME` in `src/hooks/useIsAdmin.ts` **exactly**, including capitalization and spacing. Also confirm the person has actually signed into the app at least once since being assigned the role (the browser session may have the old, non-admin result cached — a full page reload re-checks it).

**Admin "Save" button on the portfolio goal appears to do nothing:** If it fails silently with no error message at all, you're likely running an older build — this was a real bug (missing error handling) that's already fixed in the current code; make sure you're deploying the latest version. If it shows a red error message instead, read it — that's the actual Dataverse error (usually a missing `Write` privilege on `App Settings` for that user's role).

**Community dropdown is empty after a fresh deploy:** Expected if you haven't done Step 9 yet — the table starts empty, it isn't seeded automatically.

**`HTTP error status: 403` or similar when running `add-data-source`:** Confirm you're signed in as a user with System Administrator or System Customizer rights in that environment (`az login` again if you're not sure which account is active).

**A `.ps1` script fails with something like `The string is missing the terminator` or `Missing closing '}' in statement block`:** You're running it in the old built-in Windows PowerShell (5.1) instead of `pwsh` (7+) — it misreads the scripts' UTF-8 characters (em dashes, etc.) as something else. Rerun the exact same command in a `pwsh` terminal (see the PowerShell 7 check at the top of this guide).
