import * as React from 'react'
import { SparrowDeskProvider } from '../../src'

export function App() {
  return (
    <>
      {/* Example usage: */}
      {/*
      <Chat
        domain="sparrowdesk7975310.sparrowdesk.com"
        token="YOUR_TOKEN"
        tags={['vip', 'returning-user']}
        contactFields={{ full_name: 'Bot', nick_name: 'Dave' }}
        conversationFields={{ priority: 'med', status: 'done', request_type: 'ENQUIRY' }}
        openOnInit
        onOpen={() => console.log('Widget opened')}
        onClose={() => console.log('Widget closed')}
      />
      */}

      {/* Provider + hook usage (recommended for apps that need widget control in many places): */}
      {/*
      <SparrowDeskProvider domain="sparrowdesk7975310.sparrowdesk.com" token="YOUR_TOKEN" openOnInit>
        <YourApp />
      </SparrowDeskProvider>
      */}
    </>
  )
}
