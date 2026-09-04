// The persona profile (résumé, competence limits, language level) is personal data,
// so it is always stored locally in SQLite regardless of the login state.
const sqliteRepository = require('./sqlite.repository');
const authService = require('../../common/services/authService');

module.exports = {
    getProfile: () => sqliteRepository.getProfile(authService.getCurrentUserId()),
    saveProfile: (profile) => sqliteRepository.saveProfile(authService.getCurrentUserId(), profile),
    deleteProfile: () => sqliteRepository.deleteProfile(authService.getCurrentUserId()),
};
