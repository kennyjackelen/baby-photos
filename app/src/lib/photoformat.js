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

  function _gotBuffer( err, bufferOut ) {
    if ( err ) {
      callback( '[_resizeImage] Error converting image to JPG: ' + err );
      return;
    }
    callback( null, bufferOut );
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
  fs.writeFile( filename, buffer );
  callback( null, buffer );
}

module.exports.resize = resizeImage;
module.exports.rotate = rotateImage;
module.exports.save = minimizeAndSaveImage;
