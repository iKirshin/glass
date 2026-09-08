'use client'

import { BookOpen, Github, Keyboard, Mic } from 'lucide-react'

export default function HelpPage() {
  const card = 'bg-white border border-gray-200 rounded-lg p-6'
  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="px-8 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Help</h1>
        <div className="grid grid-cols-2 gap-6">
          <div className={card}>
            <div className="flex items-center gap-2 mb-3"><BookOpen className="h-5 w-5 text-gray-600" /><h2 className="text-lg font-semibold text-gray-900">Getting started</h2></div>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
              <li>Add an API key (OpenAI, Anthropic, Google, Deepgram) or enable a local model in the desktop app.</li>
              <li>Fill in the Interview Profile: résumé, competence boundaries, language level.</li>
              <li>Press Listen during the call, then Ask (Cmd+Enter) to get an answer to the last question.</li>
            </ol>
          </div>
          <div className={card}>
            <div className="flex items-center gap-2 mb-3"><Keyboard className="h-5 w-5 text-gray-600" /><h2 className="text-lg font-semibold text-gray-900">Shortcuts (macOS)</h2></div>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>Cmd+Enter — Ask about the last question / toggle the Ask window</li>
              <li>Cmd+\ — hide or show all windows</li>
              <li>Cmd+Shift+↑/↓ — scroll the answer</li>
              <li>Esc in Ask — stop or clear the answer, then close</li>
            </ul>
          </div>
          <div className={card}>
            <div className="flex items-center gap-2 mb-3"><Mic className="h-5 w-5 text-gray-600" /><h2 className="text-lg font-semibold text-gray-900">Better transcription</h2></div>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>Use headphones: it removes the other side&apos;s voice from your microphone.</li>
              <li>The app records both channels; re-listen from Settings → Open Recordings Folder.</li>
              <li>If recognition stalls, it restarts itself; watch the terminal for [SystemAudio] lines when running from source.</li>
            </ul>
          </div>
          <div className={card}>
            <div className="flex items-center gap-2 mb-3"><Github className="h-5 w-5 text-gray-600" /><h2 className="text-lg font-semibold text-gray-900">Source code</h2></div>
            <p className="text-sm text-gray-700">
              InPro is an open-source fork of Glass. Issues and changes:{' '}
              <a className="text-blue-600 hover:underline" href="https://github.com/iKirshin/glass" target="_blank" rel="noopener noreferrer">github.com/iKirshin/glass</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
