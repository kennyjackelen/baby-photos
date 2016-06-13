/*jshint node:true */
'use strict';
var google = require('googleapis');
var async = require('async');
var fs = require('fs');
var googleAuth = require('google-auth-library');
var path = require('path');

var oauth2Client;

function initialize() {
  createOauth2Client();
  return {
    getPhotoObject: getPhotoObject,
    getPhotoList: getPhotoList,
    needsRotation: needsRotation
  };
}

function createOauth2Client() {

  var TOKEN_PATH = path.join( __dirname, '../credentials/drive-api-token.json');
  var CLIENT_SECRET_PATH = path.join( __dirname, '../credentials/client_secret.json');
  async.parallel(
    {
      credentials: function( callback ) {
        fs.readFile( CLIENT_SECRET_PATH, function ( err, content ) {
          if ( err ) {
            callback( 'Error loading client secret: ' + err );
            return;
          }
          callback( null, JSON.parse( content ) );
        } );
      },
      token: function( callback ) {
        fs.readFile( TOKEN_PATH, function ( err, content ) {
          if ( err ) {
            callback( 'Error loading auth token: ' + err );
            return;
          }
          callback( null, JSON.parse( content ) );
        } );
      }
    },
    function( err, results ) {
      if ( err ) {
        return;
      }
      var clientSecret = results.credentials.installed.client_secret;
      var clientId = results.credentials.installed.client_id;
      var auth = new googleAuth();
      oauth2Client = new auth.OAuth2(clientId, clientSecret);
      oauth2Client.credentials = results.token;
    }
  );
}

function getPhotoObject( photoID, callback, throttle, dontRetry ) {
  var service = google.drive('v2');
  service.files.get(
    {
      fileId: photoID,
      auth: oauth2Client
    },
    function ___digestPhoto( err, response ) {
      if (err) {
        if ( !dontRetry ) {
          setTimeout(
            function() { getPhotoObject( photoID, callback, throttle, 1 ); },
            throttle
          );
        }
        else {
          callback( '[getPhotoObject] The API returned an error: ' + err );
        }
        return;
      }
      if ( throttle ) {
        setTimeout(
          function(){ 
            callback( null, response );
          },
          throttle
        );
      }
      else {
        callback( null, response );
      }
    }
  );
}

function getPhotoList( folderID, callback ) {
  var service = google.drive('v2');
  var MAX_RESULTS = 1000;
  
  // The API limit is 10 requests per second (per user, but we are the only user)
  // We'll stay under this as long as we wait a second after each request comes back,
  // and we never have more than 10 requests in flight at once.
  var REQUEST_THROTTLE_MS = 1000;
  var MAX_CONCURRENT_REQUESTS = 10;

  service.children.list(
    {
      folderId: folderID,
      auth: oauth2Client,
      maxResults: MAX_RESULTS
    },
    _digestListOfPhotos
  );
  
  function _digestListOfPhotos( err, response ) {
    if ( err ) {
      callback( '[getPhotoList] The API returned an error: ' + err );
      return;
    }
    async.mapLimit( response.items, MAX_CONCURRENT_REQUESTS, _getFullPhotoObject, _gotPhotoObjects );
  }

  function _getFullPhotoObject( litePhotoObject, asyncCallback ) {
    getPhotoObject( litePhotoObject.id, asyncCallback, REQUEST_THROTTLE_MS );
  }

  function _gotPhotoObjects( err, photos ) {
    if ( err ) {
      callback( err );
      return;
    }
    callback( null, photos );
  }
}

function needsRotation( photoObject ) {
  try {
    return Boolean( photoObject.imageMediaMetadata.rotation );
  }
  catch ( e ) {
    return false;
  }
}

module.exports = initialize;
