'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface MergeCatalogModalProps {
  isOpen: boolean
  onClose: () => void
  invitationToken: string
  catalogId: string
  catalogName: string
  existingListingsCount: number
}

export default function MergeCatalogModal({
  isOpen,
  onClose,
  invitationToken,
  catalogId,
  catalogName,
  existingListingsCount,
}: MergeCatalogModalProps) {
  const router = useRouter()
  const [mergeChoice, setMergeChoice] = useState<'merge' | 'separate'>('merge')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAccept = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get current user first
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        throw new Error('You must be logged in to accept invitations')
      }

      // First, verify the invitation exists and is valid (don't update status yet)
      const { data: invitation, error: invitationCheckError } = await supabase
        .from('catalog_invitations')
        .select('*')
        .eq('token', invitationToken)
        .eq('status', 'pending')
        .maybeSingle()

      if (invitationCheckError) {
        console.error('Error checking invitation:', invitationCheckError)
        console.error('Error details:', {
          message: invitationCheckError.message,
          details: invitationCheckError.details,
          hint: invitationCheckError.hint,
          code: invitationCheckError.code,
        })
        throw new Error(`Failed to verify invitation: ${invitationCheckError.message || 'Unknown error'}`)
      }

      if (!invitation) {
        throw new Error('Invalid or expired invitation')
      }

      // Check if invitation is expired
      const expiresAt = new Date(invitation.expires_at)
      if (expiresAt < new Date()) {
        throw new Error('This invitation has expired')
      }

      // Check if user's email matches
      if (currentUser.email?.toLowerCase() !== invitation.invited_email.toLowerCase()) {
        throw new Error(`This invitation was sent to ${invitation.invited_email}, but you are logged in as ${currentUser.email}`)
      }

      // Add user to catalog FIRST (while invitation is still 'pending' for RLS policy)
      // Check if member already exists to avoid duplicate key error
      const { data: existingMember } = await supabase
        .from('catalog_members')
        .select('id')
        .eq('catalog_id', catalogId)
        .eq('user_id', currentUser.id)
        .maybeSingle()

      let member
      if (!existingMember) {
        // Insert new member
        const { data: newMember, error: memberError } = await supabase
          .from('catalog_members')
          .insert({
            catalog_id: catalogId,
            user_id: currentUser.id,
          })
          .select()
          .maybeSingle()

        if (memberError) {
          console.error('Error adding member:', memberError)
          console.error('Error details:', {
            message: memberError.message,
            details: memberError.details,
            hint: memberError.hint,
            code: memberError.code,
          })
          throw new Error(`Failed to join catalog: ${memberError.message || memberError.details || 'Unknown error'}`)
        }

        if (!newMember) {
          throw new Error('Failed to join catalog')
        }

        member = newMember
      } else {
        // Member already exists, use existing
        member = existingMember
      }

      // Now update invitation status to 'accepted'
      const { error: invitationUpdateError } = await supabase
        .from('catalog_invitations')
        .update({ status: 'accepted' })
        .eq('token', invitationToken)
        .eq('status', 'pending')

      if (invitationUpdateError) {
        console.error('Error updating invitation status:', invitationUpdateError)
        // Don't fail the whole process if status update fails - user is already a member
      }

      // If user chose to merge, move all their listings to the shared catalog
      if (mergeChoice === 'merge') {
        // Get all catalogs the user created (their personal catalogs)
        const { data: userCatalogs } = await supabase
          .from('catalogs')
          .select('id')
          .eq('created_by', currentUser.id)

        if (userCatalogs && userCatalogs.length > 0) {
          const userCatalogIds = userCatalogs.map(c => c.id)
          // Move all listings from user's personal catalogs to shared catalog
          const { error: updateError } = await supabase
            .from('listings')
            .update({ catalog_id: catalogId })
            .in('catalog_id', userCatalogIds)

          if (updateError) {
            console.error('Error merging listings:', updateError)
            // Don't fail the whole process if merge fails
          }
        }
      }

      // Redirect to home page
      router.push('/')
      router.refresh()
    } catch (err: any) {
      console.error('Error accepting invitation:', err)
      setError(err.message || 'Failed to accept invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[20px] max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">Join Shared Catalog</h2>

        <div className="mb-4">
          <p className="text-gray-700 mb-2">
            You've been invited to collaborate on <strong>{catalogName}</strong>.
          </p>
          {existingListingsCount > 0 && (
            <p className="text-sm text-gray-600 mb-4">
              You currently have {existingListingsCount} listing{existingListingsCount !== 1 ? 's' : ''} in your catalog.
            </p>
          )}
        </div>

        {existingListingsCount > 0 && (
          <div className="mb-4 space-y-3">
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="mergeChoice"
                value="merge"
                checked={mergeChoice === 'merge'}
                onChange={() => setMergeChoice('merge')}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Merge my listings into shared catalog</div>
                <div className="text-sm text-gray-600">
                  All your existing listings will be moved to the shared catalog.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="mergeChoice"
                value="separate"
                checked={mergeChoice === 'separate'}
                onChange={() => setMergeChoice('separate')}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Keep my listings separate</div>
                <div className="text-sm text-gray-600">
                  Your existing listings will stay in your personal catalog. Only new listings will be shared.
                </div>
              </div>
            </label>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={loading}
            className="px-4 py-2 bg-[#FF5C5C] text-white rounded-md hover:bg-[#FF4A4A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Accepting...' : 'Accept Invitation'}
          </button>
        </div>
      </div>
    </div>
  )
}

