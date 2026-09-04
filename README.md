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
- **Set competence boundaries**:
  - *Strict* — only your real experience; on unfamiliar questions the answer admits the limit and reasons it through like a person would, instead of sounding omniscient.
  - *Balanced* (default) — your experience plus general professional knowledge, honest about depth.
  - *Open* — full knowledge, résumé used for examples.
  - Plus free-text notes about what you do and do not know.
- **Pick a language level (CEFR)**: native, C2, C1, B2, B1, A2. The wording of answers is adapted to that level (vocabulary, sentence length, natural non-native phrasing) so it sounds like you speaking, and optionally a fixed answer language.
- Add extra instructions (answer length, style, things to avoid).

The profile is stored locally in the app database (`persona_profile` table) and is injected into the system prompt of the *Ask* feature only when enabled. Prompt text lives in [`src/features/common/prompts/personaPrompt.js`](src/features/common/prompts/personaPrompt.js).

### Local mode (no cloud account)

InPro runs fully locally. The Google/Firebase login, the "use Pickle's key" proxy (Portkey) and the Firestore sync that existed in upstream Glass are removed:

- there is always one local user; API keys, sessions, transcripts, presets and the persona profile live in the local SQLite database;
- AI requests go directly from your machine to the provider you configured (OpenAI, Anthropic, Gemini, Deepgram) or to local Ollama / Whisper;
- no telemetry, no account, nothing leaves the device except the requests to the AI providers you chose.

The local web dashboard (history, presets) is still bundled and served from `localhost`.

### Branding

The app is renamed to **InPro** (`appId: com.ikirshin.inpro`), so it installs and stores its data separately from the original Glass; auto-updates point at this repository's releases. Login via the original Pickle backend is still present but optional.

### Plugging in new AI models

**What changed**

- Built-in LLM catalog contains only current models: OpenAI GPT-5.6 family, Claude Opus 5 / Sonnet 5 / Haiku 4.5, Gemini 3.8 Flash / 3.1 Pro. Older ones (GPT-4.1, Gemini 2.5) can still be added as custom models.
- The model picker shows list prices next to each model (per 1K tokens in/out for LLMs, per minute of audio for STT). Prices are hard-coded in `factory.js` as of Sep 2026; update them there when providers change pricing.
- Providers now handle the newer model families correctly (reasoning models use `max_completion_tokens` and no `temperature`; Claude 4.7+ models omit sampling params; text is extracted from text blocks only).
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
