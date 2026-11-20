# How to Create a Cloudflare API Token for mubxai Deployment

## Step-by-Step Guide

You need a Cloudflare API token with specific permissions to deploy to Workers. Follow these steps:

### Step 1: Go to Cloudflare API Tokens Page
1. Open: https://dash.cloudflare.com/profile/api-tokens
2. You should see any existing tokens and a "Create token" button

### Step 2: Create a New Token
1. Click **"Create token"** (blue button)
2. Select **"Start from scratch"** (blank template)
3. Give it a name like: `mubxai-github-actions` or `GitHub Deploy`

### Step 3: Configure Resource Permissions
This is the most important step - you must select the right permissions:

**Under "Resource Permissions":**

#### Account-level permissions:
- **Find "Account" section** and expand it
- Select **`Workers`** from the dropdown
- Select **`Edit`** from the permission dropdown

**Optional (if using AI features):**
- Under "AI", you may want to add `View` permission if using Groq AI
- Not required for basic deployment

### Step 4: Create the Token
1. Review your selections
2. Click **"Create token"** at the bottom
3. **You will see the token value once** - copy it immediately!
4. It will look something like: `abcd1234.ef5678.90ijklmnopqrstuv`

### Step 5: Add to GitHub

**Using Git Web Interface:**
1. Go to your GitHub repository
2. Click **Settings** (top right, gear icon)
3. Left sidebar: **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. **Name:** `CF_API_TOKEN`
6. **Value:** [paste the token you just copied]
7. Click **Add secret**

**Using GitHub CLI (if you have it installed):**
```bash
gh secret set CF_API_TOKEN <<< "abcd1234.ef5678.90ijklmnopqrstuv"
```

### Permissions Explained

| Permission | What it allows |
|------------|----------------|
| `Workers > Edit` | Can create, update, and delete Cloudflare Workers. This is required for deployment. |
| `Workers > View` | Can only read Worker information (not enough for deployment) |
| `Account > Workers > Edit` | Full control over Workers in the account |

### Verifying Your Token Works

After adding to GitHub, you can test:

1. Go to **Actions** tab in your repo
2. Click the "Deploy to Cloudflare" workflow
3. Click **Run workflow**
4. If you see "Cloudflare API token set" in the logs, it's working
5. If you see an error about permissions, you may need to adjust the token scopes

### Troubleshooting

| Error Message | Solution |
|---------------|----------|
| "Invalid API token" | Double-check you copied the entire token correctly |
| "Insufficient permissions" | Make sure you selected `Workers > Edit` (not just `View`) |
| "Rate limited" | Wait a minute and try again; Cloudflare has API rate limits |
| "Token expired" | Create a new token and update the GitHub secret |

### Best Practices

1. **Keep the token secure** - treat it like a password
2. **Rotate periodically** - every 3-6 months is good practice
3. **Use different tokens** for different projects (don't reuse the same one)
4. **Add a description** to the GitHub secret so team members know what it's for

## Quick Checklist Before Deploying

- [ ] CF_API_TOKEN created with `Workers > Edit` permission
- [ ] Token added to GitHub as `CF_API_TOKEN` secret
- [ ] DATABASE_URL set (Neon connection string)
- [ ] NEXTAUTH_URL set (https://ai.mubx-dev)
- [ ] NEXTAUTH_SECRET set (32+ hex characters)
- [ ] Run workflow and watch first build succeed!

Once you've completed these steps, the GitHub Actions workflow will automatically build and deploy your mubxai project to Cloudflare Workers on every push to main/master.