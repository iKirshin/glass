import { html, css, LitElement } from '../../ui/assets/lit-core-2.7.4.min.js';

export class PersonaView extends LitElement {
    static styles = css`
        * { font-family:'Helvetica Neue',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            box-sizing:border-box; }

        /* The shared content shell has auto height; percentages would grow with the form. */
        :host { display:flex; width:100%; height:100vh; min-height:0; color:white; }

        .container { display:flex; flex-direction:column; height:100%; width:100%;
            background:rgba(20,20,20,.92); border-radius:12px;
            outline:.5px rgba(255,255,255,.2) solid; outline-offset:-1px;
            position:relative; overflow:hidden; padding:12px; }

        .titlebar{flex:0 0 auto;display:flex;align-items:center;gap:8px;margin:0 0 4px;padding-bottom:8px;
            border-bottom:1px solid rgba(255,255,255,.1);}
        .titlebar .spacer{inline-size:16px;flex:0 0 auto;}
        .close-button{flex:0 0 auto;inline-size:16px;block-size:16px;padding:0;
            background:rgba(255,255,255,.1);border:none;border-radius:3px;
            color:rgba(255,255,255,.7);display:grid;place-items:center;
            font-size:14px;line-height:0;cursor:pointer;transition:.15s;
            -webkit-app-region:no-drag;}
        .close-button:hover{background:rgba(255,255,255,.22);color:#fff;}

        .title{flex:1 1 auto;font-size:14px;font-weight:500;margin:0;padding:2px 0;text-align:center;
            -webkit-app-region:drag;cursor:move;user-select:none;}
        .subtitle{flex:0 0 auto;font-size:11px;color:rgba(255,255,255,.55);text-align:center;margin-bottom:8px;
            -webkit-app-region:drag;cursor:move;user-select:none;}

        .scroll-area{flex:1 1 auto;min-height:0;overflow-y:auto;margin:0 -4px;padding:4px;
            display:flex;flex-direction:column;gap:10px;scrollbar-gutter:stable;scroll-padding:4px;}
        .scroll-area > *{flex-shrink:0;}
        .scroll-area:focus-visible{outline:1px solid rgba(0,122,255,.7);outline-offset:-1px;}
        .scroll-area::-webkit-scrollbar{width:8px;}
        .scroll-area::-webkit-scrollbar-track{background:rgba(255,255,255,.05);border-radius:4px;}
        .scroll-area::-webkit-scrollbar-thumb{background:rgba(255,255,255,.3);border-radius:4px;}
        .scroll-area::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.45);}

        .field{display:flex;flex-direction:column;gap:4px;}
        .row{display:flex;gap:8px;}
        .row .field{flex:1;min-width:0;}
        label{font-size:11px;font-weight:500;color:rgba(255,255,255,.8);}
        .hint{font-size:10px;color:rgba(255,255,255,.45);line-height:1.35;}

        input[type=text], select, textarea{
            width:100%;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.2);
            color:white;border-radius:4px;padding:6px 8px;font-size:12px;outline:none;}
        input[type=text]:focus, select:focus, textarea:focus{border-color:rgba(0,122,255,.7);}
        select option{background:#222;color:white;}
        textarea{resize:vertical;min-height:64px;line-height:1.4;font-family:inherit;}
        textarea.resume{min-height:140px;font-size:11.5px;}

        .toggle{display:flex;align-items:center;gap:8px;font-size:12px;}
        .toggle input{width:14px;height:14px;}

        .resume-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
        .resume-meta{font-size:10px;color:rgba(255,255,255,.5);margin-left:auto;}
        .resume-meta.warn{color:rgba(255,180,80,.9);}

        .btn{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:white;
            border-radius:4px;padding:5px 10px;font-size:11px;cursor:pointer;transition:.15s;}
        .btn:hover{background:rgba(255,255,255,.18);}
        .btn.primary{background:rgba(0,122,255,.55);border-color:rgba(0,122,255,.7);}
        .btn.primary:hover{background:rgba(0,122,255,.75);}
        .btn.danger{background:rgba(255,59,48,.2);border-color:rgba(255,59,48,.4);}
        .btn.danger:hover{background:rgba(255,59,48,.35);}
        .btn[disabled]{opacity:.5;cursor:default;}

        .footer{flex:0 0 auto;display:flex;gap:6px;align-items:center;padding-top:8px;margin-top:4px;
            border-top:1px solid rgba(255,255,255,.1);-webkit-app-region:drag;}
        .footer .btn, .footer .status{-webkit-app-region:no-drag;}
        .footer .spacer{flex:1;}
        .status{font-size:11px;color:rgba(255,255,255,.6);}
        .status.ok{color:rgba(120,220,140,.95);}
        .status.error{color:rgba(255,120,110,.95);}
    `;

    static properties = {
        profile: { type: Object, state: true },
        options: { type: Object, state: true },
        status: { type: Object, state: true },
        busy: { type: Boolean, state: true },
        optimizing: { type: Boolean, state: true },
        resumeBackup: { type: String, state: true },
        dirty: { type: Boolean, state: true },
    };

    constructor() {
        super();
        this.profile = this._emptyProfile();
        this.options = { competenceModes: [], languageLevels: [], maxResumeChars: 40000, maxJobDescriptionChars: 20000, maxCaseStudiesChars: 30000, supportedExtensions: [] };
        this.status = null;
        this.busy = false;
        this.dirty = false;
        this.optimizing = false;
        this.resumeBackup = null; // original text kept for Undo after Optimize
    }

    _emptyProfile() {
        return {
            enabled: true,
            displayName: '',
            targetRole: '',
            jobDescription: '',
            caseStudies: '',
            resumeText: '',
            resumeFileName: '',
            competenceMode: 'balanced',
            expertiseNotes: '',
            languageLevel: 'native',
            answerLanguage: '',
            answerLanguageMode: 'question',
            knownLanguages: [],
            extraInstructions: '',
        };
    }

    _fromRow(row) {
        if (!row) return this._emptyProfile();
        return {
            enabled: row.enabled === null || row.enabled === undefined ? true : !!row.enabled,
            displayName: row.display_name || '',
            targetRole: row.target_role || '',
            jobDescription: row.job_description || '',
            caseStudies: row.case_studies || '',
            resumeText: row.resume_text || '',
            resumeFileName: row.resume_file_name || '',
            competenceMode: row.competence_mode || 'balanced',
            expertiseNotes: row.expertise_notes || '',
            languageLevel: row.language_level || 'native',
            answerLanguage: row.answer_language || '',
            answerLanguageMode: row.answer_language_mode || (row.answer_language ? 'fixed' : 'question'),
            knownLanguages: row.known_languages || (row.answer_language ? [{ language: row.answer_language, level: row.language_level || 'native' }] : []),
            extraInstructions: row.extra_instructions || '',
        };
    }

    async connectedCallback() {
        super.connectedCallback();
        if (!window.api?.personaView) return;
        try {
            const [options, row] = await Promise.all([
                window.api.personaView.getOptions(),
                window.api.personaView.getProfile(),
            ]);
            this.options = options || this.options;
            this.profile = this._fromRow(row);
        } catch (error) {
            console.error('[PersonaView] Failed to load profile:', error);
            this._setStatus('Failed to load profile', 'error');
        }
    }

    _setStatus(text, kind = '') {
        this.status = text ? { text, kind } : null;
    }

    _update(field, value) {
        this.profile = { ...this.profile, [field]: value };
        this.dirty = true;
        this._setStatus(null);
    }

    _updateKnownLanguage(index, field, value) {
        this._update('knownLanguages', this.profile.knownLanguages.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
    }

    async handleImportFile() {
        this.busy = true;
        try {
            const result = await window.api.personaView.importResumeFile();
            if (result?.success) {
                this.profile = { ...this.profile, resumeText: result.text, resumeFileName: result.fileName };
                this.dirty = true;
                this._setStatus(
                    result.truncated
                        ? `Loaded ${result.fileName} (long résumé, only the first ${this.options.maxResumeChars} characters are sent to the model)`
                        : `Loaded ${result.fileName}`,
                    'ok'
                );
            } else if (!result?.canceled) {
                this._setStatus(result?.error || 'Could not read the file', 'error');
            }
        } catch (error) {
            this._setStatus(error.message, 'error');
        } finally {
            this.busy = false;
        }
    }

    async handleImportCasesFile() {
        if (this.profile.caseStudies.trim() && !confirm('Replace the interview cases in this form? The saved version stays unchanged until you click Save.')) return;
        this.busy = true;
        this._setStatus('Loading interview cases…');
        try {
            const result = await window.api.personaView.importCasesFile();
            if (result?.success) {
                this._update('caseStudies', result.text);
                this._setStatus(`Loaded ${result.fileName}. Review the cases, then Save.${result.truncated ? ' The text exceeds the model context limit.' : ''}`, 'ok');
            } else if (result?.canceled) {
                this._setStatus(null);
            } else {
                this._setStatus(result?.error || 'Could not read the cases file', 'error');
            }
        } catch (error) {
            this._setStatus(error.message, 'error');
        } finally {
            this.busy = false;
        }
    }

    async handleOptimize() {
        const text = this.profile.resumeText.trim();
        if (!text || this.optimizing) return;
        this.optimizing = true;
        this._setStatus('Optimizing with the selected model…');
        try {
            const result = await window.api.personaView.optimizeResume({ text, targetRole: this.profile.targetRole });
            if (result?.success) {
                this.resumeBackup = text;
                this.profile = { ...this.profile, resumeText: result.text };
                this.dirty = true;
                this._setStatus(`Optimized: ${result.before.toLocaleString()} → ${result.after.toLocaleString()} chars (${result.model}). Review, then Save.`, 'ok');
            } else {
                this._setStatus(result?.error || 'Optimization failed', 'error');
            }
        } catch (error) {
            this._setStatus(error.message, 'error');
        } finally {
            this.optimizing = false;
        }
    }

    handleUndoOptimize() {
        if (this.resumeBackup === null) return;
        this.profile = { ...this.profile, resumeText: this.resumeBackup };
        this.resumeBackup = null;
        this.dirty = true;
        this._setStatus('Original résumé restored', 'ok');
    }

    async handleSave() {
        this.busy = true;
        try {
            const result = await window.api.personaView.saveProfile({
                ...this.profile,
                resume_file_name: this.profile.resumeFileName,
            });
            if (result?.success) {
                if (result.profile) this.profile = this._fromRow(result.profile);
                this.dirty = false;
                this.resumeBackup = null;
                this._setStatus('Saved. New answers will use this profile.', 'ok');
            } else {
                this._setStatus(result?.error || 'Save failed', 'error');
            }
        } catch (error) {
            this._setStatus(error.message, 'error');
        } finally {
            this.busy = false;
        }
    }

    async handleClear() {
        if (!confirm('Remove the saved profile, résumé and interview cases?')) return;
        this.busy = true;
        try {
            await window.api.personaView.deleteProfile();
            this.profile = this._emptyProfile();
            this.dirty = false;
            this._setStatus('Profile removed', 'ok');
        } catch (error) {
            this._setStatus(error.message, 'error');
        } finally {
            this.busy = false;
        }
    }

    handleClose() {
        if (this.dirty && !confirm('Close without saving your profile changes?')) return;
        window.api.personaView.closeWindow();
    }

    render() {
        const p = this.profile;
        const max = this.options.maxResumeChars || 40000;
        const len = p.resumeText.length;
        const tooLong = len > max;
        const jobMax = this.options.maxJobDescriptionChars || 20000;
        const jobLen = p.jobDescription.length;
        const casesMax = this.options.maxCaseStudiesChars || 30000;
        const casesLen = p.caseStudies.length;
        const exts = (this.options.supportedExtensions || []).filter(e => ['pdf', 'docx', 'txt', 'md'].includes(e)).map(e => e.toUpperCase()).join(', ');

        return html`
            <div class="container">
                <div class="titlebar">
                    <span class="spacer"></span>
                    <h1 class="title">My Profile &amp; Résumé</h1>
                    <button class="close-button" @click=${this.handleClose} title="Close">×</button>
                </div>
                <div class="subtitle">Answers are generated as if you were speaking, based on your real experience.</div>

                <div class="scroll-area" role="region" aria-label="Profile settings" tabindex="0">
                    <label class="toggle">
                        <input type="checkbox" .checked=${p.enabled} @change=${e => this._update('enabled', e.target.checked)}>
                        Use this profile when generating answers
                    </label>

                    <div class="row">
                        <div class="field">
                            <label>Your name (optional)</label>
                            <input type="text" .value=${p.displayName} placeholder="e.g. Ivan"
                                @input=${e => this._update('displayName', e.target.value)}>
                        </div>
                        <div class="field">
                            <label>Target role / context</label>
                            <input type="text" .value=${p.targetRole} placeholder="e.g. Engineering Manager interview"
                                @input=${e => this._update('targetRole', e.target.value)}>
                        </div>
                    </div>

                    <div class="field">
                        <div class="resume-toolbar">
                            <label for="job-description">Job description (optional)</label>
                            <span class="resume-meta ${jobLen > jobMax ? 'warn' : ''}">${jobLen.toLocaleString()} / ${jobMax.toLocaleString()} chars</span>
                        </div>
                        <textarea id="job-description" .value=${p.jobDescription}
                            aria-describedby="job-description-hint"
                            placeholder="Paste the vacancy: responsibilities, requirements, product and company context."
                            @input=${e => this._update('jobDescription', e.target.value)}></textarea>
                        <div id="job-description-hint" class="hint">Matches real examples to the vacancy. Without a vacancy, answers draw on 3–5 strong achievements from your résumé and cases, one relevant example at a time. Stored locally; included in requests to your selected AI model when this profile is enabled.</div>
                        ${jobLen > jobMax ? html`<div class="hint">Only the first ${jobMax.toLocaleString()} characters of the job description are sent to the model. The full text is saved.</div>` : ''}
                    </div>

                    <div class="field">
                        <div class="resume-toolbar">
                            <label>Résumé / experience</label>
                            <button class="btn" ?disabled=${this.busy || this.optimizing} @click=${this.handleImportFile}>Load file…</button>
                            <button class="btn" title="Condense the résumé with the selected LLM, keeping only what matters for interview answers"
                                ?disabled=${this.busy || this.optimizing || !p.resumeText.trim()} @click=${this.handleOptimize}>${this.optimizing ? 'Optimizing…' : 'Optimize'}</button>
                            ${this.resumeBackup !== null ? html`<button class="btn" ?disabled=${this.busy || this.optimizing} @click=${this.handleUndoOptimize}>Undo</button>` : ''}
                            <span class="resume-meta ${tooLong ? 'warn' : ''}">
                                ${p.resumeFileName ? `${p.resumeFileName} · ` : ''}${len.toLocaleString()} / ${max.toLocaleString()} chars
                            </span>
                        </div>
                        <textarea class="resume" .value=${p.resumeText}
                            placeholder="Paste your résumé here or load a file (${exts}). Roles, projects, tools, results, numbers — the more concrete, the better the answers."
                            @input=${e => this._update('resumeText', e.target.value)}></textarea>
                        ${tooLong ? html`<div class="hint">Only the first ${max.toLocaleString()} characters are sent to the model. Consider trimming older or less relevant parts.</div>` : ''}
                    </div>

                    <div class="field">
                        <div class="resume-toolbar">
                            <label for="case-studies">Interview cases (optional)</label>
                            <button class="btn" ?disabled=${this.busy || this.optimizing}
                                @click=${this.handleImportCasesFile}>Load cases…</button>
                            <span class="resume-meta ${casesLen > casesMax ? 'warn' : ''}">${casesLen.toLocaleString()} / ${casesMax.toLocaleString()} chars</span>
                        </div>
                        <textarea id="case-studies" class="resume" .value=${p.caseStudies}
                            aria-describedby="case-studies-hint case-studies-limit"
                            placeholder="Add confirmed stories: context, evidence, your contribution, choices and constraints, results. Label unknown details and hypothetical calculations clearly."
                            @input=${e => this._update('caseStudies', e.target.value)}></textarea>
                        <div id="case-studies-hint" class="hint">Saved separately from your résumé; Optimize does not change these cases. Ask selects one relevant example. Explicit corrections take priority over older résumé summaries; drafts and assumptions are not achievements. Stored locally and sent to your selected AI model when this profile is enabled.</div>
                        <div id="case-studies-limit" class="hint">${casesLen > casesMax
                            ? `Only the first ${casesMax.toLocaleString()} characters are sent to the model. The full text is saved; shorten it to keep all qualifications in context.`
                            : 'Include only facts you can explain in an interview, with baselines and limitations.'}</div>
                    </div>

                    <div class="field">
                        <label>Competence boundaries</label>
                        <select .value=${p.competenceMode} @change=${e => this._update('competenceMode', e.target.value)}>
                            ${this.options.competenceModes.map(m => html`<option value=${m.id} ?selected=${m.id === p.competenceMode}>${m.label}</option>`)}
                        </select>
                        <div class="hint">"Strict" keeps answers inside your real experience and makes the model reason like a person would on unfamiliar questions instead of sounding like it knows everything.</div>
                    </div>

                    <div class="field">
                        <label>What you know / don't know (optional)</label>
                        <textarea .value=${p.expertiseNotes}
                            placeholder="e.g. Strong: people management, roadmap planning, B2B SaaS. Weak: ML internals, low-level infra. Never worked in fintech."
                            @input=${e => this._update('expertiseNotes', e.target.value)}></textarea>
                    </div>

                    <div class="field">
                        <label for="answer-language-mode">Answer language</label>
                        <select id="answer-language-mode" .value=${p.answerLanguageMode} @change=${e => this._update('answerLanguageMode', e.target.value)}>
                            <option value="question" ?selected=${p.answerLanguageMode === 'question'}>Same as the question</option>
                            <option value="fixed" ?selected=${p.answerLanguageMode === 'fixed'}>Always use one language</option>
                        </select>
                        ${p.answerLanguageMode === 'fixed' ? html`
                            <label for="answer-language">Fixed language</label>
                            <input id="answer-language" type="text" .value=${p.answerLanguage} placeholder="e.g. English"
                                @input=${e => this._update('answerLanguage', e.target.value)}>` : ''}
                        <div class="hint">Follows each new question, including switches between English and Russian. Recognition language is set separately in Settings.</div>
                    </div>

                    <div class="field">
                        <label>Languages I know</label>
                        ${p.knownLanguages.map((entry, index) => html`
                            <div class="row">
                                <div class="field">
                                    <label for=${`known-language-${index}`}>Language ${index + 1}</label>
                                    <input id=${`known-language-${index}`} type="text" maxlength="60" .value=${entry.language}
                                        placeholder="e.g. English, Russian, Portuguese"
                                        @input=${e => this._updateKnownLanguage(index, 'language', e.target.value)}>
                                </div>
                                <div class="field">
                                    <label for=${`known-level-${index}`}>Your level</label>
                                    <select id=${`known-level-${index}`} .value=${entry.level}
                                        @change=${e => this._updateKnownLanguage(index, 'level', e.target.value)}>
                                        <option value="" ?selected=${!entry.level}>Choose level</option>
                                        ${this.options.languageLevels.map(l => html`<option value=${l.id} ?selected=${l.id === entry.level}>${l.label}</option>`)}
                                    </select>
                                </div>
                                <button class="btn" aria-label=${`Remove language ${index + 1}`}
                                    @click=${() => this._update('knownLanguages', p.knownLanguages.filter((_, i) => i !== index))}>×</button>
                            </div>`)}
                        <button class="btn" ?disabled=${p.knownLanguages.length >= (this.options.maxKnownLanguages || 12)}
                            @click=${() => this._update('knownLanguages', [...p.knownLanguages, { language: '', level: '' }])}>Add language</button>
                        <div class="hint">Each answer uses the level for its language: for example, English B2 and Russian Native. These are examples, not assumed levels. Vocabulary changes, not your experience or reasoning.</div>
                    </div>
                    <div class="field">
                        <label for="default-language-level">Default style for languages without a level</label>
                        <select id="default-language-level" .value=${p.languageLevel} @change=${e => this._update('languageLevel', e.target.value)}>
                            ${this.options.languageLevels.map(l => html`<option value=${l.id} ?selected=${l.id === p.languageLevel}>${l.label}</option>`)}
                        </select>
                        <div class="hint">Used only when the answer language is not listed above. Does not claim that you know an unlisted language.</div>
                    </div>

                    <div class="field">
                        <label for="extra-instructions">Extra instructions (optional)</label>
                        <textarea id="extra-instructions" .value=${p.extraInstructions}
                            placeholder="e.g. Keep answers under 40 seconds of speech. Always mention measurable results. Avoid corporate buzzwords."
                            @input=${e => this._update('extraInstructions', e.target.value)}></textarea>
                    </div>
                </div>

                <div class="footer">
                    <button class="btn danger" ?disabled=${this.busy} @click=${this.handleClear}>Clear</button>
                    <span class="spacer"></span>
                    <span class="status ${this.status?.kind || ''}" role="status" aria-live="polite">${this.status?.text || ''}</span>
                    <button class="btn primary" ?disabled=${this.busy || !this.dirty} @click=${this.handleSave}>Save</button>
                </div>
            </div>
        `;
    }
}

customElements.define('persona-view', PersonaView);
