-- Convierte una solicitud aceptada en cliente sin exigir contactos ni oportunidades.
create or replace function public.crm_accept_lead_as_client(
  p_org uuid,
  p_lead_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_company public.companies%rowtype;
  v_company_id uuid;
  v_name text;
  v_matches integer;
  v_created boolean := false;
begin
  if auth.uid() is null or p_org is null or p_lead_id is null then
    raise exception 'Debes iniciar sesión y seleccionar una empresa.';
  end if;

  if not public.crm_has_module_permission(p_org, 'leads', 'edit') then
    raise exception 'No tienes permisos para modificar leads.';
  end if;
  if not public.crm_has_module_permission(p_org, 'clients', 'edit') then
    raise exception 'No tienes permisos para crear o modificar clientes.';
  end if;

  select * into v_lead
    from public.leads
    where id = p_lead_id and organization_id = p_org
    for update;
  if not found then
    raise exception 'El lead no existe en la empresa seleccionada.';
  end if;
  if v_lead.status in ('discarded', 'spam') then
    raise exception 'Solo se pueden convertir en cliente las solicitudes activas.';
  end if;

  v_name := coalesce(
    nullif(btrim(v_lead.company_name), ''),
    nullif(btrim(v_lead.contact_name), ''),
    case when nullif(btrim(v_lead.phone), '') is not null then 'Cliente ' || btrim(v_lead.phone) end,
    case when nullif(btrim(v_lead.email), '') is not null then 'Cliente ' || btrim(v_lead.email) end
  );
  if v_name is null then
    raise exception 'Añade un nombre, teléfono o correo antes de aceptar la solicitud.';
  end if;

  v_company_id := coalesce(v_lead.converted_company_id, v_lead.company_id);
  if v_company_id is not null then
    select * into v_company
      from public.companies
      where id = v_company_id and organization_id = p_org
      for update;
    if not found then
      raise exception 'El cliente vinculado no pertenece a esta empresa.';
    end if;
    if v_lead.converted_company_id is not null and v_lead.converted_company_id <> v_company_id then
      raise exception 'Este lead ya fue convertido en otro cliente.';
    end if;
  else
    perform pg_advisory_xact_lock(hashtext(p_org::text || ':' || lower(v_name)));
    select count(*) into v_matches
      from public.companies
      where organization_id = p_org
        and (
          lower(btrim(name)) = lower(v_name)
          or (nullif(btrim(v_lead.email), '') is not null
              and lower(btrim(email)) = lower(btrim(v_lead.email)))
        );
    if v_matches > 1 then
      raise exception 'Hay varios posibles clientes duplicados; revisa Clientes antes de aceptar.';
    elsif v_matches = 1 then
      select * into v_company
        from public.companies
        where organization_id = p_org
          and (
            lower(btrim(name)) = lower(v_name)
            or (nullif(btrim(v_lead.email), '') is not null
                and lower(btrim(email)) = lower(btrim(v_lead.email)))
          )
        order by created_at
        limit 1
        for update;
      v_company_id := v_company.id;
    else
      insert into public.companies(organization_id, name, status, email, phone)
      values (p_org, v_name, 'activo', nullif(btrim(v_lead.email), ''), nullif(btrim(v_lead.phone), ''))
      returning id into v_company_id;
      v_created := true;
    end if;
  end if;

  if not v_created then
    update public.companies
      set status = 'activo',
          email = coalesce(email, nullif(btrim(v_lead.email), '')),
          phone = coalesce(phone, nullif(btrim(v_lead.phone), ''))
      where id = v_company_id and organization_id = p_org;
  end if;

  update public.leads
    set status = 'converted',
        converted_company_id = v_company_id,
        converted_at = coalesce(converted_at, now())
    where id = v_lead.id and organization_id = p_org;

  select * into v_company
    from public.companies
    where id = v_company_id and organization_id = p_org;

  return jsonb_build_object(
    'company_id', v_company_id,
    'name', v_company.name,
    'created', v_created
  );
end;
$$;

revoke all on function public.crm_accept_lead_as_client(uuid, uuid) from public, anon;
grant execute on function public.crm_accept_lead_as_client(uuid, uuid) to authenticated;
