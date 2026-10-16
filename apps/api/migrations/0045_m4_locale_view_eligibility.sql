-- Virtual builder locales have no legacy RECORD. Read the already captured
-- typed legacy state only for external resource version counters.
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('gcms_m4.variant_view(text,text,text,text)'::regprocedure) INTO definition;
 IF position('ELSE legacy.version END' IN definition)=0 THEN RAISE EXCEPTION 'Missing virtual locale version expression';END IF;
 definition:=replace(definition,'ELSE legacy.version END','ELSE coalesce((state->>''version'')::integer,0) END');EXECUTE definition;
 SELECT pg_get_functiondef('gcms_m4.public_list(text,text,text,text,text,integer,text,text,text)'::regprocedure) INTO definition;
 IF position('IF t IS NULL THEN RETURN NULL;END IF;' IN definition)=0 THEN RAISE EXCEPTION 'Missing public listing tenant boundary';END IF;
 definition:=replace(definition,'IF t IS NULL THEN RETURN NULL;END IF;','IF t IS NULL THEN RETURN NULL;END IF;IF l=''en'' AND gcms_m4.config(t,''en'') IS NULL THEN RETURN NULL;END IF;');EXECUTE definition;
END $$;
