# CLI

## Overview

The [jovo-dew](https://github.com/raintech-oss/jovo-dew) library uses various files and folders to make developing Jovo 4 applications easier. This CLI uses a Google Sheet to define intents, utterances, slots/entities, views, audio and content and converts them to files in your Jovo 4 project.

## Installation

You can install the CLI like this:

```sh
$ npm install -g @raintech-oss/dew-cli
```

## Getting Started

You will need the following:
1. A [Google Service account](https://console.cloud.google.com/). Rename and download the `client_secret.json` file to the root of your Jovo 4 project.

    ```json
    // client_secret.json
    // add to .gitignore
    // REDACTED
    {
      "type": "service_account",
      "project_id": "PROJECT_ID",
      "private_key_id": "PRIVATE_KEY_ID",
      "private_key": "-----BEGIN PRIVATE KEY-----\nSOME KEY\n-----END PRIVATE KEY-----\n",
      "client_email": "CLIENT_EMAIL",
      "client_id": "CLIENT_ID",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "CERT_URL"
    }
    ```

2. A Google Sheet that is shared with your service account `client_email`. See [sample Google Sheet](https://docs.google.com/spreadsheets/d/1vXMhnooJUUQrJdjDBgJ3gcRphUl8JL8IW7QgyUPwtYc/edit#gid=0).


3. Add a `.dew.json` file to root of Jovo 4 project and set `sheetId` to the id of the Google Sheet (from the sheet URL) from step 2:

    ```json
    // .dew.json
    {
      "sheetId": ["1vXMhnooJUUQrJdjDBgJ3gcRphUl8JL8IW7QgyUPwtYc"],
      "contentPath": "./src/content",
      "modelPath": "./models",
      "i18nPath": "./src/i18n",
      "formatVersion": 4
    }

    ```
## Run CLI

With the `client_secret.json` and `.dew.json` files in the project directory, run the following command:

```sh
$ dew sheet
```

The terminal output will include links to the files created.