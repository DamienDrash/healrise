# HEALRISE

HEALRISE is a premium wellness platform for guided, nervous-system-friendly recovery programs. It combines a calm React PWA, a Strapi 5 content backend and a production landing page into one deployment-ready repository.

The product direction is deliberately conservative: warm brand, clear purchase flow, server-side content gating, strict claim hygiene and German/EU launch readiness. No medical promises. No fake social proof. No hidden tracking.

> Status: production infrastructure is largely prepared and live on the server. Public sales remain gated by operator tasks: legal operator data/sign-off, Stripe keys and webhook, Postal/SMTP domain setup, and final content sign-off.

## What this repository contains

| Area | Path | Purpose |
|---|---:|---|
| PWA | `app/` | Member-facing React/Vite app with auth, content gating, account deletion, data export, checkout handoff and offline-aware PWA behavior. |
| CMS/API | `strapi/` | Strapi 5 backend for programs, users, purchases, Stripe webhooks, legal pages and operational APIs. |
| Landing | `landing/` → `dist/` | Public marketing page built from maintainable source into static production assets. |
| Operations | `deploy/`, `scripts/` | Caddy snippets, systemd units, health checks, backup/restore, release readiness and guard scripts. |
| Documentation | `docs/` | Production audit, release readiness, launch checklist, deployment, testing, branding and compliance notes. |

## Product principles

HEALRISE is built around a few non-negotiables:

- **Trust before conversion.** Copy, checkout and legal flows are written for a sensitive wellness context, not for aggressive funnel tactics.
- **Wellness, not medical claims.** The claim guard blocks language that would push the product toward medical-device or healing promises.
- **Paid content is enforced server-side.** Locked program fields are stripped in the backend, not merely hidden in the UI.
- **Privacy is part of the product.** Art. 9 consent, account deletion, data export and local-storage cleanup are first-class flows.
- **Operations are auditable.** Backups, restore drills, deployment checks, release readiness scripts and docs live with the code.

## Current release posture

The codebase is beyond prototype level. The server has working deployment assets, tested backup/restore, a Strapi systemd service, a built PWA, a production landing page and extensive launch documentation.

Remaining launch blockers are mostly external operator work:

| Blocker | Owner | Why it matters |
|---|---|---|
| Legal operator data and legal sign-off | Operator/legal | Impressum, privacy policy, terms and cancellation text must contain real reviewed data before public sale. |
| Stripe test/live configuration | Operator | Checkout and webhook fulfillment are built, but real keys and a registered webhook endpoint must be supplied. |
| Postal/SMTP domain setup | Operator | Password reset and purchase-confirmation mail need verified sender infrastructure. |
| Final content sign-off | Operator/editorial | Published wellness content must stay within the claims policy. |
| GitHub Actions/secrets | Operator/devops | CI template exists; repository secrets and first CI run still need setup after push. |

See `docs/release-readiness-summary.md` and `docs/launch-checklist.md` for the detailed gate list.

## Technical highlights

- React 19 + Vite 8 PWA with prompt-based service-worker updates.
- Strapi 5 backend with JWT auth and locked-field filtering by plan.
- Stripe Checkout handoff and webhook fulfillment, guarded for test/live configuration mistakes.
- Purchase-confirmation mail path for §312f BGB, ready once SMTP is configured.
- Account deletion flow that removes progress data and anonymizes retained purchase records.
- Data export endpoint for member self-service.
- Self-hosted brand fonts and complete PWA icon set.
- Claim guard, legal readiness guard, pricing parity checks, Stripe/email config guards and CI readiness script.
- Backup, restore drill and offsite sync scripts with systemd units.

## Brand system

HEALRISE uses a tactile botanical identity: warm ivory, stone, sage, ink and copper; Playfair Display for the wordmark, Lora for reading and Poppins for UI labels.

The brand source of truth is `docs/branding.md`. Brand components live in `app/src/components/brand/` and the public landing page shares the same palette and tone.

## Local development

Install dependencies from the repository root and the subprojects as needed. The root scripts orchestrate the important checks.

```bash
npm run lint
npm test
npm run test:scripts
npm run test:strapi
npm run build
npm run build:landing
```

The standard local gate is:

```bash
npm run check
```

Full API and browser-level checks need the documented local services and credentials:

```bash
npm run test:api
npm run test:e2e
npm run test:e2e:offline
```

Read `docs/testing.md` before running tests against a live environment. Some API tests are intentionally guarded so they cannot pollute production data by accident.

## Deployment and operations

Start with these documents:

- `docs/deployment.md` for the production service layout and deployment flow.
- `docs/release-readiness-summary.md` for what is done, what is operator-blocked and what evidence exists.
- `docs/launch-checklist.md` for the remaining go-live actions.
- `docs/production-readiness-audit.md` and `docs/production-readiness-roadmap.md` for the original audit trail.

Operational assets are versioned under `deploy/` and `scripts/`. Do not edit generated build output directly; update the source and rebuild.

## Security and repository hygiene

Do not commit secrets or runtime state. The root `.gitignore` excludes `.env*`, dependency folders, build artifacts, logs, Playwright reports and backup directories.

Before pushing meaningful changes, run at least:

```bash
npm run check
git diff --check
```

For changes touching checkout, email, legal text, content claims or deployment, also run the relevant guard scripts documented in `docs/testing.md` and `docs/launch-checklist.md`.

## License

Proprietary. All rights reserved. See `LICENSE`.
