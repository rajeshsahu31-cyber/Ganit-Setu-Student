function getValue(id){
  return document.getElementById(id)?.value.trim() || '';
}

function syntheticEmail(studentId){
  return studentId.trim().toLowerCase() + '@student.ganitsetu.app';
}

function makePassword(){
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function demoLogin(){
  const id=getValue('studentId').toUpperCase();
  const pass=getValue('password');

  if(!/^GS-\d{5,}$/.test(id)){
    alert('कृपया सही विद्यार्थी आईडी दर्ज करें। उदाहरण: GS-00001');
    return;
  }
  if(!/^\d{6}$/.test(pass)){
    alert('कृपया 6 अंकों का पासवर्ड दर्ज करें।');
    return;
  }

  const button=document.querySelector('.primary-btn');
  const oldText=button?.textContent;
  if(button){button.disabled=true;button.textContent='लॉगिन हो रहा है...';}

  const {error}=await supabaseClient.auth.signInWithPassword({
    email: syntheticEmail(id),
    password: pass
  });

  if(button){button.disabled=false;button.textContent=oldText||'लॉगिन करें';}

  if(error){
    alert('विद्यार्थी आईडी या पासवर्ड गलत है।');
    return;
  }

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
    const code=error.code || '';
    const lower=msg.toLowerCase();

    // केवल वास्तविक duplicate mobile error को ही duplicate registration दिखाएं।
    // RPC/function/configuration errors को गलती से duplicate mobile नहीं दिखाया जाएगा।
    const isDuplicateMobile =
      code === '23505' ||
      lower.includes('mobile already registered') ||
      lower.includes('students_mobile_key') ||
      lower.includes('duplicate key value violates unique constraint');

    if(isDuplicateMobile){
      result.innerHTML='<div class="error-box">इस मोबाइल नंबर से पहले ही रजिस्ट्रेशन हो चुका है।</div>';
    }else{
      result.innerHTML='<div class="error-box"><b>रजिस्ट्रेशन नहीं हो सका।</b><br>'+msg+'</div>';
    }
    return;
  }

  const studentId=Array.isArray(data) && data.length ? data[0].student_id : '';
  result.innerHTML='<div class="success-box"><b>✓ रजिस्ट्रेशन सफल</b><br><br>आपकी विद्यार्थी आईडी: <b>'+studentId+'</b><br><br><small>अपना 6 अंकों का पासवर्ड याद रखें।</small></div>';

  document.getElementById('registrationForm').reset();
  document.getElementById('state').value='MADHYA PRADESH';
}

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
