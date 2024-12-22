const mysql = require('mysql');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database: ' + JSON.stringify(err, undefined, 2));
    return;
  }
});

module.exports = connection;

