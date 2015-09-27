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

function getPhotoObject( photoID, callback ) {
  var service = google.drive('v2');
  service.files.get(
    {
      fileId: photoID,
      auth: oauth2Client
    },
    function ___digestPhoto( err, response ) {
      if (err) {
        callback( 'The API returned an error: ' + err );
        return;
      }
      callback( null, response );
    }
  );
}

function getPhotoList( folderID, callback ) {
  var service = google.drive('v2');
  var MAX_RESULTS = 1000;

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
      callback( 'The API returned an error: ' + err );
      return;
    }
    async.map( response.items, _getFullPhotoObject, _gotPhotoObjects );
  }

  function _getFullPhotoObject( litePhotoObject, asyncCallback ) {
    getPhotoObject( litePhotoObject.id, asyncCallback );
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
