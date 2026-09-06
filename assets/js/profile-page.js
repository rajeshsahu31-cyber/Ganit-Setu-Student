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
  let cameraStream = null;

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

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    const modal = document.getElementById('cameraModal');
    if (modal) modal.remove();
  }

  async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showStatus('इस device/browser में Camera उपलब्ध नहीं है। Gallery से फोटो चुनें।', true);
      return;
    }
    try {
      const modal = document.createElement('div');
      modal.id = 'cameraModal';
      modal.innerHTML = `
        <div class="cam-overlay">
          <div class="cam-card">
            <div class="cam-title">📷 फोटो लें</div>
            <video id="cameraVideo" autoplay playsinline muted></video>
            <canvas id="cameraCanvas" hidden></canvas>
            <div id="cameraError" class="cam-error"></div>
            <div class="cam-actions">
              <button type="button" id="takePhotoBtn" class="cam-primary">📸 फोटो लें</button>
              <button type="button" id="closeCameraBtn" class="cam-secondary">रद्द करें</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);

      const video = document.getElementById('cameraVideo');
      const canvas = document.getElementById('cameraCanvas');
      const errorBox = document.getElementById('cameraError');

      document.getElementById('closeCameraBtn').onclick = closeCamera;
      document.getElementById('takePhotoBtn').onclick = () => {
        if (!cameraStream || !video.videoWidth) {
          errorBox.textContent = 'कैमरा तैयार नहीं है। कृपया एक क्षण प्रतीक्षा करें।';
          return;
        }
        const maxWidth = 1280;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) { errorBox.textContent = 'फोटो बनाने में समस्या हुई।'; return; }
          selectedFile = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const reader = new FileReader();
          reader.onload = e => { pPhoto.innerHTML = `<img src="${e.target.result}" alt="Selected Profile Photo">`; };
          reader.readAsDataURL(selectedFile);
          showStatus('फोटो ले ली गई है। अब "फोटो अपलोड करें" दबाएँ।');
          closeCamera();
        }, 'image/jpeg', 0.9);
      };

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false
      });
      video.srcObject = cameraStream;
      await video.play();
    } catch (error) {
      console.error('Camera Error:', error);
      const errorBox = document.getElementById('cameraError');
      if (errorBox) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorBox.textContent = 'Camera permission बंद है। Browser में इस site के लिए Camera → Allow करें और फिर दोबारा कोशिश करें।';
        } else if (error.name === 'NotFoundError') {
          errorBox.textContent = 'इस device में camera नहीं मिला। Gallery से फोटो चुनें।';
        } else {
          errorBox.textContent = 'Camera नहीं खुल सका। कृपया Camera permission जाँचें।';
        }
      } else {
        showStatus('Camera नहीं खुल सका। कृपया Camera permission जाँचें।', true);
      }
      if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null; }
    }
  }

  function ensureCameraGalleryChooser() {
    if (document.getElementById('cameraGalleryChooser')) return;
    const box = document.createElement('div');
    box.id = 'cameraGalleryChooser';
    box.innerHTML = `<div class="cgc-overlay"><div class="cgc-card"><div class="cgc-title">फोटो चुनें</div><button type="button" id="cgcCamera">📷 कैमरा से फोटो लें</button><button type="button" id="cgcGallery">🖼️ Gallery से चुनें</button><button type="button" id="cgcCancel">रद्द करें</button></div></div>`;
    document.body.appendChild(box);
    const style = document.createElement('style');
    style.id = 'cameraGalleryChooserStyle';
    style.textContent = `
      #cameraGalleryChooser .cgc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;padding:14px;z-index:99999}
      #cameraGalleryChooser .cgc-card{width:min(420px,94vw);background:#fff;border-radius:18px;padding:14px;box-shadow:0 12px 35px rgba(0,0,0,.2)}
      #cameraGalleryChooser .cgc-title{text-align:center;font-weight:800;font-size:17px;margin-bottom:9px;color:#145d76}
      #cameraGalleryChooser button{width:100%;border:1px solid #dbe5ee;background:#f8fbfd;border-radius:12px;padding:11px 10px;margin:4px 0;font-weight:700;font-size:14px;color:#234}
      #cameraGalleryChooser #cgcCancel{background:#fff}
      #cameraModal .cam-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:14px;z-index:100000}
      #cameraModal .cam-card{width:min(520px,96vw);background:#fff;border-radius:18px;padding:14px;box-shadow:0 15px 45px rgba(0,0,0,.35)}
      #cameraModal .cam-title{text-align:center;font-weight:800;font-size:18px;color:#145d76;margin-bottom:10px}
      #cameraModal video{width:100%;max-height:65vh;background:#111;border-radius:14px;display:block;object-fit:cover}
      #cameraModal .cam-actions{display:flex;gap:8px;margin-top:10px}
      #cameraModal .cam-actions button{flex:1;border:0;border-radius:12px;padding:12px;font-weight:800;cursor:pointer}
      #cameraModal .cam-primary{background:#145d76;color:#fff}.cam-secondary{background:#eef2f7;color:#234}
      #cameraModal .cam-error{min-height:20px;color:#c62828;text-align:center;font-size:13px;margin-top:8px;line-height:1.35}
    `;
    document.head.appendChild(style);
    document.getElementById('cgcCamera').onclick = () => { box.style.display = 'none'; openCamera(); };
    document.getElementById('cgcGallery').onclick = () => { box.style.display = 'none'; photoInput.setAttribute('accept', 'image/*'); photoInput.removeAttribute('capture'); photoInput.click(); };
    document.getElementById('cgcCancel').onclick = () => box.style.display = 'none';
  }
  ensureCameraGalleryChooser();

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
