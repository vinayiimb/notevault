import { getSiteSettings } from "@/lib/data";
import {
  uploadHeroImageAction,
  removeHeroImageAction,
  uploadCurrencyIconAction,
  removeCurrencyIconAction,
  updateSiteSettingsAction,
} from "@/lib/actions";
import { ImageDropzone } from "@/components/admin/image-dropzone";

export default async function AdminSettingsPage() {
  const siteSettings = await getSiteSettings();
  const heroImage = siteSettings.heroImageUrl;
  const currencyIcon = siteSettings.currencyIconUrl;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Site settings</h1>
      <p className="mt-1 text-sm text-muted">
        Manage text and images used on the public site — no code changes needed, and nothing
        here can break a page (blank fields just fall back to the defaults).
      </p>

      <section className="mt-8 max-w-2xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-medium">Homepage headline &amp; subtitle</h2>
        <p className="mt-1 text-sm text-muted">
          The big heading and the pill of text under it, on the homepage hero.
        </p>
        <form action={updateSiteSettingsAction} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">
              Headline (use a line break for the two-line look)
            </label>
            <textarea
              name="heroHeadline"
              defaultValue={siteSettings.heroHeadline}
              rows={2}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Subtitle</label>
            <input
              name="heroSubtitle"
              defaultValue={siteSettings.heroSubtitle}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Save
          </button>
        </form>
      </section>

      <section className="mt-6 max-w-2xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-medium">Homepage hero illustration</h2>
        <p className="mt-1 text-sm text-muted">
          Shown at the bottom of the homepage&apos;s hero section, over the sky-blue gradient.
        </p>

        {heroImage ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-[linear-gradient(180deg,#54d1ff,#42c3f3_55%,#62d8ff)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt="Current hero illustration" className="block h-auto w-full" />
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted">
            No hero illustration uploaded yet — the homepage shows a placeholder instead.
          </p>
        )}

        <form action={uploadHeroImageAction} className="mt-4 flex flex-col gap-4">
          <ImageDropzone name="file" required />
          <button
            type="submit"
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            {heroImage ? "Replace image" : "Upload image"}
          </button>
        </form>

        {heroImage && (
          <form action={removeHeroImageAction} className="mt-2">
            <button type="submit" className="text-sm text-muted hover:text-red-500">
              Remove image (show placeholder instead)
            </button>
          </form>
        )}
      </section>

      <section className="mt-6 max-w-2xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-medium">Oranges currency icon</h2>
        <p className="mt-1 text-sm text-muted">
          Replaces the 🍊 emoji everywhere the gamification currency shows up (dashboard,
          leaderboard). Upload a square image for best results.
        </p>

        {currencyIcon ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-background p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currencyIcon} alt="Current currency icon" className="size-16 object-contain" />
            <p className="text-sm text-muted">This is currently shown instead of 🍊.</p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted">
            No custom icon uploaded yet — the 🍊 emoji is used by default.
          </p>
        )}

        <form action={uploadCurrencyIconAction} className="mt-4 flex flex-col gap-4">
          <ImageDropzone name="file" required />
          <button
            type="submit"
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            {currencyIcon ? "Replace icon" : "Upload icon"}
          </button>
        </form>

        {currencyIcon && (
          <form action={removeCurrencyIconAction} className="mt-2">
            <button type="submit" className="text-sm text-muted hover:text-red-500">
              Remove icon (use 🍊 instead)
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
