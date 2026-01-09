# Splashmix Dash — Svelte app (scaffold)

This repository was intentionally empty. I scaffolded a minimal Vite + Svelte app so you can start developing quickly.

Quick start (Windows PowerShell):

```powershell
npm install
npm run dev
```

Open http://localhost:5173 (default Vite port) in your browser.

Files of interest:
- `index.html` — app entry
- `src/main.js` — client bootstrap
- `src/App.svelte` — main component
- `vite.config.js`, `svelte.config.js` — build tooling
- `package.json` — scripts and dependencies

Env setup:
- Copy [.env.example](.env.example) to [.env](.env) and fill values.
- To enable prompt classification, set `VITE_OPENAI_API_KEY` in [.env](.env).
- In production, ensure the server’s [.env](.env) includes the same variable; the deploy workflow reads it before build.

Next steps I can do for you:
- Switch to SvelteKit or add TypeScript
- Add a CSS framework (Tailwind, Bootstrap)
- Add testing (Vitest) and CI workflow

Tell me which direction you prefer and I'll proceed.
