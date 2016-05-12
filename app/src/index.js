/*jshint node:true */
'use strict';
var express = require('express');
var hbs = require('hbs');
var request = require('request');
var fork = require('child_process').fork;

var PORT = 8080;
var REFRESH_INTERVAL = 5 * 60 * 1000;
var CACHE_TTL = 365 * 24 * 60 * 60;  // one year

// This should stay in sync with the constant in the client-side JS (photoswipe-support.js).
var PHOTO_CACHE_VERSION = '2';

initializeApp( );

function initializeApp( ) {

  var drive = require('./lib/drive.js')();
  var getPhoto = require('./lib/photogetter.js')( drive );
  var getPhotoList = require('./lib/photolistgetter.js')( drive );

  var app = express();
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
    getPhotoList(
      function( err, photos ) {
        if ( err ) {
          res.status(500).send( err );
          return;
        }
        returnPhotosToClient( photos, req, res );
      }
    );  
  });

  app.get('/json', function (req, res) {
    getPhotoList(
      function( err, photos ) {
        if ( err ) {
          sendError( res, err );
          return;
        }
        res.json( photos );
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

  function preCacheImages() {
    var childProcess;
    var params;
    childProcess = fork( __dirname + '/lib/cache.js');
    params = {
      thumbSize1x: app.locals.thumbSize1x,
      thumbSize1_5x: app.locals.thumbSize1_5x,
      thumbSize2x: app.locals.thumbSize2x
    };
    childProcess.send( params );

    childProcess.on('message', function ( m ) {
      if ( m.hasOwnProperty( 'title' ) ) { app.locals.title = m.title; }
      if ( m.hasOwnProperty( 'subtitle' ) ) { app.locals.subtitle = m.subtitle; }
      if ( m.hasOwnProperty( 'supporting_text' ) ) { app.locals.title = m.supporting_text; }
      if ( m.hasOwnProperty( 'photo_list' ) ) { mostRecentPhotos = m.photo_list; }
      if ( m.hasOwnProperty( 'cache_done')  ) { _handleCacheDone(); }
    });

    function _handleCacheDone() {
      console.log( 'caching done' );
      childProcess.disconnect();
      setTimeout( preCacheImages, REFRESH_INTERVAL );
    }
  }

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

  function sendError( response, errMsg ) {
    response.status(500).send( errMsg );
  }

}

process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});
