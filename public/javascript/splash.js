var questionExists; // Marks whether question has been posed yet

$(document).ready(function() {
  questionExists = false;

  var getStartedBtn = $('.get-started');
  getStartedBtn.click(function () {
    location.href = "/chat";
  });
});
