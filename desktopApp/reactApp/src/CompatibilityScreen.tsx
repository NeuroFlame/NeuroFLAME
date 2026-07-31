import React from 'react'
import { CompatibilityStatus, electronApi } from './apis/electronApi/electronApi'
import './CompatibilityScreen.css'

export default function CompatibilityScreen({
  compatibility,
}: {
  compatibility: CompatibilityStatus
}) {
  const appNeedsUpdate = compatibility.status === 'appUpdateRequired'
  return (
    <main className='compatibility-screen'>
      <section className='compatibility-card'>
        <h1>
          {appNeedsUpdate
            ? 'Update NeuroFLAME to continue'
            : 'The NeuroFLAME server must be updated'}
        </h1>
        <p>
          {appNeedsUpdate
            ? 'This app is not compatible with the configured NeuroFLAME server.'
            : 'Contact your NeuroFLAME administrator before starting a computation.'}
        </p>
        <dl>
          <div><dt>Desktop app</dt><dd>{compatibility.appVersion}</dd></div>
          <div><dt>Central API</dt><dd>{compatibility.apiVersion ?? 'Legacy version'}</dd></div>
        </dl>
        {appNeedsUpdate && (
          <button type='button' onClick={() => electronApi.openLatestRelease()}>
            Download latest NeuroFLAME
          </button>
        )}
      </section>
    </main>
  )
}
