// ─── Lead ──────────────────────────────────────────────────────────────────

export interface Lead {
  businessName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  category: string;
  reason: string; // "No website" | "Broken website" | "Poor quality website"
}

// ─── Google Places ──────────────────────────────────────────────────────────

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
}

// ─── Website Assessment ─────────────────────────────────────────────────────

export type WebsiteQuality = 'none' | 'broken' | 'poor' | 'ok';

export interface WebsiteAssessment {
  accessible: boolean;
  hasSSL: boolean;
  hasMobileViewport: boolean;
  isSocialMedia: boolean;
  isDirectoryListing: boolean; // yell.com, checkatrade etc - not their own site
  quality: WebsiteQuality;
  notes: string;
}
