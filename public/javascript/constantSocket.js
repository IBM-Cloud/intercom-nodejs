/**
 *  @author Jake Peyser <jepeyser@us.ibm.com>
 *
 * @param {String} _options.ws  WebSocket URL
 * @param {String} _options.rep  Rep WebSocket URL
 * @param {String} _options.session_id  Socket session ID
 *
 */
function ConstantSocket(_options) {
  var options = _options || {};

  this.ws = options.ws || '';
  this.rep = options.rep || '';
  this.session_id = options.session_id || '';

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
    console.log('Message session:', session);
    self.session_id = session;
  });

  this.socket.on('bttn_push', function() {
    self.onBttnPush();
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

  this.socket.on('message', function(msg){
    //console.log('constantSocket.onmessage():', msg);
    self.onAnswer(msg);
  });
}

// Functions used for main socket events.
ConstantSocket.prototype.onQuestion = function(data) {
  if (this.socket.connected)
    this.socket.emit('message', {message: data});
};
ConstantSocket.prototype.onAnswer = function() {};
ConstantSocket.prototype.onerror = function() {};
ConstantSocket.prototype.onBttnPush = function() {};
ConstantSocket.prototype.onEnd = function() {
  console.log('constantSocket.onEnd()');
  this.socket.emit('message', {disconnect:true});
};
