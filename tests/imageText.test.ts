import { describe, expect, it } from "vitest";
import { effectivePostText, postImageUrl } from "@/lib/imageText";

describe("postImageUrl", () => {
  it("prefers post_image, then attachments, then external image", () => {
    expect(postImageUrl({ post_image: "https://a/1.jpg", attachments: [{ url: "https://a/2.jpg" }] })).toBe("https://a/1.jpg");
    expect(postImageUrl({ attachments: [{ id: "x" }, { url: "https://a/2.jpg" }] })).toBe("https://a/2.jpg");
    expect(postImageUrl({ post_external_image: "https://a/3.jpg" })).toBe("https://a/3.jpg");
    expect(postImageUrl({ header_image: "https://a/cover.jpg" })).toBe("");
  });
});

describe("effectivePostText", () => {
  it("uses the phrase read from the image when the post text is just an emoji", () => {
    expect(effectivePostText("🙏", "Dios no llega tarde.\nLlega a tiempo.")).toBe("Dios no llega tarde.\nLlega a tiempo.");
  });

  it("falls back to the post text when the image has no readable phrase", () => {
    expect(effectivePostText("Un día vas a pedir flores y Dios te mandará un jardín.", "")).toBe("Un día vas a pedir flores y Dios te mandará un jardín.");
  });
});
