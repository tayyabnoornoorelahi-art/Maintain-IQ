const express = require('express');
const router = express.Router();
const { query, queryOne, queryRun } = require('../../config/db.config');

// ============================================
// HELPER: Generate unique asset code
// ============================================
function generateAssetCode() {
    const prefix = 'AST';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

// ============================================
// CREATE ASSET
// ============================================
router.post('/', async (req, res) => {
    try {
        console.log('📝 Creating asset with data:', req.body);
        
        const { name, category, location, description, purchaseDate, warrantyExpiry } = req.body;
        
        // Validate required fields
        if (!name || !category || !location) {
            return res.status(400).json({ 
                error: 'Name, category, and location are required' 
            });
        }
        
        // Generate unique code
        const code = generateAssetCode();
        console.log('🔑 Generated code:', code);
        
        // Insert asset
        const result = await queryRun(
            `INSERT INTO assets (code, name, category, location, description, purchase_date, warranty_expiry)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [code, name, category, location, description || null, purchaseDate || null, warrantyExpiry || null]
        );
        
        console.log('✅ Insert result - lastID:', result.lastID);
        
        // Get the created asset using rowid (SQLite's internal ID)
        let asset = null;
        
        // Try to get by rowid first
        if (result.lastID) {
            asset = await queryOne(
                'SELECT * FROM assets WHERE rowid = ?',
                [result.lastID]
            );
        }
        
        // If not found, try by code
        if (!asset) {
            asset = await queryOne(
                'SELECT * FROM assets WHERE code = ?',
                [code]
            );
        }
        
        // If still not found, get the most recent
        if (!asset) {
            const allAssets = await query('SELECT * FROM assets ORDER BY created_at DESC LIMIT 1');
            if (allAssets.rows && allAssets.rows.length > 0) {
                asset = allAssets.rows[0];
            }
        }
        
        if (!asset) {
            return res.status(500).json({ 
                error: 'Failed to retrieve created asset',
                debug: { lastID: result.lastID, code: code }
            });
        }
        
        console.log('📦 Created asset:', asset);
        
        // Create history entry
        await queryRun(
            `INSERT INTO asset_history (asset_id, action, details)
             VALUES (?, ?, ?)`,
            [asset.id, 'Asset Created', JSON.stringify({ name: asset.name, code: asset.code })]
        );
        
        res.status(201).json({
            message: 'Asset created successfully',
            asset: asset
        });
        
    } catch (error) {
        console.error('❌ Create asset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// LIST ALL ASSETS
// ============================================
router.get('/', async (req, res) => {
    try {
        const assets = await query(
            `SELECT a.*, 
                    (SELECT COUNT(*) FROM issues WHERE asset_id = a.id AND status != 'CLOSED') as open_issues
             FROM assets a
             ORDER BY a.created_at DESC`
        );
        
        res.json({ assets: assets.rows });
        
    } catch (error) {
        console.error('List assets error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET SINGLE ASSET
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const asset = await queryOne(
            `SELECT a.*,
                    (SELECT COUNT(*) FROM issues WHERE asset_id = a.id AND status != 'CLOSED') as open_issues
             FROM assets a
             WHERE a.id = ?`,
            [req.params.id]
        );
        
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        
        // Get recent issues
        const issues = await query(
            `SELECT * FROM issues WHERE asset_id = ? ORDER BY created_at DESC LIMIT 5`,
            [req.params.id]
        );
        
        // Get recent history
        const history = await query(
            `SELECT * FROM asset_history WHERE asset_id = ? ORDER BY created_at DESC LIMIT 10`,
            [req.params.id]
        );
        
        res.json({
            asset,
            recent_issues: issues.rows,
            recent_history: history.rows
        });
        
    } catch (error) {
        console.error('Get asset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET ASSET BY CODE (Public)
// ============================================
router.get('/public/:code', async (req, res) => {
    try {
        const asset = await queryOne(
            `SELECT id, code, name, category, location, status, condition, 
                    description, last_service, next_service
             FROM assets 
             WHERE code = ?`,
            [req.params.code]
        );
        
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        
        // Get recent public activity
        const history = await query(
            `SELECT action, created_at FROM asset_history 
             WHERE asset_id = ? 
             ORDER BY created_at DESC LIMIT 5`,
            [asset.id]
        );
        
        res.json({
            asset,
            recent_activity: history.rows
        });
        
    } catch (error) {
        console.error('Public asset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// UPDATE ASSET
// ============================================
router.put('/:id', async (req, res) => {
    try {
        const { name, category, location, status, condition, description } = req.body;
        
        const result = await queryRun(
            `UPDATE assets 
             SET name = ?, category = ?, location = ?, status = ?, 
                 condition = ?, description = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, category, location, status, condition, description, req.params.id]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        
        const asset = await queryOne('SELECT * FROM assets WHERE id = ?', [req.params.id]);
        
        res.json({
            message: 'Asset updated successfully',
            asset
        });
        
    } catch (error) {
        console.error('Update asset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// DELETE ASSET (Soft delete - mark as retired)
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const result = await queryRun(
            `UPDATE assets SET status = 'RETIRED', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [req.params.id]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        
        res.json({ message: 'Asset retired successfully' });
        
    } catch (error) {
        console.error('Delete asset error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;