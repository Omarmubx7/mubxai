# Creating Cloudflare API Token for mubxai Deployment

## Prerequisites
- You must be logged into Cloudflare at https://dash.cloudflare.com
- You need appropriate account permissions (typically Owner or Admin)

## Step 1: Navigate to API Tokens
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. You'll see existing tokens (if any) and a blue "Create token" button

## Step 2: Start Creating Token
1. Click **"Create token"**
2. Select **"Start from scratch"** (blank template - most flexible)
3. Enter a **Name**: `mubxai-github-actions` (or similar descriptive name)
4. Click **Next** (bottom button)

## Step 3: Configure Permissions (CRITICAL STEP)
This is where many people go wrong. You must select exactly these permissions:

### Account Permissions section:
1. Find the **"Account"** section in the permissions tree
2. Click the dropdown next to "Account"
3. Select **`Workers`** from the list
4. Next to "Workers", select **`Edit`** from the permission dropdown

**The tree should now show:**
- Account → Workers → Edit

### Optional: Add AI permissions (if using Groq)
If you plan to use the Groq AI feature:
- Find the **"AI"** section
- Select `View` permission (optional, for AI feature access)

### Step 4: Create and Copy
1. Review your selections - they should look like:
   - Account: Workers (Edit)
   - (Optional) AI: View
2. Click the **blue "Create token"** button at the bottom
3. **Immediately copy the token value** - you won't see it again!
4. It will look something like: `a1b2c3d4.5e6f7g8h.90ijklmnopqrstuv`

## Step 5: Add to GitHub Repository

### Method A: GitHub Web Interface (recommended)
1. Go to your GitHub repository
2. Click **Settings** (top right gear icon)
3. Left sidebar: **Secrets and variables** → **Actions**
4. Click **New repository secret** (blue button)
5. **Name field:** `CF_API_TOKEN`
6. **Value field:** [paste the token you just copied]
7. Click **Add secret**
8. You should see it listed under "Repository secrets"

### Method B: GitHub CLI (if installed)
```bash
# From your project directory
gh secret set CF_API_TOKEN <<< "a1b2c3d4.5e6f7g8h.90ijklmnopqrstuv"
```

## Step 6: Verify It Works

1. Go to the **Actions** tab in your GitHub repository
2. You should see "Deploy to Cloudflare" workflow
3. Click the workflow name
4. Click **Run workflow** (button on right side)
5. Watch the live logs
6. **Success indicator:** You should see "Cloudflare API token set" in the output
7. **Failure indicator:** "Insufficient permissions" or "Invalid API token"

## Permissions Explained

| Permission Selected | What It Enables |
|---------------------|-----------------|
| `Workers > Edit` | Can create, update, and delete Workers. **Required for deployment.** |
| `Workers > View` | Can only read Worker info (not enough - will fail) |
| `Account > Workers > Edit` | Same as above - full Worker control |

## Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| "Invalid API token" error | - Double-check you copied the entire token<br>- Make sure there are no extra spaces<br>- Verify you're logged into the correct Cloudflare account |
| "Insufficient permissions" error | - Go back to Cloudflare and ensure you selected `Workers > Edit`<br>- Not `View`, not `Account` - specifically `Workers > Edit` |
| "Rate limited" message | - Wait 1-2 minutes and try again<br>- Cloudflare has API rate limits |
| Token doesn't work in GitHub Actions | - Make sure you added the secret to the **correct** repository<br>- Check the secret name is exactly `CF_API_TOKEN` (case-sensitive) |
| Workflow fails at deployment step | - Verify the token has proper scope<br>- Ensure your Neon DATABASE_URL is active and valid |

## Token Security Best Practices

1. **Keep it secret** - treat like a password, don't share publicly
2. **Rotate regularly** - every 3-6 months
3. **Use separate tokens** for different projects
4. **Add notes** in GitHub to remind team members what the token is for
5. **Revoke and recreate** if you think it may have been exposed

## What Happens After You Add the Token

Once `CF_API_TOKEN` is set in GitHub Secrets:

1. The workflow will authenticate with Cloudflare on every run
2. `npm run build:cf` will build your Next.js app + OpenNext config
3. `@opennextjs/cloudflare deploy` will publish to your Workers site
4. Your site at `ai.mubx.dev` will get the latest version
5. On subsequent pushes, it automatically redeploys

## Quick Checklist

- [ ] Created token at Cloudflare dashboard
- [ ] Selected `Workers > Edit` permission
- [ ] Copied the token value
- [ ] Added to GitHub as `CF_API_TOKEN` secret
- [ ] Other secrets added: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- [ ] Tested workflow by running it manually
- [ ] First successful build/deployment

After completing these steps, your mubxai project will build and deploy to Cloudflare Workers automatically on every push to main/master!

## Need Help With Specific Part?

- **Creating the token**: I just guided you through steps 1-4
- **Adding to GitHub**: Check the `CONFIGURE_SECRETS.md` file I created
- **Other secrets**: `DATABASE_URL` from Neon, `NEXTAUTH_URL` and `NEXTAUTH_SECRET` are straightforward
- **Workflow running**: Check the Actions tab logs for any errors

Would you like me to walk you through any of these steps in more detail, or do you have the token ready to add to GitHub?</think>
<tool_call>
<function=question>
<parameter=questions>
[{"question": "Do you want me to walk you through adding the CF_API_TOKEN to GitHub right now, or do you have the token and just need to know where to paste it?", "header": "Add Token to GitHub", "options": [{"label": "Walk me through adding it to GitHub", "description": "Step-by-step: go to repo Settings → Secrets → add CF_API_TOKEN"}, {"label": "I'll add it myself", "description": "I know where to add it, just tell me the secret name"}, {"label": "First add other secrets", "description": "Help me add DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET first"}], "multiple": false}]