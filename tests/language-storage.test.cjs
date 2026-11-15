// Run in Electron's Node mode (better-sqlite3 ABI). Only in-memory databases.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sqliteClient = require('../src/features/common/services/sqliteClient');
const schema = require('../src/features/common/config/schema');
const catalog = require('../src/features/common/config/sttLanguages');

test('schema migration and storage preserve existing users, cases, levels and fixed choices', async () => {
    const client = new sqliteClient.constructor();
    client.connect(':memory:');
    const db = client.getDb();
    const repo = file => {
        const context = { module: { exports: {} }, console, require(id) {
            if (id === '../../common/services/sqliteClient') return client;
            if (id === '../../common/config/sttLanguages') return catalog;
            throw new Error(id);
        } };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
        return context.module.exports;
    };
    try {
        client.createTable('users', { columns: schema.users.columns.filter(c => c.name !== 'stt_language') });
        client.createTable('persona_profile', { columns: schema.persona_profile.columns.filter(c => !['known_languages', 'answer_language_mode'].includes(c.name)) });
        db.exec("INSERT INTO users(uid,display_name,email,record_listen_sessions) VALUES('test','Keep name','',0)");
        db.exec("INSERT INTO persona_profile(uid,resume_text,case_studies,answer_language,language_level,updated_at) VALUES('test','Résumé','Confirmed cases','English','B2',123)");
        await client.synchronizeSchema();
        const settings = repo('src/features/settings/repositories/sqlite.repository.js');
        const persona = repo('src/features/persona/repositories/sqlite.repository.js');
        assert.equal(settings.getSttLanguage('test'), 'multi');
        assert.equal(persona.getProfile('test').answer_language, 'English');
        assert.equal(persona.getProfile('test').known_languages, null);
        for (const { id } of catalog.STT_LANGUAGES) {
            settings.setSttLanguage('test', id);
            assert.equal(settings.getSttLanguage('test'), id);
        }
        assert.throws(() => settings.setSttLanguage('test', 'xx'));
        const languages = JSON.stringify([{ language: 'English', level: 'B2' }, { language: 'Russian', level: 'native' }]);
        persona.saveProfile('test', { known_languages: languages, answer_language_mode: 'question' });
        persona.saveProfile('test', { extra_instructions: 'Changed from an older client' });
        await client.synchronizeSchema();
        const after = persona.getProfile('test');
        assert.equal(after.known_languages, languages);
        assert.equal(after.answer_language_mode, 'question');
        assert.equal(after.resume_text, 'Résumé');
        assert.equal(after.case_studies, 'Confirmed cases');
        assert.equal(after.language_level, 'B2');
        assert.equal(db.prepare('SELECT display_name FROM users WHERE uid=?').get('test').display_name, 'Keep name');
        assert.equal(settings.getRecordListen('test'), false);
        settings.setSttLanguage('new-user', 'ru');
        assert.equal(settings.getSttLanguage('new-user'), 'ru');
        persona.saveProfile('test', { known_languages: '[]' });
        assert.equal(persona.getProfile('test').known_languages, '[]');
    } finally { db.close(); }
});
