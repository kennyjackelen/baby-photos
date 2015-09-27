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

  fs.readFile(
    filenameResized,
    function ( err, data ) {
      if ( err ) {
        // resized photo didn't exist, look for a full-size one
        fs.readFile(
          filenameFull,
          function ( err, data ) {
            if ( err ) {
              // full-size photo didn't exist, pull from web
              _getPhotoFromWeb( id,
                function ( err, data ) {
                  if ( err ) {
                    callback( err );
                  }
                  if ( isFullImage ) {
                    callback( null, data);
                  }
                  else {
                    formatter.resize( data, w, h, _writeToFile );
                  }
                }
              );
              return;
            }
            formatter.resize( data, w, h, _writeToFile );
          }
        );
        return;
      }
      callback( null, data );
    }
  );

  function _writeToFile( err, imageBuffer ) {
    if ( err ) {
      callback( err );
      return;
    }
    formatter.save( imageBuffer, filenameResized, callback );
  }

  function _getPhotoFromWeb( id, callback ) {
    var options = { url: 'https://docs.google.com/uc?id=' + id, encoding: null };
    request( options, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        _rotateImage( id, body, function( err, buffer ) {
          if ( err ) {
            callback( err );
          }
          formatter.save( buffer, filenameFull, callback );
        });
        return;
      }
      callback( 'Error loading photo from web: ' + error );
    });
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
}

module.exports = initialize;
