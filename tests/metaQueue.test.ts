import { describe, expect, it } from "vitest";
import { metaOnly, type MetaQueuePost } from "@/lib/metaQueue";

const post = (id: string, date: string, time: string, localId: string | null = null): MetaQueuePost => ({ id, date, time, text: "", epoch: 0, localId });

describe("metaOnly", () => {
  it("drops posts already linked by meta_post_id or local id", () => {
    const posts = [post("p1", "2026-10-24", "10:35"), post("p2", "2026-10-24", "11:15", "local-2")];
    const items = [{ id: "a", metaPostId: "p1" }, { id: "local-2" }];
    expect(metaOnly(posts, items)).toEqual([]);
  });

  it("drops scheduled images whose stored id is the photo id, matching by date and time", () => {
    const posts = [post("page_post1", "2026-10-24", "10:35")];
    const items = [{ id: "a", metaPostId: "photo-123", date: "2026-10-24", time: "10:35", status: "Programado" }];
    expect(metaOnly(posts, items)).toEqual([]);
  });

  it("keeps posts that only exist in Meta", () => {
    const posts = [post("page_post9", "2026-10-24", "12:00")];
    const items = [{ id: "draft", date: "2026-10-24", time: "12:00", status: "Borrador" }];
    expect(metaOnly(posts, items)).toHaveLength(1);
  });
});
