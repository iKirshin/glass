<p align="center">
  <a href="https://pickle.com/glass">
   <img src="./public/assets/banner.gif" alt="Logo">
  </a>

  <h1 align="center">Glass by Pickle: Digital Mind Extension 🧠</h1>

</p>


<p align="center">
  <a href="https://discord.gg/UCZH5B5Hpd"><img src="./public/assets/button_dc.png" width="80" alt="Pickle Discord"></a>&ensp;<a href="https://pickle.com"><img src="./public/assets/button_we.png" width="105" alt="Pickle Website"></a>&ensp;<a href="https://x.com/intent/user?screen_name=leinadpark"><img src="./public/assets/button_xe.png" width="109" alt="Follow Daniel"></a>
</p>

> This project is a fork of [CheatingDaddy](https://github.com/sohzm/cheating-daddy) with modifications and enhancements. Thanks to [Soham](https://x.com/soham_btw) and all the open-source contributors who made this possible!

🤖 **Fast, light & open-source**—Glass lives on your desktop, sees what you see, listens in real time, understands your context, and turns every moment into structured knowledge.

💬 **Proactive in meetings**—it surfaces action items, summaries, and answers the instant you need them.

🫥️ **Truly invisible**—never shows up in screen recordings, screenshots, or your dock; no always-on capture or hidden sharing.

To have fun building with us, join our [Discord](https://discord.gg/UCZH5B5Hpd)!

## Instant Launch

⚡️  Skip the setup—launch instantly with our ready-to-run macOS app.  [[Download Here]](https://www.dropbox.com/scl/fi/znid09apxiwtwvxer6oc9/Glass_latest.dmg?rlkey=gwvvyb3bizkl25frhs4k1zwds&st=37q31b4w&dl=1)

## Quick Start (Local Build)

### Prerequisites

First download & install [Python](https://www.python.org/downloads/) and [Node](https://nodejs.org/en/download).
If you are using Windows, you need to also install [Build Tools for Visual Studio](https://visualstudio.microsoft.com/downloads/)

Ensure you're using Node.js version 20.x.x to avoid build errors with native dependencies.

```bash
# Check your Node.js version
node --version

# If you need to install Node.js 20.x.x, we recommend using nvm:
# curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
# nvm install 20
# nvm use 20
```

### Installation

```bash
npm run setup
```

## Highlights


### Ask: get answers based on all your previous screen actions & audio

<img width="100%" alt="booking-screen" src="./public/assets/00.gif">

### Meetings: real-time meeting notes, live summaries, session records

<img width="100%" alt="booking-screen" src="./public/assets/01.gif">

### Use your own API key, or sign up to use ours (free)

<img width="100%" alt="booking-screen" src="./public/assets/02.gif">

**Currently Supporting:**
- OpenAI API: Get OpenAI API Key [here](https://platform.openai.com/api-keys)
- Gemini API: Get Gemini API Key [here](https://aistudio.google.com/apikey)
- Local LLM Ollama & Whisper

### Liquid Glass Design (coming soon)

<img width="100%" alt="booking-screen" src="./public/assets/03.gif">

<p>
  for a more detailed guide, please refer to this <a href="https://www.youtube.com/watch?v=qHg3_4bU1Dw">video.</a>
  <i style="color:gray; font-weight:300;">
    we don't waste money on fancy vids; we just code.
  </i>
</p>


## Keyboard Shortcuts

`Ctrl/Cmd + \` : show and hide main window

`Ctrl/Cmd + Enter` : ask AI using all your previous screen and audio

`Ctrl/Cmd + Arrows` : move main window position

## Repo Activity

![Alt](https://repobeats.axiom.co/api/embed/a23e342faafa84fa8797fa57762885d82fac1180.svg "Repobeats analytics image")

## Contributing

We love contributions! Feel free to open issues for bugs or feature requests. For detailed guide, please see our [contributing guide](/CONTRIBUTING.md).
> Currently, we're working on a full code refactor and modularization. Once that's completed, we'll jump into addressing the major issues.

### Contributors

<a href="https://github.com/pickle-com/glass/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=pickle-com/glass" />
</a>

### Help Wanted Issues

We have a list of [help wanted](https://github.com/pickle-com/glass/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%F0%9F%99%8B%E2%80%8D%E2%99%82%EF%B8%8Fhelp%20wanted%22) that contain small features and bugs which have a relatively limited scope. This is a great place to get started, gain experience, and get familiar with our contribution process.


### 🛠 Current Issues & Improvements

| Status | Issue                          | Description                                       |
|--------|--------------------------------|---------------------------------------------------|
| 🚧 WIP      | Liquid Glass                    | Liquid Glass UI for MacOS 26 |

### Changelog

- Jul 5: Now support Gemini, Intel Mac supported
- Jul 6: Full code refactoring has done.
- Jul 7: Now support Claude, LLM/STT model selection
- Jul 8: Now support Windows(beta), Improved AEC by Rust(to seperate mic/system audio), shortcut editing(beta)
- Jul 8: Now support Local LLM & STT, Firebase Data Storage 

## 🍴 About this fork — InPro (iKirshin/glass)

**InPro (Interview Provider)** is a fork of [pickle-com/glass](https://github.com/pickle-com/glass) that turns the live-meeting co-pilot into a personal interview assistant: answers are generated *as you would say them*, based on your real résumé, within your real competence, at your real language level. It also makes it easy to plug in new AI models.

### Your profile & résumé

Settings → **My Profile & Résumé** opens a window where you can:

- **Load your résumé** as text or from a file (PDF, DOCX, TXT, Markdown). Answers then use your real roles, projects, tools and results as examples ("At Acme I…").
- **Add a job description** to match your real examples to the vacancy. Without one, Ask selects from 3–5 supported achievements and develops one relevant example per question.
- **Add interview cases** in the separate **Interview cases** field or use **Load cases…**. Keep context, evidence, personal contribution, choices, constraints, results and limitations together. Explicit corrections take precedence over older résumé summaries; drafts and hypothetical calculations are not treated as achievements. Résumé optimization does not modify your cases.
- **Set competence boundaries**:
  - *Strict* — only your real experience; on unfamiliar questions the answer admits the limit and reasons it through like a person would, instead of sounding omniscient.
  - *Balanced* (default) — your experience plus general professional knowledge, honest about depth.
  - *Open* — full knowledge, résumé used for examples.
  - Plus free-text notes about what you do and do not know.
- **List the languages you know**, with an individual level for each: Native, C2, C1, B2, B1, A2 or A1. Answers use the level for their language, not one shared level. The default style is used only for languages without an individual level; it is not evidence of language proficiency.
- **Choose the answer language**: “Same as the question” follows the latest interview question, including language switches, or “Always use one language” keeps a fixed language. Existing fixed-language profiles keep their choice and level until edited. The setting takes precedence over language instructions in the résumé or extra instructions.
- Add extra instructions (answer length, style, things to avoid).

The profile is stored locally in the app database (`persona_profile` table) and is injected into the system prompt of the *Ask* feature only when enabled. Prompt text lives in [`src/features/common/prompts/personaPrompt.js`](src/features/common/prompts/personaPrompt.js).

Ask has two per-session checkboxes beneath the question field:

- **Прикрепить экран** (Attach screen) is **off by default**. When enabled, each question includes a fresh screenshot; when disabled, Ask does not capture or send the screen.
- **Использовать резюме, кейсы и вакансию** (Use résumé, cases and vacancy) is **on by default**. Uncheck it for general questions to omit those materials, personal background notes and experience-selection guidance. Conversation context, answer language/proficiency and custom response instructions remain. Facts already present in the dialogue or custom instructions are not redacted.

These choices apply to Submit, Enter/the Ask shortcut and Listen suggestions. They survive clearing the answer and closing/reopening Ask, and reset to the defaults when the app restarts. They never edit or delete the saved profile. Turn personal context back on for questions about your experience.

Job descriptions and cases are editable in both the desktop profile and the local dashboard's **Interview Profile** page. Both fields are saved in full; when personal context is selected, requests include up to 20,000 characters of the vacancy and 30,000 characters of cases, with a warning in the form when exceeded. Selected profile context is sent to the chosen AI provider as part of Ask requests. Personal cases are not bundled with the application or committed to this repository.

Local regression checks (without AI requests or access to the user's database):

```bash
node --test tests/window-movement.test.cjs
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/window-movement.smoke.cjs
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron --test tests/persona-job-description.test.cjs
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron --test tests/stt-language.test.cjs tests/language-storage.test.cjs
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/language-ui.smoke.cjs
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/persona-profile.smoke.cjs
npm run build:renderer
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/persona-window.smoke.cjs
npm run build:web
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/persona-dashboard.smoke.cjs
```

The window smoke test loads the actual desktop HTML and app shell with synthetic profile data. It checks form scrolling, focus visibility and fixed header/footer at several window heights and 150% zoom. Trackpad/mouse scrolling should also be checked in the running app on an unlocked desktop.

### Recognition language

Settings → **Recognition language** is independent of the profile's answer language and CEFR levels. The menu includes regional entries for [Nova-3](https://developers.deepgram.com/docs/models-languages-overview). The hosted Nova-3 **Multilingual** mode covers [55 languages](https://developers.deepgram.com/changelog/2026/10/23), including Russian and English within the same conversation. Other STT providers may support fewer languages.

Changes apply on the next **Listen** start. The chosen language stays the same through timed renewal and automatic STT recovery. Valid Cyrillic or other non-Latin transcripts are no longer discarded by the text filter. `OPENAI_TRANSCRIBE_LANG` is no longer used as a hidden override; use the visible setting instead.

Language settings migrate locally without deleting the résumé, cases or recordings. No historical audio is retranscribed automatically. Local tests verify request parameters and prompt construction, not provider accuracy: validate with a new, consenting bilingual test call before relying on it in an interview. App version numbers change only on an explicit user request.

The main window can be dragged or moved with the configured arrow shortcuts beyond the screen edges. On macOS, `Cmd+Shift+Left` / `Cmd+Shift+Right` brings it back to a visible screen edge (on Windows/Linux, use `Ctrl` instead of `Cmd`). Explicit screen switching and initial settings/profile placement still keep those windows accessible. The movement smoke test verifies native offscreen positions and recovery without touching user data.

### Local mode (no cloud account)

InPro runs fully locally. The Google/Firebase login, the "use Pickle's key" proxy (Portkey) and the Firestore sync that existed in upstream Glass are removed:

- there is always one local user; API keys, sessions, transcripts, presets and the persona profile live in the local SQLite database;
- AI requests go directly from your machine to the provider you configured (OpenAI, Anthropic, Gemini, Deepgram) or to local Ollama / Whisper;
- no telemetry, no account, nothing leaves the device except the requests to the AI providers you chose.

The local web dashboard (`pickleglass_web`, served from `localhost`, opened via Settings → *Open Dashboard*) is rebranded and local-only: My Activity (session history), Interview Profile (the same persona settings as the desktop window) and a read-only overview of the configured AI models. Its Firebase login, billing and download pages are removed.

### Listen session recordings

Every Listen session is recorded as two WAV files (24 kHz mono): `me.wav` (microphone) and `them.wav` (system audio), under `<user data>/recordings/<timestamp>_<session>/` together with `meta.json`. Use them to re-listen to a call when transcription misbehaved. Toggle with **Record Listen Audio** in Settings; the last 20 recordings are kept. The STT service also logs audio flow every 10 s and automatically recreates the recognition sessions when sound is present but nothing is transcribed. The interviewer's channel passes through a speech band-pass (250–3800 Hz) and a peak limiter before recognition (**Clean Interviewer Audio** in Settings) to blunt loud bursts and out-of-band interference; recordings keep the raw audio.

### Runtime

Built on Electron 44 (upgraded from 30 so that content protection survives hide/show cycles on Windows, see Electron #45868). Requires macOS 13+; on Windows, full invisibility during screen sharing needs Windows 10 build 19041+ or Windows 11 (older builds show the windows as black rectangles, and the app warns about it at startup and in Settings); native modules (better-sqlite3 13, sharp 0.35, keytar) are rebuilt by `npm install`.

### Branding

The app is renamed to **InPro** (`appId: com.ikirshin.inpro`), so it installs and stores its data separately from the original Glass; auto-updates point at this repository's releases. Login via the original Pickle backend is still present but optional.

### Plugging in new AI models

**What changed**

- The answer-model picker includes GPT-6.2 Sol / Astra, GPT-6.1 Sol / Terra, GPT-6 Astra / Luna, Claude Sonnet 5.5 / Opus 5.5 / Haiku 5.5 / Fable 5.2, and Gemini 4 Hydrogen / Carbon / Neon / Argon / 3.8 Flash / 3.5 Flash-Lite. November 24 additions use Standard API prices. Carbon and Argon move to $4 / $20 per 1M on December 1. Fable 5.2 requires 30-day retention by Anthropic. Saved previous-generation choices remain selectable. A saved `gpt-5.6` choice resolves to `gpt-5.6-sol` without changing the stored setting.
- Prices use `$4 / $20 per 1M` (USD, uncached input / output, standard API). Hover a price for the check date, provider source and pricing conditions. The catalog applies announced changes for Argon and Flash on their effective dates. After the GPT-5.6 Sol promotion expires, the app marks its rate as unconfirmed until the catalog has a verified rate.
- Providers use compatible answer parameters: GPT reasoning models use `max_completion_tokens`, low effort and no `temperature`; new Claude 5.5 models omit sampling params and use low effort for live answers; Argon omits deprecated sampling params. Only answer text, not thinking blocks, is displayed. Model access still depends on the configured provider account.
- **Custom models**: any model id can be registered for an API-based provider without code changes.

**Adding a model from the UI**

Open Settings → *Change LLM Model* / *Change STT Model* → at the bottom of the list pick the provider, type the model id (for example `gpt-5.6-terra` or `claude-opus-4-8`) and press *Add*. The model is saved and selected immediately.

**Adding a model by editing a file**

Custom models live in `custom-models.json` inside the app's user-data directory (`~/Library/Application Support/Glass/` on macOS, `%APPDATA%/Glass/` on Windows). Restart the app after editing it:

```json
{
  "openai":    { "llmModels": [{ "id": "gpt-5.6-terra", "name": "GPT-5.6 Terra" }] },
  "anthropic": { "llmModels": [{ "id": "claude-opus-4-8", "name": "Claude Opus 4.8" }] },
  "gemini":    { "sttModels": [{ "id": "gemini-3.1-flash-live-preview", "name": "Gemini 3.1 Flash Live" }] }
}
```

**Adding a model permanently / adding a new provider**

Built-in models are declared in [`src/features/common/ai/factory.js`](src/features/common/ai/factory.js) (`PROVIDERS`). A new provider needs a module in `src/features/common/ai/providers/` exporting `createLLM`, `createStreamingLLM` and/or `createSTT`, plus an entry in `PROVIDERS` and in the `classNameMap` of `getProviderClass`.


## About Pickle

**Our mission is to build a living digital clone for everyone.** Glass is part of Step 1—a trusted pipeline that transforms your daily data into a scalable clone. Visit [pickle.com](https://pickle.com) to learn more.

## Star History
[![Star History Chart](https://api.star-history.com/svg?repos=pickle-com/glass&type=Date)](https://www.star-history.com/#pickle-com/glass&Date)
