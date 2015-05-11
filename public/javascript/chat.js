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
      ws: '',
      model: 'WatsonModel'
    });

  // Messaging socket
  var mainSock = new ConstantSocket({
      ws: ''
  });

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

      /*var testQuestion = {
        'question' : questionText
      };
      console.log(testQuestion);
      console.log(JSON.stringify(testQuestion));
      $.ajax({
      url: '/push',
      type: 'POST',
      data: JSON.stringify(testQuestion),
      success : function(res) {
        console.log("Successful AJAX!");
      },
      error : function(res) {
        console.log("AJAX Failure!");
      }
    });*/
    }
  };

  speech.onresult = function(data) {
    console.log('speech.onresult()');
    showResult(data);
  };

  mainSock.onBttnPush = function(error) {
    console.log('constantSocket.onBttnPush()');
    speech.start();
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
        console.log(text);
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
