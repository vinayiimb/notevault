import {
  Atom, Bank, BookOpen, Brain, Buildings, ChartLine, ChatCircleText, Clock, Coins, Compass, Crown, Drop, Eye, Factory, Fire, Flag,
  Flask, Gavel, Gear, Globe, GraduationCap, Handshake, Heart, House, Key, Leaf, Lightbulb, Lock, MapPin, Megaphone, Money,
  Mountains, Newspaper, Path, PuzzlePiece, Scales, Scroll, SealCheck, ShieldCheck, Star, Sun, Sword, Target, Tree, Truck, User,
  UsersThree,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

// A ```cards block: one card per line, "icon | Title | tag | one short sentence". Optional last line without "|" is the
// summary under the cards. `icon` is a name from this list (the Paper OCR Studio prompt lists the same names) or an emoji.
const ICONS: Record<string, Icon> = {
  "map-pin": MapPin, users: UsersThree, bank: Bank, house: House, scales: Scales, book: BookOpen, flag: Flag, lightbulb: Lightbulb,
  star: Star, globe: Globe, target: Target, compass: Compass, gavel: Gavel, handshake: Handshake, coins: Coins, "chart-line": ChartLine,
  leaf: Leaf, atom: Atom, brain: Brain, heart: Heart, shield: ShieldCheck, crown: Crown, scroll: Scroll, buildings: Buildings,
  mountains: Mountains, sun: Sun, fire: Fire, sword: Sword, "graduation-cap": GraduationCap, flask: Flask, gear: Gear, lock: Lock, key: Key,
  eye: Eye, megaphone: Megaphone, newspaper: Newspaper, person: User, chat: ChatCircleText, clock: Clock, puzzle: PuzzlePiece, tree: Tree,
  drop: Drop, truck: Truck, factory: Factory, money: Money, path: Path, seal: SealCheck,
};

type Tile = { icon: string; title: string; tag: string; text: string };

export function parseCards(source: string): { tiles: Tile[]; note: string } {
  const tiles: Tile[] = [];
  const notes: string[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length >= 3) {
      // "icon | Title | tag | text" — the tag is optional ("icon | Title | text")
      const [icon, title, ...rest] = cells;
      const text = rest.pop() ?? "";
      tiles.push({ icon, title, tag: rest.join(" · "), text });
    } else notes.push(line);
  }
  return { tiles: tiles.slice(0, 6), note: notes.join(" ") };
}

function TileIcon({ name }: { name: string }) {
  const key = name.toLowerCase().replace(/\s+/g, "-");
  const Cmp = ICONS[key];
  if (Cmp) return <Cmp size={22} weight="duotone" aria-hidden />;
  return <span aria-hidden className="nt-tile-emoji">{name || "•"}</span>; // an emoji (or anything else) is shown as written
}

export function InfoCards({ source }: { source: string }) {
  const { tiles, note } = parseCards(source);
  if (!tiles.length) return null;
  return (
    <section className="nt-cards" data-count={tiles.length}>
      <div className="nt-cards-grid">
        {tiles.map((t, i) => (
          <article key={i} className="nt-tile" tabIndex={0}>
            <span className="nt-tile-icon"><TileIcon name={t.icon} /></span>
            <strong className="nt-tile-title">{t.title}</strong>
            {t.tag && <span className="nt-tile-tag">{t.tag}</span>}
            {t.text && <p className="nt-tile-text">{t.text}</p>}
          </article>
        ))}
      </div>
      {note && <p className="nt-cards-note">{note}</p>}
    </section>
  );
}
