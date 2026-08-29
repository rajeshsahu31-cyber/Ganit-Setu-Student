function selectOption(btn){document.querySelectorAll('.options button').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');}
let sec=0;
if(document.getElementById('timer')){
 setInterval(()=>{sec++;let m=String(Math.floor(sec/60)).padStart(2,'0');let s=String(sec%60).padStart(2,'0');document.getElementById('timer').textContent='⏱️ '+m+':'+s;},1000);
}
function submitDailyAnswer(){
 const a=document.getElementById('finalAnswer').value.trim();
 document.getElementById('dailyMessage').innerHTML=a?'<div class="success-box">✓ आपका उत्तर जमा हो गया। प्रश्न हल करने का समय रिकॉर्ड कर लिया गया है।</div>':'कृपया अपना उत्तर लिखें।';
}

/* ===== Course Progress Test - Supabase ===== */
(function(){
  if(!location.pathname.endsWith('course-test.html')) return;
  const sid=sessionStorage.getItem('ganit_setu_student_id');
  const setup=document.getElementById('courseSetup'), testBox=document.getElementById('courseTest');
  const msg=document.getElementById('courseMessage');
  let student=null, questions=[], answers={}, index=0, startedAt=0, timerHandle=null, activeTestId=null;
  const $=id=>document.getElementById(id);
  function showMessage(t){msg.innerHTML='<div class="muted">'+t+'</div>';}
  async function init(){
    if(!sid){ location.href='index.html'; return; }
    const {data,error}=await supabaseClient.from('students').select('id,class_level,full_name').eq('student_id',sid).single();
    if(error||!data){showMessage('विद्यार्थी की जानकारी नहीं मिली। कृपया दोबारा Login करें।');return;}
    student=data; $('studentClassInfo').textContent='कक्षा '+student.class_level+' • '+student.full_name;
    const {data:chapters,error:qe}=await supabaseClient.from('questions').select('chapter_number').eq('class_level',student.class_level).eq('status','active').order('chapter_number');
    if(qe){showMessage('Questions लोड नहीं हुए: '+qe.message);return;}
    [...new Set((chapters||[]).map(x=>x.chapter_number))].forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent='अध्याय 1 से '+n+' तक';$('chapterTo').appendChild(o);});
    $('startCourseBtn').onclick=start;
    $('exitTest').onclick=()=>location.href='test-types.html';
    $('nextQuestion').onclick=next;
  }
  async function start(){
    const to=Number($('chapterTo').value); if(!to){alert('कृपया अध्याय चुनें।');return;}
    const btn=$('startCourseBtn');btn.disabled=true;btn.textContent='टेस्ट तैयार हो रहा है...';
    const {data,error}=await supabaseClient.rpc('start_course_progress_test',{p_student_code:sid,p_chapter_to:to});
    btn.disabled=false;btn.textContent='टेस्ट शुरू करें';
    if(error){showMessage('टेस्ट शुरू नहीं हुआ: '+error.message);return;}
    const result=Array.isArray(data)?data[0]:data;
    if(!result){showMessage('टेस्ट तैयार नहीं हुआ।');return;}
    activeTestId=result.test_id; questions=result.questions||[];
    if(!questions.length){showMessage('इस range के लिए पर्याप्त Questions नहीं हैं।');return;}
    setup.style.display='none';testBox.style.display='block';startedAt=Date.now();
    $('testClass').textContent='कक्षा '+student.class_level;$('questionCount').textContent='प्रश्न 1/'+questions.length;
    timerHandle=setInterval(()=>{let s=Math.floor((Date.now()-startedAt)/1000);$('timer').textContent='⏱️ '+String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');},1000);
    render();
  }
  function render(){
    const q=questions[index];$('questionNo').textContent='प्रश्न '+(index+1);$('questionCount').textContent='प्रश्न '+(index+1)+'/'+questions.length;$('questionText').textContent=q.question_text;
    const box=$('options');box.innerHTML='';['A','B','C','D'].forEach(k=>{const b=document.createElement('button');b.textContent=q['option_'+k.toLowerCase()];if(answers[q.id]===k)b.classList.add('selected');b.onclick=()=>{answers[q.id]=k;[...box.children].forEach(x=>x.classList.remove('selected'));b.classList.add('selected');};box.appendChild(b);});
    $('nextQuestion').textContent=index===questions.length-1?'टेस्ट जमा करें':'अगला प्रश्न →';
  }
  async function next(){
    if(index<questions.length-1){index++;render();return;}
    if(!confirm('क्या आप टेस्ट जमा करना चाहते हैं?'))return;
    $('nextQuestion').disabled=true;
    const payload=questions.map(q=>({question_id:q.id,selected_option:answers[q.id]||null}));
    const seconds=Math.floor((Date.now()-startedAt)/1000);
    const {data,error}=await supabaseClient.rpc('submit_course_progress_test',{p_student_code:sid,p_test_id:activeTestId,p_answers:payload,p_time_taken_seconds:seconds});
    if(error){$('nextQuestion').disabled=false;showMessage('Result save नहीं हुआ: '+error.message);return;}
    clearInterval(timerHandle); const r=Array.isArray(data)?data[0]:data;
    sessionStorage.setItem('ganit_setu_last_result',JSON.stringify(r||{}));location.href='results.html';
  }
  init();
})();
