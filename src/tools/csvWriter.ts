import { appendFileSync, writeFileSync } from 'fs';
import type { Lead } from '../types.js';

export const CSV_PATH = 'leads.csv';
const HEADERS = ['Business Name', 'Phone', 'Email', 'Website', 'Address', 'Category', 'Reason'];

let leadCount = 0;

export function initCSV(): void {
  writeFileSync(CSV_PATH, HEADERS.map(escape).join(',') + '\n', 'utf-8');
  leadCount = 0;
  console.log(`📄 CSV ready → ${CSV_PATH}`);
}

export function saveLead(lead: Lead): void {
  const row = [
    lead.businessName,
    lead.phone,
    lead.email,
    lead.website,
    lead.address,
    lead.category,
    lead.reason,
  ]
    .map(escape)
    .join(',');

  appendFileSync(CSV_PATH, row + '\n', 'utf-8');
  leadCount++;
  console.log(`  ✅ Lead #${leadCount}: ${lead.businessName} — ${lead.reason}`);
}

export function getLeadCount(): number {
  return leadCount;
}

function escape(value: string | undefined): string {
  const v = (value ?? '').replace(/"/g, '""');
  return `"${v}"`;
}
