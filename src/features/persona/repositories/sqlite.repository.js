const sqliteClient = require('../../common/services/sqliteClient');

const COLUMNS = [
    'enabled', 'display_name', 'target_role', 'resume_text', 'resume_file_name',
    'competence_mode', 'expertise_notes', 'language_level', 'answer_language', 'extra_instructions',
];

function getProfile(uid) {
    const db = sqliteClient.getDb();
    return db.prepare('SELECT * FROM persona_profile WHERE uid = ?').get(uid) || null;
}

function saveProfile(uid, profile) {
    const db = sqliteClient.getDb();
    const existing = getProfile(uid) || {};
    const merged = { ...existing, ...profile };
    const values = COLUMNS.map(col => {
        if (col === 'enabled') return merged.enabled === undefined || merged.enabled === null ? 1 : (merged.enabled ? 1 : 0);
        return merged[col] === undefined ? null : merged[col];
    });
    const placeholders = COLUMNS.map(() => '?').join(', ');
    const updates = COLUMNS.map(col => `${col} = excluded.${col}`).join(', ');
    db.prepare(`
        INSERT INTO persona_profile (uid, ${COLUMNS.join(', ')}, updated_at)
        VALUES (?, ${placeholders}, ?)
        ON CONFLICT(uid) DO UPDATE SET ${updates}, updated_at = excluded.updated_at
    `).run(uid, ...values, Date.now());
    return getProfile(uid);
}

function deleteProfile(uid) {
    const db = sqliteClient.getDb();
    return db.prepare('DELETE FROM persona_profile WHERE uid = ?').run(uid).changes > 0;
}

module.exports = { getProfile, saveProfile, deleteProfile };
