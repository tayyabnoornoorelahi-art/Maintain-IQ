const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'maintainiq.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Updating database schema...');

db.serialize(() => {
    // Check existing columns
    db.all("PRAGMA table_info(issues)", (err, rows) => {
        if (err) {
            console.error('❌ Error:', err.message);
            return;
        }
        
        const columns = rows.map(row => row.name);
        console.log('📋 Current columns:', columns.join(', '));
        
        // Add missing columns
        const columnsToAdd = [
            { name: 'assigned_to', type: 'TEXT' },
            { name: 'technician_notes', type: 'TEXT' }
        ];
        
        let added = 0;
        for (const col of columnsToAdd) {
            if (!columns.includes(col.name)) {
                const sql = `ALTER TABLE issues ADD COLUMN ${col.name} ${col.type}`;
                db.run(sql, (err) => {
                    if (err) {
                        console.error(`❌ Error adding ${col.name}:`, err.message);
                    } else {
                        console.log(`✅ Added column: ${col.name}`);
                        added++;
                    }
                });
            } else {
                console.log(`✅ Column already exists: ${col.name}`);
            }
        }
        
        if (added === 0) {
            console.log('✅ All columns already exist!');
        }
    });
});

db.close(() => {
    console.log('✅ Database update complete!');
});