const BASE = 'https://kkyizztxlvjqbplcnhtx.supabase.co';
const KEY = 'sb_publishable_g1yhzmMPYG9OC5kaE42FjQ_lGTgBNFQ';
const SESSION_KEY = 'sb-kkyizztxlvjqbplcnhtx-auth-token';
const $ = id => document.getElementById(id);
const platformLabels = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube' };
const statusLabels = { draft: 'Borrador', pending_approval: 'Pendiente de aprobación' };
const state = { session: null, org: '', organizations: [], accounts: [], posts: [], canEdit: false, month: new Date(), editingPostId: null, tab: 'calendar' };

function notice(message = '', kind = '') {
  $('notice').textContent = message;
  $('notice').className = 'notice' + (kind ? ' ' + kind : '');
}
function session() {
  const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  if (!saved?.access_token || !saved?.user?.id || saved.expires_at * 1000 <= Date.now()) {
    throw new Error('Tu sesión ha caducado. Vuelve al CRM, inicia sesión y abre Marketing.');
  }
  return saved;
}
async function api(path, { method = 'GET', body } = {}) {
  const current = session();
  const response = await fetch(BASE + '/rest/v1/' + path, {
    method,
    headers: {
      apikey: KEY, Authorization: 'Bearer ' + current.access_token,
      'Content-Type': 'application/json', Prefer: 'return=representation'
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const content = await response.text();
  let data;
  try { data = content ? JSON.parse(content) : null; } catch { data = null; }
  if (!response.ok) throw new Error(data?.message || data?.error || 'No se pudo completar la operación (' + response.status + ').');
  return data;
}
async function permission(action) {
  return api('rpc/crm_has_module_permission', {
    method: 'POST',
    body: { p_org: state.org, p_module: 'marketing', p_action: action }
  });
}
function option(select, value, label) {
  const el = document.createElement('option');
  el.value = value; el.textContent = label; select.append(el);
}
async function initialize() {
  try {
    state.session = session();
    const organizations = await api('organizations?select=id,name&order=name.asc');
    state.organizations = organizations || [];
    if (!state.organizations.length) throw new Error('No tienes empresas activas disponibles.');
    const select = $('organization');
    state.organizations.forEach(org => option(select, org.id, org.name));
    const savedOrg = sessionStorage.getItem('crm-marketing-org');
    const preferred = new URLSearchParams(location.search).get('org');
    state.org = state.organizations.find(o => o.id === preferred)?.id ||
      state.organizations.find(o => o.id === savedOrg)?.id || state.organizations[0].id;
    select.value = state.org;
    select.addEventListener('change', async () => {
      state.org = select.value;
      sessionStorage.setItem('crm-marketing-org', state.org);
      await reload();
    });
    bindEvents();
    await reload();
  } catch (error) { notice(error.message, 'error'); }
}
async function reload() {
  $('workspace').hidden = true;
  notice('Cargando datos de Marketing…');
  try {
    const allowed = await permission('view');
    if (allowed !== true) throw new Error('No tienes permisos para consultar Marketing en esta empresa.');
    state.canEdit = (await permission('edit')) === true;
    const query = '?organization_id=eq.' + encodeURIComponent(state.org) + '&order=created_at.desc';
    const [accounts, posts] = await Promise.all([
      api('crm_marketing_accounts' + query),
      api('crm_marketing_posts' + query)
    ]);
    state.accounts = accounts || [];
    state.posts = posts || [];
    $('new-account').hidden = !state.canEdit;
    $('new-post').hidden = !state.canEdit;
    $('post-form').hidden = true;
    $('account-form').hidden = true;
    render();
    $('workspace').hidden = false;
    notice('');
  } catch (error) { notice(error.message, 'error'); }
}
function render() {
  $('count-accounts').textContent = state.accounts.length;
  $('count-drafts').textContent = state.posts.filter(p => p.status === 'draft').length;
  $('count-pending').textContent = state.posts.filter(p => p.status === 'pending_approval').length;
  $('count-dated').textContent = state.posts.filter(p => p.scheduled_at).length;
  renderCalendar(); renderPosts(); renderAccounts();
}
function recordEmpty(container, message) {
  container.replaceChildren();
  const empty = document.createElement('div');
  empty.className = 'empty'; empty.textContent = message;
  container.append(empty);
}
function textEl(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
function renderAccounts() {
  const container = $('accounts'); container.replaceChildren();
  if (!state.accounts.length) return recordEmpty(container, 'Todavía no hay perfiles sociales registrados para esta empresa.');
  state.accounts.forEach(account => {
    const row = textEl('article', '', 'record');
    const details = document.createElement('div');
    details.append(textEl('span', platformLabels[account.platform] || account.platform, 'platform'));
    details.append(textEl('h3', account.account_label));
    details.append(textEl('p', account.client_name + (account.account_handle ? ' · ' + account.account_handle : '')));
    row.append(details, textEl('span', 'Sin conectar', 'pill'));
    container.append(row);
  });
}
function renderPosts() {
  const container = $('posts'); container.replaceChildren();
  if (!state.posts.length) return recordEmpty(container, 'Aún no hay publicaciones. Crea el primer borrador para empezar el calendario.');
  state.posts.forEach(post => {
    const row = textEl('article', '', 'record');
    const details = document.createElement('div');
    details.append(textEl('span', platformLabels[post.platform] || post.platform, 'platform'));
    details.append(textEl('h3', post.title));
    const date = post.scheduled_at ? new Date(post.scheduled_at).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'}) : 'Sin fecha';
    details.append(textEl('p', post.client_name + ' · ' + date));
    const actions = document.createElement('div');
    actions.append(textEl('span', statusLabels[post.status] || post.status, 'pill' + (post.status === 'pending_approval' ? ' pending' : '')));
    if (state.canEdit) {
      const button = textEl('button', 'Editar', 'secondary');
      button.style.marginLeft = '10px';
      button.addEventListener('click', () => openPost(post));
      actions.append(button);
    }
    row.append(details, actions);
    container.append(row);
  });
}
function dateKey(date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return y + '-' + m + '-' + d;
}
function renderCalendar() {
  const month = state.month;
  $('month-title').textContent = month.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const calendar = $('calendar'); calendar.replaceChildren();
  for (const day of ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']) calendar.append(textEl('div',day,'calendar-heading'));
  const start = new Date(month.getFullYear(),month.getMonth(),1);
  const offset = (start.getDay()+6)%7;
  const first = new Date(start.getFullYear(),start.getMonth(),1-offset);
  const mapped = new Map();
  state.posts.forEach(post => {
    if (!post.scheduled_at) return;
    const key = dateKey(new Date(post.scheduled_at));
    if (!mapped.has(key)) mapped.set(key,[]);
    mapped.get(key).push(post);
  });
  const today = dateKey(new Date());
  for (let i=0;i<42;i++) {
    const date = new Date(first.getFullYear(),first.getMonth(),first.getDate()+i);
    const key = dateKey(date), day = textEl('div','', 'day' + (date.getMonth()!==month.getMonth()?' muted':'') + (key===today?' today':''));
    day.append(textEl('div',String(date.getDate()),'date'));
    for (const post of (mapped.get(key)||[]).slice(0,3)) {
      const item = textEl('button', (platformLabels[post.platform]||post.platform) + ': ' + post.title, 'event');
      item.type='button'; item.title=post.client_name + ' · ' + (statusLabels[post.status]||post.status);
      item.style.width='100%';item.style.textAlign='left';item.style.borderTop='0';item.style.borderRight='0';item.style.borderBottom='0';
      item.addEventListener('click',()=>{activateTab('content'); if(state.canEdit)openPost(post);});
      day.append(item);
    }
    calendar.append(day);
  }
}
function activateTab(tab) {
  state.tab=tab;
  document.querySelectorAll('.tab').forEach(button=>{
    const active=button.dataset.tab===tab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
  });
  for(const name of ['calendar','content','accounts']) $('panel-'+name).hidden=name!==tab;
}
function openPost(post=null) {
  activateTab('content');
  const form=$('post-form'); form.reset(); state.editingPostId=post?.id||null;
  $('post-form-title').textContent=post?'Editar contenido':'Nuevo contenido';
  if(post) {
    for(const field of ['client_name','platform','title','content','media_url','status'])form.elements.namedItem(field).value=post[field]||'';
    if(post.scheduled_at){
      const d=new Date(post.scheduled_at), local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
      form.elements.namedItem('scheduled_at').value=local.toISOString().slice(0,16);
    }
  }
  form.hidden=false; form.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function bindEvents() {
  document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>activateTab(button.dataset.tab)));
  $('previous-month').addEventListener('click',()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()-1,1);renderCalendar();});
  $('next-month').addEventListener('click',()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);renderCalendar();});
  $('new-post').addEventListener('click',()=>openPost());
  $('cancel-post').addEventListener('click',()=>{$('post-form').hidden=true;state.editingPostId=null;});
  $('new-account').addEventListener('click',()=>{$('account-form').reset();$('account-form').hidden=false;});
  $('cancel-account').addEventListener('click',()=>{$('account-form').hidden=true;});
  $('account-form').addEventListener('submit',async event=>{
    event.preventDefault(); if(!state.canEdit)return;
    const form=event.currentTarget, button=form.querySelector('[type=submit]');button.disabled=true;
    const data=Object.fromEntries(new FormData(form).entries());
    try {
      await api('crm_marketing_accounts',{method:'POST',body:{...data,organization_id:state.org,created_by:state.session.user.id}});
      notice('Perfil registrado. Para publicar habrá que conectar la cuenta autorizada.','success');
      await reload(); notice('Perfil registrado.','success');
    } catch(error){notice(error.message,'error');} finally {button.disabled=false;}
  });
  $('post-form').addEventListener('submit',async event=>{
    event.preventDefault(); if(!state.canEdit)return;
    const form=event.currentTarget, button=form.querySelector('[type=submit]');button.disabled=true;
    const data=Object.fromEntries(new FormData(form).entries());
    data.scheduled_at=data.scheduled_at?new Date(data.scheduled_at).toISOString():null;
    data.media_url=data.media_url||null;
    try {
      if(state.editingPostId){
        await api('crm_marketing_posts?id=eq.'+encodeURIComponent(state.editingPostId)+'&organization_id=eq.'+encodeURIComponent(state.org),
          {method:'PATCH',body:data});
      } else {
        await api('crm_marketing_posts',{method:'POST',body:{...data,organization_id:state.org,created_by:state.session.user.id}});
      }
      await reload();notice('Contenido guardado como planificación interna.','success');
    } catch(error){notice(error.message,'error');} finally {button.disabled=false;}
  });
}
initialize();
