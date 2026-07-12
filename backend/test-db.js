const { query } = require('./src/config/db.config');

async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful!');
    console.log('📅 Current time:', result.rows[0].current_time);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testConnection();