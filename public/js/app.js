const $ = (s) => document.querySelector(s);
const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

$("#year").textContent = new Date().getFullYear();

const menuBtn = $("#menuBtn"), navLinks = $("#navLinks");
menuBtn.addEventListener("click", () => {
  navLinks.classList.toggle("active");
  menuBtn.textContent = navLinks.classList.contains("active") ? "✕" : "☰";
});
navLinks.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  navLinks.classList.remove("active"); menuBtn.textContent = "☰";
}));

async function getJSON(url, options={}) {
  const r = await fetch(url, options);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadPublic() {
  try {
    const [notices, events, gallery] = await Promise.all([
      getJSON("/api/notices"), getJSON("/api/events"), getJSON("/api/gallery")
    ]);

    $("#noticeList").innerHTML = notices.length ? notices.map(n => `
      <article class="notice">
        <div class="date"><b>${new Date(n.date+"T00:00:00").getDate()}</b><small>${new Date(n.date+"T00:00:00").toLocaleString("en",{month:"short"}).toUpperCase()}</small></div>
        <div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></div>
        <a href="#contact">Details →</a>
      </article>`).join("") : "<div class='panel'>No notices yet.</div>";

    $("#eventList").innerHTML = events.length ? events.map(e => `
      <article><div class="icon">📅</div><h3>${esc(e.title)}</h3><p><b>${esc(e.event_date)}</b></p><p>${esc(e.description || "")}</p></article>
    `).join("") : "<article>No events yet.</article>";

    $("#galleryGrid").innerHTML = gallery.length ? gallery.map(g => `
      <figure><img src="${esc(g.image_url)}" alt="${esc(g.title)}" loading="lazy"><figcaption>${esc(g.title)}</figcaption></figure>
    `).join("") : "<p>No gallery items yet.</p>";
  } catch (e) {
    $("#noticeList").innerHTML = `<div class="panel">Could not load notices: ${esc(e.message)}</div>`;
  }
}
loadPublic();

$("#admissionForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("#admissionMsg");
  msg.textContent = "Submitting...";
  const body = Object.fromEntries(new FormData(e.target).entries());
  try {
    const data = await getJSON("/api/admissions", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
    });
    msg.textContent = `${data.message} Application ID: ${data.id}`;
    e.target.reset();
  } catch(err) { msg.textContent = err.message; }
});

let token = localStorage.getItem("rumc_token");

function logout() {
  localStorage.removeItem("rumc_token");
  token = null;
  $("#dashboard").classList.add("hidden");
  $("#loginMsg").textContent = "Logged out.";
  location.hash = "#portal";
}

async function adminDashboard() {
  const headers = {Authorization:`Bearer ${token}`};
  const [stats, applications, students, notices] = await Promise.all([
    getJSON("/api/admin/dashboard",{headers}),
    getJSON("/api/admin/admissions",{headers}),
    getJSON("/api/admin/students",{headers}),
    getJSON("/api/notices")
  ]);
  $("#dashTitle").textContent = "Admin Dashboard";
  $("#dash").innerHTML = `
    <div class="dashboard-grid">
      <div class="metric"><b>${stats.students}</b>Students</div>
      <div class="metric"><b>${stats.notices}</b>Notices</div>
      <div class="metric"><b>${stats.admissions}</b>Applications</div>
      <div class="metric"><b>${stats.events}</b>Events</div>
    </div>
    <div class="panel">
      <h3>Publish Notice</h3>
      <form id="noticeForm" class="form">
        <input name="title" placeholder="Notice title" required>
        <input name="date" type="date" required>
        <textarea name="body" placeholder="Notice body" required></textarea>
        <button class="btn primary">Publish</button>
      </form>
    </div>
    <br>
    <div class="panel"><h3>Admission Applications</h3>
      <div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Class</th><th>Status</th></tr></thead>
      <tbody>${applications.map(a=>`<tr><td>${a.id}</td><td>${esc(a.student_name)}</td><td>${esc(a.phone)}</td><td>${esc(a.class_name)}</td><td>${esc(a.status)}</td></tr>`).join("")}</tbody></table></div>
    </div>
    <br>
    <div class="panel"><h3>Students</h3>
      <div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Name</th><th>Class</th><th>Section</th><th>Roll</th></tr></thead>
      <tbody>${students.map(s=>`<tr><td>${esc(s.student_id)}</td><td>${esc(s.name)}</td><td>${esc(s.class_name)}</td><td>${esc(s.section)}</td><td>${esc(s.roll)}</td></tr>`).join("")}</tbody></table></div>
    </div>
    <br>
    <div class="panel"><h3>Current Notices</h3>
      ${notices.map(n=>`<p><b>${esc(n.title)}</b> — ${esc(n.date)}
      <button data-id="${n.id}" class="deleteNotice">Delete</button></p>`).join("")}
    </div>
    <br><button id="logoutBtn" class="btn primary">Logout</button>
  `;
  $("#noticeForm").addEventListener("submit", async e=>{
    e.preventDefault();
    const body=Object.fromEntries(new FormData(e.target).entries());
    await getJSON("/api/admin/notices",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify(body)});
    adminDashboard(); loadPublic();
  });
  $("#logoutBtn").addEventListener("click",logout);
  document.querySelectorAll(".deleteNotice").forEach(b=>b.addEventListener("click",async()=>{
    await getJSON(`/api/admin/notices/${b.dataset.id}`,{method:"DELETE",headers});
    adminDashboard(); loadPublic();
  }));
}

async function studentDashboard() {
  const headers={Authorization:`Bearer ${token}`};
  const [me, results] = await Promise.all([
    getJSON("/api/student/me",{headers}),
    getJSON("/api/student/results",{headers})
  ]);
  $("#dashTitle").textContent = "Student Dashboard";
  $("#dash").innerHTML = `
    <div class="panel">
      <h3>Welcome, ${esc(me.name)}</h3>
      <p><b>Student ID:</b> ${esc(me.student_id)}</p>
      <p><b>Class:</b> ${esc(me.class_name)} &nbsp; <b>Section:</b> ${esc(me.section)} &nbsp; <b>Roll:</b> ${esc(me.roll)}</p>
    </div><br>
    <div class="panel"><h3>Results</h3>
      <div class="table-wrap"><table class="table"><thead><tr><th>Exam</th><th>Subject</th><th>Marks</th><th>Grade</th></tr></thead>
      <tbody>${results.map(r=>`<tr><td>${esc(r.exam)}</td><td>${esc(r.subject)}</td><td>${esc(r.marks)}</td><td>${esc(r.grade)}</td></tr>`).join("")}</tbody></table></div>
    </div><br><button id="logoutBtn" class="btn primary">Logout</button>`;
  $("#logoutBtn").addEventListener("click",logout);
}

$("#loginForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const msg=$("#loginMsg"); msg.textContent="Signing in...";
  try{
    const data=await getJSON("/api/login",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username:$("#username").value,password:$("#password").value})
    });
    localStorage.setItem("rumc_token",data.token); token=data.token;
    msg.textContent=`Logged in as ${data.role}.`;
    $("#dashboard").classList.remove("hidden");
    location.hash="#dashboard";
    data.role==="admin" ? adminDashboard() : studentDashboard();
  }catch(err){msg.textContent=err.message;}
});

async function restoreSession(){
  if(!token)return;
  try{
    const payload=JSON.parse(atob(token.split(".")[1]));
    $("#dashboard").classList.remove("hidden");
    payload.role==="admin" ? await adminDashboard() : await studentDashboard();
  }catch{localStorage.removeItem("rumc_token");token=null;}
}
restoreSession();
