const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'maintainiq.db');

if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️ Removed old database');
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
    console.log('✅ Database created');
});

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

db.exec(schema, (err) => {
    if (err) {
        console.error('❌ Schema error:', err.message);
    } else {
        console.log('✅ Schema created');
    }
    db.close(() => console.log('✅ Database initialization complete!'));
});