// Safe stand-in for IPC: the real renderer, but no database, audio or provider access.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
    platform: { isLinux: false, isMacOS: process.platform === 'darwin' },
    renderer: { onChangeListenCaptureState() {} },
    listenCapture: { onSystemAudioData() {} },
    pickleGlassApp: { onClickThroughToggled() {}, removeAllClickThroughListeners() {} },
    personaView: {
        getOptions: async () => ({
            competenceModes: [{ id: 'balanced', label: 'Balanced' }],
            languageLevels: [{ id: 'B2', label: 'B2' }],
            maxResumeChars: 40000, maxJobDescriptionChars: 20000, maxCaseStudiesChars: 30000,
            supportedExtensions: ['txt', 'md'],
        }),
        getProfile: async () => ({
            enabled: 1, display_name: 'Test profile', target_role: 'Product Manager',
            resume_text: 'Example work experience.\n'.repeat(200),
            resume_file_name: 'example-resume.txt',
            case_studies: 'Confirmed example case with evidence and limitations.\n'.repeat(200),
            job_description: 'Example role requirements.\n'.repeat(100),
            extra_instructions: 'Use confirmed facts.\n'.repeat(90),
            competence_mode: 'balanced', language_level: 'B2', answer_language: 'English',
        }),
    },
});
