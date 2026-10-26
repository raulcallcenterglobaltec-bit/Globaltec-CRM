/* Agenda rápida sobre citas existentes. Mantiene controles de acceso por empresa. */
(() => {
  const root=document.getElementById('root');if(!root)return;
  const BASE='https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY='sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const TOKEN='sb-kkyizztxlvjqbplcnhtx-auth-token';
  let scheduled=false;
  function session(){let s;try{s=JSON.parse(localStorage.getItem(TOKEN)||'null');}catch{s=null;}
    if(!s?.access_token||s.expires_at*1000<=Date.now())throw Error('Sesión caducada. Vuelve a entrar al CRM.');return s;}
  async function api(path,options={}){
    const r=await fetch(BASE+path,{method:options.method||'GET',headers:{apikey:KEY,Authorization:'Bearer '+session().access_token,'Content-Type':'application/json',Prefer:'return=representation'},...(options.body?{body:JSON.stringify(options.body)}:{})});
    const raw=await r.text();let value;try{value=raw?JSON.parse(raw):null;}catch{value=null;}
    if(!r.ok)throw Error(value?.message||`Error ${r.status} al consultar la agenda.`);return value;
  }
  function make(tag,label='',cls=''){const e=document.createElement(tag);e.textContent=label;if(cls)e.className=cls;return e;}
  function localTime(value){const d=new Date(value),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
  function openManager(heading){
    if(document.getElementById('crm-agenda-manager'))return;
    const modal=make('div','','crm-agenda-overlay');modal.id='crm-agenda-manager';
    modal.innerHTML=`<section class="crm-agenda-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-agenda-title">
      <header><h2 id="crm-agenda-title">Gestionar citas</h2><button type="button" data-close aria-label="Cerrar">×</button></header>
      <p>Consulta tus citas por empresa y fecha, revisa las que no tienen cliente vinculado y exporta la agenda. Puedes cambiar la hora o duración con permiso de edición.</p>
      <div class="crm-agenda-summary"></div>
      <div class="crm-agenda-filters">
        <label>Empresa<select id="crm-agenda-org"></select></label>
        <label>Ver<select id="crm-agenda-range"><option value="upcoming">Próximas</option><option value="today">Hoy</option><option value="week">Próximos 7 días</option><option value="no-client">Sin cliente vinculado</option><option value="all">Todas</option></select></label>
        <label>Buscar<input id="crm-agenda-search" placeholder="Asunto o cliente" type="search"></label>
      </div>
      <p class="crm-agenda-notice" role="status"></p><div class="crm-agenda-list"></div>
      <footer><button type="button" id="crm-agenda-export">Exportar CSV</button><button type="button" data-close>Cerrar</button><button type="button" id="crm-agenda-refresh">Actualizar</button></footer>
    </section>`;
    document.body.append(modal);
    const org=modal.querySelector('#crm-agenda-org'),range=modal.querySelector('#crm-agenda-range'),search=modal.querySelector('#crm-agenda-search');
    const list=modal.querySelector('.crm-agenda-list'),notice=modal.querySelector('.crm-agenda-notice');
    const message=(value,bad=false)=>{notice.textContent=value;notice.style.color=bad?'#b42318':'#17665d';};
    modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>modal.remove());
    modal.onclick=event=>{if(event.target===modal)modal.remove();};
    let records=[],canEdit=false,busy=false;
    const dayKey=date=>{const d=new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
    function csvCell(value){let s=String(value??'');if(/^[\s\u0000-\u001f]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
    function exportCsv(){
      const values=[['Cita','Inicio','Fin','Cliente'],...filtered().map(r=>[r.subject||'',r.activity_date||'',r.end_date||'',r.companies?.name||''])];
      const content='\ufeff'+values.map(row=>row.map(csvCell).join(';')).join('\r\n');
      const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=make('a');a.href=url;a.download='globaltec-agenda-'+dayKey(new Date())+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    }
    modal.querySelector('#crm-agenda-export').onclick=exportCsv;
    function filtered(){
      const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      const tomorrow=new Date(start.getTime()+86400000),endWeek=new Date(start.getTime()+7*86400000);
      const q=search.value.trim().toLocaleLowerCase('es');
      return records.filter(item=>{
        const date=new Date(item.activity_date);
        if(range.value==='upcoming'&&date<now)return false;
        if(range.value==='today'&&(date<start||date>=tomorrow))return false;
        if(range.value==='week'&&(date<start||date>=endWeek))return false;
        if(range.value==='no-client'&&item.company_id)return false;
        return ((item.subject||'')+' '+(item.companies?.name||'')).toLocaleLowerCase('es').includes(q);
      });
    }
    function render(){
      list.replaceChildren();const selected=filtered();
      const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate()),tomorrow=new Date(start.getTime()+86400000),week=new Date(start.getTime()+7*86400000);
      const summary=[['Hoy',records.filter(x=>new Date(x.activity_date)>=start&&new Date(x.activity_date)<tomorrow).length,'today'],['Próximos 7 días',records.filter(x=>new Date(x.activity_date)>=start&&new Date(x.activity_date)<week).length,'week'],['Sin cliente',records.filter(x=>!x.company_id).length,'no-client']];
      const panel=modal.querySelector('.crm-agenda-summary');panel.replaceChildren();
      for(const [label,count,value] of summary){const button=make('button','','crm-agenda-summary-item'+(range.value===value?' selected':''));button.type='button';button.append(make('strong',String(count)),make('span',label));button.onclick=()=>{range.value=value;render();};panel.append(button);}
      if(!selected.length){list.append(make('p','No hay citas con esos filtros.','crm-agenda-empty'));return;}
      for(const item of selected){
        const row=make('article','','crm-agenda-row'),detail=make('div','','crm-agenda-info');
        detail.append(make('strong',item.subject||'Cita sin asunto'));
        const date=new Date(item.activity_date);
        const duration=item.end_date?Math.max(0,Math.round((new Date(item.end_date)-date)/60000)):null;
        detail.append(make('small',`${date.toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'})} · ${item.companies?.name||'Sin cliente'}${duration!==null?' · '+duration+' min':''}`));
        row.append(detail);
        if(canEdit){
          const edit=make('button','Reprogramar','crm-agenda-edit');edit.type='button';edit.disabled=busy;
          edit.onclick=()=>{
            if(row.querySelector('.crm-agenda-editor'))return;
            const panel=make('div','','crm-agenda-editor');
            panel.innerHTML='<label>Nuevo inicio<input type="datetime-local" name="start" required></label><label>Duración (minutos)<input type="number" name="minutes" min="5" max="1440" step="5" required></label>';
            const startInput=panel.querySelector('[name="start"]'),minutes=panel.querySelector('[name="minutes"]');
            startInput.value=localTime(item.activity_date);minutes.value=duration&&duration>0?duration:30;
            const save=make('button','Guardar cambio','crm-agenda-save'),cancel=make('button','Cancelar','crm-agenda-cancel');
            save.type=cancel.type='button';cancel.onclick=()=>panel.remove();
            save.onclick=async()=>{
              if(busy)return;busy=true;save.disabled=true;
              try{
                const start=new Date(startInput.value),length=Number(minutes.value);
                if(Number.isNaN(start.getTime())||!Number.isFinite(length)||length<5||length>1440)throw Error('Comprueba fecha y duración.');
                if(document.getElementById('active-organization')?.value&&document.getElementById('active-organization').value!==org.value)throw Error('La empresa activa ha cambiado. Abre de nuevo la agenda.');
                const allowed=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'agenda',p_action:'edit'}});
                if(allowed!==true)throw Error('No tienes permiso para modificar citas.');
                const end=new Date(start.getTime()+length*60000);
                const updated=await api(`activities?id=eq.${encodeURIComponent(item.id)}&organization_id=eq.${encodeURIComponent(org.value)}&activity_type=eq.meeting&select=id,activity_date,end_date`,{method:'PATCH',body:{activity_date:start.toISOString(),end_date:end.toISOString()}});
                if(!Array.isArray(updated)||updated.length!==1||updated[0].id!==item.id)throw Error('El cambio no se ha confirmado.');
                item.activity_date=updated[0].activity_date;item.end_date=updated[0].end_date;
                message('Cita reprogramada correctamente.');render();
              }catch(error){message(error.message,true);}finally{busy=false;save.disabled=false;}
            };
            panel.append(save,cancel);row.append(panel);
          };
          row.append(edit);
        }
        list.append(row);
      }
      message(`${selected.length} citas mostradas de ${records.length} cargadas.`);
    }
    async function load(){
      message('Cargando citas…');list.replaceChildren();records=[];
      try{
        const view=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'agenda',p_action:'view'}});
        if(view!==true)throw Error('No tienes acceso a la agenda de esta empresa.');
        canEdit=(await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:'agenda',p_action:'edit'}}))===true;
        for(let offset=0;offset<10000;offset+=500){
          const batch=await api(`activities?select=id,subject,activity_date,end_date,company_id,companies(name)&organization_id=eq.${encodeURIComponent(org.value)}&activity_type=eq.meeting&order=activity_date.desc,id.desc&limit=500&offset=${offset}`);
          records.push(...batch);if(batch.length<500)break;
        }
        render();
      }catch(error){message(error.message,true);}
    }
    org.onchange=load;range.onchange=render;search.oninput=render;
    modal.querySelector('#crm-agenda-refresh').onclick=load;
    (async()=>{
      try{
        const organizations=await api('organizations?select=id,name&active=eq.true&order=name');
        if(!organizations.length)throw Error('No hay empresas disponibles.');
        for(const item of organizations){const option=make('option',item.name);option.value=item.id;org.append(option);}
        const hint=heading.querySelector('.dashboard-kicker')?.textContent||'';
        const activeOrg=document.getElementById('active-organization')?.value;
        const current=organizations.find(item=>item.id===activeOrg)||organizations.find(item=>hint.includes(item.name));
        if(current)org.value=current.id;
        if(organizations.some(item=>item.id===activeOrg))org.closest('label').style.display='none';
        await load();
      }catch(error){message(error.message,true);}
    })();
  }
  function install(){
    scheduled=false;
    const candidates=[...root.querySelectorAll('.agenda-hero')].filter(h=>h.getClientRects().length>0&&h.querySelector('h1')?.textContent.trim()==='Agenda');
    const heading=candidates[0];
    for(const button of root.querySelectorAll('.crm-agenda-manage-button'))if(!heading?.contains(button))button.remove();
    if(!heading||heading.querySelector('.crm-agenda-manage-button'))return;
    const button=make('button','Gestionar citas','crm-agenda-manage-button');button.type='button';button.onclick=()=>openManager(heading);
    const actionGroup=heading.querySelector('.lead-heading-actions');
    if(actionGroup){const newAppointment=[...actionGroup.querySelectorAll('button')].find(b=>/nueva cita/i.test(b.textContent));if(newAppointment)actionGroup.insertBefore(button,newAppointment);else actionGroup.prepend(button);}
    else heading.append(button);
  }
  const style=document.createElement('style');style.textContent=`
    .agenda-hero .crm-agenda-manage-button{padding:10px 14px;border:1px solid #8ec3bb;border-radius:9px;background:#fff;color:#08776e;font:inherit;font-size:13px;font-weight:750;cursor:pointer;margin-right:8px;white-space:nowrap}
    .crm-agenda-overlay{position:fixed;inset:0;z-index:100003;display:grid;place-items:center;padding:16px;background:#081a30aa}
    .crm-agenda-dialog{box-sizing:border-box;width:min(960px,100%);max-height:91vh;overflow:auto;background:white;color:#16314b;padding:24px;border-radius:16px;box-shadow:0 18px 50px #142c4860}
    .crm-agenda-dialog header,.crm-agenda-dialog footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.crm-agenda-dialog h2{margin:0}
    .crm-agenda-dialog header button{border:0;background:none;font-size:28px;cursor:pointer}
    .crm-agenda-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:16px 0}.crm-agenda-summary-item{padding:10px;border:1px solid #cfe0db;border-radius:9px;background:#f5faf8;text-align:left;cursor:pointer}.crm-agenda-summary-item.selected{border-color:#087f74;background:#e5f5f1}.crm-agenda-summary-item strong,.crm-agenda-summary-item span{display:block}.crm-agenda-summary-item strong{font-size:23px;color:#087f74}.crm-agenda-summary-item span{font-size:12px;color:#587083}
    .crm-agenda-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.crm-agenda-dialog label{font-size:13px;font-weight:650}
    .crm-agenda-dialog input,.crm-agenda-dialog select{display:block;box-sizing:border-box;width:100%;padding:10px;margin-top:6px;border:1px solid #b8cad6;border-radius:8px;font:inherit}
    .crm-agenda-notice{min-height:20px;font-size:13px}.crm-agenda-list{display:grid;gap:7px}.crm-agenda-row{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:12px;border:1px solid #e0e8ee;border-radius:9px}
    .crm-agenda-info{flex:1;min-width:190px}.crm-agenda-info strong,.crm-agenda-info small{display:block}.crm-agenda-info small{color:#687c8e;margin-top:5px}
    .crm-agenda-edit,.crm-agenda-save,.crm-agenda-cancel,.crm-agenda-dialog footer button{padding:9px 13px;border:1px solid #0b8075;border-radius:8px;background:white;color:#08776e;cursor:pointer;font-weight:700}
    .crm-agenda-editor{display:flex;align-items:flex-end;gap:9px;flex-wrap:wrap;width:100%;border-top:1px solid #e1e9ee;padding-top:10px}.crm-agenda-editor label{flex:1;min-width:150px}
    .crm-agenda-save,.crm-agenda-dialog footer #crm-agenda-refresh{background:#087f74;color:#fff}.crm-agenda-empty{color:#64748b}
    @media(max-width:750px){.crm-agenda-filters{grid-template-columns:1fr}.crm-agenda-dialog{padding:16px}}`;
  document.head.append(style);
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(install);}).observe(root,{childList:true,subtree:true});
  install();
})();
