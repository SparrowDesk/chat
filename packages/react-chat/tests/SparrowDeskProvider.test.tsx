import * as React from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SparrowDeskProvider, useSparrowDesk } from '../src'

beforeEach(() => {
  // Ensure no widget script/global state leaks between browser tests.
  document.querySelectorAll('script[data-sd-chat-widget="true"]').forEach((el) => el.remove())
  delete (globalThis as unknown as { SD_WIDGET_DOMAIN?: unknown }).SD_WIDGET_DOMAIN
  delete (globalThis as unknown as { SD_WIDGET_TOKEN?: unknown }).SD_WIDGET_TOKEN
  delete (globalThis as unknown as { sparrowDesk?: unknown }).sparrowDesk
})

test('provider exposes widget methods via useSparrowDesk()', async () => {
  const openWidget = vi.fn()
  const closeWidget = vi.fn()
  const hideWidget = vi.fn()
  const setTags = vi.fn()
  const setContactFields = vi.fn()
  const setConversationFields = vi.fn()

  const onReady = vi.fn()

  function Consumer() {
    const {
      isReady,
      openWidget,
      closeWidget,
      hideWidget,
      setTags,
      setContactFields,
      setConversationFields,
    } = useSparrowDesk()

    React.useEffect(() => {
      if (!isReady) return
      openWidget()
      closeWidget()
      hideWidget()
      setTags(['vip'])
      setContactFields({ full_name: 'Bot' })
      setConversationFields({ priority: 'med' })
    }, [
      isReady,
      openWidget,
      closeWidget,
      hideWidget,
      setTags,
      setContactFields,
      setConversationFields,
    ])

    return <div>{isReady ? 'ready' : 'not-ready'}</div>
  }

  await render(
    <SparrowDeskProvider
      domain="your-workspace.sparrowdesk.com"
      token="test-token"
      shouldInitialize={false}
      // Use polling path; we'll set `sparrowDesk` after mount.
      readyTimeoutMs={1000}
      onReady={onReady}
    >
      <Consumer />
    </SparrowDeskProvider>,
  )

  globalThis.sparrowDesk = {
    openWidget,
    closeWidget,
    hideWidget,
    setTags,
    setContactFields,
    setConversationFields,
  }

  await expect.poll(() => openWidget.mock.calls.length).toBeGreaterThan(0)

  expect(onReady).toHaveBeenCalled()
  expect(openWidget).toHaveBeenCalled()
  expect(closeWidget).toHaveBeenCalled()
  expect(hideWidget).toHaveBeenCalled()
  expect(setTags).toHaveBeenCalledWith(['vip'])
  expect(setContactFields).toHaveBeenCalledWith({ full_name: 'Bot' })
  expect(setConversationFields).toHaveBeenCalledWith({ priority: 'med' })
})

test('provider can defer initialization until initialize() is called', async () => {
  const onReady = vi.fn()

  let initialize!: () => void

  function Consumer() {
    const ctx = useSparrowDesk()
    React.useEffect(() => {
      initialize = ctx.initialize
    }, [ctx.initialize])
    return <div>consumer</div>
  }

  await render(
    <SparrowDeskProvider
      domain="your-workspace.sparrowdesk.com"
      token="test-token"
      shouldInitialize={false}
      connectOnPageLoad={false}
      readyTimeoutMs={1000}
      onReady={onReady}
    >
      <Consumer />
    </SparrowDeskProvider>,
  )

  globalThis.sparrowDesk = { openWidget: vi.fn() }

  // Should not auto-init when connectOnPageLoad is false.
  await new Promise((r) => setTimeout(r, 50))
  expect(onReady).not.toHaveBeenCalled()

  initialize()
  await expect.poll(() => onReady.mock.calls.length).toBeGreaterThan(0)
})

test('provider can defer initialization until openWidget() is called (queues call)', async () => {
  const openWidget = vi.fn()
  const onReady = vi.fn()

  function Consumer() {
    const { openWidget: open } = useSparrowDesk()
    React.useEffect(() => {
      // Trigger initialization via an interaction in the app (e.g. button click).
      // Use a macrotask so the provider's own mount effects run first.
      const t = setTimeout(() => open(), 0)
      return () => clearTimeout(t)
    }, [open])
    return <div>consumer</div>
  }

  await render(
    <SparrowDeskProvider
      domain="your-workspace.sparrowdesk.com"
      token="test-token"
      shouldInitialize={false}
      connectOnPageLoad={false}
      readyTimeoutMs={1000}
      onReady={onReady}
    >
      <Consumer />
    </SparrowDeskProvider>,
  )

  globalThis.sparrowDesk = { openWidget }

  await expect.poll(() => openWidget.mock.calls.length).toBeGreaterThan(0)
  expect(onReady).toHaveBeenCalled()
})

test('provider can defer initialization until first user interaction (initializeOnInteraction)', async () => {
  const onReady = vi.fn()

  await render(
    <SparrowDeskProvider
      domain="your-workspace.sparrowdesk.com"
      token="test-token"
      shouldInitialize={false}
      connectOnPageLoad={false}
      initializeOnInteraction
      readyTimeoutMs={1000}
      onReady={onReady}
    >
      <div>consumer</div>
    </SparrowDeskProvider>,
  )

  globalThis.sparrowDesk = { openWidget: vi.fn() }

  await new Promise((r) => setTimeout(r, 50))
  expect(onReady).not.toHaveBeenCalled()

  document.dispatchEvent(new Event('pointerdown', { bubbles: true }))

  await expect.poll(() => onReady.mock.calls.length).toBeGreaterThan(0)
})

test('connectOnPageLoad=true does not get stuck if props change before API becomes available', async () => {
  const setTags = vi.fn()
  const onReady = vi.fn()

  const r = await render(
    <SparrowDeskProvider
      domain="your-workspace.sparrowdesk.com"
      token="test-token"
      shouldInitialize={false}
      connectOnPageLoad
      readyTimeoutMs={1000}
      tags={['a']}
      onReady={onReady}
    >
      <div>consumer</div>
    </SparrowDeskProvider>,
  )

  // Change props that previously caused the init effect to cleanup/cancel.
  await r.rerender(
    <SparrowDeskProvider
      domain="your-workspace.sparrowdesk.com"
      token="test-token"
      shouldInitialize={false}
      connectOnPageLoad
      readyTimeoutMs={1000}
      tags={['b']}
      onReady={onReady}
    >
      <div>consumer</div>
    </SparrowDeskProvider>,
  )

  // Give React effects a tick to flush the latest tag ref.
  await new Promise((res) => setTimeout(res, 0))

  globalThis.sparrowDesk = { setTags }

  await expect.poll(() => onReady.mock.calls.length).toBeGreaterThan(0)
  expect(setTags).toHaveBeenCalledWith(['b'])
})
