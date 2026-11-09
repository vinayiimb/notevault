// The 2-device rule for student logins, as pure functions (no DB, no cookies)
// so the policy is easy to test. src/lib/student-devices.ts applies it.

export const MAX_DEVICES = 2;
/** A device not seen for this long stops counting and its session lapses. */
export const DEVICE_IDLE_DAYS = 30;
/** Devices a student may swap out (sign out remotely / replace) per 30 days. */
export const MAX_SWAPS_PER_30_DAYS = 3;

export type LiveDevice = { id: string; label: string; lastSeenAt: Date };

export type DeviceDecision =
  | { kind: "reuse"; id: string } // this browser is already registered
  | { kind: "create"; revokeId?: string } // new device; revokeId = the one it replaces
  | { kind: "full" } // both slots taken and no replacement chosen
  | { kind: "swap-limit" }; // wants to replace, but swapped too often this month

export function decideDevice(input: {
  live: LiveDevice[];
  swapsLast30Days: number;
  cookieDeviceId?: string | null;
  replaceId?: string | null;
}): DeviceDecision {
  const { live, swapsLast30Days, cookieDeviceId, replaceId } = input;
  if (cookieDeviceId && live.some((d) => d.id === cookieDeviceId)) return { kind: "reuse", id: cookieDeviceId };
  if (live.length < MAX_DEVICES) return { kind: "create" };
  if (!replaceId || !live.some((d) => d.id === replaceId)) return { kind: "full" };
  if (swapsLast30Days >= MAX_SWAPS_PER_30_DAYS) return { kind: "swap-limit" };
  return { kind: "create", revokeId: replaceId };
}

/** "Chrome on iPhone" from a user-agent string — just enough to recognise your own devices. */
export function deviceLabel(userAgent: string | null | undefined): string {
  const u = userAgent ?? "";
  const os = /iPhone/.test(u)
    ? "iPhone"
    : /iPad/.test(u)
      ? "iPad"
      : /Android/.test(u)
        ? "Android"
        : /Windows/.test(u)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(u)
            ? "Mac"
            : /Linux|CrOS/.test(u)
              ? "Linux"
              : "";
  // Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari".
  const browser = /EdgA?\/|Edg\//.test(u)
    ? "Edge"
    : /SamsungBrowser/.test(u)
      ? "Samsung Internet"
      : /OPR\/|Opera/.test(u)
        ? "Opera"
        : /Firefox|FxiOS/.test(u)
          ? "Firefox"
          : /Chrome|CriOS/.test(u)
            ? "Chrome"
            : /Safari/.test(u)
              ? "Safari"
              : "Browser";
  return os ? `${browser} on ${os}` : browser;
}
