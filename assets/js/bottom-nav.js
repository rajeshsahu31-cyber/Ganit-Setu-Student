// Ganit Setu — Common Bottom Navigation
(function(){
  function addBottomNav(){
    if(document.querySelector('.bottom-nav')) return;
    const nav=document.createElement('nav');
    nav.className='bottom-nav';
    nav.setAttribute('aria-label','मुख्य नेविगेशन');
    nav.innerHTML=`
      <a href="home.html" data-page="home">
        <span class="nav-icon">⌂</span><span class="nav-label">होम</span>
      </a>
      <a href="leaderboard.html" data-page="leaderboard">
        <span class="nav-icon">🏆</span><span class="nav-label">रैंकिंग</span>
      </a>
      <a href="pragati.html" data-page="pragati">
        <span class="nav-icon">📈</span><span class="nav-label">प्रगति</span>
      </a>
      <a href="profile.html" data-page="profile">
        <span class="nav-icon">👤</span><span class="nav-label">प्रोफाइल</span>
      </a>`;
    document.body.appendChild(nav);
    const file=(location.pathname.split('/').pop()||'home.html').toLowerCase();
    const current=file.replace('.html','')||'home';
    const active=nav.querySelector(`[data-page="${current}"]`) || nav.querySelector('[data-page="home"]');
    if(active) active.classList.add('active');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addBottomNav);
  else addBottomNav();
})();
