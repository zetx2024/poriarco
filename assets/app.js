(() => {
"use strict";

const ROOT=document.getElementById("app");
const SESSION_KEY="iarco_portal_session_zv5";
const ROUTE_KEY="iarco_portal_route_zv5";
const state={user:null,users:[],modules:[],timeline:[],config:null,loaded:false};

function esc(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function loadJSON(path){
  const response=await fetch(path,{cache:"no-store"});
  if(!response.ok) throw new Error("Could not load "+path);
  return response.json();
}

async function hashCredential(value){
  const encoder=new TextEncoder();
  const keyMaterial=await crypto.subtle.importKey(
    "raw",
    encoder.encode(value),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits=await crypto.subtle.deriveBits(
    {name:"PBKDF2",hash:"SHA-256",salt:encoder.encode("iamgp5"),iterations:100000},
    keyMaterial,
    512
  );
  return Array.from(new Uint8Array(derivedBits),b=>b.toString(16).padStart(2,"0")).join("");
}

async function prefetchPortalData(){
  if(state.loaded) return;
  const [users,timeline,modules,config]=await Promise.all([loadJSON("data/users.json"),loadJSON("data/timeline.json"),loadJSON("data/modules.json"),loadJSON("data/config.json")]);
  state.users=users;
  state.timeline=timeline;
  state.modules=modules;
  state.config=config||{};
  state.loaded=true;
}

function showLoader(message="Loading your portal…"){
  ROOT.innerHTML=`<div class="portal-loader" role="status" aria-live="polite">
    <div class="loader-card">
      <div class="loader-logo">${esc(cfg().brand||"IARCO 2026")}</div>
      <div class="spinner"></div>
      <h2>${esc(message)}</h2>
      <p class="muted">Preparing your dashboard, timeline and competition resources.</p>
    </div>
  </div>`;
}

function getSession(){
  try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null");}catch{return null;}
}

function logout(){
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ROUTE_KEY);
  state.user=null;
  location.hash="";
  renderLogin();
}


function cfg(){return state.config||{year:"2026",brand:"IARCO 2026",sponsors:[],notice:"",faqUrl:"#",supportEmail:"iarco2026@yrjmail.com"};}
function sponsorHTML(){
  const a=(cfg().sponsors||[]).filter(x=>x&&x.name);
  const l=a.map(x=>`<a class="sponsor-link" href="${esc(x.url||"#")}" target="_blank" rel="noopener noreferrer">${esc(x.name)}</a>`);
  return l.length===0?"":l.length===1?l[0]:l.slice(0,-1).join(", ")+" &amp; "+l[l.length-1];
}
function sponsorLogoItems(){
  const configured=Array.isArray(cfg().sponsorLogos)&&cfg().sponsorLogos.length?cfg().sponsorLogos:[];
  const legacy=(cfg().sponsors||[]).filter(x=>x&&x.logo).map(x=>({name:x.name,url:x.url,logo:x.logo}));
  return (configured.length?configured:legacy).filter(x=>x&&x.logo);
}
function sponsorHeaderHTML(){
  const logos=sponsorLogoItems();
  return `<header class="sponsor-header" aria-label="Sponsors">
    <div class="sponsor-header-title">
      <div class="sponsor-brand">${esc(cfg().brand||`IARCO ${cfg().year||""}`)}</div>
      <div class="sponsor-sponsored">Sponsored by</div>
    </div>
    <div class="sponsor-logo-list">
      ${logos.length?logos.map(x=>`<a class="sponsor-logo" href="${esc(x.url||"#")}" target="_blank" rel="noopener noreferrer" title="${esc(x.name||"Sponsor")}">
        <img src="${esc(x.logo)}" alt="${esc(x.name||"Sponsor")}">
      </a>`).join(""):`<span class="sponsor-logo-text">Sponsors</span>`}
    </div>
  </header>`;
}
function formatDeadline(v){const d=new Date(v);if(isNaN(d))return v;const ms=["January","February","March","April","May","June","July","August","September","October","November","December"];let h=d.getUTCHours(),ap=h>=12?"PM":"AM";h=h%12||12;return `${ms[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${h}:${String(d.getUTCMinutes()).padStart(2,"0")} ${ap} `;}
function submissionModal(item){
  if(!item) return;

  const existing=document.getElementById("submissionModal");
  if(existing) existing.remove();

  const modal=document.createElement("div");
  modal.id="submissionModal";
  modal.className="modal-backdrop";
  modal.setAttribute("role","presentation");

  const rules=Array.isArray(item.rules)?item.rules:[];
  const submitUrl=String(item.submitUrl||"").trim();

  modal.innerHTML=`
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="submissionModalTitle">
      <button type="button" class="modal-close" id="submissionModalClose" aria-label="Close">×</button>

      <h2 id="submissionModalTitle">
        ${esc(item.title||"Assignment Submission")}
      </h2>

      <p class="muted">
        Please review the following instructions before opening the submission form.
      </p>

      ${
        rules.length
          ? `<ul class="modal-rules">${rules.map(rule=>`<li>${esc(rule)}</li>`).join("")}</ul>`
          : `<p class="muted">Please make sure your submission follows the official assignment requirements.</p>`
      }

      <label class="confirm-row">
        <input type="checkbox" id="submissionConfirm">
        <span>I have reviewed the instructions and I am ready to continue.</span>
      </label>

      <div class="modal-actions">
        <button type="button" class="btn secondary" id="submissionCancel">
          Cancel
        </button>

        <button
          type="button"
          class="btn"
          id="submissionContinue"
          ${submitUrl ? "" : "disabled"}
        >
          Final Submission →
        </button>
      </div>

      ${
        !submitUrl
          ? `<p class="error small">The submission link is not currently configured.</p>`
          : ""
      }
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add("modal-open");

  const close=()=>{
    modal.remove();
    document.body.classList.remove("modal-open");
  };

  document.getElementById("submissionModalClose").addEventListener("click",close);
  document.getElementById("submissionCancel").addEventListener("click",close);

  modal.addEventListener("click",event=>{
    if(event.target===modal) close();
  });

  const checkbox=document.getElementById("submissionConfirm");
  const submitButton=document.getElementById("submissionContinue");

  checkbox.addEventListener("change",()=>{
    submitButton.disabled=!checkbox.checked || !submitUrl;
  });

  submitButton.addEventListener("click",()=>{
    if(!checkbox.checked || !submitUrl) return;

    window.open(submitUrl,"_blank","noopener,noreferrer");
    close();
  });

  document.addEventListener("keydown",function escapeHandler(event){
    if(event.key==="Escape"){
      close();
      document.removeEventListener("keydown",escapeHandler);
    }
  },{once:true});

  requestAnimationFrame(()=>{
    checkbox.focus();
  });
}

function noticeKey(value){
  const text=String(value||'').trim();
  let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16);
}
function noticeHTML(){
  const n=String(cfg().notice||'').trim();
  if(!n)return '';
  const currentKey=noticeKey(n);
  return sessionStorage.getItem('notice_closed_v7')===currentKey?'':`<div class="site-notice" id="siteNotice" role="status" aria-label="Portal notice"><span>${esc(n)}</span><button id="closeNotice" type="button" aria-label="Close notice">×</button></div>`;
}
function syncChromeOffset(){
  const notice=document.getElementById('siteNotice');
  const sponsor=document.querySelector('.sponsor-header');
  const noticeHeight=notice?notice.offsetHeight:0;
  const sponsorHeight=sponsor?sponsor.offsetHeight:0;
  document.documentElement.style.setProperty('--notice-height',`${noticeHeight}px`);
  document.documentElement.style.setProperty('--sponsor-height',`${sponsorHeight}px`);
  document.documentElement.style.setProperty('--chrome-height',`${noticeHeight+sponsorHeight}px`);
  document.body.classList.toggle('notice-open',!!notice);
}
function bindChrome(){
  const close=document.getElementById('closeNotice');
  close?.addEventListener('click',()=>{
    sessionStorage.setItem('notice_closed_v7',noticeKey(String(cfg().notice||'').trim()));
    document.getElementById('siteNotice')?.remove();
    syncChromeOffset();
  });
  requestAnimationFrame(syncChromeOffset);
}
function watermarkPath(){
  const p=String(state.config?.watermarkLogo||"").trim();
  return p || "assets/logo-watermark.svg";
}

function renderLogin(message=""){
  ROOT.innerHTML=`<div class="login-wrap"><div class="login-card">
    <div class="brand">${esc(cfg().brand||`IARCO ${cfg().year||""}`)}</div>
    <p class="muted">IARCO Bootcamp Portal</p>
    <form id="loginForm">
      <div class="field"><label for="loginEmail">Email</label><input id="loginEmail" type="email" autocomplete="username" required></div>
      <div class="field password-field"><label for="loginPassword">Password</label><div class="password-input-wrap"><input id="loginPassword" type="password" autocomplete="current-password" required><button type="button" class="password-toggle" id="togglePassword" aria-label="Show password" aria-pressed="false" title="Show password">👁</button></div></div>
      ${message?`<div class="error">${esc(message)}</div>`:""}
      <button class="btn" id="loginButton" style="width:100%;margin-top:16px">Login</button>
    </form>
    <p class="muted small">IARCO 2026 Sponsored by <a class="sponsor-link" href="https://www.savemyexams.com/" target="_blank" rel="noopener noreferrer">SaveMyExams</a> &amp; <a class="sponsor-link" href="https://domain.me/" target="_blank" rel="noopener noreferrer">Domain.Me</a></p>
  </div></div>`;

  document.getElementById("togglePassword").addEventListener("click",()=>{
    const input=document.getElementById("loginPassword");
    const button=document.getElementById("togglePassword");
    const visible=input.type==="text";
    input.type=visible?"password":"text";
    button.textContent=visible?"👁":"🙈";
    button.setAttribute("aria-label",visible?"Show password":"Hide password");
    button.setAttribute("title",visible?"Show password":"Hide password");
    button.setAttribute("aria-pressed",String(!visible));
  });

  document.getElementById("loginForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const button=document.getElementById("loginButton");
    const email=document.getElementById("loginEmail").value.trim().toLowerCase();
    const password=document.getElementById("loginPassword").value.trim();
    button.disabled=true;
    button.innerHTML='<span class="button-spinner"></span> Loading…';

    try{
      await prefetchPortalData();
      const [emailHash,passwordHash]=await Promise.all([
        hashCredential(email),
        hashCredential(password)
      ]);
      const user=state.users.find(u=>
        String(u.email_hash||"").toLowerCase()===emailHash &&
        String(u.password_hash||"").toLowerCase()===passwordHash
      );
      if(!user){renderLogin("Invalid email or password.");return;}

      state.user={
        email:user.email,
        name:user.name,
        institution:user.institution,
        category:user.category,
        country:user.country,
        languages:Array.isArray(user.languages)?user.languages:[user.language].filter(Boolean)
      };
      localStorage.setItem(SESSION_KEY,JSON.stringify(state.user));
      sessionStorage.removeItem(ROUTE_KEY);
      location.hash="";
      showLoader("Preparing your dashboard…");
      setTimeout(()=>{renderDashboard();showQuickIntroIfNeeded();},350);
    }catch(error){
      console.error(error);
      renderLogin("Unable to load portal data. Please try again.");
    }
  });
}

function countdownText(date){
  let ms=new Date(date).getTime()-Date.now();
  if(ms<=0)return"Deadline passed";
  let s=Math.floor(ms/1000);
  const d=Math.floor(s/86400);s%=86400;
  const h=Math.floor(s/3600);s%=3600;
  const m=Math.floor(s/60);s%=60;
  return `Time left: ${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
}

function updateCountdowns(){
  document.querySelectorAll("[data-deadline]").forEach(el=>el.textContent=countdownText(el.dataset.deadline));
}

function timelineSidebarHTML(){return state.timeline.length?state.timeline.map((x,i)=>`<div class="timeline-item"><h4>${esc(x.title)}</h4><div class="deadline-label">Deadline: ${esc(formatDeadline(x.date))}</div><div class="countdown" data-deadline="${esc(x.date)}">${countdownText(x.date)}</div><div class="timeline-actions compact"><button class="side-action side-submit" type="button" data-timeline="${i}">${esc(x.submitLabel||"Submit")}</button><a class="side-action" target="_blank" rel="noopener noreferrer" href="${esc(x.rulesUrl||'#')}">${esc(x.rulesLabel||"Rules")}</a></div></div>`).join(''):'<div class="muted small">No timeline items.</div>';}
function timelineMainHTML(){
  return state.timeline.length?`<section class="timeline-main"><h2>Competition Timeline</h2>
    <p class="muted">Countdown uses fixed Time.</p>
    <div class="deadline-grid">${state.timeline.map(x=>`<article class="deadline-row">
      <h3>${esc(x.title)}</h3>
      <div class="deadline-time" data-deadline="${esc(x.date)}">${countdownText(x.date)}</div>
      <div class="deadline-meta">Deadline: ${esc(formatDeadline(x.date))}</div>
      <p class="muted">${esc(x.description)}</p>
      <div class="actions"><button class="btn main-submit" data-timeline="${state.timeline.indexOf(x)}">${esc(x.submitLabel||"Submit")}</button>
      <a class="btn secondary" target="_blank" rel="noopener noreferrer" href="${esc(x.rulesUrl)}">${esc(x.rulesLabel)}</a></div>
    </article>`).join("")}</div>
  </section>`:"";
}

function shell(content){
  ROOT.innerHTML=`${noticeHTML()}${sponsorHeaderHTML()}<div class="shell"><aside class="sidebar">
    <div class="brand">${esc(cfg().brand||`IARCO ${cfg().year||""}`)}</div>
    <div style="color:#d0d5dd">${esc(state.user.name)}</div>
    <div class="side-title">Competition Timeline</div>
    <div class="timeline">${timelineSidebarHTML()}</div>
    <div class="support-box"><b>Need help?</b><p class="small">If you have any question first visit our <a class="side-link" href="${esc(cfg().faqUrl||"https://iarco.org/faq")}" target="_blank" rel="noopener noreferrer">FAQ</a> section then email <a class="side-link" href="mailto:${esc(cfg().supportEmail)}">${esc(cfg().supportEmail)}</a>.</p></div><div class="sidebar-logout"><button class="btn danger logout-small" id="logoutBtn" type="button">Logout</button></div>
  </aside><main class="main">${content}</main></div>`;
  document.getElementById("logoutBtn").onclick=logout; bindChrome(); document.querySelectorAll(".side-submit,.main-submit").forEach(b=>b.onclick=()=>submissionModal(state.timeline[+b.dataset.timeline]));
  updateCountdowns();
  bindMotionEffects();
}

function showQuickIntroIfNeeded(){
  const key=`iarco_intro_seen_v5_${state.user.email}`;
  if(localStorage.getItem(key)==="1")return;
  const overlay=document.createElement("div");
  overlay.className="intro-overlay";
  overlay.innerHTML=`<div class="intro-card">
    <div class="intro-progress"><span id="introStepLabel">1 / 3</span></div>
    <div class="intro-step active" data-step="1"><div class="intro-icon">👋</div><h2>Welcome to IARCO 2026</h2><p class="muted">This quick guide explains your bootcamp portal.</p></div>
    <div class="intro-step" data-step="2"><div class="intro-icon">📚</div><h2>Use Next to continue</h2><p class="muted">Click Next on your dashboard to open your assigned modules and languages.</p></div>
    <div class="intro-step" data-step="3"><div class="intro-icon">⏱️</div><h2>Watch your timeline</h2><p class="muted">The sidebar and dashboard contain live submission countdowns, Submit links and Rules.</p></div>
    <div class="intro-actions"><button class="btn secondary" id="introSkip">Skip</button><button class="btn" id="introNext">Next</button></div>
  </div>`;
  document.body.appendChild(overlay);
  let step=1;
  const render=()=>{
    overlay.querySelectorAll(".intro-step").forEach(x=>x.classList.toggle("active",Number(x.dataset.step)===step));
    overlay.querySelector("#introStepLabel").textContent=`${step} / 3`;
    overlay.querySelector("#introNext").textContent=step===3?"Get Started":"Next";
  };
  const close=()=>{localStorage.setItem(key,"1");overlay.remove();};
  overlay.querySelector("#introSkip").onclick=close;
  overlay.querySelector("#introNext").onclick=()=>{if(step===3)close();else{step++;render();}};
}

function renderDashboard(){
  shell(`<div class="topbar"><div><div class="muted">Participant dashboard</div><h2>Welcome, ${esc(state.user.name)}!</h2></div></div>
  <section class="hero"><h1>Welcome to the IARCO 2026 Academic Research Bootcamp</h1>
    <p class="sponsor-line">IARCO 2026 Sponsored by <a href="https://www.savemyexams.com/" target="_blank" rel="noopener noreferrer">SaveMyExams</a> &amp; <a href="https://domain.me/" target="_blank" rel="noopener noreferrer">Domain.Me</a></p>
    <p class="muted">This portal contains your bootcamp bootcamp, research lessons, and submission links.</p>
    <p class="muted">Welcome to your IARCO dashboard, your central hub for mastering research techniques and learning how to craft winning research proposals. To begin, click the "Next" button to view our Introduction, then proceed sequentially through our structured Bootcamp sessions. For your convenience, the bootcamp is available in multiple language tracks: English V1 and Bangla V1 are led by <a href="https://www.azmainsrizon.com/" target="_blank" rel="noopener noreferrer">Azmain Yaking Srizon</a>, Assistant Professor at Rajshahi University of Engineering and Technology (RUET), a renowned researcher, reviewer for top-tier journals such as Springer, IEEE, and Elsevier, host of international conferences with over 150 publications, and mentor to more than 200 Master’s thesis students and 600+ YRJ participants. English V2 is presented by <a href="https://www.linkedin.com/in/dr-karthikeyan-parthasarathy-33473038/" target="_blank" rel="noopener noreferrer">Dr. Karthikeyan Parthasarathy</a>, Professor and Head of Kongu Business School, who brings over 24 years of distinguished experience in management education, more than 130 research publications, extensive global academic engagements, and a track record of guiding over 100 Ph.D. scholars. Organized by YRJ President <a href="https://iarco.org/sanaul-haque" target="_blank" rel="noopener noreferrer">Sanaul Haque</a> and hosted by Zaima Haque, whose vibrant energy elevates the entire experience, IARCO 2026 is designed to guide you toward research excellence step by step.</p>
    <p class="muted">After completing the Research Bootcamp lectures, which are optional if you already know the material or just want to skim for IARCO information, you can take the Research Assessment to earn your Participation Certificate. The secure assessment portal opens on September 10 for five days and features a single attempt multiple choice test on basic research fundamentals that you can complete at any time within that deadline. You will receive your participation certificate regardless of your score and you can download it directly from the portal or receive it via email. Please note that the assessment environment is strictly monitored so switching windows, copy pasting or using keyboard shortcuts will automatically disqualify your certificate. Even if that happens you can still submit your research proposal since it is the main focus of the competition. Make sure to review the <a href="https://iarco.org/judging" target="_blank" rel="noopener noreferrer">Research Judging Rubrics</a> and <a href="https://iarco.org/assets/doc/proposal_rubric.pdf" target="_blank" rel="noopener noreferrer">Research Proposal Rubrics</a> for the evaluation criteria before submitting your proposal through the designated link. After the results are announced, the top 50 participants in each category will be notified and asked to submit their research pitch accordingly.</p>
    <p class="muted">Details regarding prizes and coupon distributions will be shared with participants after the final results are announced.</p>
    <p><b>Institution:</b> ${esc(state.user.institution)}<br><b>Category:</b> ${esc(state.user.category)}<br><b>Country:</b> ${esc(state.user.country)}<br><b>Available languages:</b> ${state.user.languages.map(x=>esc(x.toUpperCase())).join(", ")}</p>
    <button class="btn" id="nextBtn">Next →</button>
  </section>
  <section class="info-card" style="margin-top:18px"><h2>Bootcamp</h2><p class="muted">Your assigned bootcamp appears in every language assigned to your account.</p></section>
  ${timelineMainHTML()}`);
  document.getElementById("nextBtn").onclick=renderModules;
}

function resourceButton(resource){
  const value=String(resource||"").trim();

  if(!value){
    return "";
  }

  return `
    <a
      class="btn secondary"
      target="_blank"
      rel="noopener noreferrer"
      href="${esc(value)}"
    >
      Resources
    </a>
  `;
}

function renderModules(){
  const groups=state.user.languages
    .map(lang=>({
      lang,
      items:state.modules.filter(m=>m.language===lang)
    }))
    .filter(g=>g.items.length);

  shell(`
    <div class="topbar">
      <div>
        <div class="muted">Bootcamp</div>
        <h2>Bootcamp</h2>
      </div>
      <button class="btn secondary" id="homeBtn" type="button">
        Dashboard
      </button>
    </div>

    ${
      groups.length
        ? groups.map(g=>`
          <section>
            <h3 class="language-heading">
              ${esc(g.items[0].languageName||g.lang)}
              (${esc(String(g.lang).toUpperCase())})
            </h3>

            <div class="module-list">
              ${g.items.map(m=>`
                <article class="module-card">
                  <div class="module-head" tabindex="0" role="button" aria-expanded="false">
                    <h3>${esc(m.id)}. ${esc(m.title)}</h3>
                    <span>＋</span>
                  </div>

                  <div class="module-body">
                    <p class="muted">${esc(m.description||"")}</p>

                    <b>Topics Covered:</b>

                    <ul class="topic-list">
                      ${(Array.isArray(m.topics)?m.topics:[])
                        .map(t=>`<li>${esc(t)}</li>`)
                        .join("")}
                    </ul>

                    <div class="lecture-list">
                      ${
                        (
                          m.lectures&&m.lectures.length
                            ? m.lectures
                            : [{
                                title:m.title,
                                videoId:m.videoId,
                                resource:m.resource||""
                              }]
                        ).map((l,i)=>`
                          <div class="lecture-row">
                            <div class="lecture-row-title">
                              <b>
                                ${i+1}. ${esc(l.title||m.title)}
                              </b>
                            </div>

                            <div class="lecture-row-actions">
                              <button
                                class="btn watch"
                                type="button"
                                data-id="${esc(m.id)}"
                                data-lang="${esc(m.language)}"
                                data-lecture="${i}"
                              >
                                Open Lesson
                              </button>

                              ${resourceButton(l.resource)}
                            </div>
                          </div>
                        `).join("")
                      }
                    </div>
                  </div>
                </article>
              `).join("")}
            </div>
          </section>
        `).join("")
        : `
          <section class="info-card">
            <h2>No modules available</h2>
            <p class="muted">
              No modules are currently assigned to your languages.
            </p>
          </section>
        `
    }

    ${timelineMainHTML()}
  `);

  document.getElementById("homeBtn").addEventListener("click",renderDashboard);

  document.querySelectorAll(".module-head").forEach(head=>{
    const toggle=()=>{
      const card=head.parentElement;
      const open=card.classList.toggle("open");
      head.setAttribute("aria-expanded",String(open));
    };

    head.addEventListener("click",toggle);

    head.addEventListener("keydown",event=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        toggle();
      }
    });
  });

  document.querySelectorAll(".watch").forEach(button=>{
    button.addEventListener("click",()=>{
      openVideo(
        button.dataset.id,
        button.dataset.lang,
        Number(button.dataset.lecture)||0
      );
    });
  });
}

function createRouteToken(){
  return (
    crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)+Date.now()
  ).replaceAll("-","");
}

function openVideo(id,language,lectureIndex=0){
  const module=state.modules.find(m=>
    String(m.id)===String(id) &&
    m.language===language
  );

  if(!module) return;

  const lectures=module.lectures&&module.lectures.length
    ? module.lectures
    : [{title:module.title,videoId:module.videoId,resource:module.resource||""}];

  const safeIndex=Math.max(
    0,
    Math.min(
      Number(lectureIndex)||0,
      lectures.length-1
    )
  );

  const token=createRouteToken();

  sessionStorage.setItem(
    ROUTE_KEY,
    JSON.stringify({
      token,
      moduleId:String(id),
      language,
      lectureIndex:safeIndex,
      created:Date.now()
    })
  );

  location.hash="video/"+token;
}

function validRoute(token,id,language){
  try{
    const r=JSON.parse(sessionStorage.getItem(ROUTE_KEY)||"null");
    return r&&r.token===token&&String(r.moduleId)===String(id)&&r.language===language&&state.user.languages.includes(language)&&Date.now()-r.created<1800000;
  }catch{return false;}
}

function loadYouTubeSDK(){
  return new Promise((resolve,reject)=>{
    if(window.YT?.Player) return resolve();
    const existing=document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if(existing){
      const previous=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{
        previous?.();
        resolve();
      };
      return;
    }
    const previous=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{
      previous?.();
      resolve();
    };
    const s=document.createElement('script');
    s.src='https://www.youtube.com/iframe_api';
    s.async=true;
    s.onerror=reject;
    document.head.appendChild(s);
  });
}

function youtubeThumbnail(videoId){
  const id=String(videoId||'').trim();
  return id ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg` : '';
}

async function renderVideo(id,language,token){
  if(!validRoute(token,id,language)){
    notFound();
    return;
  }

  const module=state.modules.find(m=>
    String(m.id)===String(id) &&
    m.language===language
  );

  if(!module){
    notFound();
    return;
  }

  let route;
  try{ route=JSON.parse(sessionStorage.getItem(ROUTE_KEY)||'null'); }
  catch{ route=null; }
  if(!route){ notFound(); return; }

  const lectures=module.lectures&&module.lectures.length
    ? module.lectures
    : [{title:module.title,videoId:module.videoId,resource:module.resource||''}];

  const lectureIndex=Math.max(0,Math.min(Number(route.lectureIndex)||0,lectures.length-1));
  const lecture=lectures[lectureIndex];
  const hasPrevious=lectureIndex>0;
  const hasNext=lectureIndex<lectures.length-1;
  const youtubeId=String(lecture.videoId||module.videoId||'').trim();
  const thumb=youtubeThumbnail(youtubeId);

  shell(`
    <div class="topbar">
      <div>
        <div class="muted">${esc(module.title)}</div>
        <h2>${esc(lecture.title||module.title)}</h2>
      </div>
      <button class="btn secondary" id="backBtn" type="button">← Lesson</button>
    </div>

    <section class="hero video-card">
      <div class="video-heading">
        <p class="muted">${esc(module.description||'')}</p>
        <div class="lecture-title-small">Lecture ${lectureIndex+1} of ${lectures.length} — ${esc(lecture.title||module.title)}</div>
      </div>

      <div class="player" id="customPlayer">
        <div class="youtube-frame-wrap" aria-hidden="true">
          <div id="youtubePlayer"></div>
        </div>

        <div class="player-shield" aria-hidden="true"></div>

        <div class="player-brand-wrap">
          <img class="player-brand" src="${esc(watermarkPath())}" alt="" draggable="false">
        </div>

        <div class="player-status" id="playerStatus">Ready</div>

        <div class="player-buffering" id="playerBuffering" aria-hidden="true">
          <div class="player-buffering-spinner" aria-hidden="true"></div>
          <span>Buffering 480p…</span>
        </div>

        <div class="player-cover" id="playerCover" style="background-image:url('${esc(thumb)}')">
          <button class="play-big" id="playBig" type="button" aria-label="Play lesson">▶</button>
        </div>

        <div class="player-controls" aria-label="Video controls">
          <button class="player-control-btn" id="playPause" type="button" aria-label="Play or pause">▶</button>
          <button class="player-control-btn" id="muteBtn" type="button" aria-label="Mute">🔊</button>
          <input class="player-volume" id="volumeControl" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume">
          <span class="player-time" id="currentTime">0:00</span>
          <input class="player-progress" id="progressControl" type="range" min="0" max="100" step="0.1" value="0" aria-label="Video progress">
          <span class="player-time" id="remainingTime">−0:00</span>
          <select class="player-speed" id="speedControl" aria-label="Playback speed">
            <option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option>
          </select>
          <button class="player-control-btn" id="fullBtn" type="button" aria-label="Fullscreen">⛶</button>
        </div>

        <div class="player-ended" id="playerEnded" aria-hidden="true">
          <div class="player-ended-card">
            <div class="player-ended-title">Lesson completed</div>
            <button class="play-big" id="replayBtn" type="button" aria-label="Replay lesson">↻</button>
            <div class="player-ended-text">Replay from the beginning</div>
          </div>
        </div>
      </div>

      <div class="lecture-navigation">
        <div class="lecture-navigation-title"><small>${esc(lecture.title||module.title)}</small></div>
        <div class="lecture-navigation-buttons">
          ${hasPrevious?`<button class="btn secondary" id="prevLecture" type="button">← Previous</button>`:''}
          ${hasNext?`<button class="btn" id="nextLecture" type="button">Next →</button>`:''}
        </div>
      </div>

      ${lecture.resource?`<div class="lecture-resource">${resourceButton(lecture.resource)}</div>`:''}
    </section>
  `);

  document.getElementById('backBtn').addEventListener('click',renderModules);
  if(hasPrevious) document.getElementById('prevLecture').addEventListener('click',()=>openVideo(module.id,language,lectureIndex-1));
  if(hasNext) document.getElementById('nextLecture').addEventListener('click',()=>openVideo(module.id,language,lectureIndex+1));

  try{
    await loadYouTubeSDK();

    const pp=document.getElementById('playPause');
    const big=document.getElementById('playBig');
    const replay=document.getElementById('replayBtn');
    const mute=document.getElementById('muteBtn');
    const full=document.getElementById('fullBtn');
    const cover=document.getElementById('playerCover');
    const ended=document.getElementById('playerEnded');
    const status=document.getElementById('playerStatus');
    const buffering=document.getElementById('playerBuffering');
    const volume=document.getElementById('volumeControl');
    const progress=document.getElementById('progressControl');
    const current=document.getElementById('currentTime');
    const remaining=document.getElementById('remainingTime');
    const speed=document.getElementById('speedControl');
    const playerEl=document.getElementById('customPlayer');

    let player=null;
    let duration=0;
    let isSeeking=false;
    let lastSeconds=0;
    let progressTimer=0;
    let stateTimer=0;
    let bufferingTimer=0;
    let bufferingStartedAt=0;
    let wasPlayingBeforeBuffer=false;

    const fmtTime=(seconds)=>{
      seconds=Math.max(0,Math.floor(Number(seconds)||0));
      const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
      return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
    };

    function renderTime(seconds){
      const safe=Math.max(0,Math.min(Number(seconds)||0,duration||Number(seconds)||0));
      lastSeconds=safe;
      current.textContent=fmtTime(safe);
      remaining.textContent=`−${fmtTime(Math.max(0,duration-safe))}`;
      if(!isSeeking){
        progress.max=duration||100;
        progress.value=Math.min(safe,duration||safe);
      }
    }

    function clearBufferingTimer(){
      if(bufferingTimer){ clearTimeout(bufferingTimer); bufferingTimer=0; }
    }

    function setPlayingUI(playing){
      pp.textContent=playing?'❚❚':'▶';
      pp.setAttribute('aria-label',playing?'Pause':'Play');
      big.textContent=playing?'❚❚':'▶';
      big.setAttribute('aria-label',playing?'Pause lesson':'Play lesson');
      playerEl.classList.toggle('is-playing',playing);
      if(playing){
        cover.classList.add('hidden');
        force480();
        ended.classList.remove('show');
        ended.setAttribute('aria-hidden','true');
        status.textContent='Playing';
      }else{
        setBuffering(false);
        status.textContent='Paused';
      }
    }

    function setEndedUI(){
      pp.textContent='▶';
      pp.setAttribute('aria-label','Replay');
      big.textContent='▶';
      cover.classList.remove('hidden');
      ended.classList.add('show');
      ended.setAttribute('aria-hidden','false');
      status.textContent='Completed';
      renderTime(duration);
    }

    function setBuffering(show){
      if(show){
        buffering.classList.add('show');
        buffering.setAttribute('aria-hidden','false');
        status.textContent='Buffering 480p…';
      }else{
        clearBufferingTimer();
        buffering.classList.remove('show');
        buffering.setAttribute('aria-hidden','true');
        if(player && player.getPlayerState?.()===YT.PlayerState.PLAYING) status.textContent='Playing';
      }
    }

    function scheduleBufferingNotice(){
      clearBufferingTimer();
      bufferingStartedAt=performance.now();
      // Short buffering events are normal while YouTube starts/seeks/changes quality.
      // Only show the notice when buffering persists, which is a much better proxy for
      // an actual network stall and avoids distracting learners during normal playback.
      bufferingTimer=window.setTimeout(()=>{
        bufferingTimer=0;
        if(player && player.getPlayerState?.()===YT.PlayerState.BUFFERING && wasPlayingBeforeBuffer){
          setBuffering(true);
        }
      },900);
    }

    // Request 480p when YouTube exposes that quality, but never treat a temporary
    // quality-report mismatch as a buffering state. The network decides when
    // actual buffering is required; the learner should keep seeing the video.
    function force480(){
      if(!player) return false;
      try{
        const levels=player.getAvailableQualityLevels?.()||[];
        if(levels.includes('large')) player.setPlaybackQuality('large');
        return true;
      }catch{return false;}
    }

    function refreshState(){
      if(!player||typeof player.getPlayerState!=='function') return;
      try{
        const st=player.getPlayerState();
        if(st===YT.PlayerState.PLAYING) setPlayingUI(true);
        else if(st===YT.PlayerState.ENDED) setEndedUI();
        else if(st===YT.PlayerState.PAUSED) setPlayingUI(false);

        const muted=player.isMuted();
        const vol=Number(player.getVolume())||0;
        mute.textContent=muted||vol===0?'🔇':'🔊';
        volume.value=String(Math.max(0,Math.min(1,vol/100)));
        const rates=player.getAvailablePlaybackRates?.()||[];
        const currentRate=Number(player.getPlaybackRate?.()||1);
        if(rates.length){
          speed.innerHTML=rates.map(r=>`<option value="${r}">${r}×</option>`).join('');
        }
        if([...speed.options].some(o=>Number(o.value)===currentRate)) speed.value=String(currentRate);
      }catch{}
    }

    function syncProgress(){
      if(!player||isSeeking) return;
      try{
        const currentTime=Number(player.getCurrentTime())||0;
        const d=Number(player.getDuration())||duration;
        if(d>0) duration=d;
        renderTime(currentTime);
        if(player.getPlayerState()===YT.PlayerState.ENDED) setEndedUI();
      }catch{}
    }

    function toggle(){
      if(!player) return;
      try{
        const st=player.getPlayerState();
        if(st===YT.PlayerState.PLAYING) player.pauseVideo();
        else if(st===YT.PlayerState.ENDED){player.seekTo(0,true);player.playVideo();}
        else player.playVideo();
      }catch{status.textContent='Playback unavailable';}
    }

    function createPlayer(){
      player=new YT.Player('youtubePlayer',{
        videoId:youtubeId,
        width:'100%',
        height:'100%',
        playerVars:{
          autoplay:0,
          controls:0,
          disablekb:1,
          fs:0,
          iv_load_policy:3,
          playsinline:1,
          rel:0,
          modestbranding:1,
          showinfo:0,
          enablejsapi:1,
          origin:location.origin
        },
        events:{
          onReady(){
            duration=Number(player.getDuration())||0;
            force480();
            progress.max=duration||100;
            refreshState();
            renderTime(0);
            progressTimer=window.setInterval(syncProgress,200);
            stateTimer=window.setInterval(()=>{
              refreshState();
            },500);
          },
          onStateChange(event){
            if(event.data===YT.PlayerState.PLAYING){
              wasPlayingBeforeBuffer = true;
              setBuffering(false);
              setPlayingUI(true);
              force480();
            }else if(event.data===YT.PlayerState.BUFFERING){
              buffering.classList.remove('show');
              buffering.setAttribute('aria-hidden','true');
              scheduleBufferingNotice();
              force480();
            }else if(event.data===YT.PlayerState.PAUSED){
              wasPlayingBeforeBuffer = false;
              setBuffering(false);
              setPlayingUI(false);
            }else if(event.data===YT.PlayerState.ENDED){
              wasPlayingBeforeBuffer = false;
              setBuffering(false);
              setEndedUI();
            }
            refreshState();
          },
          onPlaybackQualityChange(){
            // Re-request 480p when available, but do not flash a buffering veil.
            force480();
            refreshState();
          },
          onPlaybackRateChange(){refreshState();},
          onError(){
            setBuffering(false);
            status.textContent='Video error';
          }
        }
      });
    }

    pp.addEventListener('click',toggle);
    // The iframe is intentionally shielded to prevent direct YouTube UI interaction.
    // Route clicks/touches on that shield to our own play/pause control instead.
    const shield=document.querySelector('#customPlayer .player-shield');
    if(shield){
      shield.addEventListener('click',toggle);
      shield.addEventListener('touchend',event=>{ event.preventDefault(); toggle(); },{passive:false});
    }
    big.addEventListener('click',toggle);
    cover.addEventListener('click',event=>{
      if(event.target===cover) toggle();
    });
    replay.addEventListener('click',()=>{
      if(!player) return;
      ended.classList.remove('show');
      cover.classList.add('hidden');
      player.seekTo(0,true);
      player.playVideo();
    });

    mute.addEventListener('click',()=>{
      if(!player) return;
      try{
        if(player.isMuted()) player.unMute(); else player.mute();
        refreshState();
      }catch{}
    });

    volume.addEventListener('input',()=>{
      if(!player) return;
      const value=Math.max(0,Math.min(1,Number(volume.value)||0));
      try{
        player.setVolume(Math.round(value*100));
        if(value===0) player.mute(); else player.unMute();
        mute.textContent=value===0?'🔇':'🔊';
      }catch{}
    });

    progress.addEventListener('pointerdown',()=>{isSeeking=true;});
    progress.addEventListener('input',()=>{
      const value=Number(progress.value)||0;
      current.textContent=fmtTime(value);
      remaining.textContent=`−${fmtTime(Math.max(0,duration-value))}`;
    });
    const commitSeek=()=>{
      if(!player) return;
      const value=Math.max(0,Math.min(duration||0,Number(progress.value)||0));
      try{player.seekTo(value,true);}catch{}
      isSeeking=false;
      renderTime(value);
    };
    progress.addEventListener('change',commitSeek);
    progress.addEventListener('pointerup',commitSeek);
    progress.addEventListener('touchend',commitSeek,{passive:true});

    speed.addEventListener('change',()=>{
      if(!player) return;
      try{player.setPlaybackRate(Number(speed.value));}catch{}
    });

    full.addEventListener('click',async()=>{
      try{
        if(document.fullscreenElement) await document.exitFullscreen();
        else if(playerEl.requestFullscreen) await playerEl.requestFullscreen();
      }catch{
        try{await playerEl.webkitRequestFullscreen?.();}catch{}
      }
    });

    document.addEventListener('fullscreenchange',refreshState);
    document.addEventListener('webkitfullscreenchange',refreshState);

    createPlayer();

    window.addEventListener('beforeunload',()=>{
      if(progressTimer) clearInterval(progressTimer);
      if(stateTimer) clearInterval(stateTimer);
      clearBufferingTimer();
      try{player?.destroy();}catch{}
    },{once:true});
  }catch(error){
    console.error('YouTube player error:',error);
    const status=document.getElementById('playerStatus');
    if(status) status.textContent='Player unavailable';
  }
}

function notFound(){
  ROOT.innerHTML=`<div class="error-page"><main><div class="error-code">404</div><h1>Invalid or expired lesson link</h1><p class="muted">The requested lesson route is not valid in this session.</p><a class="btn" href="${location.pathname}">Return to Portal</a></main></div>`;
}


function bindMotionEffects(){
  document.querySelectorAll('.btn,.side-action,.player-control-btn,.play-big,.module-head,.lecture-row').forEach(el=>{
    if(el.dataset.motionBound) return;
    el.dataset.motionBound='1';
    el.addEventListener('pointerdown',()=>el.classList.add('is-bouncing'));
    el.addEventListener('animationend',()=>el.classList.remove('is-bouncing'));
  });
  const targets=document.querySelectorAll('.hero,.module-card,.info-card,.timeline-main,.deadline-row,.lecture-row');
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('in-view');io.unobserve(entry.target);}
    }),{threshold:.08});
    targets.forEach(el=>io.observe(el));
  }else targets.forEach(el=>el.classList.add('in-view'));
}

async function boot(){
  state.user=getSession();
  if(!state.user){renderLogin();return;}
  showLoader("Loading your portal…");
  try{
    await prefetchPortalData();
    const match=location.hash.match(/^#video\/([^/]+)$/);
    if(match){
      let route=null;try{route=JSON.parse(sessionStorage.getItem(ROUTE_KEY)||"null");}catch{}
      if(route&&route.token===match[1])await renderVideo(route.moduleId,route.language,match[1]);else notFound();
    }else renderDashboard();
    updateCountdowns();
  }catch(e){
    console.error(e);
    ROOT.innerHTML=`<div class="error-page"><main><h1>Portal configuration error</h1><p>${esc(e.message)}</p></main></div>`;
  }
}

function isAuthInputTarget(target){
  return target instanceof Element && !!target.closest('#loginEmail,#loginPassword');
}

document.addEventListener("contextmenu",e=>{
  if(!isAuthInputTarget(e.target))e.preventDefault();
},true);
document.addEventListener("copy",e=>{
  if(!isAuthInputTarget(e.target))e.preventDefault();
},true);
document.addEventListener("cut",e=>{
  if(!isAuthInputTarget(e.target))e.preventDefault();
},true);
document.addEventListener("paste",e=>{
  if(!isAuthInputTarget(e.target))e.preventDefault();
},true);
document.addEventListener("dragstart",e=>{
  if(!isAuthInputTarget(e.target))e.preventDefault();
},true);
document.addEventListener("selectstart",e=>{
  if(!isAuthInputTarget(e.target))e.preventDefault();
},true);
document.addEventListener("keydown",e=>{
  const k=String(e.key||"").toUpperCase();
  if(e.key==="F12"||(e.ctrlKey&&e.shiftKey&&["I","J","C"].includes(k))||(e.ctrlKey&&k==="U")){
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if(!isAuthInputTarget(e.target) && e.ctrlKey && ["C","X","V","A"].includes(k)){
    e.preventDefault();
    e.stopPropagation();
  }
},true);
window.addEventListener("hashchange",boot);
window.addEventListener("resize",syncChromeOffset,{passive:true});
setInterval(updateCountdowns,1000);
boot();

})();
