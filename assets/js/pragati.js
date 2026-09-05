(function(){
  const sb = window.supabaseClient;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const chapterMax = cls => Number(cls)===9 ? 12 : 14;

  function showError(msg){ $('progressError').hidden=false; $('progressError').textContent=msg; }
  function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }

  async function load(){
    const code=sessionStorage.getItem('ganit_setu_student_id');
    if(!code){ showError('कृपया पहले Student Login करें।'); return; }

    const {data:student,error:studentError}=await sb.from('students').select('student_id,full_name,class_level').eq('student_id',code).maybeSingle();
    if(studentError || !student){ showError('विद्यार्थी की जानकारी लोड नहीं हो सकी।'); return; }
    const cls=num(student.class_level);
    if(cls!==9 && cls!==10){ showError('इस कक्षा के लिए प्रगति उपलब्ध नहीं है।'); return; }
    $('classLabel').textContent=`कक्षा ${cls}वीं`;

    const {data:rows,error}=await sb.rpc('get_ganit_student_results',{p_student_code:code});
    if(error){ console.error(error); showError('प्रगति डेटा लोड नहीं हो सका: '+error.message); return; }
    const all=(rows||[]).filter(r=>num(r.class_level)===cls).sort((a,b)=>new Date(a.submitted_at)-new Date(b.submitted_at));

    renderSummary(all);
    renderChapters(all,cls);
    renderDonut(all);
    renderTrend(all);
  }

  function renderSummary(rows){
    $('totalTests').textContent=rows.length || '0';
    if(!rows.length){ $('avgScore').textContent='—'; $('bestScore').textContent='—'; return; }
    const percentages=rows.map(r=>num(r.percentage));
    const avg=percentages.reduce((a,b)=>a+b,0)/percentages.length;
    $('avgScore').textContent=avg.toFixed(1)+'%';
    $('bestScore').textContent=Math.max(...percentages).toFixed(1)+'%';
  }

  function renderChapters(rows,cls){
    const n=chapterMax(cls);
    const stats=Array.from({length:n},()=>({correct:0,total:0,attempts:0}));
    rows.forEach(r=>{
      const type=String(r.test_type||'');
      const chFrom=num(r.chapter_from), chTo=num(r.chapter_to);
      // Exact chapter performance is safely attributable for Chapter Tests.
      if(type==='chapter_practice' && chFrom>=1 && chFrom<=n){
        const total=num(r.total_marks || r.total_questions);
        const correct=num(r.correct_answers ?? r.score);
        stats[chFrom-1].total+=total; stats[chFrom-1].correct+=correct; stats[chFrom-1].attempts++;
      }
      // Daily test is intentionally not assigned across every chapter because it may cover a range.
    });
    $('chapterList').innerHTML=stats.map((s,i)=>{
      if(!s.attempts || !s.total) return `<div class="chapter-row not-attempted"><span class="chapter-name">अध्याय ${i+1}</span><div class="bar-track"></div><span class="chapter-percent">—</span></div>`;
      const p=Math.max(0,Math.min(100,(s.correct/s.total)*100));
      return `<div class="chapter-row"><span class="chapter-name">अध्याय ${i+1}</span><div class="bar-track"><div class="bar-fill" style="width:${p.toFixed(1)}%"></div></div><span class="chapter-percent">${p.toFixed(0)}%</span></div>`;
    }).join('');
  }

  function renderDonut(rows){
    let correct=0,total=0;
    rows.forEach(r=>{ correct+=num(r.correct_answers); total+=num(r.total_marks || r.total_questions); });
    const wrong=Math.max(0,total-correct);
    // Existing result RPC does not expose unattempted consistently; treat missing field as 0.
    const unanswered=Math.max(0,rows.reduce((a,r)=>a+num(r.unanswered_answers ?? r.unattempted ?? r.unanswered_questions),0));
    $('correctCount').textContent=correct; $('wrongCount').textContent=wrong; $('unansweredCount').textContent=unanswered;
    const sum=correct+wrong+unanswered;
    if(!sum){ $('donut').style.background='conic-gradient(#d7e7ec 0 360deg)'; $('donutCenter').textContent='—'; return; }
    const c=correct/sum*360, w=wrong/sum*360;
    $('donut').style.background=`conic-gradient(#16a34a 0deg ${c}deg,#ef4444 ${c}deg ${c+w}deg,#d7e7ec ${c+w}deg 360deg)`;
    $('donutCenter').textContent=Math.round(correct/sum*100)+'%';
  }

  function renderTrend(rows){
    if(!rows.length){ $('trend').innerHTML='<div class="loading">अभी पर्याप्त Result उपलब्ध नहीं है।</div>'; return; }
    const recent=rows.slice(-12);
    const max=Math.max(100,...recent.map(r=>num(r.percentage)));
    $('trend').innerHTML=recent.map(r=>{
      const p=Math.max(0,Math.min(100,num(r.percentage))); const h=(p/max)*100;
      const d=r.submitted_at?new Intl.DateTimeFormat('hi-IN',{day:'2-digit',month:'short'}).format(new Date(r.submitted_at)):'—';
      return `<div class="trend-item"><span class="trend-value">${p.toFixed(0)}%</span><div class="trend-bar-wrap"><div class="trend-bar" style="height:${h}%"></div></div><span class="trend-date">${esc(d)}</span></div>`;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded',load);
})();
