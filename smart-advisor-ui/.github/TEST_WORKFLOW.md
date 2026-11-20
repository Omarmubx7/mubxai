# Testing the Cloudflare Deployment Workflow

You've successfully added the `CF_API_TOKEN` secret. Now let's test the workflow.

## Step 1: Go to the Actions Tab
1. At the top of your GitHub repository page (next to "Insights", "Projects", "Security")
2. Click on ** "Actions"**

## Step 2: Find the Workflow
1. You should see "Deploy to Cloudflare" listed
2. Click on the workflow name (it may be the only one, or you may need to scroll)

## Step 3: Run the Workflow
1. On the right side of the workflow page, click the ** "Run workflow"** button
2. A modal may appear - you can usually just click **"Run workflow"** again
3. The workflow will start running

## Step 4: Watch the Logs
1. Below the workflow name, you'll see live logs
2. The workflow has several steps:
   - Cancel in-progress runs
   - Checkout repository
   - Setup Node.js
   - Install dependencies
   - Build for Cloudflare
   - Deploy to Cloudflare
   - Verify deployment

## Step 5: What to Look For

### Success Indicators:
- "Cloudflare API token set" - this means your token is working
- "Running: npx @opennextjs/cloudflare deploy..." - deployment starting
- "Deployment complete!" - at the end

### Failure Indicators (and what they mean):
| Error Message | What It Means | How to Fix |
|---------------|---------------|------------|
| "Invalid API token" | The token is incorrect or malformed | Re-check you copied the entire token from Cloudflare |
| "Insufficient permissions" | The token doesn't have Workers Edit permission | Go back to Cloudflare and ensure you selected `Workers > Edit` |
| "Secret not found" | The secret name doesn't match | Make sure the secret name is exactly `CF_API_TOKEN` (case-sensitive) |
| Timeout > 30 minutes | First build can be slow | This is normal; subsequent builds are faster |
| "next build" hanging | May indicate code issues | Check if `next build` completes successfully locally |

## Step 6: After the Workflow Completes

### If Successful:
- Your site at `ai.mubx-dev` should have been updated
- Check the Cloudflare dashboard to see the new Worker
- The workflow will show a green checkmark

### If Failed:
- Take note of the exact error message
- Let me know what you see and I'll help troubleshoot
- Common fixes: verify token permissions, check DATABASE_URL, etc.

## Quick Reference: Menu Clicks

```
Repo page
    ↓
Click "Actions" (top tab)
    ↓
Click "Deploy to Cloudflare" workflow
    ↓
Click "Run workflow" (right side, blue button)
    ↓
Watch live logs below
```

---

**Go ahead and run the workflow now, and tell me what you see in the logs!** I'll help you interpret any messages.