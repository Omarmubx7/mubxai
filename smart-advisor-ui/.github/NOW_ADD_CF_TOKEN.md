# RIGHT NOW: Add CF_API_TOKEN to GitHub

Let's add your Cloudflare API token to GitHub right now. Follow these exact steps:

## Step 1: Open Your Repository
Go to your GitHub repository URL in your browser.
Example: https://github.com/your-username/mubxai

## Step 2: Click Settings
- Look at the very top right of the page
- Click the **gear icon** or the word **"Settings"**

## Step 3: Go to Secrets Page
Left sidebar should appear. Click:
- **Secrets and variables** (or just "Secrets" on some repos)
- Then click the **Actions** tab (if not already selected)

## Step 4: Add New Secret
You should see a list of existing secrets (probably empty). Find the:
- **Blue button** labeled: **New repository secret**
- Click it

## Step 5: Fill In the Secret

A form will appear. Fill it in exactly:

- **Name:** `CF_API_TOKEN` 
  - Type exactly: C-F-underscore-A-P-I-underscore-T-O-K-E-N
  - Case matters! Must be exactly `CF_API_TOKEN`

- **Value:** [Paste your Cloudflare token here]
  - This is the token you created at https://dash.cloudflare.com/profile/api-tokens
  - It should look something like: `a1b2c3d4.5e6f7g8h.90ijklmnopqrstuv`
  - Paste the entire thing, no extra spaces

- Then click the **blue button** at the bottom that says: **Add secret**

## Step 6: Verify It Worked

You should now see:
- `CF_API_TOKEN` listed in your secrets
- The value will be masked (showing dots) for security
- You might see a success message: "Secret added successfully"

## Step 7: Test the Workflow

1. Click the **Actions** tab at the top of your GitHub repo (next to "Insights", "Projects", etc.)
2. You should see "Deploy to Cloudflare" workflow
3. Click on the workflow name
4. Click the **Run workflow** button on the right side
5. Watch the live logs below

### Success Indicators in Logs:
- "Cloudflare API token set" 
- Or: "Running: npx @opennextjs/cloudflare deploy..."

### If You See Errors:
- "Invalid API token" - double-check you pasted the entire token correctly
- "Insufficient permissions" - the token needs `Workers > Edit` permission
- "Secret not found" - make sure the name is exactly `CF_API_TOKEN`

## What Happens Next

Once the CF_API_TOKEN is added:

1. **On next push** to main/master, OR
2. **When you click Run workflow** manually

The workflow will:
- ✅ Run on Ubuntu Linux (this fixes the Windows build timeout!)
- ✅ Install dependencies
- ✅ Build Next.js + OpenNext config
- ✅ Deploy to your Cloudflare Workers site
- ✅ Update your site at ai.mubx.dev

## Need the Token First?

If you haven't created a Cloudflare API token yet:

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create token"**
3. Select **"Start from scratch"**
4. Name it: `mubxai-github-actions`
5. Under "Resource Permissions":
   - Find "Account" → select "Workers" → select "Edit"
6. Click **"Create token"**
7. **Copy the token** that appears (you only see it once!)
8. Then come back and add it to GitHub using the steps above

## Quick Reference: Menu Clicks

```
Your GitHub Repo Page
    ↓
Click "Settings" (top right, gear icon)
    ↓
Left sidebar: "Secrets and variables"
    ↓
Click "Actions" tab (if needed)
    ↓
Button: "New repository secret"
    ↓
Fill in:
   Name: CF_API_TOKEN
   Value: [paste token]
    ↓
Click: "Add secret"
    ↓
Success! ✅
    ↓
Click "Actions" tab at top
    ↓
Click "Deploy to Cloudflare" workflow
    ↓
Click "Run workflow" (right side)
```

---

**Ready to do it? Go ahead and add the CF_API_TOKEN to your GitHub repository now using the steps above!**

If you get stuck at any point, or if you need help creating the Cloudflare token first, just let me know and I'll guide you through that too.