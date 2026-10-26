/* Borrado seguro de tareas para el CRM existente, sin sustituir su aplicación. */
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
      <div class="crm-tasks-delete-header"><h2 id="crm-tasks-delete-title">Eliminar tareas</h2><button type="button" class="crm-tasks-close" aria-label="Cerrar">×</button></div>
      <p>Selecciona una empresa y elimina solo las tareas que ya no necesitas. Cada borrado requiere confirmación.</p>
      <label>Empresa <select id="crm-tasks-org"></select></label>
      <label>Buscar <input id="crm-tasks-search" type="search" placeholder="Nombre de la tarea…"></label>
      <div id="crm-tasks-delete-notice" role="status" aria-live="polite"></div>
      <div id="crm-tasks-delete-list"></div>
      <div class="crm-tasks-delete-footer"><button type="button" class="crm-tasks-done">Cerrar y actualizar CRM</button></div>
    </section>`;
    document.body.append(overlay);
    const get = id => overlay.querySelector('#' + id);
    const org = get('crm-tasks-org'), search = get('crm-tasks-search');
    const list = get('crm-tasks-delete-list'), notice = get('crm-tasks-delete-notice');
    let records = [];
    let busy = false;
    const close = () => { overlay.remove(); location.reload(); };
    overlay.querySelector('.crm-tasks-close').onclick = close;
    overlay.querySelector('.crm-tasks-done').onclick = close;
    const setNotice = (message, bad = false) => { notice.textContent = message; notice.style.color = bad ? '#b42318' : '#26645c'; };
    function render() {
      list.replaceChildren();
      const term = search.value.toLocaleLowerCase('es').trim();
      const filtered = records.filter(task => (task.title || '').toLocaleLowerCase('es').includes(term));
      if (!filtered.length) { list.append(element('p', 'No hay tareas que coincidan.', 'crm-tasks-empty')); return; }
      for (const task of filtered) {
        const row = element('div', '', 'crm-tasks-delete-row');
        const info = element('div');
        info.append(element('strong', task.title || 'Sin título'));
        info.append(element('small', ({pending:'Pendiente',in_progress:'En curso',completed:'Completada',cancelled:'Cancelada'})[task.status] || task.status));
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
        row.append(info, button); list.append(row);
      }
    }
    async function load() {
      setNotice('Cargando tareas…'); list.replaceChildren();
      try {
        const allowed = await request('rpc/crm_can_delete_record', {method:'POST',body:{p_org:org.value,p_module:'tasks'}});
        if (allowed !== true) throw Error('Para eliminar tareas necesitas permisos de administrador en esta empresa.');
        records = await request(`tasks?select=id,title,status,organization_id&organization_id=eq.${encodeURIComponent(org.value)}&order=created_at.desc&limit=1000`);
        setNotice(`${records.length} tareas disponibles. El borrado es definitivo.`);
        render();
      } catch (error) { records = []; setNotice(error.message, true); render(); }
    }
    org.onchange = load;
    search.oninput = render;
    (async () => {
      try {
        const organizations = await request('organizations?select=id,name&active=eq.true&order=name');
        if (!organizations.length) throw Error('No hay empresas activas.');
        const headingText = heading.querySelector('.dashboard-kicker')?.textContent || '';
        for (const item of organizations) { const option = element('option', item.name); option.value = item.id; org.append(option); }
        const selected = organizations.find(item => headingText.includes(item.name));
        if (selected) org.value = selected.id;
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
        if (heading.querySelector('.crm-tasks-manage-button')) return;
        const button = element('button', 'Eliminar tareas', 'crm-tasks-manage-button');
        button.type = 'button';
        button.onclick = () => showManager(heading);
        heading.append(button);
      }
    } finally { running = false; }
  }
  const css = document.createElement('style');
  css.textContent = `.crm-tasks-manage-button{padding:11px 16px;border:1px solid #d0d7e2;border-radius:10px;background:#fff;color:#b42318;font-weight:700;cursor:pointer}
  .crm-tasks-delete-overlay{position:fixed;inset:0;z-index:99999;background:rgba(14,28,48,.65);display:grid;place-items:center;padding:16px}
  .crm-tasks-delete-dialog{box-sizing:border-box;background:white;color:#192c3f;width:min(660px,100%);max-height:88vh;overflow:auto;border-radius:16px;padding:24px;box-shadow:0 20px 60px #142c483b}
  .crm-tasks-delete-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.crm-tasks-delete-header h2{margin:0}
  .crm-tasks-close{font-size:30px;background:transparent;border:0;cursor:pointer}.crm-tasks-delete-dialog label{display:block;margin:14px 0;font-weight:650}
  .crm-tasks-delete-dialog label input,.crm-tasks-delete-dialog label select{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid #bcc8d3;border-radius:8px}
  #crm-tasks-delete-notice{margin:14px 0;font-size:14px}.crm-tasks-delete-row{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #e3e8ed;padding:12px 0;gap:12px}
  .crm-tasks-delete-row strong,.crm-tasks-delete-row small{display:block}.crm-tasks-delete-row small{margin-top:5px;color:#64748b}
  .crm-tasks-danger{border:1px solid #dc8a82;border-radius:8px;color:#b42318;background:#fff;padding:8px 13px;cursor:pointer}
  .crm-tasks-danger:disabled{opacity:.5}.crm-tasks-delete-footer{text-align:right;padding-top:16px}.crm-tasks-done{padding:10px 14px;background:#087f74;color:white;border:0;border-radius:8px;cursor:pointer}`;
  document.head.append(css);
  new MutationObserver(install).observe(document.body, {childList:true,subtree:true});
  install();
})();
