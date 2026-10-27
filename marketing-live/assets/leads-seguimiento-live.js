/* Panel rápido de leads y próximas acciones; lectura y exportación. */
(() => {
  const root=document.getElementById('root');if(!root)return;
  const API='https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY='sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const TOKEN='sb-kkyizztxlvjqbplcnhtx-auth-token';let scheduled=false;
  function session(){let s;try{s=JSON.parse(localStorage.getItem(TOKEN)||'null');}catch{s=null;}
    if(!s?.access_token||s.expires_at*1000<=Date.now())throw Error('Tu sesión ha caducado. Inicia sesión de nuevo.');return s;}
  async function api(path,opts={}){
    const res=await fetch(API+path,{method:opts.method||'GET',headers:{apikey:KEY,Authorization:'Bearer '+session().access_token,'Content-Type':'application/json',Prefer:'return=representation'},...(opts.body?{body:JSON.stringify(opts.body)}:{})});
    const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=null;}
    if(!res.ok)throw Error(data?.message||`Error ${res.status} al consultar los leads.`);return data;
  }
  function el(tag,label='',cls=''){const x=document.createElement(tag);x.textContent=label;if(cls)x.className=cls;return x;}
  function cell(value){let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+@\-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
  function csv(rows){
    const values=[['Lead','Empresa','Teléfono','Correo','Estado','Próxima actuación','Fecha próxima actuación','Responsable'],...rows.map(x=>[x.contact_name||'',x.company_name||'',x.phone||'',x.email||'',x.status||'',x.next_action||'',x.next_action_at||'',x.assigned_to?'Asignado':'Sin asignar'])];
    const data='\ufeff'+values.map(row=>row.map(cell).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));const a=el('a');a.href=url;a.download='globaltec-leads-seguimiento-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function open(){
    if(document.getElementById('crm-lead-summary'))return;
    const overlay=el('div','','crm-lead-summary-overlay');overlay.id='crm-lead-summary';
    overlay.innerHTML=`<section class="crm-lead-summary-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-lead-summary-title">
      <header><div><small>CONTROL COMERCIAL</small><h2 id="crm-lead-summary-title">Seguimiento de leads</h2></div><button type="button" data-close aria-label="Cerrar">×</button></header>
      <p>Consulta los leads y sus próximas actuaciones. Si hay una venta concreta, puedes crear una oportunidad vinculada al lead sin asignar automáticamente un cliente.</p>
      <div class="crm-lead-summary-metrics"></div>
      <div class="crm-lead-summary-controls"><label>Ver<select id="crm-lead-summary-view"><option value="attention">Necesitan atención</option><option value="overdue">Seguimiento vencido</option><option value="today">Actuación para hoy</option><option value="upcoming">Próximos siete días</option><option value="noaction">Sin próxima actuación</option><option value="unassigned">Sin responsable</option><option value="nocontact">Sin teléfono ni correo</option><option value="qualified">Cualificados</option><option value="proposal">En propuesta</option><option value="new">Nuevos</option><option value="converted">Convertidos</option><option value="all">Todos</option></select></label><label>Ordenar<select id="crm-lead-summary-sort"><option value="urgent">Más urgentes</option><option value="recent">Más recientes</option><option value="action">Próxima actuación</option><option value="name">Nombre A-Z</option></select></label><label>Buscar<input id="crm-lead-summary-search" type="search" placeholder="Persona, empresa o teléfono"></label></div>
      <p class="crm-lead-summary-notice" role="status"></p><div class="crm-lead-summary-list"></div>
      <footer><button type="button" id="crm-lead-summary-reset">Limpiar filtros</button><button type="button" id="crm-lead-summary-export">Exportar CSV</button><button type="button" id="crm-lead-summary-refresh">Actualizar</button><button type="button" data-close>Cerrar</button></footer>
    </section>`;
    document.body.append(overlay);
    const stats=overlay.querySelector('.crm-lead-summary-metrics'),list=overlay.querySelector('.crm-lead-summary-list'),notice=overlay.querySelector('.crm-lead-summary-notice');
    const view=overlay.querySelector('#crm-lead-summary-view'),search=overlay.querySelector('#crm-lead-summary-search'),sort=overlay.querySelector('#crm-lead-summary-sort');
    const message=(value,bad=false)=>{notice.textContent=value;notice.style.color=bad?'#b42318':'#087f74';};
    const onEscape=e=>{if(e.key==='Escape')close();};
    const close=()=>{document.removeEventListener('keydown',onEscape);overlay.remove();};document.addEventListener('keydown',onEscape);
    overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);overlay.onclick=e=>{if(e.target===overlay)close();};
    let org='',entries=[],canEdit=false,canCreateOpportunity=false,busy=false;
    const active=x=>!['converted','discarded','spam'].includes(x.status);
    const day=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const dueDay=x=>x.next_action_at?day(new Date(x.next_action_at)):'';
    const localInputDate=value=>{const d=new Date(value||Date.now()+86400000),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;};
    function plan(item,row){
      if(row.querySelector('.crm-lead-plan'))return;
      const form=el('form','','crm-lead-plan');
      form.innerHTML='<label>Próxima actuación<input name="action" required maxlength="400" placeholder="Llamar, enviar presupuesto, confirmar visita…"></label><label>Fecha y hora<input name="when" required type="datetime-local"></label><div><button type="submit">Guardar</button><button type="button" data-cancel>Cancelar</button></div>';
      form.elements.action.value=item.next_action||'';form.elements.when.value=localInputDate(item.next_action_at);
      form.querySelector('[data-cancel]').onclick=()=>form.remove();
      form.onsubmit=async event=>{
        event.preventDefault();if(busy)return;
        busy=true;const button=form.querySelector('[type="submit"]');button.disabled=true;
        try{
          if(document.getElementById('active-organization')?.value!==org)throw Error('Ha cambiado la empresa activa. Abre el panel de nuevo.');
          if(!active(item))throw Error('El lead ya no permite planificar actuaciones.');
          const action=form.elements.action.value.trim(),when=new Date(form.elements.when.value);
          if(!action||Number.isNaN(when.getTime()))throw Error('Completa la actuación y una fecha válida.');
          const allowed=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'leads',p_action:'edit'}});
          if(allowed!==true)throw Error('No tienes permiso para modificar leads.');
          const updated=await api(`leads?id=eq.${encodeURIComponent(item.id)}&organization_id=eq.${encodeURIComponent(org)}&status=not.in.(converted,discarded,spam)&select=id,next_action,next_action_at`,{method:'PATCH',body:{next_action:action,next_action_at:when.toISOString()}});
          if(!Array.isArray(updated)||updated.length!==1||updated[0].id!==item.id)throw Error('No se confirmó el cambio. Comprueba el estado del lead.');
          item.next_action=updated[0].next_action;item.next_action_at=updated[0].next_action_at;
          render();message('Próxima actuación guardada correctamente.');
        }catch(error){message(error.message,true);button.disabled=false;}finally{busy=false;}
      };
      row.append(form);
    }
    async function newOpportunity(lead,row){
      if(row.querySelector('.crm-lead-opportunity-form'))return;
      const form=el('form','','crm-lead-opportunity-form');
      form.innerHTML='<h3>Nueva oportunidad para este lead</h3><p class="crm-lead-opportunity-hint">Se vincula al lead, sin asignar ningún cliente automáticamente.</p><label>Nombre de la oportunidad<input name="title" required maxlength="180" placeholder="Ej.: Contrato de mantenimiento"></label><label>Etapa<select name="stage" required><option value="">Cargando etapas…</option></select></label><label>Descripción (opcional)<textarea name="description" rows="2" maxlength="2000"></textarea></label><div><button type="submit">Crear oportunidad</button><button type="button" data-cancel>Cancelar</button></div>';
      form.querySelector('[data-cancel]').onclick=()=>form.remove();row.append(form);
      const stagesSelect=form.elements.stage;
      try{
        if(document.getElementById('active-organization')?.value!==org)throw Error('Ha cambiado la empresa. Abre el panel otra vez.');
        const [stages,existing]=await Promise.all([
          api(`pipeline_stages?select=id,name&organization_id=eq.${encodeURIComponent(org)}&active=eq.true&is_won=eq.false&is_lost=eq.false&order=position.asc`),
          api(`opportunities?select=id&organization_id=eq.${encodeURIComponent(org)}&lead_id=eq.${encodeURIComponent(lead.id)}&limit=20`)
        ]);
        if(!stages.length)throw Error('No hay etapas abiertas configuradas para oportunidades.');
        stagesSelect.replaceChildren();for(const stage of stages){const option=el('option',stage.name);option.value=stage.id;stagesSelect.append(option);}
        if(existing.length)form.querySelector('.crm-lead-opportunity-hint').textContent=`Este lead ya tiene ${existing.length}${existing.length===20?' o más':''} oportunidades. Comprueba que la nueva venta es distinta. No se asignará un cliente automáticamente.`;
      }catch(error){message(error.message,true);form.remove();return;}
      form.onsubmit=async event=>{
        event.preventDefault();if(busy)return;busy=true;
        const submit=form.querySelector('[type="submit"]');submit.disabled=true;
        try{
          if(document.getElementById('active-organization')?.value!==org)throw Error('La empresa ha cambiado. Abre el panel otra vez.');
          const title=form.elements.title.value.trim();if(!title||!stagesSelect.value)throw Error('Indica el nombre y la etapa de la oportunidad.');
          const permitted=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'opportunities',p_action:'edit'}});
          if(permitted!==true)throw Error('No tienes permiso para crear oportunidades.');
          const current=await api(`leads?select=id,status&organization_id=eq.${encodeURIComponent(org)}&id=eq.${encodeURIComponent(lead.id)}&limit=1`);
          if(current.length!==1||!active(current[0]))throw Error('El lead ya no está disponible para crear oportunidades.');
          const stage=await api(`pipeline_stages?select=id&organization_id=eq.${encodeURIComponent(org)}&id=eq.${encodeURIComponent(stagesSelect.value)}&active=eq.true&is_won=eq.false&is_lost=eq.false&limit=1`);
          if(stage.length!==1)throw Error('La etapa seleccionada ya no está disponible.');
          const created=await api('opportunities?select=id,title,lead_id',{method:'POST',body:{organization_id:org,lead_id:lead.id,title,stage_id:stagesSelect.value,description:form.elements.description.value.trim()||null}});
          if(!Array.isArray(created)||created.length!==1||created[0].lead_id!==lead.id)throw Error('No se pudo confirmar la creación. Comprueba Oportunidades antes de repetir.');
          form.remove();message(`Oportunidad «${created[0].title}» creada y vinculada al lead. Puedes gestionarla en Oportunidades.`);
        }catch(error){message(error.message,true);submit.disabled=false;}finally{busy=false;}
      };
    }
    function filtered(){
      const now=new Date(),today=day(now),end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+7),last=day(end);
      const q=search.value.toLocaleLowerCase('es').trim();
      const matching=entries.filter(x=>{
        const due=dueDay(x);
        if(view.value==='attention'&&(!active(x)||(!due&&x.status!=='new')||(due&&due>today)))return false;
        if(view.value==='overdue'&&(!active(x)||!due||due>=today))return false;
        if(view.value==='today'&&(!active(x)||due!==today))return false;
        if(view.value==='upcoming'&&(!active(x)||!due||due<today||due>last))return false;
        if(view.value==='noaction'&&(!active(x)||!!x.next_action_at&&!!x.next_action))return false;
        if(view.value==='unassigned'&&(!active(x)||!!x.assigned_to))return false;
        if(view.value==='nocontact'&&(!active(x)||!!x.phone||!!x.email))return false;
        if(view.value==='qualified'&&x.status!=='qualified')return false;
        if(view.value==='proposal'&&x.status!=='proposal')return false;
        if(view.value==='new'&&x.status!=='new')return false;
        if(view.value==='converted'&&x.status!=='converted')return false;
        return [x.contact_name,x.company_name,x.phone,x.email,x.next_action].join(' ').toLocaleLowerCase('es').includes(q);
      });
      if(sort.value==='action')matching.sort((a,b)=>(a.next_action_at||'9999-12-31').localeCompare(b.next_action_at||'9999-12-31'));
      if(sort.value==='urgent'){
        const rank=x=>!active(x)?4:dueDay(x)&&dueDay(x)<today?0:dueDay(x)===today?1:!x.next_action||!x.next_action_at?2:3;
        matching.sort((a,b)=>rank(a)-rank(b)||(a.next_action_at||'9999-12-31').localeCompare(b.next_action_at||'9999-12-31'));
      }
      if(sort.value==='name')matching.sort((a,b)=>(a.contact_name||a.company_name||'').localeCompare(b.contact_name||b.company_name||'','es'));
      return matching;
    }
    function render(){
      const today=day(new Date());const activeLeads=entries.filter(active);
      const metrics=[['Nuevos',entries.filter(x=>x.status==='new').length],['Pendientes',activeLeads.length],['Vencidos',activeLeads.filter(x=>dueDay(x)&&dueDay(x)<today).length],['Cualificados',entries.filter(x=>x.status==='qualified').length],['En propuesta',entries.filter(x=>x.status==='proposal').length],['Sin próxima acción',activeLeads.filter(x=>!x.next_action||!x.next_action_at).length],['Sin responsable',activeLeads.filter(x=>!x.assigned_to).length],['Sin contacto',activeLeads.filter(x=>!x.phone&&!x.email).length],['Convertidos',entries.filter(x=>x.status==='converted').length]];
      stats.replaceChildren();for(const [name,value] of metrics){const box=el('div','','crm-lead-summary-stat');box.append(el('strong',String(value)),el('span',name));stats.append(box);}
      list.replaceChildren();const rows=filtered();
      if(!rows.length){list.append(el('p','No hay leads con estos filtros.','crm-lead-summary-empty'));return;}
      for(const row of rows.slice(0,300)){
        const item=el('article','','crm-lead-summary-row'),info=el('div','','crm-lead-summary-info');
        const badges=el('div','','crm-lead-badges');
        const addBadge=(label,type)=>badges.append(el('span',label,'crm-lead-badge crm-lead-badge-'+type));
        if(active(row)&&dueDay(row)&&dueDay(row)<today)addBadge('Seguimiento vencido','urgent');
        else if(active(row)&&dueDay(row)===today)addBadge('Actuación hoy','warning');
        if(active(row)&&(!row.next_action||!row.next_action_at))addBadge('Sin planificar','warning');
        if(active(row)&&!row.assigned_to)addBadge('Sin responsable','muted');
        if(row.status==='converted')addBadge('Convertido','success');
        if(badges.childElementCount)info.append(badges);
        info.append(el('strong',row.contact_name||row.company_name||'Lead sin nombre'));
        info.append(el('small',`${row.company_name||'Sin empresa'} · ${row.status||'Sin estado'} · ${row.phone||row.email||'Sin teléfono ni correo'}`));
        const quick=el('div','','crm-lead-quick-actions');
        const phone=String(row.phone||'').trim().replace(/[^+\d]/g,'');
        if(phone){const call=el('a','Llamar');call.href='tel:'+phone;quick.append(call);}
        const email=String(row.email||'').trim();
        if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){const mail=el('a','Correo');mail.href='mailto:'+email;quick.append(mail);}
        const copy=el('button','Copiar datos');copy.type='button';copy.onclick=async()=>{
          if(document.getElementById('active-organization')?.value!==org){message('Ha cambiado la empresa. Abre el panel otra vez.',true);return;}
          try{await navigator.clipboard.writeText([row.contact_name,row.company_name,row.phone,row.email].filter(Boolean).join(' · '));message('Datos del lead copiados.');}
          catch{message('No se pudo copiar. Comprueba los permisos del navegador.',true);}
        };quick.append(copy);info.append(quick);
        const action=el('div','','crm-lead-summary-next');action.append(el('strong',row.next_action||'Sin próxima actuación'));
        action.append(el('small',row.next_action_at?new Date(row.next_action_at).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'Sin fecha'));
        if(active(row)&&(!row.next_action||!row.next_action_at||!row.assigned_to))action.append(el('small',[!row.next_action||!row.next_action_at?'Falta planificar':'',!row.assigned_to?'Sin responsable':''].filter(Boolean).join(' · '),'crm-lead-summary-warning'));
        if(canEdit&&active(row)){
          const planButton=el('button',row.next_action_at?'Reprogramar':'Planificar','crm-lead-plan-button');planButton.type='button';
          planButton.onclick=()=>plan(row,item);action.append(planButton);
        }
        if(canCreateOpportunity&&active(row)){
          const opportunityButton=el('button','Crear oportunidad','crm-lead-opportunity-button');opportunityButton.type='button';
          opportunityButton.onclick=()=>newOpportunity(row,item);action.append(opportunityButton);
        }
        item.append(info,action);list.append(item);
      }
      message(`${rows.length} leads encontrados.${rows.length>300?' El CSV incluirá también los no mostrados.':''}`);
    }
    async function load(){
      message('Cargando leads…');entries=[];list.replaceChildren();
      try{
        if(document.getElementById('active-organization')?.value!==org)throw Error('Ha cambiado la empresa activa. Vuelve a abrir el panel.');
        const allowed=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'leads',p_action:'view'}});
        if(allowed!==true)throw Error('No tienes permiso para consultar leads.');
        canEdit=(await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'leads',p_action:'edit'}}).catch(()=>false))===true;
        canCreateOpportunity=(await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'opportunities',p_action:'edit'}}).catch(()=>false))===true;
        for(let offset=0;offset<10000;offset+=500){
          const batch=await api(`leads?select=id,contact_name,company_name,email,phone,status,assigned_to,next_action,next_action_at,created_at&organization_id=eq.${encodeURIComponent(org)}&order=created_at.desc&limit=500&offset=${offset}`);
          entries.push(...batch);if(batch.length<500)break;
        }
        render();
      }catch(error){message(error.message,true);}
    }
    view.onchange=render;sort.onchange=render;search.oninput=render;
    overlay.querySelector('#crm-lead-summary-export').onclick=()=>csv(filtered());
    overlay.querySelector('#crm-lead-summary-refresh').onclick=load;
    overlay.querySelector('#crm-lead-summary-reset').onclick=()=>{view.value='attention';sort.value='urgent';search.value='';render();};
    org=document.getElementById('active-organization')?.value||'';
    if(!org)message('Selecciona una empresa en el CRM.',true);else load();
  }
  function install(){
    scheduled=false;
    for(const button of root.querySelectorAll('.crm-lead-summary-button')){
      if(button.closest('.dashboard-heading')?.querySelector('h1')?.textContent.trim()!=='Leads')button.remove();
    }
    for(const heading of root.querySelectorAll('.dashboard-heading')){
      if(heading.querySelector('.dashboard-heading')||!heading.getClientRects().length||heading.querySelector('h1')?.textContent.trim()!=='Leads')continue;
      if(heading.querySelector('.crm-lead-summary-button'))continue;
      const group=heading.querySelector('.lead-heading-actions');if(!group)continue;
      const button=el('button','Panel de leads','crm-lead-summary-button');button.type='button';button.onclick=()=>{if(heading.querySelector('h1')?.textContent.trim()==='Leads')open();else button.remove();};group.prepend(button);
    }
  }
  const css=document.createElement('style');css.textContent=`
    .lead-heading-actions .crm-lead-summary-button{display:inline-flex;align-items:center;padding:10px 14px;border:1px solid #0b8075;border-radius:9px;color:#08776e;background:#fff;font:inherit;font-size:13px;font-weight:750;cursor:pointer;margin:0}
    .crm-lead-summary-overlay{position:fixed;inset:0;z-index:100008;display:grid;place-items:center;padding:16px;background:#081a30aa}
    .crm-lead-summary-dialog{box-sizing:border-box;width:min(990px,100%);max-height:92vh;overflow:auto;background:#fff;color:#16314b;padding:24px;border-radius:16px;box-shadow:0 18px 50px #142c4860}
    .crm-lead-summary-dialog header,.crm-lead-summary-dialog footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.crm-lead-summary-dialog h2{margin:4px 0}
    .crm-lead-summary-dialog header small{color:#087f74;font-weight:750}.crm-lead-summary-dialog header button{border:0;background:none;font-size:28px;cursor:pointer}
    .crm-lead-summary-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.crm-lead-summary-stat{border:1px solid #d2e4e0;border-radius:10px;background:#f3f9f7;padding:12px}
    .crm-lead-summary-stat strong,.crm-lead-summary-stat span{display:block}.crm-lead-summary-stat strong{font-size:25px;color:#087f74}.crm-lead-summary-stat span{font-size:12px;color:#587083}
    .crm-lead-summary-controls{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:15px 0}.crm-lead-summary-dialog label{font-size:13px;font-weight:650}
    .crm-lead-summary-dialog input,.crm-lead-summary-dialog select{display:block;box-sizing:border-box;width:100%;padding:10px;border:1px solid #bed0dc;border-radius:9px;margin-top:6px;font:inherit}
    .crm-lead-summary-notice{min-height:20px;font-size:13px}.crm-lead-summary-list{display:grid;gap:8px;max-height:400px;overflow:auto}.crm-lead-summary-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;border:1px solid #e1e8ed;border-radius:9px}
    .crm-lead-summary-info{flex:1;min-width:0}.crm-lead-summary-info strong,.crm-lead-summary-info small,.crm-lead-summary-next strong,.crm-lead-summary-next small{display:block}.crm-lead-summary-info small,.crm-lead-summary-next small{color:#687d8c;margin-top:5px}.crm-lead-summary-next{text-align:right;max-width:270px}.crm-lead-summary-next .crm-lead-summary-warning{color:#ae5100;font-weight:750}
    .crm-lead-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.crm-lead-badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:750;border:1px solid transparent}.crm-lead-badge-warning{background:#fff5df;color:#915600;border-color:#f4da9b}.crm-lead-badge-urgent{background:#fff0ee;color:#b42318;border-color:#f0c9c3}.crm-lead-badge-success{background:#e7f7ec;color:#177245;border-color:#bce1c7}.crm-lead-badge-muted{background:#eef1f5;color:#536477;border-color:#d9e0e9}
    .crm-lead-quick-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.crm-lead-quick-actions a,.crm-lead-quick-actions button{display:inline-flex;align-items:center;padding:6px 10px;min-height:30px;border:1px solid #c5d9df;background:#f8fcfc;border-radius:7px;color:#08776e;text-decoration:none;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
    .crm-lead-plan-button{margin-top:9px;border:1px solid #087f74;background:#fff;color:#087f74;border-radius:8px;padding:7px 10px;cursor:pointer;font-size:12px;font-weight:750}.crm-lead-plan{flex:0 0 100%;display:grid;grid-template-columns:1fr 200px auto;align-items:end;gap:9px;padding:12px;background:#f5faf8;border:1px solid #dcebe7;border-radius:9px}.crm-lead-plan label{text-align:left}.crm-lead-plan div{display:flex;gap:5px}.crm-lead-plan button{border:1px solid #087f74;color:#087f74;background:#fff;border-radius:8px;padding:10px;cursor:pointer}.crm-lead-plan button[type=submit]{background:#087f74;color:#fff}
    .crm-lead-opportunity-button{display:block;margin-top:8px;padding:7px 10px;border-radius:8px;border:1px solid #087f74;background:#e9f7f2;color:#08776e;font-weight:750;font-size:12px;cursor:pointer}
    .crm-lead-opportunity-form{flex:0 0 100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px;background:#f2faf7;border:1px solid #cbe6dc;border-radius:10px}
    .crm-lead-opportunity-form h3,.crm-lead-opportunity-hint{grid-column:1/-1;margin:0}.crm-lead-opportunity-form h3{font-size:15px}.crm-lead-opportunity-hint{font-size:12px;color:#526b7b}
    .crm-lead-opportunity-form label{font-size:12px;font-weight:700}.crm-lead-opportunity-form label:has(textarea){grid-column:1/-1}
    .crm-lead-opportunity-form :is(input,select,textarea){box-sizing:border-box;width:100%;padding:10px;margin-top:5px;border:1px solid #b8d4cc;border-radius:8px;font:inherit}
    .crm-lead-opportunity-form>div{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}.crm-lead-opportunity-form button{padding:10px;border:1px solid #087f74;border-radius:8px;background:white;color:#087f74;font-weight:700;cursor:pointer}.crm-lead-opportunity-form button[type=submit]{background:#087f74;color:white}.crm-lead-opportunity-form button:disabled{opacity:.6}
    .crm-lead-summary-dialog footer{justify-content:flex-end;flex-wrap:wrap;gap:12px;margin-top:22px;padding-top:18px;border-top:1px solid #e1e8ed}
    .crm-lead-summary-dialog footer button{min-height:42px;padding:10px 16px;border:1px solid #087f74;border-radius:9px;background:#fff;color:#08776e;cursor:pointer;font-weight:700}
    .crm-lead-summary-dialog footer button:last-child{background:#087f74;color:#fff}
    @media(max-width:520px){.crm-lead-summary-dialog footer{gap:10px}.crm-lead-summary-dialog footer button{flex:1 1 130px}}
    @media(max-width:800px){.crm-lead-summary-metrics{grid-template-columns:repeat(2,1fr)}.crm-lead-summary-controls{grid-template-columns:1fr}.crm-lead-summary-dialog{padding:15px}.crm-lead-summary-row{flex-wrap:wrap}.crm-lead-plan,.crm-lead-opportunity-form{grid-template-columns:1fr}}`;
  document.head.append(css);
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(install);}).observe(root,{childList:true,characterData:true,subtree:true});install();
})();
