const BASE = 'https://kkyizztxlvjqbplcnhtx.supabase.co/rest/v1/';
const KEY = 'sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
const SESSION_KEY = 'sb-kkyizztxlvjqbplcnhtx-auth-token';
const $ = id => document.getElementById(id);
const state = { org: '', rows: null, summary: null, busy: false };
const money = amount => new Intl.NumberFormat('es-ES', {style:'currency',currency:'EUR',maximumFractionDigits:0}).format(amount);
const number = count => new Intl.NumberFormat('es-ES').format(count);
const percent = value => new Intl.NumberFormat('es-ES', {style:'percent',maximumFractionDigits:1}).format(value);
const statusNames = {new:'Nuevo',pending:'Pendiente',contacted:'Contactado',proposal:'Propuesta',won:'Ganado',lost:'Perdido',converted:'Convertido'};

function auth() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { saved = null; }
  if (!saved?.access_token || !saved?.user?.id || saved.expires_at * 1000 <= Date.now()) {
    throw Error('Tu sesión ha caducado. Inicia sesión en el CRM y vuelve al informe.');
  }
  return saved;
}
async function api(path, {method='GET',body}={}) {
  const response = await fetch(BASE + path, {
    method,
    headers:{apikey:KEY,Authorization:'Bearer ' + auth().access_token,'Content-Type':'application/json'},
    ...(body === undefined ? {} : {body:JSON.stringify(body)})
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) throw Error(data?.message || `No se han podido consultar los informes (${response.status}).`);
  return data;
}
async function allRows(table, columns, filters) {
  const rows = [];
  for (let offset=0;offset<20000;offset+=1000) {
    const batch = await api(`${table}?select=${columns}&${filters}&order=created_at.desc,id.desc&limit=1000&offset=${offset}`);
    if (!Array.isArray(batch)) throw Error('Respuesta inesperada al consultar ' + table + '.');
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
  throw Error('El rango contiene más de 20.000 registros. Reduce las fechas para obtener cifras completas.');
}
function isoDay(value, exclusiveEnd=false) {
  const [year,month,day] = value.split('-').map(Number);
  const local = new Date(year,month-1,day+(exclusiveEnd?1:0),0,0,0);
  if (Number.isNaN(local.getTime())) throw Error('Selecciona fechas válidas.');
  return local.toISOString();
}
function notice(message='',bad=false) {
  $('notice').textContent=message;
  $('notice').className='notice' + (bad?' error':message?'':'');
}
function addOption(select,id,name) {
  const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option);
}
function group(rows,key) {
  const result=new Map();
  for (const row of rows) {
    const name=key(row);
    if (!result.has(name)) result.set(name,[]);
    result.get(name).push(row);
  }
  return [...result].map(([name,items])=>({name,items})).sort((a,b)=>b.items.length-a.items.length||a.name.localeCompare(b.name,'es'));
}
function converted(lead) { return Boolean(lead.converted_at) || lead.status==='converted'; }
function div(className,text='') {const node=document.createElement('div');node.className=className;node.textContent=text;return node;}
function bars(target,items) {
  const container=$(target);container.replaceChildren();
  if (!items.length) {container.append(div('report-empty','No hay registros en estas fechas.'));return;}
  const max=Math.max(1,...items.map(x=>x.items.length));
  for (const item of items) {
    const row=div('report-bar-row'),head=div('report-bar-head');
    const label=document.createElement('span');label.textContent=item.name;
    const count=document.createElement('strong');count.textContent=number(item.items.length);
    head.append(label,count);
    const track=div('report-track'),fill=div('report-fill');fill.style.width=(item.items.length/max*100)+'%';
    track.append(fill);row.append(head,track);container.append(row);
  }
}
function tableRows(target,records,columns) {
  const body=$(target);body.replaceChildren();
  if (!records.length) {
    const tr=document.createElement('tr'),td=document.createElement('td');
    td.colSpan=columns.length;td.textContent='No hay datos en el período.';tr.append(td);body.append(tr);return;
  }
  for (const record of records) {
    const tr=document.createElement('tr');
    for (const column of columns) {const td=document.createElement('td');td.textContent=column(record);tr.append(td);}
    body.append(tr);
  }
}
function render(leads,opportunities,sources,stages,profiles) {
  const sourceName=new Map(sources.map(s=>[s.id,s.name]));
  const stageName=new Map(stages.map(s=>[s.id,s.name]));
  const ownerName=new Map(profiles.map(p=>[p.id,p.full_name]));
  const convertedLeads=leads.filter(converted);
  const totalValue=opportunities.reduce((sum,item)=>sum+(Number(item.estimated_value)||0),0);
  $('metric-leads').textContent=number(leads.length);
  $('metric-converted').textContent=number(convertedLeads.length);
  $('metric-rate').textContent=percent(leads.length?convertedLeads.length/leads.length:0);
  $('metric-opportunities').textContent=number(opportunities.length);
  $('metric-value').textContent=money(totalValue);
  const byStatus=group(leads,lead=>statusNames[lead.status]||lead.status||'Sin estado');
  const bySource=group(leads,lead=>sourceName.get(lead.source_id)||lead.utm_source||lead.landing_identifier||'Sin origen');
  const byOwner=group(leads,lead=>lead.assigned_to?(ownerName.get(lead.assigned_to)||'Usuario '+lead.assigned_to.slice(0,8)):'Sin asignar');
  const byStage=group(opportunities,item=>stageName.get(item.stage_id)||'Sin etapa identificada');
  bars('status-bars',byStatus);bars('source-bars',bySource);
  tableRows('owner-rows',byOwner,[item=>item.name,item=>number(item.items.length),item=>number(item.items.filter(converted).length),item=>percent(item.items.filter(converted).length/item.items.length)]);
  tableRows('stage-rows',byStage,[item=>item.name,item=>number(item.items.length),item=>money(item.items.reduce((sum,row)=>sum+(Number(row.estimated_value)||0),0))]);
  state.summary={leads:leads.length,converted:convertedLeads.length,rate:leads.length?convertedLeads.length/leads.length:0,opportunities:opportunities.length,value:totalValue,byStatus,bySource,byOwner,byStage};
  $('results').hidden=false;$('export').disabled=false;
}
async function loadReport() {
  if(state.busy)return;
  const requestedOrg=state.org;
  const from=$('date-from').value,to=$('date-to').value;
  if(!from||!to||from>to){notice('Selecciona un intervalo de fechas correcto.',true);return;}
  state.busy=true;$('results').hidden=true;$('export').disabled=true;state.summary=null;
  notice('Calculando resultados del período…');
  try {
    const org=state.org;
    const allowed=await api('rpc/crm_has_module_permission',{method:'POST',body:{p_org:org,p_module:'reports',p_action:'view'}});
    if(allowed!==true)throw Error('No tienes permisos para consultar informes de esta empresa.');
    const filters=`organization_id=eq.${encodeURIComponent(org)}&created_at=gte.${encodeURIComponent(isoDay(from))}&created_at=lt.${encodeURIComponent(isoDay(to,true))}`;
    const [leads,opportunities]=await Promise.all([
      allRows('leads','id,status,source_id,landing_identifier,utm_source,assigned_to,converted_at,created_at',filters),
      allRows('opportunities','id,stage_id,estimated_value,monthly_value,created_at',filters)
    ]);
    if(state.org!==org)return;
    const ownerIds=[...new Set(leads.map(x=>x.assigned_to).filter(id=>/^[0-9a-f-]{36}$/i.test(id)))];
    const optional=await Promise.allSettled([
      api('lead_sources?select=id,name&organization_id=eq.'+encodeURIComponent(org)),
      api('pipeline_stages?select=id,name&organization_id=eq.'+encodeURIComponent(org)),
      ownerIds.length?api('profiles?select=id,full_name&id=in.('+ownerIds.join(',')+')'):Promise.resolve([])
    ]);
    if(state.org!==org)return;
    const [sources,stages,profiles]=optional.map(x=>x.status==='fulfilled'&&Array.isArray(x.value)?x.value:[]);
    render(leads,opportunities,sources,stages,profiles);
    notice('Informe actualizado. Los totales corresponden a los registros visibles para tu empresa.');
  } catch(error) {notice(error.message,true);}
  finally {
    state.busy=false;
    if (state.org!==requestedOrg) loadReport();
  }
}
function exportCsv() {
  const s=state.summary;if(!s)return;
  const data=[['Sección','Nombre','Total','Convertidos','Importe estimado EUR'],
    ['Resumen','Leads',s.leads,s.converted,''],['Resumen','Conversión (%)',(s.rate*100).toFixed(1),'',''],
    ['Resumen','Oportunidades',s.opportunities,'',s.value],
    ...s.byStatus.map(x=>['Estado',x.name,x.items.length,'','']),
    ...s.bySource.map(x=>['Origen',x.name,x.items.length,'','']),
    ...s.byOwner.map(x=>['Responsable',x.name,x.items.length,x.items.filter(converted).length,'']),
    ...s.byStage.map(x=>['Etapa',x.name,x.items.length,'',x.items.reduce((sum,row)=>sum+(Number(row.estimated_value)||0),0)])];
  const safe=value=>{
    const s=String(value??'');
    const protectedValue=/^[\s]*[=+@\-]/.test(s)?"'"+s:s;
    return '"'+protectedValue.replaceAll('"','""')+'"';
  };
  const csv='\uFEFF'+data.map(row=>row.map(safe).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=`globaltec-informe-${$('date-from').value}-${$('date-to').value}.csv`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function initialize() {
  try {
    auth();
    const today=new Date(),start=new Date(today.getFullYear(),today.getMonth(),1);
    const dateKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    $('date-from').value=dateKey(start);$('date-to').value=dateKey(today);
    const organizations=await api('organizations?select=id,name&active=eq.true&order=name');
    if(!organizations.length)throw Error('No hay empresas activas disponibles.');
    const select=$('organization');
    organizations.forEach(org=>addOption(select,org.id,org.name));
    const preferred=new URLSearchParams(location.search).get('org');
    state.org=organizations.find(o=>o.id===preferred)?.id||organizations[0].id;select.value=state.org;
    select.onchange=()=>{state.org=select.value;loadReport();};
    $('filters').onsubmit=event=>{event.preventDefault();loadReport();};
    $('export').onclick=exportCsv;
    await loadReport();
  } catch(error) {notice(error.message,true);}
}
initialize();
