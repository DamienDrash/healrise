/**
 * D-04: Upload-Plugin-Readiness/Guardrail.
 *
 * Prüft die Upload-Konfiguration lokal (kein Netz, kein Provider-Call, keine
 * Secrets im Output): das sizeLimit muss gesetzt/gebunden sein (sonst effektiv
 * unbeschränkt), und die Doku darf kein externes Object-Storage/CDN als aktiv
 * behaupten, ohne dass ein Provider samt Config vorhanden ist.
 *
 * Der lokale Default-Provider ist `local` (@strapi/provider-upload-local, in
 * Strapi gebündelt) — kein S3/Cloudinary nötig. Object-Storage/CDN für großes
 * Produktions-Medienvolumen ist ein Betreiber-Schritt.
 */

type EnvGet = (key: string, def?: string) => string | undefined;

export interface UploadReadiness {
  ready: boolean;
  provider: string;
  sizeLimit: number;
  blockers: string[];
  warnings: string[];
}

export const DEFAULT_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MiB — sicher für gated Media/Assets
const MAX_SIZE_LIMIT = 50 * 1024 * 1024; // > 50 MiB gilt als unbounded-Risiko

export function validateUploadConfig(
  env: EnvGet,
  opts: { docsClaimObjectStorage?: boolean } = {},
): UploadReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // sizeLimit: gesetzt → positive Ganzzahl und gebunden; sonst sicherer Default.
  const raw = env('UPLOAD_SIZE_LIMIT_BYTES');
  let sizeLimit = DEFAULT_SIZE_LIMIT;
  if (raw === undefined || raw === '') {
    warnings.push(`UPLOAD_SIZE_LIMIT_BYTES nicht gesetzt — sicherer Default ${DEFAULT_SIZE_LIMIT} Bytes (5 MiB)`);
  } else if (!/^\d+$/.test(raw) || parseInt(raw, 10) <= 0) {
    blockers.push('UPLOAD_SIZE_LIMIT_BYTES muss eine positive Ganzzahl (Bytes) sein');
  } else {
    sizeLimit = parseInt(raw, 10);
    if (sizeLimit > MAX_SIZE_LIMIT) {
      blockers.push('UPLOAD_SIZE_LIMIT_BYTES über sicherem Maximum (50 MiB) — Upload wäre effektiv unbeschränkt');
    }
  }

  // Provider: lokal ist ok. Externer Provider muss konfiguriert sein (ohne
  // Secret-Werte zu prüfen — nur Vorhandensein von Bucket/Base-URL).
  const provider = env('UPLOAD_PROVIDER', 'local') || 'local';
  if (provider !== 'local') {
    if (!env('UPLOAD_BUCKET') && !env('UPLOAD_BASE_URL')) {
      blockers.push(
        `UPLOAD_PROVIDER=${provider} gesetzt, aber weder UPLOAD_BUCKET noch UPLOAD_BASE_URL — Object-Storage nicht konfiguriert`,
      );
    }
  }

  if (opts.docsClaimObjectStorage && provider === 'local') {
    blockers.push('Doku behauptet externes Object-Storage/CDN, aber UPLOAD_PROVIDER=local — nicht aktiv');
  }

  return { ready: blockers.length === 0, provider, sizeLimit, blockers, warnings };
}
