const express = require('express');
const router = express.Router();
const { query, queryOne, queryRun } = require('../../config/db.config');

// REPORT ISSUE
router.post('/', async (req, res) => {
    try {
        const { assetId, title, description, priority, category, technicianId } = req.body;

        if (!assetId || !title || !description) {
            return res.status(400).json({ error: 'Asset, title, and description are required' });
        }

        const count = await queryOne('SELECT COUNT(*) as count FROM issues');
        const number = `ISS-${new Date().getFullYear()}-${String((count?.count || 0) + 1).padStart(4, '0')}`;
        
        const assignedTo = technicianId || null;
        const status = assignedTo ? 'ASSIGNED' : 'REPORTED';

        await queryRun(
            `INSERT INTO issues (number, title, description, priority, category, asset_id, status, assigned_to)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [number, title, description, priority, category, assetId, status, assignedTo]
        );

        const issue = await queryOne('SELECT * FROM issues WHERE number = ?', [number]);
        if (!issue) {
            return res.status(500).json({ error: 'Failed to retrieve created issue' });
        }

        await queryRun('UPDATE assets SET status = ? WHERE id = ?', ['ISSUE_REPORTED', assetId]);

        res.status(201).json({ message: 'Issue reported successfully', issue });

    } catch (error) {
        console.error('Report issue error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET MY ISSUES (Technician)
router.get('/my/:userId', async (req, res) => {
    try {
        const issues = await query(
            `SELECT i.*, a.name as asset_name, a.code as asset_code 
             FROM issues i 
             LEFT JOIN assets a ON i.asset_id = a.id 
             WHERE i.assigned_to = ? 
             ORDER BY i.created_at DESC`,
            [req.params.userId]
        );
        res.json({ issues: issues.rows });
    } catch (error) {
        console.error('Get my issues error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET SINGLE ISSUE
router.get('/:id', async (req, res) => {
    try {
        const issue = await queryOne('SELECT * FROM issues WHERE id = ?', [req.params.id]);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        res.json({ issue });
    } catch (error) {
        console.error('Get issue error:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE STATUS
router.put('/:id/status', async (req, res) => {
    try {
        const { status, technicianNotes, userId } = req.body;

        const issue = await queryOne('SELECT * FROM issues WHERE id = ?', [req.params.id]);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        if (issue.assigned_to && issue.assigned_to !== userId) {
            const user = await queryOne('SELECT role FROM users WHERE id = ?', [userId]);
            if (!user || user.role !== 'ADMIN') {
                return res.status(403).json({ error: 'You are not assigned to this issue' });
            }
        }

        await queryRun(
            `UPDATE issues SET status = ?, technician_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, technicianNotes || null, req.params.id]
        );

        if (status === 'RESOLVED' || status === 'CLOSED') {
            await queryRun('UPDATE assets SET status = ? WHERE id = ?', ['OPERATIONAL', issue.asset_id]);
        } else if (status === 'INSPECTION_STARTED') {
            await queryRun('UPDATE assets SET status = ? WHERE id = ?', ['UNDER_INSPECTION', issue.asset_id]);
        } else if (status === 'MAINTENANCE_IN_PROGRESS') {
            await queryRun('UPDATE assets SET status = ? WHERE id = ?', ['UNDER_MAINTENANCE', issue.asset_id]);
        }

        const updatedIssue = await queryOne('SELECT * FROM issues WHERE id = ?', [req.params.id]);
        res.json({ message: 'Status updated successfully', issue: updatedIssue });

    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET TECHNICIANS
router.get('/technicians', async (req, res) => {
    try {
        const technicians = await query("SELECT id, name, email FROM users WHERE role = 'TECHNICIAN' OR role = 'ADMIN'");
        res.json({ technicians: technicians.rows });
    } catch (error) {
        console.error('Get technicians error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;