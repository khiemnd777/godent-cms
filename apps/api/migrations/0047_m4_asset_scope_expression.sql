-- PostgreSQL must subtract allowed keys from the scope object, rather than
-- interpreting the token 'scope' as JSON for the subtraction operator.
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('gcms_m4.command_before_scope_integrity(text,text,text,text,jsonb)'::regprocedure) INTO definition;
 IF position('c->''scope''-ARRAY[' IN definition)=0 THEN RAISE EXCEPTION 'Missing asset scope expression';END IF;
 definition:=replace(definition,'c->''scope''-ARRAY[','(c->''scope'')-ARRAY[');EXECUTE definition;
END $$;
