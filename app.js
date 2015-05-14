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
    response.render('index');
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
  // Only chats associated with pushed bttn will catch event
  var sockCall = "bttn_push_" + req.body.bttnId;
  for (var value in sockets)
    sockets[value].emit(sockCall, {});

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
  //RETURNING DB INFO
  /*
  { update_seq: '96-g1AAAAG9eJzLYWBg4MhgTmGQS0lKzi9KdUhJMtLLTMo1MLDUS87JL01JzCvRy0styQGqY0pkSJL___9_ViI_SIc8XIehAU4tSQpAMskerAvNHgvcmhxAmuLBmvhQNZni1pQA0lQP1sRGrI_yWIAkQwOQAuqbn5XISbTHIDoXQHTux3Anbs9BNB6AaLyflShErAchGh9ANAI9yZMFAKFrjng',
  db_name: 'intercom',
  sizes: { file: 1754684, external: 3634, active: 33200 },
  purge_seq: 0,
  other: { data_size: 3634 },
  doc_del_count: 32,
  doc_count: 16,
  disk_size: 1754684,
  disk_format_version: 6,
  compact_running: false,
  instance_start_time: '0' }
  */
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
              var repRecord = {
                'type' : "rep",
                'repName' : rep.name,
                'repPhoneNum' : rep.phoneNumber,
                'state' : "Available",
                '_id' : rep.uniqueId,
                '_rev' : rep.revNum
              };
              dbHelper.insertRecord(db, repRecord, function(result) {});

            // Update chat record in DB
              var chatRecord = {
              'type' : "chat",
              'startTime' : chat.startTime,
              'chatStatus' : "Completed",
              'bttnId' : chat.bttn,
              'repId' : chat.rep,
              '_id' : chat.uniqueId,
              '_rev' : chat.revNum
            };
            dbHelper.insertRecord(db, chatRecord, function(result) {});

            // Emit a notify socket event
            var notifySockCall = "notify_" + chat.bttn;
            for (var value in sockets) {
              sockets[value].emit(notifySockCall, {
                message : rep.name + " has ended the conversation. Have a good day!"
              });
            }

            // Emit an end socket event
            var endSockCall = "end_" + chat.bttn;
            for (var value in sockets) {
              sockets[value].emit(endSockCall);
            }
          }
          // Else, they are answering the customer
          else {
            // Insert message record into DB
            var msgRecord = {
              'type' : "message",
              'chatId' : chat.uniqueId,
              'msgText' : request.query.Body,
              'msgTime' : (new Date()).toString(),
              'subType' : "A"
            };
            dbHelper.insertRecord(db, msgRecord, function(result) {});

            // Update chat record in DB
              var chatRecord = {
              'type' : "chat",
              'startTime' : chat.startTime,
              'chatStatus' : "Answered",
              'bttnId' : chat.bttn,
              'repId' : chat.rep,
              '_id' : chat.uniqueId,
              '_rev' : chat.revNum
            };
            dbHelper.insertRecord(db, chatRecord, function(result) {});

            // Emit an answer socket event
            var sockCall = "answer_" + chat.bttn;
            for (var value in sockets) {
              sockets[value].emit(sockCall, {
                message : request.query.Body,
                rep : rep.name
              });
            }
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
              var chatRecord = {
                'type' : "chat",
                'startTime' : chat.startTime,
                'chatStatus' : "Asked",
                'bttnId' : chat.bttn,
                'repId' : chat.rep,
                '_id' : chat.uniqueId,
                '_rev' : chat.revNum
              };
              dbHelper.insertRecord(db, chatRecord, function(result) {});
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
              var chatRecord = {
                'type' : "chat",
                'startTime' : chat.startTime,
                'chatStatus' : "Asked",
                'bttnId' : chat.bttn,
                'repId' : rep.uniqueId,
                '_id' : chat.uniqueId,
                '_rev' : chat.revNum
              };
              dbHelper.insertRecord(db, chatRecord, function(result) {});

              // Update rep record in DB
              var repRecord = {
                'type' : "rep",
                'repName' : rep.name,
                'repPhoneNum' : rep.phoneNumber,
                'state' : "Busy",
                '_id' : rep.uniqueId,
                '_rev' : rep.revNum
              };

              dbHelper.insertRecord(db, repRecord, function(result) {});

              // Emit a notify socket event
              var sockCall = "notify_" + chat.bttn;
              for (var value in sockets) {
                sockets[value].emit(sockCall, {
                  message : rep.name + " has been assigned to your case and will be with you shortly",
                  repPhoneNum : rep.phoneNumber
                });
              }
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

//---Start HTTP Server----------------------------------------------------------
server.listen(appEnv.port, function() {
  console.log("server started on port " + appEnv.port);
});

//---Process Ending Handlers----------------------------------------------------
process.on("exit", function(code) {
  // TODO: Set all chats to 'Terminated' and reps to 'Available'
  console.log("exiting with code: " + code);
})

process.on("uncaughtException", function(err) {
  // TODO: Set all chats to 'Terminated' and reps to 'Available'
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

function textRepNewChat(phoneNum, question) {

  var message = 'You have been assigned to help a customer with the following question: "' +
    question + '" Please reply with an answer or a follow-up question.' +
    " When the customer is satisfied, reply COMPLETE to end the chat.";

  // Send message to rep if not locally testing
  if (!appEnv.isLocal)
    twilioHelper.sendTextMessage(twilioClient, "15123086551", phoneNum, message);
}
