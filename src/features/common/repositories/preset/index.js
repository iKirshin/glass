const sqliteRepository = require('./sqlite.repository');
const authService = require('../../services/authService');

// Local mode: SQLite is the only storage backend.
function getBaseRepository() {
    return sqliteRepository;
}

const presetRepositoryAdapter = {
    getPresets: () => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().getPresets(uid);
    },

    getPresetTemplates: () => {
        return getBaseRepository().getPresetTemplates();
    },

    create: (options) => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().create({ uid, ...options });
    },

    update: (id, options) => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().update(id, options, uid);
    },

    delete: (id) => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().delete(id, uid);
    },
};

module.exports = presetRepositoryAdapter; 