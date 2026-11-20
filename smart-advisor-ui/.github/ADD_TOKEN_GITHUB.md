# Adding CF_API_TOKEN to GitHub Repository

## Quick Instructions

You need to add the Cloudflare API token to your GitHub repository secrets. Here's exactly where to go:

### Step-by-Step: Web Interface

1. **Open your GitHub repository**
   - Go to: https://github.com/your-username/your-repo (replace with actual repo)

2. **Click Settings**
   - Look at the top right corner of the page
   - Click the **gear icon** or "Settings" link

3. **Navigate to Secrets**
   - Left sidebar will expand
   - Click **Secrets and variables** (or just "Secrets" on some repos)
   - Then click **Actions** tab (if not already selected)

4. **Add New Secret**
   - You'll see a list of existing secrets (likely empty)
   - Click the **blue button** that says **New repository secret**

5. **Fill in the secret:**
   - **Name:** `CF_API_TOKEN` (exact case, including underscore)
   - **Value:** [Paste your Cloudflare API token here]
     - Make sure it's the full token (looks like: `a1b2c3d4.5e6f7g8h.90ijklmnopqrstuv`)
     - No extra spaces before or after
   - Click **Add secret** (blue button at bottom right)

6. **Verify it was added**
   - You should now see `CF_API_TOKEN` in the list of secrets
   - The value will be masked (dots instead of full text) for security

### Using GitHub CLI (if you have it installed)

If you have the GitHub CLI (`gh`) installed, you can add it from your terminal:

```bash
cd C:\Users\omara\projectx\mubxai\smart-advisor-ui
gh secret set CF_API_TOKEN
# Then paste your token when prompted
```

Or with the value directly:
```bash
gh secret set CF_API_TOKEN "a1b2c3d4.5e6f7g8h.90ijklmnopqrstuv"
```

## After Adding the Secret

### Test the Workflow

1. Go to the **Actions** tab at the top of your GitHub repo
2. You should see "Deploy to Cloudflare" workflow
3. Click the workflow name
4. Click **Run workflow** button (on the right side)
5. Watch the live logs

### What to Look For in Logs

**Success (you'll see):**
```
Cloudflare API token set
```
or
```
Running: npx @opennextjs/cloudflare deploy ...
```

**Failure (fix these):**
- "Invalid API token" - double-check the token was copied completely
- "Insufficient permissions" - make sure the token has `Workers > Edit` permission
- "Secret not found" - verify the secret name is exactly `CF_API_TOKEN`

## Secret Name Must Match Exactly

The workflow file references the secret as `${{ secrets.CF_API_TOKEN }}`. Make sure:

- ✅ Name is `CF_API_TOKEN` (with underscore, not hyphen)
- ✅ Case-sensitive: `CF_API_TOKEN`, not `cf_api_token` or `Cf_Api_Token`
- ✅ No leading/trailing spaces

## Multiple People Can Access

Once added to the repository:
- All collaborators with access can see the secret (masked)
- The workflow will work for anyone with repo push access
- You can add/remove secrets anytime from the same Settings page

## Need Help With Other Secrets?

The same process applies to the other secrets:

| Secret Name | Value Source |
|-------------|--------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXTAUTH_URL` | `https://ai.mubx-dev` (your domain) |
| `NEXTAUTH_SECRET` | Random 32+ character hex string |

Use the exact names above when adding them to GitHub Settings → Secrets.

## After All 4 Secrets Are Added

Your workflow is ready! The next time you:
- Push to `main` or `master` branch, OR
- Click "Run workflow" in the Actions tab

The build will:
1. ✅ Run on Ubuntu Linux (fixes the Windows timeout issue)
2. ✅ Install dependencies
3. ✅ Build Next.js + OpenNext config
4. ✅ Deploy to Cloudflare Workers
5. ✅ Make your site at `ai.mubx.dev` up-to-date

## Troubleshooting

| If you see... | Do this... |
|----------------|------------|
| "Secret masked" in logs | Normal - secrets are always masked for security |
| Workflow doesn't run | Make sure you're on `main` or `master` branch, or click "Run workflow" manually |
| Build hangs > 30 min | First build can be slow; check if `next build` is stuck |
| Deployment error | Check Cloudflare dashboard for any API errors |

---

**Ready to add the token?** Go to your repo → Settings → Secrets and variables → Actions → New repository secret, name it `CF_API_TOKEN`, and paste your Cloudflare token value.

Would you like me to guide you through adding the other secrets (DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET) as well, or do you want to add the CF_API_TOKEN first?</think>
<tool_call>
<function=question>
<parameter=questions>
[{"question": "Ready to add the CF_API_TOKEN to GitHub now? I'll guide you through the exact steps.", "header": "Add CF_API_TOKEN to GitHub Now", "options": [{"label": "Yes, guide me through adding CF_API_TOKEN to GitHub right now", "description": "Step-by-step: go to repo Settings → Secrets → add CF_API_TOKEN"}, {"label": "I'll add it later after I create the token", "description": "I need to create the Cloudflare token first"}, {"label": "Show me the exact repo path again", "description": "Confirm the exact menu clicks to add the secret"}], "multiple": false}]