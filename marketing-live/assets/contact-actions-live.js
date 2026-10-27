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
    if(context.title)form.elements.title.value=String(context.title).slice(0,180);
    if(context.notes)form.elements.notes.value=String(context.notes).slice(0,3000);
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
        if(context.companyId&&companies.some(x=>x.id===context.companyId))company.value=context.companyId;
        else if(matches.length===1)company.value=matches[0].id;
        else if(matches.length>1)message('Hay varios clientes con ese nombre. Elige el correcto antes de guardar.',true);
        contacts=[];
        try{
          const allowedContacts=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'contacts',p_action:'view'}});
          if(allowedContacts===true){for(let offset=0;offset<5000;offset+=500){const page=await api(`contacts?select=id,first_name,last_name,email,company_id&organization_id=eq.${encodeURIComponent(org.value)}&order=first_name&limit=500&offset=${offset}`);contacts.push(...page);if(page.length<500)break;}}
          const email=String(context.email||'').trim().toLocaleLowerCase('es');const matched=contacts.filter(x=>email&&String(x.email||'').trim().toLocaleLowerCase('es')===email);
          if(!company.value&&matched.length===1&&companies.some(x=>x.id===matched[0].company_id))company.value=matched[0].company_id;
        }catch(error){console.warn('Contactos no disponibles para vinculación:',error.message);}
        renderContacts();
        if(context.contactId&&[...contact.options].some(x=>x.value===context.contactId))contact.value=context.contactId;
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
        if(context.opportunityId){
          const opps=await api(`opportunities?select=id,company_id,contact_id&organization_id=eq.${encodeURIComponent(org.value)}&id=eq.${encodeURIComponent(context.opportunityId)}&limit=1`);
          if(opps.length!==1)throw Error('La oportunidad ya no está disponible en esta empresa.');
          if(opps[0].company_id&&company.value!==opps[0].company_id)throw Error('Esta oportunidad ya pertenece a otro cliente. Selecciona el cliente vinculado.');
          if(opps[0].contact_id&&contact.value!==opps[0].contact_id)throw Error('Selecciona el contacto vinculado a esta oportunidad.');
        }
        const allowed = await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'tasks',p_action:'edit'}});
        if(allowed!==true)throw Error('No tienes permisos para crear tareas.');
        const due = new Date(form.elements.due.value);
        if(Number.isNaN(due.getTime()))throw Error('Introduce una fecha válida.');
        const payload = {organization_id:org.value,title:form.elements.title.value.trim(),description:form.elements.notes.value.trim() || null,due_date:due.toISOString(),priority:form.elements.priority.value,status:'pending',task_type:'general',created_by:session().user.id,assigned_to:session().user.id,company_id:company.value || null,contact_id:contact.value||null,opportunity_id:context.opportunityId||null};
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

  async function contactHistory(context={}) {
    if(document.getElementById('crm-contact-history'))return;
    const org=document.getElementById('active-organization')?.value;
    if(!org){toast('Selecciona primero una empresa en el CRM.',true);return;}
    const overlay=document.createElement('div');overlay.id='crm-contact-history';
    overlay.innerHTML=`<section class="crm-contact-history-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-contact-history-title">
      <header><div><small>HISTORIAL DEL CONTACTO</small><h2 id="crm-contact-history-title">Seguimiento comercial</h2></div><button type="button" data-close aria-label="Cerrar">×</button></header>
      <p>Consulta las actividades, tareas, leads y oportunidades vinculados directamente al contacto. No modifica registros.</p>
      <div class="crm-contact-history-controls"><label>Contacto<select id="crm-contact-history-person"><option value="">Selecciona el contacto correcto</option></select></label><label>Mostrar<select id="crm-contact-history-type"><option value="all">Todo</option><option value="activity">Actividades y citas</option><option value="task">Tareas</option><option value="opportunity">Oportunidades</option><option value="lead">Leads</option></select></label><label>Buscar<input id="crm-contact-history-search" type="search" placeholder="Buscar en el historial"></label></div>
      <div class="crm-contact-history-stats"></div><p class="crm-contact-history-notice" role="status"></p><div class="crm-contact-history-list"></div>
      <footer><button type="button" id="crm-contact-history-export">Exportar CSV</button><button type="button" id="crm-contact-history-refresh">Actualizar</button><button type="button" data-close>Cerrar</button></footer>
    </section>`;
    document.body.append(overlay);
    const person=overlay.querySelector('#crm-contact-history-person'),kind=overlay.querySelector('#crm-contact-history-type'),search=overlay.querySelector('#crm-contact-history-search');
    const list=overlay.querySelector('.crm-contact-history-list'),notice=overlay.querySelector('.crm-contact-history-notice'),stats=overlay.querySelector('.crm-contact-history-stats');
    const say=(message,bad=false)=>{notice.textContent=message;notice.style.color=bad?'#b42318':'#087f74';};
    const events=new AbortController(),close=()=>{events.abort();overlay.remove();};
    overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);overlay.onclick=e=>{if(e.target===overlay)close();};
    document.addEventListener('change',event=>{if(event.target?.id==='active-organization')close();},{signal:events.signal});
    let contacts=[],entries=[];
    const cell=value=>{let s=String(value??'');if(/^[\s\u0000-\u001f]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    function filtered(){const q=search.value.trim().toLocaleLowerCase('es');return entries.filter(x=>(kind.value==='all'||x.kind===kind.value)&&[x.title,x.detail,x.type].join(' ').toLocaleLowerCase('es').includes(q));}
    function render(){
      stats.replaceChildren();list.replaceChildren();
      for(const [name,value] of [['Actividades',entries.filter(x=>x.kind==='activity').length],['Tareas pendientes',entries.filter(x=>x.kind==='task'&&x.pending).length],['Oportunidades',entries.filter(x=>x.kind==='opportunity').length],['Leads',entries.filter(x=>x.kind==='lead').length]]){
        const box=document.createElement('div');box.append(Object.assign(document.createElement('strong'),{textContent:String(value)}),Object.assign(document.createElement('span'),{textContent:name}));stats.append(box);
      }
      const rows=filtered();if(!rows.length){const empty=document.createElement('p');empty.textContent='No hay registros vinculados al contacto con estos filtros.';list.append(empty);return;}
      for(const item of rows){const row=document.createElement('article'),time=document.createElement('small'),title=document.createElement('strong'),detail=document.createElement('p');
        time.textContent=item.date?new Date(item.date).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'Sin fecha';title.textContent=item.title;detail.textContent=item.detail;row.append(time,title,detail);list.append(row);
      }
    }
    async function all(table,columns,scope,sort){const rows=[];for(let offset=0;offset<5000;offset+=500){const page=await api(`${table}?select=${columns}&${scope}&order=${sort}&limit=500&offset=${offset}`);rows.push(...page);if(page.length<500)break;}return rows;}
    async function load(){
      entries=[];stats.replaceChildren();list.replaceChildren();
      if(!person.value){say('Selecciona el contacto correcto para consultar su historial.');return;}
      if(document.getElementById('active-organization')?.value!==org){say('Ha cambiado la empresa activa. Abre el historial de nuevo.',true);return;}
      say('Cargando seguimiento…');
      try{
        const allowed=await Promise.all(['agenda','tasks','opportunities','leads'].map(module=>api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:module,p_action:'view'}}).catch(()=>false)));
        const scope=`organization_id=eq.${encodeURIComponent(org)}&contact_id=eq.${encodeURIComponent(person.value)}`;
        const [activities,tasks,opportunities,leads]=await Promise.all([
          allowed[0]?all('activities','activity_type,subject,description,activity_date',scope,'activity_date.desc'):[],
          allowed[1]?all('tasks','title,description,status,due_date,created_at',scope,'created_at.desc'):[],
          allowed[2]?all('opportunities','title,estimated_value,created_at,pipeline_stages(name)',scope,'created_at.desc'):[],
          allowed[3]?all('leads','contact_name,company_name,status,next_action,created_at',scope,'created_at.desc'):[]
        ]);
        entries=[
          ...activities.map(x=>({kind:'activity',date:x.activity_date,title:(x.activity_type||'Actividad')+': '+(x.subject||'Sin asunto'),detail:x.description||'',type:'Actividad'})),
          ...tasks.map(x=>({kind:'task',date:x.due_date||x.created_at,title:'Tarea: '+(x.title||'Sin título'),detail:(x.status||'')+(x.description?' · '+x.description:''),type:'Tarea',pending:['pending','in_progress'].includes(x.status)})),
          ...opportunities.map(x=>({kind:'opportunity',date:x.created_at,title:'Oportunidad: '+(x.title||'Sin título'),detail:(x.pipeline_stages?.name||'Sin etapa')+' · '+Number(x.estimated_value||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'}),type:'Oportunidad'})),
          ...leads.map(x=>({kind:'lead',date:x.created_at,title:'Lead: '+(x.contact_name||x.company_name||'Sin nombre'),detail:(x.status||'Sin estado')+(x.next_action?' · '+x.next_action:''),type:'Lead'}))
        ].sort((a,b)=>new Date(b.date)-new Date(a.date));
        render();say(`${entries.length} registros vinculados al contacto.${allowed.some(x=>!x)?' Algunos módulos no están disponibles para tu perfil.':''}`);
      }catch(error){say(error.message,true);}
    }
    person.onchange=load;kind.onchange=render;search.oninput=render;overlay.querySelector('#crm-contact-history-refresh').onclick=load;
    overlay.querySelector('#crm-contact-history-export').onclick=()=>{
      const rows=[['Fecha','Tipo','Título','Detalle'],...filtered().map(x=>[x.date||'',x.type,x.title,x.detail])];
      const csv='\ufeff'+rows.map(x=>x.map(cell).join(';')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='globaltec-historial-contacto-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    };
    try{
      const permitted=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'contacts',p_action:'view'}});
      if(permitted!==true)throw Error('No tienes permiso para consultar contactos.');
      contacts=await all('contacts','id,first_name,last_name,email,phone,company_id',`organization_id=eq.${encodeURIComponent(org)}`,'first_name.asc');
      for(const c of contacts){const opt=document.createElement('option');opt.value=c.id;opt.textContent=[c.first_name,c.last_name].filter(Boolean).join(' ')+' · '+(c.email||c.phone||'ID '+c.id.slice(0,8));person.append(opt);}
      const email=String(context.email||'').trim().toLocaleLowerCase('es');const name=String(context.contactName||'').trim().toLocaleLowerCase('es');
      let matches=contacts.filter(x=>email&&String(x.email||'').trim().toLocaleLowerCase('es')===email);
      if(!matches.length&&name)matches=contacts.filter(x=>[x.first_name,x.last_name].filter(Boolean).join(' ').trim().toLocaleLowerCase('es')===name);
      if(matches.length===1){person.value=matches[0].id;await load();}
      else say(matches.length>1?'Hay varios contactos coincidentes. Selecciona el correcto antes de abrir el historial.':'Selecciona el contacto correcto en la lista.');
    }catch(error){say(error.message,true);}
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
  document.addEventListener('crm:open-followup-task',event=>{
    const context=event.detail;
    if(!context||!context.opportunityId||context.organizationId!==document.getElementById('active-organization')?.value)return;
    newTask(context).catch(error=>toast(error.message||'No se pudo abrir la tarea.',true));
  });
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
    const signature = JSON.stringify([phone?.phone || '',email || '',detail,context.companyName || '',context.isContact||false,context.contactName||'']);
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
    if(context.isContact)group.append(button('Historial',()=>contactHistory({...context,email}).catch(e=>toast(e.message,true)),'Consultar actividad comercial de este contacto'));
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
      const contactName=page==='Contactos'?row.querySelector('.client-main strong')?.textContent?.trim()||'':'';
      putActions(actions,phone,email,false,{companyName,isContact:page==='Contactos',contactName});
    }
  }
  function scanContactDetail() {
    for (const detail of root.querySelectorAll('section[aria-label="Solicitud del contacto"]')) {
      const call = detail.querySelector('a[href^="tel:"]');
      const mail = detail.querySelector('a[href^="mailto:"]');
      const actions = call?.parentElement || mail?.parentElement;
      if (!actions) continue;
      putActions(actions,call?.getAttribute('href')?.slice(4) || '',mail?.getAttribute('href')?.slice(7) ? decodeURIComponent(mail.getAttribute('href').slice(7)) : '',true,{isContact:true});
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
  .crm-contact-quick-group{display:inline-flex;gap:8px;flex-wrap:wrap;align-items:center}
  .crm-contact-quick-group .crm-contact-quick{display:inline-flex;align-items:center;justify-content:center;border:1px solid #cbd8e3;border-radius:8px;background:#fff;color:#1a5978;padding:9px 12px;min-height:36px;font-family:inherit;font-size:12px;font-weight:700;line-height:1.3;text-decoration:none;cursor:pointer;white-space:nowrap}
  .crm-contact-quick-group .crm-contact-quick:hover{background:#edf7f8;border-color:#84bbb6}
  .company-detail-grid>.crm-contact-quick-group{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;padding-top:16px;margin-top:8px;border-top:1px solid #e0e8ed}
  #crm-contact-action-status{position:fixed;right:20px;bottom:20px;z-index:100000;color:white;padding:13px 18px;border-radius:9px;box-shadow:0 8px 28px #142c4833;font-size:14px;max-width:340px}
  #crm-contact-task-overlay{position:fixed;inset:0;z-index:100001;background:rgba(10,25,43,.65);display:grid;place-items:center;padding:16px}
  .crm-contact-task-modal{box-sizing:border-box;width:min(530px,100%);max-height:92vh;overflow:auto;background:white;padding:23px;border-radius:16px;color:#16314b;box-shadow:0 18px 50px #142c4860}
  .crm-contact-task-modal header,.crm-contact-task-modal footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.crm-contact-task-modal h2{margin:0 0 10px;font-size:22px}
  .crm-contact-task-modal header button{font-size:28px;background:none;border:0;cursor:pointer}.crm-contact-task-modal label{display:block;font-weight:650;margin:12px 0;font-size:13px}
  .crm-contact-task-modal input,.crm-contact-task-modal select,.crm-contact-task-modal textarea{display:block;box-sizing:border-box;width:100%;padding:10px;margin-top:5px;border:1px solid #becfdc;border-radius:9px;font:inherit;font-weight:400}
  .crm-contact-task-modal footer button{padding:10px 15px;border:1px solid #b5cbd4;border-radius:9px;background:#fff;cursor:pointer;font-weight:700}.crm-contact-task-modal footer .crm-contact-task-save{background:#087f74;color:#fff;border-color:#087f74}.crm-contact-task-modal button:disabled{opacity:.6;cursor:wait}
  .crm-contact-task-modal footer{justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid #e1e8ed}
  .crm-contact-task-status{min-height:19px;font-size:13px}
  #crm-contact-history{position:fixed;inset:0;z-index:100002;display:grid;place-items:center;padding:16px;background:#081a30aa}
  .crm-contact-history-dialog{box-sizing:border-box;width:min(990px,100%);max-height:92vh;overflow:auto;padding:23px;border-radius:15px;background:#fff;color:#16314b;box-shadow:0 18px 50px #142c4860}
  .crm-contact-history-dialog header,.crm-contact-history-dialog footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.crm-contact-history-dialog header small{color:#087f74;font-weight:750}.crm-contact-history-dialog h2{margin:3px 0}.crm-contact-history-dialog header button{border:0;background:none;font-size:28px;cursor:pointer}
  .crm-contact-history-controls{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;margin:14px 0}.crm-contact-history-controls label{font-size:13px;font-weight:650}.crm-contact-history-controls input,.crm-contact-history-controls select{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid #becfdc;border-radius:8px;font:inherit}
  .crm-contact-history-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.crm-contact-history-stats>div{border:1px solid #d5e7e2;background:#f3faf8;border-radius:9px;padding:11px}.crm-contact-history-stats strong,.crm-contact-history-stats span{display:block}.crm-contact-history-stats strong{font-size:24px;color:#087f74}.crm-contact-history-stats span{font-size:12px;color:#5a7182}
  .crm-contact-history-notice{font-size:13px;min-height:18px}.crm-contact-history-list{max-height:380px;overflow:auto;display:grid;gap:8px}.crm-contact-history-list article{border:1px solid #e0e8ed;border-radius:9px;padding:12px}.crm-contact-history-list small,.crm-contact-history-list strong{display:block}.crm-contact-history-list small{color:#6a8191}.crm-contact-history-list p{margin:5px 0 0;white-space:pre-wrap;font-size:13px;color:#42596e}.crm-contact-history-dialog footer{justify-content:flex-end;flex-wrap:wrap;gap:12px;margin-top:22px;padding-top:18px;border-top:1px solid #e1e8ed}.crm-contact-history-dialog footer button{min-height:42px;border:1px solid #087f74;background:#fff;color:#087f74;padding:10px 16px;border-radius:8px;font-weight:700;cursor:pointer}.crm-contact-history-dialog footer button:last-child{background:#087f74;color:#fff}
  @media(max-width:520px){.crm-contact-history-dialog footer{gap:10px}.crm-contact-history-dialog footer button{flex:1 1 130px}}
  @media(max-width:800px){.crm-contact-history-controls{grid-template-columns:1fr}.crm-contact-history-stats{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:800px){.crm-contact-quick-group{flex-wrap:wrap}.crm-contact-quick-group .crm-contact-quick{white-space:normal}}
  `;
  document.head.append(css);
  scan();
})();
