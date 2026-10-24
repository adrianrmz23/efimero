import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  META_MIN_SCHEDULE_MINUTES,
  fetchMetaQueueSuggestion,
  isScheduleInFuture,
  localDateString,
  localDateTime,
  localTimeString,
  minTimeForDate,
  minuteOfDay,
  nextAllowedSchedule,
} from "@/lib/scheduling";

/** Fecha en hora local (America/Mexico_City, fijada en vitest.config.mts). */
const local = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s);

describe("test environment", () => {
  it("runs in America/Mexico_City (UTC-6, no DST since 2022)", () => {
    expect(process.env.TZ).toBe("America/Mexico_City");
    expect(local(2026, 1, 15).getTimezoneOffset()).toBe(360);
    expect(local(2026, 7, 15).getTimezoneOffset()).toBe(360);
  });
});

describe("META_MIN_SCHEDULE_MINUTES", () => {
  it("is 10 minutes", () => {
    expect(META_MIN_SCHEDULE_MINUTES).toBe(10);
  });
});

describe("localDateString / localTimeString", () => {
  it("zero-pads month, day, hours and minutes", () => {
    const d = local(2026, 3, 5, 7, 4);
    expect(localDateString(d)).toBe("2026-03-05");
    expect(localTimeString(d)).toBe("07:04");
  });

  it("uses the local calendar day, not the UTC one", () => {
    const evening = local(2026, 3, 5, 20, 30); // 02:30Z del día siguiente
    expect(evening.toISOString()).toBe("2026-03-06T02:30:00.000Z");
    expect(localDateString(evening)).toBe("2026-03-05");
    expect(localTimeString(evening)).toBe("20:30");
  });

  it("drops seconds", () => {
    expect(localTimeString(local(2026, 3, 5, 9, 59, 59))).toBe("09:59");
  });
});

describe("localDateTime", () => {
  it("interprets date + time as local wall-clock time", () => {
    expect(localDateTime("2026-03-05", "09:30").getTime()).toBe(Date.UTC(2026, 2, 5, 15, 30));
    expect(localDateTime("2026-03-05", "09:30").getTime()).toBe(local(2026, 3, 5, 9, 30).getTime());
  });

  it("returns an invalid Date for malformed input", () => {
    expect(Number.isNaN(localDateTime("2026-03-05", "9:30").getTime())).toBe(true);
    expect(Number.isNaN(localDateTime("05/03/2026", "09:30").getTime())).toBe(true);
    expect(Number.isNaN(localDateTime("2026-13-01", "10:00").getTime())).toBe(true);
  });

  // NOTE (V8 Date-parsing quirks, not strict validation): empty inputs parse to
  // 2000-01-01 00:00 local, and an impossible day overflows into the next month.
  // Documents CURRENT behavior under Node/V8.
  it("CURRENT BEHAVIOR: lenient V8 parsing of empty / out-of-range input", () => {
    expect(localDateTime("", "").getTime()).toBe(local(2000, 1, 1).getTime());
    expect(localDateString(localDateTime("2026-02-30", "10:00"))).toBe("2026-03-02");
  });
});

describe("isScheduleInFuture", () => {
  const now = local(2026, 3, 5, 10, 0, 0);

  it("accepts exactly the Meta minimum lead time (inclusive boundary)", () => {
    expect(isScheduleInFuture("2026-03-05", "10:10", META_MIN_SCHEDULE_MINUTES, now)).toBe(true);
  });

  it("rejects anything closer than the minimum lead time", () => {
    expect(isScheduleInFuture("2026-03-05", "10:09", META_MIN_SCHEDULE_MINUTES, now)).toBe(false);
    expect(isScheduleInFuture("2026-03-05", "10:00", META_MIN_SCHEDULE_MINUTES, now)).toBe(false);
  });

  it("rejects past times", () => {
    expect(isScheduleInFuture("2026-03-05", "09:00", META_MIN_SCHEDULE_MINUTES, now)).toBe(false);
    expect(isScheduleInFuture("2026-03-04", "23:59", META_MIN_SCHEDULE_MINUTES, now)).toBe(false);
  });

  it("accepts an earlier clock time on a later day", () => {
    expect(isScheduleInFuture("2026-03-06", "06:00", META_MIN_SCHEDULE_MINUTES, now)).toBe(true);
  });

  it("honors a custom minimum", () => {
    expect(isScheduleInFuture("2026-03-05", "10:20", 30, now)).toBe(false);
    expect(isScheduleInFuture("2026-03-05", "10:30", 30, now)).toBe(true);
    expect(isScheduleInFuture("2026-03-05", "10:00", 0, now)).toBe(true);
  });

  it("seconds in `now` count against the boundary", () => {
    const withSeconds = local(2026, 3, 5, 10, 0, 30);
    expect(isScheduleInFuture("2026-03-05", "10:10", 10, withSeconds)).toBe(false);
    expect(isScheduleInFuture("2026-03-05", "10:11", 10, withSeconds)).toBe(true);
  });

  it("returns false for invalid input", () => {
    expect(isScheduleInFuture("", "", 10, now)).toBe(false);
    expect(isScheduleInFuture("2026-03-05", "nope", 10, now)).toBe(false);
  });

  describe("with default arguments (fake clock)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(local(2026, 3, 5, 10, 0, 0));
    });
    afterEach(() => vi.useRealTimers());

    it("uses the current time and the Meta minimum", () => {
      expect(isScheduleInFuture("2026-03-05", "10:09")).toBe(false);
      expect(isScheduleInFuture("2026-03-05", "10:10")).toBe(true);
    });
  });
});

describe("nextAllowedSchedule", () => {
  it("adds the lead time (default 20 min) and rounds up to 5 minutes", () => {
    expect(nextAllowedSchedule(20, 5, local(2026, 3, 5, 10, 2))).toEqual({
      date: "2026-03-05",
      time: "10:25",
      value: "2026-03-05T10:25",
    });
  });

  it("keeps a time that already lands on the rounding step", () => {
    expect(nextAllowedSchedule(20, 5, local(2026, 3, 5, 10, 0)).time).toBe("10:20");
  });

  it("rolls into the next hour when rounding reaches :60", () => {
    expect(nextAllowedSchedule(20, 5, local(2026, 3, 5, 10, 36)).time).toBe("11:00");
  });

  it("rolls into the next day (and month/year) across midnight", () => {
    expect(nextAllowedSchedule(20, 5, local(2026, 3, 5, 23, 37))).toEqual({
      date: "2026-03-06",
      time: "00:00",
      value: "2026-03-06T00:00",
    });
    expect(nextAllowedSchedule(20, 5, local(2026, 3, 5, 23, 41)).value).toBe("2026-03-06T00:05");
    expect(nextAllowedSchedule(20, 5, local(2026, 12, 31, 23, 50)).value).toBe("2027-01-01T00:10");
  });

  it("supports other rounding steps", () => {
    expect(nextAllowedSchedule(20, 15, local(2026, 3, 5, 10, 1)).time).toBe("10:30");
    expect(nextAllowedSchedule(10, 1, local(2026, 3, 5, 10, 3)).time).toBe("10:13");
  });

  it("result is always at least the lead time ahead when `now` has no seconds", () => {
    for (let minute = 0; minute < 60; minute++) {
      const now = local(2026, 3, 5, 10, minute);
      const next = nextAllowedSchedule(META_MIN_SCHEDULE_MINUTES, 5, now);
      expect(isScheduleInFuture(next.date, next.time, META_MIN_SCHEDULE_MINUTES, now)).toBe(true);
    }
  });

  // SUSPECTED BUG: seconds are truncated (setSeconds(0,0)) BEFORE rounding, so when
  // now+lead lands exactly on a rounding step with seconds > 0, the suggestion ends up
  // up to 59 s short of the lead time. Fixed: it now rounds up to the next full minute first.
  it("never suggests a time below the lead time when `now` has seconds", () => {
    const now = local(2026, 3, 5, 10, 0, 30);
    const next = nextAllowedSchedule(META_MIN_SCHEDULE_MINUTES, 5, now);
    expect(next.time).toBe("10:15");
    expect(isScheduleInFuture(next.date, next.time, META_MIN_SCHEDULE_MINUTES, now)).toBe(true);
  });

  describe("with default arguments (fake clock)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(local(2026, 3, 5, 10, 2));
    });
    afterEach(() => vi.useRealTimers());

    it("defaults to 20 min lead and 5 min rounding from the current time", () => {
      expect(nextAllowedSchedule().value).toBe("2026-03-05T10:25");
    });
  });
});

describe("minTimeForDate", () => {
  const now = local(2026, 3, 5, 10, 2);

  it("returns undefined for any date other than today", () => {
    expect(minTimeForDate("2026-03-06", META_MIN_SCHEDULE_MINUTES, now)).toBeUndefined();
    expect(minTimeForDate("2026-03-04", META_MIN_SCHEDULE_MINUTES, now)).toBeUndefined();
  });

  it("for today returns now + Meta minimum, rounded up to 5 minutes", () => {
    expect(minTimeForDate("2026-03-05", META_MIN_SCHEDULE_MINUTES, now)).toBe("10:15");
    expect(minTimeForDate("2026-03-05", 30, now)).toBe("10:35");
  });

  // Late at night the next allowed slot is already tomorrow; today must stay blocked
  // instead of returning tomorrow's time-of-day (which used to allow every time).
  it("near midnight blocks the rest of today", () => {
    const lateNow = local(2026, 3, 5, 23, 55);
    expect(minTimeForDate("2026-03-05", META_MIN_SCHEDULE_MINUTES, lateNow)).toBe("23:59");
  });
});

describe("minuteOfDay", () => {
  it("returns minutes since local midnight", () => {
    expect(minuteOfDay(local(2026, 3, 5, 0, 0))).toBe(0);
    expect(minuteOfDay(local(2026, 3, 5, 13, 45))).toBe(825);
    expect(minuteOfDay(local(2026, 3, 5, 23, 59, 59))).toBe(1439);
  });

  it("defaults to the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(local(2026, 3, 5, 8, 30));
    try {
      expect(minuteOfDay()).toBe(510);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("fetchMetaQueueSuggestion", () => {
  const jsonResponse = (body: unknown, ok = true) =>
    ({ ok, json: async () => body }) as unknown as Response;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(local(2026, 3, 5, 10, 0, 0));
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("rejects without a page id and does not call the API", async () => {
    await expect(fetchMetaQueueSuggestion("")).rejects.toThrow("Falta la página activa.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clamps the interval to 5..720 and falls back to 30", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const intervals: Array<[number, number]> = [[1, 5], [1000, 720], [0, 30], [Number.NaN, 30], [44.6, 45]];
    for (const [input, expected] of intervals) {
      await fetchMetaQueueSuggestion("page 1", input);
      const url = String(fetchMock.mock.lastCall?.[0]);
      expect(url).toBe(`/api/meta/scheduled?pageId=page%201&intervalMinutes=${expected}`);
    }
    expect(fetchMock.mock.lastCall?.[1]).toEqual({ cache: "no-store" });
  });

  it("uses Meta's suggested epoch and formats it in local time", async () => {
    const suggested = local(2026, 3, 5, 21, 30);
    fetchMock.mockResolvedValue(
      jsonResponse({ count: 3, lastScheduledPublishTime: 1772766000, suggestedNextPublishTime: suggested.getTime() / 1000 }),
    );
    await expect(fetchMetaQueueSuggestion("p")).resolves.toEqual({
      count: 3,
      lastScheduledPublishTime: 1772766000,
      suggestedNextPublishTime: suggested.getTime() / 1000,
      date: "2026-03-05",
      time: "21:30",
      value: "2026-03-05T21:30",
    });
  });

  it("with an empty queue falls back to now + Meta minimum (not rounded)", async () => {
    vi.setSystemTime(local(2026, 3, 5, 10, 3, 20));
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, lastScheduledPublishTime: 0, suggestedNextPublishTime: 0 }));
    const result = await fetchMetaQueueSuggestion("p");
    expect(result).toMatchObject({ count: 0, lastScheduledPublishTime: null, date: "2026-03-05", time: "10:13" });
    expect(result.suggestedNextPublishTime).toBe(Math.floor(local(2026, 3, 5, 10, 13, 20).getTime() / 1000));
  });

  it("throws the API error message on a non-OK response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Token vencido" }, false));
    await expect(fetchMetaQueueSuggestion("p")).rejects.toThrow("Token vencido");
  });

  it("throws a generic message when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => { throw new SyntaxError("bad json"); } } as unknown as Response);
    await expect(fetchMetaQueueSuggestion("p")).rejects.toThrow("No fue posible consultar la cola de Meta.");
  });

  it("throws on an invalid suggested epoch", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ suggestedNextPublishTime: 1e20 }));
    await expect(fetchMetaQueueSuggestion("p")).rejects.toThrow("Meta devolvió un horario inválido.");
  });
});
