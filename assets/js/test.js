function selectOption(btn){
  document.querySelectorAll('.options button').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}

function submitDailyAnswer(){
  const a=document.getElementById('finalAnswer')?.value.trim();
  const box=document.getElementById('dailyMessage');
  if(box) box.innerHTML=a
    ?'<div class="success-box">✓ आपका उत्तर जमा हो गया।</div>'
    :'कृपया अपना उत्तर लिखें।';
}

/* ===== FINAL DYNAMIC COURSE/SYLLABUS TEST ===== */
(function(){
  if(!location.pathname.endsWith('course-test.html')) return;

  const sid=sessionStorage.getItem('ganit_setu_student_id');
  const setup=document.getElementById('courseSetup');
  const testBox=document.getElementById('courseTest');
  const msg=document.getElementById('courseMessage');
  const $=id=>document.getElementById(id);

  let student=null;
  let questions=[];
  let answers={};
  let index=0;
  let startedAt=0;
  let timerHandle=null;
  let activeTestId=null;

  function showMessage(text){
    msg.innerHTML='<div class="muted">'+text+'</div>';
  }

  async function init(){
    if(!sid){
      location.href='index.html';
      return;
    }

    const {data,error}=await supabaseClient
      .from('students')
      .select('id,class_level,full_name')
      .eq('student_id',sid)
      .single();

    if(error||!data){
      showMessage('विद्यार्थी की जानकारी नहीं मिली। कृपया दोबारा Login करें।');
      return;
    }

    student=data;
    const maxChapter=student.class_level===9 ? 12 : 14;

    $('studentClassInfo').textContent=
      'कक्षा '+student.class_level+' • '+student.full_name;

    for(let n=1;n<=maxChapter;n++){
      const o=document.createElement('option');
      o.value=n;
      o.textContent='अध्याय 1 से '+n+' तक ('+(n*10)+' प्रश्न)';
      $('chapterTo').appendChild(o);
    }

    $('startCourseBtn').onclick=startTest;
    $('exitTest').onclick=()=>location.href='test-types.html';
    $('nextQuestion').onclick=nextQuestion;
  }

  async function startTest(){
    const chapterTo=Number($('chapterTo').value);

    if(!chapterTo){
      alert('कृपया अध्याय चुनें।');
      return;
    }

    const expected=chapterTo*10;
    const btn=$('startCourseBtn');
    btn.disabled=true;
    btn.textContent='टेस्ट तैयार हो रहा है...';
    showMessage('');

    const {data,error}=await supabaseClient.rpc(
      'start_course_progress_test',
      {
        p_student_code:sid,
        p_chapter_to:chapterTo
      }
    );

    btn.disabled=false;
    btn.textContent='टेस्ट शुरू करें';

    if(error){
      showMessage('टेस्ट शुरू नहीं हुआ: '+error.message);
      return;
    }

    const result=Array.isArray(data)?data[0]:data;
    activeTestId=result?.test_id;
    questions=Array.isArray(result?.questions)?result.questions:[];

    if(!activeTestId || questions.length!==expected){
      showMessage(
        'पूरा टेस्ट तैयार नहीं हुआ। अपेक्षित '+expected+
        ' प्रश्न हैं, लेकिन '+questions.length+' मिले।'
      );
      return;
    }

    answers={};
    index=0;
    startedAt=Date.now();

    setup.style.display='none';
    testBox.style.display='block';

    $('testClass').textContent='कक्षा '+student.class_level;
    startTimer();
    renderQuestion();
  }

  function startTimer(){
    if(timerHandle) clearInterval(timerHandle);

    timerHandle=setInterval(()=>{
      const total=Math.floor((Date.now()-startedAt)/1000);
      const m=String(Math.floor(total/60)).padStart(2,'0');
      const s=String(total%60).padStart(2,'0');
      $('timer').textContent='⏱️ '+m+':'+s;
    },1000);
  }

  function renderQuestion(){
    const q=questions[index];

    $('questionNo').textContent=
      'अध्याय '+q.chapter_number+' • प्रश्न '+(index+1);

    $('questionCount').textContent=
      'प्रश्न '+(index+1)+'/'+questions.length;

    $('questionText').textContent=q.question_text;

    const box=$('options');
    box.innerHTML='';

    ['A','B','C','D'].forEach(letter=>{
      const b=document.createElement('button');
      b.type='button';
      b.textContent=q['option_'+letter.toLowerCase()];

      if(answers[q.id]===letter) b.classList.add('selected');

      b.onclick=()=>{
        answers[q.id]=letter;
        [...box.children].forEach(x=>x.classList.remove('selected'));
        b.classList.add('selected');
      };

      box.appendChild(b);
    });

    $('nextQuestion').textContent=
      index===questions.length-1 ? 'टेस्ट जमा करें' : 'अगला प्रश्न →';
  }

  async function nextQuestion(){
    if(index<questions.length-1){
      index++;
      renderQuestion();
      return;
    }

    if(!confirm('क्या आप अपना टेस्ट जमा करना चाहते हैं?')) return;

    const btn=$('nextQuestion');
    btn.disabled=true;
    btn.textContent='जमा हो रहा है...';

    const payload=questions.map(q=>({
      question_id:q.id,
      selected_option:answers[q.id]||null
    }));

    const seconds=Math.floor((Date.now()-startedAt)/1000);

    const {data,error}=await supabaseClient.rpc(
      'submit_course_progress_test',
      {
        p_student_code:sid,
        p_test_id:activeTestId,
        p_answers:payload,
        p_time_taken_seconds:seconds
      }
    );

    if(error){
      btn.disabled=false;
      btn.textContent='टेस्ट जमा करें';
      showMessage('Result save नहीं हुआ: '+error.message);
      return;
    }

    clearInterval(timerHandle);

    const result=Array.isArray(data)?data[0]:data;
    sessionStorage.setItem(
      'ganit_setu_last_result',
      JSON.stringify(result||{})
    );

    location.href='results.html';
  }

  init();
})();
