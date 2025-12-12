# 🚀 IssueFlow Deployment Guide

This guide will help you deploy the IssueFlow Reporting System to production.

## 📦 Project Structure

```
issueflow-reporting-system/
├── backend/                 # Node.js/Express API
│   ├── render.yaml          # Render deployment config
│   └── ...
├── workplace-resolver-main/ # React/Vite Frontend
│   ├── render.yaml          # Render deployment config
│   └── ...
```

---

## 🌐 Option 1: Deploy to Render.com (Recommended)

Render offers a generous free tier and works perfectly with your setup.

### Prerequisites

1. ✅ GitHub repository with your code
2. ✅ [Render.com](https://render.com) account (free)
3. ✅ MongoDB Atlas cluster (you already have this!)
4. ✅ HuggingFace API key (you already have this!)

### Step 1: Prepare Your Repository

Make sure all your changes are committed and pushed:

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### Step 2: Deploy the Backend API

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:

   | Setting | Value |
   |---------|-------|
   | **Name** | `issueflow-api` |
   | **Root Directory** | `backend` |
   | **Environment** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Plan** | Free |

5. Add **Environment Variables** (click "Advanced" → "Add Environment Variable"):

   | Key | Value |
   |-----|-------|
   | `PORT` | `10000` |
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | `mongodb+srv://...` (your MongoDB Atlas connection string) |
   | `JWT_SECRET` | (generate a random secure string) |
   | `CORS_ORIGIN` | `https://issueflow-frontend.onrender.com` |
   | `HUGGINGFACE_API_KEY` | `hf_...` (your HuggingFace key) |
   | `HF_EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` |
   | `HF_CLASSIFICATION_MODEL` | `facebook/bart-large-mnli` |
   | `HF_TEXT_GENERATION_MODEL` | `mistralai/Mistral-7B-Instruct-v0.2` |

6. Click **"Create Web Service"**

7. Wait for deployment (takes 2-5 minutes)

8. Note your API URL: `https://issueflow-api.onrender.com`

### Step 3: Deploy the Frontend

1. Click **"New +"** → **"Static Site"**
2. Connect the same GitHub repository
3. Configure the service:

   | Setting | Value |
   |---------|-------|
   | **Name** | `issueflow-frontend` |
   | **Root Directory** | `workplace-resolver-main` |
   | **Build Command** | `npm install && npm run build` |
   | **Publish Directory** | `dist` |

4. Add **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://issueflow-api.onrender.com/api` |

5. Add **Rewrite Rule** (under Redirects/Rewrites):
   - Source: `/*`
   - Destination: `/index.html`
   - Action: Rewrite

6. Click **"Create Static Site"**

7. Your frontend will be live at: `https://issueflow-frontend.onrender.com`

### Step 4: Update CORS (if needed)

If your frontend URL differs from `issueflow-frontend.onrender.com`, update the `CORS_ORIGIN` environment variable in your backend service.

---

## ☁️ Option 2: Deploy to Vercel + Railway

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set root directory to `workplace-resolver-main`
4. Add environment variable: `VITE_API_URL`
5. Deploy!

### Backend → Railway

1. Go to [railway.app](https://railway.app)
2. Create new project from GitHub
3. Set root directory to `backend`
4. Add all environment variables
5. Deploy!

---

## 🐳 Option 3: Docker Deployment

### Create Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

### Create Frontend Dockerfile

```dockerfile
# workplace-resolver-main/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - MONGO_URI=${MONGO_URI}
      - JWT_SECRET=${JWT_SECRET}
      - HUGGINGFACE_API_KEY=${HUGGINGFACE_API_KEY}
    restart: unless-stopped

  frontend:
    build: ./workplace-resolver-main
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

Run with: `docker-compose up -d`

---

## ⚠️ Important Security Notes

### Before Deploying

1. **Never commit `.env` files** with real credentials
2. **Rotate your API keys** if they were ever exposed in Git history
3. **Use strong JWT secrets** - generate with: `openssl rand -hex 32`

### MongoDB Atlas Security

1. Go to MongoDB Atlas → Network Access
2. Add your Render IP addresses (or allow `0.0.0.0/0` for development)
3. Use a dedicated database user with minimal permissions

### HuggingFace API Key

Your current key appears to be exposed in `.env`. Consider:
1. Revoking the current key at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Creating a new key
3. Only storing it in Render's environment variables (not in code)

---

## 🔍 Troubleshooting

### Backend Won't Start

```bash
# Check logs in Render dashboard
# Common issues:
# - Missing environment variables
# - MongoDB connection string incorrect
# - Port mismatch
```

### Frontend Shows Blank Page

```bash
# Check browser console for errors
# Verify VITE_API_URL is correct
# Make sure routes rewrite is configured
```

### CORS Errors

```bash
# Ensure CORS_ORIGIN in backend matches your frontend URL exactly
# Include https:// but NO trailing slash
```

### AI Features Not Working

```bash
# Verify HUGGINGFACE_API_KEY is set correctly
# Check HuggingFace model names are valid
# Free tier has rate limits - wait and retry
```

---

## 📊 Post-Deployment Checklist

- [ ] Backend API responds at `/`
- [ ] Frontend loads correctly
- [ ] User registration/login works
- [ ] Creating incidents works
- [ ] AI triage suggestions appear
- [ ] Real-time updates via Socket.IO work

---

## 🔄 Updating After Deployment

Simply push to your main branch:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Render will automatically redeploy both services!

---

## 📞 Need Help?

- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Docs](https://www.mongodb.com/docs/atlas/)
- [HuggingFace Docs](https://huggingface.co/docs)
