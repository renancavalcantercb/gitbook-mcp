import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GitBookAPIClient } from "./client.js";

// Wraps prompt bodies in the MCP single-user-message envelope.
const promptResult = (description: string, text: string) => ({
    description,
    messages: [
        { role: "user" as const, content: { type: "text" as const, text } },
    ],
});

// Comprehensive prompts for GitBook documentation workflows
export function registerPrompts(
    server: McpServer,
    client: GitBookAPIClient,
    excludedSpaceIds: string[],
) {
    server.prompt(
        "fetch_documentation",
        "Fetch and analyze GitBook documentation content for specific topics",
        {
            spaceId: z
                .string()
                .optional()
                .describe(
                    "The GitBook space ID to search in (uses default space if not provided)",
                ),
            topic: z
                .string()
                .describe(
                    "The topic or keyword to search for in the documentation",
                ),
            includeStructure: z
                .string()
                .optional()
                .describe(
                    'Set to "true" to include the overall space structure in the analysis',
                ),
        },
        (args) => {
            const { spaceId, topic, includeStructure } = args;
            const effectiveSpaceId = client.resolveSpaceId(spaceId);

            let promptText = `I need to fetch and analyze GitBook documentation content.

**Space ID**: ${effectiveSpaceId}
**Topic**: ${topic}
**Include Structure**: ${includeStructure === "true"}

Please help me:
1. Search for content related to "${topic}" in the GitBook space
2. Retrieve the most relevant pages
3. Analyze the content for completeness and accuracy
4. Identify any related pages or sections I should also review`;

            if (includeStructure === "true") {
                promptText += `
5. Show me the overall space structure to understand context`;
            }

            promptText += `

Start by using the search_content tool to find relevant pages, then use get_page_content to retrieve the actual content for analysis.`;

            return promptResult(
                `Fetch and analyze GitBook documentation for topic: ${topic}`,
                promptText,
            );
        },
    );

    server.prompt(
        "analyze_content_gaps",
        "Identify gaps and missing content in documentation",
        {
            spaceId: z
                .string()
                .optional()
                .describe(
                    "The GitBook space ID to analyze (uses default space if not provided)",
                ),
            comparisonSource: z
                .string()
                .optional()
                .describe(
                    "Source to compare against (default: internal analysis)",
                ),
        },
        (args) => {
            const { spaceId, comparisonSource = "internal analysis" } = args;
            const effectiveSpaceId = client.resolveSpaceId(spaceId);

            const promptText = `I need to identify gaps and missing content in GitBook documentation.

**Space ID**: ${effectiveSpaceId}
**Comparison Source**: ${comparisonSource}

Please help me:
1. Get the complete space structure and content overview
2. Analyze documentation for missing topics and incomplete sections
3. Identify coverage gaps and prioritize them by importance
4. Suggest new content areas that should be added
5. Compare against ${comparisonSource} if relevant
6. Create a prioritized list of content gaps to address

Start by using get_space_content to understand the current structure, then analyze individual pages with get_page_content to identify gaps.`;

            return promptResult(
                `Analyze content gaps in GitBook space`,
                promptText,
            );
        },
    );

    server.prompt(
        "content_audit",
        "Perform quality audits of documentation content",
        {
            spaceId: z
                .string()
                .optional()
                .describe(
                    "The GitBook space ID to audit (uses default space if not provided)",
                ),
            auditCriteria: z
                .string()
                .optional()
                .describe(
                    "Specific criteria to audit (default: general quality and consistency)",
                ),
        },
        (args) => {
            const {
                spaceId,
                auditCriteria = "general quality and consistency",
            } = args;
            const effectiveSpaceId = client.resolveSpaceId(spaceId);

            const promptText = `I need to perform a comprehensive quality audit of GitBook documentation.

**Space ID**: ${effectiveSpaceId}
**Audit Criteria**: ${auditCriteria}

Please help me:
1. Review the space structure and organization
2. Examine content quality and consistency across pages
3. Check for outdated information and broken references
4. Evaluate writing style and tone consistency
5. Identify formatting and structural issues
6. Assess completeness and accuracy of information
7. Provide detailed improvement recommendations

Start by using get_space_content to understand the structure, then systematically review pages with get_page_content.`;

            return promptResult(
                `Perform quality audit of GitBook documentation`,
                promptText,
            );
        },
    );

    server.prompt(
        "documentation_summary",
        "Generate comprehensive summaries of GitBook spaces",
        {
            spaceId: z
                .string()
                .optional()
                .describe(
                    "The GitBook space ID to summarize (uses default space if not provided)",
                ),
            summaryType: z
                .string()
                .optional()
                .describe(
                    "Type of summary: overview, technical, user-guide, or custom (default: overview)",
                ),
        },
        (args) => {
            const { spaceId, summaryType = "overview" } = args;
            const effectiveSpaceId = client.resolveSpaceId(spaceId);

            const promptText = `I need to generate a comprehensive summary of GitBook documentation.

**Space ID**: ${effectiveSpaceId}
**Summary Type**: ${summaryType}

Please help me:
1. Analyze the space structure and content organization
2. Identify main topics, themes, and coverage areas
3. Create a ${summaryType} summary highlighting key sections
4. Summarize the scope and purpose of the documentation
5. Highlight important sections and entry points
6. Identify the target audience and use cases
7. Note any special features or unique aspects

Start by using get_space_content to understand the overall structure, then selectively review key pages with get_page_content to create an accurate summary.`;

            return promptResult(
                `Generate ${summaryType} summary of GitBook space`,
                promptText,
            );
        },
    );

    server.prompt(
        "content_optimization",
        "Optimize content for SEO, readability, structure, or performance",
        {
            spaceId: z
                .string()
                .optional()
                .describe(
                    "The GitBook space ID to optimize (uses default space if not provided)",
                ),
            optimizationType: z
                .string()
                .describe(
                    "Type of optimization: SEO, readability, structure, or performance",
                ),
            targetMetrics: z
                .string()
                .optional()
                .describe("Specific metrics or goals to optimize for"),
        },
        (args) => {
            const { spaceId, optimizationType, targetMetrics } = args;
            const effectiveSpaceId = client.resolveSpaceId(spaceId);

            const promptText = `I need to optimize GitBook documentation content.

**Space ID**: ${effectiveSpaceId}
**Optimization Type**: ${optimizationType}
**Target Metrics**: ${targetMetrics || "general improvement"}

Please help me:
1. Analyze current content for optimization opportunities
2. Identify pages that need ${optimizationType} improvements
3. Suggest specific optimization strategies and changes
4. Prioritize optimizations by impact and effort
5. Provide actionable recommendations for improvement
6. Consider target metrics: ${targetMetrics || "overall quality"}

Start by using get_space_content to understand the structure, then analyze individual pages with get_page_content. Use search_content to identify common patterns that need optimization.`;

            return promptResult(
                `Optimize GitBook content for ${optimizationType}`,
                promptText,
            );
        },
    );

    server.prompt(
        "propose_page_edit",
        "Draft a create/update proposal for a GitBook page for human review — never writes to GitBook, there is no write tool",
        {
            spaceId: z
                .string()
                .optional()
                .describe(
                    "The GitBook space ID to target (uses default space if not provided)",
                ),
            pagePath: z
                .string()
                .optional()
                .describe(
                    "Path of the existing page to update, or the intended path for a new page. Omit if no path is decided yet.",
                ),
            changeDescription: z
                .string()
                .describe(
                    "What should change, e.g. 'VPN IPs changed, update with new values' or 'document the new staging deploy process'",
                ),
        },
        (args) => {
            const { spaceId, pagePath, changeDescription } = args;
            const effectiveSpaceId = client.resolveSpaceId(spaceId);

            if (excludedSpaceIds.includes(effectiveSpaceId)) {
                return promptResult(
                    `Refused — space ${effectiveSpaceId} is excluded from propose_page_edit`,
                    `Space ${effectiveSpaceId} is excluded from propose_page_edit (GITBOOK_EXCLUDED_SPACE_IDS). This space uses its own reviewed git-sync flow and is out of scope for this tool — no edit proposal will be drafted here.`,
                );
            }

            const promptText = `I need to draft a documentation edit for human review. There is no write tool in this server — I will NOT write to GitBook, only produce a proposal.

**Space ID**: ${effectiveSpaceId}
**Page path**: ${pagePath ?? "(not decided yet — propose one)"}
**Requested change**: ${changeDescription}

Steps:
1. ${pagePath ? `Call get_page_by_path with pagePath "${pagePath}" to check whether this page exists.` : "No path was given — skip straight to step 3, this is a new page."}
2. If the page exists, this is an UPDATE: use its current content as the basis for the draft, and prepare a change summary describing what changed and why.
3. If the page does not exist (or no path was given), this is a CREATE: call get_space_content to see the page tree, then propose ONE specific placement (parent section + path) with brief reasoning — invite the user to correct it rather than asserting it as final.
4. Draft the full markdown content for the page incorporating the requested change.
5. Respond using exactly this structure:
   - **Target**: title, path, GitBook app URL (urls.app) if known
   - **Mode**: update or create
   - **Draft**: the full markdown
   - **Change summary** (update) or **Placement rationale** (create)
   - Closing line, verbatim: "Not applied — paste this into GitBook yourself."

Do not call any write/import endpoint — none exists in this server.`;

            return promptResult(
                `Draft a page edit proposal for ${pagePath ?? "a new page"} in space ${effectiveSpaceId}`,
                promptText,
            );
        },
    );
}
