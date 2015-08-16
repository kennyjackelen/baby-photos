/*jshint node:true */
'use strict';
var express = require('express');
var hbs = require('hbs');
var fs = require('fs');
var googleAuth = require('google-auth-library');
var async = require('async');
var google = require('googleapis');
var request = require('request');
var lwip = require('lwip');
var imagemin = require('imagemin');

var PORT = 8080;
var CACHE_DIR = '/data/photocache';
var REFRESH_INTERVAL = 5 * 60 * 1000;
var CACHE_TTL = 365 * 24 * 60 * 60;  // one year

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
      initializeApp( oauth2Client );
    }
  );
}

function initializeApp( oauth2Client ) {

  var app = express();

  hbs.registerPartials( __dirname + '/build/views/partials' );
  hbs.localsAsTemplateData( app );

  app.locals.title = 'Baby Girl Jackelen';

  app.locals.thumbSize1x = 250; 
  app.locals.thumbSize1_5x = 1.5 * app.locals.thumbSize1x; 
  app.locals.thumbSize2x = 2 * app.locals.thumbSize1x; 

  app.set('views', __dirname + '/build/views');
  app.set('view engine', 'hbs');
  app.set('view options', { layout: 'layouts/main' });
  app.engine('hbs', hbs.__express);

  app.use( express.compress() ); 

  app.get('/', function (req, res) {
    getPhotosFromGoogleDrive(
      function( photos ) {
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

  app.get('/photo/placeholder\\d+/:width/:height', function (req, res) {
    request.get('http://lorempixel.com/' + req.params.width + '/' + req.params.height + '/animals/')
      .pipe( res );
  });

  app.get('/photo/placeholder\\d+/full', function (req, res) {
    request.get('http://lorempixel.com/900/600/animals/')
      .pipe( res );
  });

  app.get('/photo/:imageID/full', function (req, res) {
    getOnePhoto( req.params.imageID, 0, 0,
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

  app.get('/photo/:imageID/:width/:height', function (req, res) {
    if ( isNaN( Number( req.params.width ) ) ) {
      sendError( res, 'Invalid width value.');
      return;
    }
    if ( isNaN( Number( req.params.height ) ) ) {
      sendError( res, 'Invalid height value.');
      return;
    }
    getOnePhoto( req.params.imageID, Number( req.params.width ), Number( req.params.height ),
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

  app.listen(PORT);
  console.log('Running on http://localhost:' + PORT);
  preCacheImages();

  function preCacheImages() {
    /*console.log( 'Pre-caching images...');*/
    getPhotosFromGoogleDrive(
      function( photos ) {
        async.eachSeries(
          photos,
          _preCacheOnePhoto,
          function() { /*console.log( 'pre-cache done...'); */setTimeout( preCacheImages, REFRESH_INTERVAL ); }  
        );
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
        getOnePhoto( photo.id, w, h,
          function() { callback(); }
        );
      }

      function __preCacheOneThumbnail( thumbSize, callback ) {
        getOnePhoto( photo.id, thumbSize, thumbSize,
          function() { callback(); }
        );
      }
    }
  }

  function sendError( response, errMsg ) {
    response.status(500).send( errMsg );
  }

  function getPhotosFromGoogleDrive( callback, errCallback ) {
    var service = google.drive('v2');

    service.children.list(
      {
        folderId: '0B3JoT2zDJB9qfkhmNXN5TVd1NWN6S3ZiaUJGTkozRGZKX1FoaVROdWxlQnZrTXZUalRCZ2c',
        auth: oauth2Client,
        maxResults: 1000
      },
      _digestListOfPhotos
    );

    function _digestListOfPhotos( err, response ) {
      if (err) {
        errCallback( 'The API returned an error: ' + err );
        return;
      }
      async.map( response.items, __getPhoto, __gotPhotos );

      function __getPhoto( item, callback ) {
        service.files.get(
          {
            fileId: item.id,
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

      function __gotPhotos( err, results ) {
        if ( err ) {
          errCallback( err );
          return;
        }
        results.forEach( function( item ) { item.imgLink = item.webContentLink.split("&export=")[0]; } );
        callback( results.filter( function( item ){ return !item.explicitlyTrashed; } ) );
      }
    }
  }
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
                    _resizeImage( data, w, h, callback );
                  }
                }
              );
              return;
            }
            _resizeImage( data, w, h, callback );
          }
        );
        return;
      }
      callback( null, data );
    }
  );

  function _getPhotoFromWeb( id, callback ) {
    var options = { url: 'https://docs.google.com/uc?id=' + id, encoding: null };
    request( options, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        new imagemin()
          .src( body )
          .run( function( err, files ) {
            if ( err ) {
              callback( err );
              return;
            }
            fs.writeFile( filenameFull, files[0].contents );
            callback( null, files[0].contents );
          });
        return;
      }
      callback( 'Error loading photo from web: ' + error );
    });
  }

  function _resizeImage( buffer, w, h, callback ) {
    lwip.open( buffer, 'jpg', function( err, image ) {
      if ( err ) {
        callback( 'Error opening image buffer: ' + err );
        return;
      }
      image.cover( w, h, function( err, image ) {
        if ( err ) {
          callback( 'Error resizing image: ' + err );
          return;
        }
        image.toBuffer( 'jpg', function( err, buffer ) {
          if ( err ) {
            callback( 'Error converting image to JPG: ' + err );
            return;
          }
          new imagemin()
            .src( buffer )
            .run( function( err, files ) {
              if ( err ) {
                callback( err );
                return;
              }
              fs.writeFile( filenameResized, files[0].contents );
              callback( null, files[0].contents );
            });
        });
      });
    }); 
  }
}
