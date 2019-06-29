const express = require('express');
const fs = require('fs');
const sqlite = require('sqlite3');


//
const app = express();
const port = 8989;

//
dbFile = './data.db';
let db = new sqlite.Database(dbFile, (err) => {
  if(err) {
    console.log("Error connecting to database");
  }
  else{
    console.log("Connected to database successfully");
    require('./routes/routes')(app, db);
    app.listen(port, () => console.log(`Meeting server started on port ${port}`));
  }
});