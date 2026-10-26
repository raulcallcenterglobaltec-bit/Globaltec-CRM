-- Revisión de contenidos: aprobar o solicitar cambios solo por responsables admin.
alter table public.crm_marketing_posts
  drop constraint crm_marketing_posts_status_check;
alter table public.crm_marketing_posts
  add constraint crm_marketing_posts_status_check
  check (status in ('draft', 'pending_approval', 'approved', 'changes_requested'));
alter table public.crm_marketing_posts
  add column review_note text not null default '',
  add column reviewed_by uuid references auth.users(id),
  add column reviewed_at timestamptz;

create or replace function public.crm_marketing_review_guard()
returns trigger
language plpgsql security invoker
set search_path = 'pg_catalog'
as $$
declare
  is_reviewer boolean;
begin
  is_reviewer := public.crm_has_module_permission(new.organization_id, 'marketing', 'admin');
  if tg_op = 'INSERT' then
    if new.status not in ('draft','pending_approval') then
      raise exception 'Los contenidos nuevos deben quedar en borrador o pendientes.' using errcode='42501';
    end if;
    new.review_note := '';
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    if old.status in ('approved','changes_requested') and not is_reviewer
       and new.status not in ('draft','pending_approval') then
      raise exception 'Los contenidos revisados requieren nueva solicitud para modificarse.' using errcode='42501';
    end if;
    if new.status in ('approved','changes_requested') then
      if old.status = 'approved' and new.status = 'approved'
         and (new.client_name,new.platform,new.title,new.content,new.media_url,new.scheduled_at,new.account_id)
         is distinct from (old.client_name,old.platform,old.title,old.content,old.media_url,old.scheduled_at,old.account_id) then
        raise exception 'Devuelve el contenido a borrador antes de cambiar uno ya aprobado.' using errcode='P0001';
      end if;
      if not is_reviewer then
        raise exception 'Solo un administrador puede aprobar o pedir cambios.' using errcode='42501';
      end if;
      if old.status <> 'pending_approval' and new.status <> old.status then
        raise exception 'Primero debes enviar el contenido para revisión.' using errcode='P0001';
      end if;
      if new.status = 'changes_requested' and char_length(btrim(new.review_note)) < 1 then
        raise exception 'Indica qué cambios hay que realizar.' using errcode='P0001';
      end if;
      if new.status <> old.status then
        new.reviewed_by := auth.uid();
        new.reviewed_at := now();
      elsif not is_reviewer and (new.review_note, new.reviewed_by, new.reviewed_at)
         is distinct from (old.review_note, old.reviewed_by, old.reviewed_at) then
        raise exception 'No tienes permiso para alterar la revisión.' using errcode='42501';
      end if;
    else
      new.reviewed_by := null;
      new.reviewed_at := null;
      if new.status <> 'changes_requested' then new.review_note := ''; end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.crm_marketing_review_guard() from public, anon, authenticated;
drop trigger if exists crm_marketing_review_guard_trigger on public.crm_marketing_posts;
create trigger crm_marketing_review_guard_trigger
  before insert or update on public.crm_marketing_posts
  for each row execute function public.crm_marketing_review_guard();
