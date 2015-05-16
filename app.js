//---Module Dependencies--------------------------------------------------------
var express = require('express'),
    bodyParser     = require("body-parser"),
    methodOverride = require("method-override"),
    app = express(),
    http = require("http"),
    dust = require("dustjs-linkedin"),
    consolidate = require("consolidate"),
    cfenv = require("cfenv");

//---Routers and View Engine----------------------------------------------------
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(methodOverride());

app.engine("dust", consolidate.dust);
app.set("template_engine", "dust");
app.set("views", __dirname + '/views');
app.set("view engine", "dust");

//---Environment Vars-----------------------------------------------------------
var vcapLocal = null
try {
  vcapLocal = require("./vcap-local.json")
}
catch (e) {}

var appEnvOpts = vcapLocal ? {vcap:vcapLocal} : {}
var appEnv = cfenv.getAppEnv(appEnvOpts);

//---Set up Cloudant------------------------------------------------------------
var cloudantCreds = getServiceCreds(appEnv, "Cloudant"),
    nano = require("nano")(cloudantCreds.url),
    db = nano.db.use("intercom"),
    dbHelper = require("./lib/cloudantHelper.js");

//---Set up Twilio--------------------------------------------------------------
var twilioCreds = getServiceCreds(appEnv, "Twilio"),
    twilioClient = require('twilio')(twilioCreds.accountSID, twilioCreds.authToken),
    twilioHelper = require("./lib/twilioHelper.js");

//---Set up Watson Speech-To-Text-----------------------------------------------
var speechToTextCreds = getServiceCreds(appEnv, "SpeechToText");
speechToTextCreds.version = "v1";
var watson = require('watson-developer-cloud'),
    speechToText = watson.speech_to_text(speechToTextCreds);

//---Web Page HTTP Requests-----------------------------------------------------

// Splash screen
app.get("/", function (request, response) {
    response.render('index', {
      title : "Intercom"
    });
});

// Main page for chatting with a rep
app.get("/chat", function (request, response) {
    response.render('chat', {
      title : "Intercom | Chat",
      header : "Intercom",
      subHeader : "Solving all your questions at the push of a bttn",
      initJS : "javascript/chat.js",
      funcJS : "javascript/userChat.js"
    });
});

// Page for monitoring chat requests
app.get("/monitor", function (request, response) {
    response.render('index', {
      title : "Intercom | Monitor",
      header : "Intercom",
      subHeader : "Monitor incoming questions from users around the world"
    });
});

//---Audio HTTP Requests--------------------------------------------------------

// Post calls for parsing speech
app.post('/sample', function(req, res) {
  var audio;
  // Use sample audio to perform the speech-to-text functionality
  if(req.body.url && req.body.url.indexOf('audio/') === 0) {
    audio = fs.createReadStream(__dirname + '/../public/' + req.body.url);
  }
  else {
    console.error("ERROR: The following URL is malformed ~ " + req.body.url);
    return res.status(500).json({ error: 'Malformed URL' });
  }
  // Parse the speech input from the user into text
  speechToText.recognize({audio: audio, content_type: 'audio/l16; rate=44100'}, function(err, transcript){
    if (err) {
      console.error("ERROR: Issue parsing speech into text");
      console.error(err);
      return res.status(500).json({ error: err });
    }
    else
      return res.json(transcript);
  });
});

// Post calls for button pushes
app.post('/push', function(req, res) {
  console.log("bttn " + req.body.bttnId + " push received");

  // Emit a bttn_push event to all active sockets
  emitSocketEvents (("bttn_push_" + req.body.bttnId));

  // Send result back
  res.json({"success":"true"});
});

//---DB HTTP Requests-----------------------------------------------------------

// Getting list of all bttns
app.get('/db/get_bttns', function(request, response) {
  dbHelper.getRecords(db, 'bttns', 'bttns_index', function(result) {
    response.send(result);
  });
});

// Getting list of all representatives
app.get('/db/get_reps', function(request, response) {
  dbHelper.getRecords(db, 'reps', 'reps_index', function(result) {
    response.send(result);
  });
});

// Getting list of all chats
app.get('/db/get_chats', function(request, response) {
  dbHelper.getRecords(db, 'chats', 'chats_index', function(result) {
    response.send(result);
  });
});

// Getting list of all chats
app.get('/db/get_doc', function(request, response) {
  dbHelper.getDoc(db, request.body.docName, request.body.params, function(result) {
    response.send(result);
  });
});

// Saving a chat record
app.get('/db/save_chat', function(request, response) {
  // Build a chat record from the received request
  var chatRecord = {
    'type': "chat",
  };
  if (request.query.startTime) chatRecord.startTime = request.query.startTime;
  if (request.query.chatStatus) chatRecord.chatStatus = request.query.chatStatus;
  if (request.query.bttnId) chatRecord.bttnId = request.query.bttnId;
  if (request.query.rep) chatRecord.repId = request.query.rep;
  if (request.query.uniqueId) chatRecord._id = request.query.uniqueId;
  if (request.query.revNum) chatRecord._rev = request.query.revNum;

  // Insert chat record into DB
  dbHelper.insertRecord(db, chatRecord, function(result) {
    response.send(result);
  });
});

// Saving a message record
app.get('/db/save_msg', function(request, response) {
  // Build a message record from the received request
  var msgRecord = {
    'type': "message",
  };
  if (request.query.chatId) msgRecord.chatId = request.query.chatId;
  if (request.query.msgTxt) msgRecord.msgText = request.query.msgTxt;
  if (request.query.msgTime) msgRecord.msgTime = request.query.msgTime;
  if (request.query.subType) msgRecord.subType = request.query.subType;
  if (request.query.uniqueId) msgRecord._id = request.query.uniqueId;
  if (request.query.revNum) msgRecord._rev = request.query.revNum;

  // Insert message record into DB
  dbHelper.insertRecord(db, msgRecord, function(result) {
    response.send(result);
  });
});

// Saving a bttn record
app.get('/db/save_bttn', function(request, response) {
  // Build a bttn record from the received request
  var bttnRecord = {
    'type': "bttn",
  };
  if (request.query.bttnName) bttnRecord.bttnName = request.query.bttnName;
  if (request.query.bttnId) bttnRecord.bttnId = request.query.bttnId;
  if (request.query.uniqueId) bttnRecord._id = request.query.uniqueId;
  if (request.query.revNum) bttnRecord._rev = request.query.revNum;

  // Insert bttn record into DB
  dbHelper.insertRecord(db, bttnRecord, function(result) {
    response.send(result);
  });
});

// Saving a representative record
app.get('/db/save_rep', function(request, response) {
  // Build a representative record from the received request
  var repRecord = {
    'type': "rep",
  };
  if (request.query.repName) repRecord.repName = request.query.repName;
  if (request.query.repPhoneNum) repRecord.repPhoneNum = request.query.repPhoneNum;
  if (request.query.state) repRecord.state = request.query.state;
  if (request.query.uniqueId) repRecord._id = request.query.uniqueId;
  if (request.query.revNum) repRecord._rev = request.query.revNum;

  // Insert representative record into DB
  dbHelper.insertRecord(db, repRecord, function(result) {
    response.send(result);
  });
});

// Resets the DB to a blank state by performing the following:
// Deleting all message records
// Deleting all chat records
// Chaning all rep records to status='Available'
app.get('/db/reset', function(request, response) {
  // Validate request against VCAP_SERVICES credentials
  var cloudantMasterCreds = getServiceCreds(appEnv, "CloudantCleanser");
  if (cloudantMasterCreds.username === request.query.username &&
      cloudantMasterCreds.password === request.query.password) {
    try {
      // Retrieve chat records and delete them
      dbHelper.getRecords(db, 'chats', 'chats_index', function(result) {
        var chats = JSON.parse(result);
        for (var i=0; i < chats.length; i++) {
          dbHelper.deleteRecord(db, chats[i].uniqueId, chats[i].revNum, function(result) {});
        }
        // Retrieve message records and delete them
        dbHelper.getRecords(db, 'messages', 'messages_index', function(result) {
          var messages = JSON.parse(result);
          for (var i=0; i < messages.length; i++) {
            dbHelper.deleteRecord(db, messages[i].uniqueId, messages[i].revNum, function(result) {});
          }
          // Retrieve rep records and mark them all as Available
          dbHelper.getRecords(db, 'reps', 'reps_index', function(result) {
            var reps = JSON.parse(result);
            for (var i=0; i < reps.length; i++) {
              if (reps[i].state !== "Available")
                saveRepRecord(reps[i].name, reps[i].phoneNumber, "Available", reps[i].uniqueId, reps[i].revNum);
            }
            response.send({'success':true});
          });
        });
      });
    }
    catch (err) {
      console.error("Error cleansing the Cloudant DB", err);
      response.send({'success':false,'error':'Error cleansing Cloudant DB'});
    }
  }
  else {
    console.info("Unauthorized attempt to cleanse DB was made");
    console.info("Attempted creds: " + request.query.username + " ~ " + request.query.password);
    response.send({'success':false,'error':'Invalid credentials'});
  }
});

//---Twilio HTTP Requests-----------------------------------------------------------

// Getting list of all bttns
app.get('/sms', function(request, response) {
  console.log("Received a text message: " + request.query.Body + " from " + request.query.From);
  console.log(request);
  // Find rep with sender number in docs
  dbHelper.getDoc(db, 'reps', 'reps_index', 'phoneNumber', request.query.From.substr(1), function(rep) {
    // If rep was found, update rep record as busy
    if (rep.phoneNumber) {
      dbHelper.getDoc(db, 'chats', 'chats_index', 'rep', rep.uniqueId, function(chat) {
        // Check that rep was assigned to chat
        if (chat.uniqueId) {
          // Rep is completing the conversation
          if (request.query.Body === "COMPLETE") {
            // Update rep record in DB
            saveRepRecord(rep.name, rep.phoneNumber, "Available", rep.uniqueId, rep.revNum);

            // Update chat record in DB
            saveChatRecord("Completed", chat.bttn, chat.rep, chat.uniqueId, chat.revNum, chat.startTime, (new Date()).toString());

            // Emit a notify socket event
            emitSocketEvents (("notify_" + chat.bttn), {
              message : rep.name + " has ended the conversation. Have a good day!"
            });

            // Emit an end socket event
            emitSocketEvents (("end_" + chat.bttn));
          }
          // Else, they are answering the customer
          else {
            // Insert message record into DB
            saveMessageRecord(request.query.Body, (new Date()).toString(), chat.uniqueId, "A");

            // Update chat record in DB
            saveChatRecord("Answered", chat.bttn, chat.rep, chat.uniqueId, chat.revNum, chat.startTime);

            // Emit an answer socket event
            emitSocketEvents (("answer_" + chat.bttn), {
              message : request.query.Body,
              rep : rep.name
            });
          }
        }
        // Else, rep was not associated with any chats
        else {
          console.log("Rep " + rep.uniqueId + " is not currently associated with any chats");
        }
      });
    }
    // Else, text was from unknown number
    else {
      console.log("Received text from unknown number: " + request.query.From);
    }
  });
  response.send({"success":true});
});

//---Socket IO Handlers---------------------------------------------------------
var server = http.Server(app),
    io = require('socket.io')(server),
    sessions = [],
    sockets = [];

var socketLog = function(id) {
  return [
    '[socket.id:', id,
    sessions[id] ? ('session:' + sessions[id].cookie_session) : '', ']: '
  ].join(' ');
};

var observe_results = function(socket, recognize_end) {
  var session = sessions[socket.id];
  return function(err, chunk) {
    if (err) {
      console.error(socketLog(socket.id), 'error:', err);
      socket.emit('onerror', {
        error: err
      });
      session.req.end();
      socket.disconnect();
    }
    else {
      var transcript = (chunk && chunk.results && chunk.results.length > 0);

      if (transcript && !recognize_end) {
        socket.emit('speech', chunk);
      }
      if (recognize_end) {
        console.log(socketLog(socket.id), 'results:', JSON.stringify(chunk, null, 2));
        console.log('socket.disconnect()');
        socket.disconnect();
      }
    }
  };
};

// Create a session on socket connection
io.use(function(socket, next) {
  speechToText.createSession({}, function(err, session) {
    if (err) {
      console.error("The server could not create a session on socket ", socket.id);
      console.error(err);
      next(new Error('The server could not create a session'));
    }
    else {
      sessions[socket.id] = session;
      sessions[socket.id].open = false;
      sockets[socket.id] = socket;
      console.log(socketLog(socket.id), 'created session');
      console.log('The system now has:', Object.keys(sessions).length, 'sessions.');
      socket.emit('speech_session', session.session_id);
      next();
    }
  });
});

io.on('connection', function(socket) {
  var session = sessions[socket.id];

  // Catch questions coming from clients
  socket.on('client_question', function(data) {
    // If session is not open, begin the messaging session
    if (!session.open) {
      session.open = true;
    }
    console.log("Question received: ", data.message);

    dbHelper.getDoc(db, 'chats', 'chats_index', 'uniqueId', data.chatId, function(chat) {
      if (chat.uniqueId) {
        // If chat has a rep, message the rep
        if (chat.rep) {
          dbHelper.getDoc(db, 'reps', 'reps_index', 'uniqueId', chat.rep, function(rep) {
            if (rep.phoneNumber) {
              // Send message to rep if not locally testing
              if (!appEnv.isLocal)
                twilioHelper.sendTextMessage(twilioClient, "15123086551", rep.phoneNumber, data.message);

              // Update chat record in DB
              saveChatRecord("Asked", chat.bttn, chat.rep, chat.uniqueId, chat.revNum, chat.startTime);
            }
          });
        }
        // Else, assign a rep and message them
        else {
          dbHelper.getDoc(db, 'reps', 'reps_index', 'state', 'Available', function(rep) {
            if (rep.phoneNumber) {
              // Text the assigned rep
              textRepNewChat(rep.phoneNumber, data.message);

              // Update chat record in DB
              saveChatRecord("Asked", chat.bttn, rep.uniqueId, chat.uniqueId, chat.revNum, chat.startTime);

              // Update rep record in DB
              saveRepRecord(rep.name, rep.phoneNumber, "Busy", rep.uniqueId, rep.revNum);

              // Emit a notify socket event
              emitSocketEvents (("notify_" + chat.bttn), {
                message : rep.name + " has been assigned to your case and will be with you shortly",
                repPhoneNum : rep.phoneNumber
              });
            }
            else {
              console.info("No available reps");
              socket.emit('question_failed', "No representatives are currently available. Please try again later.");
            }
          });
        }
      }
      else {
        console.error("Chat corresponding to question asked not found in DB");
        socket.emit('question_failed', "The system is currently experiencing issues. Please try again later.");
      }
    });
  });

  // Catch socket.io speech payload
  socket.on('speech', function(data) {
    // If session is not open, post and get speech-to-text results
    if (!session.open) {
      session.open = true;
      var payload = {
        session_id: session.session_id,
        cookie_session: session.cookie_session,
        content_type: 'audio/l16; rate=' + (data.rate || 48000),
        continuous: true,
        interim_results: true
      };
      // POST /recognize to send data in every message we get
      session.req = speechToText.recognizeLive(payload, observe_results(socket, true));
      // GET /observeResult to get live transcripts
      speechToText.observeResult(payload, observe_results(socket, false));
    }
    else {
      session.req.write(data.audio);
    }
  });

  // Speech session was disconnected
  socket.on('speech_disconnect', function(data) {
    var session = sessions[socket.id];
    session.req.end();
  });

  // Chat was disconnected
  socket.on('chat_disconnect', function(data) {
    var session = sessions[socket.id];
    session.req.end();
  });

  // Delete the session on disconnect
  socket.on('disconnect', function() {
    speechToText.deleteSession(session, function() {
      delete sessions[socket.id];
      delete sockets[socket.id];
      console.log(socketLog(socket.id), 'delete_session');
    });
  });
});

// Emit input eventType socket event
function emitSocketEvents (eventType, data) {
  for (var value in sockets) {
    sockets[value].emit(eventType, data);
  }
}

//---Start HTTP Server----------------------------------------------------------
server.listen(appEnv.port, function() {
  //stabalizeDataStore();
  console.log("server started on port " + appEnv.port);
});

//---Process Ending Handlers----------------------------------------------------
process.on("exit", function(code) {
  stabalizeDataStore();
  console.log("exiting with code: " + code);
})

process.on("uncaughtException", function(err) {
  console.log("exiting on uncaught exception: " + err.stack);
  process.exit(1);
})

//---Server Functions-----------------------------------------------------------
// Ensures an input service is found in VCAPS
// If found, returns the service credentials
function getServiceCreds(appEnv, serviceName) {
  var serviceCreds = appEnv.getServiceCreds(serviceName)
  if (!serviceCreds) {
    console.log("service " + serviceName + " not bound to this application");
    return null;
  }
  return serviceCreds;
}

// Text rep with the input phone number, informing them of a new chat
function textRepNewChat(phoneNum, question) {

  var message = 'You have been assigned to help a customer with the following question: "' +
    question + '" Please reply with an answer or a follow-up question.' +
    " When the customer is satisfied, reply COMPLETE to end the chat.";

  // Send message to rep if not locally testing
  if (!appEnv.isLocal)
    twilioHelper.sendTextMessage(twilioClient, "15123086551", phoneNum, message);
}

// Stabalize the DB by placing all DB state values to a closed value
function stabalizeDataStore() {
  // Retrieve all open chats and mark them as Terminated
  console.log("Terminating all open chats and notifying associated users")
  dbHelper.getRecords(db, 'chats', 'chats_index', function(result) {
    var chats = JSON.parse(result),
        userMessage = "The server has shut down unexpectedly and your chat session has been closed as a result. We apologize for the inconvenience!",
        repMessage = "Due to an unexpected server outage, we have ended your chat.";
    for (var i=0; i < chats.length; i++) {
      if (chat.chatStatus !== "Completed" && chat.chatStatus !== "Terminated") {
        // Update chat record in DB
        saveChatRecord("Terminated", chat.bttn, chat.rep, chat.uniqueId, chat.revNum, chat.startTime, (new Date()).toString());

        // Emit a notify socket event to client saying session closed
        var notifySockCall = "notify_" + chat.bttn;
        for (var value in sockets) {
          sockets[value].emit(notifySockCall, {
            message : userMessage
          });
        }

        // If a rep has been assigned, update their status and send them a text
        if (chat.rep) {
          dbHelper.getDoc(db, 'reps', 'reps_index', 'uniqueId', chat.rep, function(rep) {
            if (rep.phoneNumber) {
              // Notify rep of server shut down
              if (!appEnv.isLocal)
                twilioHelper.sendTextMessage(twilioClient, "15123086551", rep.phoneNumber, repMessage);

              // Update rep record in DB
              saveRepRecord(rep.name, rep.phoneNumber, "Available", rep.uniqueId, rep.revNum);
            }
            else {
              console.log("Rep associated with chat " + chat.uniqueId + " was not found")
            }
          });
        }
      }
    }
  });
}

// Save rep record with the input values
function saveRepRecord(name, phoneNum, state, uniqueId, revNum) {
  var repRecord = {
    'type' : "rep",
    'repName' : name,
    'repPhoneNum' : phoneNum,
    'state' : state,
    '_id' : uniqueId,
    '_rev' : revNum
  };

  dbHelper.insertRecord(db, repRecord, function(result) {});
}

// Save chat record with the input values
function saveChatRecord(status, bttn, rep, uniqueId, revNum, start, end) {
  var chatRecord = {
    'type' : "chat",
    'startTime' : start,
    'chatStatus' : status,
    'bttnId' : bttn,
    'repId' : rep,
    '_id' : uniqueId,
    '_rev' : revNum
  };
  if (end) chatRecord.endTime = end;
  dbHelper.insertRecord(db, chatRecord, function(result) {});
}

// Save message record with the input values
function saveMessageRecord(text, time, chat, subType) {
  var msgRecord = {
    'type' : "message",
    'chatId' : chat,
    'msgText' : text,
    'msgTime' : time,
    'subType' : subType
  };
  dbHelper.insertRecord(db, msgRecord, function(result) {});
}
