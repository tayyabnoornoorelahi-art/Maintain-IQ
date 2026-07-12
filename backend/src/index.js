const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./modules/auth/auth.routes');
const assetRoutes = require('./modules/assets/asset.routes');
const qrRoutes = require('./modules/qr/qr.routes');
const issueRoutes = require('./modules/issues/issue.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ROOT ROUTE - FIX 404 ERROR
app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 MaintainIQ Backend is running!',
        status: 'online',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            assets: '/api/assets',
            issues: '/api/issues',
            qr: '/api/qr'
        }
    });
});

// HEALTH CHECK
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        service: 'maintainiq-backend' 
    });
});

// API ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/issues', issueRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
    console.log(`📦 Assets: http://localhost:${PORT}/api/assets`);
    console.log(`📱 QR: http://localhost:${PORT}/api/qr`);
    console.log(`📋 Issues: http://localhost:${PORT}/api/issues`);
});