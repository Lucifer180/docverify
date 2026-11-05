# How to Run DocVerify

AI-Powered Document Processing and Verification System — setup guide for Windows.

---

## Step 1 — Install Node.js (one time only)

1. Go to **https://nodejs.org** and download the **LTS** version (22 or newer).
2. Run the installer and click **Next** on every screen (keep the defaults).
3. Check it: press the **Windows key**, type `cmd`, press **Enter**, then type:

   ```
   node -v
   ```

   It must show **v22** or higher.

> **Node.js version 20 will not work.** If you have it, install the newer LTS version over it.

---

## Step 2 — Unzip the project

Right-click **docverify.zip** → **Extract All** → choose a folder (for example the Desktop) → **Extract**.

---

## Step 3 — Start the application

1. Open the extracted **docverify** folder.
2. Double-click **start.bat**.
   If Windows shows "Windows protected your PC", click **More info** → **Run anyway**.
3. The first start takes **3–5 minutes** while it installs everything.
   Two black windows open: **DocVerify backend** and **DocVerify frontend**.
4. The browser opens **http://localhost:5173** automatically.

> Keep both black windows open while using the app. To stop it, close them.
> Next time, double-click `start.bat` again — it starts in a few seconds.

---

## Step 4 — Log in

On the login page, click one of the **Demo accounts** buttons, then **Sign in**:

| Role      | Email                     | Password      | What they do                         |
|-----------|---------------------------|---------------|--------------------------------------|
| Submitter | submitter@docverify.local | Submitter@123 | Creates cases, uploads documents     |
| Reviewer  | reviewer@docverify.local  | Reviewer@123  | Checks results, approves or rejects  |
| Admin     | admin@docverify.local     | Admin@123     | Users, rules and audit log           |

---

## Step 5 — Try it with the sample documents

Sample files are in: `docverify\backend\tests\fixtures\samples`

1. Log in as **Submitter** → **New case** → name **Ravi Kumar Sharma**, date of birth **12-03-2004** → **Create case**.
2. Drag the three **c1_** files into the upload box → **Upload**.
   After about 10 seconds: **Passed automated checks**.
3. Create another case: **Anita Desai**, **25-07-2003**, and upload the two **c2_** files.
   Result: **Flagged for review**.
4. Click **Submit for review**, log out, log in as **Reviewer**, open the case and record a decision.

---

## Optional — Turn on AI extraction (Groq)

The app works without this (it uses a built-in offline extractor). To use real AI:

1. Create a free account at **https://console.groq.com** → **API Keys** → **Create API Key** (it starts with `gsk_`).
2. Open **docverify\backend\.env** with Notepad (this file appears after the first start).
3. Change these **three** lines, then save:

   ```
   GROK_API_KEY=gsk_paste_your_key_here
   GROK_BASE_URL=https://api.groq.com/openai/v1
   GROK_MODEL=openai/gpt-oss-120b
   ```

4. Close both black windows and double-click **start.bat** again.

> Change **all three** lines. Changing only the key gives an **"Incorrect API key"** error.
> Never share your API key with anyone.

---

## If something goes wrong

| Problem | Solution |
|---|---|
| Backend window shows **better_sqlite3** or **NODE_MODULE_VERSION** error | Node.js is too old. Install Node 22+, open `cmd` in `docverify\backend`, run `npm rebuild`, then start again. |
| **'node' is not recognized** | Node.js is not installed, or restart the computer after installing it. |
| **Port 5000 already in use** | In `backend\.env` change `PORT=5000` to `PORT=5050`; in `frontend\.env` set `VITE_BACKEND_URL=http://localhost:5050`. |
| Document shows **Processing failed** with **429** | The free Groq limit was reached. Wait one minute, open the document and click **Try again**. |
| Page opens but login does not work | The backend window was closed or shows a red error — read the message there and restart `start.bat`. |
