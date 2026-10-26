/* Acciones rápidas dentro de las fichas actuales. No almacena ni transmite datos por sí mismo. */
(() => {
  const root = document.getElementById('root');
  if (!root) return;
  let scheduled = false;
  const API = 'https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const SESSION = 'sb-kkyizztxlvjqbplcnhtx-auth-token';
  function session() {
    let value;
    try { value = JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch { value = null; }
    if (!value?.access_token || value.expires_at * 1000 <= Date.now()) throw Error('Tu sesión ha caducado. Vuelve a entrar al CRM.');
    return value;
  }
  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      method: options.method || 'GET',
      headers: {apikey:KEY, Authorization:'Bearer ' + session().access_token, 'Content-Type':'application/json', Prefer:'return=representation'},
      ...(options.body ? {body:JSON.stringify(options.body)} : {})
    });
    const raw = await response.text();
    let data;
    try {data = raw ? JSON.parse(raw) : null;} catch {data = null;}
    if (!response.ok) throw Error(data?.message || `Error ${response.status} al guardar.`);
    return data;
  }
  async function newTask(context = {}) {
    if (document.getElementById('crm-contact-task-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'crm-contact-task-overlay';
    overlay.innerHTML = `<form class="crm-contact-task-modal" role="dialog" aria-modal="true" aria-labelledby="crm-contact-task-title">
      <header><h2 id="crm-contact-task-title">Nueva tarea de seguimiento</h2><button type="button" data-close aria-label="Cerrar">×</button></header>
      <label>Empresa del CRM<select name="org" required></select></label>
      <label>Cliente asociado<select name="company"><option value="">Sin cliente</option></select></label>
      <label>Contacto asociado<select name="contact"><option value="">Sin contacto</option></select></label>
      <label>Título de la tarea<input name="title" required maxlength="180" value="Llamar y hacer seguimiento"></label>
      <label>Fecha y hora<input name="due" type="datetime-local" required></label>
      <label>Prioridad<select name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option><option value="low">Baja</option></select></label>
      <label>Notas<textarea name="notes" rows="3" maxlength="3000" placeholder="Próxima acción, detalles…"></textarea></label>
      <p role="status" class="crm-contact-task-status"></p>
      <footer><button type="button" data-close>Cancelar</button><button type="submit" class="crm-contact-task-save">Guardar tarea</button></footer>
    </form>`;
    document.body.append(overlay);
    const form = overlay.querySelector('form');
    const org = form.elements.org, company = form.elements.company, contact=form.elements.contact;
    const status = overlay.querySelector('.crm-contact-task-status');
    const save = overlay.querySelector('.crm-contact-task-save');
    const close = () => overlay.remove();
    overlay.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',close));
    overlay.addEventListener('click',event => {if(event.target === overlay)close();});
    const tomorrow = new Date(Date.now() + 24*60*60*1000);
    tomorrow.setMinutes(0,0,0);
    const pad = n => String(n).padStart(2,'0');
    form.elements.due.value = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:00`;
    const message = (value,bad=false) => {status.textContent=value;status.style.color=bad?'#b42318':'#17665d';};
    let companies = [], contacts=[];
    function renderContacts(){
      const previous=contact.value;contact.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Sin contacto';contact.append(empty);
      for(const person of contacts.filter(x=>!company.value||x.company_id===company.value)){
        const option=document.createElement('option');option.value=person.id;option.textContent=[person.first_name,person.last_name].filter(Boolean).join(' ')||(person.email||'Contacto');contact.append(option);
      }
      if([...contact.options].some(x=>x.value===previous))contact.value=previous;
      else{const email=String(context.email||'').trim().toLocaleLowerCase('es');const matches=contacts.filter(x=>String(x.email||'').trim().toLocaleLowerCase('es')===email&&(!company.value||x.company_id===company.value));if(email&&matches.length===1)contact.value=matches[0].id;}
    }
    async function loadCompanies() {
      message('Cargando clientes…');
      try {
        const permitted = await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'tasks',p_action:'edit'}});
        if (permitted !== true) throw Error('No tienes permisos para crear tareas en esta empresa.');
        companies = await api(`companies?select=id,name&organization_id=eq.${encodeURIComponent(org.value)}&order=name&limit=2000`);
        company.replaceChildren();
        const empty = document.createElement('option');empty.value='';empty.textContent='Sin cliente';company.append(empty);
        for(const item of companies){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;company.append(option);}
        const matches=companies.filter(item => item.name?.trim().toLocaleLowerCase('es') === context.companyName?.trim().toLocaleLowerCase('es'));
        if(matches.length===1)company.value=matches[0].id;
        else if(matches.length>1)message('Hay varios clientes con ese nombre. Elige el correcto antes de guardar.',true);
        contacts=[];
        try{
          const allowedContacts=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'contacts',p_action:'view'}});
          if(allowedContacts===true){for(let offset=0;offset<5000;offset+=500){const page=await api(`contacts?select=id,first_name,last_name,email,company_id&organization_id=eq.${encodeURIComponent(org.value)}&order=first_name&limit=500&offset=${offset}`);contacts.push(...page);if(page.length<500)break;}}
          const email=String(context.email||'').trim().toLocaleLowerCase('es');const matched=contacts.filter(x=>email&&String(x.email||'').trim().toLocaleLowerCase('es')===email);
          if(!company.value&&matched.length===1&&companies.some(x=>x.id===matched[0].company_id))company.value=matched[0].company_id;
        }catch(error){console.warn('Contactos no disponibles para vinculación:',error.message);}
        renderContacts();
        if(matches.length<=1)message('Completa los datos y guarda la tarea.');
      } catch(error) {companies=[];contacts=[];renderContacts();message(error.message,true);}
    }
    org.addEventListener('change',loadCompanies);
    company.addEventListener('change',renderContacts);
    contact.addEventListener('change',()=>{const person=contacts.find(x=>x.id===contact.value);if(person?.company_id&&!company.value&&companies.some(x=>x.id===person.company_id))company.value=person.company_id;});
    form.addEventListener('submit',async event => {
      event.preventDefault();if(save.disabled)return;
      save.disabled=true;message('Guardando tarea…');
      try {
        if(document.getElementById('active-organization')?.value&&document.getElementById('active-organization').value!==org.value)throw Error('Ha cambiado la empresa activa. Cierra y abre de nuevo la tarea.');
        if(!companies.length && company.value)throw Error('Vuelve a seleccionar la empresa.');
        if(company.value&&!companies.some(item=>item.id===company.value))throw Error('El cliente elegido no corresponde a esta empresa.');
        if(contact.value&&!contacts.some(item=>item.id===contact.value&&(!company.value||item.company_id===company.value)))throw Error('El contacto seleccionado no corresponde al cliente elegido.');
        const allowed = await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'tasks',p_action:'edit'}});
        if(allowed!==true)throw Error('No tienes permisos para crear tareas.');
        const due = new Date(form.elements.due.value);
        if(Number.isNaN(due.getTime()))throw Error('Introduce una fecha válida.');
        const payload = {organization_id:org.value,title:form.elements.title.value.trim(),description:form.elements.notes.value.trim() || null,due_date:due.toISOString(),priority:form.elements.priority.value,status:'pending',task_type:'general',created_by:session().user.id,assigned_to:session().user.id,company_id:company.value || null,contact_id:contact.value||null};
        if(!payload.title)throw Error('El título es obligatorio.');
        const created = await api('tasks?select=id,title',{method:'POST',body:payload});
        if(!Array.isArray(created)||created.length!==1)throw Error('No se ha confirmado el guardado.');
        toast('Tarea creada correctamente.');close();
      } catch(error){message(error.message,true);}finally{save.disabled=false;}
    });
    try {
      const organizations = await api('organizations?select=id,name&active=eq.true&order=name');
      for(const item of organizations){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;org.append(option);}
      if(!organizations.length)throw Error('No hay empresas disponibles.');
      const globalOrg=document.getElementById('active-organization')?.value;
      const current = document.querySelector('.dashboard-heading .dashboard-kicker')?.textContent || '';
      const chosen = organizations.find(item => item.id===globalOrg)||organizations.find(item => current.includes(item.name));
      if(chosen)org.value=chosen.id;
      if(organizations.some(item => item.id===globalOrg))org.closest('label').style.display='none';
      await loadCompanies();
    }catch(error){message(error.message,true);}
  }

  function cleanPhone(value) {
    if (!value || /sin tel[eé]fono|^—$/i.test(value.trim())) return null;
    let phone = value.trim().replace(/[^+0-9]/g, '');
    if (phone.startsWith('00')) phone = '+' + phone.slice(2);
    if (!phone.startsWith('+') && /^[6789]\d{8}$/.test(phone)) phone = '+34' + phone;
    if (!/^\+?[0-9]{8,15}$/.test(phone)) return null;
    const digits = phone.replace(/\D/g, '');
    const whatsapp = phone.startsWith('+') && digits.length >= 8 && digits.length <= 15 ? digits : null;
    return { phone, whatsapp };
  }
  function cleanEmail(value) {
    const email = String(value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }
  function toast(message, error = false) {
    let status = document.getElementById('crm-contact-action-status');
    if (!status) {
      status = document.createElement('div');status.id = 'crm-contact-action-status';
      status.setAttribute('role', 'status');document.body.append(status);
    }
    status.textContent = message;
    status.style.background = error ? '#9b2c2c' : '#0c766d';
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => status.remove(), 2900);
  }
  async function copy(value, label) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const input = document.createElement('textarea');input.value = value;
        input.style.position = 'fixed';input.style.opacity = '0';document.body.append(input);
        input.select();const ok = document.execCommand('copy');input.remove();
        if (!ok) throw Error('No se pudo copiar.');
      }
      toast(label + ' copiado.');
    } catch {toast('No se pudo copiar. Selecciona el dato y cópialo manualmente.', true);}
  }
  function link(label, href, title, external = false) {
    const a = document.createElement('a');a.className = 'crm-contact-quick';
    a.textContent = label;a.href = href;a.title = title;
    if (external) {a.target = '_blank';a.rel = 'noopener noreferrer';}
    return a;
  }
  function button(label, action, title) {
    const b = document.createElement('button');b.type = 'button';b.className = 'crm-contact-quick';
    b.textContent = label;b.title = title;b.addEventListener('click', action);return b;
  }
  function putActions(parent, phoneValue, emailValue, detail = false, context = {}) {
    if (!parent) return;
    const phone = cleanPhone(phoneValue), email = cleanEmail(emailValue);
    const signature = JSON.stringify([phone?.phone || '',email || '',detail,context.companyName || '']);
    if (parent.dataset.crmContactActionSignature === signature && parent.querySelector('[data-crm-quick-actions]')) return;
    parent.querySelector('[data-crm-quick-actions]')?.remove();
    parent.dataset.crmContactActionSignature = signature;
    const group = document.createElement('span');group.dataset.crmQuickActions = 'true';
    group.className = 'crm-contact-quick-group';
    if (phone && !detail) group.append(link('Llamar','tel:' + phone.phone,'Abrir el marcador telefónico'));
    if (phone?.whatsapp) group.append(link('WhatsApp','https://wa.me/' + phone.whatsapp,'Abrir conversación. No se envía ningún mensaje automáticamente.',true));
    if (phone) group.append(button('Copiar teléfono',()=>copy(phone.phone,'Teléfono'),'Copiar número'));
    if (email && !detail) group.append(link('Correo','mailto:' + email,'Redactar correo'));
    if (email) group.append(button('Copiar correo',()=>copy(email,'Correo'),'Copiar dirección de correo'));
    group.append(button('Nueva tarea',()=>newTask({...context,email}),'Crear una tarea de seguimiento en este CRM'));
    if (group.childNodes.length) parent.append(group);
  }
  function scanRows(page) {
    const heading = [...root.querySelectorAll('.dashboard-heading h1')].find(h => h.textContent.trim() === page);
    if (!heading) return;
    const dashboard = heading.closest('.dashboard') || heading.parentElement?.parentElement?.parentElement;
    if (!dashboard) return;
    for (const row of dashboard.querySelectorAll('.clients-list .client-row')) {
      const actions = row.querySelector('.client-actions');
      const phone = row.querySelector('.client-contact span')?.textContent || '';
      const email = page === 'Contactos' ? row.querySelector('.client-main small')?.textContent || '' : row.querySelector('.client-contact small')?.textContent || '';
      const companyName = page === 'Clientes' ? row.querySelector('.client-main strong')?.textContent?.trim() : '';
      putActions(actions,phone,email,false,{companyName});
    }
  }
  function scanContactDetail() {
    for (const detail of root.querySelectorAll('section[aria-label="Solicitud del contacto"]')) {
      const call = detail.querySelector('a[href^="tel:"]');
      const mail = detail.querySelector('a[href^="mailto:"]');
      const actions = call?.parentElement || mail?.parentElement;
      if (!actions) continue;
      putActions(actions,call?.getAttribute('href')?.slice(4) || '',mail?.getAttribute('href')?.slice(7) ? decodeURIComponent(mail.getAttribute('href').slice(7)) : '',true);
    }
  }
  function scanClientDetail() {
    for (const detail of root.querySelectorAll('.company-detail')) {
      if (!detail.querySelector('.company-detail-header .dashboard-kicker')?.textContent.includes('FICHA DE CLIENTE')) continue;
      const grid = detail.querySelector('.company-detail-grid');
      if (!grid) continue;
      const fields = [...grid.children].filter(node => node.querySelector('span') && node.querySelector('strong'));
      const value = label => fields.find(field => field.querySelector('span')?.textContent.trim().toLocaleLowerCase('es') === label)?.querySelector('strong')?.textContent || '';
      putActions(grid, value('teléfono'), value('email'),false,{companyName:detail.querySelector('.company-detail-header h1, .company-detail-header h2')?.textContent?.trim() || ''});
    }
  }
  function scan() {
    scheduled = false;
    scanRows('Contactos');scanRows('Clientes');scanContactDetail();scanClientDetail();
  }
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  }).observe(root, {subtree:true,childList:true,characterData:true});
  const css = document.createElement('style');
  css.textContent = `.client-actions{flex-wrap:wrap;align-items:center}
  .crm-contact-quick-group{display:inline-flex;gap:5px;flex-wrap:wrap;align-items:center}
  .crm-contact-quick-group .crm-contact-quick{display:inline-flex;align-items:center;justify-content:center;border:1px solid #cbd8e3;border-radius:7px;background:#fff;color:#1a5978;padding:7px 9px;font-family:inherit;font-size:12px;font-weight:700;line-height:1.3;text-decoration:none;cursor:pointer;white-space:nowrap}
  .crm-contact-quick-group .crm-contact-quick:hover{background:#edf7f8;border-color:#84bbb6}
  .company-detail-grid>.crm-contact-quick-group{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;padding-top:16px;margin-top:8px;border-top:1px solid #e0e8ed}
  #crm-contact-action-status{position:fixed;right:20px;bottom:20px;z-index:100000;color:white;padding:13px 18px;border-radius:9px;box-shadow:0 8px 28px #142c4833;font-size:14px;max-width:340px}
  #crm-contact-task-overlay{position:fixed;inset:0;z-index:100001;background:rgba(10,25,43,.65);display:grid;place-items:center;padding:16px}
  .crm-contact-task-modal{box-sizing:border-box;width:min(530px,100%);max-height:92vh;overflow:auto;background:white;padding:23px;border-radius:16px;color:#16314b;box-shadow:0 18px 50px #142c4860}
  .crm-contact-task-modal header,.crm-contact-task-modal footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.crm-contact-task-modal h2{margin:0 0 10px;font-size:22px}
  .crm-contact-task-modal header button{font-size:28px;background:none;border:0;cursor:pointer}.crm-contact-task-modal label{display:block;font-weight:650;margin:12px 0;font-size:13px}
  .crm-contact-task-modal input,.crm-contact-task-modal select,.crm-contact-task-modal textarea{display:block;box-sizing:border-box;width:100%;padding:10px;margin-top:5px;border:1px solid #becfdc;border-radius:9px;font:inherit;font-weight:400}
  .crm-contact-task-modal footer button{padding:10px 15px;border:1px solid #b5cbd4;border-radius:9px;background:#fff;cursor:pointer;font-weight:700}.crm-contact-task-modal footer .crm-contact-task-save{background:#087f74;color:#fff;border-color:#087f74}.crm-contact-task-modal button:disabled{opacity:.6;cursor:wait}
  .crm-contact-task-status{min-height:19px;font-size:13px}
  @media(max-width:800px){.crm-contact-quick-group{flex-wrap:wrap}.crm-contact-quick-group .crm-contact-quick{white-space:normal}}
  `;
  document.head.append(css);
  scan();
})();
