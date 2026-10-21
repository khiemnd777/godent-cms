-- Forward-only optional Signature homepage hero typography. Existing snapshots keep their bytes.
DO $copy$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('gcms_m4.valid_content(text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'FUNCTION gcms_m4.valid_content(','FUNCTION gcms_m4.valid_content_before_hero_typography(');
 EXECUTE definition;
END $copy$;

CREATE OR REPLACE FUNCTION gcms_m4.valid_content(k text,c jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE normalized jsonb:=c;signature jsonb;section jsonb;slide jsonb;sections jsonb:='[]';slides jsonb;phrase text;title text;first_at integer;
BEGIN
 IF k='config' AND c->>'theme'='signature' THEN
  signature:=c->'signature';
  IF signature ? 'heroTypography' THEN
   IF jsonb_typeof(signature->'heroTypography') IS DISTINCT FROM 'string' OR signature->>'heroTypography' NOT IN ('default','warm_editorial','rose_editorial') THEN RETURN false;END IF;
   normalized:=jsonb_set(c,'{signature}',signature-'heroTypography');
  END IF;
 ELSIF k IN ('home','page','landing') THEN
  IF jsonb_typeof(c->'sections') IS DISTINCT FROM 'array' THEN RETURN false;END IF;
  FOR section IN SELECT value FROM jsonb_array_elements(c->'sections') LOOP
   IF section->>'type'='hero_carousel' THEN
    IF jsonb_typeof(section->'slides') IS DISTINCT FROM 'array' THEN RETURN false;END IF;
    slides:='[]';
    FOR slide IN SELECT value FROM jsonb_array_elements(section->'slides') LOOP
     IF slide ? 'highlight' THEN
      IF k<>'home' OR jsonb_typeof(slide->'highlight') IS DISTINCT FROM 'string' OR NOT gcms_m4.text(slide->'highlight',160,true) THEN RETURN false;END IF;
      phrase:=slide->>'highlight';title:=slide->>'title';first_at:=strpos(title,phrase);
      IF first_at=0 OR strpos(substr(title,first_at+1),phrase)>0 THEN RETURN false;END IF;
      slide:=slide-'highlight';
     END IF;
     slides:=slides||jsonb_build_array(slide);
    END LOOP;
    section:=jsonb_set(section,'{slides}',slides);
   END IF;
   sections:=sections||jsonb_build_array(section);
  END LOOP;
  normalized:=jsonb_set(c,'{sections}',sections);
 END IF;
 RETURN gcms_m4.valid_content_before_hero_typography(k,normalized) IS TRUE;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

-- The 0060 public config projection removes private navigation references. Restore only the validated style.
DO $copy$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('gcms_m4.config(text,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'FUNCTION gcms_m4.config(','FUNCTION gcms_m4.config_before_hero_typography(');
 EXECUTE definition;
END $copy$;

CREATE OR REPLACE FUNCTION gcms_m4.config(t text,l text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;style jsonb;
BEGIN
 result:=gcms_m4.config_before_hero_typography(t,l);
 IF result IS NULL OR result->'content'->>'theme'<>'signature' THEN RETURN result;END IF;
 SELECT content->'signature'->'heroTypography' INTO style FROM gcms_m4.publication
 WHERE tenant_id=t AND kind='config' AND resource_id=t AND locale=l AND id=result->>'publicationId';
 IF style IS NOT NULL THEN result:=jsonb_set(result,'{content,signature,heroTypography}',style);END IF;
 RETURN result;
END $$;

-- New locale drafts have blank titles, so a copied title phrase cannot remain valid.
DO $copy$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('gcms_m4.blank_content(text,jsonb,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'FUNCTION gcms_m4.blank_content(','FUNCTION gcms_m4.blank_content_before_hero_typography(');
 EXECUTE definition;
END $copy$;

CREATE OR REPLACE FUNCTION gcms_m4.blank_content(k text,c jsonb,l text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE result jsonb;section jsonb;slide jsonb;sections jsonb:='[]';slides jsonb;
BEGIN
 result:=gcms_m4.blank_content_before_hero_typography(k,c,l);
 IF k NOT IN ('home','page','landing') THEN RETURN result;END IF;
 FOR section IN SELECT value FROM jsonb_array_elements(result->'sections') LOOP
  IF section->>'type'='hero_carousel' THEN
   slides:='[]';FOR slide IN SELECT value FROM jsonb_array_elements(section->'slides') LOOP slides:=slides||jsonb_build_array(slide-'highlight');END LOOP;
   section:=jsonb_set(section,'{slides}',slides);
  END IF;
  sections:=sections||jsonb_build_array(section);
 END LOOP;
 RETURN jsonb_set(result,'{sections}',sections);
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;
