import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GitBookAPIClient } from "./client.js";

// Wraps tool results in the MCP text-content envelope.
const jsonResult = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

// Core Content Reading Tools
export function registerTools(server: McpServer, client: GitBookAPIClient) {
    server.tool(
        "list_organizations",
        "List all GitBook organizations accessible with the current API token",
        {},
        {
            title: "List Organizations",
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
        async () => {
            const organizations = await client.getOrganizations();
            return jsonResult(organizations);
        },
    );

    server.tool(
        "list_spaces",
        "List all spaces in a GitBook organization, optionally filtered by organization ID",
        {
            organizationId: z
                .string()
                .optional()
                .describe("Organization ID to filter spaces by"),
        },
        {
            title: "List Spaces",
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
        async ({ organizationId }) => {
            const spaces = await client.getSpaces(organizationId);
            return jsonResult(spaces);
        },
    );

    server.tool(
        "get_space",
        "Get detailed information about a specific GitBook space",
        {
            spaceId: z.string().describe("The ID of the space to retrieve"),
        },
        {
            title: "Get Space Details",
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
        async ({ spaceId }) => {
            const space = await client.getSpace(spaceId);
            return jsonResult(space);
        },
    );

    server.tool(
        "get_space_content",
        "Get the complete content structure and page hierarchy of a GitBook space",
        {
            spaceId: z
                .string()
                .optional()
                .describe(
                    "The ID of the space to get content from (uses default space if not provided)",
                ),
        },
        {
            title: "Get Space Content",
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
        async ({ spaceId }) => {
            const effectiveSpaceId = client.resolveSpaceId(spaceId);
            const content = await client.getSpaceContent(effectiveSpaceId);
            return jsonResult(content);
        },
    );

    server.tool(
        "get_page_content",
        "Retrieve the content of a specific page from a GitBook space, with options for format and metadata",
        {
            spaceId: z
                .string()
                .optional()
                .describe(
                    "The ID of the space containing the page (uses default space if not provided)",
                ),
            pageId: z
                .string()
                .describe("The ID of the page to retrieve content from"),
            format: z
                .enum(["document", "markdown"])
                .optional()
                .describe("The format of the document to retrieve"),
            metadata: z
                .boolean()
                .optional()
                .describe("Whether to include revision metadata"),
            computed: z
                .boolean()
                .optional()
                .describe("Whether to include computed revision data"),
        },
        {
            title: "Get Page Content",
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
        async ({ spaceId, pageId, format, metadata, computed }) => {
            const effectiveSpaceId = client.resolveSpaceId(spaceId);

            const options: Record<string, any> = {};
            if (format !== undefined) options.format = format;
            if (metadata !== undefined) options.metadata = metadata;
            if (computed !== undefined) options.computed = computed;

            const pageContent = await client.getPageContent(
                effectiveSpaceId,
                pageId,
                Object.keys(options).length > 0 ? options : undefined,
            );

            return jsonResult(pageContent);
        },
    );

    server.tool(
        "get_page_by_path",
        "Retrieve a page from a GitBook space using its path instead of page ID",
        {
            spaceId: z
                .string()
                .optional()
                .describe(
                    "The ID of the space containing the page (uses default space if not provided)",
                ),
            pagePath: z.string().describe("The path of the page to retrieve"),
        },
        {
            title: "Get Page by Path",
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
        async ({ spaceId, pagePath }) => {
            const effectiveSpaceId = client.resolveSpaceId(spaceId);
            const pageContent = await client.getPageByPath(
                effectiveSpaceId,
                pagePath,
            );
            return jsonResult(pageContent);
        },
    );

    server.tool(
        "search_content",
        "Search for content within a GitBook space using a text query",
        {
            spaceId: z
                .string()
                .optional()
                .describe(
                    "The ID of the space to search in (uses default space if not provided)",
                ),
            query: z.string().describe("The search query"),
        },
        {
            title: "Search Content",
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true,
        },
        async ({ spaceId, query }) => {
            const effectiveSpaceId = client.resolveSpaceId(spaceId);
            const searchResults = await client.searchContent(
                effectiveSpaceId,
                query,
            );
            return jsonResult(searchResults);
        },
    );
}
