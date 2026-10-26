/* Auditoría de calidad de fichas: coincidencias e incompletos por organización. Sin escrituras. */
(() => {
  const root=document.getElementById('root');if(!root)return;
  const API='https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY='sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const TOKEN='sb-kkyizztxlvjqbplcnhtx-auth-token';let scheduled=false;
  function session(){let s;try{s=JSON.parse(localStorage.getItem(TOKEN)||'null');}catch{s=null;}
    if(!s?.access_token||s.expires_at*1000<=Date.now())throw Error('Sesión caducada. Vuelve a entrar al CRM.');return s;}
  async function api(path,options={}){
    const response=await fetch(API+path,{method:options.method||'GET',headers:{apikey:KEY,Authorization:'Bearer '+session().access_token,'Content-Type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});
    const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=null;}
    if(!response.ok)throw Error(data?.message||`Error ${response.status} al consultar las fichas.`);return data;
  }
  function make(tag,label='',cls=''){const e=document.createElement(tag);e.textContent=label;if(cls)e.className=cls;return e;}
  function trim(value){return String(value||'').trim();}
  function norm(value){return trim(value).toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');}
  function phone(value){const n=trim(value).replace(/\D/g,'');return n.length>=8?n.replace(/^34(?=\d{9}$)/,''):'';}
  function csvCell(value){let v=trim(value);if(/^[\s\u0000-\u001f]*[=+@\-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}
  function exportRows(rows,page){
    const headers=['Tipo de incidencia','Motivo','Ficha','Teléfono','Correo','ID'];
    const values=[headers,...rows.map(r=>[r.type,r.reason,r.name,r.phone,r.email,r.id])];
    const data='\ufeff'+values.map(row=>row.map(csvCell).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
    const a=make('a');a.href=url;a.download='revision-'+page.toLowerCase()+'-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function open(page){
    if(document.getElementById('crm-data-quality'))return;
    const overlay=make('div','','crm-quality-overlay');overlay.id='crm-data-quality';
    overlay.innerHTML=`<section class="crm-quality-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-quality-title">
      <header><div><small>CONTROL DE CALIDAD</small><h2 id="crm-quality-title">Revisar datos</h2></div><button type="button" data-close aria-label="Cerrar">×</button></header>
      <p>Detecta posibles fichas duplicadas o incompletas en la empresa que tienes seleccionada. No se borra, fusiona ni modifica nada automáticamente.</p>
      <div class="crm-quality-metrics"></div>
      <div class="crm-quality-controls"><label>Mostrar<select id="crm-quality-view"><option value="duplicates">Posibles duplicados</option><option value="incomplete">Fichas incompletas</option><option value="all">Todas las incidencias</option></select></label><label>Problema<select id="crm-quality-problem"><option value="all">Todos los problemas</option><option value="email">Sin correo</option><option value="phone">Sin teléfono</option><option value="name">Sin nombre</option><option value="tax">Sin CIF/NIF</option></select></label><label>Buscar<input type="search" id="crm-quality-search" placeholder="Nombre, teléfono o correo"></label><label>Ordenar<select id="crm-quality-sort"><option value="name">Nombre (A-Z)</option><option value="type">Tipo de incidencia</option></select></label></div>
      <p class="crm-quality-notice" role="status"></p><div class="crm-quality-results"></div>
      <footer><button type="button" id="crm-quality-export">Descargar revisión CSV</button><button type="button" data-close>Cerrar</button></footer>
    </section>`;
    document.body.append(overlay);
    overlay.querySelector('#crm-quality-title').textContent='Revisar '+page.toLowerCase();
    const notice=overlay.querySelector('.crm-quality-notice'),stats=overlay.querySelector('.crm-quality-metrics'),results=overlay.querySelector('.crm-quality-results');
    const view=overlay.querySelector('#crm-quality-view'),search=overlay.querySelector('#crm-quality-search');
    const problem=overlay.querySelector('#crm-quality-problem'),sort=overlay.querySelector('#crm-quality-sort');
    const message=(value,bad=false)=>{notice.textContent=value;notice.style.color=bad?'#b42318':'#087f74';};
    const close=()=>overlay.remove();overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);overlay.onclick=e=>{if(e.target===overlay)close();};
    let entries=[],issues=[],org='';
    function label(item){return page==='Clientes'?item.name:[item.first_name,item.last_name].filter(Boolean).join(' ')||'Contacto sin nombre';}
    function itemPhone(item){return item.mobile||item.phone||'';}
    function build(){
      issues=[];
      const buckets=new Map();
      const record=new Map(entries.map(item=>[item.id,item]));
      function put(type,key,item){
        if(!key)return;const id=type+':'+key;
        if(!buckets.has(id))buckets.set(id,{type,key,ids:new Set()});buckets.get(id).ids.add(item.id);
      }
      for(const item of entries){
        put('Correo',norm(item.email),item);
        put('Teléfono',phone(item.phone),item);
        if(page==='Contactos')put('Móvil',phone(item.mobile),item);
        else {put('CIF/NIF',norm(item.tax_id),item);put('Nombre exacto',norm(item.name),item);}
      }
      // Agrupar por ficha, aunque coincida en más de un campo o en grupos solapados.
      const parent=new Map(entries.map(item=>[item.id,item.id]));
      function find(id){let p=parent.get(id);while(p!==parent.get(p)){parent.set(p,parent.get(parent.get(p)));p=parent.get(p);}parent.set(id,p);return p;}
      function union(a,b){const x=find(a),y=find(b);if(x!==y)parent.set(y,x);}
      for(const bucket of buckets.values()){
        if(bucket.ids.size<2)continue;
        const ids=[...bucket.ids];for(const id of ids.slice(1))union(ids[0],id);
      }
      const groups=new Map();
      for(const item of entries){const key=find(item.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
      const reasons=new Map();
      for(const bucket of buckets.values()){
        if(bucket.ids.size<2)continue;
        const key=find([...bucket.ids][0]);if(!reasons.has(key))reasons.set(key,new Set());reasons.get(key).add(bucket.type);
      }
      for(const [key,items] of groups){
        if(items.length<2)continue;
        const reason=`Coinciden en ${[...(reasons.get(key)||[])].join(', ')} (${items.length} fichas relacionadas)`;
        for(const item of items)issues.push({kind:'duplicates',type:'Posible duplicado',reason,id:item.id,name:label(item),phone:itemPhone(item),email:item.email||'',problem:''});
      }
      for(const item of entries){
        const lacksPhone=!phone(itemPhone(item))&&!phone(item.phone),lacksEmail=!trim(item.email);
        const lacksName=!trim(label(item))||label(item)==='Contacto sin nombre';
        const reasons=[];
        if(lacksPhone)reasons.push('sin teléfono');if(lacksEmail)reasons.push('sin correo');if(lacksName)reasons.push('sin nombre');
        if(page==='Clientes'&&!trim(item.tax_id))reasons.push('sin CIF/NIF');
        if(reasons.length)issues.push({kind:'incomplete',type:'Ficha incompleta',reason:reasons.join(', '),id:item.id,name:label(item),phone:itemPhone(item),email:item.email||'',problem:[lacksEmail?'email':'',lacksPhone?'phone':'',lacksName?'name':'',page==='Clientes'&&!trim(item.tax_id)?'tax':''].filter(Boolean)});
      }
      stats.replaceChildren();
      const affected=new Set(issues.filter(x=>x.kind==='duplicates').map(x=>x.id));
      for(const [title,value] of [['Registros',entries.length],['Posibles duplicados',affected.size],['Incompletos',issues.filter(x=>x.kind==='incomplete').length]]){
        const box=make('div','','crm-quality-stat');box.append(make('strong',String(value)),make('span',title));stats.append(box);
      }
    }
    function filtered(){const q=norm(search.value);return issues.filter(row=>(view.value==='all'||row.kind===view.value)&&(problem.value==='all'||row.problem?.includes(problem.value))&&norm([row.name,row.phone,row.email,row.reason].join(' ')).includes(q)).sort((a,b)=>sort.value==='type'?(a.type.localeCompare(b.type,'es')||a.name.localeCompare(b.name,'es')):a.name.localeCompare(b.name,'es'));}
    function noticeOutside(value,bad=false){
      let banner=document.getElementById('crm-quality-navigation-notice');
      if(!banner){banner=make('div','','crm-quality-navigation-notice');banner.id='crm-quality-navigation-notice';banner.setAttribute('role','status');document.body.append(banner);}
      banner.textContent=value;banner.style.background=bad?'#a52b22':'#087f74';clearTimeout(noticeOutside.timeout);
      noticeOutside.timeout=setTimeout(()=>banner.remove(),4800);
    }
    async function findInPage(row){
      if(document.getElementById('active-organization')?.value!==org){message('Ha cambiado la empresa activa. Vuelve a abrir la revisión.',true);return;}
      const fieldId=page==='Clientes'?'client-search':'contact-search';
      // El listado de React puede estar desmontado mientras se muestra otra ficha.
      // Cerrar primero y reabrir el módulo permite que reaparezca su buscador.
      close();
      let navigated=false;
      for(let attempt=0;attempt<35;attempt++){
        const target=document.getElementById(fieldId);
        if(target&&target.isConnected&&target.getClientRects().length){
          const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
          if(!setter){noticeOutside('No se puede utilizar el buscador. Abre '+page+' manualmente.',true);return;}
          const term=row.name||row.phone||row.email;
          setter.call(target,term);target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));target.focus();
          target.scrollIntoView({behavior:'smooth',block:'center'});
          noticeOutside('Buscando «'+row.name+'» en '+page+'. Selecciona su ficha para editarla.');return;
        }
        if(!navigated){
          const nav=root.querySelector('aside nav');
          const link=[...(nav?.querySelectorAll('button')||[])].find(x=>x.textContent.trim()===page);
          if(link){link.click();navigated=true;}
        }
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      noticeOutside('No se encontró el buscador de '+page+'. Entra en ese módulo y busca «'+row.name+'».',true);
    }
    function render(){
      results.replaceChildren();const rows=filtered();
      if(!rows.length){results.append(make('p','No hay incidencias con estos filtros.','crm-quality-empty'));return;}
      for(const row of rows.slice(0,500)){
        const item=make('article','','crm-quality-row');
        const info=make('div','','crm-quality-row-info');
        info.append(make('strong',row.name||'Sin nombre'),make('small',row.type+' · '+row.reason),make('small',[row.phone,row.email].filter(Boolean).join(' · ')||'Sin datos de contacto'));
        const action=make('button','Buscar ficha');action.type='button';action.onclick=()=>findInPage(row);
        item.append(info,action);results.append(item);
      }
      message(`${rows.length} incidencias encontradas.${rows.length>500?' Se muestran las primeras 500; descarga el CSV para verlas todas.':''}`);
    }
    view.onchange=()=>{problem.disabled=view.value==='duplicates';if(problem.disabled)problem.value='all';render();};problem.disabled=true;
    problem.onchange=render;sort.onchange=render;search.oninput=render;
    overlay.querySelector('#crm-quality-export').onclick=()=>exportRows(filtered(),page);
    (async()=>{
      try{
        org=document.getElementById('active-organization')?.value||'';
        if(!org)throw Error('Selecciona una empresa en la parte superior del CRM.');
        const module=page==='Clientes'?'clients':'contacts';
        const permitted=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:module,p_action:'view'}});
        if(permitted!==true)throw Error('No tienes acceso a estos datos.');
        const fields=page==='Clientes'?'id,name,email,phone,tax_id':'id,first_name,last_name,email,phone,mobile';
        const table=page==='Clientes'?'companies':'contacts';
        for(let offset=0;offset<10000;offset+=500){
          if(document.getElementById('active-organization')?.value!==org)throw Error('La empresa activa ha cambiado. Vuelve a abrir la revisión.');
          const batch=await api(`${table}?select=${fields}&organization_id=eq.${encodeURIComponent(org)}&order=created_at.desc&limit=500&offset=${offset}`);
          entries.push(...batch);if(batch.length<500)break;
        }
        build();render();
      }catch(error){message(error.message,true);}
    })();
  }
  function install(){
    scheduled=false;
    const headings=[...root.querySelectorAll('.dashboard-heading')].filter(h=>!h.querySelector('.dashboard-heading')&&h.getClientRects().length>0);
    for(const heading of headings){
      const page=heading.querySelector('h1')?.textContent.trim();if(page!=='Clientes'&&page!=='Contactos')continue;
      if(heading.querySelector('.crm-quality-button'))continue;
      const buttons=heading.querySelectorAll('button');
      const action=[...buttons].find(b=>/^\+?\s*Nuevo (cliente|contacto)$/i.test(b.textContent.trim()));
      const target=action?.parentElement&&action.parentElement!==heading?action.parentElement:heading;
      const button=make('button','Revisar datos','crm-quality-button');button.type='button';button.onclick=()=>open(page);
      if(action)target.insertBefore(button,action);else target.append(button);
    }
  }
  const css=document.createElement('style');css.textContent=`
    .dashboard-heading .crm-quality-button{display:inline-flex;align-items:center;padding:10px 14px;border:1px solid #0b8075;border-radius:9px;color:#08776e;background:#fff;font:inherit;font-size:13px;font-weight:750;cursor:pointer;margin:0 8px 0 0;white-space:nowrap}
    .crm-quality-overlay{position:fixed;inset:0;z-index:100006;background:#081a30aa;display:grid;place-items:center;padding:16px}
    .crm-quality-dialog{box-sizing:border-box;width:min(930px,100%);max-height:92vh;overflow:auto;background:#fff;padding:24px;border-radius:16px;color:#16314b;box-shadow:0 18px 50px #142c4860}
    .crm-quality-dialog header,.crm-quality-dialog footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.crm-quality-dialog header small{color:#087f74;font-weight:750}.crm-quality-dialog h2{margin:4px 0}
    .crm-quality-dialog header button{border:0;background:none;font-size:28px;cursor:pointer}.crm-quality-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .crm-quality-stat{border:1px solid #cfe3dd;border-radius:10px;background:#f2f9f7;padding:12px}.crm-quality-stat strong,.crm-quality-stat span{display:block}.crm-quality-stat strong{font-size:25px;color:#087f74}.crm-quality-stat span{font-size:12px}
    .crm-quality-controls{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:15px 0}.crm-quality-dialog label{font-weight:650;font-size:13px}.crm-quality-dialog input,.crm-quality-dialog select{display:block;box-sizing:border-box;width:100%;padding:10px;border:1px solid #bdd0d8;border-radius:8px;margin-top:6px;font:inherit}
    .crm-quality-notice{min-height:19px;font-size:13px}.crm-quality-results{display:grid;gap:8px;max-height:380px;overflow:auto}.crm-quality-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px;border:1px solid #e0e8ed;border-radius:9px}
    .crm-quality-row-info{flex:1;min-width:0}.crm-quality-row-info strong,.crm-quality-row-info small{display:block}.crm-quality-row-info small{color:#667d8b;margin-top:3px}
    .crm-quality-row button,.crm-quality-dialog footer button{padding:9px 13px;border:1px solid #087f74;border-radius:8px;background:#fff;color:#08776e;cursor:pointer;font-weight:700;white-space:nowrap}
    .crm-quality-navigation-notice{position:fixed;bottom:20px;right:20px;z-index:100100;color:#fff;padding:13px 17px;border-radius:10px;box-shadow:0 8px 28px #142c4860;max-width:360px;font-size:13px}
    @media(max-width:720px){.crm-quality-controls{grid-template-columns:1fr}.crm-quality-dialog{padding:15px}.crm-quality-row{flex-wrap:wrap}}`;
  document.head.append(css);
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(install);}).observe(root,{childList:true,subtree:true});install();
})();
