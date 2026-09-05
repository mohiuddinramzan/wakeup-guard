/* ============================================================
   Wakeup Guard — app.js
   Plain JS, no build step, no bundler. Everything lives in this
   one file on purpose: this project is deployed straight into
   Capacitor's www/ folder without a bundling step, so anything
   split into ES modules or requiring npm packages at runtime
   (e.g. @capacitor/local-notifications) would silently fail to
   load. See README "Known limitations" before relying on this
   for anything important.
   ============================================================ */

const STORAGE_KEY = 'wg_alarms_v1';
const CHALLENGE_LABELS = {
  type_phrase: '✍️ বাক্য টাইপ',
  speak_phrase: '🎙️ বলে দেখান',
  password: '🔒 পাসওয়ার্ড',
  math: '🧮 অংক',
  shake: '📳 ঝাঁকান',
  hold: '👆 চেপে ধরুন',
  pattern: '🔗 প্যাটার্ন',
  face: '🙂 ফেস চেক'
};
const DAY_NAMES = ['রবি','সোম','মঙ্গল','বুধ','বৃহঃ','শুক্র','শনি'];
const DEFAULT_PHRASE = "I'm completely awake now. You can shut down.";

/* ---------------- Storage ---------------- */
function loadAlarms(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function saveAlarms(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
let alarms = loadAlarms();
let editingId = null;

/* ---------------- Navigation ---------------- */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ---------------- List screen ---------------- */
function renderList(){
  const wrap = document.getElementById('alarm-list');
  wrap.innerHTML = '';
  if(alarms.length === 0){
    wrap.innerHTML = `<div class="empty-state"><b>কোনো অ্যালার্ম নেই</b>নিচের + বাটনে চেপে প্রথম অ্যালার্মটি বানান। মনে রাখবেন — এটা এমন অ্যালার্ম যেটা বন্ধ করতে আপনাকে সত্যিই জেগে উঠতে হবে।</div>`;
    return;
  }
  alarms.slice().sort((a,b)=>a.time.localeCompare(b.time)).forEach(al=>{
    const card = document.createElement('div');
    card.className = 'alarm-card' + (al.enabled ? '' : ' disabled');
    const daysHtml = DAY_NAMES.map((n,i)=>
      `<span class="day-dot ${al.days.includes(i)?'on':''}">${n}</span>`
    ).join('');
    const tagsHtml = al.challenges.map(c=>`<span class="ctag">${CHALLENGE_LABELS[c]}</span>`).join(' · ');
    card.innerHTML = `
      <div class="info" data-id="${al.id}">
        <div class="time">${al.time}</div>
        <div class="label">${al.label || 'অ্যালার্ম'}</div>
        <div class="days">${daysHtml}</div>
        <div class="challenges-tags">${tagsHtml}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">
        <label class="switch">
          <input type="checkbox" class="toggle-enabled" data-id="${al.id}" ${al.enabled?'checked':''}>
          <span class="slider"></span>
        </label>
        <button class="danger-btn" style="padding:6px 10px;margin:0;font-size:12px;" data-test="${al.id}">টেস্ট</button>
      </div>`;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll('.info').forEach(el=>{
    el.addEventListener('click', ()=> openEditor(el.dataset.id));
  });
  wrap.querySelectorAll('.toggle-enabled').forEach(el=>{
    el.addEventListener('click', e=> e.stopPropagation());
    el.addEventListener('change', e=>{
      const a = alarms.find(x=>x.id===e.target.dataset.id);
      a.enabled = e.target.checked;
      saveAlarms(alarms);
      scheduleAlarmNotifications(a);
      renderList();
    });
  });
  wrap.querySelectorAll('[data-test]').forEach(el=>{
    el.addEventListener('click', e=>{
      e.stopPropagation();
      const a = alarms.find(x=>x.id===e.target.dataset.test);
      fireAlarm(a);
    });
  });
}

/* ---------------- Editor screen ---------------- */
function blankAlarm(){
  return {
    id: 'al_' + Date.now(),
    time: '07:00',
    label: '',
    days: [],
    enabled: true,
    challenges: ['type_phrase'],
    config: { phrase: DEFAULT_PHRASE, password: '', mathDifficulty: 'medium',
              shakeCount: 15, holdSeconds: 5, pattern: [] },
    snoozeEnabled: true
  };
}

function openEditor(id){
  editingId = id || null;
  const al = id ? alarms.find(a=>a.id===id) : blankAlarm();
  document.getElementById('input-time').value = al.time;
  document.getElementById('input-label').value = al.label;
  document.querySelectorAll('#day-picker button').forEach(b=>{
    b.classList.toggle('active', al.days.includes(Number(b.dataset.day)));
  });
  document.querySelectorAll('#challenge-picker input').forEach(cb=>{
    cb.checked = al.challenges.includes(cb.value);
  });
  document.getElementById('input-snooze-enabled').checked = al.snoozeEnabled !== false;
  window._editorConfig = JSON.parse(JSON.stringify(al.config));
  window._editorPattern = al.config.pattern.slice();
  renderChallengeConfigArea();
  document.getElementById('btn-delete-alarm').style.display = id ? 'block' : 'none';
  showScreen('screen-editor');
}

function renderChallengeConfigArea(){
  const area = document.getElementById('challenge-config-area');
  const selected = Array.from(document.querySelectorAll('#challenge-picker input:checked')).map(i=>i.value);
  area.innerHTML = '';
  const cfg = window._editorConfig;

  if(selected.includes('type_phrase') || selected.includes('speak_phrase')){
    area.innerHTML += `
      <div class="config-block">
        <div class="ck-title">যে বাক্যটি বলতে/লিখতে হবে</div>
        <input type="text" id="cfg-phrase" value="${escapeHtml(cfg.phrase)}">
        <div class="hint">ডিফল্ট বাক্যটি ইচ্ছেমতো বদলে নিতে পারেন।</div>
      </div>`;
  }
  if(selected.includes('password')){
    area.innerHTML += `
      <div class="config-block">
        <div class="ck-title">অ্যালার্ম বন্ধ করার পাসওয়ার্ড</div>
        <input type="text" id="cfg-password" value="${escapeHtml(cfg.password)}" placeholder="পাসওয়ার্ড লিখুন">
      </div>`;
  }
  if(selected.includes('math')){
    area.innerHTML += `
      <div class="config-block">
        <div class="ck-title">অংকের কঠিনতা</div>
        <select id="cfg-math-diff" style="width:100%;padding:12px;border-radius:10px;background:var(--bg-deep);color:var(--text);border:1px solid var(--line);">
          <option value="easy">সহজ</option>
          <option value="medium">মাঝারি</option>
          <option value="hard">কঠিন</option>
        </select>
        <div class="hint">৩টি অংক ধারাবাহিকভাবে সঠিক করতে হবে।</div>
      </div>`;
  }
  if(selected.includes('shake')){
    area.innerHTML += `
      <div class="config-block">
        <div class="ck-title">কতবার ঝাঁকাতে হবে</div>
        <input type="number" id="cfg-shake" min="5" max="60" value="${cfg.shakeCount}">
        <div class="hint">ফোনের মোশন সেন্সর ব্যবহার করে গোনা হবে। ব্রাউজার/ডিভাইস অনুযায়ী সংবেদনশীলতা ভিন্ন হতে পারে।</div>
      </div>`;
  }
  if(selected.includes('hold')){
    area.innerHTML += `
      <div class="config-block">
        <div class="ck-title">কত সেকেন্ড চেপে ধরতে হবে</div>
        <input type="number" id="cfg-hold" min="2" max="30" value="${cfg.holdSeconds}">
      </div>`;
  }
  if(selected.includes('pattern')){
    area.innerHTML += `
      <div class="config-block">
        <div class="ck-title">প্যাটার্ন সেট করুন (কমপক্ষে ৪টি বিন্দু ক্রমানুসারে চাপুন)</div>
        <div class="pattern-grid" id="cfg-pattern-grid"></div>
        <div class="hint" id="cfg-pattern-hint">এখন পর্যন্ত: ${window._editorPattern.length} টি বিন্দু বাছাই হয়েছে</div>
        <button type="button" class="danger-btn" id="cfg-pattern-reset" style="margin-top:10px;">রিসেট</button>
      </div>`;
  }
  if(selected.includes('face')){
    area.innerHTML += `
      <div class="config-block">
        <div class="ck-title">ফেস চেক</div>
        <div class="hint">এটি প্রকৃত ফেস-রিকগনিশন নয় — শুধু ক্যামেরা চালু করে কয়েক সেকেন্ড আপনাকে ফ্রেমে থাকতে বলা হবে। কোনো ছবি সংরক্ষণ বা পাঠানো হয় না।</div>
      </div>`;
  }

  if(selected.includes('pattern')){
    const grid = document.getElementById('cfg-pattern-grid');
    for(let i=0;i<9;i++){
      const dot = document.createElement('div');
      dot.className = 'pattern-dot' + (window._editorPattern.includes(i) ? ' picked' : '');
      dot.textContent = window._editorPattern.includes(i) ? (window._editorPattern.indexOf(i)+1) : '';
      dot.addEventListener('click', ()=>{
        if(window._editorPattern.includes(i)) return;
        window._editorPattern.push(i);
        renderChallengeConfigArea();
      });
      grid.appendChild(dot);
    }
    document.getElementById('cfg-pattern-reset').addEventListener('click', ()=>{
      window._editorPattern = [];
      renderChallengeConfigArea();
    });
  }
}

function escapeHtml(s){ const d=document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

function collectEditorConfig(){
  const cfg = window._editorConfig;
  const phraseEl = document.getElementById('cfg-phrase');
  if(phraseEl) cfg.phrase = phraseEl.value.trim() || DEFAULT_PHRASE;
  const passEl = document.getElementById('cfg-password');
  if(passEl) cfg.password = passEl.value;
  const mathEl = document.getElementById('cfg-math-diff');
  if(mathEl) cfg.mathDifficulty = mathEl.value;
  const shakeEl = document.getElementById('cfg-shake');
  if(shakeEl) cfg.shakeCount = Number(shakeEl.value) || 15;
  const holdEl = document.getElementById('cfg-hold');
  if(holdEl) cfg.holdSeconds = Number(holdEl.value) || 5;
  cfg.pattern = window._editorPattern.slice();
  return cfg;
}

document.getElementById('challenge-picker').addEventListener('change', renderChallengeConfigArea);

document.getElementById('btn-add-alarm').addEventListener('click', ()=> openEditor(null));
document.getElementById('btn-editor-back').addEventListener('click', ()=>{ renderList(); showScreen('screen-list'); });

document.getElementById('btn-save-alarm').addEventListener('click', ()=>{
  const time = document.getElementById('input-time').value || '07:00';
  const label = document.getElementById('input-label').value.trim();
  const days = Array.from(document.querySelectorAll('#day-picker button.active')).map(b=>Number(b.dataset.day));
  const challenges = Array.from(document.querySelectorAll('#challenge-picker input:checked')).map(i=>i.value);
  const snoozeEnabled = document.getElementById('input-snooze-enabled').checked;

  if(challenges.length === 0){
    alert('অন্তত একটি চ্যালেঞ্জ বেছে নিন, নইলে অ্যালার্ম বন্ধ করার কোনো উপায় থাকবে না।');
    return;
  }
  const config = collectEditorConfig();
  if(challenges.includes('pattern') && config.pattern.length < 4){
    alert('প্যাটার্নে অন্তত ৪টি বিন্দু বাছাই করুন।');
    return;
  }
  if(challenges.includes('password') && !config.password){
    alert('একটি পাসওয়ার্ড লিখুন।');
    return;
  }

  let savedAlarm;
  if(editingId){
    savedAlarm = alarms.find(x=>x.id===editingId);
    Object.assign(savedAlarm, { time, label, days, challenges, config, snoozeEnabled });
  } else {
    savedAlarm = blankAlarm();
    Object.assign(savedAlarm, { time, label, days, challenges, config, snoozeEnabled });
    alarms.push(savedAlarm);
  }
  saveAlarms(alarms);
  scheduleAlarmNotifications(savedAlarm);
  renderList();
  showScreen('screen-list');
});

document.getElementById('btn-delete-alarm').addEventListener('click', ()=>{
  if(!editingId) return;
  if(!confirm('এই অ্যালার্মটি মুছে ফেলবেন?')) return;
  const removed = alarms.find(a=>a.id===editingId);
  if(removed) cancelAlarmNotifications(removed);
  alarms = alarms.filter(a=>a.id!==editingId);
  saveAlarms(alarms);
  renderList();
  showScreen('screen-list');
});

/* ---------------- Alarm sound (Web Audio, no external file needed) ---------------- */
const AlarmSound = (()=>{
  let ctx=null, timer=null, running=false;
  function beepBurst(){
    if(!ctx) return;
    const now = ctx.currentTime;
    [0,0.18].forEach(offset=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now+offset);
      gain.gain.setValueAtTime(0.0001, now+offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now+offset+0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now+offset+0.15);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now+offset); osc.stop(now+offset+0.16);
    });
  }
  return {
    start(){
      if(running) return;
      running = true;
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      beepBurst();
      timer = setInterval(beepBurst, 700);
      if(navigator.vibrate) navigator.vibrate([500,300,500,300,500,300,500], );
      window._vibrateLoop = setInterval(()=>{ if(navigator.vibrate) navigator.vibrate([500,300]); }, 1600);
    },
    stop(){
      running = false;
      if(timer) clearInterval(timer);
      if(window._vibrateLoop) clearInterval(window._vibrateLoop);
      if(navigator.vibrate) navigator.vibrate(0);
      if(ctx){ ctx.close(); ctx=null; }
    }
  };
})();

/* ---------------- Firing / challenge engine ---------------- */
let firing = null; // { alarm, queueIndex, wakeLock }

function fireAlarm(alarm){
  firing = { alarm, queueIndex: 0 };
  document.getElementById('alarm-firing-label').textContent = alarm.label || 'অ্যালার্ম';
  updateClockDisplay();
  AlarmSound.start();
  requestWakeLock();
  showScreen('screen-alarm');
  renderCurrentChallenge();
}

function updateClockDisplay(){
  const d = new Date();
  document.getElementById('alarm-current-time').textContent =
    String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
setInterval(updateClockDisplay, 1000*15);

async function requestWakeLock(){
  try{
    if('wakeLock' in navigator){ firing.wakeLock = await navigator.wakeLock.request('screen'); }
  }catch(e){ /* not fatal — just means the screen may sleep during the alarm */ }
}
function releaseWakeLock(){
  if(firing && firing.wakeLock){ firing.wakeLock.release().catch(()=>{}); }
}

function renderCurrentChallenge(){
  const stage = document.getElementById('challenge-stage');
  stage.innerHTML = '';
  const { alarm, queueIndex } = firing;
  const total = alarm.challenges.length;

  const dots = document.createElement('div');
  dots.className = 'step-dots';
  alarm.challenges.forEach((c,i)=>{
    const s = document.createElement('span');
    if(i < queueIndex) s.classList.add('done');
    else if(i === queueIndex) s.classList.add('current');
    dots.appendChild(s);
  });
  stage.appendChild(dots);

  const type = alarm.challenges[queueIndex];
  const renderer = CHALLENGE_RENDERERS[type];
  const block = document.createElement('div');
  block.style.display='flex'; block.style.flexDirection='column'; block.style.gap='16px';
  stage.appendChild(block);
  renderer(block, alarm.config, ()=>advanceChallenge());
}

function advanceChallenge(){
  firing.queueIndex++;
  if(firing.queueIndex >= firing.alarm.challenges.length){
    completeDismiss();
  } else {
    renderCurrentChallenge();
  }
}

function completeDismiss(){
  AlarmSound.stop();
  releaseWakeLock();
  firing = null;
  renderList();
  showScreen('screen-list');
}

document.getElementById('btn-snooze').addEventListener('click', ()=>{
  if(!firing) return;
  if(firing.alarm.snoozeEnabled === false){
    alert('এই অ্যালার্মে স্নুজ বন্ধ করা আছে — চ্যালেঞ্জ শেষ করেই বন্ধ করতে হবে।');
    return;
  }
  const alarmRef = firing.alarm;
  AlarmSound.stop();
  releaseWakeLock();
  firing = null;
  renderList();
  showScreen('screen-list');
  setTimeout(()=>{ fireAlarm(alarmRef); }, 5*60*1000);
});

/* ---------------- Challenge renderers ---------------- */
const CHALLENGE_RENDERERS = {

  type_phrase(block, cfg, done){
    block.innerHTML = `
      <div class="stage-heading">নিচের বাক্যটি হুবহু টাইপ করুন:</div>
      <div class="phrase-target">${escapeHtml(cfg.phrase)}</div>
      <input type="text" class="stage-input" id="cx-phrase-input" autocomplete="off" autocapitalize="off" placeholder="এখানে টাইপ করুন">
      <div class="stage-feedback" id="cx-phrase-fb"></div>
      <button class="stage-btn" id="cx-phrase-go">নিশ্চিত করুন</button>`;
    const check = ()=>{
      const val = block.querySelector('#cx-phrase-input').value.trim().toLowerCase();
      const target = cfg.phrase.trim().toLowerCase();
      const fb = block.querySelector('#cx-phrase-fb');
      if(val === target){ fb.textContent = 'ঠিক আছে!'; fb.className='stage-feedback ok'; done(); }
      else { fb.textContent = 'মিলছে না, আবার চেষ্টা করুন।'; fb.className='stage-feedback err'; }
    };
    block.querySelector('#cx-phrase-go').addEventListener('click', check);
  },

  speak_phrase(block, cfg, done){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    block.innerHTML = `
      <div class="stage-heading">জোরে বলুন:</div>
      <div class="phrase-target">${escapeHtml(cfg.phrase)}</div>
      <button class="stage-btn" id="cx-speak-go">🎙️ বলা শুরু করুন</button>
      <div class="stage-feedback" id="cx-speak-fb"></div>`;
    if(!SR){
      block.querySelector('#cx-speak-fb').innerHTML = 'এই ডিভাইসে ভয়েস রিকগনিশন সমর্থিত নয়। এর বদলে টাইপ করুন:';
      block.querySelector('#cx-speak-go').style.display='none';
      const inp = document.createElement('input');
      inp.className='stage-input'; inp.placeholder='এখানে টাইপ করুন';
      const btn = document.createElement('button');
      btn.className='stage-btn'; btn.textContent='নিশ্চিত করুন';
      block.appendChild(inp); block.appendChild(btn);
      btn.addEventListener('click', ()=>{
        if(inp.value.trim().toLowerCase() === cfg.phrase.trim().toLowerCase()) done();
        else { inp.classList.add('error'); }
      });
      return;
    }
    block.querySelector('#cx-speak-go').addEventListener('click', async ()=>{
      const fb = block.querySelector('#cx-speak-fb');
      fb.textContent = 'মাইক্রোফোন পারমিশন চাওয়া হচ্ছে...'; fb.className='stage-feedback';
      // WebView-তে SpeechRecognition.start() নিজে থেকে রানটাইম মাইক পারমিশন
      // ডায়ালগ দেখায় না — তাই আগে getUserMedia দিয়ে সরাসরি চাওয়া হচ্ছে।
      try{
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t=>t.stop());
      }catch(permErr){
        fb.textContent = 'মাইক্রোফোন পারমিশন দেওয়া হয়নি। ফোনের Settings → Apps → Wakeup Guard → Permissions থেকে Microphone অন করে আবার চেষ্টা করুন।';
        fb.className='stage-feedback err';
        return;
      }
      fb.textContent = 'শুনছি...'; fb.className='stage-feedback';
      const rec = new SR();
      rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false;
      rec.onresult = (e)=>{
        const heard = e.results[0][0].transcript.trim().toLowerCase();
        const targetWords = cfg.phrase.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(Boolean);
        const heardWords = heard.replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(Boolean);
        const matched = targetWords.filter(w=>heardWords.includes(w)).length;
        const ratio = matched / targetWords.length;
        if(ratio >= 0.7){ fb.textContent = `শোনা গেছে: "${heard}" — ঠিক আছে!`; fb.className='stage-feedback ok'; done(); }
        else { fb.textContent = `শোনা গেছে: "${heard}" — মিলেনি, আবার চেষ্টা করুন।`; fb.className='stage-feedback err'; }
      };
      rec.onerror = (e)=>{
        // 'not-allowed'/'service-not-allowed' = পারমিশন সমস্যা। অন্য কোড
        // (যেমন 'network') এলে সেটা এই ডিভাইসের WebView-তে Speech
        // Recognition backend আদৌ কাজ না করার লক্ষণ — এটা একটা পরিচিত
        // WebView সীমাবদ্ধতা, শুধু পারমিশন ঠিক করে সমাধান নাও হতে পারে।
        const code = e && e.error;
        fb.textContent = (code === 'not-allowed' || code === 'service-not-allowed')
          ? 'মাইক্রোফোন পারমিশন এখনো দেওয়া নেই।'
          : `ভয়েস রিকগনিশন এই ডিভাইসে কাজ করছে না (${code || 'unknown'})। এই চ্যালেঞ্জ বাদ দিয়ে টাইপ/পাসওয়ার্ড/অংক ব্যবহার করুন।`;
        fb.className='stage-feedback err';
      };
      try{ rec.start(); }catch(e){ fb.textContent = 'শুরু করা যায়নি, আবার চাপুন।'; }
    });
  },

  password(block, cfg, done){
    block.innerHTML = `
      <div class="stage-heading">পাসওয়ার্ড দিন:</div>
      <input type="password" class="stage-input" id="cx-pass-input" placeholder="পাসওয়ার্ড">
      <div class="stage-feedback" id="cx-pass-fb"></div>
      <button class="stage-btn" id="cx-pass-go">নিশ্চিত করুন</button>`;
    block.querySelector('#cx-pass-go').addEventListener('click', ()=>{
      const fb = block.querySelector('#cx-pass-fb');
      if(block.querySelector('#cx-pass-input').value === cfg.password){ fb.textContent='ঠিক আছে!'; fb.className='stage-feedback ok'; done(); }
      else { fb.textContent='ভুল পাসওয়ার্ড।'; fb.className='stage-feedback err'; }
    });
  },

  math(block, cfg, done){
    const diffRanges = { easy:[1,20], medium:[10,99], hard:[50,999] };
    const [lo,hi] = diffRanges[cfg.mathDifficulty] || diffRanges.medium;
    let remaining = 3;
    function rnd(){ return Math.floor(Math.random()*(hi-lo+1))+lo; }
    function newProblem(){
      const a=rnd(), b=rnd();
      const ops = cfg.mathDifficulty==='hard' ? ['+','-','×'] : ['+','-'];
      const op = ops[Math.floor(Math.random()*ops.length)];
      const answer = op==='+' ? a+b : op==='-' ? a-b : a*b;
      block.innerHTML = `
        <div class="stage-heading">অংক সমাধান করুন (বাকি ${remaining})</div>
        <div class="phrase-target" style="font-size:26px;font-weight:800;">${a} ${op} ${b} = ?</div>
        <input type="number" class="stage-input" id="cx-math-input" placeholder="উত্তর">
        <div class="stage-feedback" id="cx-math-fb"></div>
        <button class="stage-btn" id="cx-math-go">জমা দিন</button>`;
      block.querySelector('#cx-math-go').addEventListener('click', ()=>{
        const val = Number(block.querySelector('#cx-math-input').value);
        const fb = block.querySelector('#cx-math-fb');
        if(val === answer){
          remaining--;
          if(remaining <= 0){ fb.textContent='সব ঠিক!'; fb.className='stage-feedback ok'; setTimeout(done, 250); }
          else newProblem();
        } else { fb.textContent='ভুল উত্তর, আবার চেষ্টা করুন।'; fb.className='stage-feedback err'; }
      });
    }
    newProblem();
  },

  shake(block, cfg, done){
    let count = 0, lastMag = 0, lastShakeTime = 0;
    block.innerHTML = `
      <div class="stage-heading">ফোনটি জোরে ঝাঁকান — লাগবে <b>${cfg.shakeCount}</b> বার</div>
      <div class="progress-track"><div class="progress-fill" id="cx-shake-fill"></div></div>
      <div class="stage-feedback" id="cx-shake-fb">০ / ${cfg.shakeCount}</div>`;
    function onMotion(e){
      const a = e.accelerationIncludingGravity || e.acceleration;
      if(!a) return;
      const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
      const delta = Math.abs(mag - lastMag);
      lastMag = mag;
      const now = Date.now();
      if(delta > 12 && now - lastShakeTime > 250){
        lastShakeTime = now;
        count++;
        const pct = Math.min(100, (count/cfg.shakeCount)*100);
        const fill = document.getElementById('cx-shake-fill');
        if(fill) fill.style.width = pct+'%';
        const fb = document.getElementById('cx-shake-fb');
        if(fb) fb.textContent = `${count} / ${cfg.shakeCount}`;
        if(count >= cfg.shakeCount){
          window.removeEventListener('devicemotion', onMotion);
          done();
        }
      }
    }
    if(typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function'){
      DeviceMotionEvent.requestPermission().then(state=>{
        if(state === 'granted') window.addEventListener('devicemotion', onMotion);
        else block.querySelector('#cx-shake-fb').textContent = 'মোশন সেন্সরের অনুমতি দেওয়া হয়নি।';
      }).catch(()=>{ window.addEventListener('devicemotion', onMotion); });
    } else {
      window.addEventListener('devicemotion', onMotion);
    }
    firing._cleanup = ()=> window.removeEventListener('devicemotion', onMotion);
  },

  hold(block, cfg, done){
    let holding=false, elapsed=0, raf=null, last=0;
    block.innerHTML = `
      <div class="stage-heading">বাটনটি ${cfg.holdSeconds} সেকেন্ড চেপে ধরে রাখুন</div>
      <button class="hold-btn" id="cx-hold-btn">চেপে ধরুন</button>
      <div class="progress-track"><div class="progress-fill" id="cx-hold-fill"></div></div>`;
    const btn = block.querySelector('#cx-hold-btn');
    const fill = block.querySelector('#cx-hold-fill');
    function tick(ts){
      if(!holding) return;
      if(!last) last = ts;
      elapsed += (ts-last)/1000;
      last = ts;
      const pct = Math.min(100, (elapsed/cfg.holdSeconds)*100);
      fill.style.width = pct+'%';
      if(elapsed >= cfg.holdSeconds){ done(); return; }
      raf = requestAnimationFrame(tick);
    }
    function start(){ holding=true; last=0; raf=requestAnimationFrame(tick); btn.textContent='ধরে থাকুন...'; }
    function stop(){ holding=false; elapsed=0; fill.style.width='0%'; btn.textContent='চেপে ধরুন'; if(raf) cancelAnimationFrame(raf); }
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
  },

  pattern(block, cfg, done){
    let picked = [];
    block.innerHTML = `
      <div class="stage-heading">সংরক্ষিত প্যাটার্নটি আঁকুন</div>
      <div class="pattern-grid" id="cx-pattern-grid"></div>
      <div class="stage-feedback" id="cx-pattern-fb"></div>`;
    const grid = block.querySelector('#cx-pattern-grid');
    const dots = [];
    for(let i=0;i<9;i++){
      const d = document.createElement('div');
      d.className='pattern-dot';
      dots.push(d);
      d.addEventListener('click', ()=>{
        if(picked.includes(i)) return;
        picked.push(i);
        d.classList.add('picked');
        d.textContent = picked.length;
        if(picked.length === cfg.pattern.length){
          const fb = block.querySelector('#cx-pattern-fb');
          if(JSON.stringify(picked) === JSON.stringify(cfg.pattern)){
            fb.textContent='ঠিক আছে!'; fb.className='stage-feedback ok'; done();
          } else {
            fb.textContent='প্যাটার্ন মেলেনি, আবার চেষ্টা করুন।'; fb.className='stage-feedback err';
            picked = [];
            dots.forEach(x=>{ x.classList.remove('picked'); x.textContent=''; });
          }
        }
      });
      grid.appendChild(d);
    }
  },

  face(block, cfg, done){
    block.innerHTML = `
      <div class="stage-heading">ক্যামেরার সামনে থাকুন</div>
      <video id="cx-face-video" class="face-video" autoplay playsinline muted></video>
      <div class="face-note">এটি প্রকৃত ফেস-রিকগনিশন নয়, শুধু লাইভনেস চেক — ক্যামেরা চালু থাকা অবস্থায় কয়েক সেকেন্ড অপেক্ষা করুন। কোনো ছবি সংরক্ষিত হয় না।</div>
      <div class="stage-feedback" id="cx-face-fb">ক্যামেরা চালু হচ্ছে...</div>
      <button class="stage-btn" id="cx-face-go" style="display:none;">আমি জেগে আছি, নিশ্চিত করুন</button>`;
    const video = block.querySelector('#cx-face-video');
    let stream = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }).then(s=>{
      stream = s; video.srcObject = s;
      block.querySelector('#cx-face-fb').textContent = 'ক্যামেরা সক্রিয় — অন্তত ৩ সেকেন্ড ফ্রেমে থাকুন।';
      setTimeout(()=>{
        block.querySelector('#cx-face-go').style.display = 'block';
        block.querySelector('#cx-face-fb').textContent = 'ঠিক আছে, এবার নিচের বাটনে চাপুন।';
      }, 3000);
    }).catch(()=>{
      block.querySelector('#cx-face-fb').textContent = 'ক্যামেরা চালু করা যায়নি বা অনুমতি নেই। বাটনে চেপেই এগিয়ে যান।';
      block.querySelector('#cx-face-go').style.display = 'block';
    });
    block.querySelector('#cx-face-go').addEventListener('click', ()=>{
      if(stream) stream.getTracks().forEach(t=>t.stop());
      done();
    });
  }
};

/* ---------------- Day picker toggle ---------------- */
document.getElementById('day-picker').addEventListener('click', e=>{
  if(e.target.tagName === 'BUTTON') e.target.classList.toggle('active');
});

/* ---------------- OS-level scheduling (screen-off / background firing) ----------------
   Plain JS timers (below) only run while this screen is open. To have a
   real chance of firing with the screen off or the app backgrounded, we
   also schedule an actual Android notification via @capacitor/local
   -notifications, which Android's own OS timer (not our JS) is
   responsible for delivering. This is the best available option without
   writing custom native Android code — it is NOT guaranteed to be as
   instant/reliable as a stock alarm-clock app, and I have not been able
   to test it myself (no Android device / network in my working
   environment). See README "স্ক্রিন বন্ধ থাকলেও অ্যালার্ম বাজানো" for
   setup steps and what to verify on your device. */

function hash32(str){
  let h = 0;
  for(let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) | 0; }
  return Math.abs(h) % 2147483647;
}
function getLN(){
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
}
async function ensureNotificationPermission(){
  const LN = getLN();
  if(!LN) return;
  try{
    const perm = await LN.checkPermissions();
    if(perm.display !== 'granted') await LN.requestPermissions();
  }catch(e){ console.warn('notification permission check failed', e); }
}
function notifIdsFor(alarm){
  return alarm.days.length === 0
    ? [hash32(alarm.id + '_once')]
    : alarm.days.map(d => hash32(alarm.id + '_d' + d));
}
async function cancelAlarmNotifications(alarm){
  const LN = getLN();
  if(!LN) return;
  try{ await LN.cancel({ notifications: notifIdsFor(alarm).map(id=>({id})) }); }
  catch(e){ /* nothing scheduled yet — fine */ }
}
async function scheduleAlarmNotifications(alarm){
  const LN = getLN();
  if(!LN) return;
  await cancelAlarmNotifications(alarm);
  if(!alarm.enabled) return;
  const [hh, mm] = alarm.time.split(':').map(Number);
  const body = 'বন্ধ করতে অ্যাপ খুলে চ্যালেঞ্জ সম্পন্ন করুন';
  let notifications = [];
  if(alarm.days.length === 0){
    const now = new Date();
    const at = new Date(); at.setHours(hh, mm, 0, 0);
    if(at <= now) at.setDate(at.getDate() + 1);
    notifications = [{
      id: hash32(alarm.id + '_once'),
      title: alarm.label || 'অ্যালার্ম',
      body,
      schedule: { at, allowWhileIdle: true },
      extra: { alarmId: alarm.id }
    }];
  } else {
    notifications = alarm.days.map(d => ({
      id: hash32(alarm.id + '_d' + d),
      title: alarm.label || 'অ্যালার্ম',
      body,
      schedule: { on: { weekday: d + 1, hour: hh, minute: mm }, allowWhileIdle: true, repeats: true },
      extra: { alarmId: alarm.id }
    }));
  }
  try{ await LN.schedule({ notifications }); }
  catch(e){ console.warn('LocalNotifications.schedule failed', e); }
}
function setupNotificationListener(){
  const LN = getLN();
  if(!LN) return;
  LN.addListener('localNotificationActionPerformed', (data)=>{
    try{
      const alarmId = data.notification && data.notification.extra && data.notification.extra.alarmId;
      const a = alarms.find(x=>x.id===alarmId);
      if(a) fireAlarm(a);
    }catch(e){ console.warn('notification tap handling failed', e); }
  });
}

/* ---------------- Main clock loop: checks real alarms once per second ----------------
   IMPORTANT (read README "Known limitations"): this only fires while
   this screen is open and the app is in the foreground. Plain web JS
   timers are throttled or fully stopped by Android once the app is
   backgrounded or the screen locks — there is no way around that
   without native OS alarm scheduling (AlarmManager), which is outside
   what a bundler-free Capacitor+web app can do. */
const firedToday = {};
setInterval(()=>{
  if(firing) return; // already showing a challenge
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const current = `${hh}:${mm}`;
  const dow = now.getDay();
  const dateKey = now.toDateString();

  alarms.forEach(a=>{
    if(!a.enabled) return;
    if(a.time !== current) return;
    const repeatOk = a.days.length === 0 ? true : a.days.includes(dow);
    if(!repeatOk) return;
    const fireKey = a.id + '_' + dateKey;
    if(firedToday[fireKey]) return;
    firedToday[fireKey] = true;
    fireAlarm(a);
  });
}, 1000);

/* ---------------- Init ---------------- */
renderList();
showScreen('screen-list');
ensureNotificationPermission();
setupNotificationListener();
alarms.forEach(a => scheduleAlarmNotifications(a));
