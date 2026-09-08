const express = require('express');
const router = express.Router();
const { ipcRequest } = require('../ipcBridge');

// Interview profile (résumé, competence boundaries, language level)
router.get('/', async (req, res) => {
    try {
        res.json(await ipcRequest(req, 'get-persona'));
    } catch (error) {
        console.error('Failed to get persona via IPC:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

router.get('/options', async (req, res) => {
    try {
        res.json(await ipcRequest(req, 'get-persona-options'));
    } catch (error) {
        console.error('Failed to get persona options via IPC:', error);
        res.status(500).json({ error: 'Failed to get profile options' });
    }
});

router.put('/', async (req, res) => {
    try {
        res.json(await ipcRequest(req, 'save-persona', req.body));
    } catch (error) {
        console.error('Failed to save persona via IPC:', error);
        res.status(500).json({ error: 'Failed to save profile' });
    }
});

router.delete('/', async (req, res) => {
    try {
        await ipcRequest(req, 'delete-persona');
        res.json({ message: 'Profile removed' });
    } catch (error) {
        console.error('Failed to delete persona via IPC:', error);
        res.status(500).json({ error: 'Failed to remove profile' });
    }
});

module.exports = router;
