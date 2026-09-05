// ============================================
// GANIT SETU - HOME MAIN LEADERBOARD
// केवल Course Progress Test का एक Combined Leaderboard
// Ranking: Percentage DESC -> कम समय -> पहले Submit
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

function homePhotoHtml(student){
  const name=student.full_name || 'विद्यार्थी';
  const photoUrl=student.photo_url || '';
  if(photoUrl){
    return `<img src="${escapeHomeHtml(photoUrl)}" alt="${escapeHomeHtml(name)}" onerror="this.remove();this.parentElement.textContent='${escapeHomeHtml(homeInitials(name))}'">`;
  }
  return escapeHomeHtml(homeInitials(name));
}

async function addHomeProfilePhotos(rows){
  if(!rows || !rows.length) return rows || [];
  const ids=[...new Set(rows.map(r=>String(r.student_code || '').trim()).filter(Boolean))];
  if(!ids.length) return rows;

  const {data,error}=await supabaseClient.from('students')
    .select('student_id,photo_url,school_name,class_level').in('student_id',ids);

  if(error){ console.error('Home profile photos load error:',error); return rows; }

  const profileMap=new Map((data || []).map(s=>[String(s.student_id),s]));
  return rows.map(r=>{
    const p=profileMap.get(String(r.student_code)) || {};
    return {...r,photo_url:p.photo_url || r.photo_url || '',school_name:p.school_name || r.school_name || '',class_level:p.class_level ?? r.class_level ?? ''};
  });
}

function setHomeLeaderboardMessage(message){
  const topThree=document.getElementById('topThree');
  const track=document.getElementById('winnerTrack');
  if(topThree) topThree.innerHTML=`<div style="grid-column:1/-1;width:100%;text-align:center;padding:24px 12px;">${message}</div>`;
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
  el.textContent = date ? `${date} तक का सर्वश्रेष्ठ प्रदर्शन` : 'मुख्य प्रगति टेस्ट का सर्वश्रेष्ठ प्रदर्शन';
}

function renderTopThree(data){
  const el=document.getElementById('topThree');
  if(!el) return;
  if(!data || !data.length){
    el.innerHTML='<div style="grid-column:1/-1;width:100%;text-align:center;padding:24px 12px;"><b>अभी कोई परिणाम उपलब्ध नहीं है</b></div>';
    return;
  }
  el.innerHTML=data.slice(0,3).map((r,index)=>{
    const rank=Number(r.rank_no)||index+1;
    const medal=rank===1?'🥇':rank===2?'🥈':'🥉';
    const percentage=Number(r.percentage||0).toFixed(1);
    return `<div class="champion-card rank-${rank}${rank===1?' first':''}">
      <div class="medal">${medal}</div>
      <div class="champion-photo">${homePhotoHtml(r)}</div>
      <h3>${escapeHomeHtml(r.full_name||'विद्यार्थी')}</h3>
      <small>${escapeHomeHtml(r.student_code||'')}</small>
      <div class="champion-score">${escapeHomeHtml(r.score??0)}/${escapeHomeHtml(r.total_marks??0)} • ${percentage}%</div>
    </div>`;
  }).join('');
}

function renderTopTen(data){
  const track=document.getElementById('winnerTrack');
  if(!track) return;
  const rows=(data||[]).slice(0,10);

  if(!rows.length){
    track.innerHTML='<small style="padding:8px;color:#687489;">अभी कोई परिणाम उपलब्ध नहीं है।</small>';
    return;
  }

  track.innerHTML=rows.map(r=>{
    const percentage=Number(r.percentage||0).toFixed(1);
    const timeSeconds=timeValue(r);
    const timeText=Number.isFinite(timeSeconds) && timeSeconds < 999999999 ? formatHomeDuration(timeSeconds) : '—';
    const classText=r.class_level ? `कक्षा ${escapeHomeHtml(r.class_level)}` : 'कक्षा —';
    const testText=r.test_title || r.title || 'मुख्य प्रगति टेस्ट';
    return `<div class="winner-card">
      <div class="winner-number">#${escapeHomeHtml(r.rank_no)}</div>
      <div class="mini-photo">${homePhotoHtml(r)}</div>
      <div class="winner-info">
        <b class="winner-name">${escapeHomeHtml(r.full_name||'विद्यार्थी')}</b>
        <small class="winner-school">🏫 ${escapeHomeHtml(r.school_name||'विद्यालय —')}</small>
        <div class="winner-meta">
          <span>📚 ${classText}</span>
          <span>🎯 ${escapeHomeHtml(r.score??0)}/${escapeHomeHtml(r.total_marks??0)}</span>
          <span>📊 ${percentage}%</span>
          <span>⏱️ ${escapeHomeHtml(timeText)}</span>
        </div>
        <small class="winner-test">📝 ${escapeHomeHtml(testText)}</small>
      </div>
    </div>`;
  }).join('');
}

function updateMyRank(data){
  const el=document.getElementById('myRank');
  if(!el) return;
  const studentCode=sessionStorage.getItem('ganit_setu_student_id');
  const mine=(data||[]).find(r=>String(r.student_code)===String(studentCode));
  el.textContent=mine ? `#${mine.rank_no}` : '—';
}

let homeScrollTimer=null;
function startAutoScroll(){
  const track=document.getElementById('winnerTrack');
  if(!track || homeScrollTimer) return;
  homeScrollTimer=setInterval(()=>{
    if(track.scrollWidth<=track.clientWidth) return;
    const next=track.scrollLeft+280;
    track.scrollTo({left:next>=track.scrollWidth-track.clientWidth-5?0:next,behavior:'smooth'});
  },3500);
}

async function getHomeStudentClass(){
  let classLevel=Number(sessionStorage.getItem('ganit_setu_student_class'));
  if(classLevel===9||classLevel===10) return classLevel;

  const studentCode=sessionStorage.getItem('ganit_setu_student_id');
  if(!studentCode) return null;

  const {data,error}=await supabaseClient.from('students').select('class_level')
    .eq('student_id',studentCode).maybeSingle();
  if(error||!data) return null;

  classLevel=Number(data.class_level);
  if(classLevel===9||classLevel===10){
    sessionStorage.setItem('ganit_setu_student_class',String(classLevel));
    return classLevel;
  }
  return null;
}


function formatHomeDuration(seconds){
  const s=Math.max(0,Math.floor(Number(seconds)||0));
  const m=Math.floor(s/60);
  const sec=s%60;
  return m ? `${m}मि ${String(sec).padStart(2,'0')}से` : `${sec}से`;
}

function timeValue(r){
  const v=Number(r.time_taken_seconds ?? r.time_taken ?? 999999999);
  return Number.isFinite(v) ? v : 999999999;
}

function submitValue(r){
  const t=new Date(r.submitted_at || r.created_at || 0).getTime();
  return Number.isFinite(t) && t>0 ? t : Number.MAX_SAFE_INTEGER;
}

function progressValue(test,row){
  const title=String(test.title||'');
  const m=title.match(/Chapter\s+1-(\d+)/i);
  if(m) return Number(m[1]);
  return Number(test.question_count||row.total_marks||0);
}

function buildCombinedCourseLeaderboard(testRows){
  // हर विद्यार्थी का सबसे आगे तक पढ़ा हुआ Course Progress result चुना जाएगा.
  const best=new Map();

  for(const item of testRows){
    const progress=progressValue(item.test,item.row);
    const key=String(item.row.student_code||'');
    if(!key) continue;
    const old=best.get(key);
    if(!old || progress>old.progress || (progress===old.progress && submitValue(item.row)>submitValue(old.row))){
      best.set(key,{...item,progress});
    }
  }

  const rows=[...best.values()].map(x=>({...x.row,_progress:x.progress}));

  rows.sort((a,b)=>{
    const p=Number(b.percentage||0)-Number(a.percentage||0);
    if(p) return p;
    const tm=timeValue(a)-timeValue(b);
    if(tm) return tm;
    return submitValue(a)-submitValue(b);
  });

  return rows.map((r,i)=>({...r,rank_no:i+1}));
}

async function loadHomeLeaderboard(){
  setHomeLeaderboardMessage('लीडरबोर्ड लोड हो रहा है...');
  const classLevel=await getHomeStudentClass();

  if(classLevel!==9&&classLevel!==10){
    setHomeLeaderboardMessage('<b>Student की Class जानकारी नहीं मिली।</b>');
    return;
  }

  const {data:tests,error:testsError}=await supabaseClient.rpc('get_ganit_leaderboard_tests',{p_class_level:classLevel});
  if(testsError){
    console.error(testsError);
    setHomeLeaderboardMessage(`<b>Leaderboard load नहीं हुआ:</b> ${escapeHomeHtml(testsError.message)}`);
    return;
  }

  const courseTests=(tests||[]).filter(t=>String(t.test_type||'').toLowerCase()==='course_progress');
  if(!courseTests.length){
    setHomeLeaderboardMessage('<b>अभी मुख्य प्रगति टेस्ट का कोई Result उपलब्ध नहीं है।</b>');
    return;
  }

  const collected=[];
  for(const test of courseTests){
    const {data,error}=await supabaseClient.rpc('get_ganit_leaderboard',{
      p_class_level:classLevel,p_test_id:Number(test.test_id)
    });
    if(error){ console.error('Course leaderboard error:',error); continue; }
    for(const row of (data||[])) collected.push({test,row:{...row,test_title:test.title||row.test_title||''}});
  }

  const selectedData=buildCombinedCourseLeaderboard(collected);
  if(!selectedData.length){
    setHomeLeaderboardMessage('<b>अभी मुख्य प्रगति टेस्ट का कोई Result उपलब्ध नहीं है।</b>');
    return;
  }

  homeWinnerData=selectedData.slice(0,10);
  setHomeDateFromResults(homeWinnerData);
  renderTopThree(homeWinnerData);
  renderTopTen(homeWinnerData);
  updateMyRank(homeWinnerData);
  startAutoScroll();

  try{
    homeWinnerData=await addHomeProfilePhotos(homeWinnerData);
    renderTopThree(homeWinnerData);
    renderTopTen(homeWinnerData);
    updateMyRank(homeWinnerData);
  }catch(e){ console.error('Home photo enhancement error:',e); }
}

document.addEventListener('DOMContentLoaded',loadHomeLeaderboard);
