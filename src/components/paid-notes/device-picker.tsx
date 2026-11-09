import { DeviceMobile, Laptop } from "@phosphor-icons/react";
import type { DeviceInfo } from "@/lib/student-devices";
import { shortDate, timeAgo } from "@/lib/time-ago";

// Shown when a sign-in is refused because both device slots are taken: the
// student picks which device to sign out so this one can take its place.
// In the password form the buttons submit the form (name="replace"); for
// Google they call onPick with the id.
export function DevicePicker({
  devices,
  error,
  onPick,
  disabled,
}: {
  devices: DeviceInfo[];
  error?: string;
  onPick?: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-5 rounded-[22px] bg-surface-muted p-3.5 sm:p-5" role="alert">
      <p className="text-[15px] font-semibold leading-snug">{error ?? "You're already signed in on 2 devices."}</p>
      <p className="mt-1 text-sm text-muted">Choose one to sign out — this device takes its place.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {devices.map((d) => {
          const Icon = /iPhone|Android|iPad/.test(d.label) ? DeviceMobile : Laptop;
          return (
            <li key={d.id} className="flex items-center gap-2.5 rounded-2xl bg-surface p-2.5 shadow-[var(--shadow-tile)]">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-brand/10 text-brand">
                <Icon size={18} weight="fill" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug">{d.label}</span>
                <span className="block text-xs text-muted">Signed in {shortDate(d.since)} · used {timeAgo(d.lastSeen)}</span>
              </span>
              <button
                type={onPick ? "button" : "submit"}
                name={onPick ? undefined : "replace"}
                value={onPick ? undefined : d.id}
                onClick={onPick ? () => onPick(d.id) : undefined}
                disabled={disabled}
                className="min-h-10 shrink-0 rounded-full bg-foreground/[0.07] px-3.5 text-[13px] font-semibold text-foreground transition hover:bg-foreground/[0.12] disabled:opacity-60"
              >
                Sign out
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-snug text-muted">
        Tip: if you opened this link from WhatsApp, open it in Chrome or Safari instead — the in-app browser counts as a separate device.
      </p>
    </div>
  );
}
