# Add CF_API_TOKEN to GitHub - All Steps at Once

You can do all the steps below at your own pace. Here's the complete process:

## Step 1: Open Repository & Click Settings
1. Go to your GitHub repository in your browser
2. Look at the top-right corner
3. Click the **gear icon** ⚙️ or the word **"Settings"**

## Step 2: Navigate to Secrets Page
1. On the left sidebar, click ** "Secrets and variables"** 
2. Then click the **Actions** tab at the top of the page

## Step 3: Add New Secret
1. You'll see a list of existing secrets (likely empty)
2. Find the **blue button** labeled ** "New repository secret"**
3. Click it

## Step 4: Fill In the Secret Form
A form appears. Fill it in EXACTLY:

- **Name field:** Type `CF_API_TOKEN` 
  - Include the underscore: C-F-underscore-A-P-I-underscore-T-O-K-E-N
  - Case must match exactly
  
- **Value field:** Paste your Cloudflare API token
  - It looks like: `a1b2c3d4.5e6f7g8h.90ijklmnopqrstuv`
  - Paste the entire thing, no extra spaces

- Then click the **blue button at the bottom**: ** "Add secret"**

## Step 5: Verify It Worked
1. You should now see `CF_API_TOKEN` in your secrets list
2. The value will be masked (dots for security)
3. You may see a success confirmation

## Step 6: Test the Workflow
1. Click the ** "Actions"** tab at the very top of GitHub (next to "Insights")
2. Click on "Deploy to Cloudflare" workflow
3. Click the ** "Run workflow"** button on the right side
4. Watch the live logs below

### What indicates success:
- "Cloudflare API token set" in the logs
- Or the deployment commands running

### What indicates issues:
- "Invalid API token" - re-check you copied the full token
- "Insufficient permissions" - the token needs Workers Edit permission

---

## Quick Menu Clicks Summary

```
Your repo page
    ↓
Click Settings (top right gear icon)
    ↓
Left sidebar: "Secrets and variables"
    ↓
Click "Actions" tab
    ↓
Blue button: "New repository secret"
    ↓
Name: CF_API_TOKEN
Value: [paste your token]
    ↓
Blue button: "Add secret"
    ↓
Success! Secret added.
    ↓
Click "Actions" tab (top)
    ↓
Click "Deploy to Cloudflare" workflow
    ↓
Click "Run workflow" (right side)
```

---

## After Adding the Token

Once you've added `CF_API_TOKEN`, the workflow will:

1. ✅ Run on Ubuntu Linux (fixes the Windows build timeout)
2. ✅ Build your Next.js + OpenNext project
3. ✅ Deploy to Cloudflare Workers
4. ✅ Update your site at ai.mubx.dev

**You can do all the steps now at your own pace. When you've added the secret and want to test the workflow, or if you run into any issues, just let me know what you see and I'll help!**

---

**Do you want to add the other secrets too (DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET), or just the CF_API_TOKEN first?**</think>
<tool_call>
<function=question>
<parameter=questions>
[{"question": "Ready to add all the secrets? I can guide you through adding CF_API_TOKEN first, then the others (DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET). Just let me know you want to start with CF_API_TOKEN.", "header": "Start Adding Secrets", "options": [{"label": "Yes, start with CF_API_TOKEN now", "description": "Guide me through adding the Cloudflare API token to GitHub"}, {"label": "Show me all the secret values I need first", "description": "Tell me what values I need for all 4 secrets before I start adding them"}, {"label": "I'll add them all myself", "description": "I'll read the guides and add the secrets on my own timeline"}], "multiple": false}]