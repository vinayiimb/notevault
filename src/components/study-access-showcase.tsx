import Link from "next/link";

const ECONOMICS_NOTES_URL =
  "https://drive.google.com/drive/folders/1GJ67aNwwfq3Mf_xBXm3POXkxduW5CDPi?usp=sharing";

export function StudyAccessShowcase() {
  return (
    <section aria-label="Study notes and archive" className="study-access-showcase">
      <div className="study-access-sky">
        <div className="study-access-cards">
          <article className="study-access-card study-access-card--glass">
            <h2 className="study-access-card__title">
              <span aria-hidden="true">📖</span> Full Archive
            </h2>
            <div className="study-access-card__divider" />
            <p className="study-access-card__copy">
              Browse the complete notes archive by subject, chapter or topic.
            </p>
            <Link href="/pyq-notes" className="study-access-card__small-button">
              Explore Archive →
            </Link>
          </article>

          <article className="study-access-card study-access-card--glass">
            <h2 className="study-access-card__title">
              <span aria-hidden="true">🎀</span> Free Subject Notes
            </h2>
            <div className="study-access-card__divider" />
            <p className="study-access-card__copy">
              Get the complete BA Economics (Hons) notes collection, absolutely free.
            </p>
            <a
              href={ECONOMICS_NOTES_URL}
              target="_blank"
              rel="noreferrer"
              className="study-access-card__small-button"
            >
              View Free Notes →
            </a>
          </article>

          <article className="study-access-card study-access-card--featured">
            <h2 className="study-access-card__featured-title">Paid Notes</h2>
            <p className="study-access-card__featured-copy">
              Complete notes for every subject, organised and ready to study.
            </p>
            <div className="study-access-card__actions">
              <Link href="/pyq-notes" className="study-access-card__outline-button">
                Preview Notes
              </Link>
              <Link href="/paid-notes" className="study-access-card__primary-button">
                Get Full Access
              </Link>
            </div>
          </article>
        </div>
      </div>

    </section>
  );
}
