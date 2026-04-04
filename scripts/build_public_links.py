from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

FOLDER_ID = os.environ.get("EMS_DRIVE_FOLDER_ID", "11GTSMZQlZctn6XXfKf1J7mOicJQkN_bx")
API_KEY = os.environ.get("EMS_DRIVE_API_KEY", "")
OUT = "/Users/pulkit/Downloads/Stellar/ems-portal/data/public-links.json"
OUT_INLINE = "/Users/pulkit/Downloads/Stellar/ems-portal/data/public-links-inline.js"

FOLDER_MIME = "application/vnd.google-apps.folder"


def file_url(file_obj: dict) -> str:
    mt = file_obj.get("mimeType", "")
    fid = file_obj["id"]
    if mt == "application/vnd.google-apps.document":
        return f"https://docs.google.com/document/d/{fid}/edit"
    if mt == "application/vnd.google-apps.spreadsheet":
        return f"https://docs.google.com/spreadsheets/d/{fid}/edit"
    if mt == "application/vnd.google-apps.presentation":
        return f"https://docs.google.com/presentation/d/{fid}/edit"
    return file_obj.get("webViewLink") or f"https://drive.google.com/file/d/{fid}/view"


def list_children(folder_id: str, page_token: str = "") -> dict:
    q = f"'{folder_id}' in parents and trashed=false"
    params = {
        "q": q,
        "pageSize": "1000",
        "fields": "nextPageToken,files(id,name,mimeType,webViewLink)",
        "key": API_KEY,
    }
    if page_token:
        params["pageToken"] = page_token

    url = "https://www.googleapis.com/drive/v3/files?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def crawl(folder_id: str):
    queue = [(folder_id, [])]
    files = []

    while queue:
        fid, path_prefix = queue.pop(0)
        token = ""
        while True:
            data = list_children(fid, token)
            for f in data.get("files", []):
                if f.get("mimeType") == FOLDER_MIME:
                    queue.append((f["id"], path_prefix + [f["name"]]))
                else:
                    rel = "/".join(path_prefix + [f["name"]])
                    files.append({
                        "name": f["name"],
                        "relativePath": rel,
                        "url": file_url(f),
                    })
            token = data.get("nextPageToken") or ""
            if not token:
                break

    return files


def main():
    if not API_KEY:
        print("Missing EMS_DRIVE_API_KEY (needed only to regenerate public-links.json)", file=sys.stderr)
        sys.exit(1)

    files = crawl(FOLDER_ID)

    by_rel = {}
    by_name = defaultdict(list)

    for f in files:
        by_rel[f["relativePath"]] = f["url"]
        by_name[f["name"]].append(f["url"])

    # deterministically pick first for basename lookups
    by_name_first = {k: sorted(v)[0] for k, v in by_name.items()}

    payload = {
        "folderId": FOLDER_ID,
        "count": len(files),
        "byRelativePath": by_rel,
        "byName": by_name_first,
    }

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)

    with open(OUT_INLINE, "w", encoding="utf-8") as fh:
        fh.write("window.__PUBLIC_LINKS_INLINE = ")
        json.dump(payload, fh, ensure_ascii=False)
        fh.write(";\\n")

    print(f"Wrote {OUT} with {len(files)} files")
    print(f"Wrote {OUT_INLINE}")


if __name__ == "__main__":
    main()
