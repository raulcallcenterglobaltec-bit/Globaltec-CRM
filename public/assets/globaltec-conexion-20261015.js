// Aviso informativo: no intercepta guardados ni afirma entrega al servidor.
const banner=document.createElement('div');
banner.className='globaltec-connection-warning';
banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
banner.textContent='Sin conexión a Internet. Los cambios requieren confirmación del servidor. Cuando vuelva la conexión, actualiza y comprueba los datos antes de reintentar.';
function showConnection(){banner.hidden=navigator.onLine!==false;}
function mount(){if(!document.body.contains(banner))document.body.prepend(banner);showConnection();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.addEventListener('offline',showConnection);window.addEventListener('online',showConnection);
