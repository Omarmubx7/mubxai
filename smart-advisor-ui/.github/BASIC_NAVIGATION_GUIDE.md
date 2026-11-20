# Basic GitHub Navigation - Step by Step

If you're having trouble finding things in GitHub, follow these exact clicks:

## To Open the `.github` Folder

1. Go to your repository page on GitHub
2. Click on the name of your repository (to make sure you're on the right page)
3. Look at the top file listing - you'll see all the files like `README.md`, `package.json`, etc.
4. To open the `.github` folder:
   - Find the file named `.github` (it will start with a dot)
   - Click on it once
5. You should now see the contents of the `.github` folder
6. Click on the **workflows** folder (should be one of the file/folder names)

## To Check if `cloudflare.yml` Exists

1. After opening the `workflows` folder (from step 6 above)
2. Look at the list of files
3. Find `cloudflare.yml` - it might have a `Y` icon or document icon
4. If you see it, great! If not, the file may not have been committed yet

## To Get to Settings → Actions → General

1. At the top of the repository page, click the **gear icon** ⚙️ (or "Settings")
2. In the left sidebar, you'll see a list of options
3. Click on ** "Actions"** (it might be under "Security" or directly visible)
4. Then click on ** "General"** (may be the first item, or you may need to scroll to find it)

## To Find "Workflow Permissions"

1. After clicking "General" in step 3 above
2. Look at the main page area (not the left sidebar)
3. You should see a section titled **"Workflow permissions"** or similar
4. You'll see options - typically radio buttons:
   - [ ] Read only
   - [✓] Read and write  ← Click/Select this one
   - [ ] Read and admin
5. Click the **"Read and write"** option
6. Scroll down to the bottom of the page
7. Click the **blue "Save" button**

## To Check Secrets

1. In the left sidebar of the main Settings page (still), click ** "Secrets and variables"** 
2. Or sometimes just **"Secrets"** 
3. Then click the ** Actions** tab (at the top of the page, may be tabbed)
4. You should see a list of secrets
5. Look for **CF_API_TOKEN** in that list

## To Check Default Branch

1. In the left sidebar of the main Settings page, click ** "Repository"** 
2. Then click ** "Default branch"** (may be in the "Repository settings" section)
3. It should show `main` or `master`
4. If it's something else, you can change it by clicking the branch name and selecting `main` or `master`

---

**Right now, do this:**

1. Open your repo on GitHub
2. Click `.github` → look for `cloudflare.yml`
3. Go to Settings → Actions → General → find "Workflow permissions" → select "Read and write" → Save
4. Go to Settings → Secrets and variables → Actions → look for CF_API_TOKEN
5. Go to Settings → Repository → Default branch → verify it's main or master

**Tell me the result of each step using this format:**

```
Check 1: [result] - [description]
Check 2: [result] - [description]
Check 3: [result] - [description]
Check 4: [result] - [description]
```

**I'll then tell you what to do next based on your results!**