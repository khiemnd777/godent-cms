-- Forward-only D02 mailbox syntax repair. No DNS/delivery/EAI validation claim.
CREATE FUNCTION gcms_s04.valid_email(v text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE local_part text; domain_part text; label text;
BEGIN
  IF v IS NULL OR length(v)>254 OR v<>lower(v) OR length(v)-length(replace(v,'@',''))<>1 THEN RETURN false; END IF;
  local_part:=split_part(v,'@',1); domain_part:=split_part(v,'@',2);
  IF length(local_part) NOT BETWEEN 1 AND 64 OR local_part !~ '^[a-z0-9!#$%&''*+/=?^_`{|}~-]+([.][a-z0-9!#$%&''*+/=?^_`{|}~-]+)*$' OR
    cardinality(string_to_array(domain_part,'.'))<2 THEN RETURN false; END IF;
  FOREACH label IN ARRAY string_to_array(domain_part,'.') LOOP
    IF length(label) NOT BETWEEN 1 AND 63 OR label !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION gcms_s04.valid_email(text) FROM PUBLIC;
ALTER TABLE gcms_s04.lead ADD CONSTRAINT lead_email_syntax CHECK(email IS NULL OR gcms_s04.valid_email(email));

CREATE OR REPLACE FUNCTION gcms_s04.valid_payload(p jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE k text; v text;
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR NOT(p ?& ARRAY['sourcePublicationId','preferredLanguage','preferredChannel','consent']) OR
    (p-ARRAY['sourcePublicationId','name','phone','email','preferredLanguage','preferredChannel','message','consent','interestServiceSlug'])<>'{}'::jsonb OR
    jsonb_typeof(p->'sourcePublicationId') IS DISTINCT FROM 'string' OR p->>'sourcePublicationId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR
    jsonb_typeof(p->'preferredLanguage') IS DISTINCT FROM 'string' OR p->>'preferredLanguage' NOT IN ('vi','en') OR
    jsonb_typeof(p->'preferredChannel') IS DISTINCT FROM 'string' OR p->>'preferredChannel' NOT IN ('phone','email') OR
    p->'consent' IS DISTINCT FROM 'true'::jsonb THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['name','phone','email','message','interestServiceSlug'] LOOP
    IF p ? k THEN
      IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
      v:=p->>k;
      IF length(v)=0 OR v<>btrim(v) OR normalize(v,NFC)<>v OR v ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' THEN RETURN false; END IF;
    END IF;
  END LOOP;
  IF coalesce(length(p->>'name'),0)>120 OR coalesce(length(p->>'message'),0)>500 OR coalesce(length(p->>'email'),0)>254 OR
    (p ? 'phone' AND p->>'phone' !~ '^[0-9]{7,15}$') OR
    (p ? 'email' AND NOT gcms_s04.valid_email(p->>'email')) OR
    (p ? 'interestServiceSlug' AND NOT gcms_s02.valid_slug(p->>'interestServiceSlug')) OR
    NOT(p ? 'phone' OR p ? 'email') OR (p->>'preferredChannel'='phone' AND NOT(p ? 'phone')) OR
    (p->>'preferredChannel'='email' AND NOT(p ? 'email')) THEN RETURN false; END IF;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
