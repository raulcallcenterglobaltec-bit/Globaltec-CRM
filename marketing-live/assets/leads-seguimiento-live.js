/* Panel rápido de leads y próximas acciones; lectura y exportación. */
(() => {
  const root=document.getElementById('root');if(!root)return;
  const API='https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY='sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const TOKEN='sb-kkyizztxlvjqbplcnhtx-auth-token';let scheduled=false;
  function session(){let s;try{s=JSON.parse(localStorage.getItem(TOKEN)||'null');}catch{s=null;}
    if(!s?.access_token||s.expires_at*1000<=Date.now())throw Error('Tu sesión ha caducado. Inicia sesión de nuevo.');return s;}
  async function api(path,opts={}){
    const res=await fetch(API+path,{method:opts.method||'GET',headers:{apikey:KEY,Authorization:'Bearer '+session().access_token,'Content-Type':'application/json'},...(opts.body?{body:JSON.stringify(opts.body)}:{})});
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
      <p>Consulta los contactos que requieren seguimiento, las próximas actuaciones y los leads convertidos. No se cambian estados desde esta ventana.</p>
      <div class="crm-lead-summary-metrics"></div>
      <div class="crm-lead-summary-controls"><label>Ver<select id="crm-lead-summary-view"><option value="attention">Necesitan atención</option><option value="overdue">Seguimiento vencido</option><option value="today">Actuación para hoy</option><option value="upcoming">Próximos siete días</option><option value="noaction">Sin próxima actuación</option><option value="unassigned">Sin responsable</option><option value="nocontact">Sin teléfono ni correo</option><option value="qualified">Cualificados</option><option value="proposal">En propuesta</option><option value="new">Nuevos</option><option value="converted">Convertidos</option><option value="all">Todos</option></select></label><label>Ordenar<select id="crm-lead-summary-sort"><option value="recent">Más recientes</option><option value="action">Próxima actuación</option><option value="name">Nombre A-Z</option></select></label><label>Buscar<input id="crm-lead-summary-search" type="search" placeholder="Persona, empresa o teléfono"></label></div>
      <p class="crm-lead-summary-notice" role="status"></p><div class="crm-lead-summary-list"></div>
      <footer><button type="button" id="crm-lead-summary-export">Exportar CSV</button><button type="button" id="crm-lead-summary-refresh">Actualizar</button><button type="button" data-close>Cerrar</button></footer>
    </section>`;
    document.body.append(overlay);
    const stats=overlay.querySelector('.crm-lead-summary-metrics'),list=overlay.querySelector('.crm-lead-summary-list'),notice=overlay.querySelector('.crm-lead-summary-notice');
    const view=overlay.querySelector('#crm-lead-summary-view'),search=overlay.querySelector('#crm-lead-summary-search'),sort=overlay.querySelector('#crm-lead-summary-sort');
    const message=(value,bad=false)=>{notice.textContent=value;notice.style.color=bad?'#b42318':'#087f74';};
    const close=()=>overlay.remove();overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);overlay.onclick=e=>{if(e.target===overlay)close();};
    let org='',entries=[];
    const active=x=>!['converted','discarded','spam'].includes(x.status);
    const day=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const dueDay=x=>x.next_action_at?day(new Date(x.next_action_at)):'';
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
        info.append(el('strong',row.contact_name||row.company_name||'Lead sin nombre'));
        info.append(el('small',`${row.company_name||'Sin empresa'} · ${row.status||'Sin estado'} · ${row.phone||row.email||'Sin teléfono ni correo'}`));
        const action=el('div','','crm-lead-summary-next');action.append(el('strong',row.next_action||'Sin próxima actuación'));
        action.append(el('small',row.next_action_at?new Date(row.next_action_at).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'Sin fecha'));
        if(active(row)&&(!row.next_action||!row.next_action_at||!row.assigned_to))action.append(el('small',[!row.next_action||!row.next_action_at?'Falta planificar':'',!row.assigned_to?'Sin responsable':''].filter(Boolean).join(' · '),'crm-lead-summary-warning'));
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
    org=document.getElementById('active-organization')?.value||'';
    if(!org)message('Selecciona una empresa en el CRM.',true);else load();
  }
  function install(){
    scheduled=false;
    for(const heading of root.querySelectorAll('.dashboard-heading')){
      if(heading.querySelector('.dashboard-heading')||!heading.getClientRects().length||heading.querySelector('h1')?.textContent.trim()!=='Leads')continue;
      if(heading.querySelector('.crm-lead-summary-button'))continue;
      const group=heading.querySelector('.lead-heading-actions');if(!group)continue;
      const button=el('button','Panel de leads','crm-lead-summary-button');button.type='button';button.onclick=open;group.prepend(button);
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
    .crm-lead-summary-dialog footer button{padding:10px 14px;border:1px solid #087f74;border-radius:9px;background:#fff;color:#08776e;cursor:pointer;font-weight:700}
    @media(max-width:800px){.crm-lead-summary-metrics{grid-template-columns:repeat(2,1fr)}.crm-lead-summary-controls{grid-template-columns:1fr}.crm-lead-summary-dialog{padding:15px}.crm-lead-summary-row{flex-wrap:wrap}}`;
  document.head.append(css);
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(install);}).observe(root,{childList:true,subtree:true});install();
})();
