/*jshint node:true */
'use strict';
var gulp   = require('gulp');
var rev = require('gulp-rev');
var revReplace = require('gulp-rev-replace');
var useref = require('gulp-useref');
var uglify = require('gulp-uglify');
var csso = require('gulp-csso');
var imagemin = require('gulp-imagemin');
var gulpif = require('gulp-if');
var uncss = require('gulp-uncss');
var handlebars = require('gulp-compile-handlebars');
var rename = require('gulp-rename');

gulp.task( '_concat', function() {
  var userefAssets = useref.assets();

  return gulp.src('views/layouts/main.hbs')
          .pipe( userefAssets )
          .pipe( gulpif('*.js', uglify() ) )
          .pipe( gulpif('*.css', csso() ) )
          .pipe( rev() )
          .pipe( gulp.dest('build') )
          .pipe( rev.manifest() )
          .pipe( gulp.dest('working') );
});

gulp.task( '_replaceRefs', [ '_concat' ], function() {
  return gulp.src('views/layouts/main.hbs')
          .pipe( useref() )
          .pipe( revReplace( { manifest: gulp.src('./working/rev-manifest.json') } ) )
          .pipe( gulp.dest('build/views/layouts') );
});

gulp.task( '_copyPhotoswipe', function() {
  return gulp.src('bower_components/photoswipe/dist/default-skin/*.{gif,png,svg}')
          .pipe( gulp.dest('build/css', { overwrite: false } ) );
});

gulp.task( '_copyImages', function() {
  return gulp.src('image/*')
          .pipe( imagemin() )
          .pipe( gulp.dest('build/image', { overwrite: false } ) );
});

gulp.task( '_copyViews', function() {
  return gulp.src('views/*')
          .pipe( gulp.dest('build/views', { overwrite: false } ) );
});

gulp.task( '_copyPartials', function() {
  return gulp.src('views/partials/*')
          .pipe( gulp.dest('build/views/partials', { overwrite: false } ) );
});

gulp.task( '_copyIcons', function() {
  return gulp.src('icons/*')
          .pipe( gulp.dest('build/icons', { overwrite: false } ) );
});

gulp.task( '_compileHandlebars', function() {
  var hbModel = {
    lessThan4: {
      cellWidth: 2,
      cellWidthPhone: 2,
      cellWidthTablet: 2,
      photos: [
        {
          id: 1,
          caption: 'Test caption',
          imageMediaMetadata: {
            width: 400,
            height: 400
          }
        }
      ]
    },
    lessThan8: {
      cellWidth: 2,
      cellWidthPhone: 2,
      cellWidthTablet: 1,
      id: 1,
      caption: 'Test caption',
      photos: [
        {
          imageMediaMetadata: {
            width: 400,
            height: 400
          }
        }
      ]
    },
    lessThan12: {
      cellWidth: 2,
      cellWidthPhone: 1,
      cellWidthTablet: 1,
      id: 1,
      caption: 'Test caption',
      photos: [
        {
          imageMediaMetadata: {
            width: 400,
            height: 400
          }
        }
      ]
    },
    moreThan12: {
      cellWidth: 1,
      cellWidthPhone: 1,
      cellWidthTablet: 1,
      id: 1,
      caption: 'Test caption',
      photos: [
        {
          imageMediaMetadata: {
            width: 400,
            height: 400
          }
        }
      ]
    },
  };
  var hbOptions = {
    batch : ['./views/partials']
  };
  return gulp.src('views/layouts/main.hbs')
          .pipe( handlebars( hbModel.lessThan4, hbOptions ) )
          .pipe( rename('compiledHB1.html') )
          .pipe( gulp.dest('working/compiled') )
          .pipe( handlebars( hbModel.lessThan8, hbOptions ) )
          .pipe( rename('compiledHB2.html') )
          .pipe( gulp.dest('working/compiled') )
          .pipe( handlebars( hbModel.lessThan12, hbOptions ) )
          .pipe( rename('compiledHB3.html') )
          .pipe( gulp.dest('working/compiled') )
          .pipe( handlebars( hbModel.moreThan12, hbOptions ) )
          .pipe( rename('compiledHB4.html') )
          .pipe( gulp.dest('working/compiled') );
});

gulp.task( '_trimCSS', [ '_concat', '_compileHandlebars' ], function() {
  return gulp.src('build/css/*.css')
          .pipe( uncss({
              html: [ 'working/compiled/*.html' ]
            }) )
          .pipe( gulp.dest( 'build/css') );
});

gulp.task( 'build',
  [
    '_replaceRefs',
    '_copyPhotoswipe',
    '_copyImages',
    '_copyViews',
    '_copyPartials',
    '_copyIcons',
    '_trimCSS'
  ],
  function() {}
);