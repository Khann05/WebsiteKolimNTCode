(function(){
  const PAGE = document.body.dataset.page || 'home';
  const qs = new URLSearchParams(location.search);
  const state = {
    debug: qs.get('debug') === '1',
    parentCode: qs.get('code') || localStorage.getItem('parentCode') || '',
    student: null,
    selected: null,
    checked: false,
    latestUnlocked: null,
    unlockedCount: 0,
    quizReadyCount: 0,
    lockedCount: 0
  };

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const phone = $('.phone-frame');
  if(state.debug) document.body.classList.add('hit-debug');

  async function loadStudent(){
    if(!state.parentCode) return;
    try{
      localStorage.setItem('parentCode', state.parentCode);
      const res = await fetch('/api/parent/' + encodeURIComponent(state.parentCode), {cache:'no-store'});
      const data = await res.json();
      if(!res.ok || !data || data.error) return;
      state.student = data;
      const library = Array.isArray(data.library) ? data.library.slice() : [];
      state.unlockedCount = library.filter(x => x && x.is_unlocked).length;
      state.quizReadyCount = library.filter(x => x && x.is_unlocked && x.quiz_id && Number(x.quiz_question_count||0) > 0).length;
      state.lockedCount = library.filter(x => x && !x.is_unlocked).length;
      state.latestUnlocked = library.filter(x => x && x.is_unlocked).sort((a,b) => Number(b.id||0)-Number(a.id||0))[0] || null;
    }catch(err){ console.warn(err); }
  }

  function showToast(msg){
    const t = $('#liveToast');
    if(!t) return;
    t.innerHTML = '<span>✨</span><span>'+ msg +'</span>';
    t.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(()=>t.classList.remove('show'), 1800);
  }

  function speak(msg){
    const bubble = $('#assistBubble');
    if(!bubble) return;
    bubble.textContent = msg;
    bubble.classList.add('show');
    clearTimeout(speak._timer);
    speak._timer = setTimeout(()=>bubble.classList.remove('show'), 2800);
  }

  function go(url){
    const code = state.parentCode ? '?code=' + encodeURIComponent(state.parentCode) : '';
    location.href = url + code;
  }

  function makeHotspot(cls, x, y, w, h, onClick, label){
    const btn = document.createElement('button');
    btn.className = 'hotspot ' + cls;
    btn.setAttribute('aria-label', label || 'hotspot');
    btn.style.left = x + '%';
    btn.style.top = y + '%';
    btn.style.width = w + '%';
    btn.style.height = h + '%';
    btn.addEventListener('click', onClick);
    phone.appendChild(btn);
    return btn;
  }

  function initShared(){
    const back = $('#floatingBack');
    if(back){
      if(PAGE === 'home') back.classList.add('hidden');
      back.addEventListener('click', ()=> history.length > 1 ? history.back() : go('/anak.html'));
    }
    const fab = $('#assistFab');
    if(fab){
      fab.addEventListener('click', ()=>{
        if(PAGE === 'home') speak(state.student ? ('Hai ' + (state.student.name||'teman') + '! Kamu punya ' + state.unlockedCount + ' materi terbuka.') : 'Halo! Yuk lanjut petualangan codingmu!');
        else if(PAGE === 'quiz') speak('Pilih jawaban, lalu klik cek jawaban ya!');
        else if(PAGE === 'map') speak('Klik misi yang bersinar untuk mulai belajar.');
        else speak('Kumpulkan koin dan XP untuk hadiah seru!');
      });
    }
  }

  function initHome(){
    makeHotspot('home-continue', 6, 64.5, 88, 8.6, ()=> go('/anak-misi.html'), 'Lanjutkan belajar');
    makeHotspot('home-mission', 6, 75.5, 41.5, 18, ()=> go('/anak-misi.html'), 'Misi');
    makeHotspot('home-quiz', 52.5, 75.5, 41.5, 18, ()=> go('/anak-quiz.html'), 'Quiz');
    makeHotspot('nav-home', 6, 92.8, 17, 5.4, ()=> showToast('Kamu sudah di beranda.'), 'Beranda');
    makeHotspot('nav-mission', 23.5, 92.8, 17, 5.4, ()=> go('/anak-misi.html'), 'Misi');
    makeHotspot('nav-learn', 41, 91.8, 18, 7.2, ()=> go('/anak-quiz.html'), 'Belajar');
    makeHotspot('nav-reward', 61, 92.8, 16, 5.4, ()=> go('/anak-profil.html'), 'Reward');
    makeHotspot('nav-profile', 78.5, 92.8, 15.5, 5.4, ()=> go('/anak-profil.html'), 'Profil');
    speak('Hai! Ini versi anak yang sama seperti desain mockup.');
  }

  function initMap(){
    const nodes = [
      [17,31.5,17,10,'Misi Print Python'],
      [62,34.5,18,10,'Misi Variable'],
      [28,49,18,10,'Quiz Python'],
      [62,62,18,10,'Looping'],
      [29,76,18,10,'Function']
    ];
    nodes.forEach((n, i)=>{
      makeHotspot('map-node map-node-'+i, n[0], n[1], n[2], n[3], ()=>{
        if(i < 3){
          if(i === 2) go('/anak-quiz.html');
          else showToast(n[4] + ' dibuka!');
        } else {
          speak('Misi ini masih terkunci. Selesaikan misi sebelumnya dulu ya!');
        }
      }, n[4]);
    });
    makeHotspot('map-home', 6, 92.8, 17, 5.4, ()=> go('/anak.html'), 'Beranda');
    makeHotspot('map-nav-mission', 23.5, 92.8, 17, 5.4, ()=> showToast('Kamu sudah di halaman misi.'), 'Misi');
    makeHotspot('map-nav-learn', 41, 91.8, 18, 7.2, ()=> go('/anak-quiz.html'), 'Belajar');
    makeHotspot('map-nav-reward', 61, 92.8, 16, 5.4, ()=> go('/anak-profil.html'), 'Reward');
    makeHotspot('map-nav-profile', 78.5, 92.8, 15.5, 5.4, ()=> go('/anak-profil.html'), 'Profil');
  }

  function initProfile(){
    const rewards = [
      [7,54,20,15,'Stiker Robo'],
      [29,54,20,15,'Robo Mini'],
      [52,54,20,15,'Buku Coding'],
      [74,54,20,15,'XP Boost']
    ];
    rewards.forEach(r => makeHotspot('reward-'+r[4], r[0], r[1], r[2], r[3], ()=> showToast(r[4] + ' dipilih!'), r[4]));
    makeHotspot('profile-home', 6, 92.8, 17, 5.4, ()=> go('/anak.html'), 'Beranda');
    makeHotspot('profile-nav-mission', 23.5, 92.8, 17, 5.4, ()=> go('/anak-misi.html'), 'Misi');
    makeHotspot('profile-nav-learn', 41, 91.8, 18, 7.2, ()=> go('/anak-quiz.html'), 'Belajar');
    makeHotspot('profile-nav-reward', 61, 92.8, 16, 5.4, ()=> showToast('Kamu sudah di reward.'), 'Reward');
    makeHotspot('profile-nav-profile', 78.5, 92.8, 15.5, 5.4, ()=> showToast('Profil aktif.'), 'Profil');
  }

  function launchConfetti(){
    for(let i=0;i<18;i++){
      const el = document.createElement('div');
      el.textContent = ['✨','⭐','💎','🪙'][Math.floor(Math.random()*4)];
      el.style.position = 'fixed';
      el.style.left = (45 + Math.random()*10) + 'vw';
      el.style.top = (30 + Math.random()*20) + 'vh';
      el.style.fontSize = (18 + Math.random()*18) + 'px';
      el.style.zIndex = 31;
      el.style.pointerEvents = 'none';
      el.animate([
        {transform:'translate(0,0) rotate(0deg)', opacity:1},
        {transform:`translate(${(Math.random()*220)-110}px, ${150 + Math.random()*260}px) rotate(${180+Math.random()*300}deg)`, opacity:0}
      ], {duration:1000 + Math.random()*600, easing:'cubic-bezier(.12,.7,.18,1)'});
      document.body.appendChild(el);
      setTimeout(()=> el.remove(), 1700);
    }
  }

  function initQuiz(){
    const answers = [
      {id:'A', x:7.5, y:46.5, w:85, h:8.1},
      {id:'B', x:7.5, y:56.8, w:85, h:8.1},
      {id:'C', x:7.5, y:67.0, w:85, h:8.1},
      {id:'D', x:7.5, y:77.2, w:85, h:8.1}
    ];
    const outline = document.createElement('div');
    outline.className = 'answer-outline';
    phone.appendChild(outline);

    answers.forEach((a, idx)=>{
      makeHotspot('answer-'+a.id, a.x, a.y, a.w, a.h, ()=>{
        state.selected = a;
        outline.className = 'answer-outline show';
        outline.style.left = a.x + '%';
        outline.style.top = a.y + '%';
        outline.style.width = a.w + '%';
        outline.style.height = a.h + '%';
        speak('Jawaban ' + a.id + ' dipilih. Klik cek jawaban ya!');
      }, 'Jawaban '+a.id);
    });

    makeHotspot('check-answer', 13, 91.3, 74, 5.2, ()=>{
      if(state.checked){
        showResult();
        return;
      }
      if(!state.selected){
        speak('Pilih salah satu jawaban dulu ya.');
        return;
      }
      state.checked = true;
      const correct = 'B';
      if(state.selected.id === correct){
        outline.className = 'answer-outline show correct';
        launchConfetti();
        speak('Keren! Jawabanmu benar!');
        showToast('Benar! +120 XP');
      } else {
        outline.className = 'answer-outline show wrong';
        speak('Belum tepat, tapi kamu hebat sudah mencoba!');
        showToast('Jawaban belum tepat');
      }
      setTimeout(showResult, 750);
    }, 'Cek Jawaban');

    // close button zone on top-right
    makeHotspot('close-quiz', 85.2, 1.2, 9, 5.8, ()=> go('/anak-misi.html'), 'Tutup quiz');
  }

  function showResult(){
    const sheet = $('#resultSheet');
    if(!sheet) return;
    const title = $('#resultTitle');
    const txt = $('#resultText');
    const scorePill = $('#scorePill');
    const coinPill = $('#coinPill');
    const correct = state.selected && state.selected.id === 'B';
    title.textContent = correct ? 'Mantap!' : 'Tetap Semangat!';
    txt.textContent = correct ? 'Kamu berhasil menyelesaikan quiz dengan baik.' : 'Coba lagi nanti ya, Robo tetap bangga!';
    scorePill.textContent = correct ? '⭐ +120 XP' : '⭐ +20 XP';
    coinPill.textContent = correct ? '🪙 +60 Koin' : '🪙 +10 Koin';
    sheet.classList.add('show');
  }

  async function init(){
    initShared();
    await loadStudent();
    if(PAGE === 'home') initHome();
    if(PAGE === 'map') initMap();
    if(PAGE === 'quiz') initQuiz();
    if(PAGE === 'profile') initProfile();
  }

  window.kidExactGo = go;
  document.addEventListener('DOMContentLoaded', init);
})();
