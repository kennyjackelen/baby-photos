/*jshint node:true */
'use strict';
var google = require('googleapis');
var async = require('async');

var oauth2Client;

function initialize( myOauth2Client ) {
  oauth2Client = myOauth2Client;
  return {
    getPhotoObject: getPhotoObject,
    getPhotoList: getPhotoList,
    needsRotation: needsRotation
  };
}

function getPhotoObject( photoID, callback, throttle ) {
  var service = google.drive('v2');
  service.files.get(
    {
      fileId: photoID,
      auth: oauth2Client
    },
    function ___digestPhoto( err, response ) {
      if (err) {
        callback( '[getPhotoObject] The API returned an error: ' + err );
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
  var REQUEST_THROTTLE_MS = 100;
  var MAX_CONCURRENT_REQUESTS = 3;

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
