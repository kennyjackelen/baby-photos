/* jshint node: true */
'use strict';
var fs = require('fs');
var readline = require('readline');
var googleAuth = require('google-auth-library');

var SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
var TOKEN_PATH = 'drive-api-token.json';
var CLIENT_SECRET_PATH = 'client_secret.json';

// Load client secrets from a local file.
fs.readFile( CLIENT_SECRET_PATH, function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Drive API.
  authorize(JSON.parse(content));
});

/**
 * Create an OAuth2 client with the given credentials.
 *
 * @param {Object} credentials The authorization client credentials.
 */
function authorize(credentials) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client);
    } else {
      oauth2Client.credentials = JSON.parse(token);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 */
function getNewToken(oauth2Client) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}