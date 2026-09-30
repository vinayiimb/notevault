export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { FEATURES, FEATURE_STATUSES, resolveFlags } from "@/lib/feature-flags";
import { saveFeatureFlagsAction } from "@/lib/feature-flag-actions";

const STATUS_LABEL = Object.fromEntries(FEATURE_STATUSES.map((s) => [s.value, s.label]));

export default async function AdminFeaturesPage() {
  let rows: { key: string; status: string }[] = [];
  let tableMissing = false;
  try {
    rows = await prisma.featureFlag.findMany({ select: { key: true, status: true } });
  } catch {
    tableMissing = true;
  }
  const flags = resolveFlags(rows);

  const groups = [
    { title: "Sidebar", items: FEATURES.filter((f) => f.menu === "sidebar") },
    { title: "“Others” menu", items: FEATURES.filter((f) => f.menu === "others") },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Features</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Flag tools that exist on the site but don&apos;t work yet. Changes reach the public menus
        within about 30 seconds.
      </p>

      <dl className="mt-4 grid max-w-3xl gap-2 text-sm sm:grid-cols-3">
        {FEATURE_STATUSES.map((s) => (
          <div key={s.value} className="rounded-lg border border-border bg-surface px-3 py-2">
            <dt className="font-medium">{s.label}</dt>
            <dd className="mt-0.5 text-xs text-muted">{s.hint}</dd>
          </div>
        ))}
      </dl>

      {tableMissing && (
        <p className="mt-4 max-w-3xl rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          The FeatureFlag table doesn&apos;t exist in this database yet — run{" "}
          <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">npx prisma migrate deploy</code>. Until
          then the site uses the defaults shown below and saving will fail.
        </p>
      )}

      <form action={saveFeatureFlagsAction} className="mt-6 flex max-w-3xl flex-col gap-6">
        {groups.map((group) => (
          <section key={group.title} className="rounded-xl border border-border bg-surface">
            <h2 className="border-b border-border px-5 py-3 font-medium">{group.title}</h2>
            <ul className="divide-y divide-border">
              {group.items.map((feature) => {
                const current = flags[feature.key];
                const changed = current !== feature.defaultStatus;
                return (
                  <li key={feature.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {feature.label}
                        {changed && (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                            changed
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        <a href={feature.href} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
                          {feature.href}
                        </a>{" "}
                        · default: {STATUS_LABEL[feature.defaultStatus]}
                      </p>
                    </div>
                    <fieldset className="flex shrink-0 overflow-hidden rounded-lg border border-border text-xs font-medium">
                      <legend className="sr-only">Status of {feature.label}</legend>
                      {FEATURE_STATUSES.map((s) => (
                        <label
                          key={s.value}
                          className="cursor-pointer border-r border-border px-3 py-2 last:border-r-0 has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
                        >
                          <input
                            type="radio"
                            id={`status-${feature.key}-${s.value}`}
                            name={`status:${feature.key}`}
                            value={s.value}
                            defaultChecked={current === s.value}
                            className="sr-only"
                          />
                          {s.label}
                        </label>
                      ))}
                    </fieldset>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <button
          type="submit"
          className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          Save
        </button>
      </form>
    </div>
  );
}
