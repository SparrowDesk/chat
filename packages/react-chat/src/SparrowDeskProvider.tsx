import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type SparrowDeskApi,
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
  /** SparrowDesk domain, e.g. "your-workspace.sparrowdesk.com" */
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

  /**
   * If `false`, defers injecting the widget script + waiting for the API until
   * you call `initialize()` (or invoke `openWidget`/`closeWidget`/`hideWidget`/etc),
   * or until the first user interaction when `initializeOnInteraction` is enabled.
   *
   * This is a performance optimization implemented at the wrapper level by delaying
   * script injection until you explicitly initialize.
   */
  connectOnPageLoad?: boolean

  /**
   * When `connectOnPageLoad={false}`, if `true`, initialize on the first
   * user interaction (pointer or keyboard). Defaults to `true`.
   */
  initializeOnInteraction?: boolean

  tags?: string[]
  contactFields?: Record<string, unknown>
  conversationFields?: Record<string, unknown>

  onReady?: (api: SparrowDeskApi) => void
  onOpen?: () => void
  onClose?: () => void

  openOnInit?: boolean
  hideOnInit?: boolean

  cleanupOnUnmount?: boolean
  readyTimeoutMs?: number
}

export type SparrowDeskContextValue = {
  isReady: boolean
  api: SparrowDeskApi | null
  /** Ensures the widget script is injected (if enabled) and begins waiting for the API. */
  initialize: () => void
  openWidget: () => void
  closeWidget: () => void
  hideWidget: () => void
  setTags: (tags: string[]) => void
  setContactFields: (fields: Record<string, unknown>) => void
  setConversationFields: (fields: Record<string, unknown>) => void
}

const SparrowDeskContext = React.createContext<SparrowDeskContextValue | null>(null)

/** Bound pending calls while the widget API is loading (avoids unbounded memory if init never completes). */
const MAX_PENDING_API_CALLS = 50

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
  connectOnPageLoad = true,
  initializeOnInteraction = true,
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
  const tagsRef = useLatest(tags)
  const contactFieldsRef = useLatest(contactFields)
  const conversationFieldsRef = useLatest(conversationFields)
  const openOnInitRef = useLatest(openOnInit)
  const hideOnInitRef = useLatest(hideOnInit)

  const apiRef = useRef<SparrowDeskApi | null>(null)
  const registeredCallbacksRef = useRef(false)
  const didOpenOnceRef = useRef(false)
  const didHideOnceRef = useRef(false)
  const scriptHandleRef = useRef<ReturnType<typeof acquireWidgetScript> | null>(null)
  const initStartedRef = useRef(false)
  const initCancelRef = useRef<(() => void) | null>(null)
  const pendingCallsRef = useRef<Array<(api: SparrowDeskApi) => void>>([])

  const [isReady, setIsReady] = useState(false)
  const [shouldStart, setShouldStart] = useState(connectOnPageLoad)

  useEffect(() => {
    setShouldStart(connectOnPageLoad)
  }, [connectOnPageLoad])

  useEffect(() => {
    didOpenOnceRef.current = false
    didHideOnceRef.current = false
    apiRef.current = null
    registeredCallbacksRef.current = false
    initStartedRef.current = false
    initCancelRef.current?.()
    initCancelRef.current = null
    pendingCallsRef.current = []
    scriptHandleRef.current?.release()
    scriptHandleRef.current = null
    setIsReady(false)
    setShouldStart(connectOnPageLoad)
  }, [normalized.domain, normalized.token, connectOnPageLoad])

  const initialize = React.useCallback(() => {
    if (!isBrowser()) return
    if (!normalized.domain || !normalized.token) return

    // Always set globals; the embed snippet expects these.
    setWidgetGlobals(normalized.domain, normalized.token)

    // Inject the script if this wrapper is responsible for initialization.
    if (shouldInitialize && !scriptHandleRef.current) {
      removeOtherWidgetScripts(DEFAULT_SCRIPT_SRC)
      scriptHandleRef.current = acquireWidgetScript(DEFAULT_SCRIPT_SRC, cleanupOnUnmount)
    }

    // Begin waiting for the API once per (domain, token) pair.
    if (initStartedRef.current) return
    initStartedRef.current = true

    let cancelled = false
    initCancelRef.current = () => {
      cancelled = true
    }

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

        const latestTags = tagsRef.current
        const latestContactFields = contactFieldsRef.current
        const latestConversationFields = conversationFieldsRef.current
        if (Array.isArray(latestTags) && latestTags.length) api.setTags?.(latestTags)
        if (latestContactFields && Object.keys(latestContactFields).length)
          api.setContactFields?.(latestContactFields)
        if (latestConversationFields && Object.keys(latestConversationFields).length)
          api.setConversationFields?.(latestConversationFields)

        if (hideOnInitRef.current && !didHideOnceRef.current) {
          api.hideWidget?.()
          didHideOnceRef.current = true
        }
        if (openOnInitRef.current && !didOpenOnceRef.current) {
          api.openWidget?.()
          didOpenOnceRef.current = true
        }

        const pending = pendingCallsRef.current
        pendingCallsRef.current = []
        pending.forEach((fn) => fn(api))
      })()
  }, [
    cleanupOnUnmount,
    normalized.domain,
    normalized.token,
    readyTimeoutMs,
    shouldInitialize,
  ])

  useEffect(() => {
    if (!isBrowser()) return
    if (!normalized.domain || !normalized.token) return
    setWidgetGlobals(normalized.domain, normalized.token)
    if (!shouldStart) return
    initialize()
    return () => {
      initCancelRef.current?.()
      initCancelRef.current = null
      // If we cancelled before becoming ready, allow a new initialize() call to restart polling.
      if (!apiRef.current) initStartedRef.current = false
      scriptHandleRef.current?.release()
      scriptHandleRef.current = null
    }
  }, [initialize, normalized.domain, normalized.token, shouldStart])

  useEffect(() => {
    if (!isBrowser()) return
    if (connectOnPageLoad) return
    if (!initializeOnInteraction) return
    if (shouldStart) return
    if (!normalized.domain || !normalized.token) return

    const onFirstInteraction = () => {
      setShouldStart(true)
      cleanup()
    }

    const cleanup = () => {
      document.removeEventListener('pointerdown', onFirstInteraction, true)
      document.removeEventListener('keydown', onFirstInteraction, true)
    }

    document.addEventListener('pointerdown', onFirstInteraction, true)
    document.addEventListener('keydown', onFirstInteraction, true)

    return cleanup
  }, [
    connectOnPageLoad,
    initializeOnInteraction,
    normalized.domain,
    normalized.token,
    shouldStart,
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
    const callOrQueue = (fn: (api: SparrowDeskApi) => void) => {
      const api = apiRef.current
      if (api) {
        fn(api)
        return
      }
      // Queue whenever the API is not ready yet (including connectOnPageLoad=true + slow load).
      initialize()
      if (pendingCallsRef.current.length < MAX_PENDING_API_CALLS) {
        pendingCallsRef.current.push(fn)
      }
    }

    return {
      initialize,
      openWidget: () => callOrQueue((api) => api.openWidget?.()),
      closeWidget: () => callOrQueue((api) => api.closeWidget?.()),
      hideWidget: () => callOrQueue((api) => api.hideWidget?.()),
      setTags: (t) => callOrQueue((api) => api.setTags?.(t)),
      setContactFields: (f) => callOrQueue((api) => api.setContactFields?.(f)),
      setConversationFields: (f) => callOrQueue((api) => api.setConversationFields?.(f)),
    }
  }, [initialize])

  const value = useMemo<SparrowDeskContextValue>(() => {
    return {
      ...methods,
      isReady,
      api: apiRef.current,
    }
  }, [methods, isReady])

  return <SparrowDeskContext.Provider value={value}>{children}</SparrowDeskContext.Provider>
}
