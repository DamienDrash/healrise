# HEALRISE — Goldstandard-Referenz (Stand: Juli 2026)

Ergebnis der Tiefenrecherche (Deep-Research-Workflow, 24 Quellen, 83 extrahierte Claims, 25 kuratiert).
Hinweis: Die automatische Adversarial-Verifikation ist infrastrukturell fehlgeschlagen (0:0-Votes);
die hier gelisteten Aussagen stammen aus Primärquellen (offizielle Docs, RevenueCat/Adapty-Reports)
und wurden manuell als plausibel eingestuft.

## 1. UX & Produkt (Paywall, Onboarding, Retention)

| # | Erkenntnis | Quelle |
|---|-----------|--------|
| U1 | Health-&-Fitness-Apps: mediane Trial-to-Paid-Conversion 37–40 %, Top-10 % erreichen 68 % | [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025/) |
| U2 | 82 % der Trial-Starts passieren am Installationstag → Tag 0 (Onboarding + Paywall-Präsentation) ist der entscheidende Conversion-Moment | RevenueCat SOSA 2025 |
| U3 | Harte Paywall konvertiert ~5× besser als Freemium (Day-35: 10,7–12,1 % vs. 2,1–2,2 %); Jahres-Retention nahezu identisch | RevenueCat SOSA 2025/2026 |
| U4 | Harte Paywall bringt ~21 % höheren LTV als Soft-Paywall in Health & Fitness | [Adapty Benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/) |
| U5 | Längere Trials (17–32 Tage) konvertieren ~70 % besser als kurze (42,5 % vs. 25,5 %); bei 3-Tage-Trials passieren 55 % der Kündigungen an Tag 0 | RevenueCat SOSA |
| U6 | Jahrespläne = 68 % Umsatzanteil in Health & Fitness (höchster aller Kategorien); hochpreisige Jahrespläne ≈ 4× LTV günstiger Pläne | Adapty Benchmarks |
| U7 | Trials verbessern Retention beim ersten Renewal um 8–60 % | Adapty Benchmarks |

**Ableitung für HEALRISE:** Einmalkauf-Stufenmodell (0–399 €) ist ok, aber: Tag-0-Onboarding
mit sofort erlebbarem Wert (Freebie-Inhalte als „Trial"), klarer Upgrade-Pfad direkt aus
gesperrten Inhalten heraus, Fortschritts-Mechanik (Streak/Tage erledigt) als Retention-Anker.

## 2. Technik (PWA, Strapi, Payments)

### PWA / vite-plugin-pwa
| # | Erkenntnis | Quelle |
|---|-----------|--------|
| T1 | Update-Prompt-Flow: `registerSW` aus `virtual:pwa-register` mit `onNeedRefresh`/`onOfflineReady`; `updateSW()` lädt neue Version | [vite-pwa: prompt-for-update](https://vite-pwa-org.netlify.app/guide/prompt-for-update) |
| T2 | Periodische SW-Update-Checks: `registration.update()` in `setInterval` im `registerSW`-Callback; vorher prüfen: SW nicht installing, Client online | [vite-pwa: periodic-sw-updates](https://vite-pwa-org.netlify.app/guide/periodic-sw-updates) |
| T3 | Precache: workbox nimmt standardmäßig nur css/js/html; Fonts/Bilder/Icons explizit über `globPatterns` | [vite-pwa: precache](https://vite-pwa-org.netlify.app/guide/service-worker-precache) |
| T4 | Offline-Fähigkeit erfordert vollständiges Precache-Manifest aller App-Ressourcen (inkl. self-hosted Fonts) | vite-pwa Docs |

### Strapi 5 (Content-Gating, Auth)
| # | Erkenntnis | Quelle |
|---|-----------|--------|
| T5 | Nur zwei Default-Rollen (Public/Authenticated); Requests ohne Token laufen automatisch gegen Public-Permissions → Public-Rolle strikt minimieren | [Strapi Docs: users-permissions](https://docs.strapi.io/cms/features/users-permissions) |
| T6 | JWT-Expiry nie länger als 30 Tage (offizielle Empfehlung) | Strapi Docs |
| T7 | Strapi 5 bietet „refresh"-Modus (kurzlebige Access-Tokens + Refresh-Tokens) statt Legacy-Langzeit-JWT → Goldstandard für Session-Handling | Strapi Docs |
| T8 | Bezahl-Gating gehört serverseitig in Controller/Policies (Programme nach `plan_required` vs. User-Plan filtern, Volltext-Felder erst nach Berechtigungsprüfung ausliefern) | Strapi Security Checklist |

### Stripe
| # | Erkenntnis | Quelle |
|---|-----------|--------|
| T9 | Webhook-Authentizität via `Stripe-Signature`-Header (HMAC-SHA256) verifizieren, bevor Inhalte freigeschaltet werden | [Stripe Webhooks](https://docs.stripe.com/webhooks) |
| T10 | Webhook-Endpoint muss schnell 2xx liefern, Business-Logik asynchron danach | Stripe Docs |

### Testing (aus Recherche-Frage abgeleiteter Industriestandard)
- Unit/Component: Vitest + React Testing Library
- E2E: Playwright (Login, Gating, Upgrade-Flow, Offline)
- Backend: API-Tests gegen Strapi (supertest o.ä.), insbes. Permissions-Matrix je Rolle × Endpoint

## 3. Recht & Compliance (Recherche 03.07.2026, 20+ Quellen)

Punkte aus dem technischen Review (weiterhin gültig):
- Google Fonts zur Laufzeit von Google-Servern = Abmahnrisiko (LG München I, 2022) → self-hosten
- JWT in `localStorage` + ungesäubertes CMS-HTML = XSS→Session-Diebstahl-Kette → DOMPurify + mittelfristig httpOnly-Cookie
- Fortschrittsdaten (Gesundheitsbezug) aktuell unverschlüsselt in localStorage, überleben Logout → pro User serverseitig speichern, bei Logout lokal löschen

### DSGVO & Gesundheitsdaten (Art. 9)
| # | Erkenntnis | Quelle |
|---|-----------|--------|
| R1 | Trainings-/Fortschrittsdaten aus Health-Apps gelten überwiegend als Gesundheitsdaten (Art. 4 Nr. 15 / Art. 9); Maßstab: Rückschlüsse auf Gesundheitszustand möglich? | [isiCO](https://www.isico.de/blog/datenschutzrechtlichen-anforderungen-bei-gesundheits-und-fitness-apps), [SRD](https://www.srd-rechtsanwaelte.de/blog/gesundheitsapps-datenschutz-datensicherheit) |
| R2 | EuGH *Lindenapotheke* (C-21/23, 10/2024): sehr weite Auslegung — schon der **Kauf** eines beschwerdebezogenen Produkts ist ein Gesundheitsdatum; DSGVO-Verstöße sind per UWG abmahnbar | [EuGH](https://curia.europa.eu/site/upload/docs/application/pdf/2024-10/cp240159de.pdf) |
| R3 | Einzige tragfähige Rechtsgrundlage für Wellness-App: **ausdrückliche Einwilligung** (Art. 9 Abs. 2 lit. a) — separater aktiver Opt-in, protokolliert, widerrufbar; Vertragserfüllung reicht NICHT | isiCO, BvD |
| R4 | TOMs: TLS + Verschlüsselung at rest, Least-Privilege, Löschkonzept; DSFA (Art. 35) bei umfangreicher Art.-9-Verarbeitung prüfen | SRD |
| R5 | AVV mit Hoster zwingend (EU-Hosting bevorzugen); Stripe-DPA wird automatisch Vertragsbestandteil (hybrid: teils Auftragsverarbeiter, teils eigener Verantwortlicher) | [Stripe DPA](https://stripe.com/de-de/legal/dpa) |

### Pflichtseiten & E-Commerce-Recht (DE)
| # | Erkenntnis | Quelle |
|---|-----------|--------|
| R6 | Impressum nach **§ 5 DDG** (TMG seit 14.05.2024 aufgehoben — „§ 5 TMG"-Verweise sind abmahnrisikobehaftet); max. 2 Klicks erreichbar | [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html) |
| R7 | Datenschutzerklärung deutsch, vollständig inkl. Art.-9-Rechtsgrundlage, Stripe/Hoster als Empfänger, Drittlandtransfer, Speicherdauern, Betroffenenrechte | isiCO |
| R8 | Widerruf digitale Inhalte erlischt vorzeitig (§ 356 Abs. 5 BGB) nur bei: expliziter Zustimmung zur sofortigen Ausführung + Kenntnis-Bestätigung des Verlusts + Bestätigung nach § 312f BGB auf dauerhaftem Datenträger (Mail sofort nach Kauf) | [§ 356 BGB](https://www.gesetze-im-internet.de/bgb/__356.html), IT-Recht Kanzlei, OLG München |
| R9 | Button-Lösung § 312j Abs. 3 BGB: Button nur „zahlungspflichtig bestellen"/„kaufen"; Pflichtinfos + Gesamtpreis unmittelbar darüber; Verstoß → Vertrag kommt nicht zustande | [§ 312j BGB](https://www.gesetze-im-internet.de/bgb/__312j.html) |
| R10 | PAngV: Gesamtpreise inkl. USt. („inkl. MwSt."); AGB nicht pflichtig, aber für Stufenmodell dringend empfohlen | IHK |

### Cookies / localStorage (TDDDG)
| # | Erkenntnis | Quelle |
|---|-----------|--------|
| R11 | TTDSG heißt seit 14.05.2024 **TDDDG**; § 25 erfasst technologieneutral auch localStorage/IndexedDB | [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html) |
| R12 | **Kein Consent-Banner nötig**, solange nur „unbedingt erforderliche" Speicherung (Login-Token, Fortschritt, Settings) und kein Tracking/Analytics — transparente Doku in DSE genügt. Bei Analytics: aktiver Opt-in mit gleichwertigem Ablehnen-Button | IHK Köln, Cortina |
| R13 | EinwV (seit 01.04.2025): anerkannte Einwilligungsverwaltungsdienste möglich, keine Pflicht *(einfach belegt)* | Digitalsprung |

### Stripe & DSGVO
| # | Erkenntnis | Quelle |
|---|-----------|--------|
| R14 | Stripe ist DPF-zertifiziert + SCCs als Fallback; EuG hat DPF-Klage 09/2025 abgewiesen → aktuell stabil | Cookiebox, e-recht24 |
| R15 | DSE muss enthalten: Stripe als Empfänger (IE/US), Zweck, Datenkategorien, Art. 6 Abs. 1 lit. b/f, USA-Transfer mit DPF+SCCs, Link zur Stripe Privacy Policy. Stripe.js nur im Checkout laden (sonst Einwilligungspflicht umstritten) | Cookiebox, opr.vc |

### BFSG (Barrierefreiheit, seit 28.06.2025)
| # | Erkenntnis | Quelle |
|---|-----------|--------|
| R16 | BFSG erfasst B2C-„Dienstleistungen im elektronischen Geschäftsverkehr" — Bezahl-PWA fällt grundsätzlich darunter | Bundesfachstelle, Härting |
| R17 | **Kleinstunternehmen-Ausnahme** (§ 3 Abs. 3 BFSG): < 10 MA und ≤ 2 Mio. € Umsatz → HEALRISE aktuell befreit (Bundesfachstelle bestätigt) | [§ 3 BFSG](https://bfsg-gesetz.de/3-bfsg/) |
| R18 | Falls anwendbar: EN 301 549 / WCAG 2.1 AA; Bußgeld bis 100.000 €. Empfehlung: WCAG 2.1 AA von Anfang an mitbauen — Nachrüsten ist teuer | IHK Stuttgart |

### Medizinprodukte-Abgrenzung (MDR)
| # | Erkenntnis | Quelle |
|---|-----------|--------|
| R19 | Entscheidend ist die **Zweckbestimmung** (inkl. Werbung!): Diagnose/Therapie/Linderung/Überwachung von Krankheiten → Medizinprodukt. Reine Wellness-Apps ohne medizinischen Claim: nein. Guidance: MDCG 2019-11 (Rev. 06/2025), BfArM-Statusfeststellung | Quickbird, BfArM |
| R20 | Safe Harbor: ✅ „fördert Wohlbefinden/Beweglichkeit", „unterstützt aktiven Lebensstil". ❌ „lindert/behandelt/therapiert X", „bei [Krankheit]", symptombasierte personalisierte Empfehlungen. Verbotene-Wörter-Liste für alle Texte/Ads pflegen; HWG beachten. **Achtung: aktuelle Inhalte („nach deiner Brust-OP", Heilungs-Claims) grenzwertig → Text-Review nötig** | Quickbird, devicemed |

### E-Mail/Marketing
| # | Erkenntnis | Quelle |
|---|-----------|--------|
| R21 | Werbemails nur mit Double-Opt-In (Bestätigungsmail werbefrei!), Einwilligung protokollieren | Dr. Datenschutz |
| R22 | Bestandskundenausnahme § 7 Abs. 3 UWG: 4 kumulative Voraussetzungen inkl. Widerspruchshinweis im Checkout und in jeder Mail | IT-Recht Kanzlei |

### Ableitung für HEALRISE — MUSS vor Launch
1. Impressum (§ 5 DDG), Datenschutzerklärung (inkl. Art. 9, Stripe), AGB, Widerrufsbelehrung — alle als Seiten in App + Landing
2. Art.-9-Einwilligung beim Onboarding (separater Opt-in, protokolliert serverseitig)
3. Checkout: Button „zahlungspflichtig bestellen", Gesamtpreis inkl. MwSt. direkt darüber, Widerrufs-Erlöschens-Checkbox + Bestätigungsmail (§ 312f BGB)
4. Google Fonts self-hosten; kein Tracking → kein Consent-Banner nötig
5. Medizinprodukt-Firewall: Alle Texte auf Wellness-Claims prüfen (aktuelle Inhalte sind OP-/heilungsbezogen!)
6. TOMs: TLS, Verschlüsselung at rest, Progress serverseitig + Löschung bei Logout, Löschkonzept

_Hinweis: Rechercheübersicht, keine Rechtsberatung — finale Rechtstexte anwaltlich prüfen lassen oder Generator mit Haftungsübernahme (e-recht24, IT-Recht Kanzlei) nutzen._
