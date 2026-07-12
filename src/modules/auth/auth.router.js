const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { query, queryOne, queryRun } = require('../../config/db.config');

router.post('/register', async (req, res) => {
    try {
        const { email, password, name, role } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existing = await queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existing) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await queryRun(
            'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
            [email.toLowerCase(), hashedPassword, name, role || 'REPORTER']
        );

        const user = await queryOne('SELECT id, email, name, role FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) {
            return res.status(500).json({ error: 'Failed to create user' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret-key',
            { expiresIn: '7d' }
        );

        res.status(201).json({ message: 'User registered successfully', user, token });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret-key',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;