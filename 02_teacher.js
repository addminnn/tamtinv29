
/* =========================================================
   TEACHER DASHBOARD (chạy khi đăng nhập giáo viên)
   Lưu ý: Dữ liệu nằm trong LocalStorage của trình duyệt hiện tại.
   ========================================================= */
if(window.__TEACHER){
  const teacher = window.__TEACHER;

  const LESSON_META = [
    {id:"A1", title:"A1 — In lời chào"},
    {id:"A2", title:"A2 — Tổng 2 số"},
    {id:"A4", title:"A4 — Phân loại học lực"},
    {id:"A5", title:"A5 — Tổng 1..n"},
    {id:"A9", title:"A9 — Số nguyên tố"},
  ];

  const ASSIGN_KEY = "py10:assignments";
  const SESSION_KEY = "py10:session";

  const $ = (id)=>document.getElementById(id);
  function nowISO(){ return new Date().toISOString(); }
  function loadAssign(){
    try{ return JSON.parse(localStorage.getItem(ASSIGN_KEY) || "[]") || []; }catch{ return []; }
  }
  function saveAssign(arr){ localStorage.setItem(ASSIGN_KEY, JSON.stringify(arr)); }

  function loadJSON(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)||"") || fallback; }catch{ return fallback; } }
  function progKey(sid){ return `py10:progress:${sid}`; }
  function logKey(sid){ return `py10:log:${sid}`; }

  function getStudentCode(sid, lessonId){
    return localStorage.getItem(`py10:${sid}:${lessonId}`)
        || localStorage.getItem(`py10:draft:${sid}:${lessonId}`)
        || "";
  }

  function analyzeChecklistForLesson(code, lessonId){
    const c = code || "";
    const meta = LESSON_META.find(x=>x.id===lessonId) || {title:""};
    const title = meta.title || "";
    const needInput = (lessonId !== "A1");
    const needLoop = /A5|A9/.test(lessonId);
    const needIf = /A4|A9/.test(lessonId);

    const hasInput = /input\s*\(/.test(c);
    const hasParse = /map\(|int\(|float\(|split\(/.test(c);
    const hasIf = /\bif\b/.test(c);
    const hasLoop = /\bfor\b|\bwhile\b/.test(c);
    const hasPrint = /print\s*\(/.test(c);

    const items = [
      {ok: !needInput || hasInput, title:"Đọc input"},
      {ok: !needInput || hasParse, title:"Ép kiểu/tách dữ liệu"},
      {ok: (!needIf || hasIf) && (!needLoop || hasLoop || hasIf), title:"Thuật toán (if/loop)"},
      {ok: hasPrint, title:"In kết quả"}
    ];
    const ok = items.filter(x=>x.ok).length;
    return { ok, total: items.length };
  }

  function lastActivityFromLogs(logData){
    if(!logData || !Array.isArray(logData.events) || !logData.events.length) return "";
    const t = logData.events[logData.events.length-1].t || "";
    return t;
  }

  function fmtDate(iso){
    if(!iso) return "";
    const d = new Date(iso);
    if(isNaN(d)) return String(iso);
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function initAssignUI(){
    // dropdown
    const sel = $("asLesson");
    sel.innerHTML = "";
    LESSON_META.forEach(l=>{
      const o = document.createElement("option");
      o.value = l.id;
      o.textContent = `${l.id} — ${l.title.replace(/^A\d+\s—\s/,"")}`;
      sel.appendChild(o);
    });
    // default due = +7 days
    const d = new Date(); d.setDate(d.getDate()+7);
    $("asDue").value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

    $("btnAssign").onclick = ()=>{
      const lessonId = $("asLesson").value;
      const due = $("asDue").value || "";
      const title = ($("asTitle").value || "").trim();
      const note = ($("asNote").value || "").trim();

      const arr = loadAssign();
      arr.unshift({
        id: "as_" + Date.now(),
        lessonId,
        title: title || ("Bài " + lessonId),
        note,
        due: due ? due : "",
        created: nowISO(),
        createdBy: teacher.id,
        target: "all",
        active: true
      });
      saveAssign(arr);
      $("asTitle").value = "";
      $("asNote").value = "";
      renderAssignList();
      refreshAll();
      alert("Đã giao bài cho cả lớp!");
    };

    $("btnTeacherLogout").onclick = ()=>{
      localStorage.removeItem(SESSION_KEY);
      location.reload();
    };
    $("btnRefreshTeacher").onclick = refreshAll;
    $("btnExportTeacherCSV").onclick = exportTeacherCSV;
  }

  function renderAssignList(){
    const box = $("asList");
    const arr = loadAssign().filter(a=>a && a.active !== false);
    box.innerHTML = "";
    if(!arr.length){
      box.innerHTML = '<span class="muted">Chưa giao bài nào.</span>';
      return;
    }
    arr.slice(0,20).forEach(a=>{
      const chip = document.createElement("div");
      chip.className = "chip";
      const due = a.due ? (" • hạn " + fmtDate(a.due)) : "";
      chip.innerHTML = `<b>${a.lessonId}</b>: ${(a.title||"")}${due} &nbsp; <button class="btn" style="padding:6px 10px; border-radius:999px; font-size:12px;">Xoá</button>`;
      chip.querySelector("button").onclick = ()=>{
        const arr2 = loadAssign();
        const ix = arr2.findIndex(x=>x.id===a.id);
        if(ix>=0) arr2[ix].active = false;
        saveAssign(arr2);
        renderAssignList();
        refreshAll();
      };
      box.appendChild(chip);
    });
  }

  function computeKPIs(assigns){
    let activeStudents = 0;
    let totalDone = 0;
    let totalNeed = 0;

    STUDENTS.forEach(st=>{
      const prog = loadJSON(progKey(st.id), {unlocked:{}, passed:{}, passCount:0});
      const hasAny = Object.keys(prog.passed||{}).length > 0;
      if(hasAny) activeStudents++;

      assigns.forEach(a=>{
        totalNeed++;
        if(prog.passed && prog.passed[a.lessonId]) totalDone++;
      });
    });

    return {
      activeStudents,
      assigns: assigns.length,
      done: totalDone,
      need: totalNeed,
      rate: totalNeed ? Math.round(totalDone*100/totalNeed) : 0
    };
  }

  function renderMonitor(){
    const assigns = loadAssign().filter(a=>a && a.active !== false).slice(0,8);
    // header
    const head = $("tbHead");
    head.innerHTML = "";
    const cols = [
      "Mã HS", "Họ tên", "Hoạt động gần nhất"
    ];
    cols.forEach(t=>{ const th=document.createElement("th"); th.textContent=t; head.appendChild(th); });
    assigns.forEach(a=>{
      const th=document.createElement("th");
      const due = a.due ? (" (hạn "+fmtDate(a.due)+")") : "";
      th.textContent = (a.lessonId + due);
      head.appendChild(th);
    });

    // body
    const body = $("tbBody");
    body.innerHTML = "";
    STUDENTS.forEach(st=>{
      const tr = document.createElement("tr");
      const prog = loadJSON(progKey(st.id), {unlocked:{}, passed:{}, passCount:0});
      const logs = loadJSON(logKey(st.id), {events:[]});
      const last = lastActivityFromLogs(logs);

      const tdId = document.createElement("td"); tdId.textContent = st.id;
      const tdName = document.createElement("td"); tdName.textContent = st.name || "";
      const tdLast = document.createElement("td"); tdLast.textContent = last ? last.replace("T"," ").replace("Z","") : "";

      tr.appendChild(tdId); tr.appendChild(tdName); tr.appendChild(tdLast);

      assigns.forEach(a=>{
        const td = document.createElement("td");
        const done = !!(prog.passed && prog.passed[a.lessonId]);
        if(done){
          td.innerHTML = '<span class="chip" style="background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.28);color:#14532d;">Hoàn thành</span>';
        } else {
          const code = getStudentCode(st.id, a.lessonId);
          const ck = analyzeChecklistForLesson(code, a.lessonId);
          const pct = Math.round(ck.ok*100/ck.total);
          td.innerHTML = '<span class="chip" style="background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.28);color:#7c2d12;">Chưa</span>'
                       + ` <span class="muted">(${pct}%)</span>`;
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    // KPI
    const kpi = computeKPIs(assigns);
    const kpiBox = $("kpiBox");
    kpiBox.innerHTML = "";
    const chips = [
      `Bài đang giao: <b>${kpi.assigns}</b>`,
      `HS có hoạt động: <b>${kpi.activeStudents}/${STUDENTS.length}</b>`,
      `Hoàn thành nhiệm vụ: <b>${kpi.done}/${kpi.need}</b>`,
      `Tỉ lệ hoàn thành: <b>${kpi.rate}%</b>`
    ];
    chips.forEach(t=>{ const s=document.createElement("span"); s.className="chip"; s.innerHTML=t; kpiBox.appendChild(s); });
  }

  function renderErrorStats(){
    const days = 7;
    const since = Date.now() - days*24*3600*1000;
    const counts = new Map();

    STUDENTS.forEach(st=>{
      const logs = loadJSON(logKey(st.id), {events:[]});
      (logs.events||[]).forEach(e=>{
        const t = new Date(e.t||"").getTime();
        if(!t || t < since) return;
        if(e.type === "run" && e.ok === false){
          const et = (e.errorType || "Lỗi khác").toString();
          counts.set(et, (counts.get(et)||0) + 1);
        }
      });
    });

    const arr = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
    const box = $("errStats");
    box.innerHTML = "";
    if(!arr.length){ box.innerHTML = '<span class="muted">Chưa có dữ liệu lỗi trong 7 ngày gần nhất.</span>'; return; }
    arr.forEach(([k,v])=>{
      const s=document.createElement("span");
      s.className="chip";
      s.innerHTML = `<b>${k}</b> • ${v} lần`;
      box.appendChild(s);
    });
  }

  
  function renderWeekly(){
    const days = 7;
    const since = Date.now() - days*24*3600*1000;

    let classPass = 0, classRun=0, classTest=0, classPoints=0;

    const body = $("tbWeekBody");
    body.innerHTML = "";

    STUDENTS.forEach(st=>{
      const logs = loadJSON(logKey(st.id), {events:[]});
      const rub = (typeof loadRubric === "function") ? loadRubric(st.id) : {};
      const grp = (typeof groupOfStudentId === "function") ? groupOfStudentId(st.id) : "";

      let run=0, test=0, hint=0, ghost=0;
      let lastTs = 0;
      const passLessons = new Set();
      const attemptedLessons = new Set();

      // metrics for paste & rubric avg
      let pasteSum=0, pasteN=0, pasteMax=0;
      let rubricSum=0, rubricN=0;
      let pasteWarn = false;

      (logs.events||[]).forEach(e=>{
        const t = new Date(e.t||"").getTime();
        if(!t) return;
        if(t>lastTs) lastTs = t;

        if(t > since){
          if(e.type==="run"){ run++; attemptedLessons.add(e.lesson); }
          if(e.type==="test"){
            test++; attemptedLessons.add(e.lesson);
            const pr = Number(e.pasteRatio||0);
            if(Number.isFinite(pr)){
              pasteSum += pr; pasteN += 1; pasteMax = Math.max(pasteMax, pr);
              if(pr >= 0.70) pasteWarn = true;
            }
            const rr = Number(e.rubric||0);
            if(Number.isFinite(rr) && rr>0){ rubricSum += rr; rubricN += 1; }
          }
          if(e.type==="hint") hint++;
          if(e.type==="ghost_accept") ghost++;
          if(e.type==="pass"){ passLessons.add(e.lesson); }
        }
      });

      // PASS theo bài (distinct trong 7 ngày)
      const passCount = passLessons.size;

      // Điểm 7 ngày: cộng điểm tốt nhất của các bài PASS trong 7 ngày (theo rubric store)
      let points7 = 0;
      try{
        passLessons.forEach(lessonId=>{
          const it = rub && rub[lessonId];
          if(it && it.pass && (it.ts||0) > since){
            points7 += Number(it.score||0) || 0;
          } else {
            // fallback: nếu có rubric trong log pass
            const best = (logs.events||[]).filter(e=>e.type==="pass" && e.lesson===lessonId).map(e=>Number(e.rubric||0)||0).reduce((a,b)=>Math.max(a,b),0);
            if(best>0) points7 += best;
          }
        });
      }catch{}

      // Bài đã làm: distinct bài có run/test trong 7 ngày
      const attemptedCount = attemptedLessons.size;

      const pasteAvg = pasteN ? Math.round((pasteSum/pasteN)*100) : 0;
      const rubricAvg = rubricN ? Math.round((rubricSum/rubricN)) : 0;

      // cảnh báo tổng hợp
      let warn = "";
      if(pasteWarn) warn += "Dán nhiều; ";
      if(ghost >= 5) warn += "Dùng hoàn thiện dòng nhiều; ";
      warn = warn.trim();
      if(warn.endsWith(";")) warn = warn.slice(0,-1);

      classPass += passCount; classRun += run; classTest += test; classPoints += points7;

      const tr=document.createElement("tr");
      tr.innerHTML = `
        <td>${st.id}</td>
        <td>${(st.name||"")}</td>
        <td>${st.class || ""}</td>
        <td>${grp ? ("Nhóm "+grp) : ""}</td>
        <td><b>${passCount}</b></td>
        <td><b>${points7}</b></td>
        <td>${attemptedCount}</td>
        <td>${run}</td>
        <td>${test}</td>
        <td>${pasteN ? (pasteAvg + "%") : "—"}</td>
        <td>${warn || "—"}</td>
        <td>${rubricN ? (rubricAvg + "/100") : "—"}</td>
        <td>${hint}</td>
        <td>${ghost}</td>
        <td>${lastTs ? (new Date(lastTs).toISOString().replace("T"," ").replace("Z","")) : ""}</td>
      `;
      body.appendChild(tr);
    });

    $("weekNote").innerHTML = `Tổng lớp (7 ngày): <b>${classPass}</b> bài PASS • <b>${classPoints}</b> điểm • <b>${classRun}</b> lần Run • <b>${classTest}</b> lần Test.`;
  }

  function exportTeacherCSV(){
    // Giữ nguyên nút/luồng cũ, nhưng xuất file Excel (.xls) để mở trực tiếp bằng Excel.
    const assigns = loadAssign().filter(a=>a && a.active !== false).slice(0,8);
    const header = ["student_id","student_name","last_activity", ...assigns.map(a=>a.lessonId)];
    const rows = [];

    STUDENTS.forEach(st=>{
      const prog = loadJSON(progKey(st.id), {unlocked:{}, passed:{}, passCount:0});
      const logs = loadJSON(logKey(st.id), {events:[]});
      const last = lastActivityFromLogs(logs);
      const cols = assigns.map(a=> (prog.passed && prog.passed[a.lessonId]) ? "DONE" : "NOT");
      rows.push([st.id, st.name||"", last||"", ...cols].map(x=>String(x ?? "")));
    });

    function esc(s){
      return String(s ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;");
    }
    function tr(cells, tag){
      return "<tr>" + cells.map(c=>`<${tag}>${esc(c)}</${tag}>`).join("") + "</tr>";
    }

    const sheetName = "BaoCao";
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8">`;
    html += `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${esc(sheetName)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->`;
    html += `</head><body><table border="1">`;
    html += tr(header, "th");
    rows.forEach(r=>{ html += tr(r, "td"); });
    html += `</table></body></html>`;

    const blob = new Blob(["\ufeff", html], {type:"application/vnd.ms-excel;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bao_cao_giao_bai.xls";
    a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch{} }, 1000);
  }




  function refreshAll(){
    try{ renderMonitor(); }catch(e){}
    try{ renderErrorStats(); }catch(e){}
    try{ renderWeekly(); }catch(e){}
    try{ if(typeof window.renderHelpTicketsTeacher === "function") window.renderHelpTicketsTeacher(); }catch(e){}
  }

  // expose for patches.js
  try{
    window.refreshAll = refreshAll;
    window.loadAssign = loadAssign;
    window.saveAssign = saveAssign;
    window.renderAssignList = renderAssignList;
    window.exportTeacherCSV = exportTeacherCSV;
  }catch(e){}

  function initTeacher(){
    try{ initAssignUI(); }catch(e){}
    try{ renderAssignList(); }catch(e){}
    try{ refreshAll(); }catch(e){}
    const btnExp = $("btnExportTeacherCSV");
    if(btnExp) btnExp.onclick = exportTeacherCSV;
    const btnRef = $("btnRefresh");
    if(btnRef) btnRef.onclick = refreshAll;
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initTeacher);
  } else {
    initTeacher();
  }

} // end teacher gate
