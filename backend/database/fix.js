const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'maintainiq.db');
const db = new sqlite3.Database(dbPath);

// Add missing columns to assets table
db.serialize(() => {
    // Check if columns exist and add them
    db.run("PRAGMA table_info(assets)", (err, rows) => {
        if (err) {
            console.error('Error checking table:', err.message);
            return;
        }
        
        const columns = rows.map(row => row.name);
        console.log('Current columns:', columns);
        
        const columnsToAdd = [
            { name: 'description', type: 'TEXT' },
            { name: 'condition', type: 'TEXT DEFAULT "Good"' },
            { name: 'purchase_date', type: 'DATE' },
            { name: 'warranty_expiry', type: 'DATE' },
            { name: 'last_service', type: 'DATE' },
            { name: 'next_service', type: 'DATE' },
            { name: 'status', type: 'TEXT DEFAULT "OPERATIONAL"' },
            { name: 'technician_id', type: 'TEXT REFERENCES users(id)' }
        ];
        
        for (const col of columnsToAdd) {
            if (!columns.includes(col.name)) {
                const sql = `ALTER TABLE assets ADD COLUMN ${col.name} ${col.type}`;
                db.run(sql, (err) => {
                    if (err) {
                        console.error(`Error adding ${col.name}:`, err.message);
                    } else {
                        console.log(`✅ Added column: ${col.name}`);
                    }
                });
            } else {
                console.log(`✅ Column already exists: ${col.name}`);
            }
        }
    });
});

db.close(() => {
    console.log('✅ Database fix complete!');
});