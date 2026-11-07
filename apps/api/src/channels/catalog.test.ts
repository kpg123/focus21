import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isUsableChannelName, normalizeExternalId } from "./catalog.js";

describe("channel catalog helpers", () => {
  it("rejects unknown / category metadata names", () => {
    assert.equal(isUsableChannelName("Unknown channel"), false);
    assert.equal(isUsableChannelName("Comedy • 2012"), false);
    assert.equal(isUsableChannelName("unknown"), false);
    assert.equal(isUsableChannelName("Poofesure"), true);
  });

  it("strips @ from handles", () => {
    assert.equal(normalizeExternalId("@Poofesure"), "Poofesure");
  });
});
