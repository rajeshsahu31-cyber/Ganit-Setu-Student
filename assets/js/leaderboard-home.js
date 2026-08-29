// ============================================
// GANIT SETU - HOME LEADERBOARD
// Full Leaderboard page के उसी Supabase RPC से data
// ============================================

let homeWinnerData = [];

function escapeHomeHtml(v='') {
  return String(v).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])
  );
}

function homeInitials(name='विद्यार्थी'){
  return String(name).trim().split(/\s+/).filter(Boolean)
    .map(x => x[0]).join('').slice(0,2).toUpperCase() || 'वि';
}

function setHomeLeaderboardMessage(message){
  const topThree=document.getElementById('topThree');
  const track=document.getElementById('winnerTrack');
  if(topThree) topThree.innerHTML=
    `<div style="grid-column:1/-1;width:100%;text-align:center;padding:24px 12px;">${message}</div>`;
  if(track) track.innerHTML='';
}

function formatHomeDate(value){
  if(!value) return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('hi-IN',{day:'numeric',month:'long',year:'numeric'});
}

function setHomeDateFromResults(data){
  const el=document.getElementById('testDateText');
  if(!el) return;

  const first=data && data[0];
  const date=formatHomeDate(first && first.submitted_at);
  el.textContent = date
    ? `${date} की परीक्षा का सर्वश्रेष्ठ प्रदर्शन`
    : 'नवीनतम टेस्ट का सर्वश्रेष्ठ प्रदर्शन';
}

function renderTopThree(data){
  const el=document.getElementById('topThree');
  if(!el) return;

  if(!data || !data.length){
    el.innerHTML=`<div style="grid-column:1/-1;width:100%;text-align:center;padding:24px 12px;">
      <b>अभी कोई परिणाम उपलब्ध नहीं है</b>
    </div>`;
    return;
  }

  el.innerHTML=data.slice(0,3).map((r,index)=>{
    const rank=Number(r.rank_no) || index+1;
    const medal=rank===1?'🥇':rank===2?'🥈':'🥉';
    const score=`${r.score ?? 0}/${r.total_marks ?? 0}`;
    const percentage=Number(r.percentage || 0).toFixed(1);
    return `
      <div class="champion-card rank-${rank}${rank===1?' first':''}">
        <div class="medal">${medal}</div>
        <div class="champion-photo">${escapeHomeHtml(homeInitials(r.full_name))}</div>
        <h3>${escapeHomeHtml(r.full_name || 'विद्यार्थी')}</h3>
        <small>${escapeHomeHtml(r.student_code || '')}</small>
        <div class="champion-score">${escapeHomeHtml(score)} • ${escapeHomeHtml(percentage)}%</div>
      </div>`;
  }).join('');
}

function renderOtherWinners(data){
  const track=document.getElementById('winnerTrack');
  if(!track) return;

  const others=(data || []).filter(r=>Number(r.rank_no)>=4).slice(0,7);

  if(!others.length){
    track.innerHTML='<small style="padding:8px;color:#687489;">अभी Top 10 में अन्य परिणाम उपलब्ध नहीं हैं।</small>';
    return;
  }

  track.innerHTML=others.map(r=>{
    const percentage=Number(r.percentage || 0).toFixed(1);
    return `
      <div class="winner-card">
        <div class="winner-number">#${escapeHomeHtml(r.rank_no)}</div>
        <div class="mini-photo">${escapeHomeHtml(homeInitials(r.full_name))}</div>
        <div class="winner-info">
          <b>${escapeHomeHtml(r.full_name || 'विद्यार्थी')}</b>
          <div class="winner-score">${escapeHomeHtml(r.score)}/${escapeHomeHtml(r.total_marks)} • ${escapeHomeHtml(percentage)}%</div>
          <small>${escapeHomeHtml(r.student_code || '')}</small>
        </div>
      </div>`;
  }).join('');
}

function updateMyRank(data){
  const el=document.getElementById('myRank');
  if(!el) return;

  const studentCode=sessionStorage.getItem('ganit_setu_student_id');
  const mine=(data || []).find(r=>String(r.student_code)===String(studentCode));

  el.textContent=mine ? `#${mine.rank_no}` : '—';
}

let homeScrollTimer=null;

function startAutoScroll(){
  const track=document.getElementById('winnerTrack');
  if(!track || homeScrollTimer) return;

  homeScrollTimer=setInterval(()=>{
    if(track.scrollWidth<=track.clientWidth) return;
    const next=track.scrollLeft+280;
    track.scrollTo({
      left: next>=track.scrollWidth-track.clientWidth-5 ? 0 : next,
      behavior:'smooth'
    });
  },3500);
}

async function getHomeStudentClass(){
  let classLevel=Number(sessionStorage.getItem('ganit_setu_student_class'));
  if(classLevel===9 || classLevel===10) return classLevel;

  const studentCode=sessionStorage.getItem('ganit_setu_student_id');
  if(!studentCode) return null;

  const {data,error}=await supabaseClient
    .from('students')
    .select('class_level')
    .eq('student_id',studentCode)
    .maybeSingle();

  if(error || !data) return null;

  classLevel=Number(data.class_level);
  if(classLevel===9 || classLevel===10){
    sessionStorage.setItem('ganit_setu_student_class',String(classLevel));
    return classLevel;
  }
  return null;
}

async function loadHomeLeaderboard(){
  setHomeLeaderboardMessage('लीडरबोर्ड लोड हो रहा है...');

  const classLevel=await getHomeStudentClass();

  if(classLevel!==9 && classLevel!==10){
    setHomeLeaderboardMessage('<b>Student की Class जानकारी नहीं मिली।</b>');
    return;
  }

  const {data:tests,error:testsError}=await supabaseClient.rpc(
    'get_ganit_leaderboard_tests',
    {p_class_level:classLevel}
  );

  if(testsError){
    console.error('Home leaderboard tests error:',testsError);
    setHomeLeaderboardMessage(`<b>Leaderboard load नहीं हुआ:</b> ${escapeHomeHtml(testsError.message)}`);
    return;
  }

  if(!tests || !tests.length){
    setHomeLeaderboardMessage('<b>अभी कोई Test Result उपलब्ध नहीं है।</b>');
    return;
  }

  // पहला ऐसा टेस्ट चुनें जिसमें वास्तव में Result उपलब्ध हो।
  let selectedData=null;

  for(const test of tests){
    const {data,error}=await supabaseClient.rpc('get_ganit_leaderboard',{
      p_class_level:classLevel,
      p_test_id:Number(test.test_id)
    });

    if(error){
      console.error('Home leaderboard result error:',error);
      continue;
    }

    if(data && data.length){
      selectedData=data;
      break;
    }
  }

  if(!selectedData){
    setHomeLeaderboardMessage('<b>अभी किसी टेस्ट का Result उपलब्ध नहीं है।</b>');
    return;
  }

  homeWinnerData=selectedData.slice(0,10);
  setHomeDateFromResults(homeWinnerData);
  renderTopThree(homeWinnerData);
  renderOtherWinners(homeWinnerData);
  updateMyRank(homeWinnerData);
  startAutoScroll();
}

document.addEventListener('DOMContentLoaded',loadHomeLeaderboard);
