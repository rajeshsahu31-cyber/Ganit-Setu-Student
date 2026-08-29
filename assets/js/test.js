// ============================================
// GANIT SETU STUDENT - TEST SYSTEM
// Corrected Student Panel version
// ============================================
// IMPORTANT:
// यह Student Panel की test.js है.
// इसमें Admin Bulk Upload code नहीं होना चाहिए.

const $ = (id) => document.getElementById(id);

function maxChapterForClass(classLevel) {
  return Number(classLevel) === 9 ? 12 : 14;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

let currentStudent = null;
let currentClassLevel = null;
let courseQuestions = [];
let currentQuestionIndex = 0;
let selectedOption = null;
let testStartedAt = null;
let timerInterval = null;

async function loadStudentForCourse() {
  // Home/Profile page यह value पहले से save करता है.
  const savedClass = Number(sessionStorage.getItem('ganit_setu_student_class'));

  if ([9, 10].includes(savedClass)) {
    currentClassLevel = savedClass;
  }

  const studentId = sessionStorage.getItem('ganit_setu_student_id');

  // अगर Supabase connection उपलब्ध है तो class को database से भी verify करें.
  if (studentId && typeof supabaseClient !== 'undefined') {
    try {
      const { data, error } = await supabaseClient
        .from('students')
        .select('id,student_id,full_name,class_level')
        .eq('student_id', studentId)
        .maybeSingle();

      if (!error && data) {
        currentStudent = data;
        currentClassLevel = Number(data.class_level);
        sessionStorage.setItem('ganit_setu_student_class', String(currentClassLevel));
      }
    } catch (e) {
      // Saved class से dropdown फिर भी चलेगा.
      console.warn('Student verification skipped:', e);
    }
  }
}

function fillCourseChapters() {
  const select = $('chapterTo');
  if (!select) return;

  // Class 9 = 12 chapters, Class 10 = 14 chapters
  if (![9, 10].includes(Number(currentClassLevel))) {
    select.innerHTML = '<option value="">अध्याय चुनें</option>';
    return;
  }

  const max = maxChapterForClass(currentClassLevel);
  select.innerHTML = '<option value="">अध्याय चुनें</option>';

  for (let i = 1; i <= max; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `अध्याय ${i}`;
    select.appendChild(option);
  }
}

function showCourseMessage(message, type = 'error') {
  const box = $('courseMessage');
  if (!box) return;

  box.innerHTML =
    `<div class="${type === 'error' ? 'error-box' : 'success-box'}">${escapeHtml(message)}</div>`;
}

async function setupCoursePage() {
  await loadStudentForCourse();

  const info = $('studentClassInfo');

  if (![9, 10].includes(Number(currentClassLevel))) {
    if (info) {
      info.textContent = 'आपकी कक्षा की जानकारी नहीं मिल सकी। कृपया Home Page से दोबारा Test खोलें।';
    }
    showCourseMessage('कक्षा की जानकारी नहीं मिली। कृपया दोबारा Login करें।');
    return;
  }

  if (info) {
    const name = currentStudent?.full_name
      || sessionStorage.getItem('ganit_setu_student_name')
      || '';

    info.textContent =
      `${name ? name + ' • ' : ''}कक्षा ${currentClassLevel} • कुल ${maxChapterForClass(currentClassLevel)} अध्याय`;
  }

  // यह dropdown हमेशा fixed chapter count से बनेगा.
  // Questions database में हों या न हों, list दिखाई देगी.
  fillCourseChapters();

  const startBtn = $('startCourseBtn');
  if (startBtn) {
    startBtn.addEventListener('click', startCourseTest);
  }
}

async function startCourseTest() {
  const chapterTo = Number($('chapterTo')?.value);

  if (!chapterTo) {
    showCourseMessage('कृपया अध्याय चुनें।');
    return;
  }

  if (![9, 10].includes(Number(currentClassLevel))) {
    showCourseMessage('कक्षा की जानकारी उपलब्ध नहीं है।');
    return;
  }

  if (typeof supabaseClient === 'undefined') {
    showCourseMessage('Supabase connection उपलब्ध नहीं है।');
    return;
  }

  const startBtn = $('startCourseBtn');
  startBtn.disabled = true;
  startBtn.textContent = 'प्रश्न लोड हो रहे हैं...';

  const messageBox = $('courseMessage');
  if (messageBox) messageBox.innerHTML = '';

  try {
    const { data, error } = await supabaseClient
      .from('questions')
      .select('id,class_level,chapter_number,chapter_name,question_text,option_a,option_b,option_c,option_d,correct_option,explanation')
      .eq('class_level', Number(currentClassLevel))
      .eq('status', 'active')
      .lte('chapter_number', chapterTo)
      .order('chapter_number', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;

    // हर चुने गए अध्याय से अधिकतम 10 Questions.
    // उदाहरण: अध्याय 1 से 5 = 50 Questions.
    const byChapter = new Map();

    (data || []).forEach(q => {
      const chapter = Number(q.chapter_number);
      if (!byChapter.has(chapter)) byChapter.set(chapter, []);
      byChapter.get(chapter).push(q);
    });

    const selected = [];

    for (let chapter = 1; chapter <= chapterTo; chapter++) {
      const list = byChapter.get(chapter) || [];
      selected.push(...list.slice(0, 10));
    }

    if (!selected.length) {
      showCourseMessage('चुने गए अध्यायों में अभी कोई Question उपलब्ध नहीं है।');
      return;
    }

    courseQuestions = selected;
    currentQuestionIndex = 0;
    selectedOption = null;
    testStartedAt = Date.now();

    $('courseSetup').style.display = 'none';
    $('courseTest').style.display = 'block';

    $('testClass').textContent =
      `कक्षा ${currentClassLevel} • अध्याय 1 से ${chapterTo}`;

    $('questionCount').textContent =
      `कुल ${courseQuestions.length} प्रश्न`;

    sessionStorage.removeItem('ganit_setu_course_answers');

    renderCourseQuestion();
    startTimer();

  } catch (err) {
    showCourseMessage('Questions load नहीं हुए: ' + (err.message || 'Unknown error'));
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = 'टेस्ट शुरू करें';
  }
}

function renderCourseQuestion() {
  const q = courseQuestions[currentQuestionIndex];
  if (!q) return;

  selectedOption = null;

  $('questionNo').textContent =
    `प्रश्न ${currentQuestionIndex + 1} / ${courseQuestions.length}`;

  $('questionText').innerHTML =
    `<div class="chapter-label">अध्याय ${escapeHtml(q.chapter_number)}: ${escapeHtml(q.chapter_name || '')}</div>` +
    `<div>${escapeHtml(q.question_text)}</div>`;

  const options = [
    ['A', q.option_a],
    ['B', q.option_b],
    ['C', q.option_c],
    ['D', q.option_d]
  ];

  $('options').innerHTML = options.map(([key, value]) =>
    `<button type="button" data-option="${key}" class="option-btn"><b>${key}.</b> ${escapeHtml(value)}</button>`
  ).join('');

  $('options').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      $('options').querySelectorAll('button')
        .forEach(b => b.classList.remove('selected'));

      btn.classList.add('selected');
      selectedOption = btn.dataset.option;
    });
  });

  $('nextQuestion').textContent =
    currentQuestionIndex === courseQuestions.length - 1
      ? 'टेस्ट Submit करें'
      : 'अगला प्रश्न →';

  $('nextQuestion').onclick = nextCourseQuestion;
}

function nextCourseQuestion() {
  if (!selectedOption) {
    alert('कृपया एक विकल्प चुनें।');
    return;
  }

  const answers =
    JSON.parse(sessionStorage.getItem('ganit_setu_course_answers') || '[]');

  answers[currentQuestionIndex] = selectedOption;

  sessionStorage.setItem(
    'ganit_setu_course_answers',
    JSON.stringify(answers)
  );

  if (currentQuestionIndex < courseQuestions.length - 1) {
    currentQuestionIndex++;
    renderCourseQuestion();
    return;
  }

  finishCourseTest();
}

function startTimer() {
  const timer = $('timer');
  if (!timer) return;

  clearInterval(timerInterval);

  const update = () => {
    const seconds = Math.floor((Date.now() - testStartedAt) / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');

    timer.textContent = `⏱️ ${mm}:${ss}`;
  };

  update();
  timerInterval = setInterval(update, 1000);
}

function finishCourseTest() {
  clearInterval(timerInterval);

  const answers =
    JSON.parse(sessionStorage.getItem('ganit_setu_course_answers') || '[]');

  let correct = 0;

  courseQuestions.forEach((q, index) => {
    if (
      String(answers[index] || '').toUpperCase() ===
      String(q.correct_option || '').toUpperCase()
    ) {
      correct++;
    }
  });

  const total = courseQuestions.length;
  const wrong = total - correct;
  const percentage = total
    ? ((correct / total) * 100).toFixed(2)
    : '0.00';

  sessionStorage.setItem(
    'ganit_setu_last_result',
    JSON.stringify({
      correct,
      wrong,
      total,
      percentage,
      class_level: currentClassLevel,
      submitted_at: new Date().toISOString()
    })
  );

  sessionStorage.removeItem('ganit_setu_course_answers');

  $('courseTest').style.display = 'none';

  $('courseMessage').innerHTML =
    `<div class="success-box"><b>✓ टेस्ट पूरा हुआ</b><br><br>` +
    `सही उत्तर: <b>${correct}</b> / ${total}<br>` +
    `गलत उत्तर: <b>${wrong}</b><br>` +
    `प्रतिशत: <b>${percentage}%</b></div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  // केवल Course Test page पर chapter dropdown logic चलाएँ.
  if ($('chapterTo') && $('startCourseBtn')) {
    setupCoursePage();
  }

  const exitBtn = $('exitTest');

  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      clearInterval(timerInterval);
      sessionStorage.removeItem('ganit_setu_course_answers');
      location.href = 'test-types.html';
    });
  }
});
