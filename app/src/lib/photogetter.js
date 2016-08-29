/*jshint node:true */
'use strict';
var formatter = require('./photoformat.js');
var fs = require('fs');
var request = require('request');

var CACHE_DIR = '/data/photocache';
var DEBUG_MODE = false;

var drive;

function initialize( myDrive ) {
  drive = myDrive;
  return { 
    getOnePhoto: getOnePhoto,
    getOnePhotoPath: getOnePhotoPath
  };
}

function getOnePhotoPath( id, w, h ) {
  return CACHE_DIR + '/' + id + '-' + getFileSuffix( w, h ) + '.jpg';
}

function getFileSuffix( w, h ) {
  if ( w === 0 && h === 0 ) {
    return 'full';
  }
  else {
    return w + 'x' + h;
  }
}

function getOnePhoto( id, w, h, origCallback ) {
  // This function gets the specified photo at the specified dimensions.
  // It will check the local disk cache first, and pull the photo from Google
  // if it can't find a suitable version locally.
  // This function is the preferred way to get a photo by ID.
  var isFullImage;

  var callback = function() {
    if ( DEBUG_MODE ) { 
      console.log('ending:   ' + id + ' ' + w + 'x' + h );
    }
    origCallback.apply(this,arguments);
  };

  if ( DEBUG_MODE ) { 
    console.log('starting: ' + id + ' ' + w + 'x' + h );
  }

  if ( w === 0 && h === 0 ) {
    isFullImage = true;
  }
  var filenameResized = getOnePhotoPath( id, w, h );
  var filenameFull = getOnePhotoPath( id, 0, 0 );

  if ( isFullImage ) {
    fs.access( filenameFull, fs.R_OK, _canAccessFullSizeFile );
  }
  else {
    fs.access( filenameResized, fs.R_OK, _canAccessResizedFile );
  }

  function _canAccessResizedFile( err ) {
    if ( err ) {
      // The resized image didn't exist on disk.
      // See if the full size image is on disk instead.
      if ( DEBUG_MODE ) { 
        console.log( '[_canAccessResizedFile]: ' + err );
      }
      _lookForFullSizeOnDisk();
      return;
    }
    // The resized image already existed on disk. Read it so we can send it back.
    fs.readFile( filenameResized, _gotResizedFile );
  }

  function _gotResizedFile( err, data ) {
    if ( err ) {
      // The resized image didn't exist on disk.
      // See if the full size image is on disk instead.
      if ( DEBUG_MODE ) { 
        console.log( '[_gotResizedFile]: ' + err );
      }
      _lookForFullSizeOnDisk();
      return;
    }
    // The resized image already existed on disk. Send it back.
    callback( null, data );
  }

  function _lookForFullSizeOnDisk() {
    fs.access( filenameFull, fs.R_OK, _canAccessFullSizeFile );
  }

  function _canAccessFullSizeFile( err ) {
    if ( err ) {
      if ( DEBUG_MODE ) { 
        console.log( '[_canAccessFullSizeFile]: ' + err );
      }
      // The full size image didn't exist on disk.
      // Get it from the web.
      _getPhotoFromWeb( id, _gotPhotoFromWeb );
      return;
    }
    // The full size image already existed on disk, but the resized image didn't.
    // Read the full one, so that we can resize it, save it to disk, and send it back.
    fs.readFile( filenameFull, _gotFullSizeFile );
  }

  function _gotFullSizeFile( err, data ) {
    if ( err ) {
      if ( DEBUG_MODE ) { 
        console.log( '[_gotFullSizeFile]: ' + err );
      }
      // The full size image didn't exist on disk.
      // Get it from the web.
      _getPhotoFromWeb( id, _gotPhotoFromWeb );
      return;
    }
    // The full size image already existed on disk, but the resized image didn't.
    // Resize the full one, then save it to disk and send it back.
    if ( isFullImage ) {
      callback( null, data );
    }
    else {
      formatter.resize( data, w, h, _writeToFile );
    }
  }

  function _getPhotoFromWeb( id, callback ) {
    var options = { url: 'https://docs.google.com/uc?id=' + id, encoding: null };
    request( options, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        _rotateAndSaveFullsizeImage( id, body, callback );
        return;
      }
      callback( 'Error loading photo from web: ' + error );
    });
  }

  function _gotPhotoFromWeb( err, data ) {
    if ( err ) {
      // Something went wrong with the web request.
      callback( err );
      return;
    }
    // We have the full size image now, and it's already saved to disk.
    if ( isFullImage ) {
      // If this is all we needed, just send it back.
      callback( null, data);
    }
    else {
      // Resize the image, then save it to disk and send it back.
      formatter.resize( data, w, h, _writeToFile );
    }
  }

  function _writeToFile( err, imageBuffer ) {
    if ( err ) {
      callback( err );
      return;
    }
    formatter.save( imageBuffer, filenameResized, callback );
  }

  function _rotateAndSaveFullsizeImage( id, buffer, callback ) {
    drive.getPhotoObject( id, __gotPhotoObject );

    function __gotPhotoObject( err, photo ) {
      if ( err ) {
        callback( err );
        return;
      }
      if ( !drive.needsRotation( photo ) ) {
        formatter.save( buffer, filenameFull, callback );
      }
      else {
        formatter.rotate( buffer, __rotatedImage );
      }
      buffer = null;  // release reference to avoid memory leak
    }

    function __rotatedImage( err, buffer ) {
      if ( err ) {
        callback( err );
        return;
      }
      formatter.save( buffer, filenameFull, callback );
      buffer = null;  // release reference to avoid memory leak
    }
  }
}

module.exports = initialize;
