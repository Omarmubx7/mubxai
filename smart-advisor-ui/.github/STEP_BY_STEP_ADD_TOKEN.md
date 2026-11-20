# Step-by-Step: Add CF_API_TOKEN to GitHub Right Now

I'll guide you through each click. Read one step, do it, then tell me when you're ready for the next.

---

## STEP 1: Open Repository & Click Settings

**What to do now:**
1. Go to your GitHub repository URL in your browser
2. Look at the very top-right corner of the page
3. Click the **gear icon** ⚙️ or the word **"Settings"**

**Do this now, then say "Step 1 done"**

---

## STEP 2: Navigate to Secrets Page

**What to do after Step 1:**
1. On the left side, you should see a sidebar menu
2. Click on ** "Secrets and variables"** (or just "Secrets" on some repos)
3. Then click on the **Actions** tab (at the top of the page, if not already selected)

**Do this now, then say "Step 2 done"**

---

## STEP 3: Click "New Repository Secret"

**What to do after Step 2:**
1. You should see a list of existing secrets (probably empty)
2. Look for a **blue button** that says ** "New repository secret"**
3. Click that button

**Do this now, then say "Step 3 done"**

---

## STEP 4: Fill In the Secret Form

**What to do after Step 3:**
A form should appear. Fill it in EXACTLY as follows:

- **Name field:** Type `CF_API_TOKEN` (with the underscore, exact case)
  - C-F-underscore-A-P-I-underscore-T-O-K-E-N
  - Make sure there are no extra spaces before or after

- **Value field:** Paste your Cloudflare API token here
  - It should look something like: `a1b2c3d4.5e6f7g8h.90ijklmnopqrstuv`
  - Paste the entire token, from start to finish
  - No extra spaces before or after

- **After filling both fields, look for a blue button at the bottom**
  - It should say ** "Add secret"**
  - Click it

**Do this now, then say "Step 4 done"**

---

## STEP 5: Verify & Test

**What to do after Step 4:**
1. You should now see `CF_API_TOKEN` listed in your secrets
2. The value will be masked (showing dots like `••••••••••••••••••••••••••••••••`)
3. Success message may appear: "Secret added successfully"

**Then:**
1. Click the ** "Actions"** tab at the very top of your GitHub page (next to "Insights", "Projects", "Security")
2. You should see "Deploy to Cloudflare" workflow
3. Click on the workflow name
4. Click the ** "Run workflow"** button on the right side
5. Watch the live logs below

**Say when you see the workflow running, and I'll tell you what to look for in the logs!**

---

## Summary of Clicks

```
Repo page
    ↓
Click "Settings" (top right, gear icon)
    ↓
Left: "Secrets and variables"
    ↓
Click "New repository secret" (blue button)
    ↓
Fill: Name = CF_API_TOKEN
    ↓
Fill: Value = [your Cloudflare token]
    ↓
Click: "Add secret" (blue button at bottom)
    ↓
Success!
    ↓
Click "Actions" (top tab)
    ↓
Click "Deploy to Cloudflare" workflow
    ↓
Click "Run workflow" (right side)
```

---

**I'm ready when you are! Do Step 1 (open repo + click Settings), then say "Step 1 done" and I'll tell you Step 2.**