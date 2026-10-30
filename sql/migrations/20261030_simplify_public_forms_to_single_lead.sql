-- Cada envío de landing genera una ficha de lead única; no crea entidades duplicadas.
CREATE OR REPLACE FUNCTION public.crm_receive_form(p_form_id uuid, p_request_id uuid, p_values jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_form public.crm_landing_forms%ROWTYPE;
  v_key text;
  v_name text;
  v_last_name text;
  v_phone text;
  v_email text;
  v_company_name text;
  v_message text;
  v_lead_id uuid;
  v_actor uuid;
  v_extra jsonb;
  v_answer text;
  v_extra_message text := '';
BEGIN
  IF p_form_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Falta el identificador del formulario o del envío.';
  END IF;
  SELECT * INTO v_form FROM public.crm_landing_forms
  WHERE id = p_form_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Formulario no disponible.'; END IF;

  -- Solo el servidor receptor o un administrador de esta empresa pueden llamar.
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF NOT COALESCE(public.is_active_user(), false) OR NOT COALESCE(public.is_admin(), false)
       OR NOT EXISTS (
         SELECT 1 FROM public.organization_members m
         JOIN public.organizations o ON o.id = m.organization_id
         WHERE m.organization_id = v_form.organization_id
           AND m.user_id = auth.uid() AND m.role = 'admin'
           AND m.active AND o.active
       ) THEN
      RAISE EXCEPTION 'No tienes permiso para recibir formularios de esta empresa.';
    END IF;
    v_actor := auth.uid();
  END IF;
  IF NOT v_form.active OR NOT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = v_form.organization_id AND active
  ) THEN RAISE EXCEPTION 'Formulario no disponible.'; END IF;

  IF p_values IS NULL OR jsonb_typeof(p_values) <> 'object'
     OR octet_length(p_values::text) > 20000 THEN
    RAISE EXCEPTION 'Los datos del formulario no son válidos.';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_values) LOOP
    IF NOT (v_key = ANY(v_form.fields)) THEN
      RAISE EXCEPTION 'El campo % no está habilitado.', v_key;
    END IF;
    IF jsonb_typeof(p_values -> v_key) NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'El campo % debe contener texto.', v_key;
    END IF;
  END LOOP;
  FOREACH v_key IN ARRAY v_form.required_fields LOOP
    IF COALESCE(btrim(p_values ->> v_key), '') = '' THEN
      RAISE EXCEPTION 'Completa el campo obligatorio: %.', v_key;
    END IF;
  END LOOP;

  v_name := btrim(p_values ->> 'first_name');
  v_last_name := NULLIF(btrim(p_values ->> 'last_name'), '');
  v_phone := NULLIF(btrim(p_values ->> 'phone'), '');
  v_email := lower(NULLIF(btrim(p_values ->> 'email'), ''));
  v_company_name := NULLIF(btrim(p_values ->> 'company_name'), '');
  v_message := NULLIF(btrim(p_values ->> 'message'), '');
  IF COALESCE(v_name, '') = '' OR length(v_name) > 150
     OR length(v_last_name) > 150 OR length(v_company_name) > 250
     OR length(v_phone) > 50 OR length(v_email) > 254
     OR length(v_message) > 5000 THEN
    RAISE EXCEPTION 'Revisa el nombre y la longitud de los campos.';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'El correo electrónico no es válido.';
  END IF;
  IF v_phone IS NOT NULL AND (
    v_phone !~ '^[+0-9 ().-]+$'
    OR length(regexp_replace(v_phone, '[^0-9]', '', 'g')) NOT BETWEEN 6 AND 15
  ) THEN RAISE EXCEPTION 'El teléfono no es válido.'; END IF;
  IF v_phone IS NULL AND v_email IS NULL THEN
    RAISE EXCEPTION 'Indica un teléfono o un correo.';
  END IF;

  
  -- custom-landing-fields-v1
  FOR v_extra IN SELECT value FROM jsonb_array_elements(v_form.custom_fields) LOOP
    IF NOT ((v_extra->>'key')=ANY(v_form.fields)) THEN CONTINUE; END IF;
    v_answer:=NULLIF(btrim(p_values->>(v_extra->>'key')),'');
    IF v_answer IS NULL THEN CONTINUE; END IF;
    IF length(v_answer)>(CASE WHEN v_extra->>'type'='textarea' THEN 2000 ELSE 250 END)
      OR (v_extra->>'type'='select' AND NOT ((v_extra->'options') ? v_answer)) THEN
      RAISE EXCEPTION 'Revisa el contenido del campo: %.',v_extra->>'label';
    END IF;
    v_extra_message:=v_extra_message || E'\n' || (v_extra->>'label') || ': ' || v_answer;
  END LOOP;
  IF length(v_extra_message)>12000 THEN RAISE EXCEPTION 'Las respuestas son demasiado largas.'; END IF;
  v_message:=NULLIF(concat_ws(E'\n',v_message,NULLIF(btrim(v_extra_message),'')),'');
  -- Serializa solo los reintentos del mismo envío; evita registros duplicados.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_form_id::text || ':' || p_request_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.crm_form_submissions
    WHERE form_id = p_form_id AND request_id = p_request_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', v_form.success_message, 'repeated', true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lead_sources
    WHERE id = v_form.source_id AND organization_id = v_form.organization_id AND active
  ) THEN
    RAISE EXCEPTION 'Configura un origen activo para el formulario.';
  END IF;

  -- Cada formulario crea una sola ficha de lead. La empresa queda como dato opcional de esa solicitud.
  INSERT INTO public.leads (
    organization_id, company_name, contact_name, phone, email, message,
    source_id, landing_identifier, status, assigned_to
  ) VALUES (
    v_form.organization_id, v_company_name,
    concat_ws(' ', v_name, v_last_name), v_phone, v_email,
    concat_ws(E'\n', 'Formulario: ' || v_form.name, v_message),
    v_form.source_id, v_form.name, 'new', v_actor
  ) RETURNING id INTO v_lead_id;

  INSERT INTO public.crm_form_submissions (
    organization_id, form_id, request_id, lead_id, submitted_values, field_snapshot
  ) VALUES (
    v_form.organization_id, p_form_id, p_request_id,
    v_lead_id, p_values, v_form.custom_fields
  );
  RETURN jsonb_build_object('success', true, 'message', v_form.success_message, 'repeated', false);
END;
$function$
