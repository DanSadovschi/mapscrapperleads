import type { PlaceDetails, PlaceSearchResult } from '../types.js';

const BASE = 'https://maps.googleapis.com/maps/api/place';

function key(): string {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) throw new Error('GOOGLE_PLACES_API_KEY not set');
  return k;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Text Search — returns up to 20 businesses matching `query` near `location`.
 * Only fetches one page to keep API costs low.
 */
export async function searchBusinesses(
  query: string,
  location: string
): Promise<PlaceSearchResult[]> {
  const params = new URLSearchParams({
    query: `${query} ${location}`,
    key: key(),
    language: 'en',
    region: 'gb',
  });

  const res = await fetch(`${BASE}/textsearch/json?${params}`);
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results: Array<{ place_id: string; name: string; formatted_address: string }>;
  };

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${data.status} — ${data.error_message ?? ''}`);
  }

  return (data.results ?? []).map((r) => ({
    place_id: r.place_id,
    name: r.name,
    formatted_address: r.formatted_address,
  }));
}

/**
 * Place Details — fetches phone number and website for a given place_id.
 * Costs one API request per call; use sparingly.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  // Small delay to avoid hitting rate limits when called in a loop
  await sleep(200);

  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'name,formatted_address,formatted_phone_number,website',
    key: key(),
    language: 'en',
  });

  const res = await fetch(`${BASE}/details/json?${params}`);
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    result: {
      name: string;
      formatted_address: string;
      formatted_phone_number?: string;
      website?: string;
    };
  };

  if (data.status !== 'OK') {
    throw new Error(`Place Details error: ${data.status} — ${data.error_message ?? ''}`);
  }

  return {
    place_id: placeId,
    name: data.result.name,
    formatted_address: data.result.formatted_address,
    formatted_phone_number: data.result.formatted_phone_number,
    website: data.result.website,
  };
}
