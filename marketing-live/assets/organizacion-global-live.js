/* Una empresa activa por sesión en el CRM; evita editar otra empresa desde cuadros ya abiertos. */
(() => {
  const root=document.getElementById('root');if(!root)return;
  const STORAGE='crm-active-organization';
  let previous='';
  function synchronize(){
    const select=document.getElementById('active-organization');
    if(!select?.value)return;
    if(previous!==select.value){previous=select.value;sessionStorage.setItem(STORAGE,previous);}
  }
  document.addEventListener('change',event=>{
    if(event.target?.id!=='active-organization')return;
    const changed=event.target.value;
    if(!changed)return;
    const current=sessionStorage.getItem(STORAGE);
    sessionStorage.setItem(STORAGE,changed);previous=changed;
    if(current&&current!==changed){
      // Discard modal state from the previous organization: no cross-company writes.
      for(const id of ['crm-tasks-delete-dialog','crm-contact-task-overlay','crm-export-dialog','crm-agenda-manager','crm-client-history','crm-conversion-dialog','crm-data-quality','crm-opportunity-dashboard']){
        document.getElementById(id)?.remove();
      }
    }
  },true);
  new MutationObserver(synchronize).observe(root,{subtree:true,childList:true});
  synchronize();
})();
