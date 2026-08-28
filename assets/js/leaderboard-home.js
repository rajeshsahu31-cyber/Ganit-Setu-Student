// Home Page के लिए हल्का Demo Data
// बाद में यही डेटा Supabase से automatic आएगा।
const winners = [
  {rank:1,name:"प्रियंका",score:"20/20",className:"10वीं",school:"शासकीय हाई स्कूल",time:"10:18",medal:"🥇"},
  {rank:2,name:"राहुल",score:"19/20",className:"10वीं",school:"शासकीय हाई स्कूल",time:"10:20",medal:"🥈"},
  {rank:3,name:"कविता",score:"18/20",className:"10वीं",school:"शासकीय हाई स्कूल",time:"10:22",medal:"🥉"},
  {rank:4,name:"अमन",score:"18/20",className:"10वीं",school:"शासकीय हाई स्कूल चिरचिरा",time:"10:25"},
  {rank:5,name:"पूजा",score:"18/20",className:"9वीं",school:"शासकीय हाई स्कूल चिरचिरा",time:"10:27"},
  {rank:6,name:"नेहा",score:"17/20",className:"10वीं",school:"शासकीय हाई स्कूल चिरचिरा",time:"10:30"},
  {rank:7,name:"रोहित",score:"17/20",className:"9वीं",school:"शासकीय हाई स्कूल चिरचिरा",time:"10:32"},
  {rank:8,name:"सोनम",score:"16/20",className:"10वीं",school:"शासकीय हाई स्कूल चिरचिरा",time:"10:35"},
  {rank:9,name:"विकास",score:"16/20",className:"9वीं",school:"शासकीय हाई स्कूल चिरचिरा",time:"10:38"},
  {rank:10,name:"रिया",score:"15/20",className:"10वीं",school:"शासकीय हाई स्कूल चिरचिरा",time:"10:40"}
];

function initials(name){ return name.slice(0,2); }

function setYesterdayDate(){
  const el=document.getElementById("testDateText");
  if(!el) return;
  const d=new Date();
  d.setDate(d.getDate()-1);
  const date=d.toLocaleDateString("hi-IN",{day:"numeric",month:"long",year:"numeric"});
  el.textContent=`${date} की परीक्षा का सर्वश्रेष्ठ प्रदर्शन`;
}

function renderTopThree(){
  const order=[1,0,2]; // 2nd, 1st, 3rd
  document.getElementById("topThree").innerHTML=order.map(i=>{
    const w=winners[i];
    return `<div class="champion-card rank-${w.rank} ${w.rank===1?'first':''}">
      <div class="medal">${w.medal}</div>
      <div class="champion-photo">${initials(w.name)}</div>
      <h3>${w.name}</h3>
      <small>रैंक #${w.rank}</small>
      <div class="champion-score">स्कोर: ${w.score}</div>
      <div class="champion-details">
        <span>📚 कक्षा: ${w.className}</span>
        <span>🏫 विद्यालय: ${w.school}</span>
        <span>⏱️ समय: ${w.time}</span>
      </div>
    </div>`;
  }).join("");
}

function renderOtherWinners(){
  const track=document.getElementById("winnerTrack");
  track.innerHTML=winners.slice(3).map(w=>`
    <article class="winner-card">
      <div class="winner-number">#${w.rank}</div>
      <div class="mini-photo">${initials(w.name)}</div>
      <div class="winner-info">
        <b>${w.name}</b>
        <div class="winner-score">स्कोर: ${w.score}</div>
        <small>कक्षा: ${w.className}</small>
        <small>विद्यालय: ${w.school}</small>
        <small>समय: ${w.time}</small>
      </div>
    </article>`).join("");
}

function startAutoScroll(){
  const track=document.getElementById("winnerTrack");
  if(!track) return;

  // Cards duplicate किए जाते हैं ताकि rotation लगातार चलता रहे।
  track.innerHTML += track.innerHTML;
  let paused=false;
  let speed=0.45; // smooth और पढ़ने योग्य continuous speed

  const tick=()=>{
    if(!paused){
      track.scrollLeft += speed;
      const half=track.scrollWidth/2;
      if(track.scrollLeft>=half) track.scrollLeft=0;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const pause=()=>paused=true;
  const play=()=>paused=false;
  track.addEventListener("mouseenter",pause);
  track.addEventListener("mouseleave",play);
  track.addEventListener("touchstart",pause,{passive:true});
  track.addEventListener("touchend",()=>setTimeout(play,1200),{passive:true});
}


setYesterdayDate();
renderTopThree();
renderOtherWinners();
startAutoScroll();
