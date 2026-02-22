import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import { runBatchPostAgent } from "./agent.js";
import { getMyProfileUrn } from "./linkedin.js";
import type { Lead, LinkedInConfig } from "./types.js";

dotenv.config();

function printHelp(): void {
  console.log(`
Post AI Agent — LinkedIn post generator from map-scraped leads

Usage:
  npm run dev [options] [leads-file.json]
  npm run dev:dry [options] [leads-file.json]   # dry run (no publishing)

Options:
  --dry-run        Generate posts without publishing to LinkedIn
  --verbose        Show token usage and debug info
  --help           Show this help message

Environment variables (set in .env):
  ANTHROPIC_API_KEY        Required. Your Anthropic API key.
  LINKEDIN_ACCESS_TOKEN    Required for publishing. OAuth 2.0 Bearer token.
  LINKEDIN_AUTHOR_URN      Optional. e.g. urn:li:person:abc123
                           Auto-detected from token if not set.

Leads file format (JSON array):
  [
    {
      "businessName": "Acme Corp",
      "category": "Software",
      "address": "123 Main St, SF, CA",
      "phone": "+1 555-0100",
      "website": "https://acme.com",
      "rating": 4.7,
      "reviewCount": 150,
      "description": "Enterprise software solutions"
    }
  ]
`);
}

async function loadLeads(filePath: string): Promise<Lead[]> {
  const absPath = resolve(filePath);
  if (!existsSync(absPath)) {
    throw new Error(`Leads file not found: ${absPath}`);
  }
  const raw = readFileSync(absPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Leads file must contain a JSON array of leads");
  }

  return parsed as Lead[];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");

  // Validate required env vars
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required.");
    console.error("Set it in your .env file or export it in your shell.");
    process.exit(1);
  }

  const linkedInAccessToken = process.env.LINKEDIN_ACCESS_TOKEN;

  if (!dryRun && !linkedInAccessToken) {
    console.warn(
      "Warning: LINKEDIN_ACCESS_TOKEN not set. Switching to --dry-run mode.\n"
    );
  }

  const effectiveDryRun = dryRun || !linkedInAccessToken;

  // Resolve LinkedIn author URN
  let authorUrn = process.env.LINKEDIN_AUTHOR_URN ?? "";

  if (!effectiveDryRun && !authorUrn && linkedInAccessToken) {
    console.log("Fetching LinkedIn profile URN from API...");
    try {
      authorUrn = await getMyProfileUrn(linkedInAccessToken);
      console.log(`Detected author URN: ${authorUrn}\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to fetch LinkedIn profile: ${msg}`);
      process.exit(1);
    }
  }

  const linkedInConfig: LinkedInConfig = {
    accessToken: linkedInAccessToken ?? "",
    authorUrn,
  };

  // Load leads from file argument or use built-in examples
  const fileArg = args.find((a) => !a.startsWith("--"));
  let leads: Lead[];

  if (fileArg) {
    console.log(`Loading leads from: ${fileArg}`);
    leads = await loadLeads(fileArg);
  } else {
    console.log("No leads file provided. Using built-in example leads.\n");
    leads = [
      {
        businessName: "TechHub Coworking",
        category: "Coworking Space",
        address: "123 Innovation Ave, San Francisco, CA 94105",
        phone: "+1 (415) 555-0192",
        website: "https://techhub.example.com",
        rating: 4.8,
        reviewCount: 312,
        description:
          "Premium coworking space designed for tech startups, freelancers, and remote teams. Offers high-speed internet, private offices, and monthly networking events.",
      },
      {
        businessName: "GreenBite Organic Café",
        category: "Restaurant / Health Food",
        address: "45 Market Street, Austin, TX 78701",
        phone: "+1 (512) 555-0847",
        rating: 4.6,
        reviewCount: 198,
        description:
          "Farm-to-table organic café serving plant-based meals, cold-pressed juices, and specialty coffee. Locally sourced ingredients from Texas farms.",
      },
    ];
  }

  if (leads.length === 0) {
    console.error("No leads to process.");
    process.exit(1);
  }

  // Run the agent
  const results = await runBatchPostAgent(leads, linkedInConfig, {
    dryRun: effectiveDryRun,
    verbose,
  });

  // Summary
  console.log("\nSummary");
  console.log("=".repeat(60));
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`Total:     ${results.length}`);
  console.log(`Succeeded: ${succeeded}`);
  if (failed > 0) console.log(`Failed:    ${failed}`);

  for (const r of results) {
    const status = r.success ? "OK" : "FAIL";
    const extra = r.postId ? ` → ${r.postId}` : r.error ? ` → ${r.error}` : "";
    console.log(`  [${status}] ${r.lead}${extra}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
