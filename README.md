# Overview

Intercom allows users to initiate and participate in remote chats
with various experts through voice communication.


## Files

The Node.js application has files as below:

*   app.js

	This file contains the server side JavaScript code for the application written using node.js

*   package.json

	This file is required by the node.js runtime. It specifies the node.js project name, dependencies, and other configurations of your node.js application.

*   node_modules/

<<<<<<< HEAD
	This directory contains the modules used and referenced in the application. It is required by the express framework.
=======
<img src="https://raw.githubusercontent.com/IBM-Bluemix/intercom-nodejs/master/public/images/diagram.png" width="650px"><br>This an architectural overview of the systems that make this app run.<br>
>>>>>>> master

*   public/

	This directory contains public resources of the application. It contains the images, CSS, and JS resources. It is required by the express framework.

*   views/

<<<<<<< HEAD
	This directory contains the .dust files used to deliver the views to the client accessing the application.
=======
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
10. Enter the Cloudant dashboard and do the following:<br>
&nbsp;&nbsp;&nbsp;a. Create a DB called 'intercom'<br>
&nbsp;&nbsp;&nbsp;b. Create the following design docs:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;i. Bttns<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Document: _design/bttns<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Index name: bttns_index<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Map function:<br>
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
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ii. Chats<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Document: _design/chats<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Index name: chats_index<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Map function:<br>
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
    iii. Messages<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Document: _design/messages<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Index name: messages_index<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Map function:<br>
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
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;iv. Reps<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Document: _design/reps<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Index name: reps_index<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Map function:<br>
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
>>>>>>> master
