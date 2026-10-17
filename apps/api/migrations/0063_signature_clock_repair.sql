-- Forward-only R1: restore actual time after a statement waits for a tenant lock.
-- Refuse to rewrite an unexpected projector. Applied 0060--0062 stay unchanged.
DO $repair$ DECLARE definition text;old_expression text:='WHEN statement_timestamp()<(doc->>''startAt'')::timestamptz THEN ''upcoming'' WHEN statement_timestamp()>=(doc->>''endAt'')::timestamptz THEN ''expired''';new_expression text:='WHEN clock_timestamp()<(doc->>''startAt'')::timestamptz THEN ''upcoming'' WHEN clock_timestamp()>=(doc->>''endAt'')::timestamptz THEN ''expired''';BEGIN
 SELECT pg_get_functiondef('gcms_m4.project_core(text,text,text,text,text,integer,boolean)'::regprocedure) INTO definition;
 IF (length(definition)-length(replace(definition,old_expression,'')))/length(old_expression)<>1 OR position('hero_carousel' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected signature promotion clock expression';END IF;
 definition:=replace(definition,old_expression,new_expression);
 IF position('statement_timestamp()' IN definition)>0 THEN RAISE EXCEPTION 'Unexpected remaining statement clock';END IF;EXECUTE definition;
END $repair$;
