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

gulp.task( '_concat', function() {
  var userefAssets = useref.assets();

  return gulp.src('views/layouts/*.hbs')
          .pipe( userefAssets )
          .pipe( gulpif('*.js', uglify() ) )
          .pipe( gulpif('*.css', csso() ) )
          .pipe( rev() )
          .pipe( gulp.dest('build') )
          .pipe( rev.manifest() )
          .pipe( gulp.dest('working') );
});

gulp.task( '_replaceRefs', [ '_concat' ], function() {
  return gulp.src('views/layouts/*.hbs')
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

gulp.task( 'build',
  [
    '_replaceRefs',
    '_copyPhotoswipe',
    '_copyImages',
    '_copyViews',
    '_copyPartials',
    '_copyIcons'
  ],
  function() {}
);