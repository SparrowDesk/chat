# SparrowDesk Chat Widget

A monorepo for SparrowDesk chat widget bindings across frameworks (React, Vue, Solid, Vite, etc.), inspired by [TanStack Table](https://github.com/TanStack/table).

## Packages

| Package | Description |
|---------|-------------|
| `@sparrowdesk/react-chat` | React bindings for the SparrowDesk chat widget |

## React (`@sparrowdesk/react-chat`)

A small React abstraction around the SparrowDesk chat widget embed snippet. It loads the widget script once, sets the required globals (`SD_WIDGET_DOMAIN`, `SD_WIDGET_TOKEN`), and provides a React-friendly API for setting tags + contact/conversation fields and listening to open/close events.

This README is inspired by the structure used in [`react-use-intercom`'s README](https://raw.githubusercontent.com/devrnt/react-use-intercom/refs/heads/main/packages/react-use-intercom/README.md).

## Features
- **Tiny wrapper**: injects the SparrowDesk widget script once and dedupes subsequent mounts
- **SSR-safe**: does nothing when `window` / `document` are unavailable
- **TypeScript**: fully typed `ChatProps`
- **Fields API**: set `contactFields` and `conversationFields` on init (by `internal_name`)
- **Events**: `onOpen`, `onClose`, and `onReady` when `window.sparrowDesk` becomes available
- **Performance-friendly**: optionally defer widget initialization until user interaction

## Installation

```sh
# pnpm
pnpm add @sparrowdesk/react-chat

# npm
npm install @sparrowdesk/react-chat

# yarn
yarn add @sparrowdesk/react-chat
```

## Quickstart

```tsx
import * as React from 'react'
import { Chat } from '@sparrowdesk/react-chat'

export function App() {
  return (
    <Chat
      domain="sparrowdesk7975310.sparrowdesk.com"
      token="YOUR_WIDGET_TOKEN"
      openOnInit
    />
  )
}
```

## Provider + Hook (hybrid)

If you want to control the widget from anywhere in your app (open/close/hide, set fields/tags), wrap your tree with `SparrowDeskProvider` and use `useSparrowDesk()`.

```tsx
import * as React from 'react'
import { SparrowDeskProvider, useSparrowDesk } from '@sparrowdesk/react-chat'

const HomePage = () => {
  const { openWidget, closeWidget, hideWidget, setTags } = useSparrowDesk()

  return (
    <>
      <button onClick={() => openWidget()}>Open</button>
      <button onClick={() => closeWidget()}>Close</button>
      <button onClick={() => hideWidget()}>Hide</button>
      <button onClick={() => setTags(['vip'])}>Set tags</button>
    </>
  )
}

export function App() {
  return (
    <SparrowDeskProvider
      domain="sparrowdesk7975310.sparrowdesk.com"
      token="YOUR_WIDGET_TOKEN"
      openOnInit
    >
      <HomePage />
    </SparrowDeskProvider>
  )
}
```

## Next.js

### App Router (`app/`) usage

In the App Router, components are Server Components by default. Since `Chat` uses hooks, render it from a Client Component.

```tsx
'use client'

import * as React from 'react'
import { Chat } from '@sparrowdesk/react-chat'

export function SparrowDeskChat() {
  return (
    <Chat
      domain={process.env.NEXT_PUBLIC_SD_DOMAIN!}
      token={process.env.NEXT_PUBLIC_SD_TOKEN!}
    />
  )
}
```

Then include it somewhere in your tree (for example in `app/layout.tsx`):

```tsx
import * as React from 'react'
import { SparrowDeskChat } from './SparrowDeskChat'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SparrowDeskChat />
      </body>
    </html>
  )
}
```

### Pages Router (`pages/`) usage (optional `ssr: false`)

If you prefer to ensure the component only renders client-side, you can dynamically import it:

```tsx
import dynamic from 'next/dynamic'

export const SparrowDeskChat = dynamic(() => import('../components/SparrowDeskChat'), {
  ssr: false,
})
```

## API

### `Chat`

`Chat` loads the SparrowDesk widget script and wires up the widget globals + API once available.

#### Props

| name | type | required | default | description |
|---|---:|:---:|---:|---|
| `domain` | `string` | ✅ |  | SparrowDesk domain, e.g. `sparrowdesk7975310.sparrowdesk.com` |
| `token` | `string` | ✅ |  | SparrowDesk widget token |
| `tags` | `string[]` |  |  | Calls `window.sparrowDesk.setTags(tags)` when ready |
| `contactFields` | `Record<string, unknown>` |  |  | Calls `window.sparrowDesk.setContactFields(contactFields)` when ready |
| `conversationFields` | `Record<string, unknown>` |  |  | Calls `window.sparrowDesk.setConversationFields(conversationFields)` when ready |
| `onReady` | `(api) => void` |  |  | Called once `window.sparrowDesk` is available |
| `onOpen` | `() => void` |  |  | Registered via `window.sparrowDesk.onOpen(...)` |
| `onClose` | `() => void` |  |  | Registered via `window.sparrowDesk.onClose(...)` |
| `openOnInit` | `boolean` |  | `false` | Calls `window.sparrowDesk.openWidget()` when ready |
| `hideOnInit` | `boolean` |  | `false` | Calls `window.sparrowDesk.hideWidget()` when ready |
| `connectOnPageLoad` | `boolean` |  | `true` | If `false`, defers injecting the widget script + waiting for the API until the visitor interacts (when `initializeOnInteraction` is enabled) |
| `initializeOnInteraction` | `boolean` |  | `true` | When `connectOnPageLoad={false}`, initialize on the first `pointerdown` / `keydown` |
| `readyTimeoutMs` | `number` |  | `10000` | How long to wait for `window.sparrowDesk` to appear |
| `cleanupOnUnmount` | `boolean` |  | `false` | If true, removes the injected script tag on unmount |

#### Example: set conversation + contact fields

> SparrowDesk validates values on its side; invalid `internal_name` keys or invalid values are skipped by the widget.

```tsx
import * as React from 'react'
import { Chat } from '@sparrowdesk/react-chat'

export function App() {
  return (
    <Chat
      domain="sparrowdesk7975310.sparrowdesk.com"
      token="YOUR_WIDGET_TOKEN"
      tags={['vip', 'returning-user']}
      contactFields={{
        full_name: 'Bot',
        nick_name: 'Dave',
      }}
      conversationFields={{
        priority: 'med',
        status: 'todo',
        request_type: 'ENQUIRY',
      }}
      onOpen={() => console.log('Widget opened')}
      onClose={() => console.log('Widget closed')}
    />
  )
}
```

#### Example: imperative control via `onReady`

```tsx
import * as React from 'react'
import { Chat } from '@sparrowdesk/react-chat'

export function App() {
  return (
    <>
      <Chat
        domain="sparrowdesk7975310.sparrowdesk.com"
        token="YOUR_WIDGET_TOKEN"
        onReady={(api) => {
          // e.g. open immediately, or based on your own logic
          api.openWidget?.()
        }}
      />
      <button onClick={() => globalThis.sparrowDesk?.openWidget?.()}>Open</button>
      <button onClick={() => globalThis.sparrowDesk?.closeWidget?.()}>Close</button>
      <button onClick={() => globalThis.sparrowDesk?.hideWidget?.()}>Hide</button>
    </>
  )
}
```

## Performance: defer initialization until user interaction

If you want to avoid loading the widget script on initial page load, you can defer initialization until the visitor interacts.
This is implemented by delaying script injection.

### Option A: `Chat` (auto-init on first interaction)

```tsx
<Chat
  domain="sparrowdesk7975310.sparrowdesk.com"
  token="YOUR_WIDGET_TOKEN"
  connectOnPageLoad={false}
  initializeOnInteraction
/>
```

### Option B: Provider + Hook (manual control)

```tsx
function HelpButton() {
  const { openWidget } = useSparrowDesk()
  return <button onClick={() => openWidget()}>Chat</button>
}

<SparrowDeskProvider
  domain="sparrowdesk7975310.sparrowdesk.com"
  token="YOUR_WIDGET_TOKEN"
  connectOnPageLoad={false}
>
  <HelpButton />
</SparrowDeskProvider>
```

## Development

```sh
# install deps
pnpm install

# build all packages
pnpm run build

# run React example (playground)
pnpm run play

# run tests (browser-based; run once: pnpm run test:prepare)
pnpm run test

# typecheck
pnpm run typecheck
```

If tests fail with a Playwright browser error, run `pnpm run test:prepare` to install Chromium.

### Project structure

```
packages/
  react-chat/     # @sparrowdesk/react-chat – React bindings
examples/
  react/          # React example / playground
```
