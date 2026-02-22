import Anthropic from "@anthropic-ai/sdk";
import type { Lead, PostResult, LinkedInConfig, AgentOptions } from "./types.js";
import { publishToLinkedIn } from "./linkedin.js";

const SYSTEM_PROMPT = `You are a professional LinkedIn content writer specializing in B2B marketing.
Your job is to create engaging LinkedIn posts based on business leads discovered through market research.

Guidelines:
- Write 150–300 words per post
- Start with a strong hook sentence
- Highlight what makes this business interesting or valuable
- Include a subtle call-to-action at the end
- Add 3–5 relevant hashtags on a new line at the end
- Use a professional yet conversational tone
- Do NOT use excessive emojis (max 2 per post)
- Write in English unless the business is clearly in a non-English speaking market`;

function buildLeadContext(lead: Lead): string {
  const lines: string[] = [`Business: ${lead.businessName}`];

  if (lead.category) lines.push(`Category: ${lead.category}`);
  if (lead.address) lines.push(`Location: ${lead.address}`);
  if (lead.phone) lines.push(`Phone: ${lead.phone}`);
  if (lead.website) lines.push(`Website: ${lead.website}`);
  if (lead.rating !== undefined)
    lines.push(
      `Rating: ${lead.rating}/5${lead.reviewCount ? ` (${lead.reviewCount} reviews)` : ""}`
    );
  if (lead.description) lines.push(`About: ${lead.description}`);

  return lines.join("\n");
}

export async function runPostAgent(
  lead: Lead,
  linkedInConfig: LinkedInConfig,
  options: AgentOptions = {}
): Promise<PostResult> {
  const client = new Anthropic();

  const leadContext = buildLeadContext(lead);
  const userPrompt = lead.customPrompt
    ? `Here is the business lead:\n\n${leadContext}\n\nSpecial instructions: ${lead.customPrompt}`
    : `Here is the business lead I discovered during market research. Create a LinkedIn post about it:\n\n${leadContext}`;

  if (options.verbose) {
    console.log(`\n[Agent] Generating post for: ${lead.businessName}`);
  }

  // Stream the response from Claude claude-opus-4-6 with adaptive thinking
  let generatedContent = "";

  process.stdout.write(`\nGenerating post for "${lead.businessName}"...\n\n`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    // "adaptive" is supported by claude-opus-4-6; cast needed until SDK types catch up
    thinking: { type: "adaptive" } as any,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      process.stdout.write(event.delta.text);
      generatedContent += event.delta.text;
    }
  }

  const finalMessage = await stream.finalMessage();
  process.stdout.write("\n");

  if (options.verbose) {
    const usage = finalMessage.usage;
    console.log(
      `[Agent] Tokens used — input: ${usage.input_tokens}, output: ${usage.output_tokens}`
    );
  }

  generatedContent = generatedContent.trim();

  if (options.dryRun) {
    console.log("\n[DRY RUN] Post NOT published to LinkedIn.\n");
    return { success: true, lead: lead.businessName, content: generatedContent };
  }

  // Publish to LinkedIn
  try {
    console.log("\nPublishing to LinkedIn...");
    const result = await publishToLinkedIn(linkedInConfig, generatedContent);
    console.log(`Published! Post ID: ${result.id}\n`);
    return {
      success: true,
      lead: lead.businessName,
      content: generatedContent,
      postId: result.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to publish: ${message}\n`);
    return {
      success: false,
      lead: lead.businessName,
      content: generatedContent,
      error: message,
    };
  }
}

/** Process multiple leads sequentially */
export async function runBatchPostAgent(
  leads: Lead[],
  linkedInConfig: LinkedInConfig,
  options: AgentOptions = {}
): Promise<PostResult[]> {
  const results: PostResult[] = [];

  console.log(`\nPost AI Agent — processing ${leads.length} lead(s)\n`);
  console.log("=".repeat(60));

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    console.log(`\n[${i + 1}/${leads.length}] Processing: ${lead.businessName}`);
    console.log("-".repeat(60));

    const result = await runPostAgent(lead, linkedInConfig, options);
    results.push(result);

    console.log("=".repeat(60));
  }

  return results;
}
