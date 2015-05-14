var questionExists; // Marks whether question has been posed yet

$(document).ready(function() {

  questionExists = false;

  // UI elements
  var micButton = $('.micButton'),
    micText = $('.micText'),
    transcript = $('#spokenText'),
    errorMsg = $('.errorMsg'),
    dummyMsgBtn = $('.dummyMsgBtn'),
    dummyMsgSendBtn = $('#dummyMsgSendBtn');

  // Speech recording
  var recording = false,
    speech = new SpeechRecognizer({
      ws : '',
      model : 'WatsonModel'
    });

  // Messaging socket
  var mainSock = new ConstantSocket({
      ws : '',
      bttnId : "2406" //TODO: Use actual ID of Bttn from list
  });

  // Chat object
  var curChat = new Chat({
      bttnId : "2406" //TODO: Use actual ID of Bttn from list
  });
  mainSock._id = curChat._id;

  // Set up modal click/send/hide functionality
  dummyMsgBtn.click(function() {
    $('#dummyTextModal').modal('show');
  });
  dummyMsgSendBtn.click(function() {
    mainSock.onDummyAnswer(document.getElementById('dummyMsg').value);
    $('#dummyTextModal').modal('hide');
  });
  $('#dummyTextModal').on('hidden.bs.modal', function () {
    document.getElementById('dummyMsg').value = "";
  })

  // Called when asking a question
  function ask(text) {
    showBubble(true, text);
    $('html, body').animate({ scrollTop : $(document).height() }, 'slow');
  }

  speech.onstart = function() {
    console.log('chat.onstart()');
    recording = true;
    micButton.addClass('recording');
    micText.text('Stop speaking when finished');
    errorMsg.hide();
    transcript.show();

    // Clean the paragraphs
    transcript.empty();
    $('<p></p>').appendTo(transcript);
  };

  speech.onerror = function(error) {
    console.log('chat.onerror():', error);
    recording = false;
    micButton.removeClass('recording');
    displayError(error);
  };

  speech.onend = function() {
    console.log('speech.onend()');
    recording = false;
    micButton.removeClass('recording');
    micText.text('Press bttn to start speaking');

    // Get spoken text and create the question chat bubble
    var spokenText = document.getElementById("spokenText").children;
    if (spokenText && spokenText.length > 1)
    {
      var questionText = "";
      // Concatenate all returned text
      for (var i=0; i < spokenText.length - 1; i++)
      {
        if (i != 0)
          questionText += " ";
        questionText += spokenText[i].innerHTML;
      }
      console.log("Posting question: " + questionText);
      mainSock.onQuestion(questionText);
      ask(questionText);
      transcript.empty();
    }
  };

  speech.onresult = function(data) {
    showResult(data);
  };

  mainSock.onBttnPush = function() {
    console.log('constantSocket.onBttnPush()');
    speech.start();
  };

  mainSock.onQuestion = function(messageText) {
    if (this.socket.connected) {
      var startTime = (new Date()).toString();
      this.socket.emit('client_question', {
        message: messageText,
        chatId: curChat._id
      });

      // Update chat and message record in DB
      curChat.saveQuestion(messageText);
    }
    else {
      var error = "Error emitting client_question socket event";
      console.error(error);
      displayError(error);
    }
  };

  mainSock.onAnswer = function(answerText, repName) {
    showBubble(false, answerText);
    $('html, body').animate({ scrollTop : $(document).height() }, 'slow');
  };

  mainSock.onDummyAnswer = function(answerText) {
    console.log("Sending dummy text: " + answerText);
    // Change answer text to valid URL format
    answerText = answerText.trim().split(' ').join('+');

    // Generate random SMS message Sid
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
        length = 32,
        sid = '';
    for (var i = length; i > 0; --i) sid += chars[Math.round(Math.random() * (chars.length - 1))];

    // Build AJAX URL
    var url = "/sms?";
    url += "ToCountry=US";
    url += "&ToState=TX";
    url += "&SmsMessageSid=SM" + sid;
    url += "&NumMedia=0";
    url += "&ToCity=BASTROP";
    url += "&FromZip=06850";
    url += "&SmsSid=SM" + sid;
    url += "&FromZip=78746";
    url += "&FromState=TX";
    url += "&SmsStatus=received";
    url += "&FromCity=AUSTIN";
    url += "&Body=" + answerText;
    url += "&FromCountry=US";
    url += "&To=%2B15123086551";
    url += "&ToZip=78662";
    url += "&MessageSid=SMfa05566cf07a7c49f0aa38587c624b48";
    url += "&AccountSid=ACa9d050536caa254ab4ba274781a1fef0";
    url += "&From=%2B" + mainSock.repPhoneNum;
    url += "&ApiVersion=%2010-04-01";

    // Send dummy text message
    $.ajax( {
      url: url,
      cache : false
    }).done(function(data) {
      if (data.success === true) {
        console.log("Sent dummy message successfully");
      }
      else {
        console.error("Error sending dummy message");
        console.error(data);
      }
    });
  };

  mainSock.onNotification = function(notificationText) {
    showNotification(notificationText);
    $('html, body').animate({ scrollTop : $(document).height() }, 'slow');
  };

  mainSock.onEnd = function() {
    console.log('constantSocket.onEnd()');
    mainSock.socket.emit('chat_disconnect');

    // Hide mic elements
    document.getElementById("mic").style.display = "none";
  };

  mainSock.onerror = function(error) {
    console.log('constantSocket.onerror():', error);
    displayError(error);
  };

  micButton.click(function() {
    if (!recording) {
      speech.start();
    }
    else {
      speech.stop();
      micButton.removeClass('recording');
      micText.text('Processing speech');
    }
  });

  function showResult(data) {
    // If speech transcript received
    if (data.results && data.results.length > 0) {
      // if is a partial transcripts
      if (data.results.length === 1 ) {
        var paragraph = transcript.children().last(),
          text = data.results[0].alternatives[0].transcript || '';
        //Capitalize first word
        text = text.charAt(0).toUpperCase() + text.substring(1);
        // if final results, append a new paragraph and end speech collection
        if (data.results[0].final){
          text = text.trim() + '.';
          $('<p></p>').appendTo(transcript);

          speech.stop();
          micButton.removeClass('recording');
          micText.text('Processing speech');
        }
        paragraph.text(text);
      }
    }
    transcript.show();
  }

  function displayError(error) {
    console.log(error);
    var message = error;
    try {
      var errorJson = JSON.parse(error);
      message = JSON.stringify(errorJson, null, 2);
    }
    catch (e) {
      message = error;
    }

    errorMsg.text(message);
    errorMsg.show();
    transcript.hide();
  }

  function _error(xhr) {
    $('.loading').hide();
    displayError('Error processing the request, please try again.');
  }
});
