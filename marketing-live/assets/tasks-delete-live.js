/* Gestión rápida de tareas sobre el CRM existente, sin sustituir su aplicación. */
(() => {
  const API = 'https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const SESSION = 'sb-kkyizztxlvjqbplcnhtx-auth-token';
  let running = false;

  function auth() {
    let value;
    try { value = JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch { value = null; }
    if (!value?.access_token || value.expires_at * 1000 <= Date.now()) throw Error('La sesión ha caducado. Vuelve a iniciar sesión.');
    return value;
  }
  async function request(path, options = {}) {
    const result = await fetch(API + path, {
      method: options.method || 'GET',
      headers: { apikey: KEY, Authorization: 'Bearer ' + auth().access_token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });
    const raw = await result.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!result.ok) throw Error(data?.message || `Error ${result.status} al consultar las tareas.`);
    return data;
  }
  function element(tag, label, cls) {
    const node = document.createElement(tag);
    if (label) node.textContent = label;
    if (cls) node.className = cls;
    return node;
  }
  function showManager(heading) {
    if (document.getElementById('crm-tasks-delete-dialog')) return;
    const overlay = element('div', '', 'crm-tasks-delete-overlay');
    overlay.id = 'crm-tasks-delete-dialog';
    overlay.innerHTML = `<section class="crm-tasks-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-tasks-delete-title">
      <div class="crm-tasks-delete-header"><h2 id="crm-tasks-delete-title">Gestión rápida de tareas</h2><button type="button" class="crm-tasks-close" aria-label="Cerrar">×</button></div>
      <p>Consulta pendientes, vencidas y completadas. Puedes completar tareas sin abrir el formulario y eliminar registros con confirmación.</p>
      <label>Empresa <select id="crm-tasks-org"></select></label>
      <div id="crm-tasks-summary" class="crm-tasks-summary"></div>
      <div class="crm-tasks-filters">
        <label>Vista <select id="crm-tasks-view"><option value="pending">Pendientes</option><option value="overdue">Vencidas</option><option value="completed">Completadas</option><option value="all">Todas</option></select></label>
        <label>Buscar <input id="crm-tasks-search" type="search" placeholder="Título o cliente…"></label>
        <label>Cliente <select id="crm-tasks-client"><option value="all">Todos</option></select></label>
        <label>Prioridad <select id="crm-tasks-priority"><option value="all">Todas</option><option value="urgent">Urgente</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baja</option></select></label>
        <label>Responsable <select id="crm-tasks-owner"><option value="all">Todos</option><option value="mine">Mis tareas</option></select></label>
        <label>Desde <input id="crm-tasks-from" type="date"></label>
        <label>Hasta <input id="crm-tasks-to" type="date"></label>
      </div>
      <div id="crm-tasks-delete-notice" role="status" aria-live="polite"></div>
      <div id="crm-tasks-delete-list"></div>
      <div class="crm-tasks-delete-footer"><button type="button" class="crm-tasks-done">Cerrar y actualizar CRM</button></div>
    </section>`;
    document.body.append(overlay);
    const get = id => overlay.querySelector('#' + id);
    const org = get('crm-tasks-org'), search = get('crm-tasks-search');
    const view = get('crm-tasks-view'), client = get('crm-tasks-client');
    const priority = get('crm-tasks-priority'), owner = get('crm-tasks-owner');
    const from = get('crm-tasks-from'), to = get('crm-tasks-to');
    const list = get('crm-tasks-delete-list'), notice = get('crm-tasks-delete-notice');
    let records = [];
    let busy = false;
    let canEdit = false;
    let canDelete = false;
    const close = () => { overlay.remove(); location.reload(); };
    overlay.querySelector('.crm-tasks-close').onclick = close;
    overlay.querySelector('.crm-tasks-done').onclick = close;
    const setNotice = (message, bad = false) => { notice.textContent = message; notice.style.color = bad ? '#b42318' : '#26645c'; };
    const dayKey = date => {
      const d = new Date(date);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    const isPending = task => task.status === 'pending' || task.status === 'in_progress';
    const overdue = task => isPending(task) && task.due_date && dayKey(task.due_date) < dayKey(new Date());
    function filters() {
      const term = search.value.toLocaleLowerCase('es').trim();
      return records.filter(task => {
        if (view.value === 'pending' && !isPending(task)) return false;
        if (view.value === 'overdue' && !overdue(task)) return false;
        if (view.value === 'completed' && task.status !== 'completed') return false;
        if (client.value !== 'all' && (task.company_id || '') !== client.value) return false;
        if (priority.value !== 'all' && task.priority !== priority.value) return false;
        if (owner.value === 'mine' && task.assigned_to !== auth().user.id) return false;
        const due = task.due_date ? dayKey(task.due_date) : '';
        if (from.value && (!due || due < from.value)) return false;
        if (to.value && (!due || due > to.value)) return false;
        return ((task.title || '') + ' ' + (task.companies?.name || '')).toLocaleLowerCase('es').includes(term);
      });
    }
    function render() {
      list.replaceChildren();
      const filtered = filters();
      get('crm-tasks-summary').replaceChildren();
      const counts = [
        ['Pendientes', records.filter(isPending).length, 'pending'],
        ['Vencidas', records.filter(overdue).length, 'overdue'],
        ['Completadas', records.filter(task => task.status === 'completed').length, 'completed'],
        ['Total', records.length, 'all']
      ];
      for (const [name, count, value] of counts) {
        const item = element('button', '', 'crm-task-count' + (view.value === value ? ' selected' : ''));
        item.type = 'button'; item.append(element('strong', String(count)), element('span', name));
        item.onclick = () => { view.value = value; render(); };
        get('crm-tasks-summary').append(item);
      }
      if (!filtered.length) { list.append(element('p', 'No hay tareas que coincidan.', 'crm-tasks-empty')); return; }
      for (const task of filtered) {
        const row = element('div', '', 'crm-tasks-delete-row');
        const info = element('div');
        info.append(element('strong', task.title || 'Sin título'));
        const state = ({pending:'Pendiente',in_progress:'En curso',completed:'Completada',cancelled:'Cancelada'})[task.status] || task.status;
        const due = task.due_date ? new Date(task.due_date).toLocaleString('es-ES', {dateStyle:'short',timeStyle:'short'}) : 'Sin vencimiento';
        const priorityLabel = ({urgent:'Urgente',high:'Alta',normal:'Normal',low:'Baja'})[task.priority] || task.priority || 'Normal';
        info.append(element('small', `${task.companies?.name || 'Sin cliente'} · ${state} · ${priorityLabel} · ${due}${overdue(task) ? ' · VENCIDA' : ''}`));
        const buttons = element('div', '', 'crm-tasks-actions');
        if (canEdit && task.status !== 'cancelled') {
          const complete = element('button', task.status === 'completed' ? 'Reabrir' : 'Completar', 'crm-tasks-primary');
          complete.type = 'button'; complete.disabled = busy;
          complete.onclick = async () => {
            if (busy) return;
            busy = true; complete.disabled = true; setNotice('Guardando estado…');
            const done = task.status !== 'completed';
            try {
              const updated = await request(`tasks?id=eq.${encodeURIComponent(task.id)}&organization_id=eq.${encodeURIComponent(org.value)}&select=id,status`, {method:'PATCH',body:{status:done?'completed':'pending',completed_at:done?new Date().toISOString():null}});
              if (!Array.isArray(updated) || updated.length !== 1 || updated[0].id !== task.id) throw Error('El cambio no se ha confirmado. Comprueba tus permisos.');
              task.status = updated[0].status;
              setNotice(done ? 'Tarea completada.' : 'Tarea reabierta.');
            } catch (error) { setNotice(error.message, true); }
            finally { busy = false; render(); }
          };
          buttons.append(complete);
        }
        if (canDelete) {
          const button = element('button', 'Eliminar', 'crm-tasks-danger');
          button.type = 'button'; button.disabled = busy;
          button.onclick = async () => {
            if (busy || !confirm(`¿Eliminar definitivamente la tarea «${task.title}»? Esta acción no se puede deshacer.`)) return;
            busy = true; button.disabled = true; setNotice('Eliminando tarea…');
            try {
              const deleted = await request(`tasks?id=eq.${encodeURIComponent(task.id)}&organization_id=eq.${encodeURIComponent(org.value)}&select=id`, {method:'DELETE'});
              if (!Array.isArray(deleted) || deleted.length !== 1 || deleted[0].id !== task.id) throw Error('No se ha confirmado el borrado. Comprueba los permisos de administrador.');
              records = records.filter(item => item.id !== task.id);
              setNotice('Tarea eliminada correctamente.');
            } catch (error) { setNotice(error.message, true); }
            finally { busy = false; render(); }
          };
          buttons.append(button);
        }
        row.append(info, buttons); list.append(row);
      }
    }
    async function load() {
      setNotice('Cargando tareas…'); list.replaceChildren();
      try {
        const allowed = await request('rpc/crm_has_module_permission', {method:'POST',body:{p_org:org.value,p_module:'tasks',p_action:'view'}});
        if (allowed !== true) throw Error('No tienes acceso a las tareas de esta empresa.');
        [canEdit, canDelete] = await Promise.all([
          request('rpc/crm_has_module_permission', {method:'POST',body:{p_org:org.value,p_module:'tasks',p_action:'edit'}}),
          request('rpc/crm_can_delete_record', {method:'POST',body:{p_org:org.value,p_module:'tasks'}})
        ]);
        records = await request(`tasks?select=id,title,status,priority,due_date,company_id,assigned_to,organization_id,companies(name)&organization_id=eq.${encodeURIComponent(org.value)}&order=created_at.desc&limit=1000`);
        client.replaceChildren(); const all = element('option', 'Todos'); all.value = 'all'; client.append(all);
        const clients = new Map(records.filter(task => task.company_id).map(task => [task.company_id,task.companies?.name || 'Cliente']));
        for (const [id,name] of [...clients].sort((a,b)=>a[1].localeCompare(b[1],'es'))) {
          const option = element('option', name); option.value = id; client.append(option);
        }
        setNotice(`${records.length} tareas cargadas. Usa los filtros para encontrar las que necesitas.`);
        render();
      } catch (error) { records = []; setNotice(error.message, true); render(); }
    }
    org.onchange = load;
    for (const filter of [view,client,priority,owner,from,to]) filter.onchange = render;
    search.oninput = render;
    (async () => {
      try {
        const organizations = await request('organizations?select=id,name&active=eq.true&order=name');
        if (!organizations.length) throw Error('No hay empresas activas.');
        const headingText = heading.querySelector('.dashboard-kicker')?.textContent || '';
        for (const item of organizations) { const option = element('option', item.name); option.value = item.id; org.append(option); }
        const activeOrg = document.getElementById('active-organization')?.value;
        const selected = organizations.find(item => item.id === activeOrg) || organizations.find(item => headingText.includes(item.name));
        if (selected) org.value = selected.id;
        if (organizations.some(item => item.id === activeOrg)) org.closest('label').style.display = 'none';
        await load();
      } catch (error) { setNotice(error.message, true); }
    })();
  }
  function install() {
    if (running) return;
    running = true;
    try {
      for (const heading of document.querySelectorAll('.dashboard-heading')) {
        if (heading.querySelector('h1')?.textContent?.trim() !== 'Tareas') continue;
        heading.classList.add('crm-tasks-heading');
        if (heading.querySelector('.crm-tasks-manage-button')) return;
        const button = element('button', 'Gestionar tareas', 'crm-tasks-manage-button');
        button.type = 'button';
        button.onclick = () => showManager(heading);
        heading.append(button);
      }
    } finally { running = false; }
  }
  const css = document.createElement('style');
  css.textContent = `.dashboard-heading.crm-tasks-heading{justify-content:flex-start;gap:10px;flex-wrap:wrap}
  .dashboard-heading.crm-tasks-heading>div:first-child{margin-right:auto}
  .crm-tasks-manage-button{padding:11px 16px;border:1px solid #d0d7e2;border-radius:10px;background:#fff;color:#142c48;font-weight:700;cursor:pointer}
  .crm-tasks-delete-overlay{position:fixed;inset:0;z-index:99999;background:rgba(14,28,48,.65);display:grid;place-items:center;padding:16px}
  .crm-tasks-delete-dialog{box-sizing:border-box;background:white;color:#192c3f;width:min(900px,100%);max-height:88vh;overflow:auto;border-radius:16px;padding:24px;box-shadow:0 20px 60px #142c483b}
  .crm-tasks-delete-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.crm-tasks-delete-header h2{margin:0}
  .crm-tasks-close{font-size:30px;background:transparent;border:0;cursor:pointer}.crm-tasks-delete-dialog label{display:block;margin:14px 0;font-weight:650}
  .crm-tasks-delete-dialog label input,.crm-tasks-delete-dialog label select{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid #bcc8d3;border-radius:8px}
  .crm-tasks-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0 12px}
  .crm-tasks-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
  .crm-task-count{padding:12px 5px;border:1px solid #d9e3ea;border-radius:9px;background:#f8fafc;cursor:pointer}
  .crm-task-count.selected{background:#e5f5f1;border-color:#087f74}.crm-task-count strong,.crm-task-count span{display:block}
  .crm-task-count strong{font-size:24px;color:#142c48}.crm-task-count span{font-size:12px;color:#64748b}
  #crm-tasks-delete-notice{margin:14px 0;font-size:14px}.crm-tasks-delete-row{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #e3e8ed;padding:12px 0;gap:12px}
  .crm-tasks-delete-row strong,.crm-tasks-delete-row small{display:block}.crm-tasks-delete-row small{margin-top:5px;color:#64748b}
  .crm-tasks-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
  .crm-tasks-primary{border:1px solid #087f74;border-radius:8px;color:#087f74;background:#fff;padding:8px 13px;cursor:pointer}
  .crm-tasks-danger{border:1px solid #dc8a82;border-radius:8px;color:#b42318;background:#fff;padding:8px 13px;cursor:pointer}
  .crm-tasks-danger:disabled{opacity:.5}.crm-tasks-delete-footer{text-align:right;padding-top:16px}.crm-tasks-done{padding:10px 14px;background:#087f74;color:white;border:0;border-radius:8px;cursor:pointer}`;
  document.head.append(css);
  new MutationObserver(install).observe(document.body, {childList:true,subtree:true});
  install();
})();
