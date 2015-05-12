var questionExists; // Marks whether question has been posed yet

$(document).ready(function() {

  questionExists = false;

  // UI elements
  var micButton = $('.micButton'),
    micText = $('.micText'),
    transcript = $('#spokenText'),
    errorMsg = $('.errorMsg');

  // Speech recording
  var recording = false,
    speech = new SpeechRecognizer({
      ws : '',
      model : 'WatsonModel'
    });

  // Messaging socket
  var mainSock = new ConstantSocket({
      ws : '',
      bttnId : "10000080E1B4281F" //TODO: Use actual ID of Bttn from list
  });

  // Chat object
  var curChat = new Chat({
      bttnId : "10000080E1B4281F" //TODO: Use actual ID of Bttn from list
  });

  // Called when asking a question
  function ask(text) {
    showBubble(true, text);
    $('html, body').animate({ scrollTop : $(document).height() }, 'slow');
  }

  speech.onstart = function() {
    console.log('chat.onstart()');
    recording = true;
    micButton.addClass('recording');
    micText.text('Press bttn again when finished');
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

      /*var buttonObject = {
        'bttnName' : "Intercom bttn",
        'bttnId' : "10000080E1B4281F",
        'bttnLoc' : "Austin, TX",
        'bttnUrl' : "www.my.bt.tn/home",
        'callbackUrl' : "www.my.bt.tn/home/cb"
      };
      console.log(JSON.stringify(buttonObject));
      $.ajax({
      url: '/push',
      contentType: "application/json",
      type: 'POST',
      data: JSON.stringify(buttonObject),
      success : function(res) {
        console.log("Successful pushed!");
      },
      error : function(res) {
        console.log("Push Failure!");
      }
    });*/
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
        chatId: curChat._id,
        chatRev: curChat._rev,
        dateTime: startTime
      });

      // Update chat record in DB
      curChat.saveChat("Asked");
    }
    else {
      var error = "Error emitting client_question socket event";
      console.error(error);
      displayError(error);
    }
  };

  mainSock.onAnswer = function(answerText) {
    showBubble(false, answerText);
    $('html, body').animate({ scrollTop : $(document).height() }, 'slow');
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
