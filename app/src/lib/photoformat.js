/*jshint node:true */
'use strict';
var lwip = require('lwip');
var imagemin = require('imagemin');
var fs = require('fs');

/*
Resizes an image to the specified dimensions.
Callback expects two parameters:
- an error message if applicable (null otherwise)
- a modified image buffer
*/
function resizeImage( buffer, w, h, callback ) {
  lwip.open( buffer, 'jpg', _openedImage );

  function _openedImage( err, image ) {
    if ( err ) {
      callback( '[_resizeImage] Error opening image buffer: ' + err );
      return;
    }
    image.cover( w, h, _resizedImage );
  }

  function _resizedImage( err, image ) {
    if ( err ) {
      callback( '[_resizeImage] Error resizing image: ' + err );
      return;
    }
    image.toBuffer( 'jpg', _gotBuffer );
  }

  function _gotBuffer( err, buffer ) {
    if ( err ) {
      callback( '[_resizeImage] Error converting image to JPG: ' + err );
      return;
    }
    callback( null, buffer );
  }
}

/*
Rotates an image 90 degrees clockwise.
Callback expects two parameters:
- an error message if applicable (null otherwise)
- a modified image buffer
*/
function rotateImage( buffer, callback ){
  lwip.open( buffer, 'jpg', _openedImage );

  function _openedImage( err, image ) {
    if ( err ) {
      callback( '[rotateImage] Error opening image buffer: ' + err );
      return;
    }
    image.rotate( 90, _rotatedImage );
  }

  function _rotatedImage( err, image ){
    if ( err ) {
      callback( '[rotateImage] Error rotating image: ' + err );
      return;
    }
    image.toBuffer( 'jpg', _gotBuffer );
  }
  
  function _gotBuffer( err, bufferOut ) {
    if ( err ) {
      callback( '[_rotateImage] Error converting image to JPG: ' + err );
      return;
    }
    callback( null, bufferOut );
  }
}

/*
Minimizes the image and saves it to the specified file path.
Callback expects two parameters:
- an error message if applicable (null otherwise)
- a modified image buffer
*/
function minimizeAndSaveImage( buffer, filename, callback ) {
  new imagemin()
    .src( buffer )
    .run( _minimizedImage );

  function _minimizedImage( err, files ) {
    if ( err ) {
      callback( err );
      return;
    }
    _writeToFile( files[0].contents );
  }

  function _writeToFile( bufferToSave ) {
    fs.writeFile( filename, bufferToSave );
    callback( null, bufferToSave );
  }
}

module.exports.resize = resizeImage;
module.exports.rotate = rotateImage;
module.exports.save = minimizeAndSaveImage;
