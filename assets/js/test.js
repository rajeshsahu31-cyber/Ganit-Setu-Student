/*
 * GANIT SETU — Student Test Engine
 *
 * Final rules:
 * 1) Course test: selected chapters 1..N, 10 random questions per chapter.
 * 2) Chapter test: one selected chapter, 10 random questions.
 * 3) Daily test: 5 random questions from the dedicated Daily question pool.
 * 4) A test can be attempted once per student per DATE. The next date creates a
 *    fresh logical test automatically after 00:00 (India time).
 * 5) Daily questions are tracked across previous daily cycles so the student
 *    receives unseen questions first. When the pool is exhausted a new shuffled
 *    cycle starts.
 * 6) Question-bank size is not hard-coded; 25/50/100/200+ all work.
 *
 * Only this file owns test selection/start/submit logic. Old duplicate lock or
 * random-selection logic must not be added alongside this implementation.
 */

const $ = id => document.getElementById(id);
const MAX_CHAPTERS = { 9: 12, 10: 14 };
const QUESTIONS_PER_CHAPTER = 10;
const DAILY_QUESTION_COUNT = 5;
const INDIA_TZ = 'Asia/Kolkata';

function getClassLevel() {
  const n = Number(sessionStorage.getItem('ganit_setu_student_class'));
  return MAX_CHAPTERS[n] ? n : 10;
}

function getStudentCode() {
  return sessionStorage.getItem('ganit_setu_student_id') || '';
}

function getIndiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])
  );
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample(items, count) {
  return shuffle(items).slice(0, count);
}

let questions = [];
let currentIndex = 0;
let answers = [];
let startedAt = 0;
let timerHandle = null;
let currentTestMeta = null;
let currentLockedTestId = null;

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
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    timer.textContent = `⏱️ ${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
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
  $('options').innerHTML = options.map(([key, value]) =>
    `<button type="button" class="option-btn ${answers[currentIndex] === key ? 'selected' : ''}" data-option="${key}">
      <b>${key}.</b> ${esc(value)}
    </button>`
  ).join('');

  $('options').querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      answers[currentIndex] = btn.dataset.option;
      $('options').querySelectorAll('button').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
    };
  });

  $('nextQuestion').textContent = currentIndex === questions.length - 1
    ? 'टेस्ट Submit करें'
    : 'अगला प्रश्न →';
}

async function getOrCreateTest() {
  const m = currentTestMeta;
  if (!m) throw new Error('Test की जानकारी उपलब्ध नहीं है।');

  // Test identity includes the date. Therefore a new date automatically gets
  // a new test_id while the old date remains available for review.
  const { data: existing, error: findError } = await supabaseClient
    .from('tests')
    .select('id')
    .eq('title', m.title)
    .eq('test_type', m.testType)
    .eq('class_level', m.classLevel)
    .eq('chapter_from', m.chapterFrom)
    .eq('chapter_to', m.chapterTo)
    .limit(1);

  if (findError) throw new Error('Test की जाँच नहीं हो सकी: ' + findError.message);
  if (existing?.length) return Number(existing[0].id);

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

  const { error: syncError } = await supabaseClient.rpc('sync_ganit_test_questions', {
    p_test_id: Number(testId),
    p_question_ids: questions.map(q => Number(q.id))
  });
  if (syncError) throw syncError;

  return Number(testId);
}

async function loadSavedQuestionSet(testId, allQuestions) {
  const { data, error } = await supabaseClient
    .from('test_questions')
    .select('question_id')
    .eq('test_id', Number(testId));
  if (error) throw error;
  if (!data?.length) return [];
  const ids = new Set(data.map(x => String(x.question_id)));
  return (allQuestions || []).filter(q => ids.has(String(q.id)));
}

async function prepareStableQuestionSet(testId, allQuestions, candidateQuestions, expectedCount) {
  // If this dated test already has a saved set, always restore that exact set.
  const saved = await loadSavedQuestionSet(testId, allQuestions);
  if (saved.length >= expectedCount) return saved.slice(0, expectedCount);
  if (candidateQuestions.length < expectedCount) {
    throw new Error(`Test के लिए ${expectedCount} Questions उपलब्ध नहीं हैं।`);
  }
  // First creation uses the carefully selected candidate set (e.g. 10/chapter).
  await syncTestQuestionSet(testId, candidateQuestions);
  return candidateQuestions.slice(0, expectedCount);
}

async function getStudentUuidForAttempt() {
  const studentCode = getStudentCode();
  if (!studentCode) throw new Error('Student login information नहीं मिली।');

  const { data, error } = await supabaseClient
    .from('students')
    .select('id')
    .eq('student_id', studentCode)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error('विद्यार्थी का database record नहीं मिला।');
  return data.id;
}

function getBrowserLockKey() {
  const student = getStudentCode();
  const m = currentTestMeta || {};
  return [
    'ganit_setu_attempt', student, m.testType, m.classLevel,
    m.chapterFrom || 0, m.chapterTo || 0, m.dateKey
  ].join('_');
}

async function ensureTestIsUnlocked(testId) {
  const m = currentTestMeta;
  if (!m) throw new Error('Test की जानकारी उपलब्ध नहीं है।');

  const localKey = getBrowserLockKey();
  if (localStorage.getItem(localKey) === 'submitted') {
    throw new Error('🔒 आपने आज का यह टेस्ट पहले ही दे दिया है। अगला टेस्ट कल 12:00 बजे के बाद खुलेगा।');
  }

  const studentUuid = await getStudentUuidForAttempt();
  const { data, error } = await supabaseClient
    .from('test_attempts')
    .select('id,status,submitted_at,test_id,tests(id,title,test_type,class_level,chapter_from,chapter_to)')
    .eq('student_id', studentUuid)
    .eq('test_id', Number(testId));

  if (error) throw new Error('Test lock की जाँच नहीं हो सकी: ' + error.message);

  // The test_id is date-specific. Thus an attempt on yesterday's test does not
  // lock today's test. This also respects the DB UNIQUE(student_id,test_id).
  const submitted = (data || []).some(a => String(a.status || '').toLowerCase() === 'submitted' || a.submitted_at);
  if (submitted) {
    throw new Error('🔒 आपने आज का यह टेस्ट पहले ही दे दिया है। अगला टेस्ट कल 12:00 बजे के बाद खुलेगा।');
  }
  return true;
}

async function syncTestQuestionSet(testId) {
  const { error } = await supabaseClient.rpc('sync_ganit_test_questions', {
    p_test_id: Number(testId),
    p_question_ids: questions.map(q => Number(q.id))
  });
  if (error) throw error;
}

async function getPreviousDailyQuestionIds(classLevel) {
  const used = new Set();
  const studentUuid = await getStudentUuidForAttempt();

  // Daily history is PER STUDENT, not global for the whole class.
  try {
    const { data: attempts, error: attemptsError } = await supabaseClient
      .from('test_attempts')
      .select('test_id,tests(id,test_type,class_level)')
      .eq('student_id', studentUuid);

    if (!attemptsError && attempts?.length) {
      const dailyIds = attempts
        .filter(a => a.tests && String(a.tests.test_type) === 'daily' && Number(a.tests.class_level) === Number(classLevel))
        .map(a => Number(a.test_id))
        .filter(Number.isFinite);
      if (dailyIds.length) {
        const { data: mappings, error: mapError } = await supabaseClient
          .from('test_questions').select('question_id').in('test_id', dailyIds);
        if (!mapError) (mappings || []).forEach(row => used.add(String(row.question_id)));
      }
    }
  } catch (e) {
    console.warn('Daily DB question history उपलब्ध नहीं हुई:', e);
  }

  // Device-level backup for the same student.
  const key = `ganit_setu_daily_seen_${getStudentCode()}_${classLevel}`;
  try {
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    local.forEach(id => used.add(String(id)));
  } catch (_) {}
  return used;
}

function rememberDailyQuestions(classLevel, selected) {
  const key = `ganit_setu_daily_seen_${getStudentCode()}_${classLevel}`;
  let old = [];
  try { old = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}
  const merged = [...new Set([...old.map(String), ...selected.map(q => String(q.id))])];
  localStorage.setItem(key, JSON.stringify(merged));
}

function clearDailyHistoryForNewCycle(classLevel) {
  localStorage.removeItem(`ganit_setu_daily_seen_${getStudentCode()}_${classLevel}`);
}

async function selectDailyQuestions(classLevel, allQuestions) {
  if (allQuestions.length < DAILY_QUESTION_COUNT) {
    throw new Error(`Daily Test के लिए कम से कम ${DAILY_QUESTION_COUNT} Questions उपलब्ध होने चाहिए।`);
  }

  const used = await getPreviousDailyQuestionIds(classLevel);
  const fresh = allQuestions.filter(q => !used.has(String(q.id)));

  if (fresh.length >= DAILY_QUESTION_COUNT) return sample(fresh, DAILY_QUESTION_COUNT);

  // Finish the current cycle with the remaining unseen questions, then fill
  // the rest from a newly shuffled cycle.
  const tail = sample(fresh, fresh.length);
  const tailIds = new Set(tail.map(q => String(q.id)));
  const remainder = allQuestions.filter(q => !tailIds.has(String(q.id)));
  const needed = DAILY_QUESTION_COUNT - tail.length;

  clearDailyHistoryForNewCycle(classLevel);
  const lastKey = `ganit_setu_daily_last_set_${getStudentCode()}_${classLevel}`;
  let last = [];
  try { last = JSON.parse(localStorage.getItem(lastKey) || '[]').map(String); } catch (_) {}

  let candidate = [...tail, ...sample(remainder, needed)];
  if (candidate.length < DAILY_QUESTION_COUNT) candidate = sample(allQuestions, DAILY_QUESTION_COUNT);

  const sameSet = candidate.length === last.length && candidate.every(q => last.includes(String(q.id)));
  if (sameSet && allQuestions.length > DAILY_QUESTION_COUNT) {
    const alternatives = allQuestions.filter(q => !last.includes(String(q.id)));
    if (alternatives.length >= DAILY_QUESTION_COUNT) candidate = sample(alternatives, DAILY_QUESTION_COUNT);
  }
  return candidate;
}

async function saveAttempt() {
  const studentCode = getStudentCode();
  if (!studentCode) throw new Error('Student login information नहीं मिली।');

  const testId = currentLockedTestId || await getOrCreateTest();
  const payload = questions.map((q, i) => ({
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

async function submitTest(testBoxId) {
  clearInterval(timerHandle);
  const btn = $('nextQuestion');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Save हो रहा है...';
  }

  try {
    const result = await saveAttempt();
    localStorage.setItem(getBrowserLockKey(), 'submitted');

    if (currentTestMeta?.testType === 'daily') {
      rememberDailyQuestions(currentTestMeta.classLevel, questions);
      localStorage.setItem(`ganit_setu_daily_last_set_${getStudentCode()}_${currentTestMeta.classLevel}`, JSON.stringify(questions.map(q => q.id)));
      localStorage.removeItem(`ganit_setu_daily_draft_${getStudentCode()}_${currentTestMeta.classLevel}_${currentTestMeta.dateKey}`);
    }

    $(testBoxId).innerHTML = `
      <div class="success-box">
        <h2>✓ टेस्ट सफलतापूर्वक Submit हो गया</h2><br>
        सही उत्तर: <b>${esc(result?.correct ?? 0)}/${esc(result?.total ?? questions.length)}</b><br>
        गलत उत्तर: <b>${esc(result?.wrong ?? 0)}</b><br>
        बिना उत्तर: <b>${esc(result?.unattempted ?? 0)}</b><br>
        प्रतिशत: <b>${esc(result?.percentage ?? 0)}%</b><br><br>
        <small>✓ आपका Result सुरक्षित हो गया है। यह टेस्ट दोबारा attempt नहीं किया जा सकता।</small><br><br>
        <button class="primary-btn" onclick="location.href='results.html'">पिछला परिणाम देखें</button>
      </div>`;
  } catch (e) {
    console.error(e);
    if (btn) btn.disabled = false;
    $(testBoxId).innerHTML = `<div class="error-box"><b>टेस्ट का Result save नहीं हुआ</b><br><br>${esc(e.message || 'Unknown error')}<br><br><button class="primary-btn" onclick="location.reload()">दोबारा प्रयास करें</button></div>`;
  }
}

function beginTest(testBoxId) {
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
      submitTest(testBoxId);
    }
  };
}

// TEST 1 — selected chapters 1..N, 10 random questions per chapter.
function setupCourseTest() {
  if (!$('chapterTo')) return;

  const classLevel = getClassLevel();
  const select = $('chapterTo');
  select.innerHTML = '<option value="">अध्याय चुनें</option>';
  for (let n = 1; n <= MAX_CHAPTERS[classLevel]; n++) {
    select.innerHTML += `<option value="${n}">अध्याय ${n}</option>`;
  }
  if ($('studentClassInfo')) $('studentClassInfo').textContent = `कक्षा ${classLevel} • कुल ${MAX_CHAPTERS[classLevel]} अध्याय`;

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
      for (let ch = 1; ch <= chapterTo; ch++) {
        const chapterQuestions = all.filter(q => Number(q.chapter_number) === ch);
        if (chapterQuestions.length < QUESTIONS_PER_CHAPTER) {
          throw new Error(`अध्याय ${ch} में ${QUESTIONS_PER_CHAPTER} Questions उपलब्ध नहीं हैं। अभी ${chapterQuestions.length} हैं।`);
        }
        questions.push(...sample(chapterQuestions, QUESTIONS_PER_CHAPTER));
      }

      currentTestMeta = {
        title: `Course Test Class ${classLevel} Chapter 1-${chapterTo} ${getIndiaDateKey()}`,
        testType: 'course_progress', classLevel, chapterFrom: 1, chapterTo,
        dateKey: getIndiaDateKey(), durationMinutes: 10
      };
      currentLockedTestId = await getOrCreateTest();
      await ensureTestIsUnlocked(currentLockedTestId);
      questions = await prepareStableQuestionSet(currentLockedTestId, all, questions, chapterTo * QUESTIONS_PER_CHAPTER);

      $('courseSetup').style.display = 'none';
      $('courseTest').style.display = 'block';
      if ($('testClass')) $('testClass').textContent = `कक्षा ${classLevel} • अध्याय 1 से ${chapterTo}`;
      if ($('questionCount')) $('questionCount').textContent = `कुल ${questions.length} प्रश्न`;
      beginTest('courseTest');
    } catch (e) {
      message.innerHTML = `<div class="error-box">${esc(e.message)}</div>`;
    }
  };
}

// TEST 2 — one selected chapter, 10 random questions.
function setupChapterTest() {
  if (!$('chapterSelect')) return;

  const classLevel = getClassLevel();
  const select = $('chapterSelect');
  select.innerHTML = '<option value="">अध्याय चुनें</option>';
  for (let n = 1; n <= MAX_CHAPTERS[classLevel]; n++) {
    select.innerHTML += `<option value="${n}">अध्याय ${n}</option>`;
  }
  if ($('chapterClassInfo')) $('chapterClassInfo').textContent = `कक्षा ${classLevel} • एक अध्याय • 10 Questions`;

  $('startChapterBtn').onclick = async () => {
    const chapter = Number(select.value);
    const message = $('chapterMessage');
    if (!chapter) {
      message.innerHTML = '<div class="error-box">कृपया अध्याय चुनें।</div>';
      return;
    }

    try {
      const pool = await loadQuestions(classLevel, chapter);
      if (pool.length < QUESTIONS_PER_CHAPTER) {
        throw new Error(`इस अध्याय में अभी ${pool.length} Questions हैं। कम से कम ${QUESTIONS_PER_CHAPTER} चाहिए।`);
      }
      questions = sample(pool, QUESTIONS_PER_CHAPTER);

      currentTestMeta = {
        title: `Chapter Test Class ${classLevel} Chapter ${chapter} ${getIndiaDateKey()}`,
        testType: 'chapter_practice', classLevel, chapterFrom: chapter, chapterTo: chapter,
        dateKey: getIndiaDateKey(), durationMinutes: 10
      };
      currentLockedTestId = await getOrCreateTest();
      await ensureTestIsUnlocked(currentLockedTestId);
      questions = await prepareStableQuestionSet(currentLockedTestId, pool, questions, QUESTIONS_PER_CHAPTER);

      $('chapterSetup').style.display = 'none';
      if ($('chapterTestTitle')) $('chapterTestTitle').textContent = `कक्षा ${classLevel} • अध्याय ${chapter} • 10 Questions`;
      beginTest('chapterTest');
    } catch (e) {
      message.innerHTML = `<div class="error-box">${esc(e.message)}</div>`;
    }
  };
}

// TEST 3 — 5 random questions from the dedicated Daily Test question bank.
function setupDailyTest() {
  if (!$('dailyStartBtn')) return;

  $('dailyStartBtn').onclick = async () => {
    const message = $('dailyMessage');
    const classLevel = getClassLevel();
    const dateKey = getIndiaDateKey();
    const draftKey = `ganit_setu_daily_draft_${getStudentCode()}_${classLevel}_${dateKey}`;

    try {
      const all = await loadQuestions(classLevel);
      if (all.length < DAILY_QUESTION_COUNT) {
        throw new Error(`Daily Test के लिए कम से कम ${DAILY_QUESTION_COUNT} Questions उपलब्ध होने चाहिए।`);
      }

      currentTestMeta = {
        title: `Daily Test Class ${classLevel} ${dateKey}`,
        testType: 'daily', classLevel, chapterFrom: 1, chapterTo: MAX_CHAPTERS[classLevel],
        dateKey, durationMinutes: 10
      };

      let draftIds = [];
      try { draftIds = JSON.parse(localStorage.getItem(draftKey) || '[]').map(String); } catch (_) {}
      questions = draftIds.length === DAILY_QUESTION_COUNT
        ? all.filter(q => draftIds.includes(String(q.id)))
        : [];
      if (questions.length !== DAILY_QUESTION_COUNT) questions = await selectDailyQuestions(classLevel, all);

      currentLockedTestId = await getOrCreateTest();
      await ensureTestIsUnlocked(currentLockedTestId);

      const saved = await loadSavedQuestionSet(currentLockedTestId, all);
      if (saved.length >= DAILY_QUESTION_COUNT) questions = saved.slice(0, DAILY_QUESTION_COUNT);
      else await syncTestQuestionSet(currentLockedTestId, questions);

      localStorage.setItem(draftKey, JSON.stringify(questions.map(q => q.id)));
      $('dailySetup').style.display = 'none';
      if ($('dailyTitle')) $('dailyTitle').textContent = `आज का Daily Test • कक्षा ${classLevel} • ${DAILY_QUESTION_COUNT} Questions`;
      beginTest('dailyTest');
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
