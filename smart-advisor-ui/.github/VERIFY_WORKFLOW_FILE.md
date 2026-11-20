# Verify the Workflow File Exists and Is Proper

Let's verify that your workflow file is properly set up in the repository.

## Step 1: Check if the File Exists

1. Go to your GitHub repository
2. Click on the **.github** folder
3. Click on the **workflows** folder
4. You should see **cloudflare.yml** listed

**If you don't see it:**
- The file may not have been committed
- It may be in a different location
- It may have a different name

## Step 2: Verify the File Content

The workflow file `.github/workflows/cloudflare.yml` should contain this exact content (or very similar):

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Cancel in-progress runs
        uses: sty cancel-in-progress@v2
        if: github.event_name == 'push'

      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Set up Wrangler credentials
        env:
          CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
        run: |
          if [ -z "$CF_API_TOKEN" ]; then
            echo "::error ::CF_API_TOKEN secret is not set"
            exit 1
          fi
          echo "Cloudflare API token set"

      - name: Build for Cloudflare
        # This builds the Next.js app and generates the Cloudflare Workers bundle
        run: npm run build:cf
        env:
          # These may be needed for the build
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXTAUTH_URL: ${{ secrets.NEXTAUTH_URL }}
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}

      - name: Deploy to Cloudflare
        # Deploy using Wrangler or OpenNext
        env:
          CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
        run: |
          npx @opennextjs/cloudflare deploy \
            --project-name mubxai \
            --working-directory . \
            --token $CF_API_TOKEN

      - name: Verify deployment
        run: |
          echo "Deployment complete!"
          # Add any verification steps here
```

**Verify your file matches or is very similar to this.**

## Step 3: Check if GitHub Actions Are Enabled for This Repo

1. Go to **Settings** → **Actions** → **General**
2. Look for the title: "Workflow permissions"
3. You should see radio buttons or a dropdown:
   - "Read only"
   - "Read and write" ← Select this one
   - "Read and admin"
4. **Make sure "Read and write" is selected**
5. Click the **Save** button at the bottom

## Step 4: Verify the CF_API_TOKEN Secret

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see a list of secrets
3. You should see **CF_API_TOKEN** in the list (you added it earlier)
4. The value will be masked (dots), but the name should be visible

## Step 5: Check the Default Branch

1. Go to **Settings** → **Repository** → **Default branch**
2. Should be `main` or `master`
3. The workflow triggers on pushes to these branches

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "Workflow file not found" | Ensure `.github/workflows/cloudflare.yml` exists in the repo |
| "Actions disabled" | Enable in Settings → Actions → General → Save |
| "Default branch not main/master" | Change default branch to main or master |
| "Secret CF_API_TOKEN not found" | Add the secret in Settings → Secrets → Actions |
| Workflow doesn't run | Ensure you push to main/master, or manually run it |

## Right Now: Do These Checks

**Please do this sequence and tell me the results:**

1. **Go to** `.github` folder in your repo → check if `cloudflare.yml` exists
2. **Go to** Settings → Actions → General → check "Workflow permissions" → select "Read and write" → Save
3. **Go to** Settings → Secrets and variables → Actions → verify CF_API_TOKEN is listed
4. **Go to** Settings → Repository → Default branch → verify it's `main` or `master`

**Tell me what you find at each step, and I'll help you fix any issues!**