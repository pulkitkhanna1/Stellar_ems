const GIST_API_BASE = "https://api.github.com/gists";
const DEFAULT_FILE_NAME = "stellar-progress.json";
const DEFAULT_STUDENT_ID = "default";

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).send(JSON.stringify(payload));
}

function asSingle(value, fallback = "") {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

function cleanStudentId(raw) {
  const value = String(raw || DEFAULT_STUDENT_ID).trim();
  if (!value) return DEFAULT_STUDENT_ID;
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || DEFAULT_STUDENT_ID;
}

function parseJsonSafe(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (_err) {
    return fallback;
  }
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  let raw = "";
  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", resolve);
    req.on("error", reject);
  });

  if (!raw) return {};
  return parseJsonSafe(raw, {});
}

function cleanedDoneArray(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];

  input.forEach((item) => {
    if (typeof item !== "string") return;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  });

  out.sort();
  return out;
}

async function githubFetch(path, options = {}) {
  const gistId = process.env.PROGRESS_GIST_ID;
  const token = process.env.PROGRESS_GITHUB_TOKEN;
  if (!gistId || !token) {
    throw new Error("Missing PROGRESS_GIST_ID or PROGRESS_GITHUB_TOKEN");
  }

  const url = `${GIST_API_BASE}/${gistId}${path ? `/${path}` : ""}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {}),
  };

  return fetch(url, { ...options, headers });
}

async function readStore() {
  const fileName = process.env.PROGRESS_GIST_FILENAME || DEFAULT_FILE_NAME;
  const res = await githubFetch("");
  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`GitHub fetch failed (${res.status}): ${raw.slice(0, 180)}`);
  }

  const gist = parseJsonSafe(raw, {});
  const content = gist?.files?.[fileName]?.content || "{}";
  const store = parseJsonSafe(content, {});
  if (!store || typeof store !== "object" || Array.isArray(store)) {
    return { fileName, store: {} };
  }
  return { fileName, store };
}

async function writeStore(fileName, store) {
  const content = JSON.stringify(store, null, 2);
  const res = await githubFetch("", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: {
        [fileName]: { content },
      },
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub update failed (${res.status}): ${raw.slice(0, 180)}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET,PUT,OPTIONS");
    return res.status(204).send("");
  }

  if (!["GET", "PUT"].includes(req.method)) {
    res.setHeader("Allow", "GET,PUT,OPTIONS");
    return json(res, 405, { error: "Method not allowed" });
  }

  const writeKey = process.env.PROGRESS_WRITE_KEY || "";
  if (req.method === "PUT" && writeKey) {
    const provided = asSingle(req.headers["x-progress-key"], "");
    if (provided !== writeKey) {
      return json(res, 401, { error: "Invalid progress write key" });
    }
  }

  try {
    const { fileName, store } = await readStore();

    if (req.method === "GET") {
      const studentId = cleanStudentId(asSingle(req.query.studentId, DEFAULT_STUDENT_ID));
      const record = store?.[studentId] || {};
      return json(res, 200, {
        studentId,
        done: cleanedDoneArray(record.done || []),
        updatedAt: record.updatedAt || null,
      });
    }

    const body = await parseBody(req);
    const studentId = cleanStudentId(body.studentId || DEFAULT_STUDENT_ID);
    const done = cleanedDoneArray(body.done || []);
    store[studentId] = {
      done,
      updatedAt: new Date().toISOString(),
    };

    await writeStore(fileName, store);

    return json(res, 200, {
      ok: true,
      studentId,
      count: done.length,
      updatedAt: store[studentId].updatedAt,
    });
  } catch (err) {
    return json(res, 500, {
      error: "Progress backend failed",
      detail: String(err?.message || err),
    });
  }
};
