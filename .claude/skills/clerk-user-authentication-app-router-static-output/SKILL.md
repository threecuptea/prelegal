---
name: clerk-user-authentication-app-router-static-output
description: Use this to write code to integrate Clerk User Authentication into App Router applications using static outputs within the React next.js v7+ framework. 
---

# Integrate Clerk User Authentication into App Router applications using static outputs within the React next.js v7+ framework

Integration with Clerk User Authentication for App Router applications using static output is treacherous ever since`@clerk/nextjs` v7+ uses Server Actions which are incompatible with `output: "export"`.  These instructions hopefully will help users cut through the weeds and navigate the paths. 

## Preconditions: 
This integration uses FastAPI as the backend. You can still apply code snippets of the frontend regardless.  Reference `clerk-backend-api` if you use Flask or Django. There are also Django-Specific Integrations.  Please look them up. 

## Setup

### Frontend
Auth is now handled client-side by @clerk/clerk-react (the pure React SDK) instead of @clerk/nextjs.  
`npm uninstall @clerk/nextjs`  
`npm install @clerk/clerk-react`

### Backend
FastAPI integration  
`pip install fastapi-clerk-auth`  
or  
`uv add fastapi-clerk-auth`

## Development environment

In development, `npm run dev` serves the Next.js frontend on `:3000` but the backend runs separately on `:8000`. Without a proxy, every `authFetch('/api/...')` call from the browser goes to `:3000/api/...` and hits a 404.

The fix is a dev-only rewrite in `next.config.ts`. The `rewrites` key is silently ignored during `npm run build` (`output: "export"` strips it), so it is safe to colocate with the static export config:

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  ...(process.env.NODE_ENV === 'development'
    ? {
        rewrites: async () => [
          { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' },
        ],
      }
    : {}),
}

export default nextConfig
```

You must run **two services simultaneously** in dev:
- `npm run dev` — Next.js dev server on `:3000` (hot reload, no static output generated)
- `uv run uvicorn main:app --reload` — FastAPI on `:8000`

Access the app via `http://localhost:3000`. In production, `npm run build` bakes a static export and FastAPI serves everything from `:8000` as a single container.

## Code snippets

### Frontend (the sending end)
#### Add `ClerkProvider` wrapper element to `app/providers.tsx` instead of `layout.tsx` which is a server component. 
Inject the publishable key via environment variable (Will explain it in a later section.).
```typescript
'use client'

import { ClerkProvider } from '@clerk/clerk-react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      {children}
    </ClerkProvider>
  )
}
```

the `app/providers.tsx` is used by `app/layout.tsx` to wrap the entire app with the `ClerkProvider`, which allows you to use Clerk's authentication features throughout your application.  
```typescript
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

#### Centralize the logic to set Authorization header with Clerk's session token and handle errors in a utility function.
To avoid repeating this logic across all API calls, we can create a utility function that automatically includes the session token in the headers and handle errors.  Here is an example of a utility function called `authFetch` in `app/lib/auth.ts`:

```typescript
export async function authFetch(
  input: string,
  init: RequestInit = {},
  getToken: () => Promise<string | null>,
): Promise<Response> {
  const token = await getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(input, { ...init, headers })
  if (res.status === 401 || res.status === 403) {
    window.location.replace('/auth')
    throw new Error('Session expired')
  }
  return res
}
```

#### Individual requests can tap into the `authFetch` utility function to make authenticated API calls to the backend.
A HTTP GET request call example:
```typescript
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/clerk-react'
import { authFetch } from './lib/auth'

export default function DocumentsPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [docs, setDocs] = useState<DocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.replace('/auth')
      return
    }
    authFetch('/api/documents', {}, getToken)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load documents')
        setDocs(await res.json())
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [isLoaded, isSignedIn, router])

  // ... render
}
```

A HTTP POST or PUT request call example:
```typescript
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/clerk-react'
import { authFetch } from './lib/auth'

export default function Chat() {
  const router = useRouter()
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [isTemplateMode, setIsTemplateMode] = useState(false)

  async function send() {
    ::
    const controller = new AbortController()
    try {
      const res = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          fields: data,
          isTemplateMode,
        }),
        signal: controller.signal,
      }, getToken)
      if (!res.ok) throw new Error(`Chat failed: ${res.status}`)
      // ...
    } catch (e) {
      // ...
    } finally {
      // ...
    }
  }

  // ... render
}
```

#### Auth page (`/app/auth/page.tsx`)
With `output: "export"`, Next.js cannot redirect to Clerk's hosted sign-in page — there is no server to handle the redirect. The solution is `mode="modal"`: Clerk renders its sign-in/sign-up UI as an overlay on top of your own page, so no navigation occurs and no server is needed.

`authFetch` redirects unauthenticated users to `/auth` on 401/403. That page must exist and render the modal buttons. Password reset, email verification, and OAuth are all handled inside the modal by Clerk — no extra pages required.

```tsx
// app/auth/page.tsx
'use client'

import { SignInButton, SignUpButton } from '@clerk/clerk-react'

export default function AuthPage() {
  return (
    <div className="flex flex-col items-center gap-4 mt-20">
      <SignInButton mode="modal">
        <button className="px-6 py-2 bg-blue-600 text-white rounded">Sign in</button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="px-6 py-2 border rounded">Create account</button>
      </SignUpButton>
    </div>
  )
}
```

#### Displaying user info and sign-out
Use `useUser()` to read profile data (email, name) and `SignOutButton` to sign out. `useAuth()` gives auth state and `getToken`; `useUser()` gives the user object. Both are from `@clerk/clerk-react`.

```tsx
import { useUser, SignOutButton } from '@clerk/clerk-react'

export default function AppHeader() {
  const { user } = useUser()

  return (
    <header className="flex items-center justify-between p-4">
      <span>{user?.primaryEmailAddress?.emailAddress}</span>
      <SignOutButton>
        <button>Sign out</button>
      </SignOutButton>
    </header>
  )
}
```

### Backend (the receiving end)
#### FastAPI Example
It depends on `fastapi-clerk-auth` which provides a convenient way to authenticate requests using Clerk's JWT tokens.  The `get_current_account` function is an example of how to use the `ClerkHTTPBearer` dependency to authenticate incoming requests and retrieve the user's account information.  The `_upsert_account_sync` function is a placeholder for your actual database logic to upsert the account based on the `clerk_sub` and `email` if needed.

```python
import asyncio
import os
from fastapi import Depends, HTTPException
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()
_jwks_url = os.getenv("CLERK_JWKS_URL", "")
clerk_config = ClerkConfig(jwks_url=_jwks_url or "https://placeholder.invalid/.well-known/jwks.json")
clerk_guard = ClerkHTTPBearer(clerk_config)

def _upsert_account_sync(clerk_sub: str, email: str) -> dict:
    # Synchronous function to upsert account in the database 
    # Replace this with your actual database logic
async def get_current_account(
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
) -> dict:
    if not creds or not creds.decoded:
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    clerk_sub: str = creds.decoded.get("sub", "")
    if not clerk_sub:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub")
    email: str = creds.decoded.get("email", "")
    return await asyncio.to_thread(_upsert_account_sync, clerk_sub, email)

```

## Required Clerk Dashboard configuration

### Customize session token to include email
By default, Clerk's session JWT does **not** include an `email` claim. Without this step, `creds.decoded.get("email", "")` on the backend will always return an empty string — a silent failure that is hard to debug.

Go to **Clerk Dashboard → Configure → Sessions → Customize session token** and add the following under Claims:
```json
{
  "email": "{{user.primary_email_address}}",
  "email_verified": "{{user.email_verified}}"
}
```

Once saved, all new session tokens will include the `email` and `email_verified` fields, which the backend can read from `creds.decoded`.

## Clerk environment variables injection
### Inject Clerk publishable key (CLERK_PUBLISHABLE_KEY or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in the case of Next.js) into your frontend environment variables. 
This key is necessary for the `ClerkProvider` to function properly and enable user authentication in your frontend application.

#### In Development, 
you can create a `.env.local` file in the root of your Next.js project and add the following line, replacing `your_publishable_key_here` with your actual Clerk publishable key:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key_here
```
`npm run dev` will exposes these variables live to your local development server.

#### In Production
you have to inject the `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` as an environment variable during the build process for security reasons.  
`npm run build` will replace `process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` with the environment variable of the build process.
Here is an example of how you can get a container deployment with Terraform to inject environment variables during build time:
In Terraform`main.tf`
```hcl
# Build Docker image
resource "docker_image" "app" {
  name = "${var.region}-docker.pkg.dev/${var.project_id}/${var.service_name}/${var.service_name}:${var.docker_image_tag}"

  build {
    context    = "${path.module}/../.."
    dockerfile = "Dockerfile"
    platform   = "linux/amd64"
    no_cache   = true
    build_args = {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = var.clerk_publishable_key
    }
  }
}
```
Make sure to set `clerk_publishable_key` in your Terraform variables, and it will be passed as a build argument during the Docker image build process.  In your `Dockerfile`, you can then use this build argument to set the environment variable for your Next.js application:
```Dockerfile
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```

### Inject `CLERK_JWKS_URL` into your backend environment variables.
This URL is necessary for the backend to verify the JWT tokens sent by the frontend. 

#### In Development
you can create a `.env` file in the root of your backend project or the very project root and add the following line, replacing `your_jwks_url_here` with your actual Clerk JWKS URL:  
```
CLERK_JWKS_URL=your_jwks_url_here
```
#### In Production
you have to inject the `CLERK_JWKS_URL` as an environment variable into your deployment component.
Here is an example of how you can get GCP Cloud Run to inject environment variables via Terraform work:  
In Terraform`main.tf`
```hcl
# Deploy to Cloud Run
resource "google_cloud_run_service" "app" {
  name     = var.service_name
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.cloud_run.email

      containers {
        image = docker_image.app.name
        # for postgresql memory 
        resources {
          limits = {
            cpu    = "1"
            memory = "2Gi"
          }
        }
        env {
          name  = "CLERK_JWKS_URL"
          value = var.clerk_jwks_url
        }
        # ... other environment variables ...
        ports {
          container_port = 8000
        }
      }
    } # the end of spec
    # ... other template fields like metadata, etc. ...
  } # end of template
  # ... other Cloud Run service fields like traffic or depends_on, etc. ...
   
} # end of Cloud Run service
```
make sure to set `clerk_jwks_url` in your Terraform variables, and it will be passed as an environment variable to your Cloud Run service.