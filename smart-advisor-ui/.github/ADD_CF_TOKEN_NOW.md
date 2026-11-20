# Add CF_API_TOKEN to GitHub Right Now

You've created your Cloudflare API token. Now add it to GitHub:

## Step 1: Open Your GitHub Repository
1. Go to your GitHub repo URL in your browser
2. Example: https://github.com/your-username/mubxai

## Step 2: Click Settings
1. Look at the top-right corner of the page
2. Click the **gear icon** ⚙️ or the word **"Settings"**

## Step 3: Go to Secrets Page
1. Left sidebar should appear
2. Click ** "Secrets and variables"** 
3. Then click the ** Actions** tab at the top

## Step 4: Add New Secret
1. You'll see a list of existing secrets (probably empty)
2. Find the **blue button** labeled ** "New repository secret"**
3. Click it

## Step 5: Fill In the Secret Form
A form appears. Fill it in EXACTLY:

- **Name field:** Type `CF_API_TOKEN` 
  - Include the underscore: C-F-underscore-A-P-I-underscore-T-O-K-E-N
  - Case must match exactly
  
- **Value field:** Paste your Cloudflare API token here
  - It looks like: `a1b2c3d4.5e6f7g8h.90ijklmnopqrstuv`
  - Paste the entire token, from start to finish
  - No extra spaces before or after

- Then click the **blue button at the bottom**: ** "Add secret"**

## Step 4: Verify It Worked
1. You should now see `CF_API_TOKEN` listed in your secrets
2. The value will be masked (showing dots) for security
3. Success message may appear: "Secret added successfully"

## Step 5: Test the Workflow
1. Click the ** "Actions"** tab at the top of your GitHub page (next to "Insights")
2. Click on "Deploy to Cloudflare" workflow
3. Click the ** "Run workflow"** button on the right side
4. Watch the live logs below

### What indicates success:
- "Cloudflare API token set" in the logs
- Or the deployment commands running

### What indicates issues:
- "Invalid API token" - re-check the token was copied completely
- "Insufficient permissions" - make sure the token has `Workers > Edit` permission

---

## Quick Reference

```
Repo page
    ↓
Click "Settings" (top right, gear icon)
    ↓
Left: "Secrets and variables"
    ↓
Click "Actions" tab
    ↓
Blue button: "New repository secret"
    ↓
Name: CF_API_TOKEN
Value: [your Cloudflare token]
    ↓
Blue button: "Add secret"
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

**You've completed Step 5 (verifying the secret was added). Now do Step 6 (test the workflow) and let me know what you see in the logs!**