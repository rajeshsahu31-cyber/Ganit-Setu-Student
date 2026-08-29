const $=id=>document.getElementById(id);
const MAX={9:12,10:14};
const cls=()=>{const n=Number(sessionStorage.getItem("ganit_setu_student_class"));return MAX[n]?n:10};
let qs=[],i=0,ans=[],started=0,tick;

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

async function loadQ(c,chapter=null){
  if(typeof supabaseClient==="undefined")throw Error("Supabase connection नहीं मिली");
  let q=supabaseClient.from("questions").select("id,class_level,chapter_number,chapter_name,question_text,option_a,option_b,option_c,option_d,correct_option,explanation").eq("class_level",c).eq("status","active").order("id");
  if(chapter!==null)q=q.eq("chapter_number",chapter);
  const {data,error}=await q;if(error)throw error;return data||[];
}

function timer(){
  const t=$("timer");if(!t)return;
  clearInterval(tick);started=Date.now();
  tick=setInterval(()=>{let s=Math.floor((Date.now()-started)/1000);t.textContent=`⏱️ ${String(s/60|0).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`},1000);
}

function draw(){
  const q=qs[i];if(!q)return;
  $("questionNo").textContent=`प्रश्न ${i+1} / ${qs.length}`;
  $("questionText").innerHTML=`<div class="chapter-label">अध्याय ${esc(q.chapter_number)}${q.chapter_name?" : "+esc(q.chapter_name):""}</div><div>${esc(q.question_text)}</div>`;
  $("options").innerHTML=[["A",q.option_a],["B",q.option_b],["C",q.option_c],["D",q.option_d]].map(([k,v])=>`<button type="button" class="option-btn ${ans[i]===k?"selected":""}" data-k="${k}"><b>${k}.</b> ${esc(v)}</button>`).join("");
  $("options").querySelectorAll("button").forEach(b=>b.onclick=()=>{ans[i]=b.dataset.k;$("options").querySelectorAll("button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected")});
  $("nextQuestion").textContent=i===qs.length-1?"टेस्ट Submit करें":"अगला प्रश्न →";
}

function result(box){
  clearInterval(tick);let ok=qs.filter((q,n)=>(ans[n]||"").toUpperCase()===String(q.correct_option||"").trim().toUpperCase()).length;
  const el=$(box);if(el)el.innerHTML=`<div class="success-box"><b>✓ टेस्ट पूरा हुआ</b><br><br>सही उत्तर: <b>${ok}/${qs.length}</b><br>गलत उत्तर: <b>${qs.length-ok}</b><br>प्रतिशत: <b>${(ok*100/qs.length).toFixed(2)}%</b></div>`;
}

function run(testBox,messageBox){
  $(testBox).style.display="block";i=0;ans=[];draw();timer();
  $("nextQuestion").onclick=()=>{if(!ans[i])return alert("कृपया एक विकल्प चुनें।");if(i<qs.length-1){i++;draw()}else{$(testBox).style.display="none";result(messageBox)}};
}

function setupCourse(){
  if(!$("chapterTo"))return;
  const c=cls(),s=$("chapterTo");s.innerHTML='<option value="">अध्याय चुनें</option>';
  for(let n=1;n<=MAX[c];n++)s.innerHTML+=`<option value="${n}">अध्याय ${n}</option>`;
  $("studentClassInfo").textContent=`कक्षा ${c} • कुल ${MAX[c]} अध्याय`;
  $("startCourseBtn").onclick=async()=>{
    const to=Number(s.value),m=$("courseMessage");if(!to){m.innerHTML='<div class="error-box">कृपया अध्याय चुनें।</div>';return}
    try{
      const all=await loadQ(c);qs=[];
      for(let n=1;n<=to;n++)qs.push(...all.filter(x=>Number(x.chapter_number)===n).slice(0,10));
      if(!qs.length)throw Error("चुने गए अध्यायों में Questions उपलब्ध नहीं हैं।");
      $("courseSetup").style.display="none";$("courseTest").style.display="block";
      $("testClass").textContent=`कक्षा ${c} • अध्याय 1 से ${to}`;$("questionCount").textContent=`कुल ${qs.length} प्रश्न`;
      i=0;ans=[];draw();timer();
      $("nextQuestion").onclick=()=>{if(!ans[i])return alert("कृपया एक विकल्प चुनें।");if(i<qs.length-1){i++;draw()}else{$("courseTest").style.display="none";result("courseMessage")}};
    }catch(e){m.innerHTML=`<div class="error-box">${esc(e.message)}</div>`}
  };
}

function setupChapter(){
  if(!$("chapterSelect"))return;
  const c=cls(),s=$("chapterSelect");s.innerHTML='<option value="">अध्याय चुनें</option>';
  for(let n=1;n<=MAX[c];n++)s.innerHTML+=`<option value="${n}">अध्याय ${n}</option>`;
  $("chapterClassInfo").textContent=`कक्षा ${c} • एक अध्याय • 10 Questions`;
  $("startChapterBtn").onclick=async()=>{
    const ch=Number(s.value),m=$("chapterMessage");if(!ch){m.innerHTML='<div class="error-box">कृपया अध्याय चुनें।</div>';return}
    try{
      qs=(await loadQ(c,ch)).slice(0,10);
      if(qs.length<10)throw Error(`इस अध्याय में अभी ${qs.length} Questions हैं। 10 Questions उपलब्ध होने चाहिए।`);
      $("chapterSetup").style.display="none";$("chapterTest").style.display="block";
      $("chapterTestTitle").textContent=`कक्षा ${c} • अध्याय ${ch} • 10 Questions`;run("chapterTest","chapterMessage");
    }catch(e){m.innerHTML=`<div class="error-box">${esc(e.message)}</div>`}
  };
}

function setupDaily(){
  if(!$("dailyStartBtn"))return;
  $("dailyStartBtn").onclick=async()=>{
    const m=$("dailyMessage");
    try{
      const all=await loadQ(cls());if(all.length<2)throw Error("कम से कम 2 Questions उपलब्ध होने चाहिए।");
      const day=Math.floor(Date.now()/86400000);qs=[...all].sort((a,b)=>((a.id+day)%1009)-((b.id+day)%1009)).slice(0,2);
      $("dailySetup").style.display="none";$("dailyTest").style.display="block";
      $("dailyTitle").textContent=`आज का Daily Test • कक्षा ${cls()} • 2 Questions`;run("dailyTest","dailyMessage");
    }catch(e){m.innerHTML=`<div class="error-box">${esc(e.message)}</div>`}
  };
}

document.addEventListener("DOMContentLoaded",()=>{setupCourse();setupChapter();setupDaily()});
