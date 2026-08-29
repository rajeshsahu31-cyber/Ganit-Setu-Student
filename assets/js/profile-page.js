document.addEventListener('DOMContentLoaded', async () => {

  const sid = sessionStorage.getItem('ganit_setu_student_id');

  if (!sid) {
    location.href = 'index.html';
    return;
  }

  const photoInput = document.getElementById('photoInput');
  const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
  const photoStatus = document.getElementById('photoStatus');
  const photoBox = document.getElementById('pPhoto');

  let selectedFile = null;


  // छात्र की प्रोफाइल लोड करें
  try {

    const { data, error } = await supabaseClient
      .from('students')
      .select(
        'student_id,full_name,class_level,school_name,mobile,photo_url'
      )
      .eq('student_id', sid)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error('Profile नहीं मिली');
    }


    // छात्र की जानकारी दिखाएं
    document.getElementById('pName').textContent =
      data.full_name || 'विद्यार्थी';

    document.getElementById('pId').textContent =
      data.student_id || '—';

    document.getElementById('pClass').textContent =
      data.class_level
        ? 'कक्षा ' + data.class_level + 'वीं'
        : '—';

    document.getElementById('pSchool').textContent =
      data.school_name || '—';

    document.getElementById('pMobile').textContent =
      data.mobile || '—';


    // पहले से फोटो है तो दिखाएं
    if (data.photo_url) {

      photoBox.innerHTML = '<img alt="Profile Photo">';

      photoBox.querySelector('img').src = data.photo_url;

    } else {

      photoBox.textContent = getInitials(data.full_name);

    }


  } catch (error) {

    console.error('Profile Load Error:', error);

    alert('प्रोफाइल लोड नहीं हो सकी।');

  }


  // फोटो चुनने पर Preview दिखाएं
  photoInput.addEventListener('change', function () {

    const file = this.files[0];

    if (!file) return;


    // केवल फोटो स्वीकार करें
    if (!file.type.startsWith('image/')) {

      alert('कृपया केवल फोटो चुनें।');

      this.value = '';

      return;

    }


    // Maximum 5 MB
    if (file.size > 5 * 1024 * 1024) {

      alert('फोटो का size 5 MB से कम होना चाहिए।');

      this.value = '';

      return;

    }


    selectedFile = file;


    // फोटो Preview
    const reader = new FileReader();

    reader.onload = function (event) {

      photoBox.innerHTML =
        '<img src="' +
        event.target.result +
        '" alt="Profile Preview">';

    };

    reader.readAsDataURL(file);


    photoStatus.textContent =
      'फोटो चुन ली गई है। अब फोटो अपलोड करें।';

  });


  // फोटो Upload करें
  uploadPhotoBtn.addEventListener('click', async function () {

    if (!selectedFile) {

      alert('पहले फोटो चुनें।');

      return;

    }


    try {

      uploadPhotoBtn.disabled = true;

      uploadPhotoBtn.textContent = 'अपलोड हो रही है...';

      photoStatus.textContent =
        'कृपया प्रतीक्षा करें, फोटो अपलोड हो रही है...';


      // File Extension
      const extension =
        selectedFile.name.split('.').pop().toLowerCase();


      // Unique File Name
      const fileName =
        sid +
        '-' +
        Date.now() +
        '.' +
        extension;


      // Supabase Storage में Upload
      const { error: uploadError } =
        await supabaseClient
          .storage
          .from('student-photos')
          .upload(
            fileName,
            selectedFile,
            {
              cacheControl: '3600',
              upsert: true
            }
          );


      if (uploadError) throw uploadError;


      // Public URL प्राप्त करें
      const { data: publicUrlData } =
        supabaseClient
          .storage
          .from('student-photos')
          .getPublicUrl(fileName);


      const photoUrl =
        publicUrlData.publicUrl;


      // Students Table में Photo URL Save करें
      const { error: updateError } =
        await supabaseClient
          .from('students')
          .update({
            photo_url: photoUrl
          })
          .eq('student_id', sid);


      if (updateError) throw updateError;


      photoStatus.textContent =
        '✅ आपकी Profile Photo सफलतापूर्वक अपडेट हो गई।';


      alert(
        'Profile Photo सफलतापूर्वक Upload हो गई।'
      );


      selectedFile = null;

      photoInput.value = '';


    } catch (error) {

      console.error('Photo Upload Error:', error);

      alert(
        'Photo Upload नहीं हो सकी: ' +
        (error.message || 'Unknown Error')
      );


      photoStatus.textContent =
        '❌ Photo Upload नहीं हो सकी।';


    } finally {

      uploadPhotoBtn.disabled = false;

      uploadPhotoBtn.textContent =
        '⬆️ फोटो अपलोड करें';

    }

  });


  // नाम से Initials बनाएं
  function getInitials(name) {

    return (name || 'GS')
      .split(/\s+/)
      .map(word => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  }

});
