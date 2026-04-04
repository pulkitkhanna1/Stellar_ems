module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY || "AIzaSyDvNMzFOW6KEr1QWoQz3LmRnNgqD6OhbP4";
  if (!apiKey) {
    return res.status(500).json({
      error: "Missing GOOGLE_DRIVE_API_KEY on server",
      hint: "Set it in Vercel Project Settings -> Environment Variables",
    });
  }

  const folderIdRaw = req.query.folderId;
  const pageTokenRaw = req.query.pageToken;
  const folderId = Array.isArray(folderIdRaw) ? folderIdRaw[0] : folderIdRaw;
  const pageToken = Array.isArray(pageTokenRaw) ? pageTokenRaw[0] : pageTokenRaw;

  if (!folderId) {
    return res.status(400).json({ error: "folderId is required" });
  }

  try {
    const q = `'${folderId}' in parents and trashed=false`;
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", q);
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,size)");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const upstream = await fetch(url.toString());
    const body = await upstream.text();

    if (!upstream.ok) {
      return res.status(upstream.status).send(body);
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(body);
  } catch (err) {
    return res.status(500).json({ error: "Proxy request failed", detail: String(err?.message || err) });
  }
};
