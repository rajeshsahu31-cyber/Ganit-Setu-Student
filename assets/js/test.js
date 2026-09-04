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

  // Browser lock is only a fast local guard. The database check below is
  // authoritative, so changing chapter selection cannot bypass Test 1.
  const localKey = getBrowserLockKey();
  if (localStorage.getItem(localKey) === 'submitted') {
    throw new Error('🔒 आपने आज का यह टेस्ट पहले ही दे दिया है। अगला टेस्ट कल 12:00 बजे के बाद खुलेगा।');
  }

  const studentUuid = await getStudentUuidForAttempt();

  // IMPORTANT: Test 1 is one attempt per student per DATE, regardless of the
  // selected chapter range. Do NOT use test_id/chapter_to as the lock key.
  // We first fetch this student's submitted attempts, then fetch their test
  // definitions separately. This avoids relying on a fragile nested relation
  // filter such as tests.test_type.
  const { data: attempts, error: attemptError } = await supabaseClient
    .from('test_attempts')
    .select('id,test_id,status,submitted_at')
    .eq('student_id', studentUuid)
    .eq('status', 'submitted');

  if (attemptError) {
    throw new Error('Test lock की जाँच नहीं हो सकी: ' + attemptError.message);
  }

  if (!attempts?.length) return true;

  const testIds = [...new Set(attempts.map(a => Number(a.test_id)).filter(Boolean))];
  if (!testIds.length) return true;

  const { data: tests, error: testError } = await supabaseClient
    .from('tests')
    .select('id,test_type,class_level,title,chapter_from,chapter_to')
    .in('id', testIds);

  if (testError) {
    throw new Error('Test की जानकारी नहीं मिल सकी: ' + testError.message);
  }

  const testMap = new Map((tests || []).map(t => [Number(t.id), t]));
  const today = m.dateKey || getIndiaDateKey();

  const submittedToday = attempts.some(a => {
    const t = testMap.get(Number(a.test_id));
    if (!t) return false;

    // Only the same class + same test type can lock this test.
    if (String(t.test_type || '').toLowerCase() !== String(m.testType || '').toLowerCase()) return false;
    if (Number(t.class_level) !== Number(m.classLevel)) return false;

    // Prefer the actual submitted_at timestamp. This makes the lock truly
    // date-based and does not depend on the test title.
    if (a.submitted_at) {
      return getIndiaDateKey(new Date(a.submitted_at)) === today;
    }

    // Backward-compatible fallback for older records that may not have
    // submitted_at populated: the generated test title contains YYYY-MM-DD.
    return String(t.title || '').includes(today);
  });

  if (submittedToday) {
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
  // Primary history source: test_questions linked to previous Daily tests.
  // If RLS/schema prevents direct reading, the browser history below still
  // prevents repeats on the same device; DB history remains authoritative when available.
  const used = new Set();

  try {
    const { data: dailyTests, error: testsError } = await supabaseClient
      .from('tests')
      .select('id,title')
      .eq('test_type', 'daily')
      .eq('class_level', classLevel)
      .order('id', { ascending: true });

    if (!testsError && dailyTests?.length) {
      const ids = dailyTests.map(t => Number(t.id)).filter(Number.isFinite);
      if (ids.length) {
        const { data: mappings, error: mapError } = await supabaseClient
          .from('test_questions')
          .select('test_id,question_id')
          .in('test_id', ids);
        if (!mapError) {
          (mappings || []).forEach(row => {
            if (row.question_id != null) used.add(String(row.question_id));
          });
        }
      }
    }
  } catch (e) {
    console.warn('Daily DB question history उपलब्ध नहीं हुई:', e);
  }

  // Supplemental per-student browser history.
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

async function selectDailyQuestions(classLevel, allQuestions) {
  if (allQuestions.length < DAILY_QUESTION_COUNT) {
    throw new Error(`Daily Test के लिए कम से कम ${DAILY_QUESTION_COUNT} Questions उपलब्ध होने चाहिए।`);
  }

  const used = await getPreviousDailyQuestionIds(classLevel);
  let fresh = allQuestions.filter(q => !used.has(String(q.id)));

  // If fewer than five unseen questions remain, finish the current cycle with
  // unseen questions first, then begin a new shuffled cycle from the full pool.
  if (fresh.length >= DAILY_QUESTION_COUNT) {
    return sample(fresh, DAILY_QUESTION_COUNT);
  }

  const selected = sample(fresh, fresh.length);
  const selectedIds = new Set(selected.map(q => String(q.id)));
  const remainder = allQuestions.filter(q => !selectedIds.has(String(q.id)));
  const needed = DAILY_QUESTION_COUNT - selected.length;
  let candidate = [...selected, ...sample(remainder, needed)];

  // New cycle: reset only after the old pool is exhausted. Avoid returning the
  // exact previous 5-question set in the same order when a new cycle starts.
  const lastKey = `ganit_setu_daily_last_set_${getStudentCode()}_${classLevel}`;
  let last = [];
  try { last = JSON.parse(localStorage.getItem(lastKey) || '[]').map(String); } catch (_) {}
  const sameSet = a => Array.isArray(last) && last.length === DAILY_QUESTION_COUNT &&
    a.length === DAILY_QUESTION_COUNT && a.every(id => last.includes(String(id)));
  if (sameSet(candidate.map(q => q.id))) {
    candidate = sample(allQuestions, DAILY_QUESTION_COUNT);
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
      // Check today's Course Test lock BEFORE touching the saved question set.
      // This keeps a submitted day's questions fixed for review and prevents
      // a second chapter-range selection from bypassing the daily lock.
      await ensureTestIsUnlocked(currentLockedTestId);

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
      await syncTestQuestionSet(currentLockedTestId);
      await ensureTestIsUnlocked(currentLockedTestId);

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

    try {
      const all = await loadQuestions(classLevel);
      questions = await selectDailyQuestions(classLevel, all);

      currentTestMeta = {
        title: `Daily Test Class ${classLevel} ${getIndiaDateKey()}`,
        testType: 'daily', classLevel, chapterFrom: 1, chapterTo: MAX_CHAPTERS[classLevel],
        dateKey: getIndiaDateKey(), durationMinutes: 10
      };
      currentLockedTestId = await getOrCreateTest();

      // A dated test already has its own question set. If it exists, the
      // database mapping is the authoritative set for that date.
      const { data: mapped, error: mappedError } = await supabaseClient
        .from('test_questions')
        .select('question_id')
        .eq('test_id', currentLockedTestId);

      if (!mappedError && mapped?.length >= DAILY_QUESTION_COUNT) {
        const ids = new Set(mapped.map(x => String(x.question_id)));
        questions = all.filter(q => ids.has(String(q.id))).slice(0, DAILY_QUESTION_COUNT);
      } else {
        await syncTestQuestionSet(currentLockedTestId);
      }

      await ensureTestIsUnlocked(currentLockedTestId);
      if (questions.length !== DAILY_QUESTION_COUNT) throw new Error('Daily Test में 5 प्रश्न तैयार नहीं हो सके।');

      $('dailySetup').style.display = 'none';
      if ($('dailyTitle')) $('dailyTitle').textContent = `आज का Daily Test • कक्षा ${classLevel} • ${DAILY_QUESTION_COUNT} Questions`;
      beginTest('dailyTest');
    } catch (e) {
      message.innerHTML = `<div class="error-box">${esc(e.message)}</div>`;
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  setupCourseTest();
  setupChapterTest();
  setupDailyTest();
});
