'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, Save, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getPersona, getPersonaOptions, savePersona, deletePersona, PersonaOptions } from '@/utils/api'

type Form = {
  enabled: boolean
  displayName: string
  targetRole: string
  resumeText: string
  resumeFileName: string
  competenceMode: string
  expertiseNotes: string
  languageLevel: string
  answerLanguage: string
  extraInstructions: string
}

const emptyForm: Form = {
  enabled: true, displayName: '', targetRole: '', resumeText: '', resumeFileName: '',
  competenceMode: 'balanced', expertiseNotes: '', languageLevel: 'native', answerLanguage: '', extraInstructions: '',
}

export default function InterviewProfilePage() {
  const [form, setForm] = useState<Form>(emptyForm)
  const [options, setOptions] = useState<PersonaOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      try {
        const [opts, profile] = await Promise.all([getPersonaOptions(), getPersona()])
        setOptions(opts)
        if (profile) {
          setForm({
            enabled: profile.enabled === null || profile.enabled === undefined ? true : !!profile.enabled,
            displayName: profile.display_name || '',
            targetRole: profile.target_role || '',
            resumeText: profile.resume_text || '',
            resumeFileName: profile.resume_file_name || '',
            competenceMode: profile.competence_mode || 'balanced',
            expertiseNotes: profile.expertise_notes || '',
            languageLevel: profile.language_level || 'native',
            answerLanguage: profile.answer_language || '',
            extraInstructions: profile.extra_instructions || '',
          })
        }
      } catch (error) {
        console.error(error)
        setStatus({ kind: 'error', text: 'Could not load the profile. Is the InPro desktop app running?' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
    setStatus(null)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['txt', 'md', 'markdown'].includes(ext || '')) {
      setStatus({ kind: 'error', text: 'The browser can import TXT/Markdown only. For PDF or DOCX use "Load file" in the desktop app (Settings → My Profile & Résumé).' })
      e.target.value = ''
      return
    }
    const text = await file.text()
    update('resumeText', text.trim())
    setForm(prev => ({ ...prev, resumeFileName: file.name }))
    setStatus({ kind: 'ok', text: `Loaded ${file.name}` })
    e.target.value = ''
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await savePersona({ ...form, resume_file_name: form.resumeFileName })
      setDirty(false)
      setStatus({ kind: 'ok', text: 'Saved. New answers will use this profile.' })
    } catch (error: any) {
      setStatus({ kind: 'error', text: error.message || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!window.confirm('Remove the saved profile and résumé?')) return
    setSaving(true)
    try {
      await deletePersona()
      setForm(emptyForm)
      setDirty(false)
      setStatus({ kind: 'ok', text: 'Profile removed' })
    } catch (error: any) {
      setStatus({ kind: 'error', text: error.message || 'Could not remove the profile' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-gray-500">Loading...</div></div>
  }

  const max = options?.maxResumeChars || 40000
  const tooLong = form.resumeText.length > max
  const input = 'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500'
  const label = 'block text-sm font-medium text-gray-800 mb-1'
  const hint = 'text-xs text-gray-500 mt-1'

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="px-8 py-8 max-w-4xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Personalize</p>
            <h1 className="text-3xl font-bold text-gray-900">Interview Profile</h1>
            <p className="text-sm text-gray-600 mt-2">
              Answers are generated as if you were speaking: based on your real experience, within your competence, at your language level.
              The same profile is editable in the desktop app (Settings → My Profile &amp; Résumé).
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleClear} disabled={saving}
              className="px-3 py-2 rounded-md text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Clear
            </button>
            <button onClick={handleSave} disabled={saving || !dirty}
              className="px-4 py-2 rounded-md text-sm font-medium bg-gray-900 text-white hover:bg-black disabled:opacity-50 flex items-center gap-2">
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>

        {status && (
          <div className={`mb-6 flex items-center gap-2 rounded-md px-4 py-3 text-sm ${status.kind === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {status.kind === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {status.text}
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <label className="flex items-center gap-3 text-sm font-medium text-gray-900">
              <input type="checkbox" checked={form.enabled} onChange={e => update('enabled', e.target.checked)} className="h-4 w-4" />
              Use this profile when generating answers
            </label>
            <div className="grid grid-cols-2 gap-4 mt-5">
              <div>
                <label className={label}>Your name (optional)</label>
                <input className={input} value={form.displayName} onChange={e => update('displayName', e.target.value)} placeholder="e.g. Ivan" />
              </div>
              <div>
                <label className={label}>Target role / context</label>
                <input className={input} value={form.targetRole} onChange={e => update('targetRole', e.target.value)} placeholder="e.g. Engineering Manager interview" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Résumé / experience</h2>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${tooLong ? 'text-amber-600' : 'text-gray-500'}`}>
                  {form.resumeFileName ? `${form.resumeFileName} · ` : ''}{form.resumeText.length.toLocaleString()} / {max.toLocaleString()} chars
                </span>
                <input ref={fileInput} type="file" accept=".txt,.md,.markdown" className="hidden" onChange={handleFile} />
                <button onClick={() => fileInput.current?.click()} className="px-3 py-1.5 rounded-md text-sm border border-gray-300 hover:bg-gray-50 flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Load TXT/MD
                </button>
              </div>
            </div>
            <textarea className={`${input} font-mono min-h-[260px]`} value={form.resumeText} onChange={e => update('resumeText', e.target.value)}
              placeholder="Paste your résumé here. Roles, projects, tools, results, numbers — the more concrete, the better the answers." />
            <p className={hint}>
              Only the first {max.toLocaleString()} characters are sent to the model. PDF/DOCX import and the "Optimize" button (condense with the selected LLM) are available in the desktop app.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Competence boundaries</h2>
            <select className={input} value={form.competenceMode} onChange={e => update('competenceMode', e.target.value)}>
              {(options?.competenceModes || []).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <p className={hint}>“Strict” keeps answers inside your real experience and makes the model reason like a person would on unfamiliar questions instead of sounding like it knows everything.</p>
            <label className={`${label} mt-4`}>What you know / don&apos;t know (optional)</label>
            <textarea className={`${input} min-h-[90px]`} value={form.expertiseNotes} onChange={e => update('expertiseNotes', e.target.value)}
              placeholder="e.g. Strong: people management, roadmap planning, B2B SaaS. Weak: ML internals, low-level infra. Never worked in fintech." />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Language</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Language level (CEFR)</label>
                <select className={input} value={form.languageLevel} onChange={e => update('languageLevel', e.target.value)}>
                  {(options?.languageLevels || []).map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Answer language (optional)</label>
                <input className={input} value={form.answerLanguage} onChange={e => update('answerLanguage', e.target.value)} placeholder="e.g. English (default: same as the question)" />
              </div>
            </div>
            <p className={hint}>B1/B2/C1 make the wording match how you actually speak the language: simpler vocabulary, shorter sentences, natural non-native phrasing.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Extra instructions (optional)</h2>
            <textarea className={`${input} min-h-[90px]`} value={form.extraInstructions} onChange={e => update('extraInstructions', e.target.value)}
              placeholder="e.g. Keep answers under 40 seconds of speech. Always mention measurable results. Avoid corporate buzzwords." />
          </div>
        </div>
      </div>
    </div>
  )
}
