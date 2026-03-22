import { Chat } from '@sparrowdesk/react-chat'

export function App() {
  return (
    <main>
      <h1>SparrowDesk Chat</h1>
      <p>Replace domain and token below with your SparrowDesk credentials.</p>
      <Chat
        domain="your-workspace.sparrowdesk.com"
        token="YOUR_TOKEN"
        openOnInit
      />
    </main>
  )
}
