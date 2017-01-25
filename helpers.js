//------------------------------------------------------------------------------ 
// IBM CPO Lab   
//
// Cloud
//   Test
//     Foundation
//
// Dream Home Application for node.js 
// Author: Sal Carceller Jr.
// Date: 10/28/2016
//
// This helpers.js module contains common helper functions for Dream Home App
//
//------------------------------------------------------------------------------ 
var _mongoClient       = require('mongodb').MongoClient;

//------------------------------------------------------------------------------ 
// define mongoDB related information
// define the DB connection url, check for env var 'mongourl'
var _mongoURL          = process.env.mongourl || "mongoDB://cpoUser:enitlavo908#@158.85.248.111:8888/dhMSServiceFabric";

// define the collection names within the DB
var _cnameCounter      = "dhCounterColl";       // name of the counter collection.
var _cnameClient       = "dhClientColl";        // name of the client collection.
var _cnameAgent        = "dhAgentColl";         // name of the agent collection.
var _cnameProperty     = "dhPropertyColl";      // name of the property collection.
var _cnameOffice       = "dhOfficeColl";        // name of the office collection.
var _cnameNotification = "dhNotificationColl";  // name of the notification collection.
// define the text names for each primary key 
var _pknAgentId        = "agentId";
var _pknClientId       = "clientId";
var _pknPropertyId     = "propertyId";
var _pknOfficeId       = "officeId";
var _pknNotificationId = "notificationId";
//------------------------------------------------------------------------------ 

// global handles/refrences to the mongoDB and it's collections
var _dbConnectedInd = false; // indicates if we are connected to the DB, initialized to false
var _dbref;                  // refrence to the mongoDB connection
var _dbName;                 // the name of the db we are using
var _crefCounter;            // _cref are refrences to collections
var _crefClient;             // ...
var _crefAgent;              // ...
var _crefProperty;           // ...
var _crefOffice;             // ...
var _crefNotification;       // end of _cref

//------------------------------------------------------------------------------ 
// define this as a module and declare all the exported functions for the module
//------------------------------------------------------------------------------ 
module.exports = 
{ 
  //------------------------------------------------------------------------------
  // Public helper functions start here.
  //------------------------------------------------------------------------------
  dburl:            function () { return _mongoURL;         },
  // export db refrence, db name and dbConnected indicator
  dbref:            function () { return _dbref;            }, 
  dbName:           function () { return _dbName;           }, 
  dbConnected:      function () { return _dbConnectedInd;   },  
  // export getters for all collection refrences
  crefCounter:      function () { return _crefCounter;      },
  crefClient:       function () { return _crefClient;       },
  crefAgent:        function () { return _crefAgent;        },
  crefProperty:     function () { return _crefProperty;     },
  crefOffice:       function () { return _crefOffice;       },
  crefNotification: function () { return _crefNotification; },
  // generate unique ids for collection rows
  genAgentId:        function (callback) { return _getNextId(_pknAgentId,callback);        }, 
  genClientId:       function (callback) { return _getNextId(_pknClientId,callback);       }, 
  genPropertyId:     function (callback) { return _getNextId(_pknPropertyId,callback);     }, 
  genOfficeId:       function (callback) { return _getNextId(_pknOfficeId,callback);       }, 
  genNotificationId: function (callback) { return _getNextId(_pknNotificationId,callback); }, 
  // create the Counter collection
  createCounterColl: function (callback) { return _createCounterColl(callback);            },  

  // connects to the mongo DB and caches the connection and all refs
  dbInit: function(callback)
  {
    // call the private _dbConnect() function (see end of this file)
    _dbInit(callback);
  },

  // Helper Function to respond with HTTP json response
  httpJsonResponse: function (response,    // http response object
                              code,        // http response code, normally set to 200 for valid response
                              jsonMsg)     // http response msg, formated as json message
  {
    response.status(code).json(jsonMsg);
    response.end;

    return;
  },

  // creates a random dollar.cents as a float 
  randomBalance: function (low,high)
  {
     var balance = 0.00;
     var dollar  = 0;
     var cents   = 0;
  
     // create a rondom dollar.cents
     dollar = _iRandom(low,high);  // random dollar amount between low (inclusive) and high (exlusive)
     cents  = _iRandom(0,100)/100; // random cents .0-.99
     balance = dollar + cents;     // build the random balance
  
     return balance;
  },
  
  // generates integer between two numbers low (inclusive) and high (exclusive)
  random: function (low, high) 
  {
      return _iRandom(low,high); // call the private internal p_random function
  }
}; // end of module exports


//------------------------------------------------------------------------------
// Private internal functions for this module start here
//------------------------------------------------------------------------------

// private local function for connecting to the mongo DB
// connects once and only once to the DB and cache the connection
function _dbInit(callback)
{
  console.log("helpers.dbInit() has been called.");

  // test to be sure we are not already connected
  if(_dbConnectedInd==false)
  { // not yet connected, proceed and connect.
    // check if we have a local mongoDB service within the OpenShift project
    var mongoURL = _findMongoService();
    if( mongoURL )
    { // we found a local mongoDB within OpenShift, we will now use this DB 
      _mongoURL = mongoURL;
    }

    // setup mongodb connection options
    var connectOptions = 
    { server: { poolSize:2,
                socketOptions: { keepAlive:60, connectTimeoutMS:1000 }
              }
    };

    // now connect to mongodb
    _mongoClient.connect(_mongoURL+'?maxPoolSize=8', connectOptions, function(err, database) 
    {
      if(!err)
      { // connected!
        // test if we just connected to the 'admin' DB
        // fetch the db stats
        database.stats( function(err, stats) 
        {
          // get the db name from the db stats
          var dbName = stats.db;
          if(dbName == 'admin')
          { // we are in the 'admin' DB!
            console.log("  ... we have connected to the admin DB, switching to the target DB now!");

            // switch to the desired target database
            var targetDbName = "dhOpenShift";
            _dbref  = database.db(targetDbName);
            _dbName = targetDbName;

            // insure that userid/password exists for the target DB
            // we can do this async, we do not need to wait for the callback to continue.
            // we will assume the user will be added corectly or already exists.
            _dbref.addUser('cpoUser', 'enitlavo908#', {roles:['dbOwner']}, function(err, result) 
            {
               if(err)
               {
                  console.log("  ... creating db user in target database failed! " + JSON.stringify(err) );
               }
               else
               {
                  console.log("  ... creating db user in target database successfull.");
               }
            });
          }
          else
          { // not in the 'admin' DB
            // save the refrence to the db
            _dbref  = database;
            _dbName = dbName;
          }

          // fetch refrences for all collection
          _crefCounter       = _dbref.collection(_cnameCounter); 
          _crefClient        = _dbref.collection(_cnameClient); 
          _crefAgent         = _dbref.collection(_cnameAgent); 
          _crefProperty      = _dbref.collection(_cnameProperty); 
          _crefOffice        = _dbref.collection(_cnameOffice); 
          _crefNotification  = _dbref.collection(_cnameNotification); 

          // set/mark us as now connected to the DB 
          _dbConnectedInd = true;    

          console.log("  ... connected to DB (" + _dbName + ") successfully! " + _mongoURL);
          callback();
        });
      }
      else
      { // error occured while establishing connectivity to the DB
        _dbConnectedInd = false;   // mark us as not connected to the DB

        console.log( "  ... ERROR: failure connecting to the DB! dbURL(" + _mongoURL + ")" );
        callback(err);
      }
    }); 
  }
}

// tries to locate the mongo DB within the same OpenShift project
// looks for environment variable defs that point to the mongoDB
// if these defs are found it uses these to create the mongoURL dynamically
function _findMongoService()
{
  console.log("helpers._findMongoService() has been called.");

  var mongoURL = null;
  var host     = process.env.MONGODB_SERVICE_HOST;
  var port     = process.env.MONGODB_SERVICE_PORT;
  if(host && port)
  { // we have located the mongoDB service host:port via env vars
    // let's look for the login details next

    var database = process.env.MONGODB_DATABASE || "dreamhome";
    var user     = process.env.MONGODB_USER     || "root";
    var password = process.env.MONGODB_PASSWORD || "Jan44Feb!";
    //var database = process.env.MONGODB_DATABASE;
    //var user     = process.env.MONGODB_USER;
    //var password = process.env.MONGODB_PASSWORD;
   
    // Example URL endpoint "mongodb://root:Jan44Feb!@172.30.198.134:27017/dreamhome"
    mongoURL = "mongodb://"+user+":"+password+"@"+host+":"+port+"/"+database;

    console.log("  ... local mongoDB found, URL="+mongoURL);
  }


  return mongoURL;
}

// generates a unique next id from the Counter collection
// see this documentation for how we generate unique IDs: 
//   https://docs.mongodb.com/v3.0/tutorial/create-an-auto-incrementing-field/#auto-increment-counters-collection
function _getNextId(idType,callback)
{
//  console.log("helpers._getNextId(" + idType + ") has been called.");

  var err = null;  // assume the function will not fail, return null err;
  var pkId = null; // the id that is generated

// fetch all rows, test code
//_crefCounter.find({}).toArray( function(err, items) 
//{
//  console.log(" ... Counter Rows " + JSON.stringify(items) );
//});

  // locate the record/row matching the idType and generate the next unique ID
  _crefCounter.findAndModify(
    {'_id':idType},           // find the matching '_id' for the given idType
    [['_id','asc']],          // sort order
    {$inc:{'seq':1}},         // auto increment the the sequence 'seq' counter within the given row
    {new:true,w:1,j:1},       // return the updated record/row after it's updated
    function(err, result)     // callback
    { // callback for findAndModify() update
      if(!err && result.value)
      { // all is well, return the generated ID 
//        console.log("  ... Row found:" + JSON.stringify(result));
      
        pkId = result.value.seq; // return the id generated from the returned record 
      
//        console.log("  ... result:" + JSON.stringify(result) );
//        console.log("  ... generated " + idType + ":" + pkId );
      
        callback(err,pkId);
      }
      else
      { // something went wrong, check that Counter collection is properly built! 
        console.log("  ... ERROR: Could not locate row in Counter collection. err:" + JSON.stringify(err));
      
        // we will assume that the Counter collection does not exists or is corrupted.
        // let's try to recreate the Counter Collection. 
        _createCounterColl(               
        function(err)
        {
          if(!err)
          { // Counter collection now exists
            // attempt to generate the ID again, retry one more time 
            _getNextId(idType,callback);    
          }
          else
          { // ERROR! Counter collection does not exist or is corrupt and could not be rebuilt!
            console.log("  ... ERROR: Counter collection does not exist or is corrupt and could not be rebuilt! err:" + JSON.stringify(err));
            pkId = null;         // assign pkId null
            callback(err,pkId);  // return the err object and a null pkId
          }
        });

      }
    } // end of modify() callback
  );

  return;
}

// Creates the Counter collection 
// WARNING: will destroy the current Counter collection if one already exists!
function _createCounterColl(callback)
{
  console.log("helpers._createCounterColl() has been called.");

  var counterRecords;

  // First, delete the Counter collection if one exists 
  _crefCounter.drop(
  function(err, reply) 
  {
    console.log("  ... Counter collection has been dropped, we will rebuid it now.");

    // Now rebuild/create the Counter collection and add the records.
    // define all the counter records each with default sequence key (1000 - 5000)
    counterRecords = [{ _id:_pknAgentId,        seq:999  },
                      { _id:_pknPropertyId,     seq:1999 }, 
                      { _id:_pknOfficeId,       seq:2999 }, 
                      { _id:_pknClientId,       seq:3999 }, 
                      { _id:_pknNotificationId, seq:4999 }
                     ];
    // insert the records
    _crefCounter.insertMany( counterRecords, {w:1, j:true},
    function(err, reply)
    {
      if(!err)
      {
        var count = reply.insertedCount; // fetch number of records inserted
        console.log("  ... " + count + " records added successfully to Counter collection.");
      }

      // call the callback and pass err object, if no error it will be null.
      callback(err);
    });
  });

  return;
}

// generates integer between two numbers low (inclusive) and high (exclusive)
function _iRandom (low, high) 
{
      var rc;
  
      rc = Math.floor(Math.random() * (high - low) + low);
  
      return rc;
}
