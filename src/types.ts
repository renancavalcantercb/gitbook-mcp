// Types based on GitBook API OpenAPI specification
export interface GitBookSpace {
    object: "space";
    id: string;
    title: string;
    emoji?: string;
    visibility:
        | "public"
        | "unlisted"
        | "visitor-authentication"
        | "members-only"
        | "inherited";
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
    editMode?: string;
    urls: {
        location: string;
        app: string;
        published?: string;
        public?: string;
        icon?: string;
    };
    organization: string;
    parent?: string;
    gitSync?: {
        enabled: boolean;
        url?: string;
        branch?: string;
    };
}

export interface GitBookOrganization {
    object: "organization";
    id: string;
    title: string;
    createdAt: string;
    emailDomains?: string[];
    hostname?: string;
    type?: string;
    useCase?: string;
    communityType?: string;
    defaultRole?: string;
    defaultContent?: string;
    sso?: boolean;
    ai?: boolean;
    inviteLinks?: boolean;
    plan?: any;
    billing?: any;
    urls: {
        location: string;
        app: string;
        published?: string;
        icon?: string;
    };
}

export interface GitBookPage {
    id: string;
    title: string;
    description?: string;
    kind: "sheet" | "group";
    type: "document" | "link" | "group";
    path: string;
    slug?: string;
    href?: string;
    documentId?: string;
    createdAt?: string;
    updatedAt?: string;
    git?: {
        oid: string;
        path: string;
    };
    urls?: {
        app?: string;
    };
    pages?: GitBookPage[];
    layout?: {
        cover?: boolean;
        coverSize?: string;
        title?: boolean;
        description?: boolean;
        tableOfContents?: boolean;
        outline?: boolean;
        pagination?: boolean;
    };
}

export interface GitBookRevision {
    object: "revision";
    id: string;
    title?: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    type: "initial" | "update" | "merge";
    parent?: string;
    git?: {
        oid: string;
        message?: string;
    };
    pages: GitBookPage[];
}

// Page metadata + body, as returned by GET content/page/{pageId} and
// content/path/{pagePath}. `document` is populated for format=document
// (the default); `markdown` is populated for format=markdown. Verified
// against live API responses — the OpenAPI spec's RevisionPage union
// doesn't reflect the markdown-format shape.
export interface GitBookPageContent extends GitBookPage {
    tags?: string[];
    document?: {
        object: "document";
        data: Record<string, any>;
        nodes: any[];
    };
    markdown?: string;
}

export interface GitBookSearchSection {
    id: string;
    title: string;
    body: string;
    path: string;
    score?: number;
    urls: { app: string };
}

export interface GitBookSearchPageResult {
    id: string;
    title: string;
    path: string;
    score?: number;
    sections?: GitBookSearchSection[];
    ancestors?: { title: string }[];
    urls: { app: string };
}

export interface GitBookSearchResponse {
    items: GitBookSearchPageResult[];
    next?: { page: string };
}

// Error response interface from OpenAPI spec
export interface GitBookErrorResponse {
    error: {
        code: number;
        message: string;
        details?: any;
    };
}

// Thrown by GitBookAPIClient on non-2xx responses; callers can switch on `status`
// instead of parsing error message strings (used by write-tool 409 handling).
export class GitBookAPIError extends Error {
    constructor(
        message: string,
        public status: number,
    ) {
        super(message);
        this.name = "GitBookAPIError";
    }
}
