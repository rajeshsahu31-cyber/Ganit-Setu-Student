document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.getElementById('gsMenuBtn');
  const menu=document.getElementById('gsDropdown');
  if(btn&&menu){
    btn.addEventListener('click',(e)=>{e.stopPropagation();const open=menu.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));});
    document.addEventListener('click',(e)=>{if(!menu.contains(e.target)&&e.target!==btn){menu.classList.remove('open');btn.setAttribute('aria-expanded','false');}});
  }
  const logout=document.getElementById('gsLogoutBtn');
  if(logout) logout.addEventListener('click',()=>{
    if(!confirm('क्या आप लॉगआउट करना चाहते हैं?')) return;
    ['ganit_setu_student_id','ganit_setu_student_name','ganit_setu_student_class','ganit_setu_student_school','ganit_setu_logged_in'].forEach(k=>sessionStorage.removeItem(k));
    location.href='index.html';
  });
});
