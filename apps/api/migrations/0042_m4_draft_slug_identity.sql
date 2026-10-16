-- The technical slug is shared by all locale drafts. First publication locks
-- the identity permanently; an unpublished draft rename versions sibling drafts.
CREATE FUNCTION gcms_m4.slug_locked(t text,k text,r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN k IN ('config','home') THEN true WHEN k='service' THEN coalesce((SELECT slug_locked FROM gcms_s02.service_draft WHERE tenant_id=t AND id=r),true) WHEN gcms_m3.kind(k) THEN coalesce((SELECT slug_locked FROM gcms_m3.resource WHERE tenant_id=t AND kind=k AND id=r),true) ELSE coalesce((SELECT slug_locked FROM gcms_m4.identity WHERE tenant_id=t AND kind=k AND id=r),true) END
 OR EXISTS(SELECT 1 FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND publication_version>0)
$$;
CREATE FUNCTION gcms_m4.rename_draft_identity(t text,k text,r text,l text,new_slug text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE sibling gcms_m4.variant%ROWTYPE;source gcms_m3.resource%ROWTYPE;actor_name text;BEGIN
 IF gcms_m4.slug_locked(t,k,r) OR gcms_s02.valid_slug(new_slug) IS NOT TRUE OR (k='page' AND gcms_m4.page_slug(new_slug) IS NOT TRUE) THEN RAISE EXCEPTION 'Published identity slug is locked' USING ERRCODE='23514';END IF;
 SELECT name INTO actor_name FROM gcms_s02_auth."user" WHERE id=gcms_s02.current_actor();
 IF k='service' THEN UPDATE gcms_s02.service_draft SET slug=new_slug,version=version+1,updated_by=gcms_s02.current_actor(),updated_at=clock_timestamp() WHERE tenant_id=t AND id=r;
 ELSIF gcms_m3.kind(k) THEN UPDATE gcms_m3.resource SET slug=new_slug,content=jsonb_set(content,'{slug}',to_jsonb(new_slug)),version=version+1,updated_by=gcms_s02.current_actor(),updated_at=clock_timestamp() WHERE tenant_id=t AND kind=k AND id=r RETURNING * INTO source;
  INSERT INTO gcms_m3.revision(tenant_id,resource_id,version,content,kind,actor_id,actor_name) VALUES(t,r,source.version,source.content,'saved',gcms_s02.current_actor(),actor_name);
 ELSE UPDATE gcms_m4.identity SET slug=new_slug WHERE tenant_id=t AND kind=k AND id=r;END IF;
 FOR sibling IN UPDATE gcms_m4.variant SET content=jsonb_set(content,'{slug}',to_jsonb(new_slug)),version=version+1,updated_by=gcms_s02.current_actor(),updated_at=clock_timestamp() WHERE tenant_id=t AND kind=k AND resource_id=r AND locale<>l RETURNING * LOOP
  INSERT INTO gcms_m4.revision(tenant_id,kind,resource_id,locale,version,content,event,actor_id,actor_name) VALUES(t,k,r,sibling.locale,sibling.version,sibling.content,'saved',gcms_s02.current_actor(),actor_name);
 END LOOP;
END $$;
DO $$DECLARE definition text;before_text text;after_text text;BEGIN
 SELECT pg_get_functiondef('gcms_m4.command_before_scope_integrity(text,text,text,text,jsonb)'::regprocedure) INTO definition;
 before_text:='IF slug_value IS NULL OR (k<>''config'' AND doc->>''slug'' IS DISTINCT FROM slug_value) THEN RAISE EXCEPTION ''Resource identity or slug unavailable'' USING ERRCODE=''23514'';END IF;';
 after_text:='IF slug_value IS NULL THEN RAISE EXCEPTION ''Resource identity unavailable'' USING ERRCODE=''23514'';END IF;IF k<>''config'' AND doc->>''slug'' IS DISTINCT FROM slug_value THEN PERFORM gcms_m4.rename_draft_identity(t,k,r,l,doc->>''slug'');legacy_state:=gcms_m4.legacy_state(t,k,r);END IF;';
 IF position(before_text IN definition)=0 THEN RAISE EXCEPTION 'Missing initial slug guard';END IF;definition:=replace(definition,before_text,after_text);
 before_text:='IF gcms_m4.valid_content(k,doc) IS NOT TRUE OR (k<>''config'' AND doc->>''slug'' IS DISTINCT FROM gcms_m4.identity_slug(t,k,r)) THEN RAISE EXCEPTION ''Content or locked slug conflict'' USING ERRCODE=''23514'';END IF;';
 after_text:='IF gcms_m4.valid_content(k,doc) IS NOT TRUE THEN RAISE EXCEPTION ''Invalid content'' USING ERRCODE=''23514'';END IF;IF action=''save'' AND d.legacy_guard IS NOT NULL AND c->''expectedLegacyState'' IS DISTINCT FROM gcms_m4.legacy_state(t,k,r) THEN RAISE EXCEPTION ''Legacy source state conflict; reload required'' USING ERRCODE=''23514'';END IF;IF k<>''config'' AND doc->>''slug'' IS DISTINCT FROM gcms_m4.identity_slug(t,k,r) THEN PERFORM gcms_m4.rename_draft_identity(t,k,r,l,doc->>''slug'');END IF;';
 IF position(before_text IN definition)=0 THEN RAISE EXCEPTION 'Missing saved slug guard';END IF;definition:=replace(definition,before_text,after_text);
 before_text:='IF action=''save'' AND d.legacy_guard IS NOT NULL AND c->''expectedLegacyState'' IS DISTINCT FROM gcms_m4.legacy_state(t,k,r) THEN RAISE EXCEPTION ''Legacy source state conflict; reload required'' USING ERRCODE=''23514'';END IF;UPDATE gcms_m4.variant';
 IF position(before_text IN definition)=0 THEN RAISE EXCEPTION 'Missing source guard';END IF;definition:=replace(definition,before_text,'UPDATE gcms_m4.variant');
 definition:=replace(definition,'THEN c->''expectedLegacyState'' ELSE legacy_guard END','THEN gcms_m4.legacy_state(t,k,r) ELSE legacy_guard END');EXECUTE definition;
 SELECT pg_get_functiondef('gcms_m4.variant_view(text,text,text,text)'::regprocedure) INTO definition;
 IF position('''slugLocked'',true' IN definition)=0 THEN RAISE EXCEPTION 'Missing view slug lock projection';END IF;definition:=replace(definition,'''slugLocked'',true','''slugLocked'',gcms_m4.slug_locked(t,k,r)');EXECUTE definition;
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;
REVOKE ALL ON FUNCTION gcms_m4.rename_draft_identity(text,text,text,text,text),gcms_m4.slug_locked(text,text,text) FROM gcms_s02_tenant,gcms_s04_intake,gcms_s07_worker;
