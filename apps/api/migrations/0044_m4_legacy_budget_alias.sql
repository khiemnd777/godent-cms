-- A legacy VI alternate must not collide with the PL/pgSQL variant record d.
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('gcms_m4.admit_public(text,text,text,text,text)'::regprocedure) INTO definition;
 IF position('JOIN gcms_m3.resource d ON d.tenant_id=p.tenant_id AND d.id=p.resource_id AND d.active_publication_id=p.id' IN definition)=0 THEN RAISE EXCEPTION 'Missing legacy admission alias';END IF;
 definition:=replace(definition,'JOIN gcms_m3.resource d ON d.tenant_id=p.tenant_id AND d.id=p.resource_id AND d.active_publication_id=p.id','JOIN gcms_m3.resource source_resource ON source_resource.tenant_id=p.tenant_id AND source_resource.id=p.resource_id AND source_resource.active_publication_id=p.id');
 definition:=replace(definition,'AND d.kind=k;END IF;','AND source_resource.kind=k;END IF;');EXECUTE definition;
 SELECT pg_get_functiondef('gcms_m4.matches_filter(text,text,text,text,text,text,text)'::regprocedure) INTO definition;
 IF position('JOIN gcms_m3.resource d ' IN definition)=0 THEN RAISE EXCEPTION 'Missing reverse-reference legacy alias';END IF;
 definition:=replace(definition,'JOIN gcms_m3.resource d ','JOIN gcms_m3.resource source_resource ');definition:=replace(definition,'d.tenant_id=p.tenant_id','source_resource.tenant_id=p.tenant_id');definition:=replace(definition,'d.id=p.resource_id','source_resource.id=p.resource_id');definition:=replace(definition,'d.active_publication_id=p.id','source_resource.active_publication_id=p.id');definition:=replace(definition,'AND d.kind=k;','AND source_resource.kind=k;');EXECUTE definition;
END $$;
