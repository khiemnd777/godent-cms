-- Restore creates a new draft revision. The current shared technical slug
-- remains authoritative even when the selected history predates a draft rename.
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('gcms_m4.command_before_scope_integrity(text,text,text,text,jsonb)'::regprocedure) INTO definition;
 IF position('doc:=h.content;ELSE' IN definition)=0 THEN RAISE EXCEPTION 'Missing restore content assignment';END IF;
 definition:=replace(definition,'doc:=h.content;ELSE','doc:=h.content;IF k<>''config'' AND gcms_m4.slug_locked(t,k,r) THEN doc:=jsonb_set(doc,''{slug}'',to_jsonb(gcms_m4.identity_slug(t,k,r)));END IF;ELSE');EXECUTE definition;
END $$;
