-- Public media metadata must resolve through a narrow current-publication contract, not ambient tenant RLS.
CREATE OR REPLACE FUNCTION gcms_s08.valid_cover(v jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT v IS NULL OR (jsonb_typeof(v)='object' AND v ?& ARRAY['assetId','revision','alt'] AND
   (v-ARRAY['assetId','revision','alt'])='{}'::jsonb AND jsonb_typeof(v->'assetId')='string' AND
   v->>'assetId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' AND
   jsonb_typeof(v->'revision')='number' AND v->>'revision' ~ '^[1-9][0-9]{0,8}$' AND
   jsonb_typeof(v->'alt')='string' AND length(btrim(v->>'alt')) BETWEEN 1 AND 500)
$$;
CREATE FUNCTION gcms_s08.read_public_service_cover(p_tenant_slug text,p_service_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_s07.public_derivative(p.tenant_id,s.closure->'service'->'coverImage'->>'assetId',
   (s.closure->'service'->'coverImage'->>'revision')::integer)||jsonb_build_object('alt',s.closure->'service'->'coverImage'->>'alt')
 FROM gcms_s02.publication_pointer p
 JOIN gcms_s02.publication_snapshot s ON s.tenant_id=p.tenant_id AND s.service_id=p.service_id AND s.id=p.snapshot_id
 JOIN gcms_s02.service_draft d ON d.tenant_id=p.tenant_id AND d.id=p.service_id
 JOIN gcms_s02.site_draft site ON site.tenant_id=p.tenant_id
 JOIN gcms_s02.tenant t ON t.id=p.tenant_id
 WHERE site.slug=p_tenant_slug AND d.slug=p_service_slug AND t.status='active' AND site.public_enabled AND site.slug_locked AND d.slug_locked
 AND s.closure->'service'->'coverImage' IS NOT NULL
$$;
REVOKE ALL ON FUNCTION gcms_s08.read_public_service_cover(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_s08.read_public_service_cover(text,text) TO gcms_s02_tenant;
