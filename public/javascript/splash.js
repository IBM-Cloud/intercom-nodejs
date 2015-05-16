var questionExists; // Marks whether question has been posed yet

$(document).ready(function() {

  questionExists = false;

  // UI elements
  var bluemixLogo = $('.bluemix');

  bluemixLogo.click(function () {
    console.log("sdfs")
    location.href = "/chat";
  });
});
