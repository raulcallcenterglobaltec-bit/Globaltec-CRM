alter table public.crm_marketing_accounts
  add constraint crm_marketing_accounts_org_id_id_unique unique (organization_id,id);
alter table public.crm_marketing_posts
  drop constraint crm_marketing_posts_account_id_fkey;
alter table public.crm_marketing_posts
  add constraint crm_marketing_posts_same_org_account
  foreign key (organization_id,account_id)
  references public.crm_marketing_accounts(organization_id,id)
  on delete set null (account_id);
create or replace function public.crm_marketing_guard_ownership()
returns trigger language plpgsql set search_path = 'pg_catalog' as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.created_by is distinct from old.created_by then
    raise exception 'No se puede cambiar la empresa ni el autor original';
  end if;
  return new;
end;
$$;
create trigger crm_marketing_accounts_guard
  before update on public.crm_marketing_accounts
  for each row execute function public.crm_marketing_guard_ownership();
create trigger crm_marketing_posts_guard
  before update on public.crm_marketing_posts
  for each row execute function public.crm_marketing_guard_ownership();
