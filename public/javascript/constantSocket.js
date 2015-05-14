/**
 *  @author Jake Peyser <jepeyser@us.ibm.com>
 *
 * @param {String} _options.ws  WebSocket URL
 * @param {String} _options.session_id  Socket session ID
 *
 */
function ConstantSocket(_options) {
  var options = _options || {};

  this.ws = options.ws || '';
  this.session_id = options.session_id || '';
  this.bttnId = options.bttnId || '';

  var self = this;

  console.log('ConstantSocket._init():', this.ws);
  this.socket = io.connect(this.ws);

  this.socket.on('connect', function() {
    console.log('constantSocket.onconnect()');
    self.connected = true;
  });

  this.socket.on('disconnect', function() {
    console.log('constantSocket.ondisconnect()');
    self.onEnd();
  });

  this.socket.on('message_session', function(session) {
    console.log('Message session: ', session);
    self.session_id = session;
  });

  var bttnPushSockCall = "bttn_push_" + this.bttnId;
  this.socket.on(bttnPushSockCall, function() {
    self.onBttnPush();
  });

  var notifySockCall = "notify_" + this.bttnId;
  this.socket.on(notifySockCall, function(notification) {
    if (notification.repPhoneNum)
      self.repPhoneNum = notification.repPhoneNum;
    self.onNotification(notification.message);
  });

  var answerSockCall = "answer_" + this.bttnId;
  this.socket.on(answerSockCall, function(answer) {
    self.onAnswer(answer.message, answer.repName);
  });

  var endSockCall = "end_" + this.bttnId;
  this.socket.on(endSockCall, function() {
    self.onEnd();
  });

  this.socket.on('question_failed', function(issue) {
    console.log('constantSocket.question_failed()');
    self.onerror(issue);
  });

  this.socket.on('connect_failed', function() {
    console.log('constantSocket.connect_failed()');
    self.onerror('WebSocket can not be contacted');
  });

  var onError = function(error) {
    var errorStr = error ? error : 'A unknown error occurred';
    console.log('constantSocket.onerror()', errorStr);
    self.onerror(errorStr);
  };

  this.socket.on('error', onError);
  this.socket.on('onerror', onError);
}

// Functions used for main socket events.
ConstantSocket.prototype.onQuestion = function() {};
ConstantSocket.prototype.onAnswer = function() {};
ConstantSocket.prototype.onDummyAnswer = function() {};
ConstantSocket.prototype.onNotification = function() {};
ConstantSocket.prototype.onerror = function() {};
ConstantSocket.prototype.onBttnPush = function() {};
ConstantSocket.prototype.onEnd = function() {
  console.log('constantSocket.onEnd()');
  this.socket.emit('chat_disconnect');
};
