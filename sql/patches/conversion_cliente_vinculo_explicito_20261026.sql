-- Refuerzo de la conversión comercial: solo vincular clientes existentes cuando se elijan expresamente.
-- Reemplaza la misma firma RPC, mantiene SECURITY INVOKER y las políticas RLS.
-- SECURITY INVOKER: la función nunca omite los permisos del usuario.
create or replace function public.crm_convert_to_client(
  p_org uuid,
  p_source text,
  p_source_id uuid,
  p_company_name text,
  p_existing_company_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_opp public.opportunities%rowtype;
  v_contact public.contacts%rowtype;
  v_company public.companies%rowtype;
  v_company_id uuid;
  v_contact_id uuid;
  v_name text;
  v_email text;
  v_phone text;
  v_matches int;
  v_won_stage uuid;
  v_lead_id uuid;
  v_has_opportunity boolean := false;
  v_has_lead boolean := false;
  v_created boolean := false;
begin
  if auth.uid() is null or p_org is null or p_source_id is null then
    raise exception 'Debes iniciar sesión y seleccionar una empresa.';
  end if;
  if p_source not in ('lead','opportunity') then
    raise exception 'Origen comercial no válido.';
  end if;
  if not public.crm_has_module_permission(p_org,'clients','edit') then
    raise exception 'No tienes permisos para crear o modificar clientes.';
  end if;
  if not public.crm_has_module_permission(p_org,case when p_source='lead' then 'leads' else 'opportunities' end,'edit') then
    raise exception 'No tienes permisos de edición sobre el registro comercial.';
  end if;

  if p_source='lead' then
    select * into v_lead from public.leads where id=p_source_id and organization_id=p_org for update;
    if not found then raise exception 'El lead no existe en la empresa seleccionada.'; end if;
    v_has_lead := true;
    v_lead_id := v_lead.id;
  else
    select * into v_opp from public.opportunities where id=p_source_id and organization_id=p_org for update;
    if not found then raise exception 'La oportunidad no existe en la empresa seleccionada.'; end if;
    v_has_opportunity := true;
    v_lead_id := v_opp.lead_id;
    if v_lead_id is not null then
      select * into v_lead from public.leads where id=v_lead_id and organization_id=p_org for update;
      if not found then raise exception 'El lead asociado no pertenece a esta empresa.'; end if;
      v_has_lead := true;
      if not public.crm_has_module_permission(p_org,'leads','edit') then
        raise exception 'Necesitas permiso de edición sobre el lead asociado.';
      end if;
    end if;
  end if;

  v_contact_id := case when v_has_opportunity then coalesce(v_opp.contact_id,case when v_has_lead then v_lead.contact_id end) else v_lead.contact_id end;
  if v_contact_id is not null then
    select * into v_contact from public.contacts where id=v_contact_id and organization_id=p_org;
    if not found then raise exception 'El contacto pertenece a otra empresa o no está disponible.'; end if;
  end if;
  v_name := coalesce(nullif(btrim(p_company_name),''),
    case when v_has_lead then nullif(btrim(v_lead.company_name),'') end,
    case when v_contact_id is not null then nullif(btrim(concat_ws(' ',v_contact.first_name,v_contact.last_name)),'') end);
  v_email := coalesce(case when v_has_lead then nullif(btrim(v_lead.email),'') end,case when v_contact_id is not null then nullif(btrim(v_contact.email),'') end);
  v_phone := coalesce(case when v_has_lead then nullif(btrim(v_lead.phone),'') end,case when v_contact_id is not null then nullif(btrim(v_contact.phone),'') end);

  -- Un nombre normalizado por empresa se serializa para evitar dobles altas simultáneas.
  if v_name is not null then perform pg_advisory_xact_lock(hashtext(p_org::text||':'||lower(v_name))); end if;
  -- Crear una ficha nueva nunca reutiliza automáticamente un cliente ya vinculado.
  v_company_id := p_existing_company_id;
  if p_source='lead' and v_lead.converted_company_id is not null then
    raise exception 'Este lead ya fue convertido. Abre la ficha del cliente existente.';
  end if;
  if v_company_id is null then
    if v_has_opportunity and v_opp.company_id is not null
       or v_has_lead and v_lead.company_id is not null
       or v_has_lead and v_lead.converted_company_id is not null
       or v_contact_id is not null and v_contact.company_id is not null then
      raise exception 'El registro ya está vinculado a un cliente. Selecciona expresamente ese cliente existente.';
    end if;
  end if;
  if v_company_id is not null then
    select * into v_company from public.companies where id=v_company_id and organization_id=p_org for update;
    if not found then raise exception 'El cliente seleccionado no pertenece a esta empresa.'; end if;
    if v_has_lead and v_lead.converted_company_id is not null and v_lead.converted_company_id<>v_company_id then
      raise exception 'Este lead ya fue convertido en otro cliente.';
    end if;
    if v_has_opportunity and v_opp.company_id is not null and v_opp.company_id<>v_company_id then
      raise exception 'La oportunidad ya está vinculada a otro cliente.';
    end if;
    if v_has_lead and v_lead.company_id is not null and v_lead.company_id<>v_company_id then
      raise exception 'El lead está vinculado a otro cliente.';
    end if;
    if v_contact_id is not null and v_contact.company_id is not null and v_contact.company_id<>v_company_id then
      raise exception 'El contacto pertenece a otro cliente. No se pueden unir fichas sin revisar la relación.';
    end if;
  else
    if v_name is null then raise exception 'Indica el nombre del nuevo cliente.'; end if;
    select count(*) into v_matches from public.companies
      where organization_id=p_org and
      (lower(btrim(name))=lower(v_name) or (v_email is not null and lower(btrim(email))=lower(v_email)));
    if v_matches>0 then
      raise exception 'Ya existe un cliente con ese nombre o correo. Comprueba la coincidencia y elige Vincular a cliente existente si corresponde.';
    end if;
    insert into public.companies(organization_id,name,status,email,phone)
      values(p_org,v_name,'activo',v_email,v_phone) returning id into v_company_id;
    v_created:=true;
  end if;

  -- Convertir no modifica automáticamente el estado administrativo de clientes existentes.
  if v_contact_id is null and v_has_lead and (nullif(btrim(v_lead.contact_name),'') is not null or v_email is not null) then
    if not public.crm_has_module_permission(p_org,'contacts','edit') then
      raise exception 'Necesitas permiso para vincular un contacto nuevo.';
    end if;
    if v_email is not null and exists(
      select 1 from public.contacts
      where organization_id=p_org and lower(btrim(email))=lower(v_email)
    ) then
      raise exception 'Ya existe un contacto con ese correo. Vincúlalo de forma explícita antes de convertir.';
    end if;
    if v_contact_id is null then
      insert into public.contacts(organization_id,company_id,first_name,email,phone)
        values(p_org,v_company_id,coalesce(nullif(btrim(v_lead.contact_name),''),v_name),v_email,v_phone)
        returning id into v_contact_id;
    end if;
  end if;
  if v_contact_id is not null and v_contact.company_id is null then
    if not public.crm_has_module_permission(p_org,'contacts','edit') then
      raise exception 'Necesitas permiso para asociar el contacto al cliente.';
    end if;
    update public.contacts set company_id=v_company_id where id=v_contact_id and organization_id=p_org and company_id is null;
  end if;
  if v_has_lead then
    update public.leads set status='converted',converted_company_id=v_company_id,
      converted_contact_id=coalesce(v_contact_id,converted_contact_id),
      converted_opportunity_id=coalesce(case when v_has_opportunity then v_opp.id end,converted_opportunity_id),
      converted_at=coalesce(converted_at,now())
      where id=v_lead.id and organization_id=p_org;
  end if;
  if v_has_opportunity then
    select id into v_won_stage from public.pipeline_stages where organization_id=p_org and is_won=true order by position limit 1;
    update public.opportunities set company_id=v_company_id,
      contact_id=coalesce(contact_id,v_contact_id),stage_id=coalesce(v_won_stage,stage_id)
      where id=v_opp.id and organization_id=p_org;
  elsif v_has_lead and exists(select 1 from public.opportunities where organization_id=p_org and lead_id=v_lead.id and company_id is null) then
    if not public.crm_has_module_permission(p_org,'opportunities','edit') then
      raise exception 'Necesitas permiso para conservar el vínculo con la oportunidad.';
    end if;
    update public.opportunities set company_id=v_company_id
      where organization_id=p_org and lead_id=v_lead.id and company_id is null;
  end if;
  return jsonb_build_object('company_id',v_company_id,'contact_id',v_contact_id,'created',v_created,'name',coalesce(v_company.name,v_name));
end;
$$;

revoke all on function public.crm_convert_to_client(uuid,text,uuid,text,uuid) from public,anon;
grant execute on function public.crm_convert_to_client(uuid,text,uuid,text,uuid) to authenticated;
