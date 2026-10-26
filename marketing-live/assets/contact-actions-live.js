/* Acciones rápidas dentro de las fichas actuales. No almacena ni transmite datos por sí mismo. */
(() => {
  const root = document.getElementById('root');
  if (!root) return;
  let scheduled = false;

  function cleanPhone(value) {
    if (!value || /sin tel[eé]fono|^—$/i.test(value.trim())) return null;
    let phone = value.trim().replace(/[^+0-9]/g, '');
    if (phone.startsWith('00')) phone = '+' + phone.slice(2);
    if (!phone.startsWith('+') && /^[6789]\d{8}$/.test(phone)) phone = '+34' + phone;
    if (!/^\+?[0-9]{8,15}$/.test(phone)) return null;
    const digits = phone.replace(/\D/g, '');
    const whatsapp = phone.startsWith('+') && digits.length >= 8 && digits.length <= 15 ? digits : null;
    return { phone, whatsapp };
  }
  function cleanEmail(value) {
    const email = String(value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }
  function toast(message, error = false) {
    let status = document.getElementById('crm-contact-action-status');
    if (!status) {
      status = document.createElement('div');status.id = 'crm-contact-action-status';
      status.setAttribute('role', 'status');document.body.append(status);
    }
    status.textContent = message;
    status.style.background = error ? '#9b2c2c' : '#0c766d';
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => status.remove(), 2900);
  }
  async function copy(value, label) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const input = document.createElement('textarea');input.value = value;
        input.style.position = 'fixed';input.style.opacity = '0';document.body.append(input);
        input.select();const ok = document.execCommand('copy');input.remove();
        if (!ok) throw Error('No se pudo copiar.');
      }
      toast(label + ' copiado.');
    } catch {toast('No se pudo copiar. Selecciona el dato y cópialo manualmente.', true);}
  }
  function link(label, href, title, external = false) {
    const a = document.createElement('a');a.className = 'crm-contact-quick';
    a.textContent = label;a.href = href;a.title = title;
    if (external) {a.target = '_blank';a.rel = 'noopener noreferrer';}
    return a;
  }
  function button(label, action, title) {
    const b = document.createElement('button');b.type = 'button';b.className = 'crm-contact-quick';
    b.textContent = label;b.title = title;b.addEventListener('click', action);return b;
  }
  function putActions(parent, phoneValue, emailValue, detail = false) {
    if (!parent) return;
    const phone = cleanPhone(phoneValue), email = cleanEmail(emailValue);
    const signature = JSON.stringify([phone?.phone || '',email || '',detail]);
    if (parent.dataset.crmContactActionSignature === signature) return;
    parent.querySelector('[data-crm-quick-actions]')?.remove();
    parent.dataset.crmContactActionSignature = signature;
    if (!phone && !email) return;
    const group = document.createElement('span');group.dataset.crmQuickActions = 'true';
    group.className = 'crm-contact-quick-group';
    if (phone && !detail) group.append(link('Llamar','tel:' + phone.phone,'Abrir el marcador telefónico'));
    if (phone?.whatsapp) group.append(link('WhatsApp','https://wa.me/' + phone.whatsapp,'Abrir conversación. No se envía ningún mensaje automáticamente.',true));
    if (phone) group.append(button('Copiar teléfono',()=>copy(phone.phone,'Teléfono'),'Copiar número'));
    if (email && !detail) group.append(link('Correo','mailto:' + email,'Redactar correo'));
    if (email) group.append(button('Copiar correo',()=>copy(email,'Correo'),'Copiar dirección de correo'));
    if (group.childNodes.length) parent.append(group);
  }
  function scanRows(page) {
    const heading = [...root.querySelectorAll('.dashboard-heading h1')].find(h => h.textContent.trim() === page);
    if (!heading) return;
    const dashboard = heading.closest('.dashboard') || heading.parentElement?.parentElement?.parentElement;
    if (!dashboard) return;
    for (const row of dashboard.querySelectorAll('.clients-list .client-row')) {
      const actions = row.querySelector('.client-actions');
      const phone = row.querySelector('.client-contact span')?.textContent || '';
      const email = page === 'Contactos' ? row.querySelector('.client-main small')?.textContent || '' : row.querySelector('.client-contact small')?.textContent || '';
      putActions(actions,phone,email);
    }
  }
  function scanContactDetail() {
    for (const detail of root.querySelectorAll('section[aria-label="Solicitud del contacto"]')) {
      const call = detail.querySelector('a[href^="tel:"]');
      const mail = detail.querySelector('a[href^="mailto:"]');
      const actions = call?.parentElement || mail?.parentElement;
      if (!actions) continue;
      putActions(actions,call?.getAttribute('href')?.slice(4) || '',mail?.getAttribute('href')?.slice(7) ? decodeURIComponent(mail.getAttribute('href').slice(7)) : '',true);
    }
  }
  function scan() {
    scheduled = false;
    scanRows('Contactos');scanRows('Clientes');scanContactDetail();
  }
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  }).observe(root, {subtree:true,childList:true,characterData:true});
  const css = document.createElement('style');
  css.textContent = `.client-actions{flex-wrap:wrap;align-items:center}
  .crm-contact-quick-group{display:inline-flex;gap:5px;flex-wrap:wrap;align-items:center}
  .crm-contact-quick-group .crm-contact-quick{display:inline-flex;align-items:center;justify-content:center;border:1px solid #cbd8e3;border-radius:7px;background:#fff;color:#1a5978;padding:7px 9px;font-family:inherit;font-size:12px;font-weight:700;line-height:1.3;text-decoration:none;cursor:pointer;white-space:nowrap}
  .crm-contact-quick-group .crm-contact-quick:hover{background:#edf7f8;border-color:#84bbb6}
  #crm-contact-action-status{position:fixed;right:20px;bottom:20px;z-index:100000;color:white;padding:13px 18px;border-radius:9px;box-shadow:0 8px 28px #142c4833;font-size:14px;max-width:340px}
  @media(max-width:800px){.crm-contact-quick-group{flex-wrap:wrap}.crm-contact-quick-group .crm-contact-quick{white-space:normal}}
  `;
  document.head.append(css);
  scan();
})();
