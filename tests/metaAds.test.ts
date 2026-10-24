import { describe, expect, it } from "vitest";
import { adsManagerUrl, summarizeInsights, toMinorUnits, validateLikesCampaign } from "@/lib/metaAds";

const valid = { accountId: "act_123", pageId: "456", postId: "456_789", name: "Prueba", dailyBudget: 50, days: 7, countries: ["mx"], ageMin: 25, ageMax: 65 };

describe("validateLikesCampaign", () => {
  it("normalizes a valid campaign", () => {
    expect(validateLikesCampaign(valid, 200)).toMatchObject({ countries: ["MX"], dailyBudget: 50, days: 7 });
  });

  it("rejects budgets above the cap", () => {
    expect(() => validateLikesCampaign({ ...valid, dailyBudget: 201 }, 200)).toThrow(/no puede pasar de 200/);
  });

  it("rejects a post from another page", () => {
    expect(() => validateLikesCampaign({ ...valid, postId: "999_789" }, 200)).toThrow(/publicación de esa página/);
  });

  it("rejects bad ages, durations and accounts", () => {
    expect(() => validateLikesCampaign({ ...valid, ageMin: 40, ageMax: 30 }, 200)).toThrow(/edad/);
    expect(() => validateLikesCampaign({ ...valid, days: 45 }, 200)).toThrow(/1 y 30/);
    expect(() => validateLikesCampaign({ ...valid, accountId: "123" }, 200)).toThrow(/cuenta/);
  });
});

describe("money helpers", () => {
  it("uses cents except for currencies without them", () => {
    expect(toMinorUnits(50, "MXN")).toBe(5000);
    expect(toMinorUnits(5000, "COP")).toBe(5000);
  });
});

describe("summarizeInsights", () => {
  it("computes cost per page like", () => {
    expect(summarizeInsights({ spend: "120.50", actions: [{ action_type: "post_engagement", value: "900" }, { action_type: "like", value: "241" }] })).toMatchObject({ spend: 120.5, likes: 241, costPerLike: 0.5 });
  });

  it("returns no cost when there are no likes", () => {
    expect(summarizeInsights(undefined)).toMatchObject({ spend: 0, likes: 0, costPerLike: null });
  });
});

it("links to the campaign in Ads Manager", () => {
  expect(adsManagerUrl("act_123", "999")).toBe("https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=123&selected_campaign_ids=999");
});
