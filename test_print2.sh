#!/bin/bash
export CLAUDE_CONFIG_DIR=/home/claude/.claude-healrise
export PATH=$PATH:/usr/local/bin:/usr/bin
cd /opt/healrise
/usr/bin/claude -p "Lies /opt/healrise/healrise_po_state.json und /opt/data/blockers_damien.md. Mache das naechste Ticket laut docs/production-readiness-roadmap.md (P3.5 Kaufbestaetigungs-Mail nach Stripe-Webhook oder restliche Tests). Da Stripe-Live blockiert ist, baue den lokalen Goldstandard und nutze die vorhandenen Stripe-Keys/Webhook-Gards fuer lokale Tests. Teste die Code-Aenderungen real (npm run test) vor dem lokalen Commit." > /opt/healrise/test_print2.log 2>&1
