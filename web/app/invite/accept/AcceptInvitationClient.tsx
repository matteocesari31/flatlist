'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import MergeCatalogModal from '@/components/MergeCatalogModal'

export default function AcceptInvitationClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invitation, setInvitation] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [existingListingsCount, setExistingListingsCount] = useState(0)
  const [showMergeModal, setShowMergeModal] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link')
      setLoading(false)
      return
    }

    const checkInvitation = async () => {
      try {
        const supabase = createClient()
        console.log('Checking invitation with token:', token)

        const { data: { user: currentUser }, error: authCheckError } = await supabase.auth.getUser()
        console.log('Current user:', currentUser?.id, currentUser?.email)
        
        if (!currentUser) {
          console.log('User not authenticated, redirecting to auth...')
          router.push(`/auth?invite_token=${token}`)
          return
        }

        console.log('Fetching invitation from database...')
        console.log('Token being searched:', token)
        console.log('User email:', currentUser.email)
        
        const { data: invitationData, error: invitationError } = await supabase
          .from('catalog_invitations')
          .select(`
            *,
            catalogs (
              id,
              name
            )
          `)
          .eq('token', token)
          .eq('status', 'pending')
          .maybeSingle()

        if (invitationError) {
          console.error('Error fetching invitation:', invitationError)
          console.error('Error details:', {
            message: invitationError.message,
            details: invitationError.details,
            hint: invitationError.hint,
            code: invitationError.code,
            fullError: invitationError,
          })
          
          let errorMessage = 'Failed to load invitation'
          if (invitationError.message) {
            errorMessage = invitationError.message
          } else if (invitationError.details) {
            errorMessage = invitationError.details
          } else if (invitationError.hint) {
            errorMessage = invitationError.hint
          } else if (invitationError.code) {
            errorMessage = `Database error (${invitationError.code})`
          }
          
          setError(errorMessage)
          setLoading(false)
          return
        }

        if (!invitationData) {
          console.log('No invitation found with token:', token)
          setError('Invalid or expired invitation')
          setLoading(false)
          return
        }

        console.log('Invitation found:', {
          id: invitationData.id,
          catalog_id: invitationData.catalog_id,
          invited_email: invitationData.invited_email,
          status: invitationData.status,
          expires_at: invitationData.expires_at,
        })

        const expiresAt = new Date(invitationData.expires_at)
        const now = new Date()
        console.log('Expiration check:', { expiresAt, now, isExpired: expiresAt < now })
        if (expiresAt < now) {
          setError('This invitation has expired')
          setLoading(false)
          return
        }

        setInvitation(invitationData)
        setUser(currentUser)

        if (currentUser.email?.toLowerCase() !== invitationData.invited_email.toLowerCase()) {
          setError(`This invitation was sent to ${invitationData.invited_email}, but you are logged in as ${currentUser.email}`)
          setLoading(false)
          return
        }

        const { data: existingMember, error: memberCheckError } = await supabase
          .from('catalog_members')
          .select('id')
          .eq('catalog_id', invitationData.catalog_id)
          .eq('user_id', currentUser.id)
          .maybeSingle()

        if (memberCheckError) {
          console.error('Error checking membership:', memberCheckError)
        }

        if (existingMember) {
          setError('You are already a member of this catalog')
          setLoading(false)
          return
        }

        const { data: userCatalogs } = await supabase
          .from('catalogs')
          .select('id')
          .eq('created_by', currentUser.id)

        if (userCatalogs && userCatalogs.length > 0) {
          const userCatalogIds = userCatalogs.map(c => c.id)
          const { count } = await supabase
            .from('listings')
            .select('*', { count: 'exact', head: true })
            .in('catalog_id', userCatalogIds)

          setExistingListingsCount(count || 0)
        } else {
          setExistingListingsCount(0)
        }

        setShowMergeModal(true)
        setLoading(false)
      } catch (err: any) {
        console.error('Error checking invitation:', err)
        setError(err.message || 'Failed to load invitation')
        setLoading(false)
      }
    }

    checkInvitation()
  }, [token, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading invitation...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Invitation Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-[#FF5C5C] text-white rounded-md hover:bg-[#FF4A4A] transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {showMergeModal && invitation && (
        <MergeCatalogModal
          isOpen={showMergeModal}
          onClose={() => {
            setShowMergeModal(false)
            router.push('/')
          }}
          invitationToken={token!}
          catalogId={invitation.catalog_id}
          catalogName={invitation.catalogs?.name || 'Shared Catalog'}
          existingListingsCount={existingListingsCount}
        />
      )}
    </>
  )
}
