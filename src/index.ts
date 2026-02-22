import 'dotenv/config';
import { runAgent } from './agent.js';
import { initCSV, getLeadCount, CSV_PATH } from './tools/csvWriter.js';

function validateEnv(): void {
  const missing: string[] = [];
  if (!process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!process.env.GOOGLE_PLACES_API_KEY) missing.push('GOOGLE_PLACES_API_KEY');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error('\nCopy .env.example to .env and fill in your keys.');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  validateEnv();
  initCSV();

  const startedAt = Date.now();

  try {
    await runAgent();
  } catch (err) {
    console.error('\n❌ Agent crashed:', err);
    process.exit(1);
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const count = getLeadCount();

  console.log('\n' + '─'.repeat(50));
  console.log(`📊 Summary`);
  console.log(`   Leads found : ${count}`);
  console.log(`   Time        : ${elapsed}s`);
  console.log(`   Output file : ${CSV_PATH}`);
  console.log('─'.repeat(50));

  if (count === 0) {
    console.log('\n⚠️  No leads found. Check that your GOOGLE_PLACES_API_KEY is valid and has the Places API enabled.');
  } else {
    console.log(`\n✅ Open ${CSV_PATH} in Excel or Google Sheets to review your leads.`);
  }
}

main();
