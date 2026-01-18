import { Suspense } from 'react'
import AcceptInvitationClient from './AcceptInvitationClient'

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg">Loading...</div>
          </div>
        </div>
      }
    >
      <AcceptInvitationClient />
    </Suspense>
  )
}
