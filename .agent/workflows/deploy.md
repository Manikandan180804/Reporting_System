---
description: Deploy IssueFlow to Render.com
---

# 🚀 Deploy IssueFlow to Render.com

## Prerequisites
- GitHub repository connected
- Render.com account (free)
- MongoDB Atlas connection string
- HuggingFace API key

## Step 1: Verify Git Status
// turbo
```bash
git status
```

## Step 2: Commit Any Pending Changes (if needed)
```bash
git add .
git commit -m "Prepare for deployment"
```

## Step 3: Push to GitHub
```bash
git push origin main
```

## Step 4: Deploy Backend on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `Manikandan180804/Reporting_System`
4. Configure:
   - **Name**: `issueflow-api`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | `PORT` | `10000` |
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | Your MongoDB Atlas connection string |
   | `JWT_SECRET` | Generate a secure random string |
   | `CORS_ORIGIN` | `https://issueflow-frontend.onrender.com` |
   | `HUGGINGFACE_API_KEY` | Your HuggingFace key |
   | `HF_EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` |
   | `HF_CLASSIFICATION_MODEL` | `facebook/bart-large-mnli` |
   | `HF_TEXT_GENERATION_MODEL` | `mistralai/Mistral-7B-Instruct-v0.2` |

6. Click **"Create Web Service"**
7. Note your backend URL: `https://issueflow-api.onrender.com`

## Step 5: Deploy Frontend on Render

1. Click **"New +"** → **"Static Site"**
2. Connect the same GitHub repository
3. Configure:
   - **Name**: `issueflow-frontend`
   - **Root Directory**: `workplace-resolver-main`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. Add Environment Variable:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://issueflow-api.onrender.com/api` |

5. Add Rewrite Rule (under Redirects/Rewrites):
   - Source: `/*`
   - Destination: `/index.html`
   - Action: Rewrite

6. Click **"Create Static Site"**

## Step 6: Verify Deployment

- Frontend URL: `https://issueflow-frontend.onrender.com`
- Backend API: `https://issueflow-api.onrender.com`

## Post-Deployment Checklist
- [ ] Backend API responds
- [ ] Frontend loads correctly
- [ ] Login/registration works
- [ ] Incidents can be created
- [ ] AI features work

## Updating After Deployment
// turbo
```bash
git add .
git commit -m "Update deployment"
git push origin main
```
Render will automatically redeploy both services!
