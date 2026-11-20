# How to Create a Cloudflare API Token (CF_API_TOKEN)

Follow these steps to create the token you'll add to GitHub:

## Step 1: Go to Cloudflare Dashboard
1. Open: https://dash.cloudflare.com/profile/api-tokens
2. You should see any existing tokens and a "Create token" button

## Step 2: Create a New Token
1. Click the **blue "Create token"** button
2. Select **"Start from scratch"** (blank template)
3. Enter a **Name**: `mubxai-github-actions` (or similar)
4. Click **Next** (bottom button)

## Step 3: Configure Permissions (CRITICAL)
This is the most important step. You must select exactly these permissions:

**Under "Resource Permissions":**

1. Find the **"Account"** section in the permission tree
2. Click the dropdown next to "Account"
3. Select **`Workers`** from the list
4. Next to "Workers", select **`Edit`** from the permission dropdown

**The tree should now show:**
- Account → Workers → Edit

**Optional (if using Groq AI feature):**
- Find the **"AI"** section
- Select `View` permission (optional, for AI feature access)

## Step 4: Create the Token
1. Review your selections
2. Click the **blue "Create token"** button at the bottom
3. **IMMEDIATELY copy the token value** - you will only see it once!
4. It will look something like: `a1b2c3d4.5e6f7g8h.90ijklmnopqrstuv`

## Step 5: Add to GitHub
1. Go to your GitHub repository
2. Click **Settings** (top right gear icon)
3. Left sidebar: **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. **Name:** `CF_API_TOKEN` (exact case)
6. **Value:** [paste the token you just copied]
7. Click **Add secret**

## Step 6: Verify It Works
1. Go to the **Actions** tab in your GitHub repo
2. Click "Deploy to Cloudflare" workflow
3. Click **Run workflow**
4. Look for "Cloudflare API token set" in the logs

## Permissions Explained
- `Workers > Edit` = Can create/update/delete Workers (REQUIRED)
- `Workers > View` = Can only read info (NOT enough)
- You must select `Workers > Edit` for deployment to work

## Token Security
- Keep it secret - treat like a password
- Rotate every 3-6 months
- Use separate tokens for different projects
- Never share publicly

## Troubleshooting
| Error | Solution |
|-------|----------|
| "Invalid API token" | Re-check the entire token was copied |
| "Insufficient permissions" | Make sure you selected `Workers > Edit`, not `View` |
| "Rate limited" | Wait 1-2 minutes, then try again |

---

**Ready to create the token? Go to https://dash.cloudflare.com/profile/api-tokens and follow steps 1-4, then come back and I'll help you add it to GitHub.**