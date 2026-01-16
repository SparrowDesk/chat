# SparrowDesk Chat Widget (React)

A small React abstraction around the SparrowDesk chat widget embed snippet. It loads the widget script once, sets the required globals (`SD_WIDGET_DOMAIN`, `SD_WIDGET_TOKEN`), and provides a React-friendly API for setting tags + contact/conversation fields and listening to open/close events.

This README is inspired by the structure used in [`react-use-intercom`'s README](https://raw.githubusercontent.com/devrnt/react-use-intercom/refs/heads/main/packages/react-use-intercom/README.md).

## Features
- **Tiny wrapper**: injects the SparrowDesk widget script once and dedupes subsequent mounts
- **SSR-safe**: does nothing when `window` / `document` are unavailable
- **TypeScript**: fully typed `ChatProps`
- **Fields API**: set `contactFields` and `conversationFields` on init (by `internal_name`)
- **Events**: `onOpen`, `onClose`, and `onReady` when `window.sparrowDesk` becomes available

## Installation

```sh
# pnpm
pnpm add @sparrowdesk/chat-react

# npm
npm install @sparrowdesk/chat-react

# yarn
yarn add @sparrowdesk/chat-react
```

## Quickstart

```tsx
import * as React from 'react'
import { Chat } from '@sparrowdesk/chat-react'

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
import { SparrowDeskProvider, useSparrowDesk } from '@sparrowdesk/chat-react'

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
| `readyTimeoutMs` | `number` |  | `10000` | How long to wait for `window.sparrowDesk` to appear |
| `cleanupOnUnmount` | `boolean` |  | `false` | If true, removes the injected script tag on unmount |

#### Example: set conversation + contact fields

> SparrowDesk validates values on its side; invalid `internal_name` keys or invalid values are skipped by the widget.

```tsx
import * as React from 'react'
import { Chat } from '@sparrowdesk/chat-react'

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
import { Chat } from '@sparrowdesk/chat-react'

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

## Development

```sh
# install deps
pnpm install

# run playground
pnpm run play

# run tests
pnpm run test

# build library
pnpm run build
```
