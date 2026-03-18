import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('//')[1]?.split(':')[0] || 'root',
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
  database: process.env.DATABASE_URL?.split('/').pop() || 'openpecker',
});

// Check for the device ID we just created
const deviceId = 'ynNsnYKWOI2YCa-oJMWsc';
const [rows] = await connection.execute(
  'SELECT id, name, email, deviceId, loginMethod, isPremium FROM users WHERE deviceId = ?',
  [deviceId]
);

console.log('Anonymous user check:');
console.log('Device ID searched:', deviceId);
console.log('Found users:', rows.length);
if (rows.length > 0) {
  console.log('User details:', rows[0]);
} else {
  console.log('No user found with this device ID');
}

// Also check total user count
const [countRows] = await connection.execute('SELECT COUNT(*) as total FROM users');
console.log('\nTotal users in database:', countRows[0].total);

await connection.end();
