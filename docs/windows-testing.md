# Windows test plan (for a Claude Code session on the Windows laptop)

This file is a self-contained brief. Paste the "Prompt" section below into Claude Code
opened in the cloned repository on the Windows machine; it drives the whole check and
writes a report that is committed to git so it can be reviewed from another machine.

## Prompt

You are testing the InPro desktop app (Electron overlay for interviews) on this Windows
machine. Work autonomously; only ask me when a step needs a physical action (start a
Zoom/Teams/Meet screen share) and tell me exactly what to do and what to look at.

1. Environment
   - Record Windows edition and build (`[System.Environment]::OSVersion` in PowerShell,
     `winver`), Node version, npm version, git commit (`git rev-parse --short HEAD`),
     branch (`feature/persona-profile`).
2. Build and run from source
   - `npm install` (must rebuild better-sqlite3, keytar, sharp for Electron 44 without
     compiler errors), `npm run build:web`, `npm start`.
   - Capture the terminal output to `docs/test-reports/windows-<yyyy-mm-dd>-startup.log`.
   - Note: the `[Platform] Invisibility support: ...` line must say `full` on
     Windows 10 build 19041+ / Windows 11. If a warning dialog about limited invisibility
     appears on a modern Windows, that is a bug: report it.
3. First-run flow
   - Welcome screen → "Enter Your API Key" → enter the OpenAI key I provide (ask me),
     STT = OpenAI → Confirm. Check that the main header (Listen / Ask / ⋯) appears and all
     buttons react to clicks; the header can be dragged.
4. Invisibility (the key test)
   - For each of Zoom, Microsoft Teams, Google Meet in Chrome, Google Meet in Edge that is
     available: ask me to start sharing the ENTIRE screen and describe whether the InPro
     header, the Listen window (press Listen), the Ask window (Ctrl+Enter) and the settings
     menu (⋯) are (a) invisible, (b) black rectangles, (c) fully visible in the share preview.
   - Then press Ctrl+\ twice (hide/show all windows), open and close the ⋯ menu, open Ask,
     and check the share preview again — this is the regression the Electron 44 upgrade
     fixes.
   - Also: Win+Shift+S (Snipping Tool) and Win+G (Game Bar recording) — same three-way
     answer. "Share a window" in Zoom/Teams: the InPro windows must not be offered.
5. Listen / transcription
   - Press Listen, speak a sentence in English; play any video with speech (YouTube) for
     30 s. Collect the `[SystemAudio]`, `[SttService]`, `[listenCapture]` and
     `Transcription complete` lines. Expected: `mic=...(1.00x)`, transcripts for both Me and
     Them, no `STT Session Error`.
   - Report which audio path was used for system audio on Windows and whether it works.
6. Ask
   - After the transcript exists, press Ctrl+Enter with the Ask input empty; then type a
     question and Submit. Report whether an answer streams, and whether Esc / the stop-clear
     button / the close button behave as described in the README.
7. Profile
   - Settings (⋯) → My Profile & Résumé: paste any text, set Strict + B2, Save, close the
     window with the ✕ (must be clickable), reopen and check it persisted. Try dragging the
     window by its title.
8. Installer (optional if time allows)
   - `npm run build:win`; report whether `dist\InPro Setup 0.2.4.exe` is produced and
     installs (SmartScreen warning is expected: More info → Run anyway).
9. Report
   - Write `docs/test-reports/windows-<yyyy-mm-dd>.md` with: environment, a table of every
     check above with PASS / FAIL / SKIPPED and observations, the exact error lines for any
     failure, and screenshots saved next to it if something is visible in a share.
   - Commit the report and the log on a new branch `test/windows-<yyyy-mm-dd>` and push it
     to origin (`iKirshin/glass`). Do not commit API keys; never paste the key into the
     report.

## What I will do with the report
The macOS side reads the branch, fixes what failed and pushes to `feature/persona-profile`;
then rerun the failed steps.
