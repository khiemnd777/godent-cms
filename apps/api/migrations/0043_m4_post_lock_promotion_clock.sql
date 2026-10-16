-- Public form eligibility must use actual time after an intake waits for the
-- tenant lock. Statement start time can be before either promotion boundary.
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('gcms_m4.project_core(text,text,text,text,text,integer,boolean)'::regprocedure) INTO definition;
 IF position('statement_timestamp()' IN definition)=0 THEN RAISE EXCEPTION 'Missing promotion clock expression';END IF;
 definition:=replace(definition,'statement_timestamp()','clock_timestamp()');EXECUTE definition;
END $$;
