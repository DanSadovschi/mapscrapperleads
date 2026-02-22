import type { WebsiteAssessment } from '../types.js';

// Domains that indicate the business has no real website of their own
const SOCIAL_MEDIA = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'youtube.com',
  'tiktok.com',
];

// Directories / aggregators — they HAVE a listing, but NOT their own site
const DIRECTORY_SITES = [
  'yell.com',
  'checkatrade.com',
  'trustatrader.com',
  'mybuilder.com',
  'ratedpeople.com',
  'bark.com',
  'thomsonlocal.com',
  'yelp.com',
  'justdial.com',
  'scoot.co.uk',
  'bing.com/maps',
  'google.com/maps',
];

// Free builders that often produce template-quality sites
const FREE_BUILDERS = [
  'wixsite.com',
  '.wix.com',
  'wordpress.com',
  'weebly.com',
  'squarespace.com',
  'sites.google.com',
  'godaddysites.com',
  'jimdo.com',
  'webnode.com',
];

const FETCH_TIMEOUT_MS = 10_000;

export async function checkWebsite(rawUrl: string): Promise<WebsiteAssessment> {
  if (!rawUrl || rawUrl.trim() === '') {
    return noWebsite();
  }

  let url = rawUrl.trim();
  if (!url.startsWith('http')) url = 'https://' + url;

  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return { accessible: false, hasSSL: false, hasMobileViewport: false, isSocialMedia: false, isDirectoryListing: false, quality: 'broken', notes: 'Invalid URL' };
  }

  // Social media page — not a real website
  if (SOCIAL_MEDIA.some((d) => hostname.includes(d))) {
    return { accessible: true, hasSSL: true, hasMobileViewport: true, isSocialMedia: true, isDirectoryListing: false, quality: 'poor', notes: 'Social media page only — no own website' };
  }

  // Directory listing — they have an external profile, not their own site
  if (DIRECTORY_SITES.some((d) => hostname.includes(d) || url.includes(d))) {
    return { accessible: true, hasSSL: true, hasMobileViewport: true, isSocialMedia: false, isDirectoryListing: true, quality: 'poor', notes: 'Directory listing only — no own website' };
  }

  const hasSSL = url.startsWith('https://');
  const isFreePlatform = FREE_BUILDERS.some((d) => hostname.includes(d));

  // Fetch the page
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html = '';
  let accessible = false;

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadBot/1.0; +https://example.com)' },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (res.ok) {
      accessible = true;
      html = await res.text().catch(() => '');
    }
  } catch {
    clearTimeout(timer);
  }

  if (!accessible) {
    return { accessible: false, hasSSL, hasMobileViewport: false, isSocialMedia: false, isDirectoryListing: false, quality: 'broken', notes: 'Site unreachable or timed out' };
  }

  const htmlLower = html.toLowerCase();
  const hasMobileViewport = htmlLower.includes('name="viewport"') || htmlLower.includes("name='viewport'");
  const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const isVeryThin = textContent.length < 400;

  // Determine quality
  const issues: string[] = [];
  if (!hasSSL) issues.push('No HTTPS');
  if (!hasMobileViewport) issues.push('Not mobile-friendly');
  if (isVeryThin) issues.push('Very little content');
  if (isFreePlatform) issues.push('Free website builder');

  let quality: WebsiteAssessment['quality'] = 'ok';
  if (issues.length > 0) {
    quality = 'poor';
  }

  return {
    accessible,
    hasSSL,
    hasMobileViewport,
    isSocialMedia: false,
    isDirectoryListing: false,
    quality,
    notes: issues.length > 0 ? issues.join('; ') : 'Looks acceptable',
  };
}

function noWebsite(): WebsiteAssessment {
  return { accessible: false, hasSSL: false, hasMobileViewport: false, isSocialMedia: false, isDirectoryListing: false, quality: 'none', notes: 'No website listed' };
}
