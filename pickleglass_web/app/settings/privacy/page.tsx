'use client'

import { HardDrive, FolderOpen, Trash2 } from 'lucide-react'

export default function PrivacySettingsPage() {
  const tabs = [
    { name: 'Personal Profile', href: '/settings', active: false },
    { name: 'Data & Privacy', href: '/settings/privacy', active: true },
  ]
  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="px-8 py-8 max-w-4xl">
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-1">Settings</p>
          <h1 className="text-3xl font-bold text-gray-900">Personal Settings</h1>
        </div>
        <nav className="flex space-x-10 mb-8">
          {tabs.map(t => (
            <a key={t.name} href={t.href} className={`pb-4 px-2 border-b-2 font-medium text-sm ${t.active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t.name}</a>
          ))}
        </nav>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3"><HardDrive className="h-5 w-5 text-gray-600" /><h3 className="text-lg font-semibold text-gray-900">Where your data lives</h3></div>
            <p className="text-sm text-gray-700 leading-relaxed">
              InPro has no cloud account and sends no telemetry. Everything is stored in the app&apos;s local data folder on this computer:
              API keys, sessions, transcripts, Ask answers, the interview profile with your résumé, and audio recordings of Listen sessions.
              The only network traffic is the requests to the AI providers you configured (OpenAI, Anthropic, Google, Deepgram); local models (Ollama, Whisper) never leave the machine.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3"><FolderOpen className="h-5 w-5 text-gray-600" /><h3 className="text-lg font-semibold text-gray-900">Recordings</h3></div>
            <p className="text-sm text-gray-700 leading-relaxed">
              Listen sessions are recorded as two WAV files (your microphone and the other side) so a call can be re-listened when transcription misbehaves.
              The last 20 sessions are kept. Turn recording off or open the folder from the desktop app: Settings → Record Listen Audio / Open Recordings Folder.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3"><Trash2 className="h-5 w-5 text-gray-600" /><h3 className="text-lg font-semibold text-gray-900">Deleting data</h3></div>
            <p className="text-sm text-gray-700 leading-relaxed">
              Delete individual sessions from My Activity, remove the interview profile with “Clear” on the Interview Profile page, or delete the whole data folder to start from scratch.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
