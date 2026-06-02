# API Versioning — SocialCreator

## 1. Overview

The API currently has no version prefix. Routes live directly under `/api/agents`,
`/api/content`, etc. This document defines a `/v1/` versioning scheme with:

- **URL prefix**: `/api/v1/agents`, `/api/v1/content`, etc.
- **Header-based resolution**: `Accept-version: v1` header (optional override)
- **Next.js App Router middleware** for transparent resolution
- **Migration path** that keeps old routes working during transition

## 2. Constraints

- Next.js App Router middleware runs at the edge — limited to `NextRequest`/`NextResponse`
- Must not break any existing `/api/*` routes during migration
- The existing `middleware.ts` handles auth only (via `auth()`)
- Must support both old and new routes in parallel during Phase 1

## 3. File Structure

```
socialcreator-web/src/app/api/
└── v1/                          # NEW: versioned routes
    ├── agents/
    │   ├── route.ts
    │   └── [id]/
    │       └── route.ts
    ├── content/
    │   ├── route.ts
    │   └── [id]/
    │       └── route.ts
    ├── profiles/
    │   ├── route.ts
    │   └── [id]/
    │       └── route.ts
    └── ...                      # Mirror existing API routes

socialcreator-web/src/middleware.ts  # MODIFIED: add version resolution
socialcreator-web/src/lib/
├── api-version.ts               # NEW: version utilities
└── middleware/
    └── api-middleware.ts        # MODIFIED: add version to ApiContext
```

## 4. Core Design

### 4.1 Version Resolution Strategy

```typescript
// src/lib/api-version.ts
export type ApiVersion = "v1" | "v2" | "v3";
export const LATEST_VERSION: ApiVersion = "v1";
export const SUPPORTED_VERSIONS: ApiVersion[] = ["v1"];

export interface VersionInfo {
  version: ApiVersion;
  resolvedBy: "url" | "header" | "default";
}

export function getVersionFromUrl(pathname: string): ApiVersion | null {
  const match = pathname.match(/^\/api\/(v\d+)\//);
  if (match && SUPPORTED_VERSIONS.includes(match[1] as ApiVersion))
    return match[1] as ApiVersion;
  return null;
}

export function getVersionFromHeader(headers: Headers): ApiVersion | null {
  const header = headers.get("accept-version");
  if (header && SUPPORTED_VERSIONS.includes(header.trim() as ApiVersion))
    return header.trim() as ApiVersion;
  return null;
}

export function resolveApiVersion(pathname: string, headers: Headers): VersionInfo {
  const fromUrl = getVersionFromUrl(pathname);
  if (fromUrl) return { version: fromUrl, resolvedBy: "url" };
  const fromHeader = getVersionFromHeader(headers);
  if (fromHeader) return { version: fromHeader, resolvedBy: "header" };
  return { version: LATEST_VERSION, resolvedBy: "default" };
}

export function addVersionHeaders(response: NextResponse, version: ApiVersion): void {
  response.headers.set("X-API-Version", version);
  response.headers.set("X-API-Latest-Version", LATEST_VERSION);
  response.headers.set("X-API-Supported-Versions", SUPPORTED_VERSIONS.join(", "));
}
```

### 4.2 Middleware Integration

```typescript
// src/middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveApiVersion, addVersionHeaders } from "@/lib/api-version";

export default auth(async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
    const { version, resolvedBy } = resolveApiVersion(pathname, req.headers);

    if (resolvedBy === "url") {
      const response = NextResponse.next();
      addVersionHeaders(response, version);
      return response;
    }

    if (resolvedBy === "header" || resolvedBy === "default") {
      const newUrl = new URL(req.url);
      newUrl.pathname = `/api/${version}${pathname.replace(/^\/api/, "")}`;
      const response = NextResponse.rewrite(newUrl);
      addVersionHeaders(response, version);
      return response;
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

### 4.3 Updated ApiContext

```typescript
// src/lib/middleware/api-middleware.ts
import type { ApiVersion } from "@/lib/api-version";

export interface ApiContext {
  userId: string;
  request: NextRequest;
  params?: Record<string, string>;
  apiVersion?: ApiVersion; // NEW
}

export type ApiHandler = (ctx: ApiContext, params?: Record<string, string>) => Promise<NextResponse>;
```

## 5. Migration Strategy

| Phase | Action | State |
|-------|--------|-------|
| 1 | Create `api/v1/` directory with first versioned route | Both old and new routes work |
| 2 | Add middleware for version resolution | Accept-version header works |
| 3 | Create remaining v1 routes (agents, profiles, etc.) | Gradual migration |
| 4 | Add deprecation headers to old routes | `Sunset` header on old endpoints |
| 5 | Remove old routes | Breaking change — major version bump |

## 6. Testing Strategy

- **Middleware tests**: Mock `NextRequest`, verify version resolution logic
- **Route tests**: Verify v1 routes return same data as old routes
- **Header tests**: Verify `Accept-version: v1` header rewrites correctly
- **Backward compat**: Verify old `/api/agents` still works after v1 routes exist
