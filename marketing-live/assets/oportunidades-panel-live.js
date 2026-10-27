/* Panel de oportunidades por empresa, sin escrituras ni cambios de etapa. */
(() => {
  const root=document.getElementById('root');if(!root)return;
  const API='https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY='sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const TOKEN='sb-kkyizztxlvjqbplcnhtx-auth-token';let scheduled=false;
  function session(){let s;try{s=JSON.parse(localStorage.getItem(TOKEN)||'null');}catch{s=null;}
    if(!s?.access_token||s.expires_at*1000<=Date.now())throw Error('Tu sesión ha caducado. Entra de nuevo al CRM.');return s;}
  async function api(path,options={}){
    const res=await fetch(API+path,{method:options.method||'GET',headers:{apikey:KEY,Authorization:'Bearer '+session().access_token,'Content-Type':'application/json',Prefer:'return=representation'},...(options.body?{body:JSON.stringify(options.body)}:{})});
    const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=null;}
    if(!res.ok)throw Error(data?.message||`Error ${res.status} al consultar oportunidades.`);return data;
  }
  const el=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
  const money=n=>Number(n||0).toLocaleString('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0});
  const norm=x=>String(x||'').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function csvCell(value){let s=String(value??'');if(/^[\s\u0000-\u001f]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function download(rows){
    const headers=['Oportunidad','Lead de origen','Cliente','Contacto','Etapa','Importe estimado EUR','Cuota mensual EUR','Probabilidad %','Cierre previsto','Responsable asignado','Tareas pendientes','Tareas vencidas'];
    const values=[headers,...rows.map(r=>[r.title,r.lead_id?leadLabels.get(r.lead_id)||'Lead no disponible':'Sin lead',r.companies?.name||'',r.contacts?[r.contacts.first_name,r.contacts.last_name].filter(Boolean).join(' '):'',r.pipeline_stages?.name||'',r.estimated_value??'',r.monthly_value??'',r.probability??'',r.expected_close_date||'',r.owner_id?'Sí':'No',taskCountsAvailable?(taskCounts.get(r.id)?.pending||0):'No disponible',taskCountsAvailable?(taskCounts.get(r.id)?.overdue||0):'No disponible'])];
    const data='\ufeff'+values.map(row=>row.map(csvCell).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));const a=el('a');a.href=url;
    a.download='globaltec-oportunidades-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  let taskCounts=new Map(),taskCountsAvailable=false,leadLabels=new Map();
  function open(){
    if(document.getElementById('crm-opportunity-dashboard'))return;
    const overlay=el('div','','crm-opp-overlay');overlay.id='crm-opportunity-dashboard';
    overlay.innerHTML=`<section class="crm-opp-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-opp-title">
      <header><div><small>SEGUIMIENTO DE VENTAS</small><h2 id="crm-opp-title">Control de oportunidades</h2></div><button type="button" data-close aria-label="Cerrar">×</button></header>
      <p>Resumen comercial de la empresa seleccionada. Los importes son previsiones según los valores introducidos, no ventas facturadas.</p>
      <div class="crm-opp-metrics"></div>
      <div class="crm-opp-filters"><label>Ver<select id="crm-opp-view"><option value="open">En curso</option><option value="noclient">En curso sin cliente</option><option value="withlead">Con lead de origen</option><option value="withoutlead">Sin lead de origen</option><option value="overdue">Cierre vencido</option><option value="today">Cierre hoy</option><option value="next7">Cierre en 7 días</option><option value="next30">Próximos 30 días</option><option value="nodate">Sin fecha de cierre</option><option value="noamount">Sin importe estimado</option><option value="noprob">Sin probabilidad</option><option value="highprob">Alta probabilidad (70% o más)</option><option value="withtasks">Con tareas pendientes</option><option value="withouttasks">Sin tareas pendientes</option><option value="taskoverdue">Con tareas vencidas</option><option value="unassigned">Sin responsable</option><option value="won">Ganadas</option><option value="lost">Perdidas</option><option value="all">Todas</option></select></label><label>Ordenar<select id="crm-opp-sort"><option value="urgent">Más urgentes</option><option value="recent">Más recientes</option><option value="closing">Cierre más próximo</option><option value="amount">Mayor importe</option><option value="monthly">Mayor cuota mensual</option><option value="probability">Mayor probabilidad</option></select></label><label>Buscar<input id="crm-opp-search" type="search" placeholder="Oportunidad, lead o cliente"></label></div>
      <p class="crm-opp-notice" role="status"></p><div class="crm-opp-list"></div>
      <footer><button type="button" id="crm-opp-reset">Limpiar filtros</button><button type="button" id="crm-opp-export">Exportar CSV</button><button type="button" id="crm-opp-refresh">Actualizar</button><button type="button" data-close>Cerrar</button></footer>
    </section>`;
    document.body.append(overlay);
    const stats=overlay.querySelector('.crm-opp-metrics'),list=overlay.querySelector('.crm-opp-list'),notice=overlay.querySelector('.crm-opp-notice');
    const view=overlay.querySelector('#crm-opp-view'),search=overlay.querySelector('#crm-opp-search'),sort=overlay.querySelector('#crm-opp-sort');
    const message=(value,bad=false)=>{notice.textContent=value;notice.style.color=bad?'#b42318':'#087f74';};
    const onEscape=e=>{if(e.key==='Escape')close();};
    const close=()=>{document.removeEventListener('keydown',onEscape);overlay.remove();};document.addEventListener('keydown',onEscape);
    overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);overlay.onclick=e=>{if(e.target===overlay)close();};
    let org='',records=[],taskSummary=new Map(),taskVisible=false,canEdit=false,forecastBusy=false;
    function stage(row){return row.pipeline_stages?.is_won?'won':row.pipeline_stages?.is_lost?'lost':'open';}
    function expired(row,today){return stage(row)==='open'&&row.expected_close_date&&row.expected_close_date<today;}
    function editForecast(item,row){
      if(forecastBusy||row.querySelector('.crm-opp-forecast-form'))return;
      const form=el('form','','crm-opp-forecast-form');
      form.innerHTML='<h3>Actualizar previsión comercial</h3><p>Solo modifica importes, probabilidad y fecha prevista. El cliente y el lead no cambian.</p><label>Importe estimado (€)<input name="amount" type="number" min="0" max="1000000000000" step="0.01" placeholder="Sin importe"></label><label>Cuota mensual (€)<input name="monthly" type="number" min="0" max="1000000000000" step="0.01" placeholder="Sin cuota"></label><label>Probabilidad (%)<input name="probability" type="number" min="0" max="100" step="1" placeholder="Sin definir"></label><label>Cierre previsto<input name="closing" type="date"></label><output class="crm-opp-forecast-preview"></output><div class="crm-opp-forecast-actions"><button type="submit">Guardar previsión</button><button type="button" data-cancel>Cancelar</button></div>';
      form.elements.amount.value=item.estimated_value??'';form.elements.monthly.value=item.monthly_value??'';form.elements.probability.value=item.probability??'';form.elements.closing.value=item.expected_close_date||'';
      const preview=()=>{const amount=Number(form.elements.amount.value||0),prob=Number(form.elements.probability.value||0);form.querySelector('output').textContent='Previsión ponderada: '+money(amount*prob/100);};
      for(const name of ['amount','probability'])form.elements[name].addEventListener('input',preview);preview();
      form.querySelector('[data-cancel]').onclick=()=>form.remove();row.append(form);
      form.onsubmit=async event=>{
        event.preventDefault();if(forecastBusy)return;forecastBusy=true;
        const submit=form.querySelector('[type="submit"]');submit.disabled=true;
        try{
          if(document.getElementById('active-organization')?.value!==org)throw Error('Ha cambiado la empresa. Abre de nuevo el panel.');
          if(stage(item)!=='open'||!item.stage_id)throw Error('Solo se pueden editar previsiones de oportunidades abiertas.');
          const numeric=(field,max,integer=false)=>{const raw=form.elements[field].value.trim();if(!raw)return null;const value=Number(raw);if(!Number.isFinite(value)||value<0||value>max||(integer&&!Number.isInteger(value)))throw Error('Revisa el valor de '+field+'.');return value;};
          const body={estimated_value:numeric('amount',1e12),monthly_value:numeric('monthly',1e12),probability:numeric('probability',100,true),expected_close_date:form.elements.closing.value||null};
          if(body.expected_close_date&&!/^\d{4}-\d{2}-\d{2}$/.test(body.expected_close_date))throw Error('La fecha de cierre no es válida.');
          const permitted=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'opportunities',p_action:'edit'}});
          if(permitted!==true)throw Error('No tienes permiso para modificar oportunidades.');
          const updated=await api(`opportunities?id=eq.${encodeURIComponent(item.id)}&organization_id=eq.${encodeURIComponent(org)}&stage_id=eq.${encodeURIComponent(item.stage_id)}&updated_at=eq.${encodeURIComponent(item.updated_at)}&select=id,estimated_value,monthly_value,probability,expected_close_date,updated_at`,{method:'PATCH',body});
          if(!Array.isArray(updated)||updated.length!==1||updated[0].id!==item.id)throw Error('La oportunidad ha cambiado desde que abriste el panel. Actualiza antes de guardar.');
          Object.assign(item,updated[0]);render();message('Previsión comercial guardada correctamente.');
        }catch(error){message(error.message,true);submit.disabled=false;}finally{forecastBusy=false;}
      };
    }
    function selected(){
      const now=new Date(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
      const last=new Date(now.getFullYear(),now.getMonth(),now.getDate()+30);const date30=last.getFullYear()+'-'+String(last.getMonth()+1).padStart(2,'0')+'-'+String(last.getDate()).padStart(2,'0');
      const nextWeek=new Date(now.getFullYear(),now.getMonth(),now.getDate()+7);const date7=nextWeek.getFullYear()+'-'+String(nextWeek.getMonth()+1).padStart(2,'0')+'-'+String(nextWeek.getDate()).padStart(2,'0');
      const q=norm(search.value);
      const matching=records.filter(r=>{
        if(view.value==='open'&&stage(r)!=='open')return false;
        if(view.value==='noclient'&&(stage(r)!=='open'||!!r.company_id))return false;
        if(view.value==='withlead'&&!r.lead_id)return false;
        if(view.value==='withoutlead'&&!!r.lead_id)return false;
        if(view.value==='won'&&stage(r)!=='won')return false;
        if(view.value==='lost'&&stage(r)!=='lost')return false;
        if(view.value==='overdue'&&!expired(r,today))return false;
        if(view.value==='today'&&(stage(r)!=='open'||r.expected_close_date!==today))return false;
        if(view.value==='next30'&&(stage(r)!=='open'||!r.expected_close_date||r.expected_close_date<today||r.expected_close_date>date30))return false;
        if(view.value==='next7'&&(stage(r)!=='open'||!r.expected_close_date||r.expected_close_date<today||r.expected_close_date>date7))return false;
        if(view.value==='nodate'&&(stage(r)!=='open'||!!r.expected_close_date))return false;
        if(view.value==='noamount'&&(stage(r)!=='open'||r.estimated_value!=null))return false;
        if(view.value==='noprob'&&(stage(r)!=='open'||r.probability!=null))return false;
        if(view.value==='highprob'&&(stage(r)!=='open'||Number(r.probability||0)<70))return false;
        if(view.value==='withtasks'&&(!taskVisible||stage(r)!=='open'||!(taskSummary.get(r.id)?.pending)))return false;
        if(view.value==='withouttasks'&&(!taskVisible||stage(r)!=='open'||(taskSummary.get(r.id)?.pending||0)>0))return false;
        if(view.value==='taskoverdue'&&(!taskVisible||stage(r)!=='open'||!(taskSummary.get(r.id)?.overdue)))return false;
        if(view.value==='unassigned'&&(stage(r)!=='open'||!!r.owner_id))return false;
        return norm([r.title,r.companies?.name,r.contacts?.first_name,r.contacts?.last_name,r.lead_id?leadLabels.get(r.lead_id):''].join(' ')).includes(q);
      });
      if(sort.value==='amount')matching.sort((a,b)=>Number(b.estimated_value||0)-Number(a.estimated_value||0));
      if(sort.value==='monthly')matching.sort((a,b)=>Number(b.monthly_value||0)-Number(a.monthly_value||0));
      if(sort.value==='probability')matching.sort((a,b)=>Number(b.probability||0)-Number(a.probability||0));
      if(sort.value==='closing')matching.sort((a,b)=>(a.expected_close_date||'9999-12-31').localeCompare(b.expected_close_date||'9999-12-31'));
      if(sort.value==='urgent'){
        const rank=r=>stage(r)!=='open'?4:expired(r,today)?0:taskVisible&&(taskSummary.get(r.id)?.overdue||0)>0?1:r.expected_close_date?2:3;
        matching.sort((a,b)=>rank(a)-rank(b)||(a.expected_close_date||'9999-12-31').localeCompare(b.expected_close_date||'9999-12-31'));
      }
      return matching;
    }
    function render(){
      const openRecords=records.filter(r=>stage(r)==='open');
      const now=new Date(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
      const weighted=openRecords.reduce((sum,r)=>sum+Number(r.estimated_value||0)*(Number(r.probability??0)/100),0);
      const won=records.filter(r=>stage(r)==='won'),lost=records.filter(r=>stage(r)==='lost');
      const metrics=[['En curso',openRecords.length],['Sin cliente',openRecords.filter(r=>!r.company_id).length],['Con lead de origen',records.filter(r=>!!r.lead_id).length],['Ganadas',won.length],['Perdidas',lost.length],['Tasa de éxito',won.length+lost.length?Math.round(won.length/(won.length+lost.length)*100)+'%':'—'],['Cierre vencido',openRecords.filter(r=>expired(r,today)).length],['Cierre hoy',openRecords.filter(r=>r.expected_close_date===today).length],['Sin fecha de cierre',openRecords.filter(r=>!r.expected_close_date).length],['Sin importe',openRecords.filter(r=>r.estimated_value==null).length],['Sin probabilidad',openRecords.filter(r=>r.probability==null).length],['Valor en curso',money(openRecords.reduce((s,r)=>s+Number(r.estimated_value||0),0))],['Importe ganado estimado',money(won.reduce((s,r)=>s+Number(r.estimated_value||0),0))],['Previsión ponderada',money(weighted)],['Sin responsable',openRecords.filter(r=>!r.owner_id).length],['Sin tareas pendientes',taskVisible?openRecords.filter(r=>!(taskSummary.get(r.id)?.pending)).length:'—'],['Con tareas vencidas',taskVisible?openRecords.filter(r=>(taskSummary.get(r.id)?.overdue||0)>0).length:'—']];
      stats.replaceChildren();for(const [label,value] of metrics){const box=el('div','','crm-opp-stat');box.append(el('strong',String(value)),el('span',label));stats.append(box);}
      list.replaceChildren();const rows=selected();
      if(!rows.length){list.append(el('p','No hay oportunidades para estos filtros.','crm-opp-empty'));return;}
      for(const r of rows.slice(0,300)){
        const row=el('article','','crm-opp-item'),info=el('div','','crm-opp-info');
        const badges=el('div','','crm-opp-badges');
        const addBadge=(label,type)=>badges.append(el('span',label,'crm-opp-badge crm-opp-badge-'+type));
        if(stage(r)==='won')addBadge('Ganada','success');
        else if(stage(r)==='lost')addBadge('Perdida','muted');
        else if(expired(r,today))addBadge('Cierre vencido','urgent');
        else if(r.expected_close_date===today)addBadge('Cierre hoy','warning');
        else if(!r.expected_close_date)addBadge('Sin fecha de cierre','warning');
        if(stage(r)==='open'&&r.estimated_value==null)addBadge('Sin importe','warning');
        if(stage(r)==='open'&&!r.company_id)addBadge('Sin cliente','warning');
        if(stage(r)==='open'&&taskVisible&&(taskSummary.get(r.id)?.overdue||0)>0)addBadge('Tarea vencida','urgent');
        if(badges.childElementCount)info.append(badges);
        info.append(el('strong',r.title||'Sin título'));
        info.append(el('small',`${r.companies?.name||'Sin cliente'} · ${r.pipeline_stages?.name||'Sin etapa'} · ${r.expected_close_date||'Sin fecha de cierre'}`));
        info.append(el('small',r.lead_id?`Lead de origen: ${leadLabels.get(r.lead_id)||'No disponible'}`:'Sin lead de origen','crm-opp-origin'));
        if(taskVisible){const t=taskSummary.get(r.id)||{pending:0,overdue:0,next:''};info.append(el('small',`${t.pending} tareas pendientes${t.overdue?' · '+t.overdue+' vencidas':''}${t.next?' · Próxima: '+t.next:' · Sin próxima tarea'}`,'crm-opp-tasks'));}
        const val=el('div','','crm-opp-value');val.append(el('strong',r.estimated_value==null?'Sin importe':money(r.estimated_value)),el('small',r.probability==null?'Sin probabilidad':`${r.probability}% de probabilidad`));
        if(r.monthly_value!=null)val.append(el('small',`${money(r.monthly_value)} / mes`));
        const copy=el('button','Copiar resumen','crm-opp-copy');copy.type='button';copy.onclick=async()=>{
          if(document.getElementById('active-organization')?.value!==org){message('Ha cambiado la empresa. Abre el panel otra vez.',true);return;}
          const summary=[r.title,r.companies?.name||'Sin cliente',r.lead_id?'Lead: '+(leadLabels.get(r.lead_id)||'No disponible'):'Sin lead',r.pipeline_stages?.name||'Sin etapa',money(r.estimated_value),r.expected_close_date||'Sin fecha de cierre'].join(' · ');
          try{await navigator.clipboard.writeText(summary);message('Resumen de la oportunidad copiado.');}
          catch{message('No se pudo copiar. Comprueba los permisos del navegador.',true);}
        };val.append(copy);
        if(stage(r)==='open'){
          if(canEdit){
            const forecast=el('button','Editar previsión','crm-opp-forecast');forecast.type='button';forecast.disabled=forecastBusy;
            forecast.onclick=()=>editForecast(r,row);val.append(forecast);
          }
          const followup=el('button','Crear tarea','crm-opp-followup');followup.type='button';
          followup.title='Preparar una tarea vinculada a esta oportunidad';
          followup.onclick=()=>{
            if(document.getElementById('active-organization')?.value!==org){message('Ha cambiado la empresa activa. Vuelve a abrir el panel.',true);return;}
            close();
            document.dispatchEvent(new CustomEvent('crm:open-followup-task',{detail:{organizationId:org,opportunityId:r.id,companyId:r.company_id||null,contactId:r.contact_id||null,companyName:r.companies?.name||'',title:'Seguimiento: '+(r.title||'oportunidad')}}));
          };
          val.append(followup);
        }
        row.append(info,val);list.append(row);
      }
      message(`${rows.length} oportunidades con el filtro actual.${!taskVisible?' No se pudo consultar el seguimiento de tareas.':''}${rows.length>300?' Se muestran las primeras 300; el CSV incluye todas.':''}`);
    }
    async function load(){
      message('Cargando oportunidades…');records=[];taskSummary=new Map();taskVisible=false;taskCounts=new Map();taskCountsAvailable=false;leadLabels=new Map();list.replaceChildren();
      try{
        const active=document.getElementById('active-organization')?.value;
        if(active!==org)throw Error('Ha cambiado la empresa. Vuelve a abrir el panel.');
        const allowed=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'opportunities',p_action:'view'}});
        if(allowed!==true)throw Error('No tienes permiso para consultar oportunidades.');
        for(let offset=0;offset<10000;offset+=500){
          const page=await api(`opportunities?select=id,title,lead_id,company_id,contact_id,stage_id,updated_at,estimated_value,monthly_value,probability,expected_close_date,owner_id,companies(name),contacts(first_name,last_name),pipeline_stages(name,is_won,is_lost)&organization_id=eq.${encodeURIComponent(org)}&order=created_at.desc&limit=500&offset=${offset}`);
          records.push(...page);if(page.length<500)break;
        }
        canEdit=(await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'opportunities',p_action:'edit'}}).catch(()=>false))===true;
        const leadIds=[...new Set(records.map(r=>r.lead_id).filter(Boolean))];
        if(leadIds.length){
          try{
            const permitted=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'leads',p_action:'view'}});
            if(permitted===true){
              for(let i=0;i<leadIds.length;i+=100){
                const page=await api(`leads?select=id,contact_name,company_name&organization_id=eq.${encodeURIComponent(org)}&id=in.(${leadIds.slice(i,i+100).map(encodeURIComponent).join(',')})`);
                for(const lead of page)leadLabels.set(lead.id,lead.contact_name||lead.company_name||'Lead sin nombre');
              }
            }
          }catch(error){console.warn('Origen de leads no disponible:',error.message);}
        }
        try{
          const allowedTasks=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'tasks',p_action:'view'}});
          if(allowedTasks===true){
            const today=new Date();today.setHours(0,0,0,0);
            for(let offset=0;offset<10000;offset+=500){
              const tasks=await api(`tasks?select=opportunity_id,status,due_date,title&organization_id=eq.${encodeURIComponent(org)}&opportunity_id=not.is.null&order=due_date.asc.nullslast&limit=500&offset=${offset}`);
              for(const t of tasks){if(t.status==='completed'||t.status==='cancelled')continue;
                const s=taskSummary.get(t.opportunity_id)||{pending:0,overdue:0,next:''};s.pending++;
                if(t.due_date&&new Date(t.due_date)<today)s.overdue++;
                if(!s.next&&t.due_date)s.next=new Date(t.due_date).toLocaleDateString('es-ES');
                taskSummary.set(t.opportunity_id,s);
              }
              if(tasks.length<500)break;
            }
            taskVisible=true;
            taskCounts=taskSummary;taskCountsAvailable=true;
          }
        }catch(error){console.warn('Seguimiento de tareas no disponible:',error.message);}
        render();
      }catch(error){message(error.message,true);}
    }
    view.onchange=render;sort.onchange=render;search.oninput=render;overlay.querySelector('#crm-opp-export').onclick=()=>download(selected());
    overlay.querySelector('#crm-opp-refresh').onclick=load;
    overlay.querySelector('#crm-opp-reset').onclick=()=>{view.value='open';sort.value='urgent';search.value='';render();};
    org=document.getElementById('active-organization')?.value||'';
    if(!org)message('Selecciona primero una empresa en el CRM.',true);else load();
  }
  function install(){
    scheduled=false;
    for(const button of root.querySelectorAll('.crm-opp-dashboard-button')){
      if(button.closest('.dashboard-heading')?.querySelector('h1')?.textContent.trim()!=='Oportunidades')button.remove();
    }
    for(const heading of root.querySelectorAll('.dashboard-heading')){
      if(heading.querySelector('.dashboard-heading')||!heading.getClientRects().length||heading.querySelector('h1')?.textContent.trim()!=='Oportunidades')continue;
      if(heading.querySelector('.crm-opp-dashboard-button'))continue;
      const group=heading.querySelector('.lead-heading-actions');if(!group)continue;
      const button=el('button','Panel comercial','crm-opp-dashboard-button');button.type='button';button.onclick=()=>{if(heading.querySelector('h1')?.textContent.trim()==='Oportunidades')open();else button.remove();};group.prepend(button);
    }
  }
  const css=document.createElement('style');css.textContent=`
    .lead-heading-actions .crm-opp-dashboard-button{display:inline-flex;align-items:center;padding:10px 14px;border:1px solid #0b8075;border-radius:9px;background:#fff;color:#08776e;font:inherit;font-size:13px;font-weight:750;cursor:pointer;margin:0}
    .crm-opp-overlay{position:fixed;inset:0;z-index:100007;display:grid;place-items:center;padding:16px;background:#081a30aa}
    .crm-opp-dialog{box-sizing:border-box;width:min(1000px,100%);max-height:92vh;overflow:auto;background:#fff;color:#16314b;padding:24px;border-radius:16px;box-shadow:0 18px 50px #142c4860}
    .crm-opp-dialog header,.crm-opp-dialog footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.crm-opp-dialog h2{margin:4px 0}
    .crm-opp-dialog header small{color:#087f74;font-weight:750}.crm-opp-dialog header button{border:0;background:none;font-size:28px;cursor:pointer}
    .crm-opp-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.crm-opp-stat{border:1px solid #d6e6e3;background:#f2f9f8;padding:12px;border-radius:10px}.crm-opp-stat strong,.crm-opp-stat span{display:block}.crm-opp-stat strong{font-size:23px;color:#087f74}.crm-opp-stat span{font-size:12px;color:#556b7c}
    .crm-opp-filters{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}.crm-opp-dialog label{font-size:13px;font-weight:650}.crm-opp-dialog input,.crm-opp-dialog select{display:block;box-sizing:border-box;width:100%;padding:10px;border:1px solid #bed0dc;border-radius:9px;margin-top:6px;font:inherit}
    .crm-opp-notice{min-height:20px;font-size:13px}.crm-opp-list{max-height:400px;overflow:auto;display:grid;gap:8px}.crm-opp-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;border:1px solid #e1e8ed;border-radius:9px}
    .crm-opp-info{flex:1;min-width:0}.crm-opp-info strong,.crm-opp-info small,.crm-opp-value strong,.crm-opp-value small{display:block}.crm-opp-info small,.crm-opp-value small{color:#687e90;margin-top:5px}.crm-opp-info .crm-opp-tasks{color:#087f74;font-weight:700}.crm-opp-value{text-align:right;white-space:nowrap}
    .crm-opp-value .crm-opp-followup{display:block;margin:8px 0 0 auto;border:1px solid #087f74;background:#fff;color:#087f74;border-radius:8px;padding:7px 10px;font:inherit;font-size:12px;font-weight:750;cursor:pointer}
    .crm-opp-value .crm-opp-copy{display:block;margin:8px 0 0 auto;border:1px solid #c5d9df;background:#f8fcfc;color:#08776e;border-radius:8px;padding:7px 10px;font:inherit;font-size:12px;font-weight:750;cursor:pointer}
    .crm-opp-value .crm-opp-forecast{display:block;margin:8px 0 0 auto;border:1px solid #087f74;background:#e9f7f2;color:#08776e;border-radius:8px;padding:7px 10px;font:inherit;font-size:12px;font-weight:750;cursor:pointer}
    .crm-opp-forecast-form{width:100%;flex:0 0 100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:15px;background:#f5faf8;border:1px solid #cfe5dc;border-radius:10px;text-align:left;white-space:normal}
    .crm-opp-forecast-form h3,.crm-opp-forecast-form p,.crm-opp-forecast-preview,.crm-opp-forecast-actions{grid-column:1/-1;margin:0}.crm-opp-forecast-form h3{font-size:15px}.crm-opp-forecast-form p{color:#526b7b;font-size:12px}.crm-opp-forecast-preview{font-size:13px;font-weight:750;color:#08776e}.crm-opp-forecast-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:9px}.crm-opp-forecast-actions button{border:1px solid #087f74;background:#fff;color:#08776e;border-radius:8px;padding:10px 14px;font-weight:750;cursor:pointer}.crm-opp-forecast-actions button[type=submit]{background:#087f74;color:#fff}.crm-opp-forecast-actions button:disabled{opacity:.6}
    .crm-opp-info .crm-opp-origin{color:#2563a2;font-weight:650}
    .crm-opp-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.crm-opp-badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:750;border:1px solid transparent}.crm-opp-badge-warning{background:#fff5df;color:#915600;border-color:#f4da9b}.crm-opp-badge-urgent{background:#fff0ee;color:#b42318;border-color:#f0c9c3}.crm-opp-badge-success{background:#e7f7ec;color:#177245;border-color:#bce1c7}.crm-opp-badge-muted{background:#eef1f5;color:#536477;border-color:#d9e0e9}
    .crm-opp-dialog footer{justify-content:flex-end;flex-wrap:wrap;gap:12px;margin-top:22px;padding-top:18px;border-top:1px solid #e1e8ed}
    .crm-opp-dialog footer button{min-height:42px;padding:10px 16px;border:1px solid #087f74;border-radius:9px;color:#08776e;background:#fff;cursor:pointer;font-weight:700}
    .crm-opp-dialog footer button:last-child{background:#087f74;color:#fff}
    @media(max-width:720px){.crm-opp-metrics{grid-template-columns:repeat(2,1fr)}.crm-opp-filters,.crm-opp-forecast-form{grid-template-columns:1fr}.crm-opp-dialog{padding:15px}.crm-opp-item{flex-wrap:wrap}.crm-opp-dialog footer{justify-content:stretch;gap:10px}.crm-opp-dialog footer button{flex:1 1 130px}}`;
  document.head.append(css);
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(install);}).observe(root,{childList:true,characterData:true,subtree:true});install();
})();
