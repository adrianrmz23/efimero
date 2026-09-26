import { createHash } from "crypto";

export type BrightDataPost = {
  providerPostId: string;
  postUrl: string;
  text: string;
  postedAt: string | null;
  reactions: number;
  comments: number;
  shares: number;
  authorName?: string;
  raw: Record<string, unknown>;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase().replace(/,/g, "");
    const match = clean.match(/^([\d.]+)\s*([kmb])?$/i);
    if (match) {
      const base = Number(match[1]);
      const mult = match[2] === "k" ? 1e3 : match[2] === "m" ? 1e6 : match[2] === "b" ? 1e9 : 1;
      if (Number.isFinite(base)) return Math.max(0, Math.round(base * mult));
    }
    const parsed = Number(clean.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["count", "total_count", "total", "value"]) {
      if (key in obj) return toNumber(obj[key]);
    }
  }
  return 0;
};

const firstString = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const firstNumber = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (key in row) {
      const value = toNumber(row[key]);
      if (value > 0) return value;
    }
  }
  return 0;
};

export function normalizeBrightDataPosts(payload: unknown): BrightDataPost[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as any).data)
      ? (payload as any).data
      : payload && typeof payload === "object" && Array.isArray((payload as any).results)
        ? (payload as any).results
        : [];

  const seen = new Set<string>();
  const posts: BrightDataPost[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.error === "string" && !firstString(row, ["content", "text", "message", "description"])) continue;

    const text = firstString(row, ["content", "text", "message", "description", "caption"]);
    const postUrl = firstString(row, ["url", "post_url", "postUrl", "permalink_url", "permalink"]);
    const rawPostedAt = firstString(row, ["date_posted", "date", "created_time", "createdAt", "timestamp"]);
    const parsedDate = rawPostedAt ? new Date(rawPostedAt) : null;
    const postedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
    const explicitId = firstString(row, ["post_id", "postId", "id", "facebook_post_id"]);
    if (!text && !postUrl) continue;

    const fallbackId = createHash("sha256").update(`${postUrl}|${postedAt || ""}|${text}`).digest("hex").slice(0, 32);
    const providerPostId = explicitId || fallbackId;
    if (seen.has(providerPostId)) continue;
    seen.add(providerPostId);

    posts.push({
      providerPostId,
      postUrl,
      text,
      postedAt,
      reactions: firstNumber(row, ["num_likes", "likes", "likes_count", "num_reactions", "reactions", "reactions_count"]),
      comments: firstNumber(row, ["num_comments", "comments", "comments_count", "comment_count"]),
      shares: firstNumber(row, ["num_shares", "shares", "shares_count", "share_count"]),
      authorName: firstString(row, ["user_name", "user_username_raw", "page_name", "author_name", "username"]),
      raw: row,
    });
  }
  return posts;
}

function getConfig() {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const datasetId = process.env.BRIGHTDATA_FACEBOOK_POSTS_DATASET_ID;
  if (!apiKey || !datasetId) throw new Error("Faltan BRIGHTDATA_API_KEY o BRIGHTDATA_FACEBOOK_POSTS_DATASET_ID.");
  return { apiKey, datasetId };
}

export async function startBrightDataFacebookScrape(input: {
  url: string;
  numPosts: number;
  startDate?: string;
  endDate?: string;
}) {
  const { apiKey, datasetId } = getConfig();
  const params = new URLSearchParams({ dataset_id: datasetId, format: "json", include_errors: "true" });
  // Este dataset usa discovery por URL de perfil/página.
  params.set("type", "discover_new");
  params.set("discover_by", "profile_url");
  const payload: Record<string, unknown> = {
    url: input.url,
    num_of_posts: Math.max(1, Math.min(100, Math.round(input.numPosts || 25))),
    include_profile_data: true,
  };
  if (input.startDate) payload.start_date = input.startDate;
  if (input.endDate) payload.end_date = input.endDate;

  const response = await fetch(`https://api.brightdata.com/datasets/v3/scrape?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: [payload] }),
    cache: "no-store",
  });

  const bodyText = await response.text();
  let parsed: any = null;
  try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch { parsed = bodyText; }

  if (response.status === 202 && parsed?.snapshot_id) return { pending: true as const, snapshotId: String(parsed.snapshot_id), posts: [] as BrightDataPost[] };
  if (!response.ok) throw new Error(typeof parsed === "string" ? parsed : parsed?.message || parsed?.error || `Bright Data respondió ${response.status}.`);
  return { pending: false as const, snapshotId: null, posts: normalizeBrightDataPosts(parsed) };
}

export async function retrieveBrightDataSnapshot(snapshotId: string) {
  const { apiKey } = getConfig();
  const progress = await fetch(`https://api.brightdata.com/datasets/v3/progress/${encodeURIComponent(snapshotId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!progress.ok) throw new Error(`No se pudo consultar el snapshot (${progress.status}).`);
  const status = await progress.json();
  if (status?.status === "failed") throw new Error("Bright Data marcó la extracción como fallida.");
  if (status?.status !== "ready") return { ready: false as const, posts: [] as BrightDataPost[] };

  const download = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!download.ok) throw new Error(`No se pudo descargar el snapshot (${download.status}).`);
  const data = await download.json();
  return { ready: true as const, posts: normalizeBrightDataPosts(data) };
}
