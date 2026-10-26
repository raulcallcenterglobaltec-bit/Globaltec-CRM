/* Conversión explícita y transaccional de leads/oportunidades a clientes. */
(() => {
  const root=document.getElementById('root');if(!root)return;
  const API='https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
  const KEY='sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
  const TOKEN='sb-kkyizztxlvjqbplcnhtx-auth-token';let scheduled=false;
  function session(){let s;try{s=JSON.parse(localStorage.getItem(TOKEN)||'null');}catch{s=null;}
    if(!s?.access_token||s.expires_at*1000<=Date.now())throw Error('La sesión ha caducado. Entra de nuevo en el CRM.');return s;}
  async function api(path,opts={}){
    const r=await fetch(API+path,{method:opts.method||'GET',headers:{apikey:KEY,Authorization:'Bearer '+session().access_token,'Content-Type':'application/json'},...(opts.body?{body:JSON.stringify(opts.body)}:{})});
    const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=null;}
    if(!r.ok)throw Error(data?.message||`Error ${r.status} al consultar los registros.`);return data;
  }
  function node(tag,content='',cls=''){const e=document.createElement(tag);e.textContent=content;if(cls)e.className=cls;return e;}
  function createModal(source){
    if(document.getElementById('crm-conversion-dialog'))return;
    const overlay=node('div','','crm-conversion-overlay');overlay.id='crm-conversion-dialog';
    overlay.innerHTML=`<section class="crm-conversion-sheet" role="dialog" aria-modal="true" aria-labelledby="crm-conversion-title">
      <header><div><small>CONVERSIÓN COMERCIAL</small><h2 id="crm-conversion-title">Convertir en cliente</h2></div><button type="button" data-close aria-label="Cerrar">×</button></header>
      <p>Selecciona el lead o la oportunidad que ya ha salido adelante. La conversión mantiene su historial y evita duplicados.</p>
      <form id="crm-conversion-form">
        <label>Registro de origen<select id="crm-conversion-source" required><option value="">Selecciona un registro</option></select></label>
        <div class="crm-conversion-preview" role="status">Elige un registro para ver sus datos.</div>
        <label>Nombre del cliente<input id="crm-conversion-name" maxlength="160" required placeholder="Empresa o persona que contrata"></label>
        <label>Vinculación<select id="crm-conversion-company"><option value="">Crear cliente nuevo si no existe otro igual</option></select></label>
        <p class="crm-conversion-help">Si ya existe una ficha en esta empresa, selecciónala. El CRM también comprueba nombres y correos coincidentes antes de crear otra.</p>
        <label class="crm-conversion-confirm"><input type="checkbox" id="crm-conversion-accepted" required> Confirmo que ha aceptado la oferta o ha pasado a ser cliente.</label>
        <p class="crm-conversion-notice" role="status"></p>
        <footer><button type="button" data-close>Cancelar</button><button type="submit" id="crm-conversion-submit">Convertir en cliente</button></footer>
      </form>
    </section>`;
    document.body.append(overlay);
    const form=overlay.querySelector('form'),choice=overlay.querySelector('#crm-conversion-source'),company=overlay.querySelector('#crm-conversion-company');
    const name=overlay.querySelector('#crm-conversion-name'),preview=overlay.querySelector('.crm-conversion-preview');
    const notice=overlay.querySelector('.crm-conversion-notice'),submit=overlay.querySelector('#crm-conversion-submit');
    const message=(value,bad=false)=>{notice.textContent=value;notice.style.color=bad?'#b42318':'#087f74';};
    const close=()=>overlay.remove();overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
    overlay.onclick=e=>{if(e.target===overlay)close();};
    let entries=[],companies=[],contacts=[],organizationId='';
    function current(){return entries.find(x=>x.id===choice.value);}
    function selectItem(){
      const item=current();
      if(!item){preview.textContent='Selecciona un registro para ver sus datos.';name.value='';return;}
      const person=contacts.find(x=>x.id===item.contact_id);
      const linkedCompany=item.converted_company_id||item.company_id||person?.company_id||'';
      const suggestion=item.company_name || person?.first_name && [person.first_name,person.last_name].filter(Boolean).join(' ') || item.contact_name || '';
      name.value=companies.find(x=>x.id===linkedCompany)?.name||suggestion;
      company.value=companies.some(x=>x.id===linkedCompany)?linkedCompany:'';
      if(!company.value){
        const match=companies.find(x=>x.name.trim().toLocaleLowerCase('es')===name.value.trim().toLocaleLowerCase('es') || (item.email&&x.email?.toLowerCase()===item.email.toLowerCase()));
        if(match)company.value=match.id;
      }
      preview.replaceChildren();
      const lines=source==='lead' ? [
        ['Estado',item.status||'Sin estado'],['Persona',item.contact_name||[person?.first_name,person?.last_name].filter(Boolean).join(' ')||'Sin nombre'],
        ['Correo',item.email||person?.email||'Sin correo'],['Teléfono',item.phone||person?.phone||'Sin teléfono']
      ] : [['Oportunidad',item.title||''],['Etapa',item.pipeline_stages?.name||'Sin etapa'],['Contacto',[person?.first_name,person?.last_name].filter(Boolean).join(' ')||'Sin contacto']];
      for(const [key,value] of lines){const line=node('div');line.append(node('strong',key+': '),node('span',value));preview.append(line);}
      if(item.converted_company_id)message('Este lead ya tiene cliente vinculado. Se conservará esa ficha.');
      else message('Comprueba los datos y confirma la conversión.');
    }
    choice.onchange=selectItem;
    form.onsubmit=async e=>{
      e.preventDefault();const item=current();if(!item||submit.disabled)return;
      const active=document.getElementById('active-organization')?.value;
      if(active!==organizationId){message('Ha cambiado la empresa activa. Cierra esta ventana y vuelve a abrirla.',true);return;}
      submit.disabled=true;message('Convirtiendo y vinculando registros…');
      try{
        const result=await api('rpc/crm_convert_to_client',{method:'POST',body:{p_org:organizationId,p_source:source,p_source_id:item.id,p_company_name:name.value.trim(),p_existing_company_id:company.value||null}});
        if(!result?.company_id)throw Error('La conversión no se ha confirmado.');
        preview.replaceChildren(node('strong',`${result.created?'Cliente creado':'Cliente vinculado'} correctamente: ${result.name||name.value}`));
        message('Conversión completada. Se ha conservado el vínculo con los registros originales.');
        submit.textContent='Conversión completada';
        setTimeout(()=>{if(document.body.contains(overlay))location.reload();},1400);
      }catch(error){message(error.message,true);submit.disabled=false;}
    };
    (async()=>{
      try{
        organizationId=document.getElementById('active-organization')?.value||'';
        if(!organizationId)throw Error('Selecciona primero una empresa en la parte superior del CRM.');
        const [clientsOk,sourceOk]=await Promise.all([
          api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:organizationId,p_module:'clients',p_action:'edit'}}),
          api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:organizationId,p_module:source==='lead'?'leads':'opportunities',p_action:'edit'}})
        ]);
        if(clientsOk!==true||sourceOk!==true)throw Error('Necesitas permisos de edición en Clientes y en el módulo de origen.');
        const scope='organization_id=eq.'+encodeURIComponent(organizationId);
        const [rows,clientRows,people]=await Promise.all([
          api(source==='lead'?`leads?select=id,company_name,contact_name,email,phone,status,contact_id,company_id,converted_company_id,created_at&${scope}&order=created_at.desc&limit=1000`:`opportunities?select=id,title,company_id,contact_id,lead_id,created_at,pipeline_stages(name,is_won)&${scope}&order=created_at.desc&limit=1000`),
          api(`companies?select=id,name,email,status&${scope}&order=name&limit=2000`),
          api(`contacts?select=id,first_name,last_name,email,phone,company_id&${scope}&limit=2000`)
        ]);
        entries=rows;companies=clientRows;contacts=people;
        for(const item of entries){const opt=node('option',source==='lead'?(item.contact_name||item.company_name||item.email||'Lead')+' · '+(item.status||''):(item.title||'Oportunidad')+' · '+(item.pipeline_stages?.name||''));opt.value=item.id;choice.append(opt);}
        for(const item of companies){const opt=node('option',item.name);opt.value=item.id;company.append(opt);}
        message(`${entries.length} registros disponibles de la empresa activa.`);
      }catch(error){message(error.message,true);submit.disabled=true;}
    })();
  }
  function install(){
    scheduled=false;
    for(const heading of root.querySelectorAll('.dashboard-heading')){
      if(heading.querySelector('.dashboard-heading')||heading.getClientRects().length===0)continue;
      const title=heading.querySelector('h1')?.textContent.trim();
      if(title!=='Leads'&&title!=='Oportunidades')continue;
      if(heading.querySelector('.crm-convert-client-button'))continue;
      const group=heading.querySelector('.lead-heading-actions');if(!group)continue;
      const button=node('button','Convertir en cliente','crm-convert-client-button');button.type='button';button.onclick=()=>createModal(title==='Leads'?'lead':'opportunity');
      group.prepend(button);
    }
  }
  const style=document.createElement('style');style.textContent=`
    .lead-heading-actions .crm-convert-client-button{display:inline-flex;align-items:center;padding:10px 14px;border:1px solid #0b8075;border-radius:9px;background:white;color:#08776e;font:inherit;font-size:13px;font-weight:750;cursor:pointer;margin-right:8px}
    .crm-conversion-overlay{position:fixed;inset:0;z-index:100005;background:#081a30aa;display:grid;place-items:center;padding:16px}
    .crm-conversion-sheet{box-sizing:border-box;width:min(690px,100%);max-height:92vh;overflow:auto;background:#fff;padding:25px;border-radius:16px;color:#16314b;box-shadow:0 18px 50px #142c4860}
    .crm-conversion-sheet header,.crm-conversion-sheet footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.crm-conversion-sheet header button{border:0;background:none;font-size:29px;cursor:pointer}
    .crm-conversion-sheet header small{color:#087f74;font-weight:750}.crm-conversion-sheet h2{margin:5px 0}.crm-conversion-sheet label{display:block;font-weight:650;margin:14px 0;font-size:13px}
    .crm-conversion-sheet input:not([type=checkbox]),.crm-conversion-sheet select{box-sizing:border-box;width:100%;padding:11px;border:1px solid #bacbd9;border-radius:8px;display:block;margin-top:6px;font:inherit;font-weight:400}
    .crm-conversion-preview{background:#f1f8f7;padding:12px;border:1px solid #d6e8e5;border-radius:9px;font-size:13px;display:grid;gap:5px}.crm-conversion-help{font-size:12px;color:#66798c}
    .crm-conversion-sheet .crm-conversion-confirm{display:flex;align-items:center;gap:9px}.crm-conversion-notice{min-height:20px;font-size:13px}
    .crm-conversion-sheet footer button{padding:11px 15px;border:1px solid #bdd0d8;border-radius:9px;background:white;cursor:pointer;font-weight:750}.crm-conversion-sheet footer #crm-conversion-submit{background:#087f74;color:#fff;border-color:#087f74}.crm-conversion-sheet button:disabled{opacity:.6;cursor:wait}`;
  document.head.append(style);
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(install);}).observe(root,{childList:true,subtree:true});install();
})();
