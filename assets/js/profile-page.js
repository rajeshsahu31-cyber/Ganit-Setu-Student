document.addEventListener('DOMContentLoaded', async () => {

  const BUCKET_NAME = 'student-photos';

  const sid = sessionStorage.getItem('ganit_setu_student_id');

  if (!sid) {
    location.href = 'index.html';
    return;
  }


  // Elements
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


  // संदेश दिखाने का function
  function showStatus(message, isError = false) {

    photoStatus.textContent = message;

    if (isError) {
      photoStatus.style.color = '#c62828';
    } else {
      photoStatus.style.color = '#2563eb';
    }

  }


  // Initial letters
  function getInitials(name) {

    return (name || 'GS')
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();

  }


  // फोटो दिखाना
  function showPhoto(photoUrl, fullName) {

    if (photoUrl) {

      pPhoto.innerHTML = '';

      const img = document.createElement('img');

      img.src = photoUrl;
      img.alt = 'Profile Photo';

      img.onerror = function () {

        pPhoto.innerHTML = '';
        pPhoto.textContent = getInitials(fullName);

      };

      pPhoto.appendChild(img);

    } else {

      pPhoto.innerHTML = '';
      pPhoto.textContent = getInitials(fullName);

    }

  }


  // Profile Load
  async function loadProfile() {

    try {

      const { data, error } = await supabaseClient
        .from('students')
        .select(`
          student_id,
          full_name,
          class_level,
          school_name,
          mobile,
          photo_url
        `)
        .eq('student_id', sid)
        .maybeSingle();


      if (error) throw error;


      if (!data) {
        throw new Error('Profile नहीं मिली');
      }


      pName.textContent = data.full_name || 'विद्यार्थी';

      pId.textContent = data.student_id || '—';

      pClass.textContent = data.class_level
        ? 'कक्षा ' + data.class_level + 'वीं'
        : '—';

      pSchool.textContent = data.school_name || '—';

      pMobile.textContent = data.mobile || '—';


      showPhoto(
        data.photo_url,
        data.full_name
      );


    } catch (error) {

      console.error('Profile Load Error:', error);

      showStatus(
        'प्रोफाइल लोड नहीं हो सकी।',
        true
      );

    }

  }


  // फोटो चुनना
  photoInput.addEventListener('change', function () {

    const file = this.files[0];

    if (!file) return;


    // केवल image
    if (!file.type.startsWith('image/')) {

      showStatus(
        'कृपया केवल Image File चुनें।',
        true
      );

      photoInput.value = '';
      return;

    }


    // 5 MB Limit
    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {

      showStatus(
        'फोटो का size 5 MB से कम होना चाहिए।',
        true
      );

      photoInput.value = '';
      return;

    }


    selectedFile = file;


    // Preview
    const reader = new FileReader();

    reader.onload = function (event) {

      pPhoto.innerHTML = '';

      const img = document.createElement('img');

      img.src = event.target.result;

      img.alt = 'Selected Profile Photo';

      pPhoto.appendChild(img);

    };


    reader.readAsDataURL(file);


    showStatus(
      'फोटो चुन ली गई है। अब "फोटो अपलोड करें" दबाएँ।'
    );

  });


  // Upload Photo
  uploadPhotoBtn.addEventListener('click', async function () {

    if (!selectedFile) {

      showStatus(
        'पहले फोटो चुनें।',
        true
      );

      return;

    }


    try {

      uploadPhotoBtn.disabled = true;

      uploadPhotoBtn.textContent = 'अपलोड हो रहा है...';

      showStatus('फोटो अपलोड हो रही है...');


      // File Extension
      const fileExtension =
        selectedFile.name
          .split('.')
          .pop()
          .toLowerCase();


      // Unique file name
      const fileName =
        'profile-' +
        Date.now() +
        '.' +
        fileExtension;


      // Student Folder
      const filePath =
        sid + '/' + fileName;


      // Upload to Supabase Storage
      const { error: uploadError } =
        await supabaseClient
          .storage
          .from(BUCKET_NAME)
          .upload(
            filePath,
            selectedFile,
            {
              cacheControl: '3600',
              upsert: false
            }
          );


      if (uploadError) {
        throw uploadError;
      }


      // Public URL
      const { data: publicUrlData } =
        supabaseClient
          .storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);


      const photoUrl =
        publicUrlData.publicUrl;


      // Save URL in students table
      const { error: updateError } =
        await supabaseClient
          .from('students')
          .update({
            photo_url: photoUrl
          })
          .eq('student_id', sid);


      if (updateError) {
        throw updateError;
      }


      showPhoto(
        photoUrl,
        pName.textContent
      );


      showStatus(
        '✅ Profile Photo सफलतापूर्वक अपलोड हो गई।'
      );


      selectedFile = null;

      photoInput.value = '';


    } catch (error) {

      console.error('Photo Upload Error:', error);

      showStatus(
        'फोटो अपलोड नहीं हो सकी: ' +
        (error.message || 'Unknown Error'),
        true
      );


    } finally {

      uploadPhotoBtn.disabled = false;

      uploadPhotoBtn.textContent =
        '⬆️ फोटो अपलोड करें';

    }

  });


  // शुरू में Profile Load
  await loadProfile();

});
