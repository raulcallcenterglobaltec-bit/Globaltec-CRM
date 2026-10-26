/* Exportación de clientes y contactos con control de permisos, sin modificar registros. */
(() => {
  const root = document.getElementById('root');
  if (!root) return;
  const API = 'https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const SESSION = 'sb-kkyizztxlvjqbplcnhtx-auth-token';
  let scheduled = false;
  function auth() {
    let value;
    try { value = JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch {value = null;}
    if (!value?.access_token || value.expires_at * 1000 <= Date.now()) throw Error('Tu sesión ha caducado. Vuelve a entrar al CRM.');
    return value;
  }
  async function api(path, options={}) {
    const response = await fetch(API + path, {
      method: options.method || 'GET',
      headers: {apikey:KEY,Authorization:'Bearer '+auth().access_token,'Content-Type':'application/json'},
      ...(options.body ? {body:JSON.stringify(options.body)} : {})
    });
    const raw = await response.text();
    let data;
    try {data=raw?JSON.parse(raw):null;} catch {data=null;}
    if (!response.ok) throw Error(data?.message || `Error ${response.status} al consultar datos.`);
    return data;
  }
  function safeCsv(value) {
    let text = value == null ? '' : String(value);
    // Prevent spreadsheet formula injection when opening exported cells.
    if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g,'""') + '"';
  }
  function saveCsv(rows, columns, filename) {
    const lines = [columns.map(column => safeCsv(column[0])).join(';')];
    for (const item of rows) lines.push(columns.map(column => safeCsv(item[column[1]])).join(';'));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');anchor.href=url;anchor.download=filename;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function openDialog(page, heading) {
    if (document.getElementById('crm-export-dialog')) return;
    const modal = document.createElement('div');modal.id='crm-export-dialog';
    modal.innerHTML=`<section class="crm-export-sheet" role="dialog" aria-modal="true" aria-labelledby="crm-export-title">
      <header><h2 id="crm-export-title">Exportar ${page}</h2><button type="button" data-close aria-label="Cerrar">×</button></header>
      <p>Descarga un archivo CSV compatible con Excel. Se exportarán los registros de la empresa elegida a los que tengas acceso.</p>
      <label>Empresa<select id="crm-export-org"></select></label>
      <p id="crm-export-notice" role="status"></p>
      <footer><button type="button" data-close>Cancelar</button><button type="button" id="crm-export-start">Descargar CSV</button></footer>
    </section>`;
    document.body.append(modal);
    const org=modal.querySelector('#crm-export-org'), notice=modal.querySelector('#crm-export-notice');
    const start=modal.querySelector('#crm-export-start');
    const message=(value,bad=false)=>{notice.textContent=value;notice.style.color=bad?'#b42318':'#17665d';};
    modal.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>modal.remove());
    modal.onclick=event=>{if(event.target===modal)modal.remove();};
    const isContacts=page==='Contactos';
    const columns=isContacts ? [
      ['Nombre','first_name'],['Apellidos','last_name'],['Cargo','job_title'],['Teléfono','phone'],['Móvil','mobile'],
      ['Correo','email'],['Empresa','company_name'],['Método preferido','preferred_contact_method'],['Notas','notes'],['Fecha de alta','created_at']
    ] : [
      ['Empresa','name'],['Razón social','legal_name'],['CIF/NIF','tax_id'],['Sector','sector'],['Estado','status'],
      ['Teléfono','phone'],['Correo','email'],['Web','website'],['Dirección','address'],['Ciudad','city'],
      ['Provincia','province'],['Código postal','postal_code'],['País','country'],['Notas','notes'],['Fecha de alta','created_at']
    ];
    const table=isContacts?'contacts':'companies';
    start.onclick=async()=>{
      if(start.disabled||!org.value)return;
      start.disabled=true;
      try {
        const permitted=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org.value,p_module:isContacts?'contacts':'clients',p_action:'view'}});
        if(permitted!==true)throw Error('No tienes permiso para consultar estos registros.');
        const fields=isContacts?'id,first_name,last_name,job_title,phone,mobile,email,preferred_contact_method,notes,created_at,company_id':'id,name,legal_name,tax_id,sector,status,phone,email,website,address,city,province,postal_code,country,notes,created_at';
        const rows=[];
        for(let offset=0;offset<50000;offset+=500){
          message(`Descargando registros: ${rows.length}…`);
          const batch=await api(`${table}?select=${fields}&organization_id=eq.${encodeURIComponent(org.value)}&order=created_at.asc,id.asc&limit=500&offset=${offset}`);
          rows.push(...batch);
          if(batch.length<500)break;
          if(offset===49500)throw Error('La exportación supera 50.000 registros; contacta con administración.');
        }
        if(isContacts){
          const ids=[...new Set(rows.map(item=>item.company_id).filter(Boolean))];
          const companyNames=new Map();
          for(let startAt=0;startAt<ids.length;startAt+=100){
            const subset=ids.slice(startAt,startAt+100);
            const matches=await api(`companies?select=id,name&organization_id=eq.${encodeURIComponent(org.value)}&id=in.(${subset.join(',')})`);
            for(const item of matches)companyNames.set(item.id,item.name);
          }
          for(const item of rows)item.company_name=companyNames.get(item.company_id)||'';
        }
        const name=(org.options[org.selectedIndex]?.textContent||'empresa').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-]/g,'_').slice(0,45);
        const day=new Date().toISOString().slice(0,10);
        saveCsv(rows,columns,`${table}-${name}-${day}.csv`);
        message(`Descargados ${rows.length} registros correctamente.`);
      }catch(error){message(error.message,true);}finally{start.disabled=false;}
    };
    (async()=>{
      try {
        const organizations=await api('organizations?select=id,name&active=eq.true&order=name');
        if(!organizations.length)throw Error('No hay empresas disponibles.');
        for(const item of organizations){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;org.append(option);}
        const kicker=heading.querySelector('.dashboard-kicker')?.textContent||'';
        const selected=organizations.find(item=>kicker.includes(item.name));if(selected)org.value=selected.id;
        message('Elige la empresa y pulsa «Descargar CSV».');
      }catch(error){message(error.message,true);start.disabled=true;}
    })();
  }
  function install() {
    scheduled=false;
    const headings=[...root.querySelectorAll('.dashboard-heading')].filter(heading=>{
      // The CRM can nest headings; only use the innermost heading for the active page.
      const title=heading.querySelector('h1')?.textContent?.trim();
      return (title==='Clientes'||title==='Contactos') && !heading.querySelector('.dashboard-heading') && heading.getClientRects().length>0;
    });
    const selected=headings.find(heading=>[...heading.querySelectorAll('button')].some(button=>/^\+?\s*Nuevo (cliente|contacto)$/i.test(button.textContent.trim()))) || headings[0];
    // Remove buttons previously mounted into the wrong/nested heading.
    for(const existing of root.querySelectorAll('.crm-export-button')){
      if(existing.dataset.crmExportMounted==='true' && selected?.contains(existing))continue;
      existing.remove();
    }
    if(!selected)return;
    const page=selected.querySelector('h1')?.textContent?.trim();
    const action=[...selected.querySelectorAll('button')].find(button=>/^\+?\s*Nuevo (cliente|contacto)$/i.test(button.textContent.trim()));
    const target=action?.parentElement && action.parentElement!==selected ? action.parentElement : selected;
    let button=selected.querySelector('.crm-export-button[data-crm-export-mounted="true"]');
    if(!button){
      button=document.createElement('button');button.type='button';button.className='crm-export-button';button.dataset.crmExportMounted='true';button.textContent='Exportar Excel / CSV';
      button.onclick=()=>openDialog(page,selected);
    }
    if(button.parentElement!==target)target.append(button);
    // Keep export adjacent to the other primary actions.
    if(action && button.nextElementSibling!==action)target.insertBefore(button,action);
  }
  const css=document.createElement('style');css.textContent=`
    .dashboard-heading .crm-export-button{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border:1px solid #0b8075;border-radius:9px;background:#fff;color:#08776e;font:inherit;font-size:13px;font-weight:750;cursor:pointer;margin:0 8px 0 0;white-space:nowrap}
    .dashboard-heading .crm-export-button:hover{background:#eefaf7}
    #crm-export-dialog{position:fixed;inset:0;z-index:100002;display:grid;place-items:center;padding:16px;background:rgba(10,25,43,.65)}
    .crm-export-sheet{box-sizing:border-box;width:min(510px,100%);background:#fff;padding:24px;border-radius:16px;color:#16314b;box-shadow:0 18px 50px #142c4860}
    .crm-export-sheet header,.crm-export-sheet footer{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .crm-export-sheet h2{margin:0}.crm-export-sheet header button{font-size:28px;border:0;background:transparent;cursor:pointer}
    .crm-export-sheet label{display:block;margin:17px 0;font-weight:650}.crm-export-sheet select{display:block;margin-top:7px;width:100%;padding:11px;border:1px solid #b8cad6;border-radius:9px}
    .crm-export-sheet footer button{border:1px solid #bed0dc;border-radius:8px;padding:10px 15px;background:#fff;font-weight:700;cursor:pointer}
    .crm-export-sheet footer #crm-export-start{background:#087f74;color:white;border-color:#087f74}.crm-export-sheet button:disabled{opacity:.6;cursor:wait}`;
  document.head.append(css);
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(install);}).observe(root,{childList:true,subtree:true});
  install();
})();
