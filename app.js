const CONFIG = window.EMS_CONFIG || {};
const STORAGE_KEY_DONE = "stellar_ems_done_v1";

const state = {
  dayPlan: null,
  done: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY_DONE) || "[]")),
  staticFiles: [],
  publicByPath: new Map(),
  publicByName: new Map(),
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

function persistDone() {
  localStorage.setItem(STORAGE_KEY_DONE, JSON.stringify([...state.done]));
}

function taskKey(date, title) {
  return `${date}::${title}`;
}

function getStartDate() {
  return CONFIG?.startDate || state.dayPlan?.start_date || "";
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
  const h = document.createElement("h3");
  h.textContent = `${day.date} (${day.weekday})`;
  left.appendChild(h);

  if (backlogRows.length) {
    const sub = document.createElement("h4");
    sub.textContent = `Backlog Stack (${backlogRows.length})`;
    sub.style.margin = "0 0 8px";
    left.appendChild(sub);

    const backlogList = document.createElement("div");
    backlogList.className = "task-list";
    backlogRows.forEach((r) => renderTaskBlock(backlogList, r));
    left.appendChild(backlogList);
  }

  const todaySub = document.createElement("h4");
  todaySub.textContent = "Today Plan";
  todaySub.style.margin = "12px 0 8px";
  left.appendChild(todaySub);

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

  if (backlogRows.length) {
    el.heroTitle.textContent = `Backlog ${backlogRows.length} + Today: ${day.core}`;
    el.heroSub.textContent = `Clear the backlog stack first, then complete today's core flow.`;
  } else {
    el.heroTitle.textContent = `Today: ${day.core}`;
    el.heroSub.textContent = `Stay consistent. Finish core + tests + review loop.`;
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

function refreshAllViews() {
  renderToday();
  renderPlanner();
  renderLibrary();
  updateStats();
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

  el.folderIdText.textContent = CONFIG?.drive?.folderId || "(missing)";
  if (el.reloadLinksBtn) {
    el.reloadLinksBtn.addEventListener("click", syncDrive);
  }

  try {
    state.dayPlan = await fetchDayPlan();
  } catch (err) {
    setStatus(err.message || "Could not load planner data.", true);
    return;
  }
  await syncDrive();
}

init();
