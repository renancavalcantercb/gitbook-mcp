import { config } from "dotenv";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// JSON-RPC logging function
export const sendLogMessage = (level: string, message: string) => {
    const notification = {
        jsonrpc: "2.0",
        method: "notifications/message",
        params: {
            level: level,
            logger: "gitbook-mcp",
            data: message,
        },
    };
    console.log(JSON.stringify(notification));
};

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the project root by looking for package.json
function findProjectRoot(startDir: string): string {
    let currentDir = startDir;
    while (currentDir !== dirname(currentDir)) {
        if (existsSync(join(currentDir, "package.json"))) {
            return currentDir;
        }
        currentDir = dirname(currentDir);
    }
    // Fallback to parent of dist directory
    return join(__dirname, "..");
}

const projectRoot = findProjectRoot(__dirname);

// Parse CLI arguments
interface CLIArgs {
    organizationId?: string;
    spaceId?: string;
}

const argv = yargs(hideBin(process.argv))
    .option("organization-id", {
        type: "string",
        description: "Organization ID to work with",
        alias: "org",
    })
    .option("space-id", {
        type: "string",
        description: "The space to get content from",
        alias: "space",
    })
    .help()
    .parseSync() as CLIArgs;

// Add debug info only if DEBUG env var is set
const DEBUG = process.env.DEBUG;

// Apply configuration hierarchy: CLI args > Copilot instructions > Environment variables
function resolveConfiguration() {
    const envConfig = {
        organizationId: process.env.GITBOOK_ORGANIZATION_ID,
        spaceId: process.env.GITBOOK_SPACE_ID,
    };

    const cliConfig = {
        organizationId: argv.organizationId,
        spaceId: argv.spaceId,
    };

    // Apply hierarchy (later values override earlier ones)
    const resolvedConfig = {
        organizationId: cliConfig.organizationId || envConfig.organizationId,
        spaceId: cliConfig.spaceId || envConfig.spaceId,
    };

    if (DEBUG) {
        console.error("🔍 Debug: Configuration sources:");
        console.error("  Environment:", envConfig);
        console.error("  CLI arguments:", cliConfig);
        console.error("  Final resolved:", resolvedConfig);
    }

    return resolvedConfig;
}

// Load environment variables from .env.local, .env files
// Priority: .env.local > .env > process.env
const envFiles = [
    join(projectRoot, ".env.local"),
    join(projectRoot, ".env"),
    ".env.local", // Also try current working directory
    ".env",
];

let envLoaded = false;
if (DEBUG) {
    console.error(`🔍 Debug: Working directory: ${process.cwd()}`);
    console.error(`🔍 Debug: Script directory: ${__dirname}`);
    console.error(`🔍 Debug: Project root: ${projectRoot}`);
}

for (const envFile of envFiles) {
    if (existsSync(envFile)) {
        const result = config({ path: envFile, override: true });
        if (result.error) {
            sendLogMessage(
                "warn",
                `⚠️  Warning: Error loading ${envFile}: ${result.error.message}`,
            );
        } else {
            sendLogMessage("info", `✅ Loaded environment from: "${envFile}"`);
            envLoaded = true;
            break;
        }
    } else if (DEBUG) {
        console.error(`❌ File not found: ${envFile}`);
    }
}

if (!envLoaded) {
    sendLogMessage(
        "warn",
        `📁 No environment files found. Checked: ${envFiles.join(", ")}`,
    );
}

const resolvedConfig = resolveConfiguration();
export const organizationId = resolvedConfig.organizationId;
export const defaultSpaceId = resolvedConfig.spaceId;
export const apiBaseURL = process.env.GITBOOK_API_BASE_URL;

// Spaces propose_page_edit refuses to draft for — public docs space uses its own
// reviewed git-sync flow (DESIGN.md §10.4). Defaults to that space if unset.
export const excludedSpaceIds = (
    process.env.GITBOOK_EXCLUDED_SPACE_IDS ?? "4enQ5nGf8OInfkQDrZoR"
)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

const apiToken = process.env.GITBOOK_API_TOKEN;

function logMissingTokenHelp(): void {
    sendLogMessage(
        "error",
        "❌ GITBOOK_API_TOKEN environment variable is required",
    );
    sendLogMessage(
        "error",
        "💡 Please set your GitBook API token in your .env file",
    );
    sendLogMessage("error", "💡 Example: GITBOOK_API_TOKEN=your_token_here");
    sendLogMessage(
        "error",
        "💡 Get your token from: https://app.gitbook.com/account/developer",
    );

    sendLogMessage("info", "\n📋 Configuration Summary:");
    if (organizationId) {
        const source = argv.organizationId
            ? "CLI argument"
            : "environment variable";
        sendLogMessage(
            "info",
            `💡 Organization ID: ${organizationId} (from ${source})`,
        );
    } else {
        sendLogMessage("info", "💡 No Organization ID configured");
        sendLogMessage("info", "   • Use --organization-id CLI argument");
        sendLogMessage(
            "info",
            '   • Add "organization-id: your-org-id" to .github/copilot-instructions.md',
        );
        sendLogMessage(
            "info",
            "   • Set GITBOOK_ORGANIZATION_ID environment variable",
        );
        sendLogMessage(
            "info",
            "   • Use list_organizations tool to find your org ID",
        );
    }

    if (defaultSpaceId) {
        const source = argv.spaceId ? "CLI argument" : "environment variable";
        sendLogMessage(
            "info",
            `💡 Default Space ID: ${defaultSpaceId} (from ${source})`,
        );
    } else {
        sendLogMessage("info", "💡 No default Space ID configured");
        sendLogMessage("info", "   • Use --space-id CLI argument");
        sendLogMessage(
            "info",
            '   • Add "space-id: your-space-id" to .github/copilot-instructions.md',
        );
        sendLogMessage(
            "info",
            "   • Set GITBOOK_SPACE_ID environment variable",
        );
    }
}

// Validates GITBOOK_API_TOKEN is set, printing setup help and exiting if not.
export function ensureApiToken(): string {
    if (apiToken) return apiToken;
    logMissingTokenHelp();
    process.exit(1);
}
