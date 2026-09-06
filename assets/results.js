function escapeHtml(v='') {
  return String(v).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])
  );
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('hi-IN', {
    day:'2-digit', month:'long', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  }).format(new Date(value));
}

function formatDuration(seconds) {
  seconds = Number(seconds || 0);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function indiaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(new Date());
  const o={}; parts.forEach(x=>o[x.type]=x.value);
  return `${o.year}-${o.month}-${o.day}`;
}

const TEST_TYPES = [
  {value:'course_progress', label:'कोर्स टेस्ट'},
  {value:'chapter_practice', label:'अध्याय टेस्ट'},
  {value:'daily', label:'Practice Test'}
];

function testLabel(row) {
  const type = String(row?.test_type || '').toLowerCase();
  if (type === 'daily') return 'Practice Test';
  if (type === 'chapter_practice') return row.test_title || 'अध्याय टेस्ट';
  if (type === 'course_progress') return row.test_title || 'कोर्स टेस्ट';
  return row.test_title || 'टेस्ट';
}

function indiaDateOf(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(dt);
  const o={}; parts.forEach(x=>o[x.type]=x.value);
  return `${o.year}-${o.month}-${o.day}`;
}

function normalizeClass(v) {
  const s=String(v??'').toLowerCase();
  if (s.includes('10')) return 10;
  if (s.includes('9')) return 9;
  return 0;
}

function testRank(row) {
  const type=String(row?.test_type||'').toLowerCase();
  if(type==='course_progress') return 1;
  if(type==='chapter_practice') return 2;
  if(type==='daily') return 3;
  return 9;
}

function normalizeRpcRow(r) {
  const submitted=r.submitted_at || r.created_at || r.test_time ||
    (r.test_date ? `${r.test_date}T00:00:00` : null);
  return {
    ...r,
    test_title:r.test_title || r.title || r.test_name || '',
    test_type:r.test_type || '',
    submitted_at:submitted,
    score:Number(r.score ?? r.correct_answers ?? 0),
    total_marks:Number(r.total_marks ?? r.total_questions ?? 0),
    correct_answers:Number(r.correct_answers ?? r.score ?? 0),
    percentage:Number(r.percentage ?? 0),
    time_taken_seconds:Number(r.time_taken_seconds ?? r.time_taken ?? 0)
  };
}

function renderEmpty(type) {
  const label = TEST_TYPES.find(t=>t.value===type)?.label || 'यह टेस्ट';
  document.getElementById('resultList').innerHTML =
    `<div class="today-empty"><b>आज का ${escapeHtml(label)} परिणाम उपलब्ध नहीं है।</b><br>
    <small>आपने आज यह टेस्ट नहीं दिया है।</small></div>`;
}

function renderResult(row) {
  const box=document.getElementById('resultList');
  box.innerHTML=`
    <div class="today-result">
      <div class="today-title">
        <div><b>${escapeHtml(testLabel(row))}</b>
          <div class="today-meta">कक्षा ${escapeHtml(row.class_level ?? '—')} • ${escapeHtml(formatDateTime(row.submitted_at))}</div>
        </div>
        <div class="today-score">${escapeHtml(row.score)}/${escapeHtml(row.total_marks)}</div>
      </div>
      <div class="today-stats">
        <div class="today-stat"><b>${escapeHtml(row.score)}</b><small>अंक</small></div>
        <div class="today-stat"><b>${escapeHtml(row.correct_answers)}</b><small>सही</small></div>
        <div class="today-stat"><b>${escapeHtml(Number(row.percentage).toFixed(1))}%</b><small>प्रतिशत</small></div>
        <div class="today-stat"><b>${escapeHtml(formatDuration(row.time_taken_seconds))}</b><small>समय</small></div>
      </div>
    </div>`;
}

let todayRows=[];

function showSelectedTest() {
  const type=document.getElementById('testSelect').value;
  const row=todayRows.find(r=>String(r.test_type||'').toLowerCase()===type);
  if(row) renderResult(row);
  else renderEmpty(type);
}

async function loadResults() {
  const box=document.getElementById('resultList');
  const studentCode=sessionStorage.getItem('ganit_setu_student_id');
  if(!studentCode) {
    box.innerHTML='<div class="today-empty"><b>कृपया पहले Student Login करें।</b></div>';
    return;
  }

  const {data,error}=await supabaseClient.rpc('get_ganit_student_results',{
    p_student_code:studentCode
  });

  if(error) {
    console.error(error);
    box.innerHTML='<div class="today-empty">Result load नहीं हो सका।</div>';
    return;
  }

  // Keep the existing live RPC connection; only today's India-date records are used here.
  const today=indiaToday();
  todayRows=(Array.isArray(data)?data:[])
    .map(normalizeRpcRow)
    .filter(r=>indiaDateOf(r.submitted_at)===today)
    .filter(r=>['course_progress','chapter_practice','daily'].includes(String(r.test_type||'').toLowerCase()))
    .sort((a,b)=>testRank(a)-testRank(b));

  showSelectedTest();
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('testSelect').addEventListener('change',showSelectedTest);
  loadResults();
});
