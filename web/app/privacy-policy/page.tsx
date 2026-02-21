'use client'

import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/">
            <img src="/logo.svg" alt="flatlist" className="h-10" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="prose prose-gray max-w-none space-y-6">
          <p className="text-sm text-gray-500 mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              At flatlist, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information when you use our Chrome extension and web application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Information We Collect</h2>
            
            <h3 className="text-xl font-medium text-gray-900 mt-6 mb-3">Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>Email Address:</strong> Used to create your account and send you notifications about your listings and invitations</li>
              <li><strong>Listing Data:</strong> Information about apartment listings you save, including URLs, titles, descriptions, images, and prices</li>
              <li><strong>Notes:</strong> Any notes you add to listings</li>
            </ul>

            <h3 className="text-xl font-medium text-gray-900 mt-6 mb-3">Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>Authentication Tokens:</strong> Stored locally in your browser to keep you signed in</li>
              <li><strong>Usage Data:</strong> How you interact with the extension and web app to improve our services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>To provide and maintain our services</li>
              <li>To process your listings and make them searchable</li>
              <li>To enable collaboration features (inviting collaborators to your catalogs)</li>
              <li>To send you important notifications about your account and listings</li>
              <li>To improve our AI-powered search and recommendation features</li>
              <li>To detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Data Storage and Security</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your data is stored securely using <strong>Supabase</strong>, a cloud-based database service. We use industry-standard security measures including:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Encrypted data transmission (HTTPS)</li>
              <li>Secure authentication using Supabase Auth</li>
              <li>Row-level security policies to protect your data</li>
              <li>Regular security audits and updates</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Authentication tokens are stored locally in your browser using Chrome's secure storage API. We never store your passwords - authentication is handled entirely by Supabase.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Chrome Extension Permissions</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Our Chrome extension requires the following permissions:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>Storage:</strong> To store your authentication tokens locally in your browser</li>
              <li><strong>Active Tab:</strong> To access the content of the current webpage to extract listing information</li>
              <li><strong>Scripting:</strong> To inject the floating save button on real estate websites</li>
              <li><strong>Host Permissions:</strong> To access content from all websites (to detect real estate listings) and our web application (for authentication)</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              We only access webpage content on real estate listing pages. We do not access, collect, or transmit data from other websites.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Data Sharing</h2>
            <p className="text-gray-700 leading-relaxed">
              We do not sell, rent, or share your personal information with third parties except:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
              <li><strong>Service Providers:</strong> We use Supabase for data storage and authentication, and Resend for email delivery</li>
              <li><strong>Collaborators:</strong> If you invite collaborators to your catalog, they will have access to listings in that catalog</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Access your personal data</li>
              <li>Delete your account and all associated data</li>
              <li>Export your listings data</li>
              <li>Opt out of non-essential communications</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              To exercise these rights, please contact us at <a href="mailto:team@flatlist.app" className="text-black font-medium hover:underline">team@flatlist.app</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Cookies and Tracking</h2>
            <p className="text-gray-700 leading-relaxed">
              We use cookies and similar technologies only for authentication and to maintain your session. We do not use tracking cookies or analytics tools that collect personal information without your consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Our service is not intended for users under the age of 18. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:team@flatlist.app" className="text-black font-medium hover:underline">team@flatlist.app</a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-12 pt-8 pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
            ← Back to flatlist
          </Link>
        </div>
      </footer>
    </div>
  )
}
