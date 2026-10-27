/* Historial unificado en la ficha de Cliente; no altera el CRM original. */
(() => {
  const root=document.getElementById('root');if(!root)return;
  const API='https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY='sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const TOKEN='sb-kkyizztxlvjqbplcnhtx-auth-token';let scheduled=false;
  function session(){let s;try{s=JSON.parse(localStorage.getItem(TOKEN)||'null');}catch{s=null;}
    if(!s?.access_token||s.expires_at*1000<=Date.now())throw Error('Sesión caducada. Inicia sesión de nuevo.');return s;}
  async function api(path,opts={}){
    const res=await fetch(API+path,{method:opts.method||'GET',headers:{apikey:KEY,Authorization:'Bearer '+session().access_token,'Content-Type':'application/json',Prefer:'return=representation'},...(opts.body?{body:JSON.stringify(opts.body)}:{})});
    const body=await res.text();let data;try{data=body?JSON.parse(body):null;}catch{data=null;}
    if(!res.ok)throw Error(data?.message||`Error ${res.status} al consultar los datos.`);return data;
  }
  const el=(tag,label='',cls='')=>{const e=document.createElement(tag);e.textContent=label;if(cls)e.className=cls;return e;};
  function csvField(value){let v=String(value??'');if(/^[\s\u0000-\u001f]*[=+@\-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}
  function exportCsv(items,name){
    const fields=[['Fecha','date'],['Tipo','type'],['Título','title'],['Detalle','detail']];
    const csv='\ufeff'+[fields.map(f=>csvField(f[0])).join(';'),...items.map(item=>fields.map(f=>csvField(item[f[1]])).join(';'))].join('\r\n');
    const link=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    link.href=url;link.download='seguimiento-'+name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').slice(0,45)+'-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  function openClient(detail){
    if(document.getElementById('crm-client-history'))return;
    const clientName=detail.querySelector('.company-detail-header h2')?.textContent?.trim();
    if(!clientName)return;
    const overlay=el('div','','crm-client-history-overlay');overlay.id='crm-client-history';
    overlay.innerHTML=`<section class="crm-client-history-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-client-history-title">
      <header><div><small>SEGUIMIENTO COMERCIAL</small><h2 id="crm-client-history-title"></h2></div><button type="button" data-close aria-label="Cerrar">×</button></header>
      <p>Vista 360º del cliente: contactos, actividad, próximas tareas y oportunidades comerciales vinculadas.</p>
      <div class="crm-client-history-controls"><label>Empresa<select id="crm-history-org"></select></label><label>Cliente<select id="crm-history-company"></select></label></div>
      <div class="crm-client-history-metrics"></div>
      <div class="crm-client-history-controls crm-client-history-filters"><label>Mostrar<select id="crm-history-type"><option value="all">Todo</option><option value="contact">Contactos</option><option value="activity">Actividades y notas</option><option value="task">Tareas</option><option value="pending">Tareas pendientes</option><option value="overdue">Tareas vencidas</option><option value="meeting">Citas</option><option value="opportunity">Oportunidades</option><option value="openopp">Oportunidades abiertas</option><option value="wonopp">Oportunidades ganadas</option></select></label><label>Buscar<input id="crm-history-search" type="search" placeholder="Nombre, teléfono, actividad o venta"></label><label>Ordenar<select id="crm-history-sort"><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option><option value="name">Título A-Z</option></select></label></div>
      <p class="crm-client-history-notice" role="status"></p><div class="crm-client-history-list"></div>
      <form class="crm-client-note-form"><h3>Añadir nota al cliente</h3><label>Nota<textarea name="note" maxlength="3000" rows="3" required placeholder="Resumen de llamada, información relevante, próximo paso…"></textarea></label><button type="submit">Guardar nota</button></form>
      <footer><button type="button" id="crm-history-reset">Limpiar filtros</button><button type="button" id="crm-history-copy">Copiar resumen</button><button type="button" id="crm-history-export">Descargar historial CSV</button><button type="button" id="crm-history-refresh">Actualizar</button><button type="button" data-close>Cerrar</button></footer>
    </section>`;
    document.body.append(overlay);
    overlay.querySelector('#crm-client-history-title').textContent=clientName;
    const org=overlay.querySelector('#crm-history-org'),company=overlay.querySelector('#crm-history-company');
    const kind=overlay.querySelector('#crm-history-type'),search=overlay.querySelector('#crm-history-search'),sort=overlay.querySelector('#crm-history-sort');
    const notice=overlay.querySelector('.crm-client-history-notice'),list=overlay.querySelector('.crm-client-history-list');
    const metrics=overlay.querySelector('.crm-client-history-metrics'),form=overlay.querySelector('.crm-client-note-form');
    let items=[],canNote=false,companies=[],capabilities={};
    const message=(value,bad=false)=>{notice.textContent=value;notice.style.color=bad?'#b42318':'#17665d';};
    const onEscape=e=>{if(e.key==='Escape')close();};
    const close=()=>{document.removeEventListener('keydown',onEscape);overlay.remove();};document.addEventListener('keydown',onEscape);
    overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
    overlay.onclick=e=>{if(e.target===overlay)close();};
    function filtered(){
      const q=search.value.trim().toLocaleLowerCase('es');
      const rows=items.filter(item=>{
        if(kind.value==='pending'&&!(item.kind==='task'&&item.pending))return false;
        if(kind.value==='overdue'&&!(item.kind==='task'&&item.overdue))return false;
        if(kind.value==='openopp'&&!(item.kind==='opportunity'&&item.open))return false;
        if(kind.value==='wonopp'&&!(item.kind==='opportunity'&&item.won))return false;
        if(!['pending','overdue','openopp','wonopp','all'].includes(kind.value)&&item.kind!==kind.value&&!(kind.value==='activity'&&item.kind==='meeting'))return false;
        return (item.title+' '+item.detail).toLocaleLowerCase('es').includes(q);
      });
      if(sort.value==='oldest')rows.sort((a,b)=>new Date(a.date)-new Date(b.date));
      else if(sort.value==='name')rows.sort((a,b)=>a.title.localeCompare(b.title,'es'));
      else rows.sort((a,b)=>new Date(b.date)-new Date(a.date));
      return rows;
    }
    function render(){
      const today=Date.now(),pending=items.filter(x=>x.kind==='task'&&x.pending),future=items.filter(x=>x.kind==='meeting'&&new Date(x.date).getTime()>=today);
      const openOpps=items.filter(x=>x.kind==='opportunity'&&x.open),wonOpps=items.filter(x=>x.kind==='opportunity'&&x.won);
      metrics.replaceChildren();for(const [name,value] of [['Contactos',capabilities.contacts?items.filter(x=>x.kind==='contact').length:'—'],['Actividades',items.filter(x=>x.kind==='activity'||x.kind==='meeting').length],['Tareas pendientes',capabilities.tasks?pending.length:'—'],['Tareas vencidas',capabilities.tasks?pending.filter(x=>x.overdue).length:'—'],['Próximas citas',future.length],['Ventas abiertas',capabilities.opportunities?openOpps.length:'—'],['Ventas ganadas',capabilities.opportunities?wonOpps.length:'—'],['Valor abierto',capabilities.opportunities?openOpps.reduce((sum,x)=>sum+Number(x.amount||0),0).toLocaleString('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}):'—'],['Registros',items.length]]){
        const box=el('div','','crm-client-history-metric');box.append(el('strong',String(value)),el('span',name));metrics.append(box);
      }
      list.replaceChildren();const selected=filtered();
      if(!selected.length){list.append(el('p','No hay registros con estos filtros.','crm-client-history-empty'));return;}
      for(const entry of selected){
        const row=el('article','','crm-client-history-item'),date=el('time',new Date(entry.date).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}));
        const badges=el('div','','crm-client-history-tags');
        if(entry.overdue)badges.append(el('span','Vencida','crm-client-history-tag crm-client-history-tag-urgent'));
        if(entry.open)badges.append(el('span','Venta abierta','crm-client-history-tag crm-client-history-tag-open'));
        if(entry.won)badges.append(el('span','Ganada','crm-client-history-tag crm-client-history-tag-won'));
        if(badges.childElementCount)row.append(badges);
        row.append(date,el('strong',entry.title),el('p',entry.detail||'Sin detalles'));
        if(entry.kind==='contact'){
          const actions=el('div','','crm-client-history-quick');
          const phone=String(entry.phone||'').replace(/[^+\d]/g,'');
          if(phone){const call=el('a','Llamar');call.href='tel:'+phone;actions.append(call);}
          const email=String(entry.email||'').trim();
          if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){const mail=el('a','Correo');mail.href='mailto:'+email;actions.append(mail);}
          const copy=el('button','Copiar contacto');copy.type='button';copy.onclick=async()=>{
            try{await navigator.clipboard.writeText([entry.title,entry.phone,entry.email].filter(Boolean).join(' · '));message('Contacto copiado.');}
            catch{message('No se pudo copiar. Comprueba los permisos del navegador.',true);}
          };actions.append(copy);row.append(actions);
        }
        list.append(row);
      }
    }
    async function loadCompanies(){
      message('Cargando clientes…');company.replaceChildren();
      try{
        const allowed=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'clients',p_action:'view'}});
        if(allowed!==true)throw Error('No tienes acceso a los clientes de esta empresa.');
        companies=await api(`companies?select=id,name&organization_id=eq.${encodeURIComponent(org.value)}&order=name&limit=2000`);
        for(const item of companies){const option=el('option',item.name);option.value=item.id;company.append(option);}
        const matches=companies.filter(item=>item.name.trim().toLocaleLowerCase('es')===clientName.toLocaleLowerCase('es'));
        if(matches.length===1)company.value=matches[0].id;
        else company.selectedIndex=-1;
        if(matches.length>1){company.selectedIndex=-1;throw Error('Hay varios clientes con el mismo nombre. Selecciona la ficha correcta antes de consultar o guardar notas.');}
        if(!company.value)throw Error('No se ha localizado un cliente en esta empresa.');
        await load();
      }catch(error){items=[];message(error.message,true);render();}
    }
    async function load(){
      if(!company.value)return;
      message('Cargando historial…');items=[];capabilities={};
      try{
        const [viewActivities,viewTasks,editActivities,viewOpportunities,viewContacts]=await Promise.all([
          api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'agenda',p_action:'view'}}),
          api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'tasks',p_action:'view'}}),
          api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'agenda',p_action:'edit'}}),
          api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'opportunities',p_action:'view'}}),
          api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'contacts',p_action:'view'}})
        ]);
        capabilities={contacts:viewContacts===true,tasks:viewTasks===true,opportunities:viewOpportunities===true};
        for(const option of kind.options){
          if(option.value==='contact')option.disabled=!capabilities.contacts;
          if(['task','pending','overdue'].includes(option.value))option.disabled=!capabilities.tasks;
          if(['opportunity','openopp','wonopp'].includes(option.value))option.disabled=!capabilities.opportunities;
          if(['activity','meeting'].includes(option.value))option.disabled=viewActivities!==true;
        }
        if(kind.selectedOptions[0]?.disabled)kind.value='all';
        canNote=editActivities===true;form.style.display=canNote?'':'none';
        const scope='organization_id=eq.'+encodeURIComponent(org.value)+'&company_id=eq.'+encodeURIComponent(company.value);
        const [activities,tasks,opportunities,contacts]=await Promise.all([
          viewActivities===true?api('activities?select=id,activity_type,subject,description,activity_date,end_date&'+scope+'&order=activity_date.desc&limit=1000'):Promise.resolve([]),
          viewTasks===true?api('tasks?select=id,title,description,status,due_date,created_at,priority&'+scope+'&order=created_at.desc&limit=1000'):Promise.resolve([]),
          viewOpportunities===true?api('opportunities?select=id,title,created_at,estimated_value,probability,expected_close_date,pipeline_stages(name,is_won,is_lost)&'+scope+'&order=created_at.desc&limit=1000'):Promise.resolve([]),
          viewContacts===true?api('contacts?select=id,first_name,last_name,phone,mobile,email,created_at&'+scope+'&order=created_at.desc&limit=1000'):Promise.resolve([])
        ]);
        const labels={call:'Llamada',email:'Correo',meeting:'Cita',note:'Nota',whatsapp:'WhatsApp',proposal:'Propuesta',status_change:'Cambio de estado',system:'Sistema',other:'Actividad'};
        const startToday=new Date();startToday.setHours(0,0,0,0);
        items=[
          ...contacts.map(c=>({kind:'contact',date:c.created_at,title:'Contacto: '+([c.first_name,c.last_name].filter(Boolean).join(' ').trim()||'Sin nombre'),detail:[c.phone||c.mobile,c.email].filter(Boolean).join(' · ')||'Sin teléfono ni correo',type:'Contacto',phone:c.phone||c.mobile,email:c.email})),
          ...activities.map(a=>({kind:a.activity_type==='meeting'?'meeting':'activity',date:a.activity_date,title:(labels[a.activity_type]||'Actividad')+': '+(a.subject||'Sin asunto'),detail:a.description||'',type:labels[a.activity_type]||'Actividad'})),
          ...tasks.map(t=>({kind:'task',date:t.due_date||t.created_at,title:'Tarea: '+t.title,detail:(t.status==='completed'?'Completada':t.status==='pending'?'Pendiente':t.status||'')+(t.description?' · '+t.description:''),type:'Tarea',pending:t.status==='pending'||t.status==='in_progress',overdue:['pending','in_progress'].includes(t.status)&&!!t.due_date&&new Date(t.due_date)<startToday})),
          ...opportunities.map(o=>({kind:'opportunity',date:o.created_at,title:'Oportunidad: '+(o.title||'Sin título'),detail:(o.pipeline_stages?.name||'Sin etapa')+' · '+(o.estimated_value==null?'Sin importe':Number(o.estimated_value).toLocaleString('es-ES',{style:'currency',currency:'EUR'}))+' · '+(o.probability==null?'Sin probabilidad':o.probability+'% probabilidad')+(o.expected_close_date?' · Cierre previsto: '+o.expected_close_date:''),type:'Oportunidad',open:!o.pipeline_stages?.is_won&&!o.pipeline_stages?.is_lost,won:!!o.pipeline_stages?.is_won,amount:o.estimated_value} ))
        ].sort((a,b)=>new Date(b.date)-new Date(a.date));
        render();message(`${items.length} registros cargados.${viewActivities!==true||viewTasks!==true||viewOpportunities!==true||viewContacts!==true?' Algunos módulos no están disponibles para tu perfil.':''}`);
      }catch(error){message(error.message,true);}
    }
    form.onsubmit=async event=>{
      event.preventDefault();const note=form.elements.note.value.trim();if(!note)return;
      const button=form.querySelector('button');button.disabled=true;message('Guardando nota…');
      try{
        if(!company.value||!companies.some(c=>c.id===company.value))throw Error('Selecciona primero la ficha correcta del cliente.');
        if(document.getElementById('active-organization')?.value&&document.getElementById('active-organization').value!==org.value)throw Error('Ha cambiado la empresa activa. Abre de nuevo el seguimiento.');
        const allowed=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'agenda',p_action:'edit'}});
        if(allowed!==true)throw Error('No tienes permiso para registrar notas.');
        const newEntry=await api('activities?select=id',{method:'POST',body:{organization_id:org.value,company_id:company.value,activity_type:'note',subject:'Nota de seguimiento',description:note,activity_date:new Date().toISOString(),user_id:session().user.id}});
        if(!Array.isArray(newEntry)||newEntry.length!==1)throw Error('El guardado no se ha confirmado.');
        form.reset();await load();message('Nota guardada correctamente.');
      }catch(error){message(error.message,true);}finally{button.disabled=false;}
    };
    kind.onchange=render;search.oninput=render;sort.onchange=render;org.onchange=loadCompanies;company.onchange=load;
    overlay.querySelector('#crm-history-reset').onclick=()=>{kind.value='all';search.value='';sort.value='recent';render();};
    overlay.querySelector('#crm-history-copy').onclick=async()=>{
      if(document.getElementById('active-organization')?.value&&document.getElementById('active-organization').value!==org.value){message('Ha cambiado la empresa. Abre de nuevo el seguimiento.',true);return;}
      const name=company.options[company.selectedIndex]?.textContent||clientName;
      const pending=items.filter(x=>x.kind==='task'&&x.pending).length;
      const open=items.filter(x=>x.kind==='opportunity'&&x.open);
      const content=[name,`${capabilities.contacts?items.filter(x=>x.kind==='contact').length:'—'} contactos`,`${capabilities.tasks?pending:'—'} tareas pendientes`,`${capabilities.opportunities?open.length:'—'} oportunidades abiertas`,capabilities.opportunities?'Valor previsto: '+open.reduce((sum,x)=>sum+Number(x.amount||0),0).toLocaleString('es-ES',{style:'currency',currency:'EUR'}):'Valor previsto: no disponible'].join(' · ');
      try{await navigator.clipboard.writeText(content);message('Resumen del cliente copiado.');}
      catch{message('No se pudo copiar. Comprueba los permisos del navegador.',true);}
    };
    overlay.querySelector('#crm-history-refresh').onclick=load;
    overlay.querySelector('#crm-history-export').onclick=()=>exportCsv(filtered().map(x=>({...x,date:new Date(x.date).toLocaleString('es-ES')})),company.options[company.selectedIndex]?.textContent||clientName);
    (async()=>{
      try{
        const organizations=await api('organizations?select=id,name&active=eq.true&order=name');
        if(!organizations.length)throw Error('No hay empresas disponibles.');
        for(const item of organizations){const option=el('option',item.name);option.value=item.id;org.append(option);}
        const current=document.getElementById('active-organization')?.value;
        if(organizations.some(x=>x.id===current)){
          org.value=current;
          org.closest('label').style.display='none';
        }
        await loadCompanies();
      }catch(error){message(error.message,true);}
    })();
  }
  function install(){
    scheduled=false;
    for(const detail of root.querySelectorAll('.company-detail')){
      const header=detail.querySelector('.company-detail-header');
      if(!header||!header.querySelector('.dashboard-kicker')?.textContent.includes('FICHA DE CLIENTE'))continue;
      if(header.querySelector('.crm-client-history-button'))continue;
      const button=el('button','Seguimiento comercial','crm-client-history-button');button.type='button';button.onclick=()=>openClient(detail);
      const close=[...header.querySelectorAll('button')].find(b=>b.textContent.trim()==='Cerrar');
      if(close)close.parentElement.insertBefore(button,close);else header.append(button);
    }
  }
  const style=document.createElement('style');style.textContent=`
    .company-detail-header:has(.crm-client-history-button){justify-content:flex-start;gap:8px;flex-wrap:wrap}
    .company-detail-header:has(.crm-client-history-button)>div:first-child{margin-right:auto}
    .company-detail-header .crm-client-history-button{background:#087f74;color:#fff;border:1px solid #087f74;border-radius:9px;padding:10px 14px;font-weight:750;cursor:pointer;margin:0}
    .crm-client-history-overlay{position:fixed;inset:0;z-index:100004;display:grid;place-items:center;padding:16px;background:#091b31ad}
    .crm-client-history-dialog{box-sizing:border-box;width:min(960px,100%);max-height:92vh;overflow:auto;background:#fff;color:#16314b;padding:24px;border-radius:16px;box-shadow:0 18px 50px #142c4860}
    .crm-client-history-dialog header,.crm-client-history-dialog footer{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .crm-client-history-dialog header small{color:#087f74;font-weight:750}.crm-client-history-dialog h2{margin:4px 0}.crm-client-history-dialog header button{border:0;background:none;font-size:28px;cursor:pointer}
    .crm-client-history-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}.crm-client-history-dialog label{font-size:13px;font-weight:650}
    .crm-client-history-filters{grid-template-columns:repeat(3,minmax(0,1fr))}
    .crm-client-history-dialog input,.crm-client-history-dialog select,.crm-client-history-dialog textarea{box-sizing:border-box;display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #bccad6;border-radius:8px;font:inherit}
    .crm-client-history-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.crm-client-history-metric{background:#f1f9f8;border:1px solid #cce2de;border-radius:9px;padding:12px}
    .crm-client-history-metric strong,.crm-client-history-metric span{display:block}.crm-client-history-metric strong{font-size:24px;color:#087f74}.crm-client-history-metric span{font-size:12px}
    .crm-client-history-notice{min-height:19px;font-size:13px}.crm-client-history-list{display:grid;gap:8px;max-height:300px;overflow:auto}
    .crm-client-history-item{padding:11px 13px;border:1px solid #e0e8ed;border-radius:9px}.crm-client-history-item time{color:#657d90;font-size:12px;margin-right:10px}.crm-client-history-item strong{font-size:14px}.crm-client-history-item p{white-space:pre-wrap;margin:5px 0 0;color:#3f566c;font-size:13px}
    .crm-client-history-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:7px}.crm-client-history-tag{border:1px solid transparent;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:750}.crm-client-history-tag-urgent{background:#fff0ee;color:#b42318;border-color:#f0c9c3}.crm-client-history-tag-open{background:#fff5df;color:#915600;border-color:#f4da9b}.crm-client-history-tag-won{background:#e7f7ec;color:#177245;border-color:#bce1c7}
    .crm-client-history-quick{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.crm-client-history-quick a,.crm-client-history-quick button{display:inline-flex;align-items:center;padding:7px 11px;border:1px solid #c5d9df;border-radius:8px;color:#08776e;background:#f8fcfc;font:inherit;font-size:12px;font-weight:750;text-decoration:none;cursor:pointer}
    .crm-client-note-form{border-top:1px solid #e0e8ed;margin:17px 0;padding-top:10px}.crm-client-note-form h3{font-size:16px}
    .crm-client-history-dialog button{cursor:pointer}.crm-client-note-form button,.crm-client-history-dialog footer button{padding:10px 14px;border:1px solid #087f74;border-radius:8px;background:#fff;color:#08776e;font-weight:700}
    .crm-client-history-dialog footer{justify-content:flex-end;flex-wrap:wrap;gap:12px;margin-top:22px;padding-top:18px;border-top:1px solid #e1e8ed}
    .crm-client-history-dialog footer button{min-height:42px;padding:10px 16px}
    .crm-client-history-dialog footer button:last-child{background:#087f74;color:#fff}
    @media(max-width:520px){.crm-client-history-dialog footer{gap:10px}.crm-client-history-dialog footer button{flex:1 1 140px}}
    .crm-client-note-form button{margin-top:9px;background:#087f74;color:white}.crm-client-history-dialog button:disabled{opacity:.5;cursor:wait}
    @media(max-width:700px){.crm-client-history-controls,.crm-client-history-filters{grid-template-columns:1fr}.crm-client-history-metrics{grid-template-columns:repeat(2,1fr)}.crm-client-history-dialog{padding:15px}}`;
  document.head.append(style);
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(install);}).observe(root,{childList:true,subtree:true});install();
})();
