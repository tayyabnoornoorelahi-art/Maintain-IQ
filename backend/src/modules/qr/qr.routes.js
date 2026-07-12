const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { queryOne } = require('../../config/db.config');

// Generate QR code for asset
router.get('/asset/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        // Check if asset exists
        const asset = await queryOne(
            'SELECT id, code, name FROM assets WHERE code = ?',
            [code]
        );
        
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        
        // Generate QR code as data URL
        const publicUrl = `${process.env.PUBLIC_URL || 'http://localhost:5000'}/api/assets/public/${code}`;
        
        const qrDataUrl = await QRCode.toDataURL(publicUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        });
        
        res.json({
            asset: {
                id: asset.id,
                code: asset.code,
                name: asset.name
            },
            qr_code: qrDataUrl,
            public_url: publicUrl
        });
        
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate label for asset (with QR code)
router.get('/label/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        const asset = await queryOne(
            'SELECT id, code, name, location FROM assets WHERE code = ?',
            [code]
        );
        
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        
        const publicUrl = `${process.env.PUBLIC_URL || 'http://localhost:5000'}/api/assets/public/${code}`;
        
        const qrDataUrl = await QRCode.toDataURL(publicUrl, {
            width: 200,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        });
        
        res.json({
            organization: 'MaintainIQ',
            asset: {
                name: asset.name,
                code: asset.code,
                location: asset.location
            },
            qr_code: qrDataUrl,
            public_url: publicUrl,
            label_html: `
                <div style="text-align: center; padding: 20px; border: 2px solid #333; width: 300px; font-family: Arial;">
                    <h3 style="margin: 0;">MaintainIQ</h3>
                    <hr style="border: 1px solid #333;">
                    <h2 style="margin: 10px 0;">${asset.name}</h2>
                    <p style="margin: 5px 0; font-size: 12px;">Code: ${asset.code}</p>
                    <p style="margin: 5px 0; font-size: 12px;">Location: ${asset.location}</p>
                    <img src="${qrDataUrl}" alt="QR Code" style="width: 150px; height: 150px; margin: 10px;">
                    <p style="font-size: 10px; color: #666; margin: 5px 0;">Scan to view asset details</p>
                </div>
            `
        });
        
    } catch (error) {
        console.error('Label generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Bulk generate labels
router.post('/labels/bulk', async (req, res) => {
    try {
        const { codes } = req.body;
        
        if (!codes || !Array.isArray(codes) || codes.length === 0) {
            return res.status(400).json({ error: 'Please provide an array of asset codes' });
        }
        
        const labels = [];
        for (const code of codes) {
            try {
                const asset = await queryOne(
                    'SELECT id, code, name, location FROM assets WHERE code = ?',
                    [code]
                );
                
                if (asset) {
                    const publicUrl = `${process.env.PUBLIC_URL || 'http://localhost:5000'}/api/assets/public/${code}`;
                    const qrDataUrl = await QRCode.toDataURL(publicUrl, {
                        width: 150,
                        margin: 1,
                        errorCorrectionLevel: 'H'
                    });
                    
                    labels.push({
                        code: asset.code,
                        name: asset.name,
                        location: asset.location,
                        qr_code: qrDataUrl
                    });
                }
            } catch (err) {
                console.error(`Error generating label for ${code}:`, err);
            }
        }
        
        res.json({
            total: labels.length,
            labels
        });
        
    } catch (error) {
        console.error('Bulk label generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;