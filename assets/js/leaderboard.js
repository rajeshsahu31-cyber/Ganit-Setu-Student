// ============================================
// GANIT SETU - LEADERBOARD
// Demo records हटाए गए हैं.
// आगे वास्तविक Supabase results से data आएगा.
// ============================================

const topTen = document.getElementById('topTen');

if(topTen){
  topTen.innerHTML = `
    <div class="rank-row" style="justify-content:center;text-align:center;padding:24px;">
      <span>
        <b>अभी कोई वास्तविक टेस्ट रिकॉर्ड उपलब्ध नहीं है</b><br>
        <small>विद्यार्थियों के टेस्ट देने के बाद यहाँ Top 10 दिखाई देगा।</small>
      </span>
    </div>`;
}
