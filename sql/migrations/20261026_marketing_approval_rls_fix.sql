-- La política original solo admitía draft/pending_approval también como
-- estado de destino, por lo que PostgREST rechazaba aprobar o pedir cambios.
-- La validación de transiciones y de administrador sigue en el trigger
-- crm_marketing_review_guard_trigger.
alter policy marketing_posts_update on public.crm_marketing_posts
  using (
    public.crm_has_module_permission(organization_id, 'marketing', 'edit')
    and status in ('draft','pending_approval','approved','changes_requested')
  )
  with check (
    public.crm_has_module_permission(organization_id, 'marketing', 'edit')
    and status in ('draft','pending_approval','approved','changes_requested')
  );
