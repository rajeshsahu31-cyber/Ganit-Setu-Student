function selectOption(btn){document.querySelectorAll('.options button').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');}
let sec=0;
if(document.getElementById('timer')){
 setInterval(()=>{sec++;let m=String(Math.floor(sec/60)).padStart(2,'0');let s=String(sec%60).padStart(2,'0');document.getElementById('timer').textContent='⏱️ '+m+':'+s;},1000);
}
function submitDailyAnswer(){
 const a=document.getElementById('finalAnswer').value.trim();
 document.getElementById('dailyMessage').innerHTML=a?'<div class="success-box">✓ आपका उत्तर जमा हो गया। प्रश्न हल करने का समय रिकॉर्ड कर लिया गया है।</div>':'कृपया अपना उत्तर लिखें।';
}