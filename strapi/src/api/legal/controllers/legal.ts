import { factories } from '@strapi/strapi';

/**
 * R-01: Rechtstexte-Single-Type. Standard-Core-Controller (öffentlicher `find`),
 * kein Gating — die Pflichtseiten müssen ohne Login erreichbar sein (Goldstandard
 * R6–R10). Die Freigabe von `api::legal.legal.find` für die Public-Rolle erfolgt
 * beim Bootstrap (src/index.ts, PUBLIC_ACTIONS).
 */
export default factories.createCoreController('api::legal.legal');
