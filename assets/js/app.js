function getValue(id){
  return document.getElementById(id)?.value.trim() || '';
}

async function demoLogin(){
  const rawLogin=getValue('studentId').trim().toUpperCase();
  const pass=getValue('password').replace(/\D/g,'').slice(0,6);

  const isStudentId=/^GS-\d{5,}$/.test(rawLogin);
  const isMobile=/^[6-9]\d{9}$/.test(rawLogin);

  if(!isStudentId && !isMobile){
    alert('कृपया सही Student ID (GS-00001) या 10 अंकों का Mobile Number दर्ज करें।');
    return;
  }

  if(!/^\d{6}$/.test(pass)){
    alert('कृपया अपना सही 6 अंकों का पासवर्ड दर्ज करें।');
    return;
  }

  const button=document.querySelector('.primary-btn');
  const oldText=button?.textContent || 'लॉगिन करें';

  if(button){
    button.disabled=true;
    button.textContent='लॉगिन हो रहा है...';
  }

  const {data,error}=await supabaseClient.rpc('login_student',{
    p_login:rawLogin,
    p_password:pass
  });

  if(button){
    button.disabled=false;
    button.textContent=oldText;
  }

  if(error){
    alert('लॉगिन नहीं हो सका: '+(error.message || 'कृपया दोबारा प्रयास करें।'));
    return;
  }

  const student=Array.isArray(data) ? data[0] : data;

  if(!student || !student.login_success){
    alert('Student ID / Mobile Number या Password गलत है।');
    return;
  }

  sessionStorage.setItem('ganit_setu_student_id',student.student_id);
  sessionStorage.setItem('ganit_setu_student_name',student.full_name || '');
  sessionStorage.setItem('ganit_setu_logged_in','true');

  location.href='home.html';
}

async function showRegistration(e){
  e.preventDefault();

  const result=document.getElementById('registrationResult');
  const button=document.getElementById('registerBtn');

  const fullName=getValue('fullName').toUpperCase();
  const classLevel=Number(document.getElementById('classLevel').value);
  const schoolName=getValue('schoolName').toUpperCase();
  const schoolDiseCode=getValue('schoolDiseCode').replace(/\D/g,'').slice(0,11);
  const villageCity=getValue('villageCity').toUpperCase();
  const block=getValue('block').toUpperCase();
  const district=getValue('district').toUpperCase();
  const state=(getValue('state') || 'MADHYA PRADESH').toUpperCase();
  const mobile=getValue('mobile').replace(/\D/g,'').slice(0,10);
  const password=getValue('studentPassword').replace(/\D/g,'').slice(0,6);

  if(!/^[6-9]\d{9}$/.test(mobile)){
    result.innerHTML='<div class="error-box">कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।</div>';
    return;
  }
  if(!/^\d{11}$/.test(schoolDiseCode)){
    result.innerHTML='<div class="error-box">कृपया सही 11 अंकों का UDISE / DISE कोड दर्ज करें।</div>';
    return;
  }
  if(!/^\d{6}$/.test(password)){
    result.innerHTML='<div class="error-box">पासवर्ड केवल 6 अंकों का होना चाहिए।</div>';
    return;
  }
  if(classLevel!==9 && classLevel!==10){
    result.innerHTML='<div class="error-box">कृपया कक्षा 9 या 10 चुनें।</div>';
    return;
  }

  button.disabled=true;
  button.textContent='रजिस्ट्रेशन हो रहा है...';
  result.innerHTML='';

  // कोई Email और कोई Supabase Auth signUp नहीं।
  // Registration सीधे सुरक्षित database function से होगा।
  const {data,error}=await supabaseClient.rpc('register_student',{
    p_full_name:fullName,
    p_class_level:classLevel,
    p_school_name:schoolName,
    p_school_dise_code:schoolDiseCode,
    p_village_city:villageCity,
    p_block:block,
    p_district:district,
    p_state:state,
    p_mobile:mobile,
    p_password:password
  });

  button.disabled=false;
  button.textContent='रजिस्ट्रेशन पूरा करें';

  if(error){
    const msg=error.message || 'रजिस्ट्रेशन नहीं हो सका।';
    if(msg.toLowerCase().includes('mobile') || msg.toLowerCase().includes('unique')){
      result.innerHTML='<div class="error-box">इस मोबाइल नंबर से पहले ही रजिस्ट्रेशन हो चुका है।</div>';
    }else{
      result.innerHTML='<div class="error-box">रजिस्ट्रेशन नहीं हो सका: '+msg+'</div>';
    }
    return;
  }

  const studentId=Array.isArray(data) && data.length ? data[0].student_id : '';
  result.innerHTML='<div class="success-box"><b>✓ रजिस्ट्रेशन सफल</b><br><br>आपकी विद्यार्थी आईडी: <b>'+studentId+'</b><br><br><small>अपना 6 अंकों का पासवर्ड याद रखें।</small></div>';

  document.getElementById('registrationForm').reset();
  document.getElementById('state').value='MADHYA PRADESH';
}


// Login fields की live formatting
document.addEventListener('input', (e) => {
  if(e.target.id==='studentId'){
    let v=e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'');
    // अगर केवल अंक लिखे जा रहे हैं तो अधिकतम 10 अंक
    if(/^\d+$/.test(v)) v=v.slice(0,10);
    // Student ID के लिए सामान्य format
    e.target.value=v;
  }
  if(e.target.id==='password'){
    e.target.value=e.target.value.replace(/\D/g,'').slice(0,6);
  }
});

// Registration fields की live validation: जितने अंक चाहिए उतने ही भरने दें
document.addEventListener('input', (e) => {
  const el=e.target;
  if(el.classList && el.classList.contains('uppercase-field')){
    el.value=el.value.toUpperCase();
  }
  if(el.id==='mobile'){
    el.value=el.value.replace(/\D/g,'').slice(0,10);
  }
  if(el.id==='schoolDiseCode'){
    el.value=el.value.replace(/\D/g,'').slice(0,11);
  }
  if(el.id==='studentPassword'){
    el.value=el.value.replace(/\D/g,'').slice(0,6);
  }
});

/* =========================================================
   PAGE EVENT CONNECTION
   Registration form को reload होने से रोककर showRegistration()
   से Supabase registration चलाता है.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const registrationForm = document.getElementById('registrationForm');
  if (registrationForm) {
    registrationForm.addEventListener('submit', showRegistration);
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      demoLogin();
    });
  }
});
