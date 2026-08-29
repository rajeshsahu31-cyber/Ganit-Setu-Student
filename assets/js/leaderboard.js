const topTen = document.getElementById('topTen');
const podium = document.getElementById('podium');
const testSelect = document.getElementById('leaderboardTestSelect');

function escapeHtml(v='') {
  return String(v).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])
  );
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

  const top3 = data.slice(0,3);
  podium.innerHTML = top3.map(r => `
    <div class="podium-card">
      <div class="podium-rank">${medal(Number(r.rank_no))}</div>
      <b>${escapeHtml(r.full_name)}</b>
      <small>${escapeHtml(r.score)}/${escapeHtml(r.total_marks)} • ${escapeHtml(Number(r.percentage).toFixed(1))}%</small>
    </div>
  `).join('');

  const rows = data.slice(0,10);
  topTen.innerHTML = rows.map(r => `
    <div class="rank-row">
      <span><b>${medal(Number(r.rank_no))}</b></span>
      <span><b>${escapeHtml(r.full_name)}</b><br><small>${escapeHtml(r.student_code)}</small></span>
      <span><b>${escapeHtml(r.score)}/${escapeHtml(r.total_marks)}</b><br><small>${escapeHtml(Number(r.percentage).toFixed(1))}%</small></span>
    </div>
  `).join('');
}

async function initLeaderboard() {
  const studentCode = sessionStorage.getItem('ganit_setu_student_id');

  if (!studentCode) {
    podium.innerHTML = '<div class="error-box">कृपया पहले Student Login करें।</div>';
    return;
  }

  const classRes = await supabaseClient.rpc('get_ganit_student_class', {
    p_student_code: studentCode
  });

  if (classRes.error || !classRes.data) {
    podium.innerHTML = '<div class="error-box">Student की Class जानकारी नहीं मिली।</div>';
    return;
  }

  const classLevel = Number(classRes.data);

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
