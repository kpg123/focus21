import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchesTargeting, type ViewerStats } from "./matching.js";

const baseViewer: ViewerStats = {
  age: 28,
  gender: "female",
  country: "US",
  dailyWatchMinutes: 90,
  platformMinutes: { youtube: 60, twitch: 30 },
  watchedChannelIds: ["chan-1"],
};

describe("matchesTargeting", () => {
  it("matches empty targeting", () => {
    assert.equal(matchesTargeting(baseViewer, {}), true);
  });

  it("requires daily watch minutes", () => {
    assert.equal(
      matchesTargeting(baseViewer, { minDailyWatchMinutes: 60 }),
      true,
    );
    assert.equal(
      matchesTargeting(baseViewer, { minDailyWatchMinutes: 120 }),
      false,
    );
  });

  it("filters by gender and age", () => {
    assert.equal(
      matchesTargeting(baseViewer, { genders: ["female"], minAge: 21, maxAge: 35 }),
      true,
    );
    assert.equal(
      matchesTargeting(baseViewer, { genders: ["male"] }),
      false,
    );
  });

  it("filters by watched channels", () => {
    assert.equal(
      matchesTargeting(baseViewer, { channelIds: ["chan-1"] }),
      true,
    );
    assert.equal(
      matchesTargeting(baseViewer, { channelIds: ["chan-2"] }),
      false,
    );
  });
});
