const express = require('express');
const router = express.Router();
const { query, queryOne, queryRun } = require('../../config/db.config');

// ============================================
// REPORT ISSUE - Fixed with assignment
// ============================================
router.post('/', async (req, res) => {
    try {
        const { assetId, title, description, priority, category, technicianId } = req.body;
        
        console.log('📝 Reporting issue:', { assetId, title, description, priority, category, technicianId });
        
        // Generate issue number
        const count = await queryOne('SELECT COUNT(*) as count FROM issues');
        const number = `ISS-${new Date().getFullYear()}-${String((count?.count || 0) + 1).padStart(4, '0')}`;
        
        // If technicianId is provided, assign it, otherwise leave unassigned
        const assignedTo = technicianId || null;
        const status = assignedTo ? 'ASSIGNED' : 'REPORTED';
        
        await queryRun(
            `INSERT INTO issues (number, title, description, priority, category, asset_id, status, assigned_to)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [number, title, description, priority, category, assetId, status, assignedTo]
        );
        
        const issue = await queryOne('SELECT * FROM issues WHERE number = ?', [number]);
        
        // Update asset status
        await queryRun(
            'UPDATE assets SET status = ? WHERE id = ?',
            ['ISSUE_REPORTED', assetId]
        );
        
        res.status(201).json({
            message: 'Issue reported successfully',
            issue: issue
        });
        
    } catch (error) {
        console.error('❌ Report issue error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET MY ASSIGNED ISSUES (Technician)
// ============================================
router.get('/my/:userId', async (req, res) => {
    try {
        console.log('📋 Getting issues for technician:', req.params.userId);
        
        const issues = await query(
            `SELECT i.*, a.name as asset_name, a.code as asset_code
             FROM issues i
             LEFT JOIN assets a ON i.asset_id = a.id
             WHERE i.assigned_to = ?
             ORDER BY i.created_at DESC`,
            [req.params.userId]
        );
        
        console.log(`✅ Found ${issues.rows.length} issues for technician`);
        res.json({ issues: issues.rows });
        
    } catch (error) {
        console.error('❌ Get my issues error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET ALL ISSUES (Admin)
// ============================================
router.get('/', async (req, res) => {
    try {
        const issues = await query(
            `SELECT i.*, a.name as asset_name, a.code as asset_code
             FROM issues i
             LEFT JOIN assets a ON i.asset_id = a.id
             ORDER BY i.created_at DESC`
        );
        
        res.json({ issues: issues.rows });
        
    } catch (error) {
        console.error('❌ List issues error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET ALL TECHNICIANS (For assignment)
// ============================================
router.get('/technicians', async (req, res) => {
    try {
        const technicians = await query(
            `SELECT id, name, email FROM users WHERE role = 'TECHNICIAN' OR role = 'ADMIN'`
        );
        res.json({ technicians: technicians.rows });
        
    } catch (error) {
        console.error('❌ Get technicians error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET SINGLE ISSUE
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const issue = await queryOne(
            `SELECT i.*, a.name as asset_name, a.code as asset_code
             FROM issues i
             LEFT JOIN assets a ON i.asset_id = a.id
             WHERE i.id = ?`,
            [req.params.id]
        );
        
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        
        res.json({ issue });
        
    } catch (error) {
        console.error('❌ Get issue error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ASSIGN ISSUE TO TECHNICIAN (Admin)
// ============================================
router.put('/:id/assign', async (req, res) => {
    try {
        const { technicianId } = req.body;
        
        console.log('📝 Assigning issue:', req.params.id, 'to technician:', technicianId);
        
        const result = await queryRun(
            `UPDATE issues SET assigned_to = ?, status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [technicianId, req.params.id]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        
        const issue = await queryOne('SELECT * FROM issues WHERE id = ?', [req.params.id]);
        console.log('✅ Issue assigned:', issue);
        res.json({ message: 'Issue assigned successfully', issue });
        
    } catch (error) {
        console.error('❌ Assign issue error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// UPDATE ISSUE STATUS (Technician)
// ============================================
router.put('/:id/status', async (req, res) => {
    try {
        const { status, technicianNotes, userId } = req.body;
        
        console.log('📝 Updating issue status:', req.params.id, 'to:', status);
        
        // Check if issue exists
        const issue = await queryOne('SELECT * FROM issues WHERE id = ?', [req.params.id]);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        
        // Check if technician is assigned (or if admin is updating)
        if (issue.assigned_to && issue.assigned_to !== userId) {
            // Check if user is admin
            const user = await queryOne('SELECT role FROM users WHERE id = ?', [userId]);
            if (!user || user.role !== 'ADMIN') {
                return res.status(403).json({ error: 'You are not assigned to this issue' });
            }
        }
        
        // Update status
        await queryRun(
            `UPDATE issues SET status = ?, technician_notes = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, technicianNotes || null, req.params.id]
        );
        
        // Update asset status based on issue status
        if (status === 'RESOLVED' || status === 'CLOSED') {
            await queryRun(
                'UPDATE assets SET status = ? WHERE id = ?',
                ['OPERATIONAL', issue.asset_id]
            );
        } else if (status === 'INSPECTION_STARTED') {
            await queryRun(
                'UPDATE assets SET status = ? WHERE id = ?',
                ['UNDER_INSPECTION', issue.asset_id]
            );
        } else if (status === 'MAINTENANCE_IN_PROGRESS') {
            await queryRun(
                'UPDATE assets SET status = ? WHERE id = ?',
                ['UNDER_MAINTENANCE', issue.asset_id]
            );
        }
        
        const updatedIssue = await queryOne('SELECT * FROM issues WHERE id = ?', [req.params.id]);
        console.log('✅ Issue status updated:', updatedIssue);
        res.json({ message: 'Status updated successfully', issue: updatedIssue });
        
    } catch (error) {
        console.error('❌ Update status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET ALL TECHNICIANS (For assignment)
// ============================================
router.get('/technicians', async (req, res) => {
    try {
        const technicians = await query(
            `SELECT id, name, email FROM users WHERE role = 'TECHNICIAN' OR role = 'ADMIN'`
        );
        res.json({ technicians: technicians.rows });
        
    } catch (error) {
        console.error('❌ Get technicians error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;