// Shared citation service: CrossRef (primary) + OpenAlex (fallback). Both keyless.
// Optional env: CITATION_MAILTO (enables CrossRef/OpenAlex polite pool).

export type RefSource = 'crossref' | 'openalex';
export interface Author { family: string; given: string }
export interface VerifiedRef {
  source: RefSource;
  doi: string;
  url: string;
  title: string;
  authors: Author[];
  year: number;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
}

const MAILTO = process.env.CITATION_MAILTO || '';
const TIMEOUT_MS = 8000;
const WINDOW_YEARS = 10;

export function windowStartYear(now: Date = new Date()): number {
  return now.getFullYear() - WINDOW_YEARS;
}

async function getJson(url: string): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': MAILTO ? `VertexResearchSuites/1.0 (mailto:${MAILTO})` : 'VertexResearchSuites/1.0',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const clean = (s: any): string => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

interface SearchOpts { fromYear?: number; journalOnly: boolean }

async function searchCrossref(query: string, rows: number, o: SearchOpts): Promise<VerifiedRef[]> {
  const filters: string[] = [];
  if (o.journalOnly) filters.push('type:journal-article');
  if (o.fromYear) filters.push(`from-pub-date:${o.fromYear}-01-01`);
  const p = new URLSearchParams({
    'query.bibliographic': query,
    rows: String(rows),
    select: 'DOI,title,author,issued,container-title,volume,issue,page',
  });
  if (filters.length) p.set('filter', filters.join(','));
  if (MAILTO) p.set('mailto', MAILTO);
  const j = await getJson(`https://api.crossref.org/works?${p.toString()}`);
  const items = j?.message?.items;
  if (!Array.isArray(items)) return [];
  const out: VerifiedRef[] = [];
  for (const it of items) {
    const title = clean(it.title?.[0]);
    const doi = clean(it.DOI).toLowerCase();
    const year = Number(it.issued?.['date-parts']?.[0]?.[0]);
    const authors: Author[] = (it.author || [])
      .filter((a: any) => a?.family)
      .map((a: any) => ({ family: clean(a.family), given: clean(a.given) }));
    if (!title || !doi || !year || !authors.length) continue;
    out.push({
      source: 'crossref', doi, url: `https://doi.org/${doi}`, title, authors, year,
      journal: clean(it['container-title']?.[0]),
      volume: clean(it.volume), issue: clean(it.issue), pages: clean(it.page),
    });
  }
  return out;
}

function splitName(full: string): Author {
  const parts = full.split(' ').filter(Boolean);
  if (parts.length < 2) return { family: full, given: '' };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(' ') };
}

async function searchOpenAlex(query: string, rows: number, o: SearchOpts): Promise<VerifiedRef[]> {
  const filters: string[] = ['has_doi:true'];
  if (o.journalOnly) filters.push('type:article');
  if (o.fromYear) filters.push(`from_publication_date:${o.fromYear}-01-01`);
  const p = new URLSearchParams({
    search: query,
    filter: filters.join(','),
    'per-page': String(rows),
    select: 'doi,title,publication_year,authorships,primary_location,biblio',
  });
  if (MAILTO) p.set('mailto', MAILTO);
  const j = await getJson(`https://api.openalex.org/works?${p.toString()}`);
  const items = j?.results;
  if (!Array.isArray(items)) return [];
  const out: VerifiedRef[] = [];
  for (const it of items) {
    const doi = clean(it.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase();
    const title = clean(it.title);
    const year = Number(it.publication_year);
    const authors: Author[] = (it.authorships || [])
      .map((a: any) => clean(a?.author?.display_name))
      .filter(Boolean)
      .map(splitName);
    if (!title || !doi || !year || !authors.length) continue;
    const b = it.biblio || {};
    const fp = clean(b.first_page), lp = clean(b.last_page);
    out.push({
      source: 'openalex', doi, url: `https://doi.org/${doi}`, title, authors, year,
      journal: clean(it.primary_location?.source?.display_name),
      volume: clean(b.volume), issue: clean(b.issue),
      pages: fp && lp && fp !== lp ? `${fp}-${lp}` : fp,
    });
  }
  return out;
}

// CrossRef first; OpenAlex only if CrossRef gives too few.
async function find(query: string, need: number, o: SearchOpts): Promise<VerifiedRef[]> {
  const rows = Math.min(25, need * 3);
  let r = await searchCrossref(query, rows, o);
  if (r.length < need) r = r.concat(await searchOpenAlex(query, rows, o));
  return r;
}

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'for', 'to', 'with', 'by', 'from', 'among', 'at']);
const tokens = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).map((w) => w.replace(/s$/, ''));

function similarity(a: string, b: string): number {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((w) => { if (B.has(w)) n++; });
  return n / (A.size + B.size - n);
}

function relevant(topic: string, title: string): boolean {
  const T = new Set(tokens(topic).filter((w) => w.length > 3));
  if (!T.size) return true;
  const need = Math.max(1, Math.ceil(T.size * 0.4));
  let n = 0;
  new Set(tokens(title)).forEach((w) => { if (T.has(w)) n++; });
  return n >= need;
}

export interface SearchResult { refs: VerifiedRef[]; fromYear: number; shortfall: number }

// Real, DOI-backed journal articles from the last 10 years: general + Nigeria + Africa.
export async function searchVerifiedRefs(topic: string, count = 6, now: Date = new Date()): Promise<SearchResult> {
  const fromYear = windowStartYear(now);
  const o: SearchOpts = { fromYear, journalOnly: true };
  const half = Math.ceil(count / 2);
  const [general, ng, af] = await Promise.all([
    find(topic, half, o),
    find(`${topic} Nigeria`, half, o),
    find(`${topic} Africa`, half, o),
  ]);
  const seen = new Set<string>();
  const refs: VerifiedRef[] = [];
  const take = (list: VerifiedRef[], limit: number) => {
    let n = 0;
    for (const r of list) {
      if (refs.length >= count || n >= limit) break;
      if (seen.has(r.doi) || !relevant(topic, r.title)) continue;
      seen.add(r.doi);
      refs.push(r);
      n++;
    }
  };
  take(general, half);
  take(ng, count - half);
  take(af, count);
  take(general, count);
  return { refs, fromYear, shortfall: Math.max(0, count - refs.length) };
}

export type VerifyResult =
  | { status: 'verified'; ref: VerifiedRef; withinWindow: boolean }
  | { status: 'unverified' };

// Check that a citation an AI wrote really exists. CrossRef first, OpenAlex only if no match.
export async function verifyCitation(
  c: { title: string; year?: number; firstAuthorFamily?: string },
  now: Date = new Date()
): Promise<VerifyResult> {
  const q = [c.title, c.firstAuthorFamily].filter(Boolean).join(' ');
  const o: SearchOpts = { journalOnly: false };
  const pick = (cands: VerifiedRef[]): VerifiedRef | null => {
    let best: VerifiedRef | null = null;
    let bestScore = 0;
    for (const r of cands) {
      if (c.year && Math.abs(r.year - c.year) > 1) continue;
      if (c.firstAuthorFamily && !r.authors.some((a) => a.family.toLowerCase() === c.firstAuthorFamily!.toLowerCase())) continue;
      const s = similarity(c.title, r.title);
      if (s > bestScore) { best = r; bestScore = s; }
    }
    return best && bestScore >= 0.6 ? best : null;
  };
  const hit = pick(await searchCrossref(q, 15, o)) || pick(await searchOpenAlex(q, 15, o));
  if (!hit) return { status: 'unverified' };
  return { status: 'verified', ref: hit, withinWindow: hit.year >= windowStartYear(now) };
}

// ---------- Formatting (italics marked with *...*; the docx/UI layer converts markers) ----------
const endDot = (t: string) => (/[.?!]$/.test(t) ? t : `${t}.`);
const en = (p: string) => p.replace(/-/g, '–');
const J = (...p: (string | false | undefined | null)[]) => p.filter(Boolean).join(' ');
function initials(given: string, dots = true, space = true): string {
  const ini = given.split(/[\s.\-]+/).filter(Boolean).map((w) => w[0].toUpperCase());
  return dots ? ini.map((i) => `${i}.`).join(space ? ' ' : '') : ini.join('');
}
const nameLF = (a: Author) => (a.given ? `${a.family}, ${a.given}` : a.family);
const nameFL = (a: Author) => (a.given ? `${a.given} ${a.family}` : a.family);

export function formatReference(r: VerifiedRef, style: string): string {
  const A = r.authors, y = r.year, t = r.title.replace(/\.$/, '');
  const jn = r.journal, v = r.volume, i = r.issue, pg = r.pages, doi = r.doi, url = r.url;
  const vi = `${v}${i ? `(${i})` : ''}`;
  switch (style) {
    case 'APA7': {
      const n = A.map((a) => (a.given ? `${a.family}, ${initials(a.given)}` : a.family));
      const au = n.length === 1 ? n[0]
        : n.length <= 20 ? `${n.slice(0, -1).join(', ')}, & ${n[n.length - 1]}`
        : `${n.slice(0, 19).join(', ')}, . . . ${n[n.length - 1]}`;
      return J(endDot(au), `(${y}).`, endDot(t),
        jn && `*${jn}*${v ? `, *${v}*${i ? `(${i})` : ''}` : ''}${pg ? `, ${en(pg)}` : ''}.`, url);
    }
    case 'APA6': {
      const n = A.map((a) => (a.given ? `${a.family}, ${initials(a.given)}` : a.family));
      const au = n.length === 1 ? n[0]
        : n.length <= 7 ? `${n.slice(0, -1).join(', ')}, & ${n[n.length - 1]}`
        : `${n.slice(0, 6).join(', ')}, . . . ${n[n.length - 1]}`;
      return J(endDot(au), `(${y}).`, endDot(t),
        jn && `*${jn}${v ? `, ${v}` : ''}*${i ? `(${i})` : ''}${pg ? `, ${en(pg)}` : ''}.`, `doi:${doi}`);
    }
    case 'MLA9': {
      const au = A.length === 1 ? nameLF(A[0])
        : A.length === 2 ? `${nameLF(A[0])}, and ${nameFL(A[1])}`
        : `${nameLF(A[0])}, et al`;
      const src = [jn && `*${jn}*`, v && `vol. ${v}`, i && `no. ${i}`, String(y), pg && `pp. ${pg}`].filter(Boolean).join(', ');
      return J(endDot(au), `"${endDot(t)}"`, `${src}.`, url);
    }
    case 'Chicago17':
    case 'Turabian9': {
      const list = A.length > 10 ? A.slice(0, 7) : A;
      const names = list.map((a, k) => (k === 0 ? nameLF(a) : nameFL(a)));
      const au = A.length > 10 ? `${names.join(', ')}, et al`
        : names.length === 1 ? names[0]
        : names.length === 2 ? `${names[0]}, and ${names[1]}`
        : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
      if (style === 'Chicago17') {
        return J(endDot(au), `${y}.`, `"${endDot(t)}"`,
          jn && `*${jn}* ${v}${i ? ` (${i})` : ''}${pg ? `: ${en(pg)}` : ''}.`, url);
      }
      return J(endDot(au), `"${endDot(t)}"`,
        jn && `*${jn}* ${v}${i ? `, no. ${i}` : ''} (${y})${pg ? `: ${en(pg)}` : ''}.`, url);
    }
    case 'Harvard': {
      const n = A.map((a) => (a.given ? `${a.family}, ${initials(a.given, true, false)}` : a.family));
      const au = n.length > 3 ? `${n[0]} et al.`
        : n.length === 1 ? n[0]
        : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
      const tail = [jn && `*${jn}*`, v && vi, pg && `pp. ${en(pg)}`].filter(Boolean).join(', ');
      return J(au, `(${y})`, `'${t}',`, `${tail}.`, `Available at: ${url}`);
    }
    case 'Vancouver': {
      const n = A.map((a) => (a.given ? `${a.family} ${initials(a.given, false)}` : a.family));
      const au = n.length > 6 ? `${n.slice(0, 6).join(', ')}, et al` : n.join(', ');
      return J(endDot(au), endDot(t), jn && `${jn}.`, `${y}${v ? `;${vi}` : ''}${pg ? `:${pg}` : ''}.`, `doi:${doi}`);
    }
    case 'IEEE': {
      const n = A.map((a) => (a.given ? `${initials(a.given)} ${a.family}` : a.family));
      const au = n.length > 6 ? `${n[0]} et al.`
        : n.length === 1 ? n[0]
        : n.length === 2 ? `${n[0]} and ${n[1]}`
        : `${n.slice(0, -1).join(', ')}, and ${n[n.length - 1]}`;
      const tail = [jn && `*${jn}*`, v && `vol. ${v}`, i && `no. ${i}`, pg && `pp. ${en(pg)}`, String(y), `doi: ${doi}`]
        .filter(Boolean).join(', ');
      return J(`${au},`, `"${t},"`, `${tail}.`);
    }
    case 'OSCOLA': {
      const n = A.map(nameFL);
      const au = n.length >= 4 ? `${n[0]} and others`
        : n.length === 1 ? n[0]
        : n.length === 2 ? `${n[0]} and ${n[1]}`
        : `${n[0]}, ${n[1]} and ${n[2]}`;
      const first = pg.split(/[-–]/)[0];
      return J(`${au},`, `'${t}'`, `(${y})`, v && vi, jn, first);
    }
    case 'AMA': {
      const n = A.map((a) => (a.given ? `${a.family} ${initials(a.given, false)}` : a.family));
      const au = n.length > 6 ? `${n.slice(0, 3).join(', ')}, et al` : n.join(', ');
      return J(endDot(au), endDot(t), jn && `*${jn}*.`, `${y}${v ? `;${vi}` : ''}${pg ? `:${pg}` : ''}.`, `doi:${doi}`);
    }
    default:
      return formatReference(r, 'APA7');
  }
}
