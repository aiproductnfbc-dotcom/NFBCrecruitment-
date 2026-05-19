-- Fix audit_trigger_fn: it tried to access OLD.stage_id on every table,
-- but stage_id only exists on the applications table. This caused updates
-- on jobs (and any other audited table without stage_id) to fail.

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_action      text;
  v_before      jsonb := NULL;
  v_after       jsonb := NULL;
  v_entity_id   uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action    := 'create';
    v_after     := to_jsonb(NEW);
    v_entity_id := NEW.id;

  ELSIF TG_OP = 'UPDATE' THEN
    v_before    := to_jsonb(OLD);
    v_after     := to_jsonb(NEW);
    v_entity_id := NEW.id;
    -- Only check stage_id on the applications table
    IF TG_TABLE_NAME = 'applications'
       AND v_before->>'stage_id' IS DISTINCT FROM v_after->>'stage_id' THEN
      v_action := 'stage_change';
    ELSE
      v_action := 'update';
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action    := 'delete';
    v_before    := to_jsonb(OLD);
    v_entity_id := OLD.id;
  END IF;

  INSERT INTO public.audit_logs
    (actor_id, action, entity_type, entity_id, before_json, after_json)
  VALUES
    (auth.uid(), v_action, TG_TABLE_NAME, v_entity_id, v_before, v_after);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
