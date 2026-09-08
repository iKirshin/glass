'use client'

import { useEffect, useState } from 'react'
import { HardDrive, Cpu, Mic, KeyRound } from 'lucide-react'
import { useAuth } from '@/utils/auth'
import { getUserProfile, updateUserProfile, getModelSettings, ModelSettings, ModelOption } from '@/utils/api'

const formatPrice = (m?: ModelOption) => {
  const p = m?.pricing
  if (!p) return ''
  if (p.free) return 'free · local'
  if (p.perMinute !== undefined) return `$${p.perMinute}/min`
  if (p.input !== undefined) return `$${p.input} / $${p.output} per 1M`
  return ''
}

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [savedName, setSavedName] = useState('')
  const [saving, setSaving] = useState(false)
  const [models, setModels] = useState<ModelSettings | null>(null)
  const [modelsError, setModelsError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getUserProfile().then(p => { setDisplayName(p.display_name); setSavedName(p.display_name) }).catch(console.error)
    getModelSettings().then(setModels).catch(e => setModelsError(e.message))
  }, [user])

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">Loading...</div>
  }

  const handleSaveName = async () => {
    if (!displayName || displayName === savedName) return
    setSaving(true)
    try {
      await updateUserProfile({ displayName })
      setSavedName(displayName)
    } catch (error) {
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const findModel = (list: ModelOption[] | undefined, id: string | null) => list?.find(m => m.id === id)
  const llm = findModel(models?.availableLlm, models?.selectedModels.llm || null)
  const stt = findModel(models?.availableStt, models?.selectedModels.stt || null)
  const tabs = [
    { name: 'Personal Profile', href: '/settings', active: true },
    { name: 'Data & Privacy', href: '/settings/privacy', active: false },
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
          <div className="p-4 rounded-lg border bg-gray-50 border-gray-200 flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-gray-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Local mode</h3>
              <p className="text-sm text-gray-700">No account. Keys, transcripts, recordings and your interview profile stay on this computer.</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Display Name</h3>
            <p className="text-sm text-gray-600 mb-4">Shown in the dashboard only. The name used in answers is set in the Interview Profile.</p>
            <div className="max-w-sm flex gap-2">
              <input type="text" value={displayName} maxLength={32} onChange={e => setDisplayName(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
              <button onClick={handleSaveName} disabled={saving || !displayName || displayName === savedName}
                className="px-4 py-2 text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50">Update</button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">AI models</h3>
            <p className="text-sm text-gray-600 mb-4">
              Read-only overview. Keys, model selection, custom models and prices are managed in the desktop app (Settings on the header bar).
            </p>
            {modelsError && <p className="text-sm text-red-700">Could not load model settings: {modelsError}</p>}
            {models && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-md border border-gray-200 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-1"><Cpu className="h-4 w-4" /> Answers (LLM)</div>
                    <div className="text-gray-900">{llm ? llm.name : models.selectedModels.llm || 'Not selected'}</div>
                    <div className="text-xs text-gray-500">{llm?.id}{formatPrice(llm) ? ` · ${formatPrice(llm)}` : ''}</div>
                  </div>
                  <div className="rounded-md border border-gray-200 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-1"><Mic className="h-4 w-4" /> Speech recognition (STT)</div>
                    <div className="text-gray-900">{stt ? stt.name : models.selectedModels.stt || 'Not selected'}</div>
                    <div className="text-xs text-gray-500">{stt?.id}{formatPrice(stt) ? ` · ${formatPrice(stt)}` : ''}</div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-2"><KeyRound className="h-4 w-4" /> Providers</div>
                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
                    {models.providers.map(p => (
                      <li key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="text-gray-900">{p.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.hasKey ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                          {p.hasKey ? (p.id === 'ollama' || p.id === 'whisper' ? 'enabled' : 'key set') : 'not configured'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
