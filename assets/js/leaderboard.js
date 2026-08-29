const topTen = document.getElementById('topTen');
const podium = document.getElementById('podium');
const testSelect = document.getElementById('leaderboardTestSelect');

function escapeHtml(v='') {
  return String(v).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])
  );
}

function getInitials(name='विद्यार्थी'){
  return String(name).trim().split(/\s+/).filter(Boolean)
    .map(x=>x[0]).join('').slice(0,2).toUpperCase() || 'वि';
}

function studentPhotoHtml(row, className='leader-photo'){
  const name=row.full_name || 'विद्यार्थी';
  if(row.photo_url){
    return `<div class="${className}"><img src="${escapeHtml(row.photo_url)}" alt="${escapeHtml(name)}" onerror="this.remove();this.parentElement.textContent='${escapeHtml(getInitials(name))}'"></div>`;
  }
  return `<div class="${className}">${escapeHtml(getInitials(name))}</div>`;
}

async function addLeaderboardPhotos(rows){
  if(!rows || !rows.length) return rows || [];

  const ids=[...new Set(rows.map(r=>String(r.student_code || '').trim()).filter(Boolean))];
  if(!ids.length) return rows;

  const {data,error}=await supabaseClient
    .from('students')
    .select('student_id,photo_url')
    .in('student_id',ids);

  if(error){
    console.error('Leaderboard photo load error:',error);
    return rows;
  }

  const photoMap=new Map((data || []).map(s=>[String(s.student_id),s.photo_url || '']));
  return rows.map(r=>({
    ...r,
    photo_url:photoMap.get(String(r.student_code)) || r.photo_url || ''
  }));
}

function medal(rank) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
}

async function loadLeaderboard(classLevel, testId) {
  podium.innerHTML = '<div style="width:100%;text-align:center;padding:28px 12px;">लीडरबोर्ड लोड हो रहा है...</div>';
  topTen.innerHTML = '';

  const { data, error } = await supabaseClient.rpc('get_ganit_leaderboard', {
    p_class_level: Number(classLevel),
    p_test_id: Number(testId)
  });

  if (error) {
    console.error(error);
    podium.innerHTML = `<div class="error-box">Leaderboard load नहीं हुआ: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data || !data.length) {
    podium.innerHTML = '<div style="width:100%;text-align:center;padding:28px 12px;"><b>इस टेस्ट के लिए अभी कोई Result उपलब्ध नहीं है।</b></div>';
    return;
  }

  // Ranking पहले तुरंत दिखाएँ। Profile Photo query Ranking को block नहीं करेगी।
  renderLeaderboardRows(data);

  // Photos बाद में जोड़ें। Photo load fail होने पर भी ranking सुरक्षित रहेगी।
  try {
    const rowsWithPhotos = await addLeaderboardPhotos(data);
    renderLeaderboardRows(rowsWithPhotos);
  } catch (photoError) {
    console.error('Leaderboard photo enhancement error:', photoError);
  }
}

function renderLeaderboardRows(rowsData) {
  const top3 = rowsData.slice(0,3);
  podium.innerHTML = top3.map(r => `
    <div class="podium-card">
      <div class="podium-rank">${medal(Number(r.rank_no))}</div>
      ${studentPhotoHtml(r,'leader-podium-photo')}
      <b>${escapeHtml(r.full_name)}</b>
      <small>${escapeHtml(r.score)}/${escapeHtml(r.total_marks)} • ${escapeHtml(Number(r.percentage || 0).toFixed(1))}%</small>
    </div>
  `).join('');

  const rows = rowsData.slice(0,10);
  topTen.innerHTML = rows.map(r => `
    <div class="rank-row">
      <span class="rank-medal"><b>${medal(Number(r.rank_no))}</b></span>
      ${studentPhotoHtml(r,'leader-row-photo')}
      <span class="rank-student"><b>${escapeHtml(r.full_name)}</b><br><small>${escapeHtml(r.student_code)}</small></span>
      <span class="rank-score"><b>${escapeHtml(r.score)}/${escapeHtml(r.total_marks)}</b><br><small>${escapeHtml(Number(r.percentage || 0).toFixed(1))}%</small></span>
    </div>
  `).join('');
}

async function initLeaderboard() {
  const studentCode = sessionStorage.getItem('ganit_setu_student_id');

  if (!studentCode) {
    podium.innerHTML = '<div class="error-box">कृपया पहले Student Login करें।</div>';
    return;
  }

  let classLevel = Number(sessionStorage.getItem('ganit_setu_student_class'));

  if (classLevel !== 9 && classLevel !== 10) {
    const { data: student, error: studentError } = await supabaseClient
      .from('students')
      .select('class_level, full_name')
      .eq('student_id', studentCode)
      .maybeSingle();

    if (studentError || !student || !student.class_level) {
      console.error('Student class load error:', studentError);
      podium.innerHTML = '<div class="error-box">Student की Class जानकारी नहीं मिली। कृपया दोबारा Login करें।</div>';
      return;
    }

    classLevel = Number(student.class_level);
    sessionStorage.setItem('ganit_setu_student_class', String(classLevel));
    if (student.full_name) {
      sessionStorage.setItem('ganit_setu_student_name', student.full_name);
    }
  }

  if (classLevel !== 9 && classLevel !== 10) {
    podium.innerHTML = '<div class="error-box">Student की सही Class जानकारी नहीं मिली।</div>';
    return;
  }

  const { data: tests, error } = await supabaseClient.rpc('get_ganit_leaderboard_tests', {
    p_class_level: classLevel
  });

  if (error) {
    podium.innerHTML = `<div class="error-box">टेस्ट सूची load नहीं हुई: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!tests || !tests.length) {
    testSelect.innerHTML = '<option value="">अभी कोई टेस्ट Result उपलब्ध नहीं है</option>';
    podium.innerHTML = '<div style="width:100%;text-align:center;padding:28px 12px;"><b>अभी आपकी कक्षा में कोई टेस्ट Result उपलब्ध नहीं है।</b></div>';
    return;
  }

  testSelect.innerHTML = tests.map(t =>
    `<option value="${escapeHtml(t.test_id)}">${escapeHtml(t.title || t.test_type)} (${escapeHtml(t.question_count || '')} प्रश्न)</option>`
  ).join('');

  testSelect.onchange = () => loadLeaderboard(classLevel, testSelect.value);
  loadLeaderboard(classLevel, testSelect.value);
}

document.addEventListener('DOMContentLoaded', initLeaderboard);
