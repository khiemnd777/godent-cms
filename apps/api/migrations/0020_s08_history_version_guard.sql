-- Independent review: direct tenant SQL cannot bypass content history with same-version writes.
CREATE OR REPLACE FUNCTION gcms_s08.capture_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE resource_kind text;resource_key text;document jsonb;source_key text:=nullif(current_setting('gcms.restore_from',true),'');actor_label text;
BEGIN
 resource_kind:=CASE WHEN TG_TABLE_NAME='service_draft' THEN 'service' ELSE 'site' END;
 IF resource_kind='service' THEN
   resource_key:=NEW.id;document:=gcms_s08.service_content(NEW);
   INSERT INTO gcms_s08.publication_head(tenant_id,service_id) VALUES(NEW.tenant_id,NEW.id) ON CONFLICT DO NOTHING;
 ELSE resource_key:=NEW.tenant_id;document:=jsonb_build_object('name',NEW.name,'footer',jsonb_build_object('intro',NEW.footer_intro,'body',NEW.footer_body)); END IF;
 IF TG_OP='UPDATE' THEN
   IF NEW.version<>OLD.version AND NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Draft version sequence conflict' USING ERRCODE='23514'; END IF;
   IF NEW.version=OLD.version THEN
     IF resource_kind='service' THEN
       IF document IS DISTINCT FROM gcms_s08.service_content(OLD) THEN RAISE EXCEPTION 'Content change requires next draft version' USING ERRCODE='23514'; END IF;
     ELSE
       IF document IS DISTINCT FROM jsonb_build_object('name',OLD.name,'footer',jsonb_build_object('intro',OLD.footer_intro,'body',OLD.footer_body))
         THEN RAISE EXCEPTION 'Content change requires next draft version' USING ERRCODE='23514'; END IF;
     END IF;
     RETURN NEW;
   END IF;
 END IF;
 IF source_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM gcms_s08.editorial_revision h WHERE h.tenant_id=NEW.tenant_id AND h.resource=resource_kind AND h.resource_id=resource_key AND h.id=source_key)
   THEN RAISE EXCEPTION 'Restoration source conflict' USING ERRCODE='23514'; END IF;
 SELECT name INTO actor_label FROM gcms_s02_auth."user" WHERE id=NEW.updated_by;
 INSERT INTO gcms_s08.editorial_revision(tenant_id,resource,resource_id,version,kind,content,actor_id,actor_name,restored_from)
 VALUES(NEW.tenant_id,resource_kind,resource_key,NEW.version,CASE WHEN source_key IS NOT NULL THEN 'restored' WHEN TG_OP='INSERT' THEN 'created' ELSE 'saved' END,
   document,NEW.updated_by,actor_label,source_key);
 RETURN NEW;
END $$;
