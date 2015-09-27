/*jshint node:true */
'use strict';
var formatter = require('./photoformat.js');
var fs = require('fs');
var request = require('request');

var CACHE_DIR = '/data/photocache';

var drive;

function initialize( myDrive ) {
  drive = myDrive;
  return getOnePhoto;
}

function getOnePhoto( id, w, h, callback ) {
  // This function gets the specified photo at the specified dimensions.
  // It will check the local disk cache first, and pull the photo from Google
  // if it can't find a suitable version locally.
  // This function is the preferred way to get a photo by ID.
  var isFullImage;
  var fileSuffix;
  if ( w === 0 && h === 0 ) {
    isFullImage = true;
    fileSuffix = 'full';
  }
  else {
    fileSuffix = w + 'x' + h;
  }
  var filenameResized = CACHE_DIR + '/' + id + '-' + fileSuffix + '.jpg';
  var filenameFull = CACHE_DIR + '/' + id + '-full.jpg';

  fs.readFile( filenameResized, _gotResizedFile );

  function _gotResizedFile( err, data ) {
    if ( err ) {
      // The resized image didn't exist on disk.
      // See if the full size image is on disk instead.
      _lookForFullSizeOnDisk();
      return;
    }
    // The resized image already existed on disk. Send it back.
    callback( null, data );
  }

  function _lookForFullSizeOnDisk() {
    fs.readFile( filenameFull, _gotFullSizeFile );
  }

  function _gotFullSizeFile( err, data ) {
    if ( err ) {
      // The full size image didn't exist on disk.
      // Get it from the web.
      _getPhotoFromWeb( id, _gotPhotoFromWeb );
    }
    // The full size image already existed on disk, but the resized image didn't.
    // Resize the full one, then save it to disk and send it back.
    formatter.resize( data, w, h, _writeToFile );
  }

  function _getPhotoFromWeb( id, callback ) {
    var options = { url: 'https://docs.google.com/uc?id=' + id, encoding: null };
    request( options, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        _rotateImage( id, body, _rotatedImage);
        return;
      }
      callback( 'Error loading photo from web: ' + error );
    });
  }

  function _gotPhotoFromWeb( err, data ) {
    if ( err ) {
      // Something went wrong with the web request.
      callback( err );
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

  function _rotateImage( id, buffer, callback ) {
    drive.getPhotoObject( id, _gotPhotoObject );

    function _gotPhotoObject( err, photo ) {
      if ( err ) {
        callback( err );
        return;
      }
      if ( !drive.needsRotation( photo ) ) {
        callback( null, buffer );
      }
      else {
        formatter.rotate( buffer, callback );
      }
    }
  }

  function _rotatedImage( err, buffer ) {
    if ( err ) {
      callback( err );
    }
    formatter.save( buffer, filenameFull, callback );
  }
}

module.exports = initialize;
