create table public.crm_marketing_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_name text not null check (char_length(btrim(client_name)) between 1 and 160),
  platform text not null check (platform in ('facebook','instagram','tiktok','youtube')),
  account_label text not null check (char_length(btrim(account_label)) between 1 and 160),
  account_handle text,
  connection_status text not null default 'not_connected' check (connection_status = 'not_connected'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_marketing_accounts_org_idx on public.crm_marketing_accounts(organization_id,client_name,platform);
alter table public.crm_marketing_accounts enable row level security;
create policy marketing_accounts_read on public.crm_marketing_accounts for select to authenticated
  using (public.crm_has_module_permission(organization_id,'marketing','view'::text));
create policy marketing_accounts_insert on public.crm_marketing_accounts for insert to authenticated
  with check (created_by = (select auth.uid()) and public.crm_has_module_permission(organization_id,'marketing','edit'::text));
create policy marketing_accounts_update on public.crm_marketing_accounts for update to authenticated
  using (public.crm_has_module_permission(organization_id,'marketing','edit'::text))
  with check (public.crm_has_module_permission(organization_id,'marketing','edit'::text) and connection_status = 'not_connected');
create policy marketing_accounts_delete on public.crm_marketing_accounts for delete to authenticated
  using (public.crm_has_module_permission(organization_id,'marketing','admin'::text));
grant select,insert,update,delete on public.crm_marketing_accounts to authenticated;

create table public.crm_marketing_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.crm_marketing_accounts(id) on delete set null,
  client_name text not null check (char_length(btrim(client_name)) between 1 and 160),
  platform text not null check (platform in ('facebook','instagram','tiktok','youtube')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  content text not null default '',
  media_url text,
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','pending_approval')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_marketing_posts_org_date_idx on public.crm_marketing_posts(organization_id,scheduled_at);
alter table public.crm_marketing_posts enable row level security;
create policy marketing_posts_read on public.crm_marketing_posts for select to authenticated
  using (public.crm_has_module_permission(organization_id,'marketing','view'::text));
create policy marketing_posts_insert on public.crm_marketing_posts for insert to authenticated
  with check (created_by = (select auth.uid()) and public.crm_has_module_permission(organization_id,'marketing','edit'::text));
create policy marketing_posts_update on public.crm_marketing_posts for update to authenticated
  using (public.crm_has_module_permission(organization_id,'marketing','edit'::text) and status in ('draft','pending_approval'))
  with check (public.crm_has_module_permission(organization_id,'marketing','edit'::text) and status in ('draft','pending_approval'));
create policy marketing_posts_delete on public.crm_marketing_posts for delete to authenticated
  using (public.crm_has_module_permission(organization_id,'marketing','edit'::text) and status = 'draft');
grant select,insert,update,delete on public.crm_marketing_posts to authenticated;
