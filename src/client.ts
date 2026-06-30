import type {
    GitBookSpace,
    GitBookOrganization,
    GitBookRevision,
    GitBookPageContent,
    GitBookSearchResponse,
    GitBookErrorResponse,
} from "./types.js";
import { GitBookAPIError } from "./types.js";

// GitBook API client
export class GitBookAPIClient {
    private baseURL: string;
    private apiToken: string;
    private organizationId?: string;
    private defaultSpaceId?: string;

    constructor(
        apiToken: string,
        options?: {
            organizationId?: string;
            defaultSpaceId?: string;
            baseURL?: string;
        },
    ) {
        this.apiToken = apiToken;
        this.organizationId = options?.organizationId;
        this.defaultSpaceId = options?.defaultSpaceId;
        this.baseURL = options?.baseURL || "https://api.gitbook.com/v1";
    }

    // Get the default space ID (with fallback priority)
    getDefaultSpaceId(): string | undefined {
        return this.defaultSpaceId;
    }

    // Get the default organization ID
    getDefaultOrganizationId(): string | undefined {
        return this.organizationId;
    }

    // Resolve configuration with hierarchy: explicit param > default config > error
    private resolveRequired(
        explicit: string | undefined,
        fallback: string | undefined,
        label: string,
        flag: string,
    ): string {
        const effective = explicit || fallback;
        if (!effective) {
            throw new Error(
                `No ${label} provided and no default ${label} configured. Please provide ${label}, use --${flag} CLI argument, or add ${flag} to your configuration file.`,
            );
        }
        return effective;
    }

    resolveSpaceId(explicitSpaceId?: string): string {
        return this.resolveRequired(
            explicitSpaceId,
            this.getDefaultSpaceId(),
            "space ID",
            "space-id",
        );
    }

    resolveOrganizationId(explicitOrgId?: string): string {
        return this.resolveRequired(
            explicitOrgId,
            this.getDefaultOrganizationId(),
            "organization ID",
            "organization-id",
        );
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Maps GitBook HTTP errors to messages the calling agent can act on.
    // 409 is intentionally left as the raw API message — its meaning is
    // contextual per-endpoint (e.g. insert_page vs update_page), so callers
    // that care (write tools) switch on `status` themselves.
    private mapErrorMessage(status: number, rawMessage: string): string {
        switch (status) {
            case 401:
                return "Invalid or expired token — regenerate PAT in GitBook account settings.";
            case 403:
                return "Token's user has no access to this space.";
            case 404:
                return "Space or page not found at that path.";
            default:
                return rawMessage;
        }
    }

    private async makeRequest<T>(
        endpoint: string,
        options?: {
            method?: string;
            body?: any;
            headers?: Record<string, string>;
        },
    ): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
            ...options?.headers,
        };

        const maxRetries = 2;
        let attempt = 0;

        while (true) {
            const response = await fetch(url, {
                method: options?.method || "GET",
                headers,
                body: options?.body ? JSON.stringify(options.body) : undefined,
            });

            if (response.status === 429 && attempt < maxRetries) {
                attempt++;
                await this.sleep(2 ** attempt * 500);
                continue;
            }

            if (!response.ok) {
                let rawMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData =
                        (await response.json()) as GitBookErrorResponse;
                    rawMessage = errorData.error?.message || rawMessage;
                } catch (e) {
                    // If we can't parse the error response, use the basic error message
                }

                if (response.status === 429) {
                    throw new GitBookAPIError(
                        "Rate limited, try again shortly.",
                        429,
                    );
                }
                throw new GitBookAPIError(
                    this.mapErrorMessage(response.status, rawMessage),
                    response.status,
                );
            }

            return response.json() as Promise<T>;
        }
    }

    // Organization operations
    async getOrganizations(): Promise<GitBookOrganization[]> {
        const response = await this.makeRequest<{
            items: GitBookOrganization[];
        }>("/orgs");
        return response.items;
    }

    // Space operations
    async getSpaces(organizationId?: string): Promise<GitBookSpace[]> {
        const orgId = organizationId || this.organizationId;
        if (!orgId) {
            throw new Error(
                "Organization ID is required to list spaces. Provide it via parameter or environment variable.",
            );
        }
        const response = await this.makeRequest<{ items: GitBookSpace[] }>(
            `/orgs/${orgId}/spaces`,
        );
        return response.items;
    }

    async getSpace(spaceId: string): Promise<GitBookSpace> {
        return this.makeRequest<GitBookSpace>(`/spaces/${spaceId}`);
    }

    async getSpaceContent(spaceId: string): Promise<GitBookRevision> {
        return this.makeRequest<GitBookRevision>(`/spaces/${spaceId}/content`);
    }

    // Page operations
    async getPageContent(
        spaceId: string,
        pageId: string,
        options?: {
            format?: "document" | "markdown";
            metadata?: boolean;
            computed?: boolean;
        },
    ): Promise<GitBookPageContent> {
        let endpoint = `/spaces/${spaceId}/content/page/${pageId}`;
        const params = new URLSearchParams();

        if (options?.format) params.append("format", options.format);
        if (options?.metadata !== undefined)
            params.append("metadata", options.metadata.toString());
        if (options?.computed !== undefined)
            params.append("computed", options.computed.toString());

        if (params.toString()) {
            endpoint += `?${params.toString()}`;
        }

        return this.makeRequest<GitBookPageContent>(endpoint);
    }

    async getPageByPath(
        spaceId: string,
        pagePath: string,
    ): Promise<GitBookPageContent> {
        const encodedPath = encodeURIComponent(pagePath);
        return this.makeRequest<GitBookPageContent>(
            `/spaces/${spaceId}/content/path/${encodedPath}`,
        );
    }

    // Search operations
    async searchContent(
        spaceId: string,
        query: string,
    ): Promise<GitBookSearchResponse> {
        const params = new URLSearchParams({ query });
        return this.makeRequest<GitBookSearchResponse>(
            `/spaces/${spaceId}/search?${params.toString()}`,
        );
    }
}
