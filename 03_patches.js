
/* =========================================================
   PATCH V5 — sửa luồng GV giao bài theo lớp/nhóm/DS HS
   + vá một số điểm "khó chịu" để chạy ổn định hơn
   (giữ nguyên toàn bộ tính năng cũ)
   ========================================================= */
(function(){
  // --- helper safe ---
  const $ = (id)=>document.getElementById(id);
  const toast = window.toast || function(msg){ try{ alert(msg); }catch{} };

// --- editor/code helpers (CodeMirror or textarea) ---
function getEditor(){
  return window.__editor || window.editor || null;
}
function getCode(){
  const ed = getEditor();
  try{
    if(ed && typeof ed.getValue === "function") return ed.getValue();
  }catch(e){}
  const ta = $("code") || $("codeEditor") || document.querySelector("textarea#code");
  return ta ? (ta.value || "") : "";
}

  // --- Global fallbacks (tránh lỗi khi chạy ở chế độ GV / chưa có student runtime) ---
  try{
    if(!("current" in window)) window.current = {id:"", tests:[], sampleIn:"", sampleOut:""};
    if(!("LESSONS" in window)) window.LESSONS = [];
    if(!("progress" in window)) window.progress = { unlocked:{}, passed:{}, passCount:0 };
    if(!("pyReady" in window)) window.pyReady = false;
  }catch(e){}

  function nowISO(){
    const d = new Date();
    const pad = (n)=>String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // ===== 1) Fix: Giáo viên giao bài theo lớp/nhóm/danh sách HS =====
  function patchTeacherAssign(){
    const btn = $("btnAssign");
    if(!btn || btn.__patchedV5) return;
    btn.__patchedV5 = true;

    const loadAssign = window.loadAssign || function(){
      try{ return JSON.parse(localStorage.getItem("py10:assignments")||"[]")||[]; }catch{ return []; }
    };
    const saveAssign = window.saveAssign || function(arr){
      try{ localStorage.setItem("py10:assignments", JSON.stringify(arr||[])); }catch{}
    };

    const renderAssignList = window.renderAssignList || function(){};
    const refreshAll = window.refreshAll || function(){};

    btn.onclick = ()=>{
      const lessonId = ($("asLesson")?.value)||"A1";
      const due = ($("asDue")?.value)||"";
      const title = (($("asTitle")?.value)||"").trim();
      const note = (($("asNote")?.value)||"").trim();

      const tType = ($("asTargetType")?.value)||"all";
      const tVal  = ($("asTargetValue")?.value)||"";
      const rawTargets = (($("asTargets")?.value)||"").trim();

      // normalize targets list
      let targets = [];
      if(tType === "student"){
        targets = rawTargets
          .split(",")
          .map(s=>s.trim())
          .filter(Boolean);
      }

      // build assignment object (new format + legacy fallback)
      const a = {
        id: "as_" + Date.now(),
        lessonId,
        title: title || ("Bài " + lessonId),
        note,
        due: due ? due : "",
        created: (window.nowISO ? window.nowISO() : nowISO()),
        createdBy: (window.__TEACHER && window.__TEACHER.id) ? window.__TEACHER.id : "gv",
        targetType: tType,
        targetValue: (tType === "student") ? "" : String(tVal),
        targets: (tType === "student") ? targets : undefined,
        // legacy string for backward compatibility
        target:
          (tType === "all") ? "all" :
          (tType === "class") ? ("class:" + String(tVal)) :
          (tType === "group") ? ("group:" + String(tVal)) :
          "student",
        active: true
      };

      if(tType === "class" && !tVal){
        toast("⚠️ Bạn đang chọn 'Theo lớp' nhưng chưa chọn lớp.");
        return;
      }
      if(tType === "group" && !tVal){
        toast("⚠️ Bạn đang chọn 'Theo nhóm' nhưng chưa chọn nhóm.");
        return;
      }
      if(tType === "student" && targets.length === 0){
        toast("⚠️ Nhập mã HS theo dạng: hs1, hs2, hs3 ...");
        return;
      }

      const arr = loadAssign();
      arr.unshift(a);
      saveAssign(arr);

      if($("asTitle")) $("asTitle").value = "";
      if($("asNote")) $("asNote").value = "";

      // refresh UI
      try{ renderAssignList(); }catch{}
      try{ refreshAll(); }catch{}

      // message
      const msg =
        (tType === "all") ? "Đã giao bài cho cả lớp!" :
        (tType === "class") ? ("Đã giao bài cho lớp " + tVal + "!") :
        (tType === "group") ? ("Đã giao bài cho nhóm " + tVal + "!") :
        ("Đã giao bài cho " + targets.length + " học sinh!");
      alert(msg);
    };
  }

  // ensure target selector UI always correct in teacher mode
  function patchTeacherTargetUI(){
    const typeSel = $("asTargetType");
    const valSel  = $("asTargetValue");
    const inpTargets = $("asTargets");
    if(!typeSel || !valSel) return;

    const refreshTargetUI = window.refreshTargetUI || function(){
      // fallback minimal
      valSel.style.display = "inline-block";
      if(inpTargets) inpTargets.style.display = "none";
      if(typeSel.value === "student"){
        valSel.style.display = "none";
        if(inpTargets) inpTargets.style.display = "inline-block";
      }
    };

    // call once and bind
    try{ refreshTargetUI(); }catch{}
    if(!typeSel.__patchedV5){
      typeSel.__patchedV5 = true;
      typeSel.addEventListener("change", ()=>{ try{ refreshTargetUI(); }catch{} });
    }
  }

  // ===== 2) Fix nhỏ: khi đổi bài thì cập nhật lại Todo + Flow chắc chắn =====
  function patchLessonChangeHooks(){
    // hook renderTask to refresh todo + flow locks (nếu tồn tại)
    const rt0 = window.renderTask;
    if(typeof rt0 === "function" && !rt0.__patchedV5){
      const wrapped = function(){
        rt0();
        try{ window.renderStudentTodo && window.renderStudentTodo(); }catch{}
        try{ window.applyFlowLocks && window.applyFlowLocks(); }catch{}
        try{ window.initFlowUI && window.initFlowUI(); }catch{}
      };
      wrapped.__patchedV5 = true;
      // keep reference to avoid double wrap
      window.renderTask = wrapped;
    }
  }

  // ===== 3) Guard: hiện cảnh báo rõ nếu Pyodide chưa sẵn sàng =====
  function patchRunButtons(){
    const btnRun = $("btnRun");
    const btnTest = $("btnTest");
    if(btnRun && !btnRun.__patchedV5){
      btnRun.__patchedV5 = true;
      btnRun.addEventListener("click", ()=>{
        if(window.pyReady === false){
          toast("⏳ Python chưa sẵn sàng. Đợi 1 chút rồi bấm Run/Test lại.");
        }
      }, true);
    }
    if(btnTest && !btnTest.__patchedV5){
      btnTest.__patchedV5 = true;
      btnTest.addEventListener("click", ()=>{
        if(window.pyReady === false){
          toast("⏳ Python chưa sẵn sàng. Đợi 1 chút rồi bấm Run/Test lại.");
        }
      }, true);
    }
  }

  // ===== PATCH — Student UI tối giản: chỉ 4 nút (Gợi ý, Run, Nạp kết quả GV, Trợ giúp GV)
  // Không xóa chức năng: chỉ ẩn phần dư và gán hành động vào đúng nút.
  function patchStudentSimplifiedUI(){
    try{
      if(!window.__USER) return; // chỉ áp dụng cho màn học sinh

      // Fit 1 màn hình: đo đúng chiều cao header để CSS calc chính xác
      if(!window.__onePageHdr){
        window.__onePageHdr = true;
        const apply = ()=>{
          try{
            const tb = document.querySelector('.topbar');
            if(tb){
              const h = Math.max(72, Math.round(tb.getBoundingClientRect().height||0));
              document.body.style.setProperty('--topbar-h', h + 'px');
            }
            // Bật chế độ "compact" khi màn hình nhỏ để tự co giãn *toàn bộ* layout.
            // Lưu ý: nhiều máy dùng zoom/toolbar khác nhau => innerHeight có thể "đủ" nhưng editor lại bị bé.
            // Vì vậy ngoài ngưỡng w/h, ta còn kiểm tra chiều cao editor thực tế.
            // (không đổi tính năng, chỉ đổi cách sắp xếp/padding/height theo CSS)
            try{
              const h = (window.innerHeight||0);
              const w = (window.innerWidth||0);
              let compact = false;
              // ngưỡng rộng hơn một chút để bắt đúng các laptop 1366x768, remote viewer, zoom 90%...
              if(h && h < 820) compact = true;
              if(w && w < 1100) compact = true;
              // nếu editor thực tế bị bé, ép compact để ưu tiên code
              try{
                const cm = document.querySelector('.CodeMirror');
                if(cm){
                  const rh = cm.getBoundingClientRect().height||0;
                  if(rh && rh < 320) compact = true;
                }
              }catch(__){ }

              document.body.classList.toggle('compact-ui', !!compact);
              // thêm cả trên <html> để bạn dễ kiểm tra trong Console
              try{ document.documentElement.classList.toggle('compact-ui', !!compact); }catch(__){ }
            }catch(_){ }
            // CodeMirror đôi khi không tự resize đúng trên màn hình nhỏ/zoom khác
            // -> refresh nhẹ để editor khớp kích thước mới (không đổi UI/tính năng)
            try{
              const ed = window.__editor;
              if(ed && typeof ed.refresh === 'function') ed.refresh();
            }catch(_){}
          }catch(e){}
        };
        apply();
        window.addEventListener('resize', apply);
        setTimeout(apply, 50);
        setTimeout(apply, 400);
      }

      const btnHint = $("btnHint");
      const drawer  = $("studentToolsDrawer");
      if(btnHint && drawer && !btnHint.__simp){
        btnHint.__simp = true;
        btnHint.addEventListener("click", ()=>{
          const open = (drawer.style.display === "block");
          drawer.style.display = open ? "none" : "block";
          // mở drawer xong thì bật gợi ý autocomplete luôn (nhanh, đúng ý)
          try{
            const ed = window.__editor;
            if(!open && ed && window.CodeMirror){
              window.CodeMirror.showHint(ed, window.__customPythonHint || undefined, {completeSingle:false, extraKeys: (window.HINT_EXTRA_KEYS||undefined)});
            }
          }catch(e){}
        });
      }

      // Kho học liệu: mở trang riêng để tìm video YouTube theo bài học
      const btnLibrary = $("btnLibrary");
      if(btnLibrary && !btnLibrary.__simp){
        btnLibrary.__simp = true;
        btnLibrary.addEventListener("click", ()=>{
          try{
            const t = ($("pickTitle")?.textContent || $("hdrLessonName")?.textContent || "").trim();
            if(t) localStorage.setItem("py10:lastLessonTitle", t);
          }catch(e){}
          try{ window.open("./library.html", "_blank", "noopener"); }
          catch(e){ try{ location.href = "./library.html"; }catch(_){} }
        });
      }


      // Nạp kết quả GV: lưu nháp + xuất Excel nhật ký (để gửi giáo viên)
      const btnSave = $("btnSave");
      if(btnSave && !btnSave.__simp){
        btnSave.__simp = true;
        btnSave.addEventListener("click", ()=>{
          try{ if(typeof window.__saveProgress === "function") window.__saveProgress(); }catch(e){}
          try{ if(typeof window.__exportExcel  === "function") window.__exportExcel();  }catch(e){}
          try{ toast("✅ Đã nạp kết quả (đã tải file Excel)"); }catch(e){}
        });
      }

      // Run: sau khi chạy xong, tự gọi Test để chấm PASS (vì nút Test đã ẩn)
      const btnRun = $("btnRun");
      if(btnRun && !btnRun.__simpAutoTest){
        const old = btnRun.onclick;
        if(typeof old === "function"){
          btnRun.__simpAutoTest = true;
          btnRun.onclick = async function(ev){
            // chạy như cũ
            const r = old.call(this, ev);
            try{ if(r && typeof r.then === "function") await r; }catch(e){}
            // nếu console đang báo lỗi, bỏ qua test
            try{
              const c = $("console");
              const txt = (c && c.textContent) ? c.textContent.trim() : "";
              if(txt.startsWith("❌")) return;
            }catch(e){}
            try{ if(typeof window.runTests === "function") await window.runTests(); }catch(e){}
          };
        }
      }

      // Ẩn hẳn phần tab/panel phụ (nếu có) — đã có CSS, nhưng thêm fallback
      try{ const tabs = document.querySelector(".tabs"); if(tabs) tabs.style.display = "none"; }catch(e){}
    }catch(e){}
  }



  // ===== 4) PATCH V12 — Fix FlowBox (Đã đọc đề → Ý tưởng → Code → Test)
  // Mục tiêu: chỉ làm cho 4 nút + ô Ý tưởng hoạt động đúng, không đổi UI.
  function patchFlowBoxV12(){
    try{
      if(!window.__USER) return; // chỉ cho HS
      const stepRead = $("stepRead");
      const stepIdea = $("stepIdea");
      const stepCode = $("stepCode");
      const stepTest = $("stepTest");
      const ideaText = $("ideaText");
      const flowHint = $("flowHint");
      if(!stepRead || !stepIdea || !stepCode || !stepTest || !ideaText) return;

      const uid = window.__USER && window.__USER.id ? String(window.__USER.id) : "";
      const FLOW_KEY = `py10:flow:${uid}`;

      function loadFlow(){
        try{ return JSON.parse(localStorage.getItem(FLOW_KEY)||"{}")||{}; }catch{ return {}; }
      }
      function saveFlow(all){
        try{ localStorage.setItem(FLOW_KEY, JSON.stringify(all||{})); }catch{}
      }
      function getTaskId(){
        try{ return (window.current && window.current.id) ? String(window.current.id) : ""; }catch{ return ""; }
      }
      function getState(){
        const all = loadFlow();
        const tid = getTaskId();
        return { all, tid, st: (all[tid]||{}) };
      }
      function setState(patch){
        const x = getState();
        if(!x.tid) return;
        x.all[x.tid] = Object.assign({}, x.st, patch);
        saveFlow(x.all);
      }

      // Expose để các chỗ khác (patchLessonChangeHooks) gọi được
      window.applyFlowLocks = function applyFlowLocks(){
        const x = getState();
        const st = x.st || {};
        const read = !!st.read;
        const idea = !!st.idea;
        const code = !!st.code;
        const test = !!st.test;

        // restore draft
        try{ if(typeof st.ideaText === 'string') ideaText.value = st.ideaText; }catch{}

        // enable/disable theo tiến độ
        ideaText.disabled = !read;
        stepIdea.disabled = !read;
        stepCode.disabled = !idea;
        stepTest.disabled = !code;

        // hint
        if(flowHint){
          flowHint.innerHTML = !read
            ? "Bắt đầu bằng việc bấm <b>1) Đã đọc đề</b>."
            : (!idea
              ? "✅ Đã đọc đề. Hãy viết <b>Ý tưởng</b> rồi bấm <b>2) Đã viết ý tưởng</b>."
              : (!code
                ? "✅ Đã có ý tưởng. Hãy viết <b>Code</b> rồi bấm <b>3) Đã viết code</b>."
                : (!test
                  ? "✅ Đã có code. Hãy bấm <b>Test</b>, sau đó bấm <b>4) Đã Test</b>."
                  : "🎉 Hoàn thành đủ 4 bước!")));
        }
      };

      window.initFlowUI = function initFlowUI(){
        if(stepRead.__flowBound) { try{ window.applyFlowLocks(); }catch{}; return; }
        stepRead.__flowBound = true;

        // persist idea draft while typing
        ideaText.addEventListener('input', ()=>{
          try{ setState({ ideaText: ideaText.value }); }catch{}
        });

        stepRead.addEventListener('click', ()=>{
          setState({ read:true });
          try{ window.applyFlowLocks(); }catch{}
          try{ ideaText.focus(); }catch{}
        });

        stepIdea.addEventListener('click', ()=>{
          const v = (ideaText.value||"").trim();
          // cho phép để trống nhưng khuyến khích viết
          setState({ idea:true, ideaText: ideaText.value });
          try{ window.applyFlowLocks(); }catch{}
        });

        stepCode.addEventListener('click', ()=>{
          // coi như đã viết code nếu editor có nội dung
          let codeTxt = "";
          try{ codeTxt = getCode(); }catch{}
          if((codeTxt||"").trim().length < 1){
            toast("⚠️ Bạn chưa viết code. Hãy viết ít nhất 1 dòng rồi bấm lại.");
            return;
          }
          setState({ code:true });
          try{ window.applyFlowLocks(); }catch{}
        });

        stepTest.addEventListener('click', ()=>{
          setState({ test:true });
          try{ window.applyFlowLocks(); }catch{}
        });

        // Khi bấm Run/Test, tự đánh dấu đã viết code (nếu có code)
        const btnRun = $("btnRun");
        const btnTest = $("btnTest");
        const autoMarkCode = ()=>{
          let codeTxt = "";
          try{ codeTxt = getCode(); }catch{}
          if((codeTxt||"").trim().length) setState({ code:true });
        };
        if(btnRun && !btnRun.__flowAuto){
          btnRun.__flowAuto = true;
          btnRun.addEventListener('click', ()=>{ try{ autoMarkCode(); window.applyFlowLocks(); }catch{} }, true);
        }
        if(btnTest && !btnTest.__flowAuto){
          btnTest.__flowAuto = true;
          btnTest.addEventListener('click', ()=>{ try{ autoMarkCode(); window.applyFlowLocks(); }catch{} }, true);
        }

        // first render
        try{ window.applyFlowLocks(); }catch{}
      };

      // init now
      try{ window.initFlowUI(); }catch{}

    }catch(e){ /* silent */ }
  }
  // init once DOM ready
  
  /* =========================================================
     PATCH V6 — Nhóm + Lọc • Chống copy/paste (log+cảnh báo+báo cáo) • Rubric 50/30/20
     (giữ nguyên các tính năng cũ)
     ========================================================= */

  function groupOfStudentId(id){
    const n = parseInt(String(id||"").replace(/\D/g,''), 10);
    if(!Number.isFinite(n)) return "";
    return String(((n-1)%4)+1);
  }

  function ensureTeacherFilters(){
    const selC = $("filterClass");
    const selG = $("filterGroup");
    const btnClear = $("btnClearFilters");
    if(!selC || selC.__patchedV6) return;
    selC.__patchedV6 = true;

    // populate classes from STUDENTS
    try{
      const classes = Array.from(new Set((STUDENTS||[]).map(s=>s.class).filter(Boolean))).sort();
      classes.forEach(c=>{
        const opt=document.createElement("option");
        opt.value=c; opt.textContent=c;
        selC.appendChild(opt);
      });
    }catch{}

    const refresh = ()=>{ try{ window.refreshAll && window.refreshAll(); }catch{} };

    selC.addEventListener("change", refresh);
    if(selG) selG.addEventListener("change", refresh);
    if(btnClear){
      btnClear.addEventListener("click", ()=>{
        selC.value = "";
        if(selG) selG.value = "";
        refresh();
      });
    }
  }

  function getFilterPredicate(){
    const selC = $("filterClass");
    const selG = $("filterGroup");
    const c = selC ? String(selC.value||"") : "";
    const g = selG ? String(selG.value||"") : "";
    return (st)=>{
      if(c && String(st.class||"") !== c) return false;
      if(g && groupOfStudentId(st.id) !== g) return false;
      return true;
    };
  }

  function normalizeLoose(s){
    // Loose compare for "trình bày output": bỏ khoảng trắng cuối dòng, gom CR, đảm bảo xuống dòng cuối không bắt buộc
    const x = String(s ?? "").replace(/\r/g,"").split("\n").map(line=>line.replace(/[ \t]+$/g,"")).join("\n");
    // remove extra final newline(s)
    return x.replace(/\n+$/g,"");
  }

  function getRubricStoreKey(studentId){ return `py10:rubric:${studentId}`; }
  function loadRubric(studentId){
    try{ return JSON.parse(localStorage.getItem(getRubricStoreKey(studentId))||"{}")||{}; }catch{ return {}; }
  }
  function saveRubric(studentId, obj){
    try{ localStorage.setItem(getRubricStoreKey(studentId), JSON.stringify(obj||{})); }catch{}
  }

  function computeStructurePoints(code){
    try{
      const arr = (typeof analyzeChecklist === "function") ? analyzeChecklist(code||"") : [];
      const total = arr.length || 1;
      const ok = arr.filter(x=>x && x.ok).length;
      return Math.round((ok/total)*30);
    }catch{
      return 0;
    }
  }

  function computePresentationPoints(strictPassAll, outLooseMatch){
    if(strictPassAll) return 20;
    // nếu sai do trình bày (loose match) vẫn cho điểm một phần
    if(outLooseMatch) return 10;
    return 0;
  }

  function patchRunTestsRubric(){
    const btnTest = $("btnTest");
    if(!btnTest || btnTest.__patchedRubricV6) return;
    btnTest.__patchedRubricV6 = true;

    // replace window.runTests to capture outputs and compute rubric
    const runTests0 = window.runTests;
    if(typeof runTests0 !== "function" || runTests0.__wrappedV6) return;

    function getRequiredByLesson(lesson, code){
      // Heuristic "PASS theo cấu trúc" cho TẤT CẢ bài: dựa vào skill/title/text.
      const title = String(lesson && lesson.title || "").toLowerCase();
      const skill = String(lesson && lesson.skill || "").toLowerCase();
      const text  = String(lesson && lesson.text  || "").toLowerCase();
      const inputSpec = String(lesson && lesson.input || "");
      const needInput = !/không\s*có|khong\s*co|không|khong/i.test(inputSpec);

      const req = [];
      // Mặc định: hầu hết bài cần in kết quả
      req.push({name:"print(...)" , ok: /\bprint\s*\(/.test(code)});
      if(needInput){
        req.push({name:"input()", ok: /\binput\s*\(/.test(code) || /sys\.stdin|stdin\.read|readline\s*\(/i.test(code)});
      }
      // Điều kiện
      if(/\bif\b|rẽ nhánh|phan\s*loai|xep\s*loai|điều\s*kiện|đk/.test(title+" "+skill+" "+text)){
        req.push({name:"if", ok: /\bif\b/.test(code)});
      }
      // Vòng lặp
      if(/vòng\s*lặp|lap|\bfor\b|\bwhile\b|dãy|từ\s*1\s*đến|from\s*1\s*to|n\s*bai/.test(title+" "+skill+" "+text)){
        // chấp nhận for hoặc while
        req.push({name:"for/while", ok: /\bfor\b/.test(code) || /\bwhile\b/.test(code)});
      }
      // Hàm
      if(/\bhàm\b|function|def\b/.test(title+" "+skill+" "+text)){
        req.push({name:"def", ok: /\bdef\s+\w+\s*\(/.test(code)});
      }
      // Danh sách/mảng
      if(/danh\s*sách|list|mảng|array/.test(title+" "+skill+" "+text)){
        req.push({name:"list", ok: /\[/.test(code) || /\blist\s*\(/.test(code) || /\.append\s*\(/.test(code)});
      }
      // Chia hết/mod/nguyên tố
      if(/chia\s*hết|nguyên\s*tố|mod|%/.test(title+" "+skill+" "+text)){
        req.push({name:"%", ok: /%/.test(code)});
      }
      // Toán tử cơ bản: nếu bài có "tổng/hiệu/tích/thương"
      if(/tổng|sum/.test(title+" "+text)) req.push({name:"+", ok: /\+/.test(code)});
      if(/hiệu|difference/.test(title+" "+text)) req.push({name:"-", ok: /-/.test(code)});
      if(/tích|product/.test(title+" "+text)) req.push({name:"*", ok: /\*/.test(code)});
      if(/thương|quotient|chia/.test(title+" "+text)) req.push({name:"/", ok: /\//.test(code)});

      return req;
    }

    window.runTests = async function(){
      const code = getCode();
      const lesson = window.current || {};
      const tests = (lesson.tests && Array.isArray(lesson.tests)) ? lesson.tests : [];
      const totalN = tests.length || 1;

      const req = getRequiredByLesson(lesson, code);
      const missing = req.filter(x=>x && x.ok===false).map(x=>x.name);
      const okStruct = (missing.length === 0);

      // chạy 1 lần để bắt lỗi cú pháp/runtime (nếu có)
      let out = "";
      let err = "";
      try{
        const stdin = (tests[0] && typeof tests[0].stdin === "string") ? tests[0].stdin : "";
        const res = await runPython(code, stdin);
        out = res && res.stdout ? String(res.stdout) : "";
        err = res && res.error ? String(res.error) : "";
      }catch(e){
        err = String(e);
      }

      const okRun = !(err && err.trim());
      let pass = 0;

      if(okRun && okStruct){
        pass = totalN;
        $("console").textContent =
          `✅ PASS (Theo cấu trúc)\n` +
          `- Điều kiện: ${req.filter(x=>x && x.ok).map(x=>x.name).join(" + ") || "(mặc định)"}\n` +
          `- Lưu ý: không yêu cầu đúng từng chữ output.\n\n` +
          `Output chạy thử:\n${out}`;

        // ✅ Khi PASS theo cấu trúc: cập nhật PASS thật để mở khóa + tăng tiến trình
        try{
          if(window.markPassed && typeof window.markPassed === "function"){
            const lid = (lesson && lesson.id) ? lesson.id : (window.current && window.current.id);
            const prog = window.progress || {};
            if(lid && !(prog.passed && prog.passed[lid])){
              window.markPassed(lid);
              try{ window.logEvent && logEvent("pass", {mode:"struct"}); }catch(e){}
            }
          }
        }catch(e){}
      } else {
        const missTxt = okStruct ? "" : ("Thiếu: " + missing.join(", "));
        const errTxt = okRun ? "" : ("Lỗi chạy: " + err.trim());
        const join = (missTxt && errTxt) ? ("\n" + errTxt) : (errTxt || "");
        $("console").textContent =
          `❌ FAIL\n${missTxt}${join}\n\nOutput chạy thử:\n${out}`;
      }

      // Rubric đơn giản để UI vẫn hiển thị: Kết quả (0/50 hoặc 50/50), Cấu trúc (0-30), Trình bày (0/20)
      const scoreResult = pass ? 50 : 0;
      const scoreStruct = okStruct ? 30 : 0;
      const scorePresent = 0;
      const total = scoreResult + scoreStruct + scorePresent;
      try{
        window.lastTestsResult = `Đạt ${pass}/${totalN} test\n\nRubric: ${total}/100 (Kết quả ${scoreResult}/50 • Cấu trúc ${scoreStruct}/30 • Trình bày ${scorePresent}/20)`;
      }catch{}

      try{ window.updateCoach && updateCoach(); }catch{}
      try{ window.updateGuard && updateGuard(); }catch{}
      try{ window.updateInlineGhost && updateInlineGhost(getEditor()); }catch{}

      return {pass, total: totalN, rubric: total};
    };
    window.runTests.__wrappedV6 = true;
  }

  function patchPasteLogging(){
    const editorEl = $("codeEditor") || $("code");
    if(!editorEl || editorEl.__patchedPasteLogV6) return;
    editorEl.__patchedPasteLogV6 = true;

    // per lesson warning once
    const warnKey = ()=> {
      const u = window.__USER; const lid = (window.current && current.id) ? current.id : "";
      return u && u.id && lid ? `py10:pastewarn:${u.id}:${lid}` : "";
    };

    const maybeWarn = ()=>{
      const pr = (window.__pasteRatio && __pasteRatio()) || 0;
      const typed = editorEl.__typedChars||0;
      const pasted = editorEl.__pastedChars||0;
      const total = typed + pasted;
      if(total < 80) return; // ignore very short code
      if(pr >= 0.70){
        const k = warnKey();
        if(k && !localStorage.getItem(k)){
          localStorage.setItem(k, "1");
          try{ window.toast && toast("⚠️ Phát hiện dán nhiều nội dung. Hãy tự gõ lại từng phần để hiểu rõ hơn."); }catch{}
          try{ window.logEvent && logEvent("paste_warn", { pasteRatio: pr, typed, pasted }); }catch{}
        }
      }
    };

    editorEl.addEventListener("beforeinput", (e)=>{
      // existing counters are already updated in v4; here we only warn+log when needed
      setTimeout(maybeWarn, 0);
    }, true);
    editorEl.addEventListener("paste", ()=>{
      setTimeout(maybeWarn, 0);
    }, true);
    // reset counters when switching lessons (tách tỉ lệ dán theo từng bài)
    try{
      const open0 = window.__openLesson;
      if(typeof open0 === "function" && !open0.__patchedPasteResetV6){
        window.__openLesson = function(id){
          try{ editorEl.__typedChars = 0; editorEl.__pastedChars = 0; }catch{}
          return open0(id);
        };
        window.__openLesson.__patchedPasteResetV6 = true;
      }
    }catch{}

  }

  function patchLogEventPasteMeta(){
    const le0 = window.logEvent;
    if(typeof le0 !== "function" || le0.__patchedMetaV6) return;
    const wrapped = function(type, payload){
      const pr = (window.__pasteRatio && __pasteRatio()) || 0;
      const editorEl = $("codeEditor") || $("code");
      const typed = editorEl ? (editorEl.__typedChars||0) : 0;
      const pasted = editorEl ? (editorEl.__pastedChars||0) : 0;
      const extra = { pasteRatio: pr, typedChars: typed, pastedChars: pasted };
      return le0.call(this, type, Object.assign({}, payload||{}, extra));
    };
    wrapped.__patchedMetaV6 = true;
    window.logEvent = wrapped;
  }

  function patchTeacherTablesV6(){
    // Wrap renderMonitor to add columns + filter + show group/paste/rubric
    const rm0 = window.renderMonitor;
    if(typeof rm0 === "function" && !rm0.__patchedV6){
      window.renderMonitor = function(){
        const assigns = (window.loadAssign ? loadAssign() : []).filter(a=>a && a.active !== false).slice(0,8);
        const head = $("tbHead");
        head.innerHTML = "";
        const cols = ["Mã HS","Họ tên","Lớp","Nhóm","Paste %","Rubric TB","Hoạt động gần nhất"];
        cols.forEach(t=>{ const th=document.createElement("th"); th.textContent=t; head.appendChild(th); });
        assigns.forEach(a=>{
          const th=document.createElement("th");
          const due = a.due ? (" (hạn "+fmtDate(a.due)+")") : "";
          th.textContent = (a.lessonId + due);
          head.appendChild(th);
        });

        const body = $("tbBody"); body.innerHTML = "";
        const pred = getFilterPredicate();
        (STUDENTS||[]).filter(pred).forEach(st=>{
          const prog = loadJSON(progKey(st.id), {unlocked:{}, passed:{}, passCount:0});
          const logs = loadJSON(logKey(st.id), {events:[]});
          const last = lastActivityFromLogs(logs);
          const gid = groupOfStudentId(st.id);

          // paste avg 7d
          const since = Date.now() - 7*24*3600*1000;
          let prSum=0, prN=0, warn=0;
          (logs.events||[]).forEach(e=>{
            const t = new Date(e.t||"").getTime();
            if(!t || t<since) return;
            if(e.type==="paste_warn") warn++;
            if((e.type==="run" || e.type==="test") && typeof e.pasteRatio === "number"){
              prSum += e.pasteRatio; prN++;
            }
          });
          const prAvg = prN ? (prSum/prN) : 0;

          // rubric avg 7d (from rubric store)
          let rbAvg = 0;
          try{
            const rs = loadRubric(st.id);
            const vals = Object.values(rs||{}).filter(x=>x && x.ts && x.ts>=since).map(x=>Number(x.score||0));
            rbAvg = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
          }catch{}

          const tr=document.createElement("tr");
          const tds = [
            `<td>${st.id}</td>`,
            `<td>${escapeHtml(st.name||"")}</td>`,
            `<td>${escapeHtml(st.class||"")}</td>`,
            `<td>Nhóm ${gid||"—"}</td>`,
            `<td>${Math.round(prAvg*100)}%</td>`,
            `<td>${rbAvg ? (rbAvg+"/100") : "—"}</td>`,
            `<td>${last ? last.replace("T"," ").replace("Z","") : ""}</td>`
          ];
          tr.innerHTML = tds.join("");

          assigns.forEach(a=>{
            const td=document.createElement("td");
            const done = !!(prog.passed && prog.passed[a.lessonId]);
            const rb = (function(){
              try{ const rs = loadRubric(st.id); return rs && rs[a.lessonId] ? rs[a.lessonId].score : null; }catch{ return null; }
            })();
            if(done){
              td.innerHTML = '<span class="chip" style="background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.28);color:#14532d;">Hoàn thành</span>'
                           + (rb!=null ? ` <span class="muted">(${rb}/100)</span>` : "");
            }else{
              const code = getStudentCode(st.id, a.lessonId);
              const ck = analyzeChecklistForLesson(code, a.lessonId);
              const pct = Math.round(ck.ok*100/ck.total);
              td.innerHTML = '<span class="chip" style="background:rgba(245,158,11,.10);border-color:rgba(245,158,11,.28);color:#7c2d12;">Chưa</span>'
                           + ` <span class="muted">(${pct}%)</span>`
                           + (rb!=null ? ` <span class="muted">• ${rb}/100</span>` : "");
            }
            // warn icon if any paste_warn in 7d
            if(warn>0){
              td.innerHTML += ` <span title="Có cảnh báo dán nhiều nội dung trong 7 ngày">⚠️</span>`;
            }
            tr.appendChild(td);
          });

          body.appendChild(tr);
        });

        // KPI keep original computation if exists
        try{
          const kpi = computeKPIs(assigns);
          const kpiBox = $("kpiBox");
          if(kpiBox){
            kpiBox.innerHTML = "";
            const chips = [
              `Bài đang giao: <b>${kpi.assigns}</b>`,
              `HS có hoạt động: <b>${kpi.activeStudents}/${(STUDENTS||[]).length}</b>`,
              `Hoàn thành nhiệm vụ: <b>${kpi.done}/${kpi.need}</b>`,
              `Tỉ lệ hoàn thành: <b>${kpi.rate}%</b>`
            ];
            chips.forEach(t=>{ const s=document.createElement("span"); s.className="chip"; s.innerHTML=t; kpiBox.appendChild(s); });
          }
        }catch{}
      };
      window.renderMonitor.__patchedV6 = true;
    }

    // Wrap renderWeekly to include class/group/paste/rubric
    const rw0 = window.renderWeekly;
    if(typeof rw0 === "function" && !rw0.__patchedV6){
      window.renderWeekly = function(){
        const days = 7;
        const since = Date.now() - days*24*3600*1000;

        let classPass=0, classRun=0, classTest=0;

        const body = $("tbWeekBody"); body.innerHTML = "";
        const pred = getFilterPredicate();

        (STUDENTS||[]).filter(pred).forEach(st=>{
          const logs = loadJSON(logKey(st.id), {events:[]});
          let pass=0, run=0, test=0, hint=0, ghost=0;
          let last="";
          let prSum=0, prN=0, warn=0;

          (logs.events||[]).forEach(e=>{
            const t = new Date(e.t||"").getTime();
            if(!t) return;
            if(t > since){
              if(e.type==="pass") pass++;
              if(e.type==="run") run++;
              if(e.type==="test") test++;
              if(e.type==="hint") hint++;
              if(e.type==="ghost") ghost++;
              if(e.type==="paste_warn") warn++;
              if((e.type==="run" || e.type==="test") && typeof e.pasteRatio === "number"){
                prSum += e.pasteRatio; prN++;
              }
              if(!last || t > new Date(last).getTime()) last = e.t;
            }
          });

          classPass += pass; classRun += run; classTest += test;

          const gid = groupOfStudentId(st.id);
          const prAvg = prN ? (prSum/prN) : 0;

          // rubric avg 7d
          let rbAvg = 0;
          try{
            const rs = loadRubric(st.id);
            const vals = Object.values(rs||{}).filter(x=>x && x.ts && x.ts>=since).map(x=>Number(x.score||0));
            rbAvg = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
          }catch{}

          const tr=document.createElement("tr");
          tr.innerHTML = `
            <td>${st.id}</td>
            <td>${escapeHtml(st.name||"")}</td>
            <td>${escapeHtml(st.class||"")}</td>
            <td>Nhóm ${gid||"—"}</td>
            <td><b>${pass}</b></td>
            <td>${run}</td>
            <td>${test}</td>
            <td>${Math.round(prAvg*100)}%</td>
            <td>${warn ? ("⚠️ "+warn) : "—"}</td>
            <td>${rbAvg ? (rbAvg+"/100") : "—"}</td>
            <td>${hint}</td>
            <td>${ghost}</td>
            <td>${last ? last.replace("T"," ").replace("Z","") : ""}</td>
          `;
          body.appendChild(tr);
        });

        const note = $("weekNote");
        if(note){
          note.innerHTML = `Tổng lớp (7 ngày): <b>${classPass}</b> PASS • <b>${classRun}</b> lần Run • <b>${classTest}</b> lần Test.`;
        }
      };
      window.renderWeekly.__patchedV6 = true;
    }

    // Make refreshAll callable from filter changes
    if(!window.refreshAll){
      // Try to expose if exists in closure (best effort)
      try{ window.refreshAll = window.refreshAll || function(){ try{ renderAssignList(); renderMonitor(); renderErrorStats(); renderWeekly(); }catch{} }; }catch{}
    }
  }


  /* ======================================================
     v11: Chấm điểm theo bài + Trợ giúp HS -> GV (local)
     - Giữ nguyên giao diện cũ, chỉ thêm chức năng
     ====================================================== */

  function helpKey(){ return "py10:helpTickets"; }
  function loadHelpTickets(){
    try{ return JSON.parse(localStorage.getItem(helpKey())||"[]") || []; }catch{ return []; }
  }
  function saveHelpTickets(arr){
    try{ localStorage.setItem(helpKey(), JSON.stringify(arr||[])); }catch{}
  }
  function nowId(){
    return "H" + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  }
  function short(s, n=80){
    s = String(s||"").replace(/\s+/g," ").trim();
    return s.length>n ? (s.slice(0,n-1)+"…") : s;
  }
  function getLessonTitle(){
    try{
      return (current && (current.title || current.name || current.id)) || "";
    }catch{ return ""; }
  }
  function getEditorCode(){
    try{ return getCode(); }catch{ return ""; }
  }
  function getConsoleText(){
    try{ return ($("console") && $("console").textContent) ? $("console").textContent : ""; }catch{ return ""; }
  }
  function latestErrorHint(consoleText){
    const s = String(consoleText||"");
    // ưu tiên phần có chữ ERROR/Traceback
    const idx = Math.max(s.lastIndexOf("Traceback"), s.lastIndexOf("ERROR"), s.lastIndexOf("SyntaxError"), s.lastIndexOf("NameError"), s.lastIndexOf("TypeError"));
    if(idx>=0) return s.slice(idx).slice(0,1200);
    return s.slice(-800);
  }

  // ---- Export/Import package to support different devices/browsers (no server) ----
  function _b64encUtf8(s){
    try{ return btoa(unescape(encodeURIComponent(String(s||"")))); }catch{ return ""; }
  }
  function _b64decUtf8(s){
    try{ return decodeURIComponent(escape(atob(String(s||"")))); }catch{ return ""; }
  }
  function encodeHelpPackageFromTicket(t){
    try{
      const pack = {
        v: 1,
        id: t.id || "",
        ts: t.ts || Date.now(),
        studentId: t.studentId || "",
        studentName: t.studentName || "",
        class: t.class || "",
        group: t.group || "",
        lessonId: t.lessonId || "",
        lessonTitle: t.lessonTitle || "",
        note: t.note || "",
        code: t.code || "",
        lastError: t.lastError || "",
        console: t.console || "",
        pasteRatio: t.pasteRatio || 0
      };
      return "PY10HELP:" + _b64encUtf8(JSON.stringify(pack));
    }catch{ return ""; }
  }
  function decodeHelpPackage(str){
    const s = String(str||"").trim();
    const raw = s.startsWith("PY10HELP:") ? s.slice(8) : s;
    const jsonText = _b64decUtf8(raw);
    if(!jsonText) return null;
    try{ return JSON.parse(jsonText); }catch{ return null; }
  }
  function importHelpPackage(str){
    const pack = decodeHelpPackage(str);
    if(!pack || !pack.studentId) return {ok:false, msg:"Mã không hợp lệ."};

    const arr = loadHelpTickets();
    // avoid duplicates by id OR (studentId+ts)
    const exists = arr.some(x=>x && ((pack.id && x.id===pack.id) || (x.studentId===pack.studentId && (x.ts||0)===(pack.ts||0))));
    if(exists) return {ok:true, msg:"Đã có trong danh sách (không nhập trùng).", existed:true};

    const t = {
      id: pack.id || nowId(),
      ts: pack.ts || Date.now(),
      status: "open",
      studentId: pack.studentId || "",
      studentName: pack.studentName || "",
      class: pack.class || "",
      group: pack.group || "",
      lessonId: pack.lessonId || "",
      lessonTitle: pack.lessonTitle || "",
      note: pack.note || "",
      code: pack.code || "",
      console: pack.console || "",
      lastError: pack.lastError || "",
      pasteRatio: pack.pasteRatio || 0,
      lastRun: null,
      reply: "",
      replyTs: 0
    };
    arr.push(t);
    saveHelpTickets(arr);
    return {ok:true, msg:"✅ Đã nhập mã trợ giúp.", ticketId: t.id};
  }


  function createHelpTicket(note){
    const u = window.__USER;
    if(!u || !u.id) return { ok:false, msg:"Chưa đăng nhập." };

    const code = getEditorCode();
    const con = getConsoleText();
    const grp = (typeof groupOfStudentId === "function") ? groupOfStudentId(u.id) : "";
    const pr  = (window.__pasteRatio && __pasteRatio()) || 0;

    const t = {
      id: nowId(),
      ts: Date.now(),
      status: "open",
      studentId: u.id,
      studentName: u.name || "",
      class: u.class || "",
      group: grp,
      lessonId: (current && current.id) ? current.id : "",
      lessonTitle: getLessonTitle(),
      note: String(note||"").trim(),
      code: code || "",
      console: con || "",
      lastError: latestErrorHint(con),
      pasteRatio: pr,
      lastRun: (window.__lastRun && window.__lastRun.lessonId===((current&&current.id)||"")) ? window.__lastRun : null,
      reply: "",
      replyTs: 0
    };

    const arr = loadHelpTickets();
    arr.push(t);
    saveHelpTickets(arr);
    try{ window.logEvent && logEvent("help", { ticket: t.id }); }catch{}
    return { ok:true, ticketId: t.id, ts: t.ts };
  }

  function studentLatestReply(){
    const u = window.__USER;
    if(!u || !u.id) return null;
    const arr = loadHelpTickets().filter(x=>x && x.studentId===u.id && x.reply && x.reply.trim());
    if(!arr.length) return null;
    arr.sort((a,b)=>(b.replyTs||0)-(a.replyTs||0));
    return arr[0];
  }

  function renderHelpTicketsTeacher(){
    const body = $("tbHelpBody");
    if(!body) return;
    const selC = $("filterClass");
    const selG = $("filterGroup");
    const fc = selC ? selC.value : "";
    const fg = selG ? selG.value : "";

    const arr0 = loadHelpTickets().filter(x=>x && x.studentId);
    // filters
    const arr = arr0.filter(t=>{
      if(fc && t.class !== fc) return false;
      if(fg && String(t.group||"") !== String(fg)) return false;
      return true;
    }).sort((a,b)=>(b.ts||0)-(a.ts||0));

    body.innerHTML = "";
    if(!arr.length){
      const tr=document.createElement("tr");
      tr.innerHTML = `<td colspan="9" class="muted">Chưa có câu hỏi trợ giúp.</td>`;
      body.appendChild(tr);
      return;
    }

    arr.forEach(t=>{
      const tr=document.createElement("tr");
      const time = new Date(t.ts||0).toISOString().replace("T"," ").replace("Z","");
      const st = t.status==="done" ? "Đã phản hồi" : "Chờ phản hồi";
      const stChip = t.status==="done"
        ? '<span class="chip" style="background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.28);color:#14532d;">Đã phản hồi</span>'
        : '<span class="chip" style="background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.28);color:#7c2d12;">Chờ</span>';

      tr.innerHTML = `
        <td>${time}</td>
        <td>${t.studentId}</td>
        <td>${t.studentName||""}</td>
        <td>${t.class||""}</td>
        <td>${t.group?("Nhóm "+t.group):""}</td>
        <td>${short(t.lessonTitle||t.lessonId||"", 30)}</td>
        <td>${stChip}</td>
        <td class="muted">${short(t.note, 50) || "—"}</td>
        <td><button class="btn" data-help-open="${t.id}">Xem</button></td>
      `;
      body.appendChild(tr);
    });

    // bind buttons
    body.querySelectorAll("[data-help-open]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-help-open");
        openHelpDetail(id);
      });
    });
  }

  function openHelpDetail(ticketId){
    const detail = $("helpDetail");
    if(!detail) return;
    const arr = loadHelpTickets();
    const t = arr.find(x=>x && x.id===ticketId);
    if(!t) return;

    window.__HELP_SELECTED = ticketId;

    $("helpMeta").textContent = `HS ${t.studentId} • ${(t.studentName||"")} • ${t.class||""} • ${t.group?("Nhóm "+t.group):""} • Bài: ${(t.lessonTitle||t.lessonId||"")} • Paste: ${Math.round((t.pasteRatio||0)*100)}%`;

    $("helpCode").textContent = t.code || "—";
    $("helpErr").textContent  = t.lastError || "—";
    $("helpReply").value = t.reply || "";
    $("helpReplyStatus").textContent = (t.status==="done")
      ? ("Đã phản hồi lúc: " + (t.replyTs? new Date(t.replyTs).toISOString().replace("T"," ").replace("Z",""):""))
      : "Chưa phản hồi.";

    detail.style.display = "block";
    try{ detail.scrollIntoView({behavior:"smooth", block:"start"}); }catch{}
  }

  function sendTeacherReply(){
    const id = window.__HELP_SELECTED;
    if(!id) return;
    const reply = ($("helpReply")?.value || "").trim();
    if(!reply){
      $("helpReplyStatus").textContent = "Vui lòng nhập phản hồi.";
      return;
    }
    const arr = loadHelpTickets();
    const t = arr.find(x=>x && x.id===id);
    if(!t) return;

    t.reply = reply;
    t.replyTs = Date.now();
    t.status = "done";
    saveHelpTickets(arr);

    $("helpReplyStatus").textContent = "✅ Đã gửi phản hồi.";
    renderHelpTicketsTeacher();
  }

  function clearHelpDone(){
    const arr = loadHelpTickets();
    const keep = arr.filter(t=>!(t && t.status==="done"));
    saveHelpTickets(keep);
    renderHelpTicketsTeacher();
    try{ $("helpDetail").style.display="none"; }catch{}
  }
function patchHelpUIV11(){
  const btnHelp = $("btnHelp");
  const helpBox = $("helpBox");
  const modal  = $("helpModal");

  const openStudentHelp = ()=>{
    // Ưu tiên modal để luôn có nút GỬI rõ ràng (ONEPAGE)
    if(modal){
      try{ modal.style.display = "block"; }catch{}
      const r = studentLatestReply();
      const st = $("helpModalStatus");
      if(st) st.innerHTML = r ? (`📩 Phản hồi mới nhất: <b>${short(r.reply, 120)}</b>`) : "—";
      try{ $("helpModalNote")?.focus(); }catch{}
      return;
    }
    // Fallback: helpBox cũ
    if(!helpBox) return;
    helpBox.style.display = (helpBox.style.display==="none" || !helpBox.style.display) ? "block" : "none";
    const r = studentLatestReply();
    if(r) $("helpStatus").innerHTML = `📩 Phản hồi mới nhất: <b>${short(r.reply, 120)}</b>`;
    else  $("helpStatus").textContent = "—";
  };

  // Bind modal (close + send)
  if(modal && !modal.__bound){
    modal.__bound = true;
    const close = ()=>{ try{ modal.style.display = "none"; }catch{} };

    const btnC = $("helpModalClose");
    const backdrop = modal.querySelector(".modal-backdrop");
    if(btnC) btnC.addEventListener("click", close);
    if(backdrop) backdrop.addEventListener("click", close);
    document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && modal.style.display==="block") close(); });

    const btnSendM = $("helpModalSend");
    if(btnSendM) btnSendM.addEventListener("click", ()=>{
      const note = ($("helpModalNote")?.value || "");
      const res = createHelpTicket(note);
      const st = $("helpModalStatus");
      if(res.ok){
        if(st) st.textContent = "✅ Đã gửi trợ giúp lúc " + new Date(res.ts).toISOString().replace("T"," ").replace("Z","");
        try{ $("helpModalNote").value=""; }catch{}
        setTimeout(close, 650);
      } else {
        if(st) st.textContent = "⚠️ " + (res.msg || "Không gửi được.");
      }
    });
  }

  // Nút Trợ giúp (student header)
  if(btnHelp && !btnHelp.__helpPatched){
    btnHelp.__helpPatched = true;
    btnHelp.addEventListener("click", openStudentHelp);
  }

  // Fallback helpBox (giữ nguyên)
  const btnClose = $("btnCloseHelp");
  if(btnClose && !btnClose.__helpPatched){
    btnClose.__helpPatched=true;
    btnClose.addEventListener("click", ()=>{ if(helpBox) helpBox.style.display="none"; });
  }

  const btnSend = $("btnSendHelp");
  if(btnSend && !btnSend.__helpPatched){
    btnSend.__helpPatched=true;
    btnSend.addEventListener("click", ()=>{
      const note = ($("helpNote")?.value || "");
      const res = createHelpTicket(note);
      if(res.ok){
        $("helpStatus").textContent = "✅ Đã gửi trợ giúp lúc " + new Date(res.ts).toISOString().replace("T"," ").replace("Z","");
        try{ $("helpNote").value=""; }catch{}
        // không cần xuất/nhập
        try{
          const wrap = $("helpPkgWrap");
          const ta = $("helpPackage");
          if(wrap) wrap.style.display = "none";
          if(ta) ta.value = "";
          const st = $("helpPkgStatus");
          if(st) st.textContent = "—";
        }catch{}
      } else {
        $("helpStatus").textContent = "⚠️ " + (res.msg || "Không gửi được.");
      }
    });
  }

  // ===== Teacher view bindings (hiển thị trực tiếp trên màn hình giáo viên) =====
  const bindTeacher = ()=>{
    const btnR = $("btnRefreshHelp");
    if(btnR && !btnR.__helpPatched){
      btnR.__helpPatched=true;
      btnR.addEventListener("click", renderHelpTicketsTeacher);
    }
    const btnClr = $("btnClearHelpDone");
    if(btnClr && !btnClr.__helpPatched){
      btnClr.__helpPatched=true;
      btnClr.addEventListener("click", clearHelpDone);
    }
    const btnSendReply = $("btnSendReply");
    if(btnSendReply && !btnSendReply.__helpPatched){
      btnSendReply.__helpPatched=true;
      btnSendReply.addEventListener("click", sendTeacherReply);
    }
    const btnCloseDetail = $("btnCloseDetail");
    if(btnCloseDetail && !btnCloseDetail.__helpPatched){
      btnCloseDetail.__helpPatched=true;
      btnCloseDetail.addEventListener("click", ()=>{ try{ $("helpDetail").style.display="none"; }catch{} });
    }

    // initial render
    renderHelpTicketsTeacher();

    // auto-refresh best effort
    try{
      if(!window.__HELP_AUTO_TIMER){
        window.__HELP_AUTO_TIMER = setInterval(()=>{
          try{
            const tr = $("teacherRoot");
            if(tr && tr.style.display !== "none"){ renderHelpTicketsTeacher(); }
          }catch{}
        }, 2500);
      }
    }catch{}

    // refresh when localStorage changes (nếu có tab khác)
    try{
      if(!window.__HELP_STORAGE_LISTENER){
        window.__HELP_STORAGE_LISTENER = true;
        window.addEventListener("storage", (e)=>{
          try{ if(e && e.key === helpKey()){ renderHelpTicketsTeacher(); } }catch{}
        });
      }
    }catch{}
  };

  // Chỉ bind teacher nếu có teacherRoot hoặc các nút teacher tồn tại
  if($("teacherRoot") || $("btnRefreshHelp") || $("helpTickets")){
    try{ bindTeacher(); }catch(e){}
  }
}

function boot(){
    patchTeacherAssign();
    patchTeacherTargetUI();
    patchLessonChangeHooks();
    patchRunButtons();

    // v12 flow box
    patchFlowBoxV12();

    // student simplified UI
    patchStudentSimplifiedUI();

    // v6
    ensureTeacherFilters();
    patchTeacherTablesV6();
    patchPasteLogging();
    patchLogEventPasteMeta();
    patchRunTestsRubric();
    patchHelpUIV11();
    try{ window.createHelpTicket = createHelpTicket; }catch(e){}
    scheduleAfterLogin();
  }
  // re-run patches when login state becomes available (HS/GV login happens after DOM ready)
  function scheduleAfterLogin(){
    if(window.__PATCH_LOGIN_WATCH) return;
    window.__PATCH_LOGIN_WATCH = true;
    let ticks = 0;
    const timer = setInterval(()=>{
      ticks++;
      try{
        // HS
        if(window.__USER && !window.__PATCHED_FOR_USER){
          window.__PATCHED_FOR_USER = true;
          try{ patchLessonChangeHooks(); }catch{}
          try{ patchRunButtons(); }catch{}
          try{ patchFlowBoxV12(); }catch{}
          try{ patchStudentSimplifiedUI(); }catch{}
          try{ patchRunTestsRubric(); }catch{}
          try{ patchHelpUIV11(); }catch{}
          try{ patchPasteLogging(); }catch{}
          try{ patchLogEventPasteMeta(); }catch{}
        }
        // GV
        if(window.__TEACHER && !window.__PATCHED_FOR_TEACHER){
          window.__PATCHED_FOR_TEACHER = true;
          try{ patchTeacherAssign(); }catch{}
          try{ patchTeacherTargetUI(); }catch{}
          try{ ensureTeacherFilters(); }catch{}
          try{ patchTeacherTablesV6(); }catch{}
          try{ patchHelpUIV11(); }catch{}
        }
      }catch{}
      if((window.__PATCHED_FOR_USER||!window.__USER) && (window.__PATCHED_FOR_TEACHER||!window.__TEACHER) && ticks>5){
        // keep a bit to catch late DOM, then stop
        if(ticks>50){ clearInterval(timer); }
      }
      if(ticks>80) clearInterval(timer);
    }, 200);
  }


  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
