declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface SparrowDeskApi {
    openWidget?: () => void
    closeWidget?: () => void
    hideWidget?: () => void
    onOpen?: (callback: () => void) => void
    onClose?: (callback: () => void) => void
    setTags?: (tags: string[]) => void
    setConversationFields?: (fields: Record<string, unknown>) => void
    setContactFields?: (fields: Record<string, unknown>) => void
    status?: 'open' | 'closed'
  }

  interface Window {
    SD_WIDGET_TOKEN?: string
    SD_WIDGET_DOMAIN?: string
    sparrowDesk?: SparrowDeskApi
  }
}

export const DEFAULT_SCRIPT_SRC = 'https://assets.cdn.sparrowdesk.com/chatbot/bundle/main.js'
export const DEFAULT_READY_TIMEOUT_MS = 10_000
export const WIDGET_SCRIPT_SELECTOR = 'script[data-sd-chat-widget="true"]'

export function isBrowser() {
  return (globalThis as unknown as { document?: Document }).document !== undefined
}

export function normalizeRequired(value: string) {
  return value.trim()
}

export function setWidgetGlobals(domain: string, token: string) {
  const w = globalThis as unknown as Window
  w.SD_WIDGET_DOMAIN = domain
  w.SD_WIDGET_TOKEN = token
}

type ScriptEntry = {
  script: HTMLScriptElement
  refCount: number
  cleanupWhenUnused: boolean
}

const scriptEntriesBySrc = new Map<string, ScriptEntry>()

export function removeOtherWidgetScripts(keepSrc: string) {
  const existing = document.querySelectorAll<HTMLScriptElement>(WIDGET_SCRIPT_SELECTOR)
  existing.forEach((script) => {
    if (script.src !== keepSrc) script.remove()
  })
}

export function acquireWidgetScript(src: string, cleanupOnUnmount: boolean) {
  const cached = scriptEntriesBySrc.get(src)
  if (cached) {
    cached.refCount += 1
    cached.cleanupWhenUnused ||= cleanupOnUnmount
    return {
      release() {
        cached.refCount -= 1
        if (cached.refCount > 0) return
        if (cached.cleanupWhenUnused) cached.script.remove()
        scriptEntriesBySrc.delete(src)
      },
    }
  }

  // Reuse an existing script tag if it already exists on the page.
  const existing = document.querySelector<HTMLScriptElement>(WIDGET_SCRIPT_SELECTOR)
  const script =
    existing?.src === src
      ? existing
      : (() => {
          const el = document.createElement('script')
          el.async = true
          el.src = src
          el.dataset['sdChatWidget'] = 'true'
          document.body.appendChild(el)
          return el
        })()

  const entry: ScriptEntry = { script, refCount: 1, cleanupWhenUnused: cleanupOnUnmount }
  scriptEntriesBySrc.set(src, entry)

  return {
    release() {
      entry.refCount -= 1
      if (entry.refCount > 0) return
      if (entry.cleanupWhenUnused) entry.script.remove()
      scriptEntriesBySrc.delete(src)
    },
  }
}

export async function waitForSparrowDeskApi(timeoutMs: number): Promise<SparrowDeskApi | null> {
  const w = globalThis as unknown as Window

  // Fast path: already available.
  if (w.sparrowDesk) return w.sparrowDesk
  if (timeoutMs <= 0) return null

  const startedAt = Date.now()

  // Poll for availability; the external script defines this global.
  while (Date.now() - startedAt < timeoutMs) {
    if (w.sparrowDesk) return w.sparrowDesk
    await new Promise((r) => setTimeout(r, 50))
  }
  return null
}
