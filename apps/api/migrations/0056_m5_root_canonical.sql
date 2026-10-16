-- Forward repair: a custom VI home is the origin root '/', not a bare origin.
-- Only typed absolute root URLs change; publication JSON and other suffixes stay intact.
DO $$ BEGIN IF current_user<>'gcms_s02_owner' THEN RAISE EXCEPTION 'M5 owner required';END IF;END $$;
CREATE OR REPLACE FUNCTION gcms_m5.project_urls(v jsonb,old_base text,new_base text,old_path text,new_path text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$DECLARE out jsonb;item record;s text;BEGIN
 IF v IS NULL THEN RETURN NULL;END IF;
 IF jsonb_typeof(v)='array' THEN SELECT coalesce(jsonb_agg(gcms_m5.project_urls(value,old_base,new_base,old_path,new_path)),'[]') INTO out FROM jsonb_array_elements(v);RETURN out;END IF;
 IF jsonb_typeof(v)<>'object' THEN RETURN v;END IF;out:='{}';
 FOR item IN SELECT * FROM jsonb_each(v) LOOP
  IF item.key IN('canonicalUrl','url','path') AND jsonb_typeof(item.value)='string' THEN s:=item.value#>>'{}';
   IF item.key IN('canonicalUrl','url') AND (s=old_base OR left(s,length(old_base)+1)=old_base||'/') THEN item.value:=to_jsonb(CASE WHEN new_path='' AND s=old_base THEN rtrim(new_base,'/')||'/' ELSE new_base||substr(s,length(old_base)+1) END);
   ELSIF item.key='path' AND (s=old_path OR left(s,length(old_path)+1)=old_path||'/') THEN item.value:=to_jsonb(CASE WHEN new_path||substr(s,length(old_path)+1)='' THEN '/' ELSE new_path||substr(s,length(old_path)+1) END);END IF;
  ELSIF item.key NOT IN('content','service','section','body','footer') THEN item.value:=gcms_m5.project_urls(item.value,old_base,new_base,old_path,new_path);END IF;
  out:=out||jsonb_build_object(item.key,item.value);
 END LOOP;RETURN out;
END $$;
