
/* =========================
   LOGIN DATA (from Excel)
   ========================= */
const STUDENTS = [{"id": "hs1", "name": "Nguyễn Hồ Hoài Anh", "class": "10A1"}, {"id": "hs2", "name": "Phạm Ngọc Gia Bảo", "class": "10A1"}, {"id": "hs3", "name": "Đậu Huyền Khánh Băng", "class": "10A1"}, {"id": "hs4", "name": "Nguyễn Lê Hải Băng", "class": "10A1"}, {"id": "hs5", "name": "Nguyễn Khánh Chi", "class": "10A1"}, {"id": "hs6", "name": "Nguyễn Thị Quỳnh Chi", "class": "10A1"}, {"id": "hs7", "name": "Chu Mạnh Cường", "class": "10A1"}, {"id": "hs8", "name": "Trần Mạnh Cường", "class": "10A1"}, {"id": "hs9", "name": "Trần Mạnh Dũng", "class": "10A1"}, {"id": "hs10", "name": "Lê Châu Giang", "class": "10A1"}, {"id": "hs11", "name": "Lê Hương Giang", "class": "10A1"}, {"id": "hs12", "name": "Trần Châu Giang", "class": "10A1"}, {"id": "hs13", "name": "Lê Hoàng Hà", "class": "10A1"}, {"id": "hs14", "name": "Nguyễn Hồng Hải", "class": "10A1"}, {"id": "hs15", "name": "Nguyễn Anh Hào", "class": "10A1"}, {"id": "hs16", "name": "Nguyễn Khánh Hoàn", "class": "10A1"}, {"id": "hs17", "name": "Lê Đức Huy", "class": "10A1"}, {"id": "hs18", "name": "Phạm Khánh Huyền", "class": "10A1"}, {"id": "hs19", "name": "Phạm Khánh Hưng", "class": "10A1"}, {"id": "hs20", "name": "Nguyễn Đăng Khoa", "class": "10A1"}, {"id": "hs21", "name": "Đào Tuấn Kiệt", "class": "10A1"}, {"id": "hs22", "name": "Phạm Thành Lê", "class": "10A1"}, {"id": "hs23", "name": "Phạm Nguyễn Hà Linh", "class": "10A1"}, {"id": "hs24", "name": "Nguyễn Thế Mạnh", "class": "10A1"}, {"id": "hs25", "name": "Võ Thị Hoài Mơ", "class": "10A1"}, {"id": "hs26", "name": "Nguyễn Bảo Ngọc", "class": "10A1"}, {"id": "hs27", "name": "Nguyễn Khánh Nhàn", "class": "10A1"}, {"id": "hs28", "name": "Đường Hồng Nhật", "class": "10A1"}, {"id": "hs29", "name": "Nguyễn Minh Nhật", "class": "10A1"}, {"id": "hs30", "name": "Nguyễn Hồng Nhung", "class": "10A1"}, {"id": "hs31", "name": "Ngô Thị Gia Như", "class": "10A1"}, {"id": "hs32", "name": "Lê Hồng Phi", "class": "10A1"}, {"id": "hs33", "name": "Nguyễn Mai Phương", "class": "10A1"}, {"id": "hs34", "name": "Nguyễn Hoàng Quân", "class": "10A1"}, {"id": "hs35", "name": "Nguyễn Tuấn Tú", "class": "10A1"}, {"id": "hs36", "name": "Thái Lê Hoàng Tuấn", "class": "10A1"}, {"id": "hs37", "name": "Nguyễn Phạm Thục Uyên", "class": "10A1"}, {"id": "hs38", "name": "Tô Lâm Vũ", "class": "10A1"}, {"id": "hs39", "name": "Trịnh Tuấn Vũ", "class": "10A1"}, {"id": "hs40", "name": "Nguyễn Thị Yến Vy", "class": "10A1"}];
const TEACHERS = [{"id": "gv", "name": "Giáo viên Tin học"}];

const DEFAULT_PW = "123456";
const SESSION_KEY = "py10:session";


// Force logout via ?logout or #logout
try{const u=new URL(location.href); if(u.searchParams.has("logout")||location.hash==="#logout"){ localStorage.removeItem(SESSION_KEY); }}catch(e){}
function findStudent(id){
  id = String(id || "").trim();
  return STUDENTS.find(s => s.id === id) || null;
}
function findTeacher(id){
  id = String(id || "").trim();
  return TEACHERS.find(t => t.id === id) || null;
}

function setSession(sess){ localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); }
function getSession(){
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s || !s.role || !s.id) return null;

    if(s.role === "student") {
      const st = findStudent(s.id);
      if(!st) return null;
      return { role:"student", id: st.id, name: st.name || "", class: st.class || "10A1" };
    }
    if(s.role === "teacher") {
      const t = findTeacher(s.id);
      if(!t) return null;
      return { role:"teacher", id: t.id, name: t.name || "Giáo viên" };
    }
    return null;
  } catch {
    return null;
  }
}
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

function showLogin(){
  document.getElementById("loginRoot").style.display = "grid";
  document.getElementById("appRoot").style.display = "none";
  document.getElementById("teacherRoot").style.display = "none";
  try{
    document.body.classList.remove("mode-student");
  }catch(e){}
}
function showStudentApp(sess){
  document.getElementById("loginRoot").style.display = "none";
  document.getElementById("teacherRoot").style.display = "none";
  document.getElementById("appRoot").style.display = "block";
  const label = sess.name ? `${sess.name} • ${sess.id} • Lớp ${sess.class||""}` : `${sess.id}`;
  document.getElementById("userName").textContent = label;
  window.__USER = sess;
  try{
    document.body.classList.add("mode-student");
  }catch(e){}
}
function showTeacherApp(sess){
  document.getElementById("loginRoot").style.display = "none";
  document.getElementById("appRoot").style.display = "none";
  document.getElementById("teacherRoot").style.display = "block";
  document.getElementById("teacherName").textContent = sess.name + " • " + sess.id;
  window.__TEACHER = sess;
  try{
    document.body.classList.remove("mode-student");
  }catch(e){}
}

let loginRole = "student";
function setRole(role){
  loginRole = role;
  const tabS = document.getElementById("tabStudent");
  const tabT = document.getElementById("tabTeacher");
  const logo = document.getElementById("lgLogo");
  const title = document.getElementById("lgTitle");
  const sub = document.getElementById("lgSub");
  const lab = document.getElementById("lgUserLabel");
  const hint = document.getElementById("lgHintChip");

  document.getElementById("lgErr").style.display = "none";
  document.getElementById("lgUser").value = "";
  document.getElementById("lgPass").value = "";

  if(role === "student"){
    logo.textContent = "HS";
    title.textContent = "Đăng nhập học sinh";
    sub.innerHTML = 'Dùng <b>Mã học sinh</b> để đăng nhập • Mật khẩu mặc định: <b>123456</b>';
    lab.textContent = "Mã học sinh";
    hint.textContent = "Gợi ý: hs1, hs2, hs3…";
    tabS.classList.add("primary"); tabT.classList.remove("primary");
  } else {
    logo.textContent = "GV";
    title.textContent = "Đăng nhập giáo viên";
    sub.innerHTML = 'Tài khoản mặc định: <b>gv</b> • Mật khẩu: <b>123456</b>';
    lab.textContent = "Tài khoản giáo viên";
    hint.textContent = "Gợi ý: gv";
    tabT.classList.add("primary"); tabS.classList.remove("primary");
  }
}

function loginTry(){
  const u = document.getElementById("lgUser").value.trim();
  const p = document.getElementById("lgPass").value.trim();
  const err = document.getElementById("lgErr");
  err.style.display = "none";

  if(p !== DEFAULT_PW){ err.style.display="block"; return; }

  if(loginRole === "student"){
    const st = findStudent(u);
    if(!st){ err.style.display="block"; return; }
    setSession({role:"student", id: st.id});
    location.reload();
    return;
  }
  if(loginRole === "teacher"){
    const t = findTeacher(u || "gv");
    if(!t){ err.style.display="block"; return; }
    setSession({role:"teacher", id: t.id});
    location.reload();
    return;
  }
}

(function initLoginGate(){
  const sess = getSession();
  if(!sess){
    showLogin();
    document.getElementById("lgBtn").onclick = loginTry;
    document.getElementById("tabStudent").onclick = ()=>setRole("student");
    document.getElementById("tabTeacher").onclick = ()=>setRole("teacher");
    setRole("student");
    document.getElementById("lgUser").addEventListener("keydown", (e)=>{ if(e.key==="Enter") loginTry(); });
    document.getElementById("lgPass").addEventListener("keydown", (e)=>{ if(e.key==="Enter") loginTry(); });
    return;
  }
  if(sess.role === "student") showStudentApp(sess);
  if(sess.role === "teacher") showTeacherApp(sess);
})();
