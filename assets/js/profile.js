/* ============================================
   GANIT SETU - STUDENT DYNAMIC PROFILE
   Logged-in student की पूरी profile Supabase से
   ============================================ */

function setText(id, value, fallback='—'){
  const el=document.getElementById(id);
  if(el) el.textContent = value || fallback;
}

function getInitials(name){
  return String(name || 'विद्यार्थी')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(x=>x[0])
    .join('')
    .slice(0,2)
    .toUpperCase();
}

function renderStudentPhoto(name, photoUrl){
  const photoBox=document.getElementById('studentPhoto');
  if(!photoBox) return;

  photoBox.innerHTML='';
  if(photoUrl){
    const img=document.createElement('img');
    img.src=photoUrl;
    img.alt='विद्यार्थी फोटो';
    img.onerror=()=>{ photoBox.textContent=getInitials(name); };
    photoBox.appendChild(img);
  }else{
    photoBox.textContent=getInitials(name);
  }
}

function renderStudentProfile(student){
  const name=student.full_name || 'विद्यार्थी';
  const className=student.class_level ? `कक्षा ${student.class_level}वीं` : '—';

  setText('studentNameTop', name.split(/\s+/)[0] || name);
  setText('studentName', name);
  setText('studentId', student.student_id);
  setText('studentClass', className);
  setText('schoolName', student.school_name);
  renderStudentPhoto(name, student.photo_url || '');

  // Home Page पर Rank को leaderboard-home.js संभालता है। यहाँ myRank को बदलना नहीं है।
}

async function loadStudentProfile(){
  const studentId=sessionStorage.getItem('ganit_setu_student_id');

  if(!studentId){
    alert('कृपया पहले लॉगिन करें।');
    location.href='index.html';
    return;
  }

  try{
    const {data,error}=await supabaseClient
      .from('students')
      .select('student_id, full_name, class_level, school_name, village_city, block, district, state, mobile, photo_url, status')
      .eq('student_id', studentId)
      .maybeSingle();

    if(error) throw error;

    if(!data){
      alert('विद्यार्थी की प्रोफाइल नहीं मिली। कृपया दोबारा लॉगिन करें।');
      sessionStorage.removeItem('ganit_setu_student_id');
      sessionStorage.removeItem('ganit_setu_student_name');
      sessionStorage.removeItem('ganit_setu_logged_in');
      location.href='index.html';
      return;
    }

    if(data.status && data.status !== 'active'){
      alert('यह विद्यार्थी प्रोफाइल अभी सक्रिय नहीं है।');
      location.href='index.html';
      return;
    }

    renderStudentProfile(data);

    // आगे Test, Result और Ranking के लिए current student details उपलब्ध रहेंगी।
    sessionStorage.setItem('ganit_setu_student_name', data.full_name || '');
    sessionStorage.setItem('ganit_setu_student_class', String(data.class_level || ''));
    sessionStorage.setItem('ganit_setu_student_school', data.school_name || '');

  }catch(error){
    console.error('Profile load error:', error);
    setText('studentNameTop','विद्यार्थी');
    setText('studentName','प्रोफाइल लोड नहीं हुई');
    setText('studentId','—');
    setText('studentClass','—');
    setText('schoolName','—');

    const photoBox=document.getElementById('studentPhoto');
    if(photoBox) photoBox.textContent='';
  }
}

document.addEventListener('DOMContentLoaded', loadStudentProfile);
