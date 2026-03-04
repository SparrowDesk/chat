import * as React from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { Chat } from '../src'

beforeEach(() => {
  // Clean up any prior script tag between tests (Chat doesn't remove scripts by default).
  document.querySelectorAll('script[data-sd-chat-widget="true"]').forEach((el) => el.remove())

  // Reset any mocked widget API.
  delete (globalThis as unknown as { sparrowDesk?: unknown }).sparrowDesk
})

test('injects SparrowDesk script and sets globals', async () => {
  await render(
    <Chat
      domain="sparrowdesk7975310.sparrowdesk.com"
      token="test-token"
      readyTimeoutMs={0}
      shouldInitialize={false}
    />,
  )

  // No script injection in tests.
  expect(document.querySelector('script[data-sd-chat-widget="true"]')).toBeFalsy()
  expect(globalThis.SD_WIDGET_DOMAIN).toBe('sparrowdesk7975310.sparrowdesk.com')
  expect(globalThis.SD_WIDGET_TOKEN).toBe('test-token')
})

test('applies tags + contact fields + conversation fields and wires open/close callbacks', async () => {
  const setTags = vi.fn()
  const setContactFields = vi.fn()
  const setConversationFields = vi.fn()
  const openWidget = vi.fn()
  const hideWidget = vi.fn()

  let openCb: (() => void) | undefined
  let closeCb: (() => void) | undefined
  const onOpen = vi.fn((cb: () => void) => {
    openCb = cb
  })
  const onClose = vi.fn((cb: () => void) => {
    closeCb = cb
  })

  globalThis.sparrowDesk = {
    setTags,
    setContactFields,
    setConversationFields,
    openWidget,
    hideWidget,
    onOpen,
    onClose,
  }

  const handleOpen = vi.fn()
  const handleClose = vi.fn()
  const handleReady = vi.fn()

  await render(
    <Chat
      domain="sparrowdesk7975310.sparrowdesk.com"
      token="test-token"
      shouldInitialize={false}
      tags={['vip', 'returning-user']}
      contactFields={{ full_name: 'Bot', nick_name: 'Dave' }}
      conversationFields={{ priority: 'med', status: 'todo', request_type: 'ENQUIRY' }}
      openOnInit
      hideOnInit
      onOpen={handleOpen}
      onClose={handleClose}
      onReady={handleReady}
      readyTimeoutMs={0}
    />,
  )

  expect(handleReady).toHaveBeenCalled()
  expect(setTags).toHaveBeenCalledWith(['vip', 'returning-user'])
  expect(setContactFields).toHaveBeenCalledWith({ full_name: 'Bot', nick_name: 'Dave' })
  expect(setConversationFields).toHaveBeenCalledWith({
    priority: 'med',
    status: 'todo',
    request_type: 'ENQUIRY',
  })
  expect(hideWidget).toHaveBeenCalled()
  expect(openWidget).toHaveBeenCalled()

  expect(onOpen).toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
  expect(openCb).toBeTypeOf('function')
  expect(closeCb).toBeTypeOf('function')

  openCb?.()
  closeCb?.()
  expect(handleOpen).toHaveBeenCalled()
  expect(handleClose).toHaveBeenCalled()
})

test('can defer initialization until user interaction (connectOnPageLoad=false)', async () => {
  const handleReady = vi.fn()

  await render(
    <Chat
      domain="sparrowdesk7975310.sparrowdesk.com"
      token="test-token"
      shouldInitialize={false}
      connectOnPageLoad={false}
      initializeOnInteraction
      onReady={handleReady}
      readyTimeoutMs={1000}
    />,
  )

  globalThis.sparrowDesk = {
    openWidget: vi.fn(),
  }

  // Should not auto-init until first interaction.
  await new Promise((r) => setTimeout(r, 50))
  expect(handleReady).not.toHaveBeenCalled()

  document.dispatchEvent(new Event('pointerdown', { bubbles: true }))

  await expect.poll(() => handleReady.mock.calls.length).toBeGreaterThan(0)
})
