const CONFIG = window.EMS_CONFIG || {};
const DEFAULT_PROGRESS_ENDPOINT = "/api/progress";
const DEFAULT_STUDENT_ID = "pulkit";
const STORAGE_KEY_ACTIVE_STUDENT = "stellar_ems_active_student";
const STORAGE_KEY_USERS = "stellar_ems_users_list";

function normalizeStudentId(raw) {
  const value = String(raw || DEFAULT_STUDENT_ID).trim().toLowerCase();
  return value.replace(/[^a-z0-9_-]/g, "_").slice(0, 50) || DEFAULT_STUDENT_ID;
}

function loadUserList() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || "[]");
    const initial = CONFIG?.progress?.studentId || DEFAULT_STUDENT_ID;
    const set = new Set([initial, ...(Array.isArray(parsed) ? parsed : [])]);
    return [...set];
  } catch (_err) {
    return [CONFIG?.progress?.studentId || DEFAULT_STUDENT_ID];
  }
}

function saveUserList(users) {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
}

function getActiveStudentId() {
  const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_STUDENT);
  return normalizeStudentId(stored || CONFIG?.progress?.studentId || DEFAULT_STUDENT_ID);
}

function setActiveStudentId(id) {
  const clean = normalizeStudentId(id);
  localStorage.setItem(STORAGE_KEY_ACTIVE_STUDENT, clean);
  state.currentStudentId = clean;
}

function getUserDoneKey(studentId) {
  return `stellar_ems_done_${studentId}`;
}

function getUserLogsKey(studentId) {
  return `stellar_ems_logs_${studentId}`;
}

function getUserStartDateKey(studentId) {
  return `stellar_ems_start_date_${studentId}`;
}

function loadLocalDoneSet(studentId = getActiveStudentId()) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getUserDoneKey(studentId)) || "[]");
    if (!Array.isArray(parsed)) return new Set();
    const cleaned = parsed.filter((x) => typeof x === "string" && x.length);
    return new Set(cleaned);
  } catch (_err) {
    return new Set();
  }
}

function loadLocalLogs(studentId = getActiveStudentId()) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getUserLogsKey(studentId)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function getUserStartDate(studentId = getActiveStudentId()) {
  const stored = localStorage.getItem(getUserStartDateKey(studentId));
  return stored || CONFIG?.startDate || "2026-09-27";
}

function setUserStartDate(studentId, dateStr) {
  localStorage.setItem(getUserStartDateKey(studentId), dateStr);
}

const state = {
  currentStudentId: getActiveStudentId(),
  users: loadUserList(),
  baseDays: [],
  dayPlan: null,
  done: loadLocalDoneSet(getActiveStudentId()),
  logs: loadLocalLogs(getActiveStudentId()),
  db: null,
  firebaseConnected: false,
  fsUnsubLogs: null,
  fsUnsubProgress: null,
  staticFiles: [],
  publicByPath: new Map(),
  publicByName: new Map(),
  activeTab: "today",
  logsFilter: {
    search: "",
    section: "All",
    rootCause: "All",
    status: "All",
    showForm: false,
  },
  progressSync: {
    enabled: false,
    endpoint: DEFAULT_PROGRESS_ENDPOINT,
    studentId: getActiveStudentId(),
    writeKey: "",
    hasInitialized: false,
    saveTimer: null,
    saving: false,
    dirty: false,
    warned: false,
  },
};

const el = {
  heroTitle: document.getElementById("heroTitle"),
  heroSub: document.getElementById("heroSub"),
  completionPct: document.getElementById("completionPct"),
  completedCount: document.getElementById("completedCount"),
  mappedCount: document.getElementById("mappedCount"),
  statusBar: document.getElementById("statusBar"),
  todayTab: document.getElementById("tab-today"),
  plannerTab: document.getElementById("tab-planner"),
  logsTab: document.getElementById("tab-logs"),
  libraryTab: document.getElementById("tab-library"),
  menuTabs: document.getElementById("menuTabs"),
  userSelect: document.getElementById("userSelect"),
  addUserBtn: document.getElementById("addUserBtn"),
  startDateInput: document.getElementById("startDateInput"),
  applyStartDateBtn: document.getElementById("applyStartDateBtn"),
  folderIdText: document.getElementById("folderIdText"),
  reloadLinksBtn: document.getElementById("syncDriveBtn"),
};

function setStatus(message, isError = false) {
  el.statusBar.textContent = message;
  el.statusBar.style.background = isError ? "#fff0f0" : "#edf5ff";
  el.statusBar.style.borderColor = isError ? "#f5c0c0" : "#cfe0ff";
  el.statusBar.style.color = isError ? "#9f2222" : "#1a3e86";
}

function normalize(s) {
  return String(s || "")
    .replaceAll("\\", "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function basename(path) {
  const parts = String(path).replaceAll("\\", "/").split("/");
  return parts[parts.length - 1];
}

function todayInTZ(tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function persistDone() {
  localStorage.setItem(getUserDoneKey(state.currentStudentId), JSON.stringify([...state.done]));
}

function persistLogs() {
  localStorage.setItem(getUserLogsKey(state.currentStudentId), JSON.stringify(state.logs));
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseDateUTC(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function formatDateUTC(dateObj) {
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildNightFocusPlan(day) {
  const files = day.files || [];
  const videos = files.filter((f) => f.toLowerCase().endsWith(".mp4"));
  const notesPdf = files.filter((f) => f.toLowerCase().endsWith(".pdf") && !f.toLowerCase().includes("dpp"));
  const dpps = files.filter((f) => f.toLowerCase().includes("dpp"));
  const otherFiles = files.filter((f) => !videos.includes(f) && !notesPdf.includes(f) && !dpps.includes(f));
  const testFiles = day.test_files || [];
  const testNumber = day.test_number;

  const focusPlan = [];

  // Block 1: 22:00 - 23:15
  if (videos.length) {
    focusPlan.push({
      title: "22:00-23:15: Watch lecture (1.25x-1.5x) & annotate class notes",
      files: [...videos, ...notesPdf],
    });
  } else if (notesPdf.length || otherFiles.length) {
    focusPlan.push({
      title: "22:00-23:00: High-yield concept recap & formula review",
      files: [...notesPdf, ...otherFiles],
    });
  } else {
    focusPlan.push({
      title: "22:00-23:00: Target concept recap & weak area drilling",
      files: ["Planner/Core/STELLAR_MASTER_STUDY_PLAN.md"],
    });
  }

  // Block 2: 23:15 - 23:50
  if (dpps.length) {
    focusPlan.push({
      title: "23:15-23:50: Timed DPP sprint (15-20 target questions)",
      files: dpps,
    });
  } else if (testFiles.length && testNumber) {
    focusPlan.push({
      title: `23:00-23:50: PT${String(testNumber).padStart(2, "0")} timed sectional drill & accuracy test`,
      files: testFiles,
    });
  } else {
    focusPlan.push({
      title: "23:00-23:50: Timed 20-question mixed practice drill",
      files: [],
    });
  }

  // Block 3: 23:50 - 00:00
  focusPlan.push({
    title: "23:50-00:00: Log mistakes in error tracker & daily wind down",
    files: [],
  });

  return focusPlan;
}

function rebuildDynamicPlan(startDateStr) {
  if (!state.baseDays || !state.baseDays.length) return;
  const validStartDate = startDateStr || getUserStartDate(state.currentStudentId);
  const startObj = parseDateUTC(validStartDate);

  const projectedDays = state.baseDays.map((day, index) => {
    const current = new Date(startObj.getTime() + index * 24 * 60 * 60 * 1000);
    const dateStr = formatDateUTC(current);
    const weekdayStr = WEEKDAYS[current.getUTCDay()];

    const dayCopy = {
      ...day,
      date: dateStr,
      weekday: weekdayStr,
    };
    dayCopy.focus_plan = buildNightFocusPlan(dayCopy);

    const notes = [];
    if (dayCopy.test_number) {
      notes.push(`Weekend Heavy: PT${String(dayCopy.test_number).padStart(2, "0")} + targeted post-test error review (22:00-00:00)`);
      notes.push("Office Tip: Complete PT on weekend night slot; analyze incorrect questions before sleep.");
    } else if (weekdayStr === "Friday") {
      notes.push("Light Friday Close: 60-minute weekly concept recap + update error log + plan weekend tests");
    } else if ((dayCopy.core || "").includes("Revision")) {
      notes.push("Revision Day: Redo wrong questions from error log + 20 timed mixed questions");
    } else {
      notes.push("Daily Sprint (10 PM - 12 AM): 75m Lecture (1.25x) + 35m DPP + 10m Error Log");
    }
    dayCopy.notes = notes;
    return dayCopy;
  });

  state.dayPlan = {
    generated_at: new Date().toISOString(),
    start_date: validStartDate,
    days: projectedDays,
  };
}

function getStartDate() {
  return getUserStartDate(state.currentStudentId);
}

function isOnOrAfter(dateStr, floorDate) {
  if (!floorDate) return true;
  return String(dateStr) >= String(floorDate);
}

function allTaskRows() {
  if (!state.dayPlan?.days) return [];
  const startDate = getStartDate();
  const rows = [];
  for (const day of state.dayPlan.days) {
    if (!isOnOrAfter(day.date, startDate)) continue;

    rows.push({
      date: day.date,
      title: day.core || "Core task",
      files: day.files || [],
      notes: day.notes || [],
      test: day.test_number || null,
    });

    (day.focus_plan || []).forEach((f) => {
      rows.push({
        date: day.date,
        title: f.title,
        files: f.files || [],
        notes: [],
        test: null,
        isFocus: true,
      });
    });
  }
  return rows;
}

function updateStats() {
  const rows = allTaskRows();
  const total = rows.length || 1;
  const completed = rows.filter((r) => state.done.has(taskKey(r.date, r.title))).length;
  const pct = Math.round((completed / total) * 100);

  el.completionPct.textContent = `${pct}%`;
  el.completedCount.textContent = String(completed);

  const refs = new Set();
  rows.forEach((r) => (r.files || []).forEach((f) => refs.add(f)));
  let mapped = 0;
  refs.forEach((f) => {
    if (resolveFileUrl(f)) mapped += 1;
  });
  el.mappedCount.textContent = String(mapped);
}

function makeFileChip(ref) {
  const a = document.createElement("a");
  a.className = "file-link";
  a.textContent = basename(ref);
  const url = resolveFileUrl(ref);

  if (url) {
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } else {
    a.href = "javascript:void(0)";
    a.classList.add("missing");
    a.textContent = `${basename(ref)} (not mapped yet)`;
  }

  return a;
}

function renderTaskBlock(container, row) {
  const item = document.createElement("div");
  item.className = "task-item";

  const key = taskKey(row.date, row.title);
  const checked = state.done.has(key);
  if (checked) item.classList.add("done");

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = checked;
  cb.addEventListener("change", () => {
    if (cb.checked) {
      state.done.add(key);
      item.classList.add("done");
    } else {
      state.done.delete(key);
      item.classList.remove("done");
    }
    persistDone();
    updateStats();
    queueProgressSave();
  });

  const middle = document.createElement("div");
  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = row.title;
  middle.appendChild(title);

  if (row.files?.length) {
    const links = document.createElement("div");
    links.className = "file-links";
    row.files.forEach((f) => links.appendChild(makeFileChip(f)));
    middle.appendChild(links);
  }

  const right = document.createElement("div");
  if (row.test) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `PT${String(row.test).padStart(2, "0")}`;
    right.appendChild(badge);
  }

  item.append(cb, middle, right);
  container.appendChild(item);
}

function renderToday() {
  el.todayTab.innerHTML = "";

  const startDate = getStartDate();
  const today = todayInTZ(CONFIG.timezone || "Asia/Kolkata");
  const eligibleDays = state.dayPlan.days.filter((d) => isOnOrAfter(d.date, startDate));
  const day =
    eligibleDays.find((d) => d.date === today) ||
    eligibleDays[0] ||
    state.dayPlan.days[0];

  const backlogRows = allTaskRows()
    .filter((r) => r.date < day.date && !state.done.has(taskKey(r.date, r.title)))
    .sort((a, b) => (a.date === b.date ? 0 : a.date > b.date ? -1 : 1));

  const wrapper = document.createElement("div");
  wrapper.className = "grid-2";

  const left = document.createElement("div");
  left.className = "card";

  const headerRow = document.createElement("div");
  headerRow.className = "card-header-row";

  const h = document.createElement("h3");
  h.textContent = `${day.date} (${day.weekday})`;

  const nightBadge = document.createElement("span");
  nightBadge.className = "night-badge";
  nightBadge.innerHTML = "🌙 10:00 PM – 12:00 AM (2h Night Sprint)";

  headerRow.append(h, nightBadge);
  left.appendChild(headerRow);

  // Visual 2-Hour Study Timeline
  const timeline = document.createElement("div");
  timeline.className = "night-timeline";
  timeline.innerHTML = `
    <div class="timeline-step">
      <span class="step-time">22:00 - 23:15</span>
      <span class="step-name">Concept (75m @ 1.25x)</span>
    </div>
    <div class="timeline-arrow">➔</div>
    <div class="timeline-step">
      <span class="step-time">23:15 - 23:50</span>
      <span class="step-name">Target DPP (35m)</span>
    </div>
    <div class="timeline-arrow">➔</div>
    <div class="timeline-step">
      <span class="step-time">23:50 - 00:00</span>
      <span class="step-name">Error Log (10m)</span>
    </div>
  `;
  left.appendChild(timeline);

  if (backlogRows.length) {
    const sub = document.createElement("h4");
    sub.textContent = `Backlog Stack (${backlogRows.length})`;
    sub.style.margin = "12px 0 8px";
    left.appendChild(sub);

    const backlogList = document.createElement("div");
    backlogList.className = "task-list";
    backlogRows.forEach((r) => renderTaskBlock(backlogList, r));
    left.appendChild(backlogList);
  }

  const todaySub = document.createElement("h4");
  todaySub.textContent = `Today: ${day.core}`;
  todaySub.style.margin = "16px 0 8px";
  left.appendChild(todaySub);

  const taskList = document.createElement("div");
  taskList.className = "task-list";

  if (day.focus_plan?.length) {
    day.focus_plan.forEach((t) => {
      renderTaskBlock(taskList, {
        date: day.date,
        title: t.title,
        files: t.files,
        test: null,
      });
    });
  } else {
    renderTaskBlock(taskList, {
      date: day.date,
      title: day.core,
      files: day.files,
      test: day.test_number,
    });
  }

  left.appendChild(taskList);
  wrapper.appendChild(left);

  const right = document.createElement("div");
  right.className = "card";

  const h2 = document.createElement("h3");
  h2.textContent = "Night Study Notes & Tests";
  right.appendChild(h2);

  (day.notes || []).forEach((n) => {
    const p = document.createElement("p");
    p.className = "note-line";
    p.textContent = n;
    right.appendChild(p);
  });

  if (day.test_files?.length) {
    const filesWrap = document.createElement("div");
    filesWrap.className = "file-links";
    day.test_files.forEach((f) => filesWrap.appendChild(makeFileChip(f)));
    right.appendChild(filesWrap);
  }

  // Working Professional Night Protocol Widget
  const protocolBox = document.createElement("div");
  protocolBox.className = "protocol-box";
  protocolBox.innerHTML = `
    <h4>🏢 Working Professional Protocol</h4>
    <ul class="protocol-list">
      <li><strong>⚡ 1.25x–1.5x Speed:</strong> Finish 90m lecture content within 60–75 mins.</li>
      <li><strong>🎯 15–20 DPP Questions:</strong> Prioritize deep understanding over high volume.</li>
      <li><strong>🛑 12:00 AM Hard Stop:</strong> Zero overrun policy to stay energized for office tomorrow.</li>
      <li><strong>📓 Nightly Error Log:</strong> Review wrong questions before sleeping for peak memory retention.</li>
    </ul>
  `;
  right.appendChild(protocolBox);

  wrapper.appendChild(right);
  el.todayTab.appendChild(wrapper);

  if (backlogRows.length) {
    el.heroTitle.textContent = `Backlog ${backlogRows.length} + Today: ${day.core}`;
    el.heroSub.textContent = `2h Night Sprint (10 PM – 12 AM). Complete today's 3-step sequence.`;
  } else {
    el.heroTitle.textContent = `Today: ${day.core}`;
    el.heroSub.textContent = `2h Night Sprint (10 PM – 12 AM). Stay consistent, log errors, sleep on time.`;
  }
}

function renderPlanner() {
  el.plannerTab.innerHTML = "";

  const card = document.createElement("div");
  card.className = "card";

  const controls = document.createElement("div");
  controls.className = "controls";

  const search = document.createElement("input");
  search.placeholder = "Search topic / date / PT";

  const monthFilter = document.createElement("select");
  const months = ["All", ...new Set(state.dayPlan.days.map((d) => d.date.slice(0, 7)))];
  months.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    monthFilter.appendChild(opt);
  });

  controls.append(search, monthFilter);
  card.appendChild(controls);

  const list = document.createElement("div");
  list.className = "task-list";
  card.appendChild(list);
  el.plannerTab.appendChild(card);

  const rerender = () => {
    list.innerHTML = "";
    const q = normalize(search.value);
    const m = monthFilter.value;

    state.dayPlan.days.forEach((day) => {
      const header = `${day.date} ${day.weekday} ${day.core} PT${day.test_number || ""}`;
      if (m !== "All" && !day.date.startsWith(m)) return;
      if (q && !normalize(header).includes(q)) return;

      const block = document.createElement("div");
      block.className = "card";
      const title = document.createElement("h4");
      title.textContent = `${day.date} (${day.weekday})`;
      block.appendChild(title);

      const tasks = document.createElement("div");
      tasks.className = "task-list";

      renderTaskBlock(tasks, {
        date: day.date,
        title: day.core,
        files: day.files,
        test: day.test_number,
      });

      (day.focus_plan || []).forEach((t) => {
        renderTaskBlock(tasks, {
          date: day.date,
          title: t.title,
          files: t.files,
          test: null,
        });
      });

      block.appendChild(tasks);
      list.appendChild(block);
    });
  };

  search.addEventListener("input", rerender);
  monthFilter.addEventListener("change", rerender);
  rerender();
}

function renderLibrary() {
  el.libraryTab.innerHTML = "";

  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("h3");
  title.textContent = "Drive Resource Library";
  card.appendChild(title);

  if (!state.staticFiles.length) {
    const p = document.createElement("p");
    p.className = "note-line";
    p.textContent = "No static link index loaded yet. Click Reload Links.";
    card.appendChild(p);
    el.libraryTab.appendChild(card);
    return;
  }

  const controls = document.createElement("div");
  controls.className = "controls";

  const search = document.createElement("input");
  search.placeholder = "Filter by file name/path";

  const typeFilter = document.createElement("select");
  ["All", "mp4", "pdf", "other"].forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeFilter.appendChild(opt);
  });

  controls.append(search, typeFilter);
  card.appendChild(controls);

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-responsive";
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr><th>File</th><th>Path</th><th>Type</th><th>Open</th></tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  tableWrap.appendChild(table);
  card.appendChild(tableWrap);
  el.libraryTab.appendChild(card);

  const rerender = () => {
    tbody.innerHTML = "";
    const q = normalize(search.value);
    const t = typeFilter.value;

    state.staticFiles.forEach((f) => {
      const ext = (f.name.split(".").pop() || "other").toLowerCase();
      const tpe = ["mp4", "pdf"].includes(ext) ? ext : "other";
      const matchText = normalize(`${f.name} ${f.relativePath}`);

      if (t !== "All" && t !== tpe) return;
      if (q && !matchText.includes(q)) return;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${f.name}</td>
        <td>${f.relativePath}</td>
        <td>${tpe}</td>
        <td><a href="${f.url}" target="_blank" rel="noopener noreferrer">Open</a></td>
      `;
      tbody.appendChild(tr);
    });
  };

  search.addEventListener("input", rerender);
  typeFilter.addEventListener("change", rerender);
  rerender();
}

async function fetchDayPlan() {
  try {
    const res = await fetch("./data/day-plan.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load day-plan.json");
    return res.json();
  } catch (err) {
    if (window.__DAY_PLAN_INLINE?.days?.length) {
      return window.__DAY_PLAN_INLINE;
    }
    throw err;
  }
}

async function fetchPublicLinks() {
  try {
    const res = await fetch("./data/public-links.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load public-links.json");
    return res.json();
  } catch (err) {
    if (window.__PUBLIC_LINKS_INLINE?.byRelativePath || window.__PUBLIC_LINKS_INLINE?.byName) {
      return window.__PUBLIC_LINKS_INLINE;
    }
    throw err;
  }
}

function buildPublicIndexes(payload) {
  state.publicByPath.clear();
  state.publicByName.clear();
  state.staticFiles = [];

  if (!payload) return;

  const byPath = payload.byRelativePath || {};
  const byName = payload.byName || {};

  Object.entries(byPath).forEach(([k, v]) => {
    const normalizedPath = normalize(k);
    const fileName = basename(k);
    const normalizedName = normalize(fileName);

    state.publicByPath.set(normalizedPath, v);
    if (!state.publicByName.has(normalizedName)) {
      state.publicByName.set(normalizedName, v);
    }

    if (!fileName || fileName.startsWith(".")) return;
    state.staticFiles.push({
      name: fileName,
      relativePath: k,
      url: v,
    });
  });

  Object.entries(byName).forEach(([k, v]) => {
    const normalizedName = normalize(k);
    if (!state.publicByName.has(normalizedName)) {
      state.publicByName.set(normalizedName, v);
    }
  });

  state.staticFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function resolveFileUrl(ref) {
  if (!ref) return null;
  const p = normalize(ref);
  if (state.publicByPath.has(p)) return state.publicByPath.get(p);

  const b = normalize(basename(ref));
  if (state.publicByName.has(b)) return state.publicByName.get(b);

  return null;
}

function getFirebaseConfig() {
  return CONFIG?.firebase || {};
}

function attachFirebaseListeners(studentId) {
  if (!state.db || !state.firebaseConnected) return;

  if (state.fsUnsubLogs) {
    state.fsUnsubLogs();
    state.fsUnsubLogs = null;
  }
  if (state.fsUnsubProgress) {
    state.fsUnsubProgress();
    state.fsUnsubProgress = null;
  }

  const cleanId = normalizeStudentId(studentId);
  const logsCol = state.db.collection("students").doc(cleanId).collection("logs");

  state.fsUnsubLogs = logsCol.orderBy("createdAt", "desc").onSnapshot((snapshot) => {
    const items = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    state.logs = items;
    persistLogs();
    if (state.activeTab === "logs") {
      renderLogs();
    }
  }, (err) => {
    console.warn("Firestore logs listener error:", err);
  });

  const progressDoc = state.db.collection("students").doc(cleanId).collection("meta").doc("progress");
  state.fsUnsubProgress = progressDoc.onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (Array.isArray(data?.done)) {
        const currentDone = doneArray();
        const remoteDone = data.done;
        if (JSON.stringify(currentDone) !== JSON.stringify(remoteDone)) {
          setDoneFromArray(remoteDone);
          refreshAllViews();
        }
      }
    }
  }, (err) => {
    console.warn("Firestore progress listener error:", err);
  });
}

async function initFirebase() {
  const fbConfig = getFirebaseConfig();
  if (!fbConfig.enabled || !window.firebase || !fbConfig.projectId || !fbConfig.apiKey) {
    state.firebaseConnected = false;
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(fbConfig);
    }
    state.db = firebase.firestore();
    state.firebaseConnected = true;

    attachFirebaseListeners(state.currentStudentId);

    // Sync cloud profile start date if present
    try {
      const profileDoc = await state.db.collection("students").doc(state.currentStudentId).collection("meta").doc("profile").get();
      if (profileDoc.exists && profileDoc.data()?.startDate) {
        const cloudStart = profileDoc.data().startDate;
        if (cloudStart !== getUserStartDate(state.currentStudentId)) {
          setUserStartDate(state.currentStudentId, cloudStart);
          rebuildDynamicPlan(cloudStart);
          renderUserControls();
        }
      }
    } catch (_e) {}

    setStatus(`Connected to Firebase. Active student: ${state.currentStudentId}.`);
  } catch (err) {
    console.warn("Firebase initialization error:", err);
    state.firebaseConnected = false;
  }
}

async function addLogEntry(entry) {
  const studentId = state.currentStudentId;
  const now = new Date().toISOString();
  const newEntry = {
    ...entry,
    id: entry.id || "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    createdAt: now,
    updatedAt: now,
  };

  if (state.db && state.firebaseConnected) {
    try {
      const docRef = await state.db.collection("students").doc(studentId).collection("logs").add({
        ...newEntry,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      newEntry.id = docRef.id;
    } catch (err) {
      console.warn("Failed to write to Firebase, saving locally:", err);
    }
  }

  const exists = state.logs.findIndex((l) => l.id === newEntry.id);
  if (exists >= 0) {
    state.logs[exists] = newEntry;
  } else {
    state.logs.unshift(newEntry);
  }
  persistLogs();
  renderLogs();
}

async function toggleLogStatus(id) {
  const studentId = state.currentStudentId;
  const item = state.logs.find((l) => l.id === id);
  if (!item) return;

  const nextStatus = item.status === "mastered" ? "needs_review" : "mastered";
  item.status = nextStatus;
  item.updatedAt = new Date().toISOString();

  if (state.db && state.firebaseConnected) {
    try {
      await state.db.collection("students").doc(studentId).collection("logs").doc(id).update({
        status: nextStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn("Failed to update status in Firebase:", err);
    }
  }

  persistLogs();
  renderLogs();
}

async function deleteLogEntry(id) {
  const studentId = state.currentStudentId;
  if (state.db && state.firebaseConnected) {
    try {
      await state.db.collection("students").doc(studentId).collection("logs").doc(id).delete();
    } catch (err) {
      console.warn("Failed to delete log in Firebase:", err);
    }
  }

  state.logs = state.logs.filter((l) => l.id !== id);
  persistLogs();
  renderLogs();
}

function switchStudent(newStudentId) {
  const cleanId = normalizeStudentId(newStudentId);
  setActiveStudentId(cleanId);
  state.done = loadLocalDoneSet(cleanId);
  state.logs = loadLocalLogs(cleanId);

  const start = getUserStartDate(cleanId);
  rebuildDynamicPlan(start);

  if (state.db && state.firebaseConnected) {
    attachFirebaseListeners(cleanId);
    state.db.collection("students").doc(cleanId).collection("meta").doc("profile").get().then((doc) => {
      if (doc.exists && doc.data()?.startDate) {
        const cloudStart = doc.data().startDate;
        if (cloudStart !== getUserStartDate(cleanId)) {
          setUserStartDate(cleanId, cloudStart);
          rebuildDynamicPlan(cloudStart);
          renderUserControls();
          refreshAllViews();
        }
      }
    }).catch((_e) => {});
  }

  renderUserControls();
  refreshAllViews();
  setStatus(`Active Student: ${cleanId}. Schedule begins on ${getUserStartDate(cleanId)}.`);
}

function renderUserControls() {
  if (el.userSelect) {
    el.userSelect.innerHTML = "";
    state.users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u.charAt(0).toUpperCase() + u.slice(1);
      if (u === state.currentStudentId) opt.selected = true;
      el.userSelect.appendChild(opt);
    });
  }

  if (el.startDateInput) {
    el.startDateInput.value = getUserStartDate(state.currentStudentId);
  }
}

function wireUserControls() {
  if (el.userSelect) {
    el.userSelect.addEventListener("change", (e) => {
      switchStudent(e.target.value);
    });
  }

  if (el.addUserBtn) {
    el.addUserBtn.addEventListener("click", () => {
      const name = prompt("Enter new student name / username:");
      if (!name || !name.trim()) return;
      const cleanId = normalizeStudentId(name);
      if (!state.users.includes(cleanId)) {
        state.users.push(cleanId);
        saveUserList(state.users);
      }

      const defaultStart = todayInTZ(CONFIG.timezone);
      const chosenStart = prompt(`Enter start date for ${cleanId} (YYYY-MM-DD):`, defaultStart);
      if (chosenStart && /^\d{4}-\d{2}-\d{2}$/.test(chosenStart.trim())) {
        setUserStartDate(cleanId, chosenStart.trim());
      } else {
        setUserStartDate(cleanId, defaultStart);
      }

      if (state.db && state.firebaseConnected) {
        state.db.collection("students").doc(cleanId).collection("meta").doc("profile").set({
          studentId: cleanId,
          name: name.trim(),
          startDate: getUserStartDate(cleanId),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }).catch((err) => console.warn("Failed to create student in Firestore:", err));
      }

      switchStudent(cleanId);
    });
  }

  if (el.applyStartDateBtn) {
    el.applyStartDateBtn.addEventListener("click", async () => {
      const newDate = el.startDateInput.value;
      if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        alert("Please select a valid start date (YYYY-MM-DD).");
        return;
      }

      setUserStartDate(state.currentStudentId, newDate);
      rebuildDynamicPlan(newDate);

      if (state.db && state.firebaseConnected) {
        try {
          await state.db.collection("students").doc(state.currentStudentId).collection("meta").doc("profile").set({
            startDate: newDate,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } catch (err) {
          console.warn("Failed to update start date in Firestore:", err);
        }
      }

      refreshAllViews();
      setStatus(`Start date updated to ${newDate} for student ${state.currentStudentId}.`);
    });
  }
}

function renderLogs() {
  if (!el.logsTab) return;
  el.logsTab.innerHTML = "";

  const container = document.createElement("div");
  container.className = "tab-panel";

  // Top Metrics Banner
  const totalLogs = state.logs.length;
  const needsReviewCount = state.logs.filter((l) => l.status !== "mastered").length;
  const masteredCount = state.logs.filter((l) => l.status === "mastered").length;
  const masteredPct = totalLogs ? Math.round((masteredCount / totalLogs) * 100) : 0;

  const topCard = document.createElement("div");
  topCard.className = "card";

  const topHeader = document.createElement("div");
  topHeader.className = "card-header-row";

  const titleWrap = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = "Error Log & Study Vault";
  const sub = document.createElement("p");
  sub.className = "note-line";
  sub.textContent = "Log questions missed during DPPs, tests, and night sprints to review before sleep.";
  titleWrap.append(title, sub);

  const rightActions = document.createElement("div");
  rightActions.className = "controls";

  const fbBadge = document.createElement("span");
  fbBadge.className = "badge";
  if (state.firebaseConnected) {
    fbBadge.style.background = "#ecfdf5";
    fbBadge.style.borderColor = "#a7f3d0";
    fbBadge.style.color = "#047857";
    fbBadge.textContent = "🟢 Firebase Real-Time Synced";
  } else {
    fbBadge.style.background = "#f1f5f9";
    fbBadge.style.borderColor = "#cbd5e1";
    fbBadge.style.color = "#475569";
    fbBadge.textContent = "💾 Local Storage Mode";
  }

  const toggleFormBtn = document.createElement("button");
  toggleFormBtn.className = "btn btn-primary";
  toggleFormBtn.style.marginTop = "0";
  toggleFormBtn.textContent = state.logsFilter.showForm ? "✕ Close Form" : "+ Log Mistake";
  toggleFormBtn.addEventListener("click", () => {
    state.logsFilter.showForm = !state.logsFilter.showForm;
    renderLogs();
  });

  rightActions.append(fbBadge, toggleFormBtn);
  topHeader.append(titleWrap, rightActions);
  topCard.appendChild(topHeader);

  // Metrics KPI ribbon
  const metricsRibbon = document.createElement("div");
  metricsRibbon.className = "hero-stats";
  metricsRibbon.style.marginTop = "14px";
  metricsRibbon.innerHTML = `
    <div class="stat-card">
      <p>Total Logged</p>
      <h3>${totalLogs}</h3>
    </div>
    <div class="stat-card">
      <p>Needs Review</p>
      <h3 style="color: #d97706;">${needsReviewCount}</h3>
    </div>
    <div class="stat-card">
      <p>Mastered Rate</p>
      <h3 style="color: #059669;">${masteredPct}% (${masteredCount})</h3>
    </div>
  `;
  topCard.appendChild(metricsRibbon);

  // Accordion New Log Entry Form
  if (state.logsFilter.showForm) {
    const formCard = document.createElement("div");
    formCard.className = "card";
    formCard.style.marginTop = "16px";
    formCard.style.border = "1px solid #bfdbfe";
    formCard.style.background = "linear-gradient(145deg, #ffffff 0%, #f8fbff 100%)";

    const formTitle = document.createElement("h4");
    formTitle.textContent = "📝 Log a Missed Question / Mistake";
    formCard.appendChild(formTitle);

    const form = document.createElement("form");
    form.className = "log-form";
    form.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label class="label" style="color: var(--ink);">Date</label>
          <input type="date" id="logDate" value="${todayInTZ(CONFIG.timezone)}" required />
        </div>
        <div class="form-group">
          <label class="label" style="color: var(--ink);">Section</label>
          <select id="logSection">
            <option value="Quant">Quant</option>
            <option value="VARC (CR)">VARC (Critical Reasoning)</option>
            <option value="VARC (RC)">VARC (Reading Comprehension)</option>
            <option value="Data Insights">Data Insights (DI)</option>
            <option value="Practice Test">Practice Test / Mock</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label" style="color: var(--ink);">Topic / Question Reference</label>
          <input type="text" id="logTopic" placeholder="e.g. Algebra DPP 01 - Q14 (Inequalities)" required />
        </div>
        <div class="form-group">
          <label class="label" style="color: var(--ink);">Root Cause</label>
          <select id="logRootCause">
            <option value="Concept Gap">💡 Concept Gap (Rule unknown)</option>
            <option value="Trap Missed">⚠️ Trap / Constraint Missed</option>
            <option value="Calculation / Speed">⏱️ Calculation / Speed Rush</option>
            <option value="Misread Question">👁️ Misread Question / Stem</option>
            <option value="Time Pressure">⏳ Time Pressure / Guess</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top: 10px;">
        <label class="label" style="color: var(--ink);">Mistake Breakdown / What went wrong?</label>
        <textarea id="logNote" rows="2" placeholder="e.g. Forgot that dividing by a negative number flips the inequality sign..."></textarea>
      </div>
      <div class="form-group" style="margin-top: 10px;">
        <label class="label" style="color: var(--ink);">🌟 1-Line Golden Rule (To review before sleep)</label>
        <input type="text" id="logGoldenRule" placeholder="e.g. Always check sign flip when dividing by variables!" required />
      </div>
      <div style="display: flex; gap: 10px; margin-top: 14px;">
        <button type="submit" class="btn btn-primary">Save to Error Vault</button>
        <button type="button" id="cancelLogBtn" class="btn" style="background: #e2e8f0; color: #334155;">Cancel</button>
      </div>
    `;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const date = form.querySelector("#logDate").value;
      const section = form.querySelector("#logSection").value;
      const topic = form.querySelector("#logTopic").value.trim();
      const rootCause = form.querySelector("#logRootCause").value;
      const note = form.querySelector("#logNote").value.trim();
      const goldenRule = form.querySelector("#logGoldenRule").value.trim();

      await addLogEntry({
        date,
        section,
        topic,
        rootCause,
        note,
        goldenRule,
        status: "needs_review",
      });

      state.logsFilter.showForm = false;
      renderLogs();
    });

    form.querySelector("#cancelLogBtn").addEventListener("click", () => {
      state.logsFilter.showForm = false;
      renderLogs();
    });

    formCard.appendChild(form);
    topCard.appendChild(formCard);
  }

  container.appendChild(topCard);

  // Filters & Search Card
  const filterCard = document.createElement("div");
  filterCard.className = "card";

  const filterControls = document.createElement("div");
  filterControls.className = "controls";

  const searchInput = document.createElement("input");
  searchInput.placeholder = "Search topics, mistakes, or golden rules...";
  searchInput.value = state.logsFilter.search;

  const sectionSelect = document.createElement("select");
  ["All", "Quant", "VARC (CR)", "VARC (RC)", "Data Insights", "Practice Test"].forEach((sec) => {
    const opt = document.createElement("option");
    opt.value = sec;
    opt.textContent = sec === "All" ? "All Sections" : sec;
    if (state.logsFilter.section === sec) opt.selected = true;
    sectionSelect.appendChild(opt);
  });

  const rootCauseSelect = document.createElement("select");
  ["All", "Concept Gap", "Trap Missed", "Calculation / Speed", "Misread Question", "Time Pressure"].forEach((rc) => {
    const opt = document.createElement("option");
    opt.value = rc;
    opt.textContent = rc === "All" ? "All Root Causes" : rc;
    if (state.logsFilter.rootCause === rc) opt.selected = true;
    rootCauseSelect.appendChild(opt);
  });

  const statusSelect = document.createElement("select");
  [
    { val: "All", label: "All Status" },
    { val: "needs_review", label: "🟡 Needs Review" },
    { val: "mastered", label: "🟢 Mastered" },
  ].forEach((st) => {
    const opt = document.createElement("option");
    opt.value = st.val;
    opt.textContent = st.label;
    if (state.logsFilter.status === st.val) opt.selected = true;
    statusSelect.appendChild(opt);
  });

  filterControls.append(searchInput, sectionSelect, rootCauseSelect, statusSelect);
  filterCard.appendChild(filterControls);

  // Filtered List
  const logsList = document.createElement("div");
  logsList.className = "task-list";
  logsList.style.marginTop = "12px";

  const renderLogItems = () => {
    logsList.innerHTML = "";
    const q = normalize(searchInput.value);
    const sec = sectionSelect.value;
    const rc = rootCauseSelect.value;
    const st = statusSelect.value;

    const filtered = state.logs.filter((item) => {
      if (sec !== "All" && item.section !== sec) return false;
      if (rc !== "All" && item.rootCause !== rc) return false;
      if (st !== "All" && item.status !== st) return false;
      if (q) {
        const text = normalize(`${item.topic} ${item.note || ""} ${item.goldenRule || ""} ${item.section} ${item.rootCause}`);
        if (!text.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      const emptyBox = document.createElement("div");
      emptyBox.style.padding = "30px 20px";
      emptyBox.style.textAlign = "center";
      emptyBox.style.color = "var(--muted)";
      emptyBox.innerHTML = `
        <p style="font-size: 1.05rem; margin: 0; font-weight: 600;">No error log entries match your filter.</p>
        <p style="font-size: 0.85rem; margin: 6px 0 0;">Click <strong>+ Log Mistake</strong> above to record missed questions from your night DPP.</p>
      `;
      logsList.appendChild(emptyBox);
      return;
    }

    filtered.forEach((log) => {
      const card = document.createElement("div");
      card.className = "task-item";
      card.style.display = "block";
      card.style.padding = "14px 16px";
      if (log.status === "mastered") {
        card.classList.add("done");
      }

      const headerRow = document.createElement("div");
      headerRow.style.display = "flex";
      headerRow.style.justifyContent = "space-between";
      headerRow.style.alignItems = "center";
      headerRow.style.flexWrap = "wrap";
      headerRow.style.gap = "8px";
      headerRow.style.marginBottom = "8px";

      const badgeGroup = document.createElement("div");
      badgeGroup.style.display = "flex";
      badgeGroup.style.alignItems = "center";
      badgeGroup.style.gap = "6px";

      const secBadge = document.createElement("span");
      secBadge.className = "badge";
      secBadge.textContent = log.section || "Quant";

      const rcBadge = document.createElement("span");
      rcBadge.className = "badge";
      rcBadge.style.background = "#fff7ed";
      rcBadge.style.borderColor = "#fed7aa";
      rcBadge.style.color = "#c2410c";
      rcBadge.textContent = log.rootCause || "Mistake";

      const dateText = document.createElement("span");
      dateText.style.fontSize = "0.78rem";
      dateText.style.color = "var(--muted)";
      dateText.textContent = log.date || "";

      badgeGroup.append(secBadge, rcBadge, dateText);

      const statusToggle = document.createElement("button");
      statusToggle.className = "btn";
      statusToggle.style.marginTop = "0";
      statusToggle.style.padding = "4px 10px";
      statusToggle.style.fontSize = "0.75rem";
      if (log.status === "mastered") {
        statusToggle.style.background = "#dcfce7";
        statusToggle.style.color = "#15803d";
        statusToggle.textContent = "✓ Mastered";
      } else {
        statusToggle.style.background = "#fef3c7";
        statusToggle.style.color = "#b45309";
        statusToggle.textContent = "🟡 Needs Review";
      }
      statusToggle.addEventListener("click", () => toggleLogStatus(log.id));

      headerRow.append(badgeGroup, statusToggle);
      card.appendChild(headerRow);

      const topicHeading = document.createElement("h4");
      topicHeading.style.margin = "0 0 6px";
      topicHeading.style.fontSize = "0.98rem";
      topicHeading.textContent = log.topic;
      card.appendChild(topicHeading);

      if (log.note) {
        const noteP = document.createElement("p");
        noteP.style.margin = "0 0 8px";
        noteP.style.fontSize = "0.86rem";
        noteP.style.color = "var(--muted)";
        noteP.textContent = log.note;
        card.appendChild(noteP);
      }

      if (log.goldenRule) {
        const goldenBox = document.createElement("div");
        goldenBox.style.padding = "8px 12px";
        goldenBox.style.background = "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)";
        goldenBox.style.border = "1px solid #fde68a";
        goldenBox.style.borderRadius = "8px";
        goldenBox.style.fontSize = "0.84rem";
        goldenBox.style.fontWeight = "600";
        goldenBox.style.color = "#92400e";
        goldenBox.innerHTML = `🌟 Golden Rule: <span>${log.goldenRule}</span>`;
        card.appendChild(goldenBox);
      }

      const footerRow = document.createElement("div");
      footerRow.style.display = "flex";
      footerRow.style.justifyContent = "flex-end";
      footerRow.style.marginTop = "8px";

      const delBtn = document.createElement("button");
      delBtn.style.background = "transparent";
      delBtn.style.border = "none";
      delBtn.style.color = "#ef4444";
      delBtn.style.fontSize = "0.78rem";
      delBtn.style.cursor = "pointer";
      delBtn.style.padding = "2px 6px";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => {
        if (confirm("Delete this error log entry?")) {
          deleteLogEntry(log.id);
        }
      });
      footerRow.appendChild(delBtn);
      card.appendChild(footerRow);

      logsList.appendChild(card);
    });
  };

  searchInput.addEventListener("input", renderLogItems);
  sectionSelect.addEventListener("change", renderLogItems);
  rootCauseSelect.addEventListener("change", renderLogItems);
  statusSelect.addEventListener("change", renderLogItems);
  renderLogItems();

  filterCard.appendChild(logsList);
  container.appendChild(filterCard);
  el.logsTab.appendChild(container);
}

function refreshAllViews() {
  renderToday();
  renderPlanner();
  renderLogs();
  renderLibrary();
  updateStats();
}

async function fetchCloudProgress() {
  const cfg = state.progressSync;
  const url = new URL(cfg.endpoint, window.location.origin);
  url.searchParams.set("studentId", cfg.studentId);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`Progress sync load failed (${res.status}): ${txt.slice(0, 180)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function saveCloudProgress() {
  const cfg = state.progressSync;
  const payload = {
    studentId: cfg.studentId,
    done: doneArray(),
  };

  const headers = { "Content-Type": "application/json" };
  if (cfg.writeKey) {
    headers["X-Progress-Key"] = cfg.writeKey;
  }

  const res = await fetch(cfg.endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`Progress sync save failed (${res.status}): ${txt.slice(0, 180)}`);
    err.status = res.status;
    throw err;
  }
}

function queueProgressSave() {
  const sync = state.progressSync;
  if (!sync.enabled || !sync.hasInitialized || sync.disabled) return;

  sync.dirty = true;
  if (sync.saveTimer) {
    clearTimeout(sync.saveTimer);
  }
  sync.saveTimer = setTimeout(async () => {
    if (sync.saving || !sync.dirty) return;
    sync.dirty = false;
    sync.saving = true;

    try {
      if (state.db && state.firebaseConnected) {
        const studentId = state.currentStudentId;
        await state.db.collection("students").doc(studentId).collection("meta").doc("progress").set({
          done: doneArray(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      if (sync.enabled && !sync.disabled) {
        await saveCloudProgress();
      }
    } catch (err) {
      if (err.status === 405 || err.status === 404) {
        // Backend API endpoint is not available on this static/local host; Firestore or local storage used
        sync.disabled = true;
        sync.dirty = false;
      } else {
        sync.dirty = true;
        if (!sync.warned && !state.firebaseConnected) {
          setStatus(err.message || "Progress sync save failed; using local storage for now.", true);
          sync.warned = true;
        }
      }
    } finally {
      sync.saving = false;
      if (sync.dirty && !sync.disabled) {
        queueProgressSave();
      }
    }
  }, 600);
}

async function initProgressSync() {
  const sync = state.progressSync;
  if (!sync.enabled) return;

  try {
    const remote = await fetchCloudProgress();
    const remoteDone = Array.isArray(remote?.done) ? remote.done : [];
    const localDone = doneArray();

    if (!remoteDone.length && localDone.length) {
      await saveCloudProgress();
      setStatus(`Loaded ${state.staticFiles.length} static public links. Cloud progress initialized.`);
    } else if (remoteDone.length) {
      setDoneFromArray(remoteDone);
      refreshAllViews();
      setStatus(`Loaded ${state.staticFiles.length} static public links. Cloud progress synced.`);
    }
  } catch (err) {
    if (err.status === 405 || err.status === 404) {
      sync.disabled = true;
    }
    setStatus("Loaded links. Progress saved locally on this device.");
  } finally {
    sync.hasInitialized = true;
  }
}

async function syncDrive() {
  try {
    const publicLinks = await fetchPublicLinks();
    buildPublicIndexes(publicLinks);
    setStatus(`Loaded ${state.staticFiles.length} static public links.`);
  } catch (err) {
    setStatus(err.message || "Failed to load static public links.", true);
  }

  refreshAllViews();
}

function wireTabs() {
  el.menuTabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;

    const tab = btn.dataset.tab;
    state.activeTab = tab;

    [...el.menuTabs.querySelectorAll("button")].forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
    document.getElementById(`tab-${tab}`).classList.remove("hidden");
  });
}

async function init() {
  wireTabs();
  wireUserControls();
  renderUserControls();
  applyProgressConfig();

  if (el.folderIdText) {
    el.folderIdText.textContent = CONFIG?.drive?.folderId || "(missing)";
  }
  if (el.reloadLinksBtn) {
    el.reloadLinksBtn.addEventListener("click", syncDrive);
  }

  try {
    const rawPlan = await fetchDayPlan();
    state.baseDays = rawPlan?.days || [];
    rebuildDynamicPlan(getUserStartDate(state.currentStudentId));
  } catch (err) {
    setStatus(err.message || "Could not load planner data.", true);
    return;
  }
  await syncDrive();
  await initProgressSync();
  await initFirebase();
  renderLogs();
}

init();
