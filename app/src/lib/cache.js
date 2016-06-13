/*jshint node:true */
'use strict';
var async = require('async');
var request = require('request');

var STRING_SHEET_ID = '1pnAVYQv_vkmKGgTuFG4bZJr319PyigkUTdRpg_jrH-8';

var TITLE_ENTRY = 1;
var SUBTITLE_ENTRY = 3;
var SUPPORTING_TEXT_ENTRY = 5;

process.on('message', function ( params ) {
  cacheImages( params );
});

function cacheImages( params ) {

  var drive = require('./drive.js')();
  var getPhoto = require('./photogetter.js')( drive );
  var getPhotoList = require('./photolistgetter.js')( drive );

  async.series(
    [
      _getStringsFromSpreadsheet,
      _getPhotoListAndCache
    ],
    function() { 
      process.send( { 'cache_done': true } );
    }
  );

  function _getPhotoListAndCache( callback ) {
    getPhotoList(
      function( err, photos ) {
        if ( !err ) {
          process.send( { 'photo_list': photos } );
        }
        async.eachSeries(
          photos,
          _preCacheOnePhoto,
          function() { callback(); }
        );
      }
    );
  }

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
          var thumbSizes = [ params.thumbSize1x, params.thumbSize1_5x, params.thumbSize2x ];
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

  function _getStringsFromSpreadsheet( callback ) {
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
          catch(e){ return; }
          process.send( { title: title, subtitle: subtitle, supporting_text: supporting_text } );
          callback();
        }
      }
    );
  }
}