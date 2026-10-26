// Enlace independiente: no altera la lógica ni el estado del CRM.
(() => {
  const root = document.getElementById('root');
  if (!root) return;
  function attach() {
    const nav = root.querySelector('aside nav');
    if (!nav || nav.querySelector('[data-marketing-link]')) return;
    const link = document.createElement('a');
    link.className = 'nav-item';
    link.dataset.marketingLink = 'true';
    link.href = '/marketing.html';
    link.textContent = '✦  Marketing';
    link.addEventListener('click', () => {
      const org = document.getElementById('active-organization')?.value;
      if (org) link.href = '/marketing.html?org=' + encodeURIComponent(org);
    });
    const reports = [...nav.querySelectorAll('.nav-item')].find(item => item.textContent.includes('Informes'));
    if (reports?.nextSibling) nav.insertBefore(link, reports.nextSibling);
    else nav.append(link);
  }
  const observer = new MutationObserver(attach);
  observer.observe(root, { childList: true, subtree: true });
  attach();
})();
