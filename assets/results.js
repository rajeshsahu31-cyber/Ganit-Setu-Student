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

function testLabel(row) {
  const map = {
    course_progress: 'कोर्स टेस्ट',
    chapter_practice: 'अध्याय टेस्ट',
    daily: 'Daily Test'
  };
  return row.test_title || map[row.test_type] || 'टेस्ट';
}

async function loadResults() {
  const box = document.getElementById('resultList');
  const studentCode = sessionStorage.getItem('ganit_setu_student_id');

  if (!studentCode) {
    box.innerHTML = '<div class="error-box">कृपया पहले Student Login करें।</div>';
    return;
  }

  const { data, error } = await supabaseClient.rpc('get_ganit_student_results', {
    p_student_code: studentCode
  });

  if (error) {
    console.error(error);
    box.innerHTML = '<div class="error-box">Result load नहीं हो सका: ' +
      escapeHtml(error.message) + '</div>';
    return;
  }

  if (!data || !data.length) {
    box.innerHTML = `
      <div class="rank-row" style="justify-content:center;text-align:center;padding:24px;">
        <span><b>अभी कोई टेस्ट Result उपलब्ध नहीं है</b><br>
        <small>टेस्ट Submit करने के बाद आपका वास्तविक Result यहाँ दिखाई देगा।</small></span>
      </div>`;
    return;
  }

  box.innerHTML = data.map(row => `
    <div class="result-row">
      <div>
        <b>${escapeHtml(formatDateTime(row.submitted_at))}</b>
        <p>${escapeHtml(testLabel(row))} • कक्षा ${escapeHtml(row.class_level)}</p>
      </div>
      <div>
        <b>${escapeHtml(row.score ?? 0)}/${escapeHtml(row.total_marks ?? 0)}</b>
        <small>स्कोर</small>
      </div>
      <div>
        <b>${escapeHtml(row.correct_answers ?? 0)}</b>
        <small>सही</small>
      </div>
      <div>
        <b>${escapeHtml(Number(row.percentage ?? 0).toFixed(1))}%</b>
        <small>प्रतिशत</small>
      </div>
      <div>
        <b>${escapeHtml(formatDuration(row.time_taken_seconds))}</b>
        <small>समय</small>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadResults);
