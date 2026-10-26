// Enlace independiente: no altera la lógica ni el estado del CRM.
(() => {
  const root = document.getElementById('root');
  if (!root) return;
  function orderActions() {
    for (const heading of root.querySelectorAll('.dashboard-heading')) {
      const page = heading.querySelector('h1')?.textContent.trim();
      if (!['Leads', 'Clientes', 'Contactos', 'Oportunidades'].includes(page)) continue;
      for (const button of heading.querySelectorAll('button')) {
        const label = button.textContent.replace(/\s+/g,' ').trim().toLocaleLowerCase('es');
        let priority = 0;
        if (/\bnuev[oa]\s+(lead|cliente|contacto|oportunidad)\b/.test(label)) priority = -100;
        else if (/seguimiento|historial|revisar datos|panel comercial|panel de leads/.test(label)) priority = -50;
        else if (/exportar|descargar/.test(label)) priority = 40;
        else if (/configurar|configuración|etapas|columnas|campos/.test(label)) priority = 80;
        if (button.style.order !== String(priority)) button.style.order = String(priority);
      }
    }
  }
  function attach() {
    const nav = root.querySelector('aside nav');
    if (!nav) { orderActions(); return; }
    const reports = [...nav.querySelectorAll('.nav-item')].find(item => item.textContent.includes('Informes'));
    function addLink(marker,label,path,after) {
      if (nav.querySelector('['+marker+']')) return nav.querySelector('['+marker+']');
      const link=document.createElement('a');link.className='nav-item';link.setAttribute(marker,'true');
      link.href=path;link.textContent=label;
      link.addEventListener('click',()=>{
        const org=document.getElementById('active-organization')?.value;
        if(org)link.href=path+'?org='+encodeURIComponent(org);
      });
      if(after?.nextSibling)nav.insertBefore(link,after.nextSibling);
      else nav.append(link);
      return link;
    }
    const commercial = addLink('data-commercial-report-link','▤  Informes comerciales','/informes-comerciales.html',reports);
    addLink('data-marketing-link','✦  Marketing','/marketing.html',commercial);
    orderActions();
  }
  const observer = new MutationObserver(attach);
  observer.observe(root, { childList: true, subtree: true });
  attach();
})();
