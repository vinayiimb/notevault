// Minimal, dependency-free Google Drive read access — lists PDFs inside a
// public folder by calling the REST API directly with an API key (no OAuth,
// no service account: the folders this is used for are all shared as
// "anyone with the link can view"). We only ever read metadata (file id,
// name, view link) — never download bytes, so there's no storage cost.

export type DriveFile = {
  id: string;
  name: string;
  webViewLink: string;
};

// Accepts a full Drive folder URL (https://drive.google.com/drive/folders/<id>?usp=sharing)
// or a bare folder id, and returns just the id.
export function extractDriveFolderId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

// Lists every PDF directly inside a folder (not recursive — subfolders, if
// any, are ignored). Paginates through Drive's 1000-file-per-page limit.
export async function listDriveFolderPdfs(folderId: string): Promise<DriveFile[]> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_DRIVE_API_KEY is not configured.");
  }

  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      key: apiKey,
      fields: "nextPageToken,files(id,name,webViewLink)",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Drive API error (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      files: { id: string; name: string; webViewLink?: string }[];
      nextPageToken?: string;
    };
    for (const f of data.files) {
      files.push({ id: f.id, name: f.name, webViewLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view` });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}
