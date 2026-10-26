-- Los borradores pueden eliminarlos los editores; los contenidos enviados
-- a revisión o revisados solamente un administrador de su empresa.
alter policy marketing_posts_delete on public.crm_marketing_posts
  using (
    public.crm_has_module_permission(organization_id, 'marketing', 'edit')
    and (
      status = 'draft'
      or public.crm_has_module_permission(organization_id, 'marketing', 'admin')
    )
  );
