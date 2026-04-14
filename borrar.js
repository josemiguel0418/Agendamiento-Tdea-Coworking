const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

db.run('DELETE FROM reservas', () => {
  console.log('Todas las reservas han sido borradas');
  db.close();
});