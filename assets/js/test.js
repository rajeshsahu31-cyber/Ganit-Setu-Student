// GANIT SETU STUDENT TEST SYSTEM
// Clean replacement: all three tests + Supabase save

const $ = id => document.getElementById(id);
const MAX_CHAPTERS = { 9: 12, 10: 14 };
const DAILY_QUESTION_COUNT = 5;

function getClassLevel() {
  const n = Number(sessionStorage.getItem('ganit_setu_student_class'));
  return MAX_CHAPTERS[n] ? n : 10;
}

function getStudentCode() {
  return sessionStorage.getItem('ganit_setu_student_id') || '';
}

function getLocalDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])
  );
}

let questions = [], currentIndex = 0, answers = [];
let startedAt = 0, timerHandle = null, currentTestMeta = null, currentLockedTestId = null;

async function loadQuestions(classLevel, chapterNumber = null) {
  let q = supabaseClient
    .from('questions')
    .select('id,class_level,chapter_number,chapter_name,question_text,option_a,option_b,option_c,option_d,correct_option')
    .eq('class_level', classLevel)
    .eq('status', 'active')
    .order('id', { ascending: true });

  if (chapterNumber !== null) q = q.eq('chapter_number', chapterNumber);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

function startTimer() {
  const timer = $('timer');
  if (!timer) return;
  clearInterval(timerHandle);
  startedAt = Date.now();

  timerHandle = setInterval(() => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    timer.textContent =
      `⏱️ ${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }, 1000);
}

function renderQuestion() {
  const q = questions[currentIndex];
  if (!q) return;

  $('questionNo').textContent = `प्रश्न ${currentIndex + 1} / ${questions.length}`;
  $('questionText').innerHTML =
    `<div class="chapter-label">अध्याय ${esc(q.chapter_number)}${q.chapter_name ? ' : ' + esc(q.chapter_name) : ''}</div>` +
    `<div>${esc(q.question_text)}</div>`;

  const options = [['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d]];
  $('options').innerHTML = options.map(([k,v]) =>
    `<button type="button" class="option-btn ${answers[currentIndex]===k?'selected':''}" data-option="${k}">
      <b>${k}.</b> ${esc(v)}
    </button>`
  ).join('');

  $('options').querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      answers[currentIndex] = btn.dataset.option;
      $('options').querySelectorAll('button').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
    };
  });

  $('nextQuestion').textContent =
    currentIndex === questions.length - 1 ? 'टेस्ट Submit करें' : 'अगला प्रश्न →';
}

async function createTestAndQuestions() {
  const m = currentTestMeta;
  if (!m) throw new Error('Test की जानकारी उपलब्ध नहीं है।');

  // सबसे पहले existing test खोजें.
  // इससे एक ही Course/Chapter/Daily test के लिए हर बार नया test_id नहीं बनेगा.
  const { data: existing, error: findError } = await supabaseClient
    .from('tests')
    .select('id')
    .eq('title', m.title)
    .eq('test_type', m.testType)
    .eq('class_level', m.classLevel)
    .eq('chapter_from', m.chapterFrom)
    .eq('chapter_to', m.chapterTo)
    .limit(1);

  if (findError) {
    throw new Error('Existing Test की जाँच नहीं हो सकी: ' + findError.message);
  }

  if (existing && existing.length) {
    return Number(existing[0].id);
  }

  // केवल पहली बार नया test बनाया जाएगा.
  const { data: testId, error } = await supabaseClient.rpc('get_or_create_ganit_test', {
    p_title: m.title,
    p_test_type: m.testType,
    p_class_level: m.classLevel,
    p_chapter_from: m.chapterFrom,
    p_chapter_to: m.chapterTo,
    p_question_count: questions.length,
    p_duration_minutes: m.durationMinutes || 10
  });

  if (error) throw error;

  const questionIds = questions.map(q => Number(q.id));
  const { error: syncError } = await supabaseClient.rpc('sync_ganit_test_questions', {
    p_test_id: Number(testId),
    p_question_ids: questionIds
  });

  if (syncError) throw syncError;

  return Number(testId);
}

// ============================================
// PERMANENT TEST LOCK SYSTEM
// Actual schema:
// students.id = UUID
// students.student_id = GS-0001 style code
// test_attempts has UNIQUE(student_id, test_id)
// ============================================

async function getStudentUuidForAttempt() {
  const studentCode = getStudentCode();
  if (!studentCode) throw new Error('Student login information नहीं मिली।');

  const { data, error } = await supabaseClient
    .from('students')
    .select('id')
    .eq('student_id', studentCode)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.id) {
    throw new Error('विद्यार्थी का database record नहीं मिला।');
  }

  return data.id;
}

function getAttemptLockKey() {
  const student = getStudentCode();
  const m = currentTestMeta || {};

  // Progressive/Course test: once attempted, the ENTIRE progressive test
  // is locked for this student, regardless of chapter range.
  if (m.testType === 'course_progress') {
    return `ganit_setu_lock_${student}_course_progress_${m.classLevel}`;
  }

  // Chapter practice: each chapter is locked separately.
  if (m.testType === 'chapter_practice') {
    return `ganit_setu_lock_${student}_chapter_${m.classLevel}_${m.chapterFrom}`;
  }

  // Daily: the same daily test/date is locked separately.
  return `ganit_setu_lock_${student}_${m.testType}_${m.classLevel}_${m.title}`;
}

async function ensureTestIsUnlocked(testId) {
  const localKey = getAttemptLockKey();
  if (localStorage.getItem(localKey) === 'submitted') {
    throw new Error('🔒 आप यह टेस्ट पहले ही दे चुके हैं। इसे दोबारा नहीं दिया जा सकता।');
  }

  const studentUuid = await getStudentUuidForAttempt();
  const m = currentTestMeta;

  const { data, error } = await supabaseClient
    .from('test_attempts')
    .select('id,status,submitted_at,test_id,tests(id,title,test_type,class_level,chapter_from,chapter_to)')
    .eq('student_id', studentUuid);

  if (error) throw new Error('Test lock की जाँच नहीं हो सकी: ' + error.message);

  const alreadyAttempted = (data || []).some(a => {
    const t = a.tests;
    if (!t) return false;

    // FIRST / PROGRESSIVE TEST:
    // Any previous course_progress attempt for this class locks the WHOLE progressive test.
    if (m.testType === 'course_progress') {
      return String(t.test_type) === 'course_progress' &&
             Number(t.class_level) === Number(m.classLevel);
    }

    // SECOND / CHAPTER TEST:
    // Only the same chapter is locked.
    if (m.testType === 'chapter_practice') {
      return String(t.test_type) === 'chapter_practice' &&
             Number(t.class_level) === Number(m.classLevel) &&
             Number(t.chapter_from) === Number(m.chapterFrom);
    }

    // THIRD / DAILY TEST:
    // Only the same dated daily test is locked.
    return String(t.test_type) === String(m.testType) &&
           Number(t.class_level) === Number(m.classLevel) &&
           String(t.title) === String(m.title);
  });

  if (alreadyAttempted) {
    throw new Error('🔒 आप यह टेस्ट पहले ही दे चुके हैं। इसे दोबारा नहीं दिया जा सकता।');
  }

  return true;
}

async function checkLockBeforeStarting() {
  // हमेशा stable/existing test_id लें.
  const testId = await createTestAndQuestions();

  // उसी UUID + उसी stable test_id का attempt database में खोजें.
  await ensureTestIsUnlocked(testId);

  currentLockedTestId = Number(testId);
  return currentLockedTestId;
}

async function saveAttempt() {
  const studentCode = getStudentCode();
  if (!studentCode) throw new Error('Student login information नहीं मिली।');

  const testId = currentLockedTestId || await createTestAndQuestions();
  const payload = questions.map((q,i) => ({
    question_id: q.id,
    selected_option: answers[i] || null
  }));

  const { data, error } = await supabaseClient.rpc('save_ganit_test_attempt', {
    p_student_code: studentCode,
    p_test_id: testId,
    p_answers: payload,
    p_time_taken_seconds: Math.floor((Date.now() - startedAt) / 1000)
  });

  if (error) throw error;
  return data;
}

async function submitTest(testBoxId, messageBoxId) {
  clearInterval(timerHandle);

  const btn = $('nextQuestion');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Save हो रहा है...';
  }

  try {
    const r = await saveAttempt();

    // Second protection layer: after a successful submit, lock this logical test
    // immediately in the same browser as well.
    localStorage.setItem(getAttemptLockKey(), 'submitted');

    // Result उसी visible test box में दिखाएँ,
    // ताकि hidden setup section के कारण Success message गायब न हो।
    $(testBoxId).innerHTML =
      `<div class="success-box">
        <h2>✓ टेस्ट सफलतापूर्वक Submit हो गया</h2>
        <br>
        सही उत्तर: <b>${r.correct}/${r.total}</b><br>
        गलत उत्तर: <b>${r.wrong}</b><br>
        बिना उत्तर: <b>${r.unattempted}</b><br>
        प्रतिशत: <b>${r.percentage}%</b><br><br>
        <small>✓ Result Supabase में save हो गया है।</small><br><br>
        <button class="primary-btn" onclick="location.href='test-types.html'">
          टेस्ट पेज पर जाएँ
        </button>
      </div>`;

  } catch (e) {
    console.error(e);

    // Error भी उसी visible test box में दिखेगा।
    $(testBoxId).innerHTML =
      `<div class="error-box">
        <b>टेस्ट का Result save नहीं हुआ</b><br><br>
        ${esc(e.message || 'Unknown error')}<br><br>
        <button class="primary-btn" onclick="location.reload()">
          दोबारा प्रयास करें
        </button>
      </div>`;
  }
}

function beginTest(testBoxId, messageBoxId) {
  currentIndex = 0;
  answers = new Array(questions.length).fill(null);
  $(testBoxId).style.display = 'block';
  renderQuestion();
  startTimer();

  $('nextQuestion').onclick = () => {
    if (!answers[currentIndex]) {
      alert('कृपया एक विकल्प चुनें।');
      return;
    }
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      renderQuestion();
    } else {
      submitTest(testBoxId, messageBoxId);
    }
  };
}

// TEST 1: selected chapter range, 10 questions per chapter
function setupCourseTest() {
  if (!$('chapterTo')) return;

  const classLevel = getClassLevel();
  const select = $('chapterTo');
  select.innerHTML = '<option value="">अध्याय चुनें</option>';

  for (let n=1; n<=MAX_CHAPTERS[classLevel]; n++) {
    select.innerHTML += `<option value="${n}">अध्याय ${n}</option>`;
  }

  if ($('studentClassInfo')) {
    $('studentClassInfo').textContent =
      `कक्षा ${classLevel} • कुल ${MAX_CHAPTERS[classLevel]} अध्याय`;
  }

  $('startCourseBtn').onclick = async () => {
    const chapterTo = Number(select.value);
    const message = $('courseMessage');

    if (!chapterTo) {
      message.innerHTML = '<div class="error-box">कृपया अध्याय चुनें।</div>';
      return;
    }

    try {
      const all = await loadQuestions(classLevel);
      questions = [];

      for (let ch=1; ch<=chapterTo; ch++) {
        questions.push(...all.filter(q => Number(q.chapter_number) === ch).slice(0,10));
      }

      if (!questions.length) throw new Error('चुने गए अध्यायों में Questions उपलब्ध नहीं हैं।');

      currentTestMeta = {
        title: `Course Test Class ${classLevel} Chapter 1-${chapterTo}`,
        testType: 'course_progress',
        classLevel,
        chapterFrom: 1,
        chapterTo,
        durationMinutes: 10
      };

      currentLockedTestId = null;
      await checkLockBeforeStarting();
      $('courseSetup').style.display = 'none';
      $('courseTest').style.display = 'block';
      if ($('testClass')) $('testClass').textContent = `कक्षा ${classLevel} • अध्याय 1 से ${chapterTo}`;
      if ($('questionCount')) $('questionCount').textContent = `कुल ${questions.length} प्रश्न`;

      beginTest('courseTest','courseMessage');
    } catch(e) {
      message.innerHTML = `<div class="error-box">${esc(e.message)}</div>`;
    }
  };
}

// TEST 2: one selected chapter, exactly 10 questions
function setupChapterTest() {
  if (!$('chapterSelect')) return;

  const classLevel = getClassLevel();
  const select = $('chapterSelect');
  select.innerHTML = '<option value="">अध्याय चुनें</option>';

  for (let n=1; n<=MAX_CHAPTERS[classLevel]; n++) {
    select.innerHTML += `<option value="${n}">अध्याय ${n}</option>`;
  }

  if ($('chapterClassInfo')) {
    $('chapterClassInfo').textContent = `कक्षा ${classLevel} • एक अध्याय • 10 Questions`;
  }

  $('startChapterBtn').onclick = async () => {
    const chapter = Number(select.value);
    const message = $('chapterMessage');

    if (!chapter) {
      message.innerHTML = '<div class="error-box">कृपया अध्याय चुनें।</div>';
      return;
    }

    try {
      questions = (await loadQuestions(classLevel, chapter)).slice(0,10);

      if (questions.length < 10) {
        throw new Error(`इस अध्याय में अभी ${questions.length} Questions हैं। 10 Questions उपलब्ध होने चाहिए।`);
      }

      currentTestMeta = {
        title: `Chapter Test Class ${classLevel} Chapter ${chapter}`,
        testType: 'chapter_practice',
        classLevel,
        chapterFrom: chapter,
        chapterTo: chapter,
        durationMinutes: 10
      };

      currentLockedTestId = null;
      await checkLockBeforeStarting();
      $('chapterSetup').style.display = 'none';
      if ($('chapterTestTitle')) {
        $('chapterTestTitle').textContent = `कक्षा ${classLevel} • अध्याय ${chapter} • 10 Questions`;
      }

      beginTest('chapterTest','chapterMessage');
    } catch(e) {
      message.innerHTML = `<div class="error-box">${esc(e.message)}</div>`;
    }
  };
}

// TEST 3: random 5 questions from the full question bank of the student's class
function setupDailyTest() {
  if (!$('dailyStartBtn')) return;

  $('dailyStartBtn').onclick = async () => {
    const message = $('dailyMessage');
    const classLevel = getClassLevel();

    try {
      const all = await loadQuestions(classLevel);

      if (all.length < DAILY_QUESTION_COUNT) {
        throw new Error(`Daily Test के लिए कम से कम ${DAILY_QUESTION_COUNT} Questions उपलब्ध होने चाहिए।`);
      }

      const shuffled = [...all];
      for (let i=shuffled.length-1; i>0; i--) {
        const j = Math.floor(Math.random() * (i+1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      questions = shuffled.slice(0, DAILY_QUESTION_COUNT);

      currentTestMeta = {
        title: `Daily Test Class ${classLevel} ${getLocalDateKey()}`, 
        testType: 'daily',
        classLevel,
        chapterFrom: 1,
        chapterTo: MAX_CHAPTERS[classLevel],
        durationMinutes: 10
      };

      currentLockedTestId = null;
      await checkLockBeforeStarting();
      $('dailySetup').style.display = 'none';
      if ($('dailyTitle')) {
        $('dailyTitle').textContent =
          `आज का Daily Test • कक्षा ${classLevel} • ${DAILY_QUESTION_COUNT} Questions`;
      }

      beginTest('dailyTest','dailyMessage');
    } catch(e) {
      message.innerHTML = `<div class="error-box">${esc(e.message)}</div>`;
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  setupCourseTest();
  setupChapterTest();
  setupDailyTest();
});
