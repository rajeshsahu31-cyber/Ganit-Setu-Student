// GANIT SETU STUDENT TEST SYSTEM
// Clean replacement: Questions + Supabase save connection

const $ = id => document.getElementById(id);
const MAX_CHAPTERS = { 9: 12, 10: 14 };

function getClassLevel() {
  const n = Number(sessionStorage.getItem('ganit_setu_student_class'));
  return MAX_CHAPTERS[n] ? n : 10;
}

function getStudentCode() {
  return sessionStorage.getItem('ganit_setu_student_id') || '';
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

let questions = [];
let currentIndex = 0;
let answers = [];
let startedAt = 0;
let timerHandle = null;
let currentTestMeta = null;

async function loadQuestions(classLevel, chapterNumber = null) {
  let query = supabaseClient
    .from('questions')
    .select('id,class_level,chapter_number,chapter_name,question_text,option_a,option_b,option_c,option_d,correct_option')
    .eq('class_level', classLevel)
    .eq('status', 'active')
    .order('id', { ascending: true });

  if (chapterNumber !== null) {
    query = query.eq('chapter_number', chapterNumber);
  }

  const { data, error } = await query;
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
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    timer.textContent = `⏱️ ${mm}:${ss}`;
  }, 1000);
}

function renderQuestion() {
  const q = questions[currentIndex];
  if (!q) return;

  $('questionNo').textContent =
    `प्रश्न ${currentIndex + 1} / ${questions.length}`;

  $('questionText').innerHTML =
    `<div class="chapter-label">अध्याय ${esc(q.chapter_number)}${q.chapter_name ? ' : ' + esc(q.chapter_name) : ''}</div>` +
    `<div>${esc(q.question_text)}</div>`;

  const optionData = [
    ['A', q.option_a],
    ['B', q.option_b],
    ['C', q.option_c],
    ['D', q.option_d]
  ];

  $('options').innerHTML = optionData.map(([key, value]) =>
    `<button type="button" class="option-btn ${answers[currentIndex] === key ? 'selected' : ''}" data-option="${key}">
      <b>${key}.</b> ${esc(value)}
    </button>`
  ).join('');

  $('options').querySelectorAll('button').forEach(button => {
    button.onclick = () => {
      answers[currentIndex] = button.dataset.option;
      $('options').querySelectorAll('button')
        .forEach(x => x.classList.remove('selected'));
      button.classList.add('selected');
    };
  });

  $('nextQuestion').textContent =
    currentIndex === questions.length - 1
      ? 'टेस्ट Submit करें'
      : 'अगला प्रश्न →';
}

async function createTestAndQuestions() {
  const meta = currentTestMeta;

  const { data: testId, error } = await supabaseClient.rpc(
    'get_or_create_ganit_test',
    {
      p_title: meta.title,
      p_test_type: meta.testType,
      p_class_level: meta.classLevel,
      p_chapter_from: meta.chapterFrom,
      p_chapter_to: meta.chapterTo,
      p_question_count: questions.length,
      p_duration_minutes: meta.durationMinutes || 10
    }
  );

  if (error) throw error;

  // test_questions को सीधे browser से नहीं लिखेंगे।
  // RLS bypass करने के लिए सुरक्षित Supabase RPC का उपयोग होगा।
  const questionIds = questions.map(q => Number(q.id));

  const { error: linkError } = await supabaseClient.rpc(
    'sync_ganit_test_questions',
    {
      p_test_id: testId,
      p_question_ids: questionIds
    }
  );

  if (linkError) throw linkError;

  return testId;
}

async function saveAttempt() {
  const studentCode = getStudentCode();

  if (!studentCode) {
    throw new Error('Student login information नहीं मिली।');
  }

  const testId = await createTestAndQuestions();

  const answerPayload = questions.map((q, index) => ({
    question_id: q.id,
    selected_option: answers[index] || null
  }));

  const timeTakenSeconds = Math.floor((Date.now() - startedAt) / 1000);

  const { data, error } = await supabaseClient.rpc(
    'save_ganit_test_attempt',
    {
      p_student_code: studentCode,
      p_test_id: testId,
      p_answers: answerPayload,
      p_time_taken_seconds: timeTakenSeconds
    }
  );

  if (error) throw error;
  return data;
}

async function submitTest(testBoxId, messageBoxId) {
  clearInterval(timerHandle);

  const nextButton = $('nextQuestion');
  if (nextButton) {
    nextButton.disabled = true;
    nextButton.textContent = 'Save हो रहा है...';
  }

  try {
    const result = await saveAttempt();

    $(testBoxId).style.display = 'none';

    const box = $(messageBoxId);
    box.innerHTML =
      `<div class="success-box">
        <b>✓ टेस्ट सफलतापूर्वक Submit हो गया</b><br><br>
        सही उत्तर: <b>${result.correct}/${result.total}</b><br>
        गलत उत्तर: <b>${result.wrong}</b><br>
        बिना उत्तर: <b>${result.unattempted}</b><br>
        प्रतिशत: <b>${result.percentage}%</b><br><br>
        <small>✓ Result Supabase में save हो गया है।</small>
      </div>`;

  } catch (error) {
    console.error('Test save error:', error);

    const box = $(messageBoxId);
    box.innerHTML =
      `<div class="error-box">
        टेस्ट का Result save नहीं हुआ: ${esc(error.message || 'Unknown error')}
      </div>`;

    $(testBoxId).style.display = 'none';
  } finally {
    if (nextButton) {
      nextButton.disabled = false;
      nextButton.textContent = 'टेस्ट Submit करें';
    }
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
      return;
    }

    submitTest(testBoxId, messageBoxId);
  };
}

function setupCourseTest() {
  if (!$('chapterTo')) return;

  const classLevel = getClassLevel();
  const select = $('chapterTo');

  select.innerHTML = '<option value="">अध्याय चुनें</option>';

  for (let chapter = 1; chapter <= MAX_CHAPTERS[classLevel]; chapter++) {
    select.innerHTML +=
      `<option value="${chapter}">अध्याय ${chapter}</option>`;
  }

  if ($('studentClassInfo')) {
    $('studentClassInfo').textContent =
      `कक्षा ${classLevel} • कुल ${MAX_CHAPTERS[classLevel]} अध्याय`;
  }

  $('startCourseBtn').onclick = async () => {
    const chapterTo = Number(select.value);
    const message = $('courseMessage');

    if (!chapterTo) {
      message.innerHTML =
        '<div class="error-box">कृपया अध्याय चुनें।</div>';
      return;
    }

    try {
      const all = await loadQuestions(classLevel);

      questions = [];

      for (let chapter = 1; chapter <= chapterTo; chapter++) {
        questions.push(
          ...all.filter(q => Number(q.chapter_number) === chapter).slice(0, 10)
        );
      }

      if (!questions.length) {
        throw new Error('चुने गए अध्यायों में Questions उपलब्ध नहीं हैं।');
      }

      currentTestMeta = {
        title: `Course Test Class ${classLevel} Chapter 1-${chapterTo}`,
        testType: 'course_progress',
        classLevel,
        chapterFrom: 1,
        chapterTo,
        durationMinutes: 10
      };

      $('courseSetup').style.display = 'none';
      $('courseTest').style.display = 'block';

      $('testClass').textContent =
        `कक्षा ${classLevel} • अध्याय 1 से ${chapterTo}`;

      $('questionCount').textContent =
        `कुल ${questions.length} प्रश्न`;

      beginTest('courseTest', 'courseMessage');

    } catch (error) {
      message.innerHTML =
        `<div class="error-box">${esc(error.message)}</div>`;
    }
  };
}

function setupChapterTest() {
  if (!$('chapterSelect')) return;

  const classLevel = getClassLevel();
  const select = $('chapterSelect');

  select.innerHTML = '<option value="">अध्याय चुनें</option>';

  for (let chapter = 1; chapter <= MAX_CHAPTERS[classLevel]; chapter++) {
    select.innerHTML +=
      `<option value="${chapter}">अध्याय ${chapter}</option>`;
  }

  $('chapterClassInfo').textContent =
    `कक्षा ${classLevel} • एक अध्याय • 10 Questions`;

  $('startChapterBtn').onclick = async () => {
    const chapter = Number(select.value);
    const message = $('chapterMessage');

    if (!chapter) {
      message.innerHTML =
        '<div class="error-box">कृपया अध्याय चुनें।</div>';
      return;
    }

    try {
      questions = (await loadQuestions(classLevel, chapter)).slice(0, 10);

      if (questions.length < 10) {
        throw new Error(
          `इस अध्याय में ${questions.length} Questions हैं। 10 Questions उपलब्ध होने चाहिए।`
        );
      }

      currentTestMeta = {
        title: `Chapter Test Class ${classLevel} Chapter ${chapter}`,
        testType: 'chapter_practice',
        classLevel,
        chapterFrom: chapter,
        chapterTo: chapter,
        durationMinutes: 10
      };

      $('chapterSetup').style.display = 'none';

      $('chapterTestTitle').textContent =
        `कक्षा ${classLevel} • अध्याय ${chapter} • 10 Questions`;

      beginTest('chapterTest', 'chapterMessage');

    } catch (error) {
      message.innerHTML =
        `<div class="error-box">${esc(error.message)}</div>`;
    }
  };
}

function setupDailyTest() {
  if (!$('dailyStartBtn')) return;

  $('dailyStartBtn').onclick = async () => {
    const message = $('dailyMessage');
    const classLevel = getClassLevel();

    try {
      const all = await loadQuestions(classLevel);

      if (all.length < 2) {
        throw new Error('Daily Test के लिए कम से कम 2 Questions चाहिए।');
      }

      // अभी केवल connection testing के लिए 2 Questions.
      questions = all.slice(0, 2);

      currentTestMeta = {
        title: `Daily Test Class ${classLevel}`,
        testType: 'daily',
        classLevel,
        chapterFrom: 1,
        chapterTo: 1,
        durationMinutes: 10
      };

      $('dailySetup').style.display = 'none';

      $('dailyTitle').textContent =
        `आज का Daily Test • कक्षा ${classLevel} • 2 Questions`;

      beginTest('dailyTest', 'dailyMessage');

    } catch (error) {
      message.innerHTML =
        `<div class="error-box">${esc(error.message)}</div>`;
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  setupCourseTest();
  setupChapterTest();
  setupDailyTest();
});
