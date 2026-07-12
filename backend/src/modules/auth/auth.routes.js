const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { query, queryOne, queryRun } = require('../../config/db.config');

// ============================================
// REGISTER - Create new user
// ============================================
router.post('/register', async (req, res) => {
    try {
        console.log('📝 Register request:', req.body);
        
        const { email, password, name, role } = req.body;

        // Validate required fields
        if (!email || !password || !name) {
            return res.status(400).json({ 
                error: 'Email, password, and name are required' 
            });
        }

        // Check if user exists
        const existing = await queryOne(
            'SELECT * FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existing) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const result = await queryRun(
            `INSERT INTO users (email, password, name, role) 
             VALUES (?, ?, ?, ?)`,
            [email.toLowerCase(), hashedPassword, name, role || 'REPORTER']
        );

        console.log('✅ Insert result - lastID:', result.lastID);

        // FIX: Get user by email instead of ID (more reliable)
        const user = await queryOne(
            'SELECT id, email, name, role FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (!user) {
            console.error('❌ User not found by email after insert');
            
            // Try to get the user by rowid as fallback
            const fallbackUser = await queryOne(
                'SELECT id, email, name, role FROM users WHERE rowid = ?',
                [result.lastID]
            );
            
            if (fallbackUser) {
                console.log('✅ Found user by rowid:', fallbackUser);
                const token = jwt.sign(
                    { userId: fallbackUser.id, role: fallbackUser.role },
                    process.env.JWT_SECRET || 'fallback-secret-key',
                    { expiresIn: '7d' }
                );
                return res.status(201).json({
                    message: 'User registered successfully',
                    user: fallbackUser,
                    token: token
                });
            }
            
            return res.status(500).json({ error: 'Failed to retrieve user' });
        }

        console.log('✅ User created:', user);

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret-key',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            user: user,
            token: token
        });

    } catch (error) {
        console.error('❌ Register error:', error);
        res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ============================================
// LOGIN - Authenticate user
// ============================================
router.post('/login', async (req, res) => {
    try {
        console.log('🔐 Login request:', req.body.email);
        
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await queryOne(
            'SELECT * FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret-key',
            { expiresIn: '7d' }
        );

        console.log('✅ Login successful:', email);

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            token: token
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;