# Masar OS — مَسَار OS

A mobile-first personal operating system for learning, discipline, health, knowledge, and progress.

## 1. Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

- In full-stack mode (`npm run dev`), Express serves `/api/ai/*` endpoints backed by `@google/genai` alongside the Vite dev server.
- To skip first-launch onboarding during testing, append `?autostart=1`.

## 2. Build for Production

```bash
npm run build
```

For GitHub Pages hosted under a repository subpath (e.g., `https://<user>.github.io/<repo>/`):

```bash
VITE_BASE_PATH=/<repo>/ npm run build
```

## 3. Publish to GitHub

```bash
git init
git add .
git commit -m "Initial Masar OS release"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## 4. Deploy

### Option A: GitHub Pages (Static PWA)
1. Push to `main`.
2. In GitHub repo **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The included `.github/workflows/deploy.yml` builds `dist/` with the correct `VITE_BASE_PATH` and deploys automatically.

### Option B: Node Full-Stack Hosting (Cloud Run / Render / Railway)
1. Set `GEMINI_API_KEY` in environment secrets.
2. Run `npm run build` then `npm start` (`NODE_ENV=production tsx server.ts`).

## 5. Install on Android (Chrome / Edge)
1. Open the deployed HTTPS URL in Chrome on Android.
2. Tap the **Install App** button in Masar OS (Settings or Header), or open the browser menu (`⋮`) → **Add to Home screen** / **Install app**.

## 6. Install on iPhone (Safari)
1. Open the deployed HTTPS URL in Safari on iOS.
2. Tap **Share** (`□↑`) in the Safari toolbar.
3. Scroll down and tap **Add to Home Screen** → **Add**.

## 7. Configure Gemini API
1. Copy `.env.example` to `.env` (for local Node server) or configure Secrets in your hosting platform.
2. Set `GEMINI_API_KEY="your-key"` server-side only (never expose keys in client bundles).
3. Static-only hosts (like GitHub Pages) run all local-first features offline/online and display `"AI unavailable offline or without server connection"` for AI endpoints unless pointed at a backend server.

## 8. Known Browser Limitations
- **Alarms & Notifications**: Web browsers cannot guarantee background wake-up alarms when the app/tab is completely closed or OS battery saver suspends Web Workers. Use **Week → Export .ics Calendar** (which includes `VALARM` reminders) as a reliable native calendar fallback.
- **Voice Recording**: Requires HTTPS (or `localhost`) and user microphone permission (`MediaRecorder` API).
- **PDF Storage**: Large PDFs are stored locally in IndexedDB; clearing browser site data removes locally uploaded PDFs unless backed up via **Settings → Export JSON**.
