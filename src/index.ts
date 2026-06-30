#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GitBookAPIClient } from "./client.js";
import { registerTools } from "./tools.js";
import { registerPrompts } from "./prompts.js";
import {
    sendLogMessage,
    ensureApiToken,
    organizationId,
    defaultSpaceId,
    apiBaseURL,
    excludedSpaceIds,
} from "./config.js";

const apiToken = ensureApiToken();

const gitbookClient = new GitBookAPIClient(apiToken, {
    organizationId,
    defaultSpaceId,
    baseURL: apiBaseURL,
});

// Create the MCP server
const server = new McpServer(
    {
        name: "gitbook-mcp",
        version: "0.1.0",
    },
    {
        capabilities: {
            resources: {},
            tools: {},
            prompts: {},
        },
    },
);

registerTools(server, gitbookClient);
registerPrompts(server, gitbookClient, excludedSpaceIds);

// Add a resource for the default space if configured
if (defaultSpaceId) {
    const spaceId = defaultSpaceId;
    server.resource("default-space", "gitbook://default-space", async () => {
        const content = await gitbookClient.getSpaceContent(spaceId);
        return {
            contents: [
                {
                    uri: "gitbook://default-space",
                    text: JSON.stringify(content, null, 2),
                    mimeType: "application/json",
                },
            ],
        };
    });
}

// Add resources for easy access to common data
server.resource("organizations", "gitbook://organizations", async () => {
    const organizations = await gitbookClient.getOrganizations();
    return {
        contents: [
            {
                uri: "gitbook://organizations",
                text: JSON.stringify(organizations, null, 2),
                mimeType: "application/json",
            },
        ],
    };
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    sendLogMessage("info", "👟 GitBook MCP server running on stdio");
}

main().catch((error) => {
    sendLogMessage("error", `Fatal error: ${error}`);
    process.exit(1);
});
