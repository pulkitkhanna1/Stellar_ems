# Stellar EMS Portal

A student-focused EMS-style study portal for your GMAT content.

## What It Does

- Renders your day-wise plan from `data/day-plan.json`.
- Tracks task completion in browser local storage.
- Syncs checked tasks across devices via a no-database backend (`/api/progress` + GitHub Gist).
- Uses static public link map from `data/public-links.json`.
- Auto-maps day-plan file references to direct public Drive links.
- Works on any static host (GitHub Pages, Vercel, local server).

## Files

- `index.html`: app shell
- `styles.css`: UI styling
- `app.js`: planner + static link integration logic
- `config.js`: app config (folder ID)
- `api/progress.js`: cross-device progress sync (Vercel function + GitHub Gist)
- `data/day-plan.json`: day-wise schedule source
- `data/public-links.json`: direct public Drive link map
- `scripts/build_day_plan.py`: regenerate JSON from planner markdown
- `scripts/build_public_links.py`: regenerate public link map from Drive (optional)

Configured folder ID:
- `11GTSMZQlZctn6XXfKf1J7mOicJQkN_bx`

## Run Locally

```bash
cd ems-portal
python3 -m http.server 8080
```

Open:
- `http://localhost:8080`

Note: this app is static-only now, so local static serving works fully.
For direct file-open mode, open:
- `/Users/pulkit/Downloads/Stellar/ems-portal/index.html`

## Deploy on Vercel

1. Import this `ems-portal` folder as a project.
2. Framework preset: `Other` (static).
3. Output directory: `.`
4. Add env vars:
   - `PROGRESS_GIST_ID=<your_gist_id>`
   - `PROGRESS_GITHUB_TOKEN=<token_with_gist_scope>`
   - Optional: `PROGRESS_WRITE_KEY=<custom_secret>`
5. Deploy.

The repo already includes `vercel.json` tuned for this portal.

## Deploy on GitHub Pages

1. Push `ems-portal` contents to a GitHub repo root (or `docs/`).
2. Enable GitHub Pages from that branch/folder.
3. Open your Pages URL.

`ems-portal/.nojekyll` is already included.

Note: GitHub Pages works directly because this is now static-only.
Note: cross-device completion sync needs the Vercel function. On pure GitHub Pages, progress stays local to each device.

## Cross-Device Progress (No DB)

1. Create a private GitHub Gist containing one file named `stellar-progress.json` with:

```json
{}
```

2. Create a GitHub token with `gist` scope.
3. Add `PROGRESS_GIST_ID` and `PROGRESS_GITHUB_TOKEN` in Vercel env vars.
4. Keep `config.js` progress enabled:

```js
progress: {
  enabled: true,
  endpoint: "/api/progress",
  studentId: "pulkit",
  // writeKey: "same_value_as_PROGRESS_WRITE_KEY" // only if you enabled it
}
```

5. Redeploy. Your checkbox state will sync across devices under that `studentId`.

## Regenerate Day Plan JSON

After planner edits:

```bash
python3 scripts/build_day_plan.py
```

## Regenerate Direct Public Links

```bash
python3 scripts/build_public_links.py
```
