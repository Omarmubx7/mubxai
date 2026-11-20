# How to Configure GitHub Secrets for Cloudflare Deployment

## Step 1: Access Repository Secrets

1. Go to your GitHub repository
2. Click **Settings** (top right)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click the **Actions** tab → **New repository secret**

## Step 2: Add Required Secrets

### 1. `CF_API_TOKEN` (Cloudflare API Token)

- **Purpose**: Authenticates the workflow to deploy to Cloudflare Workers
- **How to create**:
  1. Go to https://dash.cloudflare.com/profile/api-tokens
  2. Click **Create token**
  3. Select **Start from scratch** or use a preset
  4. Under **Resource Permissions**, select:
     - **Account**: `Workers` → `Edit`
     - (Optional) **AI**: `View` if using Groq AI
  5. Click **Create token**
  6. Copy the token value
- **GitHub secret name**: `CF_API_TOKEN`
- **GitHub secret value**: Paste the token

### 2. `DATABASE_URL` (Neon PostgreSQL Connection)

- **Purpose**: Connection string for the production database used by Prisma
- **How to get**:
  1. Go to https://console.neon.tech
  2. Select your project
  3. Go to **Connect** → **Connection String**
  4. Copy the `postgresql://...` string
  5. **Important**: Make sure the connection string includes `sslmode=require` or similar TLS setting
- **GitHub secret name**: `DATABASE_URL`
- **GitHub secret value**: The full connection string

### 3. `NEXTAUTH_URL` (Your Production URL)

- **Purpose**: NextAuth.js configuration for session cookies and callbacks
- **Value**: `https://ai.mubx.dev` (or your actual deployed domain)
- **GitHub secret name**: `NEXTAUTH_URL`
- **GitHub secret value**: `https://ai.mubx.dev`

### 4. `NEXTAUTH_SECRET` (Random Session Secret)

- **Purpose**: Signs NextAuth.js session cookies (required for production)
- **How to generate**: Run in terminal: `openssl rand -hex 32`
- **GitHub secret name**: `NEXTAUTH_SECRET`
- **GitHub secret value**: The generated random string (32 hex characters)

## Step 3: Optional Secrets

Add these if your project uses them:

- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GROQ_API_TOKEN` - Groq API key for AI generation
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `SERPER_API_KEY` - Serper API key for search
- And other vars listed in `wrangler.toml`

## Step 4: Verify and Test

1. After adding all secrets, go to the **Actions** tab
2. You should see the "Deploy to Cloudflare" workflow
3. Click **Run workflow** → **Run workflow** to test manually
4. Check the logs for any errors
5. On success, the workflow will build and deploy to Cloudflare

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| `CF_API_TOKEN` not set | Add the secret as described above |
| `DATABASE_URL` invalid | Verify the Neon connection string is correct and active |
| Build times out (>30 min) | Check if `next build` is hanging; try reducing middleware or optimizing images |
| Deployment fails | Verify CF_API_TOKEN has "Workers > Edit" permission |
| Site shows errors after deploy | Check `NEXTAUTH_URL` matches your actual domain |

## Workflow Location
- `.github/workflows/cloudflare.yml`
- Triggered on: `push` to `main` or `master`, or manually via `workflow_dispatch`