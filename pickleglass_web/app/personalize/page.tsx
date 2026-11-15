'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, Save, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getPersona, getPersonaOptions, savePersona, deletePersona, PersonaOptions, KnownLanguage } from '@/utils/api'

type Form = {
  enabled: boolean
  displayName: string
  targetRole: string
  jobDescription: string
  caseStudies: string
  resumeText: string
  resumeFileName: string
  competenceMode: string
  expertiseNotes: string
  languageLevel: string
  answerLanguage: string
  answerLanguageMode: 'question' | 'fixed'
  knownLanguages: KnownLanguage[]
  extraInstructions: string
}

const emptyForm: Form = {
  enabled: true, displayName: '', targetRole: '', jobDescription: '', caseStudies: '', resumeText: '', resumeFileName: '',
  competenceMode: 'balanced', expertiseNotes: '', languageLevel: 'native', answerLanguage: '', extraInstructions: '',
  answerLanguageMode: 'question', knownLanguages: [],
}

export default function InterviewProfilePage() {
  const [form, setForm] = useState<Form>(emptyForm)
  const [options, setOptions] = useState<PersonaOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const casesFileInput = useRef<HTMLInputElement>(null)

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
            jobDescription: profile.job_description || '',
            caseStudies: profile.case_studies || '',
            resumeText: profile.resume_text || '',
            resumeFileName: profile.resume_file_name || '',
            competenceMode: profile.competence_mode || 'balanced',
            expertiseNotes: profile.expertise_notes || '',
            languageLevel: profile.language_level || 'native',
            answerLanguage: profile.answer_language || '',
            answerLanguageMode: profile.answer_language_mode || (profile.answer_language ? 'fixed' : 'question'),
            knownLanguages: profile.known_languages || (profile.answer_language ? [{ language: profile.answer_language, level: profile.language_level || 'native' }] : []),
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, field: 'resumeText' | 'caseStudies' = 'resumeText') => {
    const file = e.target.files?.[0]
    if (!file) return
    const control = e.currentTarget
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['txt', 'md', 'markdown'].includes(ext || '')) {
      setStatus({ kind: 'error', text: 'The browser can import TXT/Markdown only. For PDF or DOCX use "Load file" in the desktop app (Settings → My Profile & Résumé).' })
      control.value = ''
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setStatus({ kind: 'error', text: 'File is too large. Limit is 15 MB.' })
      control.value = ''
      return
    }
    if (field === 'caseStudies' && form.caseStudies.trim() && !window.confirm('Replace the interview cases in this form? Nothing changes in the saved profile until you click Save.')) {
      control.value = ''
      return
    }
    setLoadingFile(true)
    try {
      const text = (await file.text()).trim()
      if (!text) throw new Error('The file is empty. Choose another file or paste the text.')
      update(field, text)
      if (field === 'resumeText') setForm(prev => ({ ...prev, resumeFileName: file.name }))
      setStatus({ kind: 'ok', text: `Loaded ${file.name}. Review, then Save.` })
    } catch (error: any) {
      setStatus({ kind: 'error', text: error.message || 'Could not read the file. Try again or paste the text.' })
    } finally {
      control.value = ''
      setLoadingFile(false)
    }
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
    if (!window.confirm('Remove the saved profile, résumé and interview cases?')) return
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
  const jobMax = options?.maxJobDescriptionChars || 20000
  const casesMax = options?.maxCaseStudiesChars || 30000
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
            <button onClick={handleClear} disabled={saving || loadingFile}
              className="px-3 py-2 rounded-md text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Clear
            </button>
            <button onClick={handleSave} disabled={saving || loadingFile || !dirty}
              className="px-4 py-2 rounded-md text-sm font-medium bg-gray-900 text-white hover:bg-black disabled:opacity-50 flex items-center gap-2">
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>

        {status && (
          <div role="status" aria-live="polite" className={`mb-6 flex items-center gap-2 rounded-md px-4 py-3 text-sm ${status.kind === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
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
              <h2 className="text-lg font-semibold text-gray-900"><label htmlFor="resume-text">Résumé / experience</label></h2>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${tooLong ? 'text-amber-600' : 'text-gray-500'}`}>
                  {form.resumeFileName ? `${form.resumeFileName} · ` : ''}{form.resumeText.length.toLocaleString()} / {max.toLocaleString()} chars
                </span>
                <input ref={fileInput} type="file" accept=".txt,.md,.markdown" className="hidden" onChange={handleFile} />
                <button disabled={saving || loadingFile} onClick={() => fileInput.current?.click()} className="px-3 py-1.5 rounded-md text-sm text-gray-900 border border-gray-300 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50">
                  <Upload className="h-4 w-4" /> Load TXT/MD
                </button>
              </div>
            </div>
            <textarea id="resume-text" readOnly={loadingFile || saving} className={`${input} font-mono min-h-[260px]`} value={form.resumeText} onChange={e => update('resumeText', e.target.value)}
              placeholder="Paste your résumé here. Roles, projects, tools, results, numbers — the more concrete, the better the answers." />
            <p className={hint}>
              Only the first {max.toLocaleString()} characters are sent to the model. PDF/DOCX import and the "Optimize" button (condense with the selected LLM) are available in the desktop app.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h2 className="text-lg font-semibold text-gray-900"><label htmlFor="job-description">Job description (optional)</label></h2>
              <span className="text-xs text-gray-500">{form.jobDescription.length.toLocaleString()} / {jobMax.toLocaleString()} chars</span>
            </div>
            <textarea id="job-description" className={`${input} min-h-[120px]`} value={form.jobDescription}
              aria-describedby="job-description-hint" onChange={e => update('jobDescription', e.target.value)}
              placeholder="Paste responsibilities, requirements, product and company context." />
            <p id="job-description-hint" className={hint}>Matches confirmed experience to the vacancy. Without a vacancy, Ask draws on 3–5 strong achievements, one relevant example at a time. Stored locally and included in requests to your selected AI model when the profile is enabled.</p>
            {form.jobDescription.length > jobMax && <p className={hint}>Only the first {jobMax.toLocaleString()} characters are sent to the model. The full text is saved.</p>}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h2 className="text-lg font-semibold text-gray-900"><label htmlFor="case-studies">Interview cases (optional)</label></h2>
              <div className="flex items-center flex-wrap gap-3">
                <span className="text-xs text-gray-500">{form.caseStudies.length.toLocaleString()} / {casesMax.toLocaleString()} chars</span>
                <input ref={casesFileInput} type="file" accept=".txt,.md,.markdown" className="hidden" onChange={e => handleFile(e, 'caseStudies')} />
                <button disabled={saving || loadingFile} onClick={() => casesFileInput.current?.click()}
                  className="px-3 py-1.5 rounded-md text-sm text-gray-900 border border-gray-300 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50">
                  <Upload aria-hidden="true" className="h-4 w-4" /> Load cases TXT/MD
                </button>
              </div>
            </div>
            <textarea id="case-studies" readOnly={loadingFile || saving} className={`${input} min-h-[220px]`} value={form.caseStudies}
              aria-describedby="case-studies-hint case-studies-limit" onChange={e => update('caseStudies', e.target.value)}
              placeholder="Confirmed stories: context, evidence, your contribution, decisions, constraints and results. Label unknown details and hypothetical calculations." />
            <p id="case-studies-hint" className={hint}>Saved separately from your résumé and unaffected by Optimize. Ask selects one relevant example; explicit corrections take priority over older résumé summaries. Drafts and assumptions are not achievements. Stored locally and sent to your selected AI model when the profile is enabled.</p>
            <p id="case-studies-limit" className={hint}>{form.caseStudies.length > casesMax
              ? `Only the first ${casesMax.toLocaleString()} characters are sent to the model. The full text is saved; shorten it to keep all qualifications in context.`
              : 'Include baselines and limitations. PDF/DOCX import is available in the desktop app.'}</p>
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
            <label className={label} htmlFor="answer-language-mode">Answer language</label>
            <select id="answer-language-mode" className={input} value={form.answerLanguageMode}
              onChange={e => update('answerLanguageMode', e.target.value as 'question' | 'fixed')}>
              <option value="question">Same as the question</option>
              <option value="fixed">Always use one language</option>
            </select>
            {form.answerLanguageMode === 'fixed' && <div className="mt-3">
              <label className={label} htmlFor="answer-language">Fixed language</label>
              <input id="answer-language" className={input} value={form.answerLanguage} onChange={e => update('answerLanguage', e.target.value)} placeholder="e.g. English" />
            </div>}
            <p className={hint}>Follows each new question. Recognition language is configured separately in the desktop Settings.</p>
            <h3 className={`${label} mt-5`}>Languages I know</h3>
            {form.knownLanguages.map((entry, index) => <div className="flex gap-2 items-end mb-3" key={index}>
              <div className="flex-1 min-w-0">
                <label className={label} htmlFor={`known-language-${index}`}>Language {index + 1}</label>
                <input id={`known-language-${index}`} className={input} maxLength={60} value={entry.language} placeholder="e.g. English, Russian"
                  onChange={e => update('knownLanguages', form.knownLanguages.map((item, i) => i === index ? { ...item, language: e.target.value } : item))} />
              </div>
              <div className="flex-1 min-w-0">
                <label className={label} htmlFor={`known-level-${index}`}>Your level</label>
                <select id={`known-level-${index}`} className={input} value={entry.level}
                  onChange={e => update('knownLanguages', form.knownLanguages.map((item, i) => i === index ? { ...item, level: e.target.value } : item))}>
                  <option value="">Choose level</option>
                  {(options?.languageLevels || []).map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
              <button type="button" className="p-2 text-gray-600" aria-label={`Remove language ${index + 1}`}
                onClick={() => update('knownLanguages', form.knownLanguages.filter((_, i) => i !== index))}>×</button>
            </div>)}
            <button type="button" className="text-sm text-blue-600 disabled:opacity-50" disabled={form.knownLanguages.length >= (options?.maxKnownLanguages || 12)}
              onClick={() => update('knownLanguages', [...form.knownLanguages, { language: '', level: '' }])}>Add language</button>
            <p className={hint}>Each answer uses the level for its language. Vocabulary changes, not your experience or reasoning.</p>
            <div className="mt-4">
              <label className={label} htmlFor="default-language-level">Default style for languages without a level</label>
              <select id="default-language-level" className={input} value={form.languageLevel} onChange={e => update('languageLevel', e.target.value)}>
                {(options?.languageLevels || []).map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <p className={hint}>Used only for languages not listed above; not a claim that you know those languages.</p>
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
