function demoLogin(){
 const id=document.getElementById('studentId').value.trim();
 const pass=document.getElementById('password').value.trim();
 if(!id || pass.length!==6){alert('कृपया विद्यार्थी आईडी और 6 अंकों का पासवर्ड दर्ज करें।');return;}
 location.href='home.html';
}

function onlyDigits(value){ return String(value || '').replace(/\D/g,''); }

function setRegistrationMessage(type, message){
 const box=document.getElementById('registrationResult');
 if(!box) return;
 const cls=type==='success'?'success-box':(type==='info'?'info-box':'error-box');
 box.innerHTML='<div class="'+cls+'">'+message+'</div>';
}

function escapeHtml(value){
 return String(value==null?'':value)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  .replace(/'/g,'&#039;');
}

async function supabaseInsertStudent(studentData){
 const cfg=window.getGanitSetuSupabase && window.getGanitSetuSupabase();
 if(!cfg || !cfg.ok) throw new Error((cfg && cfg.error) || 'Supabase configuration उपलब्ध नहीं है।');

 const endpoint=cfg.url+'/rest/v1/'+encodeURIComponent(cfg.table);
 const response=await fetch(endpoint,{
   method:'POST',
   headers:{
     'apikey':cfg.anonKey,
     'Authorization':'Bearer '+cfg.anonKey,
     'Content-Type':'application/json',
     'Prefer':'return=representation'
   },
   body:JSON.stringify(studentData)
 });

 const raw=await response.text();
 let data=null;
 try{ data=raw ? JSON.parse(raw) : null; }catch(_){}

 if(!response.ok){
   const err=new Error((data && (data.message || data.details || data.hint)) || raw || ('HTTP '+response.status));
   err.code=data && data.code;
   throw err;
 }
 return data;
}

async function showRegistration(e){
 e.preventDefault();

 const form=document.getElementById('registrationForm');
 const button=form.querySelector('button[type="submit"]');
 const dise=onlyDigits(form.school_dise_code.value);
 const mobile=onlyDigits(form.mobile.value);

 if(dise.length!==11){
   alert('कृपया 11 अंकों का सही UDISE / DISE Code दर्ज करें।');
   form.school_dise_code.focus();
   return;
 }
 if(mobile.length!==10){
   alert('कृपया 10 अंकों का सही मोबाइल नंबर दर्ज करें।');
   form.mobile.focus();
   return;
 }

 // student_id नहीं भेजा जा रहा है: Supabase trigger इसे GS-00001 format में अपने आप बनाएगा.
 const studentData={
   full_name:form.full_name.value.trim(),
   class_level:String(form.class_level.value),
   school_name:form.school_name.value.trim(),
   village_city:form.village_city.value.trim(),
   block:form.block.value.trim(),
   district:form.district.value.trim(),
   state:form.state.value.trim(),
   mobile:mobile
 };

 button.disabled=true;
 const oldText=button.textContent;
 button.textContent='Supabase में सेव हो रहा है...';
 setRegistrationMessage('info','<b>⏳ कृपया प्रतीक्षा करें...</b><br>विद्यार्थी की जानकारी वास्तविक Supabase <b>students</b> table में भेजी जा रही है।');

 try{
   const saved=await supabaseInsertStudent(studentData);
   const row=Array.isArray(saved) ? saved[0] : saved;
   const studentId=row && row.student_id ? '<br>विद्यार्थी ID: <b>'+escapeHtml(row.student_id)+'</b>' : '';

   setRegistrationMessage(
     'success',
     '<b>✓ रजिस्ट्रेशन सफलतापूर्वक Supabase में सेव हो गया है</b><br><br>'+
     'विद्यालय UDISE Code: <b>'+escapeHtml(dise)+'</b>'+studentId+
     '<br><small>मुख्य विद्यार्थी जानकारी वास्तविक <b>students</b> table में insert हो गई है।</small>'
   );

   localStorage.setItem('ganitSetuLastRegistration',JSON.stringify(row || studentData));
   form.reset();
   form.state.value='मध्य प्रदेश';
 }catch(err){
   console.error('Supabase registration error:',err);
   const rawMessage=String(err && err.message || 'Unknown error');
   setRegistrationMessage(
     'error',
     '<b>✕ Supabase में डेटा सेव नहीं हुआ</b><br><br>'+
     '<small><b>असल Error:</b> '+escapeHtml(rawMessage)+'</small>'
   );
 }finally{
   button.disabled=false;
   button.textContent=oldText;
 }
}
