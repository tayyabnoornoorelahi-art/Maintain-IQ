const express = require('express');
const router = express.Router();
const { query, queryOne, queryRun } = require('../../config/db.config');

function generateAssetCode() {
    const prefix = 'AST';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

// CREATE ASSET
router.post('/', async (req, res) => {
    try {
        const { name, category, location, description } = req.body;

        if (!name || !category || !location) {
            return res.status(400).json({ error: 'Name, category, and location are required' });
        }

        const code = generateAssetCode();
        await queryRun(
            `INSERT INTO assets (code, name, category, location, description, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [code, name, category, location, description || null, 'OPERATIONAL']
        );

        const asset = await queryOne('SELECT * FROM assets WHERE code = ?', [code]);
        if (!asset) {
            return res.status(500).json({ error: 'Failed to retrieve created asset' });
        }
        res.status(201).json({ message: 'Asset created successfully', asset });

    } catch (error) {
        console.error('Create asset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// LIST ASSETS
router.get('/', async (req, res) => {
    try {
        const assets = await query('SELECT * FROM assets ORDER BY created_at DESC');
        res.json({ assets: assets.rows });
    } catch (error) {
        console.error('List assets error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET SINGLE ASSET
router.get('/:id', async (req, res) => {
    try {
        const asset = await queryOne(
            'SELECT id, code, name, category, location, status, condition, description FROM assets WHERE id = ?',
            [req.params.id]
        );
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        const issues = await query(
            'SELECT * FROM issues WHERE asset_id = ? ORDER BY created_at DESC LIMIT 5',
            [req.params.id]
        );
        res.json({ asset, recent_issues: issues.rows });
    } catch (error) {
        console.error('Get asset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUBLIC ASSET
router.get('/public/:code', async (req, res) => {
    try {
        const asset = await queryOne(
            'SELECT id, code, name, category, location, status, condition, description FROM assets WHERE code = ?',
            [req.params.code]
        );
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.json({ asset });
    } catch (error) {
        console.error('Public asset error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;