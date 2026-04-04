const CONFIG = window.EMS_CONFIG || {};
const STORAGE_KEY_DONE = "stellar_ems_done_v1";
const STORAGE_KEY_API = "stellar_ems_api_key_v1";

const state = {
  dayPlan: null,
  done: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY_DONE) || "[]")),
  driveFiles: [],
  urlByPath: new Map(),
  urlByBase: new Map(),
  activeTab: "today",
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
  libraryTab: document.getElementById("tab-library"),
  menuTabs: document.getElementById("menuTabs"),
  folderIdText: document.getElementById("folderIdText"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveApiKeyBtn: document.getElementById("saveApiKeyBtn"),
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
    timeZone: tz || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function getApiKey() {
  return localStorage.getItem(STORAGE_KEY_API) || CONFIG?.drive?.apiKey || "";
}

function setApiKey(value) {
  localStorage.setItem(STORAGE_KEY_API, value || "");
}

function persistDone() {
  localStorage.setItem(STORAGE_KEY_DONE, JSON.stringify([...state.done]));
}

function taskKey(date, title) {
  return `${date}::${title}`;
}

function allTaskRows() {
  if (!state.dayPlan?.days) return [];
  const rows = [];
  for (const day of state.dayPlan.days) {
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

  const today = todayInTZ(CONFIG.timezone || "Asia/Kolkata");
  const day = state.dayPlan.days.find((d) => d.date === today) || state.dayPlan.days[0];

  const wrapper = document.createElement("div");
  wrapper.className = "grid-2";

  const left = document.createElement("div");
  left.className = "card";
  const h = document.createElement("h3");
  h.textContent = `${day.date} (${day.weekday})`;
  left.appendChild(h);

  const taskList = document.createElement("div");
  taskList.className = "task-list";
  renderTaskBlock(taskList, {
    date: day.date,
    title: day.core,
    files: day.files,
    test: day.test_number,
  });

  (day.focus_plan || []).forEach((t) => {
    renderTaskBlock(taskList, {
      date: day.date,
      title: t.title,
      files: t.files,
      test: null,
    });
  });

  left.appendChild(taskList);
  wrapper.appendChild(left);

  const right = document.createElement("div");
  right.className = "card";
  const h2 = document.createElement("h3");
  h2.textContent = "Execution Notes";
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

  wrapper.appendChild(right);
  el.todayTab.appendChild(wrapper);

  el.heroTitle.textContent = `Today: ${day.core}`;
  el.heroSub.textContent = `Stay consistent. Finish core + tests + review loop.`;
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

  if (!state.driveFiles.length) {
    const p = document.createElement("p");
    p.className = "note-line";
    p.textContent = "No Drive index loaded yet. Add API key and click Save & Sync.";
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

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr><th>File</th><th>Path</th><th>Type</th><th>Open</th></tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  card.appendChild(table);
  el.libraryTab.appendChild(card);

  const rerender = () => {
    tbody.innerHTML = "";
    const q = normalize(search.value);
    const t = typeFilter.value;

    state.driveFiles.forEach((f) => {
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
  const res = await fetch("./data/day-plan.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to load day-plan.json");
  return res.json();
}

async function listFolderChildren(folderId, apiKey, pageToken = "") {
  const q = `'${folderId}' in parents and trashed=false`;
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("pageSize", "1000");
  url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,size)");
  url.searchParams.set("key", apiKey);
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive API error (${res.status}): ${txt.slice(0, 200)}`);
  }
  return res.json();
}

function fileUrlForGoogle(file) {
  const mt = file.mimeType || "";
  if (mt === "application/vnd.google-apps.document") return `https://docs.google.com/document/d/${file.id}/edit`;
  if (mt === "application/vnd.google-apps.spreadsheet") return `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
  if (mt === "application/vnd.google-apps.presentation") return `https://docs.google.com/presentation/d/${file.id}/edit`;
  if (file.webViewLink) return file.webViewLink;
  return `https://drive.google.com/file/d/${file.id}/view`;
}

async function indexDrive(folderId, apiKey) {
  const FOLDER_MIME = "application/vnd.google-apps.folder";
  const queue = [{ id: folderId, path: [] }];
  const files = [];

  while (queue.length) {
    const current = queue.shift();
    let pageToken = "";

    do {
      const payload = await listFolderChildren(current.id, apiKey, pageToken);
      for (const file of payload.files || []) {
        if (file.mimeType === FOLDER_MIME) {
          queue.push({ id: file.id, path: [...current.path, file.name] });
        } else {
          const relativePath = [...current.path, file.name].join("/");
          files.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            relativePath,
            path: [...current.path],
            url: fileUrlForGoogle(file),
          });
        }
      }
      pageToken = payload.nextPageToken || "";
    } while (pageToken);
  }

  return files;
}

function buildIndexes() {
  state.urlByPath.clear();
  state.urlByBase.clear();

  state.driveFiles.forEach((f) => {
    state.urlByPath.set(normalize(f.relativePath), f.url);
    const b = normalize(f.name);
    if (!state.urlByBase.has(b)) state.urlByBase.set(b, f.url);
  });
}

function resolveFileUrl(ref) {
  if (!ref) return null;
  const p = normalize(ref);
  if (state.urlByPath.has(p)) return state.urlByPath.get(p);

  const b = normalize(basename(ref));
  if (state.urlByBase.has(b)) return state.urlByBase.get(b);

  return null;
}

function refreshAllViews() {
  renderToday();
  renderPlanner();
  renderLibrary();
  updateStats();
}

async function syncDrive() {
  const apiKey = getApiKey();
  if (!apiKey) {
    setStatus("Add a Google API key to enable live Drive indexing.", true);
    state.driveFiles = [];
    buildIndexes();
    refreshAllViews();
    return;
  }

  setStatus("Syncing from Google Drive... this can take a bit for large folders.");
  try {
    const files = await indexDrive(CONFIG.drive.folderId, apiKey);
    state.driveFiles = files;
    buildIndexes();
    setStatus(`Drive sync complete: ${files.length} files indexed.`);
  } catch (err) {
    setStatus(err.message || "Drive sync failed.", true);
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

  el.folderIdText.textContent = CONFIG?.drive?.folderId || "(missing)";
  el.apiKeyInput.value = getApiKey();

  el.saveApiKeyBtn.addEventListener("click", async () => {
    setApiKey(el.apiKeyInput.value.trim());
    await syncDrive();
  });

  try {
    state.dayPlan = await fetchDayPlan();
  } catch (err) {
    setStatus(err.message || "Could not load planner data.", true);
    return;
  }

  await syncDrive();
  refreshAllViews();
}

init();
