/* Panel de prioridades en Inicio. Solo lectura, con RLS de cada módulo. */
(() => {
  const root=document.getElementById('root');
  if(!root)return;
  const BASE='https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY='sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const SESSION='sb-kkyizztxlvjqbplcnhtx-auth-token';
  let currentOrg='',requestId=0,scheduled=false,cache=null;
  const pad=n=>String(n).padStart(2,'0');
  const dateKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const startOf=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
  function session() {
    let data;try{data=JSON.parse(localStorage.getItem(SESSION)||'null');}catch{data=null;}
    if(!data?.access_token||data.expires_at*1000<=Date.now())throw Error('Inicia sesión para ver las prioridades.');
    return data;
  }
  async function api(path,{method='GET',body}={}) {
    const response=await fetch(BASE+path,{
      method,headers:{apikey:KEY,Authorization:'Bearer '+session().access_token,'Content-Type':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    const raw=await response.text();let result;
    try{result=raw?JSON.parse(raw):null;}catch{result=null;}
    if(!response.ok)throw Error(result?.message||'No se pudieron consultar los datos ('+response.status+').');
    return result;
  }
  async function granted(org,module) {
    return (await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:module,p_action:'view'}}))===true;
  }
  async function all(table,filters,columns,sort) {
    const rows=[];
    for(let offset=0;offset<10000;offset+=1000){
      const page=await api(table+'?select='+columns+'&'+filters+'&order='+sort+'&limit=1000&offset='+offset);
      if(!Array.isArray(page))throw Error('Respuesta no válida para '+table+'.');
      rows.push(...page);if(page.length<1000)return rows;
    }
    throw Error('Demasiados registros para este resumen. Consulta el módulo completo.');
  }
  function el(tag,text='',className='') {const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
  function selectModule(label) {
    const nav=root.querySelector('aside nav');
    const item=[...(nav?.querySelectorAll('button')||[])].find(x=>x.textContent.trim()===label);
    if(item){item.click();window.scrollTo({top:0,behavior:'smooth'});}
  }
  function addList(container,title,records,module,formatter,empty) {
    const block=el('div','','crm-priorities-group');
    const heading=el('h3',title);block.append(heading);
    if(records===null){block.append(el('p','No disponible para tu perfil.','crm-priorities-empty'));}
    else if(!records.length){block.append(el('p',empty,'crm-priorities-empty'));}
    else for(const item of records.slice(0,5)){
      const btn=el('button','','crm-priorities-item');btn.type='button';
      const info=formatter(item);
      btn.append(el('strong',info.title),el('small',info.detail));
      btn.addEventListener('click',()=>selectModule(module));block.append(btn);
    }
    container.append(block);
  }
  function render(panel,data) {
    panel.querySelector('.crm-priorities-body').replaceChildren();
    const body=panel.querySelector('.crm-priorities-body');
    if(data.error){body.append(el('p',data.error,'crm-priorities-error'));return;}
    const now=new Date(),today=dateKey(now),todayStart=startOf(now);
    const tasks=data.tasks;
    const open=tasks?.filter(t=>t.status==='pending'||t.status==='in_progress')||[];
    const overdue=tasks===null?null:open.filter(t=>t.due_date&&startOf(new Date(t.due_date))<todayStart);
    const dueToday=tasks===null?null:open.filter(t=>t.due_date&&dateKey(new Date(t.due_date))===today);
    const meetings=data.meetings;
    const leads=data.leads;
    const stats=el('div','','crm-priorities-stats');
    const metrics=[['Vencidas',overdue?.length??'—','tasks'],['Para hoy',dueToday?.length??'—','tasks'],['Citas de hoy',meetings?.length??'—','agenda'],['Leads de 7 días',leads?.length??'—','leads']];
    for(const [label,value,module] of metrics){
      const box=el('button','','crm-priorities-stat');box.type='button';
      box.append(el('strong',String(value)),el('span',label));
      box.addEventListener('click',()=>selectModule(({tasks:'Tareas',agenda:'Agenda',leads:'Leads'})[module]));
      stats.append(box);
    }
    body.append(stats);
    const lists=el('div','','crm-priorities-lists');
    const taskRows=tasks===null?null:[...(overdue||[]),...(dueToday||[])].sort((a,b)=>new Date(a.due_date)-new Date(b.due_date));
    addList(lists,'Tareas prioritarias',taskRows,'Tareas',t=>({title:t.title||'Tarea',detail:new Date(t.due_date).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'})+(dateKey(new Date(t.due_date))<today?' · Vencida':' · Hoy')}),'No tienes tareas vencidas ni previstas para hoy.');
    addList(lists,'Citas de hoy',meetings,'Agenda',m=>({title:m.subject||'Cita',detail:new Date(m.activity_date).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}),'No hay citas para hoy.');
    addList(lists,'Leads recientes',leads,'Leads',l=>({title:l.contact_name||l.company_name||'Lead',detail:(l.company_name||'Sin empresa')+' · '+(l.status||'Sin estado')}),'No han entrado leads en los últimos siete días.');
    body.append(lists);
    panel.querySelector('.crm-priorities-updated').textContent='Actualizado '+now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  }
  async function load(org,force=false) {
    if(!org)return;
    const panel=document.getElementById('crm-priorities-panel');
    if(!panel)return;
    if(!force&&cache?.org===org){render(panel,cache.data);return;}
    const ticket=++requestId;
    panel.querySelector('.crm-priorities-body').replaceChildren(el('p','Cargando prioridades…','crm-priorities-empty'));
    try{
      session();
      const [tasksOk,agendaOk,leadsOk]=await Promise.all([granted(org,'tasks'),granted(org,'agenda'),granted(org,'leads')]);
      if(ticket!==requestId)return;
      const now=new Date(),today=startOf(now),tomorrow=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
      const week=new Date(today.getFullYear(),today.getMonth(),today.getDate()-6);
      const scope='organization_id=eq.'+encodeURIComponent(org);
      const [t,m,l]=await Promise.all([
        tasksOk?all('tasks',scope+'&status=in.(pending,in_progress)&due_date=not.is.null','id,title,status,due_date','due_date.asc,id.asc'):Promise.resolve(null),
        agendaOk?all('activities',scope+'&activity_type=eq.meeting&activity_date=gte.'+encodeURIComponent(today.toISOString())+'&activity_date=lt.'+encodeURIComponent(tomorrow.toISOString()),'id,subject,activity_date','activity_date.asc,id.asc'):Promise.resolve(null),
        leadsOk?all('leads',scope+'&created_at=gte.'+encodeURIComponent(week.toISOString()),'id,contact_name,company_name,status,created_at','created_at.desc,id.desc'):Promise.resolve(null)
      ]);
      if(ticket!==requestId)return;
      cache={org,data:{tasks:t,meetings:m,leads:l}};
      render(panel,cache.data);
    }catch(error){if(ticket===requestId)render(panel,{error:error.message||'No se pudo cargar el resumen.'});}
  }
  function mount() {
    const select=document.getElementById('active-organization');
    const headings=[...root.querySelectorAll('.dashboard-heading h1')].filter(h=>h.getClientRects().length>0);
    const visiblePage=headings.find(h=>/^(Clientes|Contactos|Tareas|Agenda|Leads|Oportunidades|Archivos|Informes|Marketing)$/i.test(h.textContent.trim()));
    const heading=!visiblePage&&headings.find(h=>h.textContent.includes('Tu negocio'));
    if(!select||!heading){
      // The React shell can retain the previous Inicio dashboard across navigation.
      // A priorities panel must never remain visible on Clientes or Contactos.
      for(const stale of root.querySelectorAll('#crm-priorities-panel'))stale.remove();
      currentOrg='';requestId++;
      return;
    }
    const dashboard=heading.closest('.dashboard');if(!dashboard)return;
    const summary=dashboard.querySelector('.stats-grid');if(!summary)return;
    let panel=dashboard.querySelector('#crm-priorities-panel');
    if(!panel){
      panel=el('section','','crm-priorities-panel');panel.id='crm-priorities-panel';
      const header=el('div','','crm-priorities-header');
      const title=el('div');title.append(el('h2','Prioridades de hoy'),el('p','Vencimientos, citas y nuevos contactos de tu empresa.'));
      const right=el('div','','crm-priorities-tools');right.append(el('small','','crm-priorities-updated'));
      const refresh=el('button','Actualizar','crm-priorities-refresh');refresh.type='button';refresh.onclick=()=>load(select.value,true);
      right.append(refresh);header.append(title,right);
      panel.append(header,el('div','','crm-priorities-body'));
      dashboard.insertBefore(panel,summary);
    }
    if(currentOrg!==select.value){currentOrg=select.value;cache=null;load(currentOrg,true);}
    else if(cache&&panel.querySelector('.crm-priorities-body').childNodes.length===0)render(panel,cache.data);
  }
  new MutationObserver(()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;mount();});
  }).observe(root,{subtree:true,childList:true,characterData:true});
  document.addEventListener('change',event=>{
    if(event.target?.id==='active-organization'){currentOrg='';cache=null;requestId++;requestAnimationFrame(mount);}
  });
  const css=document.createElement('style');
  css.textContent=`.crm-priorities-panel{background:#fff;border:1px solid #dbe5ee;border-radius:15px;padding:22px;margin:0 0 24px;color:#16344e}
  .crm-priorities-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .crm-priorities-header h2{font-size:20px;margin:0 0 4px}.crm-priorities-header p{font-size:13px;color:#64748b;margin:0}
  .crm-priorities-tools{display:flex;align-items:center;gap:12px}.crm-priorities-tools small{color:#718096}
  .crm-priorities-refresh{background:#fff;border:1px solid #b6c5d4;border-radius:8px;padding:9px 13px;color:#1d4c68;font-weight:700;cursor:pointer}
  .crm-priorities-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0}
  .crm-priorities-stat{border:1px solid #d8e4ec;border-radius:10px;background:#f7fbfc;padding:13px;text-align:left;cursor:pointer}
  .crm-priorities-stat strong{display:block;font-size:29px;color:#087f74}.crm-priorities-stat span{font-size:13px;color:#52677b}
  .crm-priorities-lists{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
  .crm-priorities-group{min-width:0;border:1px solid #e1e8ee;border-radius:10px;padding:15px}
  .crm-priorities-group h3{font-size:15px;margin:0 0 9px}.crm-priorities-item{display:block;width:100%;padding:10px 0;background:transparent;border:0;border-bottom:1px solid #ecf1f5;text-align:left;cursor:pointer}
  .crm-priorities-item strong,.crm-priorities-item small{display:block}.crm-priorities-item strong{color:#213e55;font-size:13px}.crm-priorities-item small{color:#718096;font-size:12px;margin-top:4px}
  .crm-priorities-empty,.crm-priorities-error{font-size:13px;color:#64748b}.crm-priorities-error{color:#b42318}
  @media(max-width:900px){.crm-priorities-lists{grid-template-columns:1fr}.crm-priorities-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.append(css);
  mount();
})();
