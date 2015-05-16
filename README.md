# Overview

Intercom allows users to remotely chat with representatives using Watson [Speech to Text][speech_text_url] technology. The representatives are notified via text and can reply directly to the user by SMS using the [Twilio APIs][twilio_url]. All of this is kicked off at the push of a [bttn][bttn_url], enabling users to completely avoid manual input into the app.

[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/IBM-Bluemix/intercom-nodejs)

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

4. Connect to Bluemix in the command line tool.
  ```sh
  $ cf api https://api.ng.bluemix.net
  $ cf login
  ```


## Files

The Node.js application has files as below:

*   app.js

	This file contains the server side JavaScript code for the application written using node.js

*   package.json

	This file is required by the node.js runtime. It specifies the node.js project name, dependencies, and other configurations of your node.js application.

*   node_modules/

	This directory contains the modules used and referenced in the application. It is required by the express framework.

*   public/

	This directory contains public resources of the application. It contains the images, CSS, and JS resources. It is required by the express framework.

*   views/

	This directory contains the .dust files used to deliver the views to the client accessing the application.

[speech_text_url]: https://www.ibm.com/smarterplanet/us/en/ibmwatson/developercloud/speech-to-text.html
[twilio_url]: https://www.twilio.com/docs/api
[bttn_rl]: http://bt.tn/
[sign_up_url]: https://apps.admin.ibmcloud.com/manage/trial/bluemix.html
[cloud_foundry_url]: https://github.com/cloudfoundry/cli
