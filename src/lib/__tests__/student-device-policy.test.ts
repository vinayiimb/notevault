import { test } from "node:test";
import assert from "node:assert/strict";
import { decideDevice, deviceLabel, MAX_SWAPS_PER_30_DAYS, type LiveDevice } from "@/lib/student-device-policy";

const d = (id: string): LiveDevice => ({ id, label: id, lastSeenAt: new Date() });

test("a first and second device are allowed", () => {
  assert.deepEqual(decideDevice({ live: [], swapsLast30Days: 0 }), { kind: "create" });
  assert.deepEqual(decideDevice({ live: [d("a")], swapsLast30Days: 0 }), { kind: "create" });
});

test("a third device is refused until one is replaced", () => {
  const live = [d("a"), d("b")];
  assert.deepEqual(decideDevice({ live, swapsLast30Days: 0 }), { kind: "full" });
  assert.deepEqual(decideDevice({ live, swapsLast30Days: 0, replaceId: "zzz" }), { kind: "full" }); // not theirs
  assert.deepEqual(decideDevice({ live, swapsLast30Days: 0, replaceId: "b" }), { kind: "create", revokeId: "b" });
});

test("the same browser signing in again reuses its slot, even when both are taken", () => {
  assert.deepEqual(decideDevice({ live: [d("a"), d("b")], swapsLast30Days: 99, cookieDeviceId: "a" }), { kind: "reuse", id: "a" });
});

test("a cookie for a revoked or unknown device does not count as a known browser", () => {
  assert.deepEqual(decideDevice({ live: [d("a"), d("b")], swapsLast30Days: 0, cookieDeviceId: "gone" }), { kind: "full" });
});

test("replacing is capped per month", () => {
  const live = [d("a"), d("b")];
  assert.deepEqual(
    decideDevice({ live, swapsLast30Days: MAX_SWAPS_PER_30_DAYS, replaceId: "a" }),
    { kind: "swap-limit" },
  );
});

test("device labels", () => {
  assert.equal(
    deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
    "Safari on iPhone",
  );
  assert.equal(
    deviceLabel("Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"),
    "Chrome on Android",
  );
  assert.equal(
    deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0"),
    "Edge on Windows",
  );
  assert.equal(
    deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
    "Chrome on Mac",
  );
  assert.equal(deviceLabel(null), "Browser");
});
