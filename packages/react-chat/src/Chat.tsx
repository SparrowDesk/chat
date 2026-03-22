import type { FC } from 'react'
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

export interface ChatProps {
  /** SparrowDesk domain, e.g. "your-workspace.sparrowdesk.com" */
  domain: string
  /** SparrowDesk widget token */
  token: string

  /** Optional tags (e.g. user identifiers) for the current session. */
  tags?: string[]

  /**
   * Contact fields to set during init (expects internal_name keys).
   * Invalid internal_names / invalid values are skipped by the widget itself.
   */
  contactFields?: Record<string, unknown>

  /**
   * Conversation fields to set during init (expects internal_name keys).
   * Invalid internal_names / invalid values are skipped by the widget itself.
   */
  conversationFields?: Record<string, unknown>

  /** Called once the widget API is available on `window.sparrowDesk`. */
  onReady?: (api: SparrowDeskApi) => void
  /** Called when the widget opens (registered via `window.sparrowDesk.onOpen`). */
  onOpen?: () => void
  /** Called when the widget closes (registered via `window.sparrowDesk.onClose`). */
  onClose?: () => void

  /** If true, calls `window.sparrowDesk.openWidget()` once when ready. */
  openOnInit?: boolean
  /** If true, calls `window.sparrowDesk.hideWidget()` once when ready. */
  hideOnInit?: boolean

  /**
   * Controls whether this component should set globals and inject the widget script.
   * Set to `false` if SparrowDesk is loaded elsewhere and you only want to apply
   * fields/tags + register callbacks.
   */
  shouldInitialize?: boolean

  /**
   * If `false`, defers injecting the widget script + waiting for the API until
   * the visitor interacts (when `initializeOnInteraction` is enabled).
   *
   * This is a performance optimization implemented at the wrapper level by delaying
   * script injection.
   */
  connectOnPageLoad?: boolean

  /**
   * When `connectOnPageLoad={false}`, if `true`, initialize the widget on the first
   * user interaction (pointer or keyboard), then remove those listeners.
   */
  initializeOnInteraction?: boolean

  /** If true, removes the injected script tag on unmount. */
  cleanupOnUnmount?: boolean

  /**
   * How long to wait (ms) for `window.sparrowDesk` to become available after init.
   * Defaults to 10s.
   */
  readyTimeoutMs?: number
}

export const Chat: FC<ChatProps> = ({
  domain,
  token,
  tags,
  contactFields,
  conversationFields,
  onReady,
  onOpen,
  onClose,
  openOnInit = false,
  hideOnInit = false,
  shouldInitialize = true,
  connectOnPageLoad = true,
  initializeOnInteraction = true,
  cleanupOnUnmount = false,
  readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
}) => {
  const normalized = useMemo(() => {
    return {
      domain: normalizeRequired(domain),
      token: normalizeRequired(token),
    }
  }, [domain, token])

  const onOpenRef = useLatest(onOpen)
  const onCloseRef = useLatest(onClose)
  const onReadyRef = useLatest(onReady)
  const tagsRef = useLatest(tags)
  const contactFieldsRef = useLatest(contactFields)
  const conversationFieldsRef = useLatest(conversationFields)

  const registeredCallbacksRef = useRef(false)
  const apiRef = useRef<SparrowDeskApi | null>(null)
  const didOpenOnceRef = useRef(false)
  const didHideOnceRef = useRef(false)
  const [shouldStart, setShouldStart] = useState(connectOnPageLoad)

  useEffect(() => {
    setShouldStart(connectOnPageLoad)
  }, [connectOnPageLoad])

  useEffect(() => {
    didOpenOnceRef.current = false
    didHideOnceRef.current = false
    apiRef.current = null
    registeredCallbacksRef.current = false
    setShouldStart(connectOnPageLoad)
  }, [normalized.domain, normalized.token, connectOnPageLoad])

  useEffect(() => {
    if (!isBrowser()) return
    if (!normalized.domain || !normalized.token) return

    // Always set globals; the embed snippet expects these.
    setWidgetGlobals(normalized.domain, normalized.token)

    if (!shouldInitialize) return
    if (!shouldStart) return

    // Keep only one SparrowDesk widget script on the page for this wrapper.
    removeOtherWidgetScripts(DEFAULT_SCRIPT_SRC)
    const handle = acquireWidgetScript(DEFAULT_SCRIPT_SRC, cleanupOnUnmount)

    return () => {
      handle.release()
    }
  }, [normalized.domain, normalized.token, cleanupOnUnmount, shouldInitialize, shouldStart])

  useEffect(() => {
    if (!isBrowser()) return
    if (!normalized.domain || !normalized.token) return
    if (!shouldStart) return

    let cancelled = false

      ; (async () => {
        const api = await waitForSparrowDeskApi(readyTimeoutMs)
        if (cancelled || !api) return

        apiRef.current = api

        // Register open/close callbacks once, but call the latest prop via refs.
        if (!registeredCallbacksRef.current) {
          api.onOpen?.(() => onOpenRef.current?.())
          api.onClose?.(() => onCloseRef.current?.())
          registeredCallbacksRef.current = true
        }

        onReadyRef.current?.(api)

        // Apply init-time defaults once the API is available (use refs for latest values).
        const latestTags = tagsRef.current
        const latestContactFields = contactFieldsRef.current
        const latestConversationFields = conversationFieldsRef.current
        if (Array.isArray(latestTags) && latestTags.length) api.setTags?.(latestTags)
        if (latestContactFields && Object.keys(latestContactFields).length)
          api.setContactFields?.(latestContactFields)
        if (latestConversationFields && Object.keys(latestConversationFields).length)
          api.setConversationFields?.(latestConversationFields)

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
    shouldStart,
  ])

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

  // If tags/fields change after init, apply them without re-waiting for the API.
  useEffect(() => {
    const api = apiRef.current
    if (!api) return

    if (Array.isArray(tags) && tags.length) api.setTags?.(tags)
    if (contactFields && Object.keys(contactFields).length) api.setContactFields?.(contactFields)
    if (conversationFields && Object.keys(conversationFields).length)
      api.setConversationFields?.(conversationFields)
  }, [tags, contactFields, conversationFields])

  // This component renders nothing itself; the widget UI is injected by the loaded script.
  if (!normalized.domain || !normalized.token) return null
  return <div data-sd-chat-widget-container="" />
}
