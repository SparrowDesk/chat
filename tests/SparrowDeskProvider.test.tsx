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
      domain="sparrowdesk7975310.sparrowdesk.com"
      token="test-token"
      shouldInitialize={false}
      // Use polling path; we’ll set `sparrowDesk` after mount.
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


