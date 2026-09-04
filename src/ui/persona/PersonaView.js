import { html, css, LitElement } from '../../ui/assets/lit-core-2.7.4.min.js';

export class PersonaView extends LitElement {
    static styles = css`
        * { font-family:'Helvetica Neue',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            box-sizing:border-box; }

        :host { display:flex; width:100%; height:100%; color:white; }

        .container { display:flex; flex-direction:column; height:100%; width:100%;
            background:rgba(20,20,20,.92); border-radius:12px;
            outline:.5px rgba(255,255,255,.2) solid; outline-offset:-1px;
            position:relative; overflow:hidden; padding:12px; }

        .close-button{position:absolute;top:10px;right:10px;inline-size:16px;block-size:16px;
            background:rgba(255,255,255,.1);border:none;border-radius:3px;
            color:rgba(255,255,255,.7);display:grid;place-items:center;
            font-size:14px;line-height:0;cursor:pointer;transition:.15s;z-index:10;}
        .close-button:hover{background:rgba(255,255,255,.2);color:rgba(255,255,255,.9);}

        .title{font-size:14px;font-weight:500;margin:0 0 4px;padding-bottom:8px;
            border-bottom:1px solid rgba(255,255,255,.1);text-align:center;}
        .subtitle{font-size:11px;color:rgba(255,255,255,.55);text-align:center;margin-bottom:8px;}

        .scroll-area{flex:1 1 auto;min-height:0;overflow-y:auto;margin:0 -4px;padding:4px;display:flex;flex-direction:column;gap:10px;}

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
            border-top:1px solid rgba(255,255,255,.1);}
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
        dirty: { type: Boolean, state: true },
    };

    constructor() {
        super();
        this.profile = this._emptyProfile();
        this.options = { competenceModes: [], languageLevels: [], maxResumeChars: 40000, supportedExtensions: [] };
        this.status = null;
        this.busy = false;
        this.dirty = false;
    }

    _emptyProfile() {
        return {
            enabled: true,
            displayName: '',
            targetRole: '',
            resumeText: '',
            resumeFileName: '',
            competenceMode: 'balanced',
            expertiseNotes: '',
            languageLevel: 'native',
            answerLanguage: '',
            extraInstructions: '',
        };
    }

    _fromRow(row) {
        if (!row) return this._emptyProfile();
        return {
            enabled: row.enabled === null || row.enabled === undefined ? true : !!row.enabled,
            displayName: row.display_name || '',
            targetRole: row.target_role || '',
            resumeText: row.resume_text || '',
            resumeFileName: row.resume_file_name || '',
            competenceMode: row.competence_mode || 'balanced',
            expertiseNotes: row.expertise_notes || '',
            languageLevel: row.language_level || 'native',
            answerLanguage: row.answer_language || '',
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

    async handleSave() {
        this.busy = true;
        try {
            const result = await window.api.personaView.saveProfile({
                ...this.profile,
                resume_file_name: this.profile.resumeFileName,
            });
            if (result?.success) {
                this.dirty = false;
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
        if (!confirm('Remove the saved profile and résumé?')) return;
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
        window.api.personaView.closeWindow();
    }

    render() {
        const p = this.profile;
        const max = this.options.maxResumeChars || 40000;
        const len = p.resumeText.length;
        const tooLong = len > max;
        const exts = (this.options.supportedExtensions || []).filter(e => ['pdf', 'docx', 'txt', 'md'].includes(e)).map(e => e.toUpperCase()).join(', ');

        return html`
            <div class="container">
                <button class="close-button" @click=${this.handleClose} title="Close">×</button>
                <h1 class="title">My Profile &amp; Résumé</h1>
                <div class="subtitle">Answers are generated as if you were speaking, based on your real experience.</div>

                <div class="scroll-area">
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
                            <label>Résumé / experience</label>
                            <button class="btn" ?disabled=${this.busy} @click=${this.handleImportFile}>Load file…</button>
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

                    <div class="row">
                        <div class="field">
                            <label>Language level (CEFR)</label>
                            <select .value=${p.languageLevel} @change=${e => this._update('languageLevel', e.target.value)}>
                                ${this.options.languageLevels.map(l => html`<option value=${l.id} ?selected=${l.id === p.languageLevel}>${l.label}</option>`)}
                            </select>
                        </div>
                        <div class="field">
                            <label>Answer language (optional)</label>
                            <input type="text" .value=${p.answerLanguage} placeholder="e.g. English (default: same as question)"
                                @input=${e => this._update('answerLanguage', e.target.value)}>
                        </div>
                    </div>
                    <div class="hint">B1/B2/C1 make the wording match how you actually speak the language: simpler vocabulary, shorter sentences, natural non-native phrasing.</div>

                    <div class="field">
                        <label>Extra instructions (optional)</label>
                        <textarea .value=${p.extraInstructions}
                            placeholder="e.g. Keep answers under 40 seconds of speech. Always mention measurable results. Avoid corporate buzzwords."
                            @input=${e => this._update('extraInstructions', e.target.value)}></textarea>
                    </div>
                </div>

                <div class="footer">
                    <button class="btn danger" ?disabled=${this.busy} @click=${this.handleClear}>Clear</button>
                    <span class="spacer"></span>
                    ${this.status ? html`<span class="status ${this.status.kind}">${this.status.text}</span>` : ''}
                    <button class="btn primary" ?disabled=${this.busy || !this.dirty} @click=${this.handleSave}>Save</button>
                </div>
            </div>
        `;
    }
}

customElements.define('persona-view', PersonaView);
