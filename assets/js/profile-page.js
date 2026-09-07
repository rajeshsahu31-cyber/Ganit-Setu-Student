document.addEventListener('DOMContentLoaded', async () => {
  const BUCKET_NAME = 'student-photos';
  const sid = sessionStorage.getItem('ganit_setu_student_id');
  if (!sid) { location.href = 'index.html'; return; }

  const pPhoto = document.getElementById('pPhoto');
  const pName = document.getElementById('pName');
  const pId = document.getElementById('pId');
  const pClass = document.getElementById('pClass');
  const pSchool = document.getElementById('pSchool');
  const pMobile = document.getElementById('pMobile');
  const photoInput = document.getElementById('photoInput');
  const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
  const photoStatus = document.getElementById('photoStatus');
  let selectedFile = null;

  function showStatus(message, isError = false) {
    photoStatus.textContent = message;
    photoStatus.style.color = isError ? '#c62828' : '#2563eb';
  }

  function getInitials(name) {
    return (name || 'GS').trim().split(/\s+/).map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase();
  }

  function showPhoto(photoUrl, fullName) {
    pPhoto.innerHTML = '';
    if (photoUrl) {
      const img = document.createElement('img');
      img.src = photoUrl;
      img.alt = 'Profile Photo';
      img.onerror = () => { pPhoto.innerHTML = ''; pPhoto.textContent = getInitials(fullName); };
      pPhoto.appendChild(img);
    } else {
      pPhoto.textContent = getInitials(fullName);
    }
  }

  function showPhoto(photoUrl, fullName) {
    pPhoto.innerHTML = '';
    if (photoUrl) {
      const img = document.createElement('img');
      img.src = photoUrl;
      img.alt = 'Profile Photo';
      img.onerror = () => {
        pPhoto.innerHTML = '';
        pPhoto.textContent = getInitials(fullName);
      };
      pPhoto.appendChild(img);
    } else {
      pPhoto.textContent = getInitials(fullName);
    }
  }

  async function loadProfile() {
    try {
      const { data, error } = await supabaseClient.from('students').select('student_id,full_name,class_level,school_name,mobile,photo_url').eq('student_id', sid).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Profile नहीं मिली');
      pName.textContent = data.full_name || 'विद्यार्थी';
      pId.textContent = data.student_id || '—';
      pClass.textContent = data.class_level ? 'कक्षा ' + data.class_level + 'वीं' : '—';
      pSchool.textContent = data.school_name || '—';
      pMobile.textContent = data.mobile || '—';
      showPhoto(data.photo_url, data.full_name);
    } catch (error) {
      console.error('Profile Load Error:', error);
      showStatus('प्रोफाइल लोड नहीं हो सकी।', true);
    }
  }

  photoInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showStatus('कृपया केवल Image File चुनें।', true); photoInput.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { showStatus('फोटो का size 5 MB से कम होना चाहिए।', true); photoInput.value = ''; return; }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => { pPhoto.innerHTML = `<img src="${e.target.result}" alt="Selected Profile Photo">`; };
    reader.readAsDataURL(file);
    showStatus('फोटो चुन ली गई है। अब "फोटो अपलोड करें" दबाएँ।');
  });

  uploadPhotoBtn.addEventListener('click', async function () {
    if (!selectedFile) { showStatus('पहले फोटो चुनें।', true); return; }
    try {
      uploadPhotoBtn.disabled = true;
      uploadPhotoBtn.textContent = 'अपलोड हो रहा है...';
      showStatus('फोटो अपलोड हो रही है...');
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase() || 'jpg';
      const fileName = 'profile-' + Date.now() + '.' + fileExtension;
      const filePath = sid + '/' + fileName;
      const { error: uploadError } = await supabaseClient.storage.from(BUCKET_NAME).upload(filePath, selectedFile, { cacheControl: '3600', upsert: false, contentType: selectedFile.type || 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      const photoUrl = publicUrlData.publicUrl;
      const { error: updateError } = await supabaseClient.from('students').update({ photo_url: photoUrl }).eq('student_id', sid);
      if (updateError) throw updateError;
      showPhoto(photoUrl, pName.textContent);
      showStatus('✅ Profile Photo सफलतापूर्वक अपलोड हो गई।');
      selectedFile = null; photoInput.value = '';
    } catch (error) {
      console.error('Photo Upload Error:', error);
      showStatus('फोटो अपलोड नहीं हो सकी: ' + (error.message || 'Unknown Error'), true);
    } finally {
      uploadPhotoBtn.disabled = false;
      uploadPhotoBtn.textContent = '⬆️ फोटो अपलोड करें';
    }
  });

  await loadProfile();
});
