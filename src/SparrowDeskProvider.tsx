import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_READY_TIMEOUT_MS,
  DEFAULT_SCRIPT_SRC,
  acquireWidgetScript,
  isBrowser,
  normalizeRequired,
  removeOtherWidgetScripts,
  setWidgetGlobals,
  waitForSparrowDeskApi,
} from './internal/sparrowDeskWidget'
import { useLatest } from './internal/useLatest'

export type SparrowDeskProviderProps = {
  /** SparrowDesk domain, e.g. "sparrowdesk7975310.sparrowdesk.com" */
  domain: string
  /** SparrowDesk widget token */
  token: string

  children: React.ReactNode

  /**
   * Controls whether this provider should set globals and inject the widget script.
   * Set to `false` if SparrowDesk is loaded elsewhere (e.g. via Segment) and you only
   * want the hook-based API.
   */
  shouldInitialize?: boolean

  tags?: string[]
  contactFields?: Record<string, unknown>
  conversationFields?: Record<string, unknown>

  onReady?: (api: SparrowDeskProps) => void
  onOpen?: () => void
  onClose?: () => void

  openOnInit?: boolean
  hideOnInit?: boolean

  cleanupOnUnmount?: boolean
  readyTimeoutMs?: number
}

export type SparrowDeskContextValue = {
  isReady: boolean
  api: SparrowDeskProps | null
  openWidget: () => void
  closeWidget: () => void
  hideWidget: () => void
  setTags: (tags: string[]) => void
  setContactFields: (fields: Record<string, unknown>) => void
  setConversationFields: (fields: Record<string, unknown>) => void
}

const SparrowDeskContext = React.createContext<SparrowDeskContextValue | null>(null)

export function useSparrowDesk(): SparrowDeskContextValue {
  const value = React.useContext(SparrowDeskContext)
  if (!value) {
    throw new Error('useSparrowDesk must be used within <SparrowDeskProvider />')
  }
  return value
}

export function SparrowDeskProvider({
  domain,
  token,
  children,
  shouldInitialize = true,
  tags,
  contactFields,
  conversationFields,
  onReady,
  onOpen,
  onClose,
  openOnInit = false,
  hideOnInit = false,
  cleanupOnUnmount = false,
  readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
}: SparrowDeskProviderProps) {
  const normalized = useMemo(() => {
    return {
      domain: normalizeRequired(domain),
      token: normalizeRequired(token),
    }
  }, [domain, token])

  const onReadyRef = useLatest(onReady)
  const onOpenRef = useLatest(onOpen)
  const onCloseRef = useLatest(onClose)

  const apiRef = useRef<SparrowDeskProps | null>(null)
  const registeredCallbacksRef = useRef(false)
  const didOpenOnceRef = useRef(false)
  const didHideOnceRef = useRef(false)

  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    didOpenOnceRef.current = false
    didHideOnceRef.current = false
    apiRef.current = null
    registeredCallbacksRef.current = false
    setIsReady(false)
  }, [normalized.domain, normalized.token])

  useEffect(() => {
    if (!isBrowser()) return
    if (!normalized.domain || !normalized.token) return

    // Always set globals; the embed snippet expects these.
    setWidgetGlobals(normalized.domain, normalized.token)

    if (!shouldInitialize) return

    removeOtherWidgetScripts(DEFAULT_SCRIPT_SRC)
    const handle = acquireWidgetScript(DEFAULT_SCRIPT_SRC, cleanupOnUnmount)

    return () => {
      handle.release()
    }
  }, [normalized.domain, normalized.token, cleanupOnUnmount, shouldInitialize])

  useEffect(() => {
    if (!isBrowser()) return
    if (!normalized.domain || !normalized.token) return

    let cancelled = false

      ; (async () => {
        const api = await waitForSparrowDeskApi(readyTimeoutMs)
        if (cancelled || !api) return

        apiRef.current = api
        setIsReady(true)

        if (!registeredCallbacksRef.current) {
          api.onOpen?.(() => onOpenRef.current?.())
          api.onClose?.(() => onCloseRef.current?.())
          registeredCallbacksRef.current = true
        }

        onReadyRef.current?.(api)

        if (Array.isArray(tags) && tags.length) api.setTags?.(tags)
        if (contactFields && Object.keys(contactFields).length) api.setContactFields?.(contactFields)
        if (conversationFields && Object.keys(conversationFields).length)
          api.setConversationFields?.(conversationFields)

        if (hideOnInit && !didHideOnceRef.current) {
          api.hideWidget?.()
          didHideOnceRef.current = true
        }
        if (openOnInit && !didOpenOnceRef.current) {
          api.openWidget?.()
          didOpenOnceRef.current = true
        }
      })()

    return () => {
      cancelled = true
    }
  }, [
    normalized.domain,
    normalized.token,
    openOnInit,
    hideOnInit,
    readyTimeoutMs,
  ])

  // Apply updates to tags/fields without re-waiting for the API.
  useEffect(() => {
    const api = apiRef.current
    if (!api) return

    if (Array.isArray(tags) && tags.length) api.setTags?.(tags)
    if (contactFields && Object.keys(contactFields).length) api.setContactFields?.(contactFields)
    if (conversationFields && Object.keys(conversationFields).length)
      api.setConversationFields?.(conversationFields)
  }, [tags, contactFields, conversationFields])

  const methods = useMemo<Omit<SparrowDeskContextValue, 'isReady' | 'api'>>(() => {
    return {
      openWidget: () => apiRef.current?.openWidget?.(),
      closeWidget: () => apiRef.current?.closeWidget?.(),
      hideWidget: () => apiRef.current?.hideWidget?.(),
      setTags: (t) => apiRef.current?.setTags?.(t),
      setContactFields: (f) => apiRef.current?.setContactFields?.(f),
      setConversationFields: (f) => apiRef.current?.setConversationFields?.(f),
    }
  }, [])

  const value = useMemo<SparrowDeskContextValue>(() => {
    return {
      ...methods,
      isReady,
      api: apiRef.current,
    }
  }, [methods, isReady])

  return <SparrowDeskContext.Provider value={value}>{children}</SparrowDeskContext.Provider>
}


