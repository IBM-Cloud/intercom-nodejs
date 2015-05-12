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
var appEnv = cfenv.getAppEnv(appEnvOpts)

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
  console.log("bttn " + req.body.bttnId + "push received");

  // Emit a bttn_push event to all active sockets
  // Only chats associated with pushed bttn will catch event
  for (var value in sockets)
    sockets[value].emit(req.body.bttnId, {});

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
  if (request.query.uniqueId) repRecord._id = request.query.uniqueId;
  if (request.query.revNum) repRecord._rev = request.query.revNum;

  // Insert representative record into DB
  dbHelper.insertRecord(db, repRecord, function(result) {
    response.send(result);
  });
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

  // Catch socket.io message payload
  socket.on('client_question', function(data) {
    // If session is not open, begin the messaging session
    if (!session.open) {
      session.open = true;
    }
    console.log("Question received: ", data.message);
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
    session.req.end();
  });

  // Chat was disconnected
  socket.on('chat_disconnect', function(data) {
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

// Texts the admins who opted in for new event notifications
function textAdminsNewEvent(eventRecord) {
  dbHelper.getRecords(db, 'admins_1', 'admins_index', function(result) {
    // If error getting the phone numbers, just return
    if (result.error)
      return;

    // Generate a text message to send admins
    var message = eventRecord.requestorInfo.requestorName +
      " just requested an event for " + eventRecord.clientInfo.clientName +
      " called " + eventRecord.eventInfo.eventName +
      ". Check out Bluemix Events to vet this request!";

    // Text each subscribed admin about the new event
    var adminNums = JSON.parse(result);
    for (var i=0; i < adminNums.length; i++) {
      twilioHelper.sendTextMessage(twilioClient, "15123086551", adminNums[i].phone, message);
    }
  });
}
