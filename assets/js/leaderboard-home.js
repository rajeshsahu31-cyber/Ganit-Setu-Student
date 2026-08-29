// ============================================
// GANIT SETU - HOME WINNER / LEADERBOARD
// शुरुआत में कोई Demo Data नहीं दिखाया जाएगा.
// आगे वास्तविक Supabase test results से data आएगा.
// ============================================

const winners = [];

function setYesterdayDate(){
  const el=document.getElementById("testDateText");
  if(!el) return;
  const d=new Date();
  d.setDate(d.getDate()-1);
  const date=d.toLocaleDateString("hi-IN",{day:"numeric",month:"long",year:"numeric"});
  el.textContent=`${date} की परीक्षा का सर्वश्रेष्ठ प्रदर्शन`;
}

function emptyMessage(){
  return `<div style="width:100%;text-align:center;padding:24px 12px;">
    <b>अभी कोई परिणाम उपलब्ध नहीं है</b>
    <br><small>वास्तविक विद्यार्थियों के टेस्ट देने के बाद यहाँ रैंकिंग दिखाई जाएगी।</small>
  </div>`;
}

function renderTopThree(){
  const el=document.getElementById("topThree");
  if(!el) return;
  el.innerHTML = emptyMessage();
}

function renderOtherWinners(){
  const track=document.getElementById("winnerTrack");
  if(!track) return;
  track.innerHTML = "";
}

function startAutoScroll(){
  // कोई वास्तविक winner data नहीं है, इसलिए auto-scroll अभी बंद रहेगा।
}

setYesterdayDate();
renderTopThree();
renderOtherWinners();
startAutoScroll();
