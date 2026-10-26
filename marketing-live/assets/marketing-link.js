// Enlace independiente: no altera la lógica ni el estado del CRM.
(() => {
  const root = document.getElementById('root');
  if (!root) return;
  function attach() {
    const nav = root.querySelector('aside nav');
    if (!nav) return;
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
  }
  const observer = new MutationObserver(attach);
  observer.observe(root, { childList: true, subtree: true });
  attach();
})();
