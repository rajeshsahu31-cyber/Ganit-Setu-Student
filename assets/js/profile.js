// विद्यार्थी की प्रोफाइल का छोटा और अलग module
// बाद में यही data Supabase से आएगा।
const studentProfile = {
  name: "राजेश साहू",
  id: "GS-00001",
  className: "कक्षा 10वीं",
  school: "मेरा विद्यालय",
  rank: "#12",
  photo: "" // Supabase photo URL यहाँ आएगा
};

function renderStudentProfile(){
  document.getElementById("studentNameTop").textContent = studentProfile.name.split(" ")[0];
  document.getElementById("studentName").textContent = studentProfile.name;
  document.getElementById("studentId").textContent = studentProfile.id;
  document.getElementById("studentClass").textContent = studentProfile.className;
  document.getElementById("schoolName").textContent = studentProfile.school;
  document.getElementById("myRank").textContent = studentProfile.rank;

  const photoBox = document.getElementById("studentPhoto");
  if(studentProfile.photo){
    photoBox.innerHTML = `<img src="${studentProfile.photo}" alt="विद्यार्थी फोटो">`;
  }else{
    photoBox.textContent = studentProfile.name.split(" ").map(x=>x[0]).join("").slice(0,2);
  }
}
renderStudentProfile();
