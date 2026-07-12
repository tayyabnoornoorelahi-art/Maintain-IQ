const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database/maintainiq.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
    } else {
        console.log('✅ SQLite Database connected');
    }
});

// Helper: Run query (SELECT multiple rows)
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('❌ query error:', err.message);
                reject(err);
            } else {
                resolve({ rows });
            }
        });
    });
};

// Helper: Get one row
const queryOne = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                console.error('❌ queryOne error:', err.message);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

// Helper: Run (INSERT, UPDATE, DELETE)
const queryRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                console.error('❌ queryRun error:', err.message);
                reject(err);
            } else {
                console.log('✅ queryRun success - lastID:', this.lastID);
                resolve({ 
                    lastID: this.lastID, 
                    changes: this.changes 
                });
            }
        });
    });
};

module.exports = { db, query, queryOne, queryRun };