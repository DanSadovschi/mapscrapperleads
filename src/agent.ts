import Anthropic from '@anthropic-ai/sdk';
import { searchBusinesses, getPlaceDetails } from './tools/places.js';
import { checkWebsite } from './tools/websiteChecker.js';
import { extractEmailFromWebsite } from './tools/emailExtractor.js';
import { saveLead } from './tools/csvWriter.js';
import type { Lead } from './types.js';

const LOCATION = 'Kettering, Northamptonshire, UK';

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_businesses',
    description:
      'Search Google Maps for businesses of a specific trade/category in Kettering. Returns a list of businesses with their place IDs, names and addresses.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'The trade or service type to search for. Be specific, e.g. "electrician", "plumber", "tattoo studio", "carpet cleaning", "man with a van removal".',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_business_details',
    description:
      'Get the phone number and website URL for a specific business using its place_id. Call this for every business returned by search_businesses.',
    input_schema: {
      type: 'object' as const,
      properties: {
        place_id: { type: 'string', description: 'The Google place_id of the business.' },
        business_name: { type: 'string', description: 'Human-readable name (for logging only).' },
      },
      required: ['place_id', 'business_name'],
    },
  },
  {
    name: 'check_website_quality',
    description:
      'Check whether a website actually loads and assess its quality (SSL, mobile-friendly, content quality). Returns a quality rating: "none", "broken", "poor", or "ok".',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'The full website URL to check.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'extract_email',
    description:
      'Attempt to scrape a contact email address from the business website. Try this for any lead before saving.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'The website URL to extract an email from.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'save_lead',
    description:
      'Save a qualified lead to the CSV file. Only save businesses that have NO website, a BROKEN website, or a POOR QUALITY website.',
    input_schema: {
      type: 'object' as const,
      properties: {
        businessName: { type: 'string', description: 'Full business name.' },
        phone: { type: 'string', description: 'Phone number (empty string if not available).' },
        email: { type: 'string', description: 'Contact email (empty string if not found).' },
        website: { type: 'string', description: 'Website URL (empty string if none).' },
        address: { type: 'string', description: 'Full address.' },
        category: { type: 'string', description: 'Trade/service category, e.g. "Electrician".' },
        reason: {
          type: 'string',
          description:
            'Short reason why this is a lead. Examples: "No website", "Facebook page only", "No HTTPS; Not mobile-friendly", "Site unreachable".',
        },
      },
      required: ['businessName', 'phone', 'email', 'website', 'address', 'category', 'reason'],
    },
  },
];

// ─── Tool executor ───────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, string>): Promise<string> {
  try {
    switch (name) {
      case 'search_businesses': {
        const results = await searchBusinesses(input.query, LOCATION);
        return JSON.stringify(results);
      }

      case 'get_business_details': {
        const details = await getPlaceDetails(input.place_id);
        return JSON.stringify(details);
      }

      case 'check_website_quality': {
        const assessment = await checkWebsite(input.url);
        return JSON.stringify(assessment);
      }

      case 'extract_email': {
        const email = await extractEmailFromWebsite(input.url);
        return JSON.stringify({ email: email || '' });
      }

      case 'save_lead': {
        saveLead(input as unknown as Lead);
        return JSON.stringify({ saved: true });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ⚠️  Tool error (${name}): ${message}`);
    return JSON.stringify({ error: message });
  }
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an autonomous lead generation agent for a web development agency based in Northamptonshire, UK.

GOAL
Find small and medium-sized service/trade businesses in Kettering, Northamptonshire that:
  a) Have NO website at all, OR
  b) Have a POOR QUALITY website (not mobile-friendly, no HTTPS, broken, social media page only, directory listing only, free builder with minimal content)

These businesses are ideal clients for web development services.

TARGET CATEGORIES
Think broadly about which trades and services operate locally and benefit from online visibility.
Start with but don't limit yourself to:
  - Electricians / Electrical contractors
  - Plumbers / Gas engineers / Boiler repair
  - Heating engineers / HVAC
  - Removal companies / Man with a van
  - Cleaning companies (domestic, commercial, end-of-tenancy)
  - Car garages / MOT centres / Auto repair
  - Tattoo studios / Piercing
  - Handymen / General maintenance
  - Painters and decorators
  - Roofers / Guttering / Fascias
  - Locksmiths
  - Pest control
  - Landscaping / Gardening
  - Tree surgeons / Arborists
  - Carpet cleaners / Upholstery cleaning
  - Window cleaners
  - Builders / General contractors
  - Kitchen fitters / Bathroom fitters
  - Tilers / Flooring
  - Fence & gate installers
  - Skip hire / Waste removal
  - Dog groomers / Pet services
  - Driving instructors
  - Childminders / Nurseries

Use your judgement to add any other categories you think are relevant.

WORKFLOW — follow this exactly for EACH category:
1. Call search_businesses with an appropriate query
2. For each business in the results, call get_business_details
3. Decision:
   - If no website → call save_lead immediately (reason: "No website")
   - If website looks like social media/directory → call save_lead (reason: describe what it is)
   - If website URL exists → call check_website_quality
     - If quality is "broken" or "poor" → call extract_email, then call save_lead
     - If quality is "ok" → skip, do NOT save
4. Move to the next category

RULES
- Save ONLY genuine leads (no website or poor website)
- Do NOT save businesses with good, professional websites
- If a result is a national chain or franchise (e.g. Dyno-Rod, British Gas), skip it
- Be thorough: aim to cover at least 15 different categories
- Keep working until you have processed all planned categories`;

// ─── Agent loop ──────────────────────────────────────────────────────────────

export async function runAgent(): Promise<void> {
  const client = new Anthropic();

  console.log('🤖 Lead Generation Agent starting…');
  console.log(`📍 Target: Kettering, Northamptonshire\n`);

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: 'Start the lead generation process now. Work through all relevant categories systematically.',
    },
  ];

  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    // Print any text the agent writes
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        console.log(`\n🤖 ${block.text.trim()}`);
      }
    }

    // Agent is done
    if (response.stop_reason === 'end_turn') break;

    // No tools called — shouldn't happen but guard anyway
    if (response.stop_reason !== 'tool_use') break;

    // Process tool calls
    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      const input = block.input as Record<string, string>;
      const preview = JSON.stringify(input).slice(0, 120);
      console.log(`\n🔧 ${block.name}(${preview}${preview.length >= 120 ? '…' : ''})`);

      const result = await executeTool(block.name, input);

      const resultPreview = result.slice(0, 200);
      console.log(`   → ${resultPreview}${result.length > 200 ? '…' : ''}`);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  console.log('\n✅ Agent finished.');
}
