"use client";
import { M5_DOMAIN_ROUTES, type M5DomainsView } from "../../api/src/contracts/m5-domains";
import type { M4Kind, M4Locale } from "../../api/src/contracts/m4";
import { primaryPublicUrl } from "../lib/primary-url";
import { usePrivateRecord } from "./use-private-record";
export function usePrimaryUrl(tenantId: string) {
  const record = usePrivateRecord<M5DomainsView>(M5_DOMAIN_ROUTES.list(tenantId));
  return (tenantSlug: string, locale: M4Locale, kind: M4Kind, slug?: string) => record.value ? primaryPublicUrl(record.value.primary, tenantSlug, locale, kind, slug) : null;
}
