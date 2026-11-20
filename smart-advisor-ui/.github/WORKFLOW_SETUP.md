# GitHub Actions Cloudflare Deployment Setup

## Workflow File
Created: `.github/workflows/cloudflare.yml`

This workflow builds and deploys the mubxai project to Cloudflare Workers using OpenNext.

## Required Secrets
Add these secrets to your GitHub Repository Settings → Secrets and variables → Actions:

### Required Secrets:
- **`CF_API_TOKEN`** - Cloudflare API token with Workers permission
  - Generate at: https://dash.cloudflare.com/profile/api-tokens
  - Select "Edit workers permissions" or create token with "Account > Workers > Edit" scope
  
- **`DATABASE_URL`** - Production Neon PostgreSQL connection string
  - Format: `postgresql://user:password@your-db-url.tech:5432/database?sslmode=require`
  - Get from Neon Console → Connect → Connection String

- **`NEXTAUTH_URL`** - Your production URL (e.g., `https://ai.mubx.dev`)
  - Used for NextAuth.js configuration

- **`NEXTAUTH_SECRET`** - Random string for NextAuth.js sessions
  - Generate: `openssl rand -hex 32`

### Optional Secrets:
- `GOOGLE_CLIENT_ID` - For Google OAuth
- `GOOGLE_CLIENT_SECRET` - For Google OAuth
- `GROQ_API_TOKEN` - For AI generation
- And other vars from `wrangler.toml`

## Workflow Behavior

### On Push to main/master:
1. Checks out the repository
2. Sets up Node.js 20 with npm cache
3. Installs dependencies (`npm ci`)
4. Builds for Cloudflare (`npm run build:cf`)
5. Deploys to Cloudflare Workers
6. Verifies deployment

### Build Command
The workflow runs: `npm run build:cf`
Which executes: `prisma generate && next build && npx @opennextjs/cloudflare build`

### Notes
- This workflow uses **Ubuntu Linux**, which resolves the Windows compatibility issue
- The `npm ci` ensures a clean, deterministic install
- All sensitive config comes from GitHub Secrets, not local .env files
- If `build:cf` times out, check the Cloudflare API token permissions

## Troubleshooting

### If build still fails:
1. **Verify CF_API_TOKEN** has "Account > Workers > Edit" scope
2. **Check DATABASE_URL** is valid and points to an active Neon project
3. **Review workflow logs** for specific error messages
4. **Ensure next build completes** - the workflow has a 30-minute timeout

### Common Issues:
- ❌ Missing CF_API_TOKEN or insufficient permissions
- ❌ Invalid DATABASE_URL (Neon connection string expired or incorrect)
- ❌ NEXTAUTH_URL mismatch with deployed domain
- ✅ Windows local dev: Use WSL if you need to build locally