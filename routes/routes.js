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
  function getDayOfWeek(dateString){
    let date = new Date(dateString);
    switch(date.getDay()){
      case 0: return "sun";
      case 1: return "mon";
      case 2: return "tues";
      case 3: return "wed";
      case 4: return "thurs";
      case 5: return "fri";
      case 6: return "sat";
    }
  }

  function getTimeSlots(employee, length, date, success, fail){
    let dbQuery = "SELECT * FROM employees WHERE id = ?";
    let lengthHour = length.substr(0, 2);
    let lengthMin = length.substr(2, 2);
    let startTimes = [];
    let startTime = "";
    let endTime = "";
    let day = getDayOfWeek(date);
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
          if(startTime === null || endTime === null){ fail(); return; }
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
          let numStartTimes = startTimes.length;
          let startTimeCount = 0;
          let startTimeAvailable = function(){
            startTimeCount++;
            if(startTimeCount === numStartTimes){
              success(startTimes);
            }
          };
          let startTimeUnavailable = function(time){
            startTimeCount++;
            for(let i in startTimes){
              if(startTimes[i] === time){ startTimes.splice(i, 1); }
            }
            if(startTimeCount === numStartTimes){
              success(startTimes);
            }
          };
          for(let i in startTimes){
            timeslotAvailability(employee, date, startTimes[i], length, startTimeAvailable, startTimeUnavailable, startTimeUnavailable);
          }
        }
      })
    })
  }

  function timeslotAvailability(employee, testDate, testStart, testLength, available, unavailable, fail){
    //Accepts an employee ID and timeStart, and length, and determines if it fits within the employees schedule.
    let dbQuery = "SELECT * FROM meetings"
    let searchString = `[${employee}]`;
    if(!verifyTime(testStart) || !verifyTime(testLength) || !verifyDate(testDate)) { fail(); return;}
    let testStartHour = parseInt(testStart.substr(0, 2));
    let testStartMin = parseInt(testStart.substr(2, 2));
    let testEndHour = testStartHour + parseInt(testLength.substr(0, 2));
    let testEndMin = testStartMin + parseInt(testLength.substr(2, 2));
    if(testEndMin >= 60){
      testEndMin = testEndMin % 60;
      testEndHour++;
    }
    testEndHour = toPaddedString(testEndHour);
    testEndMin = toPaddedString(testEndMin);
    let testEnd = testEndHour.concat(testEndMin);
    testEnd = parseInt(testEnd);

    db.serialize(function(){
      db.all(dbQuery, [], (err, rows) => {
        if(err){ fail(); return; }
        if(rows === undefined) { available(); return; }

        for(let i in rows){
          if(rows[i].hasOwnProperty('attendees')){
            let attendees = rows[i].attendees;
            let startTime = rows[i].startTime;
            let length = rows[i].length;
            let date = rows[i].date;

            if(attendees === null || !attendees.includes(searchString)){ continue; }
            if(testDate !== date) { continue; }
            if(!verifyTime(startTime) || !verifyTime(length) || !verifyDate(date)){ continue; }

            let startHour = parseInt(startTime.substr(0, 2));
            let startMin = parseInt(startTime.substr(2, 2));
            let lengthHour = parseInt(length.substr(0, 2));
            let lengthMin = parseInt(length.substr(2, 2));
            let endHour = startHour + lengthHour;
            let endMin = startMin + lengthMin;
            if(endMin >= 60){
              endMin = endMin % 60;
              endHour++;
            }
            endHour = toPaddedString(endHour);
            endMin = toPaddedString(endMin);
            let endTime = endHour.concat(endMin);
            endTime = parseInt(endTime);
            //test the start time.
            if(testStart >= startTime && testStart <= endTime) {unavailable(testStart); return;}
            if(testStart === startTime || testStart === endTime) {unavailable(testStart); return;}
            //test the end time
            if(testEnd >= startTime && testEnd <= endTime) {unavailable(testStart); return;}
            if(testEnd === startTime || testEnd === endTime) {unavailable(testStart); return;}
          }
        }
        return available();
      })
    });
  }

  app.get('/test', (req, res) => {
    let response = successResponse();
    let available = function(){ console.log("available") };
    let unavailable = function(){ console.log( "unavailable")};
    let fail = function(){ console.log("fail")};
    timeslotAvailability(1, "04/20/1969", "0800", "0100", available, unavailable, fail);
    timeslotAvailability(2, "04/20/1969", "0800", "0100", available, unavailable, fail);
    timeslotAvailability(3, "04/20/1969", "0800", "0100", available, unavailable, fail);
    timeslotAvailability(4, "04/20/1969", "0800", "0100", available, unavailable, fail);
    timeslotAvailability(1, "04/20/1969", "0745", "0014", available, unavailable, fail);
    timeslotAvailability(2, "04/20/1969", "0745", "0014", available, unavailable, fail);
    timeslotAvailability(3, "04/20/1969", "0745", "0014", available, unavailable, fail);
    timeslotAvailability(4, "04/21/1969", "0845", "0130", available, unavailable, fail);

    res.send(response);
  });

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

  function verifyDate(date){
    let re = new RegExp("[0-9][0-9]\/[0-9][0-9]\/[0-9][0-9][0-9][0-9]");
    if(date.length !== 10) return false;
    if(!re.test(date)) return false;
    let split = date.split("/");
    split[0] = parseInt(split[0]);
    split[1] = parseInt(split[1]);
    if(split[0] < 1 || split[0] > 12) return false;
    if(split[1] < 1 || split[1] > 31) return false;
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

      if(!json.hasOwnProperty("employees") || !json.hasOwnProperty("length") || !json.hasOwnProperty("date") || !json.hasOwnProperty('key')){
        res.send(errorResponse("Invalid parameters. Required parameters are employees, length, date, and key."));
      }
      else{
        let employees = json.employees;
        let length = json.length.toString().padStart(4, "0");
        let date = json.date;
        let timeSlots = [];
        let numFinished = 0;
        let key = json.key;

        let verifySuccess = function(){
          //Called when a user is verified
          for(let i in employees){
            getTimeSlots(employees[i], length, date, timeslotSuccess, timeslotFail);
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

      if(!json.hasOwnProperty('key') || !json.hasOwnProperty("startTime") || !json.hasOwnProperty('length') || !json.hasOwnProperty('date')){
        res.send(errorResponse('Invalid parameters. "key", "startTime", "length", and "date" are required'));
      }
      else{
        let dbQuery = "INSERT INTO meetings (ownerID, date, startTime, length) VALUES (?, ?, ?, ?);";
        let dbVerifyQuery = "SELECT * FROM meetings WHERE id=?";
        let key = json.key;
        let startTime = json.startTime;
        let length = json.length;
        let date = json.date;

        if(!verifyTime(startTime) || !verifyTime(length)){ res.send(errorResponse("Time error: Please ensure that startTime and length are in 4-digit 24-hour string time format")); return; }
        if(!verifyDate(date)){ res.send(errorResponse("Date error: Please ensure date is in MM/DD/YYYY form")); return; }

        let verifySuccess = function(userID){
          //Called when user is verified
          db.serialize(function(){
            db.run(dbQuery, [userID, date, startTime, length], function(err) {
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
        getUserByKey(key, verifySuccess, verifyFail);
      }
    });

    app.post('/addUserToMeeting', (req, res) => {
      console.log("Hit /addUserToMeeting endpoint");
      let json = req.body;
      let dbQuery = "SELECT * FROM meetings WHERE id=?";
      let updateQuery = "UPDATE meetings SET attendees = ? WHERE id=?";
      if(!json.hasOwnProperty('key') || !json.hasOwnProperty('meetingID') || !json.hasOwnProperty('employeeID')){
        res.send(errorResponse('Invalid parameters. "key", "meetingID", and "employeeID" are all required'));
      }
      let key = json.key;
      let meetingID = json.meetingID;
      let employeeID = json.employeeID;
      let attendeeString = `[${employeeID}]`;

      let verifySuccess = function(){
        //Called when user is verified
        db.serialize(function(){
          db.get(dbQuery, [meetingID], (err, row) => {
            if(err || row === undefined){ res.send(errorResponse("Error: Invalid meeting ID")); return;}
            if(!row.hasOwnProperty('date')){ res.send(errorResponse("Error: Invalid meeting ID")); return; }
            //if(!row.hasOwnProperty('attendees')){ res.send(errorResponse("Error: Invalid meeting ID")); return;}
            //let attendees = row.attendees;
            //if(!attendees.includes(attendeeString)){
            //  attendees = attendees + " " + attendeeString;
            //}
            let date = row.date;
            let startTime = row.startTime;
            let length = row.length;
            timeslotAvailability(employeeID, date, startTime, length, available, unavailable, unavailable);
          });
        });
      };
      let verifyFail = function(){
        //Called when user verification fails.
        res.send(errorResponse("Error: Invalid user key"))
        return;
      };
      let available = function(){
        //Called if the user is available at the meeting time.
        db.serialize(function(){
          db.get(dbQuery, [meetingID], (err, row) => {
            if(err || row === undefined){ res.send(errorResponse("Error: Invalid meeting ID")); return;}
            if(!row.hasOwnProperty('attendees')){ res.send(errorResponse("Error: Invalid meeting ID")); return;}
            let attendees = row.attendees;
            if(attendees === null || !attendees.includes(attendeeString)) {
              attendees = attendees + " " + attendeeString;
            }
            else{
              let response = successResponse();
              response.msg = "User was already added";
              res.send(response);
              return;
            }
            db.run(updateQuery, [attendees, meetingID], function(err){
              if(err){res.send(errorResponse("Error adding user to meeting")); return;};
              let response = successResponse();
              response.msg = "Successfully added user";
              res.send(response);
              return;
            })
          })
        })

      };
      let unavailable = function(){res.send(errorResponse("Error: User is unavailable to attend this meeting.")); return;};
      verifyUser(key, verifySuccess, verifyFail);

    })
};