/*jshint node:true */
'use strict';
var express = require('express');
var hbs = require('hbs');
var fs = require('fs');
var googleAuth = require('google-auth-library');
var async = require('async');
var request = require('request');
var moment = require('moment');

var PORT = 8080;
var REFRESH_INTERVAL = 5 * 60 * 1000;
var CACHE_TTL = 365 * 24 * 60 * 60;  // one year

var STRING_SHEET_ID = '1pnAVYQv_vkmKGgTuFG4bZJr319PyigkUTdRpg_jrH-8';
var DRIVE_FOLDER_ID = '0B3JoT2zDJB9qfkhmNXN5TVd1NWN6S3ZiaUJGTkozRGZKX1FoaVROdWxlQnZrTXZUalRCZ2c';

var TITLE_ENTRY = 1;
var SUBTITLE_ENTRY = 3;
var SUPPORTING_TEXT_ENTRY = 5;

// This should stay in sync with the constant in the client-side JS (photoswipe-support.js).
var PHOTO_CACHE_VERSION = '2';

initializeCredentials();

function initializeCredentials() {
  var TOKEN_PATH = __dirname + '/credentials/drive-api-token.json';
  var CLIENT_SECRET_PATH = __dirname + '/credentials/client_secret.json';
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
        console.log( err );
        return;
      }
      var clientSecret = results.credentials.installed.client_secret;
      var clientId = results.credentials.installed.client_id;
      var auth = new googleAuth();
      var oauth2Client = new auth.OAuth2(clientId, clientSecret);
      oauth2Client.credentials = results.token;
      var drive = require('./lib/drive.js')( oauth2Client );
      initializeApp( drive );
    }
  );
}

function initializeApp( drive ) {

  var app = express();
  var getPhoto = require('./lib/photogetter.js')( drive );
  var mostRecentPhotos = [];

  hbs.registerPartials( __dirname + '/build/views/partials' );
  hbs.localsAsTemplateData( app );
  hbs.registerHelper('ifequal', function( lvalue, rvalue, options ) {
    if (arguments.length < 3) {
      throw new Error('Handlebars Helper ifequal needs 2 parameters');
    }
    if( lvalue !== rvalue ) {
      return options.inverse( this );
    } else {
      return options.fn( this );
    }
  });

  app.locals.title = 'Baby Girl Jackelen';
  app.locals.subtitle = 'Arriving September 2015';
  app.locals.supporting_text = 'We\'ll be posting photos here as we take them, so check back often!';

  app.locals.thumbSize1x = 250; 
  app.locals.thumbSize1_5x = 1.5 * app.locals.thumbSize1x; 
  app.locals.thumbSize2x = 2 * app.locals.thumbSize1x;

  app.locals.photoCacheVersion = PHOTO_CACHE_VERSION;

  app.set('views', __dirname + '/build/views');
  app.set('view engine', 'hbs');
  app.set('view options', { layout: 'layouts/main' });
  app.engine('hbs', hbs.__express);

  app.use( express.compress() ); 

  app.get('/', function (req, res) {

    // If we have a set of photos (we probably do), and the user
    // isn't asking to do a hard reload, then just send the ones
    // we have for faster performance.
    if ( !req.query.reload && mostRecentPhotos.length > 0 ) {
      returnPhotosToClient( mostRecentPhotos, req, res );
      return;
    }

    // Otherwise we'll take the slow way and make several requests
    // to Google before returning a document to the user.
    getPhotosFromGoogleDrive(
      function( photos ) {
        returnPhotosToClient( photos, req, res );
      },
      function( errMsg ) {
        res.status(500).send( errMsg );
      }
    );  
  });

  app.get('/json', function (req, res) {
    getPhotosFromGoogleDrive(
      function( photos ) {
        res.json( photos );
      },
      function( errMsg ) {
        sendError( res, errMsg );
      }
    );  
  });

  app.get('/photo/v' + PHOTO_CACHE_VERSION + '/placeholder\\d+/:width/:height', function (req, res) {
    request.get('http://lorempixel.com/' + req.params.width + '/' + req.params.height + '/animals/')
      .pipe( res );
  });

  app.get('/photo/v' + PHOTO_CACHE_VERSION + '/placeholder\\d+/full', function (req, res) {
    request.get('http://lorempixel.com/900/600/animals/')
      .pipe( res );
  });

  app.get('/photo/v' + PHOTO_CACHE_VERSION + '/:imageID/full', function (req, res) {
    getPhoto( req.params.imageID, 0, 0,
      function( error, imageBuffer ) {
        if ( error ) {
          sendError( res, error );
          return;
        }
        res.set( 'Content-Type', 'image/jpeg' );
        res.setHeader('Cache-Control', 'public, max-age=' + CACHE_TTL);
        res.send( imageBuffer );
      });
  });

  app.get('/photo/v' + PHOTO_CACHE_VERSION + '/:imageID/:width/:height', function (req, res) {
    if ( isNaN( Number( req.params.width ) ) ) {
      sendError( res, 'Invalid width value.');
      return;
    }
    if ( isNaN( Number( req.params.height ) ) ) {
      sendError( res, 'Invalid height value.');
      return;
    }
    getPhoto( req.params.imageID, Number( req.params.width ), Number( req.params.height ),
      function( error, imageBuffer ) {
        if ( error ) {
          sendError( res, error );
          return;
        }
        res.set( 'Content-Type', 'image/jpeg' );
        res.setHeader('Cache-Control', 'public, max-age=' + CACHE_TTL);
        res.send( imageBuffer );
      });
  });

  var staticOptions = {
    maxAge: CACHE_TTL * 1000
  };
  app.use('/js', express.static( __dirname + '/build/js', staticOptions ) );
  app.use('/css', express.static( __dirname + '/build/css', staticOptions ) );
  app.use('/image', express.static( __dirname + '/build/image', staticOptions ) );
  app.use('/icons', express.static( __dirname + '/build/icons', staticOptions ) );

  app.listen(PORT);
  console.log('Running on http://localhost:' + PORT);
  preCacheImages();

  function returnPhotosToClient( photos, req, res ) {
    var cellWidth;
    var cellWidthTablet;
    var cellWidthPhone;

    var desiredLength = Number( req.query.num );

    if ( desiredLength > 0 ) {
      for ( var i = 0; photos.length < desiredLength; i++ ) {
        // add photos until we have what we want
        photos.push(
          {
            id: 'placeholder' + i,
            imageMediaMetadata: {
              height: 600,
              width: 900
            }
          }
        );
      }
    }

    var count = photos.length;
    if ( count < 4 ) {
      cellWidth = 2;
      cellWidthTablet = 2;
      cellWidthPhone = 2;
    }
    else if ( count < 8 ) {
      cellWidth = 2;
      cellWidthTablet = 2;
      cellWidthPhone = 1;
    }
    else if ( count < 12 ) {
      cellWidth = 2;
      cellWidthTablet = 1;
      cellWidthPhone = 1;
    }
    else {
      cellWidth = 1;
      cellWidthTablet = 1;
      cellWidthPhone = 1;
    }
    res.render('gallery',
      {
        photos: photos,
        cellWidth: cellWidth,
        cellWidthTablet: cellWidthTablet,
        cellWidthPhone: cellWidthPhone
      }
    );
  }

  function preCacheImages() {
    _getStringsFromSpreadsheet();

    getPhotosFromGoogleDrive(
      function( photos ) {
        // runs on success
        async.eachSeries(
          photos,
          _preCacheOnePhoto,
          function() { setTimeout( preCacheImages, REFRESH_INTERVAL ); }  
        );
      },
      function() {
        // runs on error
        setTimeout( preCacheImages, REFRESH_INTERVAL );
      }
    );
    function _preCacheOnePhoto( photo, callback ) {
      async.series(
        [
          function( asyncCB ){
            var ratios = [ 1, 0.75, 0.5, 0.25, 0.15 ];
            async.eachSeries(
              ratios,
              __preCacheOneImage,
              function() { asyncCB(); }
            );
          },

          function( asyncCB ) {
            var thumbSizes = [ app.locals.thumbSize1x, app.locals.thumbSize1_5x, app.locals.thumbSize2x ];
            async.eachSeries(
              thumbSizes,
              __preCacheOneThumbnail,
              function() { asyncCB(); }
            );
          }
        ],
        function() { callback(); }
      );

      function __preCacheOneImage( ratio, callback ) {
        var w, h;
        if ( ratio === 1 ) {
          w = 0;
          h = 0;
        }
        else {
          w = Math.floor( ratio * photo.imageMediaMetadata.width );
          h = Math.floor( ratio * photo.imageMediaMetadata.height );
        }
        getPhoto( photo.id, w, h,
          function() { callback(); }
        );
      }

      function __preCacheOneThumbnail( thumbSize, callback ) {
        getPhoto( photo.id, thumbSize, thumbSize,
          function() { callback(); }
        );
      }
    }

    function _getStringsFromSpreadsheet() {
      request('https://spreadsheets.google.com/feeds/cells/' + STRING_SHEET_ID + '/od6/public/full?alt=json',
        function( error, response, body ) {
          if ( !error && response.statusCode === 200 ) {
            var title, subtitle, supporting_text;
            try {
              var data = JSON.parse( body );
              title = data.feed.entry[ TITLE_ENTRY ].content.$t;
              subtitle = data.feed.entry[ SUBTITLE_ENTRY ].content.$t;
              supporting_text = data.feed.entry[ SUPPORTING_TEXT_ENTRY ].content.$t;
            }
            catch(e){ console.log(e); return; }
            app.locals.title = title;
            app.locals.subtitle = subtitle;
            app.locals.supporting_text = supporting_text;
          }
        }
      );
    }
  }

  function sendError( response, errMsg ) {
    response.status(500).send( errMsg );
  }

  function getPhotosFromGoogleDrive( callback, errCallback ) {
    drive.getPhotoList( DRIVE_FOLDER_ID, _gotPhotos );

    function _gotPhotos( err, results ) {
      if ( err ) {
        errCallback( err );
        return;
      }
      results.forEach( _processPhotos );
      mostRecentPhotos = results.filter( _filterPhotos ).sort( _sortPhotos );
      callback( mostRecentPhotos );
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
}
