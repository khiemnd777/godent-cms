-- Published-only global discovery, tenant/locale scoped before filtering and keyset paging.
CREATE FUNCTION gcms_m4.public_search(tenant_slug text,l text,q text,filter_kind text,after_key text,lim integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE t text;row record;page jsonb;items jsonb:='[]';config jsonb;BEGIN
 IF gcms_m4.locale(l) IS NOT TRUE OR q IS NULL OR length(q) NOT BETWEEN 2 AND 160 OR lim IS NULL OR lim NOT BETWEEN 1 AND 21 OR (filter_kind IS NOT NULL AND (gcms_m4.kind(filter_kind) IS NOT TRUE OR filter_kind='config')) OR (after_key IS NOT NULL AND after_key !~ '^[a-z_]+:[a-f0-9-]{36}$') THEN RETURN NULL;END IF;
 SELECT s.tenant_id INTO t FROM gcms_s02.site_draft s JOIN gcms_s02.tenant ten ON ten.id=s.tenant_id WHERE s.slug=tenant_slug AND s.public_enabled AND s.slug_locked AND ten.status='active';IF t IS NULL THEN RETURN NULL;END IF;
 config:=gcms_m4.config(t,l);IF l='en' AND config IS NULL THEN RETURN NULL;END IF;
 FOR row IN SELECT family.k,c.id,c.slug FROM unnest(ARRAY['home','page','landing','promotion','service','specialty','service_group','location','doctor','price','case','gallery','testimonial','article','category','faq']) AS family(k) CROSS JOIN LATERAL gcms_m4.public_candidates(t,family.k) c WHERE (filter_kind IS NULL OR family.k=filter_kind) AND (after_key IS NULL OR family.k||':'||c.id>after_key) ORDER BY family.k,c.id LOOP
  page:=gcms_m4.project(t,row.k,row.id,l);IF page IS NULL THEN CONTINUE;END IF;
  IF position(q IN lower(coalesce(page->'content'->>'title','')||' '||coalesce(page->'content'->>'summary','')||' '||row.slug))=0 THEN CONTINUE;END IF;
  items:=items||jsonb_build_array(jsonb_build_object('id',row.id,'kind',row.k,'title',page->'content'->'title','summary',coalesce(page->'content'->>'summary',''),'path',gcms_m4.path(tenant_slug,l,row.k,row.slug),'locale',l,'publicationId',page->'publicationId'));
  IF jsonb_array_length(items)>=lim THEN EXIT;END IF;
 END LOOP;
 RETURN jsonb_build_object('schemaVersion',4,'locale',l,'query',q,'items',items,'config',config,'nextCursor',NULL);
END $$;
REVOKE ALL ON FUNCTION gcms_m4.public_search(text,text,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m4.public_search(text,text,text,text,text,integer) TO gcms_s02_tenant;
