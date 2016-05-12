/*jshint node:true */
'use strict';
var moment = require('moment');

var DRIVE_FOLDER_ID = '0B3JoT2zDJB9qfkhmNXN5TVd1NWN6S3ZiaUJGTkozRGZKX1FoaVROdWxlQnZrTXZUalRCZ2c';

var drive;

function initialize( myDrive ) {
  drive = myDrive;
  return getPhotosFromGoogleDrive;
}

function getPhotosFromGoogleDrive( callback ) {
  drive.getPhotoList( DRIVE_FOLDER_ID, _gotPhotos );

  function _gotPhotos( err, results ) {
    var photos;
    if ( err ) {
      callback( true );
      return;
    }
    results.forEach( _processPhotos );
    photos = results.filter( _filterPhotos ).sort( _sortPhotos );
    callback( null, photos );
  }

  function _processPhotos( item ) {
    var dateStr;
    try {
      item.jsonData = JSON.parse( item.description );
    }
    catch ( e ) {
      item.jsonData = {};
      item.jsonData.caption = item.description;
    }
    try {
      var dateMoment = _getPhotoDate( item );
      dateStr = dateMoment.format('LL');
    }
    catch ( e ) {}
    item.caption = '';
    if ( item.jsonData.caption ) {
      item.caption = item.jsonData.caption;
      if ( dateStr ) {
        item.caption = item.caption + ' (' + dateStr + ')';
      }
    }
    else if ( dateStr ) {
      item.caption = dateStr;
    }
    if ( drive.needsRotation( item ) ) {
      var originalWidth;
      originalWidth = item.imageMediaMetadata.width;
      item.imageMediaMetadata.width = item.imageMediaMetadata.height;
      item.imageMediaMetadata.height = originalWidth;
    }
  }

  function _filterPhotos( item ) {
    if ( item.explicitlyTrashed ) { return false; }
    if ( item.mimeType !== 'image/jpeg' ) { return false; }
    return true;
  }

  // Sort photos so the most recently taken photo comes first
  function _sortPhotos( a, b ) {
    var aMoment = _getPhotoDate( a );
    var bMoment = _getPhotoDate( b );
    return bMoment.diff( aMoment );
  }

  function _getPhotoDate( photo ) {
    try {
      if ( photo.jsonData.date ) {
        return moment( photo.jsonData.date, 'YYYY-MM-DD' );
      }
    }
    catch ( e ) {}  // keep trying other sources
    try {
      if ( photo.imageMediaMetadata.date ) {
        return moment( photo.imageMediaMetadata.date, 'YYYY-MM-DD HH:mm:ss' );
      }
    }
    catch ( e ) {}  // keep trying other sources
    try {
      if ( photo.createdDate ) {
        return moment( photo.createdDate );
      }
    }
    catch ( e ) {}  // just toss it at the very beginning
    return moment().subtract( 50, 'years' );
  }
}

module.exports = initialize;
