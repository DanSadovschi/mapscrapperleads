const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Patterns that look like emails but aren't real contact emails
const JUNK_PATTERNS = [
  /@example\./,
  /@w3\./,
  /@schema\./,
  /noreply/,
  /no-reply/,
  /donotreply/,
  /@sentry\./,
  /\.(png|jpg|gif|svg|webp|css|js)$/i,
  /@wordpress\./,
  /@jquery\./,
];

const FETCH_TIMEOUT_MS = 8_000;
const CONTACT_PATHS = ['/contact', '/contact-us', '/about', '/about-us', '/get-in-touch'];

export async function extractEmailFromWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl) return '';

  let origin = '';
  try {
    origin = new URL(websiteUrl).origin;
  } catch {
    return '';
  }

  const urlsToTry = [websiteUrl, ...CONTACT_PATHS.map((p) => origin + p)];

  for (const url of urlsToTry) {
    const email = await fetchAndFindEmail(url);
    if (email) return email;
  }

  return '';
}

async function fetchAndFindEmail(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadBot/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!res.ok) return '';

    const html = await res.text().catch(() => '');

    // Also check for mailto: links (most reliable)
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    if (mailtoMatch) {
      const email = mailtoMatch[1];
      if (!JUNK_PATTERNS.some((re) => re.test(email))) return email;
    }

    // Fallback: scan all text
    const matches = html.match(EMAIL_RE) ?? [];
    for (const email of matches) {
      if (!JUNK_PATTERNS.some((re) => re.test(email))) return email;
    }

    return '';
  } catch {
    clearTimeout(timer);
    return '';
  }
}
