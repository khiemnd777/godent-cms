-- Independent review: media delivery uses the same current site eligibility as HTML.
CREATE OR REPLACE FUNCTION gcms_s07.public_reference_exists(p_tenant text,p_asset text,p_revision integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_s02.publication_pointer p
 JOIN gcms_s02.publication_snapshot s ON s.tenant_id=p.tenant_id AND s.service_id=p.service_id AND s.id=p.snapshot_id
 JOIN gcms_s02.service_draft d ON d.tenant_id=p.tenant_id AND d.id=p.service_id
 JOIN gcms_s02.site_draft site ON site.tenant_id=p.tenant_id JOIN gcms_s02.tenant t ON t.id=p.tenant_id
 WHERE p.tenant_id=p_tenant AND t.status='active' AND site.public_enabled AND site.slug_locked AND d.slug_locked
 AND s.closure->'service'->'coverImage'->>'assetId'=p_asset AND s.closure->'service'->'coverImage'->>'revision'=p_revision::text)
$$;
