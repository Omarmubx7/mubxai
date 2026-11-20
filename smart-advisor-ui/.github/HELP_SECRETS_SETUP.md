# Help: Setting up GitHub Secrets for Cloudflare Deployment

## Quick Reference

You need to add 4 secrets to your GitHub repository. Here's how:

### 1. CF_API_TOKEN (Most Important)

**What it does:** Authenticates the workflow to deploy to Cloudflare Workers.

**How to create:**
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create token"**
3. Name it something like "GitHub Actions mubxai Deploy"
4. Under **Resource Permissions**:
   - **Account**: Select `Workers`
   - **Permission**: Select `Edit`
5. Click **"Create token"**
6. **Copy the token** - you'll only see it once!

**Add to GitHub:**
- Repository → Settings → Secrets and variables → Actions → New repository secret
- Name: `CF_API_TOKEN`
- Value: [paste the token you copied]

### 2. DATABASE_URL

**What it does:** Connects Prisma to your production Neon PostgreSQL database.

**How to get:**
1. Go to: https://console.neon.tech
2. Select your project
3. Click **Connect** → **Connection String**
4. Copy the full `postgresql://...` string
5. Make sure it includes `sslmode=require` or similar

**Add to GitHub:**
- Name: `DATABASE_URL`
- Value: [the full connection string]

### 3. NEXTAUTH_URL

**What it does:** Tells NextAuth.js your production domain for cookies and callbacks.

**Value:** `https://ai.mubx-dev` (or whatever your actual domain is)

**Add to GitHub:**
- Name: `NEXTAUTH_URL`
- Value: `https://ai.mubx-dev`

### 4. NEXTAUTH_SECRET

**What it does:** Signs NextAuth.js session cookies (required for production).

**How to generate:** Run this command in your terminal:
```
openssl rand -hex 32
```
**Example output:** `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2`

**Add to GitHub:**
- Name: `NEXTAUTH_SECRET`
- Value: [the generated string]

## Step-by-Step: Adding Secrets

### Using the GitHub Web Interface:

1. Go to your GitHub repository
2. Click **Settings** (gear icon at top right)
3. In left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret** (blue button)
5. Fill in:
   - **Name**: One of: `CF_API_TOKEN`, `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
   - **Secret**: The value for that secret
6. Click **Add secret**
7. Repeat for all 4 secrets

### Using GitHub CLI (if installed):

```bash
gh secret set CF_API_TOKEN <<< "your-token-here"
gh secret set DATABASE_URL <<< "postgresql://..."
gh secret set NEXTAUTH_URL <<< "https://ai.mubx-dev"
gh secret set NEXTAUTH_SECRET <<< "a1b2c3d4..."
```

## Verification

After adding secrets:

1. Go to the **Actions** tab in your repo
2. You should see "Deploy to Cloudflare" workflow
3. Click the workflow, then click **Run workflow** (right side)
4. Watch the logs - it should start building on Ubuntu
5. On success, you'll see a deployment URL in Cloudflare

## Troubleshooting Common Issues

| Problem | Solution |
|---------|----------|
| "Secret not found" error | Make sure secret names match exactly (case-sensitive) |
| Build fails on `next build` | Check if `NEXTAUTH_URL` matches your actual domain |
| Deployment fails | Verify `CF_API_TOKEN` has "Workers > Edit" permission |
| Timeout > 30 minutes | This is normal for first build; subsequent builds are faster |
| "Invalid connection string" | Ensure DATABASE_URL from Neon includes proper SSL settings |

## Need Help With Specific Secret?

- **CF_API_TOKEN**: Must have "Account > Workers > Edit" permission
- **DATABASE_URL**: Must be active Neon connection string
- **NEXTAUTH_URL**: Must match the domain you're deploying to
- **NEXTAUTH_SECRET**: Must be at least 32 characters (hex)

Would you like me to guide you through creating any of these specific secrets, or do you have the values ready to add?</think>
<tool_call>
<function=question>
<parameter=questions>
[{"question": "Do you have the Cloudflare API token ready, or do you need guidance on creating it?", "header": "CF_API_TOKEN Setup", "options": [{"label": "I have the token ready", "description": "I already created a Cloudflare API token and want to add it to GitHub"}, {"label": "Guide me to create it", "description": "Walk through creating a Cloudflare API token with Workers permissions"}, {"label": "I'll add secrets later", "description": "I'll handle the secrets setup on my own"}], "multiple": false}]