# Production deployment (Vercel + Render)

This app has two deployable parts:

| Part | Host | Role |
|------|------|------|
| **Frontend** | Vercel | React/Vite SPA, Firebase auth, WebRTC in the browser |
| **Signaling** | Render | Node.js + Socket.IO (rooms, chat sync, WebRTC signaling) |

WebRTC media runs **peer-to-peer** in the browser. The signaling server only exchanges SDP/ICE. Use **HTTPS** on the frontend (Vercel default) so `getUserMedia` and secure contexts work.

---

## 1. Deploy the signaling server (Render)

### 1.1 Create the service

1. Push this repo to GitHub (or GitLab / Bitbucket Render supports).
2. In [Render Dashboard](https://dashboard.render.com) → **New +** → **Web Service**.
3. Connect the repository.
4. Configure:
   - **Root Directory**: `VisionBridge`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance type**: Free (or paid for always-on).

Render sets **`PORT`** automatically. The server reads `process.env.PORT` (see `server.js`).

### 1.2 Environment variables on Render

Add in the service **Environment** tab:

| Key | Value |
|-----|--------|
| `CORS_ORIGIN` | Your Vercel URL(s), comma-separated, **no trailing slash**. Example: `https://my-app.vercel.app` |
| `NODE_VERSION` | `20` (optional but recommended) |

After the first deploy, copy the service URL, e.g. `https://video-chat-signaling.onrender.com`. You will use it as **`VITE_BACKEND_URL`**.

### 1.3 Health check (optional)

- **Health check path**: `/health`  
  Render can use this; the server returns `{ "ok": true }`.

### 1.4 Blueprint (optional)

From the repo root, `VisionBridge/render.yaml` can be used as a Render Blueprint. Set **`CORS_ORIGIN`** in the dashboard after creation.

### Render CLI (optional)

```bash
# Install: https://render.com/docs/cli
render login
# Create/link service via dashboard is usually simpler for first deploy.
```

---

## 2. Deploy the frontend (Vercel)

### 2.1 Install Vercel CLI (optional)

```bash
npm i -g vercel
```

### 2.2 First deploy from `NavPanel`

```bash
cd NavPanel
vercel
```

Follow prompts (link project, confirm scope). For production:

```bash
vercel --prod
```

### 2.3 Project settings in Vercel dashboard

- **Root Directory**: `NavPanel` (if the Git repo contains the monorepo root).
- **Framework Preset**: Vite (auto-detected).
- **Build Command**: `npm run build` (default).
- **Output Directory**: `dist` (Vite default).

`vercel.json` in `NavPanel` adds SPA rewrites so React Router paths resolve to `index.html`.

### 2.4 Environment variables on Vercel

In **Project → Settings → Environment Variables**, add (Production + Preview as needed):

| Name | Description |
|------|-------------|
| `VITE_BACKEND_URL` | Full URL of the Render signaling service, e.g. `https://xxx.onrender.com` (no trailing slash). **Required for production.** |
| `VITE_FIREBASE_API_KEY` | From Firebase console |
| `VITE_FIREBASE_AUTH_DOMAIN` | |
| `VITE_FIREBASE_PROJECT_ID` | |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |
| `VITE_FIREBASE_APP_ID` | |
| `VITE_WEBRTC_ICE_SERVERS` | Optional JSON array of ICE servers (see `src/config/rtcConfig.js`) |

Redeploy after changing env vars:

```bash
cd NavPanel
vercel --prod
```

Or trigger a redeploy from the Vercel dashboard.

---

## 3. Firebase (Google sign-in)

1. [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → enable **Google**.
2. **Project settings** → your web app → copy config into Vercel env vars (`VITE_FIREBASE_*`).
3. **Authentication → Settings → Authorized domains**: add  
   - `your-project.vercel.app`  
   - Your custom domain if you use one.
4. **Backend Admin SDK (required):** Firebase Console → Project settings → Service accounts → Generate new private key.  
   On Render (VisionBridge), set one of:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = full JSON of the service account (recommended), or
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (use `\n` for newlines in the private key).  
   Confirm `GET /health` returns `"authConfigured": true`.

---

## 4. HTTPS and WebRTC

- Vercel serves the app over **HTTPS**, which satisfies browser requirements for camera/mic and modern WebRTC usage.
- Default **STUN** servers are configured in `src/config/rtcConfig.js` (Google public STUN). For difficult NATs, set **`VITE_WEBRTC_ICE_SERVERS`** with a **TURN** provider (JSON array).

---

## 5. Local `.env` (do not commit secrets)

- Copy `NavPanel/.env.example` → `NavPanel/.env`.
- Copy `VisionBridge/.env.example` → `VisionBridge/.env` for local overrides.

---

## 6. Verification checklist

- [ ] `GET https://<render-service>/health` returns JSON `{ "ok": true }`.
- [ ] Browser console on Vercel site shows `[socket] Backend URL: https://...` (your Render URL).
- [ ] Socket connects (no CORS errors). If CORS fails, fix **`CORS_ORIGIN`** on Render to exactly match the Vercel origin (scheme + host, no path).
- [ ] Firebase sign-in works after authorized domains are updated.
- [ ] Two browsers can join a room and see/hear each other (STUN sufficient on many networks).

---

## 7. Command cheat sheet

```bash
# Frontend — local production build test
cd NavPanel
cp .env.example .env   # then edit
npm run build
npm run preview

# Signaling — local
cd VisionBridge
cp .env.example .env   # optional
npm install
npm start

# Vercel production deploy (from NavPanel)
vercel --prod
```

Render does not require a local CLI for a normal Git-connected web service; use the dashboard **Manual Deploy** after pushing to `main`.
