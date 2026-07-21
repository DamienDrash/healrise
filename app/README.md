# HEALRISE App (PWA)

React 19 + Vite 8 + vite-plugin-pwa. Frontend der HEALRISE-Plattform; Backend ist Strapi 5 (`../strapi`).

```bash
npm run dev        # Dev-Server (proxied /healrise/app/api → Strapi auf 127.0.0.1:9130)
npm test           # Vitest (Unit/Component)
npm run lint       # ESLint
npm run build      # Produktions-Build nach dist/
```

Details: `../docs/testing.md` (Testen), `../docs/deployment.md` (Deployment),
`../docs/plan/` (Umsetzungsplan), `../docs/review-2026-07.md` (Review-Findings).
