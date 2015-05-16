# Overview

Intercom allows users to remotely chat with representatives using Watson [Speech to Text][speech_text_url] technology. The representatives are notified via text and can reply directly to the user by SMS using the [Twilio APIs][twilio_url]. All of this is kicked off at the push of a [bttn][bttn_url], enabling users to comminute with ultimate ease by completely avoid manual input into the app.

[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/IBM-Bluemix/intercom-nodejs)

## How it Works

1. Push the bttn to start a conversation

2. Once the mic is flashing red, start recording your message. The app will automatically detect when you are done speaking and send the message. Your chat will be automatically assigned to an available representative.

3. Using Twilio, the rep will respond to your inquiry

4. This manner of communication can continue as long as either party would like. Once the rep has decided that they have addressed the user's concerns, they will end the chat.

5. Rinse and repeat to your heart's content!

## Architecture Diagram

<img src="https://raw.githubusercontent.com/IBM-Bluemix/intercom-nodejs/master/public/images/diagram.png" width="650px"><br>This an architectural overview of the systems that make this app run.<br>

## Getting Started

1. Create a Bluemix Account

    [Sign up][sign_up_url] in Bluemix, or use an existing account.

2. Download and install the [Cloud-foundry CLI][cloud_foundry_url] tool

3. Edit the `manifest.yml` file and change the `<application-name>` and `<application-host>` to something unique.
  ```none
  applications:
  - name: Intercom-user1
    framework: node
    runtime: node10
    memory: 512M
    instances: 1
    host: intercom-user1
  ```
  The host you use will determinate your application url initially, e.g. `<application-host>.mybluemix.net`.

4. Connect to Bluemix in the command line tool and follow the prompts to log in.
  ```sh
  $ cf api https://api.ng.bluemix.net
  $ cf login
  ```

5. Create the Cloudant service in Bluemix.
  ```sh
  $ cf create-service cloudantNoSQLDB Shared cloudant-service
  ```

6. Create the Speech to Text service in Bluemix.
  ```sh
  $ cf create-service speech_to_text free speech-to-text-service
  ```

7. Push it to Bluemix. This will initially fail, but don't worry! The next steps will get your app up and running!
  ```sh
  $ cf push
  ```

8. Create a Twilio service by adding it in the catalog, inputting your Account SID and Auth Token, and binding the service to your app.

9. Create a customer user provided service to store your DB reset credentials
  ```sh
  $ cf cups CloudantCleanser -p '{"host":"https://YOUR_HOST_NAME.mybluemix.net/db/reset","username":"YOUR_USER_NAME","password":"YOUR_PASSWORD"}'
  ```
10. Enter the Cloudant dashboard and do the following:

<br>
  a. Create a DB called 'intercom'

<br>
  b. Create the following design docs:

<br>
    i. Bttns

<br>
    Document: _design/bttns

<br>
    Index name: bttns_index

<br>
    Map function:
      ```sh
      function(doc) {
        if (doc.type === 'bttn') {
          emit(doc._id, {
            uniqueId : doc._id,
            revNum : doc._rev,
            name : doc.bttnName,
            bttnId : doc.bttnId
          });
        }
      }
      ```
<br>
    ii. Chats

<br>
    Document: _design/chats

<br>
    Index name: chats_index

<br>
    Map function:
      ```sh
      function(doc) {
          if (doc.type === 'chat') {
            emit(doc._id, {
              uniqueId : doc._id,
              revNum : doc._rev,
              startTime : doc.startTime,
              chatStatus : doc.chatStatus,
              bttn : doc.bttnId,
              rep : doc.repId
            });
          }
      }
      ```
<br>
    iii. Messages

<br>
    Document: _design/messages

<br>
    Index name: messages_index

<br>
    Map function:
      ```sh
      function(doc) {
          if (doc.type === 'chat') {
            emit(doc._id, {
              uniqueId : doc._id,
              revNum : doc._rev,
              startTime : doc.startTime,
              chatStatus : doc.chatStatus,
              bttn : doc.bttnId,
              rep : doc.repId
            });
          }
      }
      ```
<br>
    iv. Reps

<br>
    Document: _design/reps

<br>
    Index name: reps_index

<br>
    Map function:
      ```sh
      function(doc) {
          if (doc.type === 'rep') {
            emit(doc._id, {
              uniqueId : doc._id,
              revNum : doc._rev,
              name : doc.repName,
              phoneNumber : doc.repPhoneNum,
              state : doc.state
            });
          }
      }
      ```

## Troubleshooting

To troubleshoot your Bluemix app the main useful source of information are the logs, to see them, run:

  ```sh
  $ cf logs <application-name> --recent
  ```

[speech_text_url]: https://www.ibm.com/smarterplanet/us/en/ibmwatson/developercloud/speech-to-text.html
[twilio_url]: https://www.twilio.com/docs/api
[bttn_url]: http://bt.tn/
[sign_up_url]: https://apps.admin.ibmcloud.com/manage/trial/bluemix.html
[cloud_foundry_url]: https://github.com/cloudfoundry/cli
