const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const _ = require('underscore');

module.exports = function(app,db){
  //app.use(bodyParser.urlencoded({extended: false}));
  app.use(bodyParser.json());

  //Helper methods
  function errorResponse(msg){
    return {
      "status": "ERROR",
      "msg": msg
    }
  }
  function successResponse(){
    return {
      "status": "SUCCESS"
    }
  }
  function toPaddedString(int){
    return int.toString().padStart(2, "0");
  }
  function arrayIntersection(arrays){
    return _.intersection.apply(_, arrays);
  }

  function getTimeSlots(employee, length, day, success, fail){
    let dbQuery = "SELECT * FROM employees WHERE id = ?";
    let lengthHour = length.substr(0, 2);
    let lengthMin = length.substr(2, 2);
    let startTimes = [];
    let startTime = "";
    let endTime = "";
    db.serialize(function(){
      db.get(dbQuery, [employee], (err, row) => {
        if(err || row === undefined) { fail() }
        else{
          switch(day){
            case "sun": {
              startTime = row.sunStartTime;
              endTime = row.sunEndTime;
            } break;
            case "mon": {
              startTime = row.monStartTime;
              endTime = row.monEndTime;
            } break;
            case "tues": {
              startTime = row.tuesStartTime;
              endTime = row.tuesEndTime;
            } break;
            case "wed": {
              startTime = row.wedStartTime;
              endTime = row.wedEndTime;
            } break;
            case "thurs": {
              startTime = row.thursStartTime;
              endTime = row.thursEndTime;
            } break;
            case "fri": {
              startTime = row.friStartTime;
              endTime = row.friEndTime;
            } break;
            case "sat": {
              startTime = row.satStartTime;
              endTime = row.satEndTime;
            } break;
            default: {
              return [];
            }
          }
          let startTimeHour = startTime.substr(0, 2);
          let startTimeMin = startTime.substr(2, 2);
          let endTimeHour = endTime.substr(0, 2);
          let endTimeMin = endTime.substr(2, 2);
          let onHour = startTimeHour;
          let onMin = startTimeMin;
          let hitEnd = false;

          while(!hitEnd){
            let nextHour = parseInt(onHour) + parseInt(lengthHour);
            let nextMin = parseInt(onMin) + parseInt(lengthMin);
            if(nextMin >= 60){
              nextHour += Math.floor(nextMin / 60);
              nextMin = nextMin % 60;
            }
            if( nextHour < parseInt(endTimeHour) || (nextHour <= parseInt(endTimeHour) && nextMin <= parseInt(endTimeMin))){
              startTimes.push(toPaddedString(onHour).concat(toPaddedString(onMin)));
              onHour = toPaddedString(nextHour);
              onMin = toPaddedString(nextMin);
            }
            else{
              hitEnd = true;
            }
          }
          success(startTimes);
        }
      })
    })
  }

  //Verification methods
  function verifyUser(key, success, fail){
    //Returns true if the key belongs to a valid user.
    let keyQuery = "SELECT username FROM login WHERE key = ?";
    db.serialize(function(){
      db.get(keyQuery, [key], (err, row) => {
        if(err || row === undefined){ fail() }
        else {
          success();
        }
      })
    });
  }
  function getUserByKey(key, success, fail){
    //Returns the employeeID from a key;
    let dbQuery = "SELECT id FROM login WHERE key = ?";
    db.serialize(function(){
      db.get(dbQuery, [key], (err, row) => {
        if(err || row === undefined){ fail(); }
        else{ success(row.id); }
      })
    })
  }
  function verifyAdmin(key){
    //Returns true if the key belongs to a valid admin.
  }
  function verifyTime(time){
    //Verifies that a string is in 4-digit 24-hour time format.
    if(time.length !== 4) return false;
    for(let i in time){
      if(time[i] < '0' || time[i] > 9) return false;
    }

    let hour = parseInt(time.substr(0, 2));
    let min = parseInt(time.substr(2, 2));

    if(hour < 0 || hour > 23) return false;
    if(min < 0 || min > 59) return false;

    return true;
  }


  //Default
  app.get('/', (req, res) => {
    res.send("Welcome to the Meeting Program API server.");
  });

  //Login Endpoint
  app.post('/login', (req, res) => {
    console.log("Hit the /login endpoint");
    const json = req.body;
    let dbQuery = "SELECT key FROM login WHERE username = ? AND password = ?;";

    //Make sure username and password were passed
    if(!json.hasOwnProperty("username")){
      res.send(errorResponse("Username not provided"));
      return
    }
    if(!json.hasOwnProperty("password")){
      res.send(errorResponse("Password not provided"));
      return
    }

    let username = json.username;
    let password = json.password;
    db.serialize(function(){
      db.get(dbQuery, [username, password], (err, row) => {
        if(err){
          res.send(errorResponse("Database error"));
        }
        else if(row === undefined){
          res.send(errorResponse("Invalid login credentials"));
        }
        else {
          let response = successResponse();
          response.key = row.key;
          res.send(response);
        }
      });
    })
  });

  //Get All Users
  app.get('/getEmployees', (req, res) => {
    console.log("Hit the /getEmployees endpoint");
    let dbQuery = "SELECT * FROM employees";
    let key = req.query.key;

    let success = function(){
      //Called when user is verified.
      db.serialize(function() {
        db.all(dbQuery, [], (err, rows) => {
          if (err) {
            res.send(errorResponse("Database error"));
          } else {
            let response = successResponse();
            response.data = rows;
            res.send(response);
          }
        })
      });
    };

    let fail = function(){
      //Called when verification fails.
      res.send(errorResponse("Invalid key"));
    };

    verifyUser(key, success, fail);
  });

    //Meetings
    app.post('/getTimeSlots', (req, res) => {
      console.log("Hit the /getTimeSlots endpoint");
      let json = req.body;

      if(!json.hasOwnProperty("employees") || !json.hasOwnProperty("length") || !json.hasOwnProperty("day") || !json.hasOwnProperty('key')){
        res.send(errorResponse("Invalid parameters. Required parameters are employees, length, day, and key."));
      }
      else{
        let employees = json.employees;
        let length = json.length.toString().padStart(4, "0");
        let day = json.day;
        let timeSlots = [];
        let numFinished = 0;
        let key = json.key;

        let verifySuccess = function(){
          //Called when a user is verified
          for(let i in employees){
            getTimeSlots(employees[i], length, day, timeslotSuccess, timeslotFail);
          }
        };

        let verifyFail = function(){
          //Called when verification fails.
          res.send(errorResponse("Invalid key"));
        };

        let timeslotSuccess = function(times){
          timeSlots.push(times);
          numFinished++;
          if(numFinished === employees.length){
            let response = successResponse();
            response.data = arrayIntersection(timeSlots);
            res.send(response);
          }
        };

        let timeslotFail = function() { res.send(errorResponse("Error: please recheck inputs")) };

        verifyUser(key, verifySuccess, verifyFail)
      }
    });

    app.get('/getMeetings', (req, res) => {
      console.log("Hit the /getMeetings endpoint");
      let dbQuery = "SELECT * FROM meetings;";
      let key = req.query.key;

      let success = function(){
        //Called when a user is verified
        db.serialize(function() {
          db.all(dbQuery, [], (err, rows) => {
            if(err) {
              res.send(errorResponse("Database error"));
            } else {
              let response = successResponse();
              response.data = rows;
              res.send(response);
            }
          });
        })
      };

      let fail = function(){
        //Called when verification fails.
        res.send(errorResponse("Invalid key"));
      };

      verifyUser(key, success, fail);

    });

    app.post('/createMeeting', (req, res) => {
      console.log("Hit /createMeeting endpoint");
      let json = req.body;

      if(!json.hasOwnProperty('key') || !json.hasOwnProperty("startTime") || !json.hasOwnProperty('length')){
        res.send(errorResponse('Invalid parameters. "key", "startTime", and "length" are required'));
      }
      else{
        let dbQuery = "INSERT INTO meetings (ownerID, startTime, length) VALUES (?, ?, ?);";
        let dbVerifyQuery = "SELECT * FROM meetings WHERE id=?";
        let key = json.key;
        let startTime = json.startTime;
        let length = json.length;

        if(!verifyTime(startTime) || !verifyTime(length)){
          res.send("Time error: Please ensure that startTime and length are in 4-digit 24-hour string time format");
          return;
        }

        let verifySuccess = function(userID){
          //Called when user is verified
          db.serialize(function(){
            db.run(dbQuery, [userID, startTime, length], function(err) {
              if(err){
                console.log("error: " + err);
                res.send(errorResponse("Error creating meeting"));
              }
              else{
                db.get(dbVerifyQuery, [this.lastID], (err2, row) => {
                  if(err2 || row === undefined){
                    res.send(errorResponse("Error getting meeting info"));
                  }
                  else{
                    let response = successResponse();
                    response.data = row;
                    res.send(response);
                  }
                })
              }
            })
          });
        };

        let verifyFail = function(){
          //Called when user verification fails
          res.send(errorResponse("Error: Invalid user key"))
        };

        let meetingCreateSuccess = function(){
          //Called if meeting is created successfully
        };

        let meetingCreateFail = function(){
          //Called if meeting can not be created
        };

        getUserByKey(key, verifySuccess, verifyFail);
      }
    });
};