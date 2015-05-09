//---twilioHelper.js------------------------------------------------------------
module.exports = {

  // Sends a text message using Twilio
  sendTextMessage: function(client, sender, recipient, message) {
    client.messages.create({
      to: "+" + recipient, // Number we send the message to
      from: "+" + sender, // My Twilio number
      body: message // Body of the SMS message
    }, function(err, responseData) {
        if (!err) {
          console.log("The following message was sent:\n");
          console.log("To: ", responseData.to);
          console.log("From: ", responseData.from);
          console.log("Message: ", responseData.body);
          return "Success";
        }
        else {
          console.error("The following message failed to send:\n");
          console.error("To: ", responseData.to);
          console.error("From: ", responseData.from);
          console.error("Message: ", responseData.body);
          console.error("The returned error was:\n", err);
          return err;
        }
    });
  }
}
