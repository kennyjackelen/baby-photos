;(function(){
  'use strict';

  if ( document.readyState !== 'loading' ) {
    initialize();
  }
  else {
    document.addEventListener( 'DOMContentLoaded', initialize );
  }

  function initialize() {
    lazyload();
    fadeOldImages();
  }

  function fadeOldImages() {
    var LOCAL_STORAGE_SEEN_IDS = 'baby-photos-seen';
    var links = document.querySelectorAll('.my-gallery a');
    var oldSeenIDs = JSON.parse( window.localStorage.getItem( LOCAL_STORAGE_SEEN_IDS ) ) || {};

    var newSeenIDs = {};
    for ( var i = 0; i < links.length; i++ ) {
      var link = links[ i ];
      var id = link.getAttribute( 'data-id' );
      newSeenIDs[ id ] = true;
      if ( oldSeenIDs[ id ] ) {
        addClass( link.querySelector('img'), 'seen' );
      }
    }
    window.localStorage.setItem( LOCAL_STORAGE_SEEN_IDS, JSON.stringify( newSeenIDs ) );
  }

  function lazyload() {
    // borrowed from https://www.christianheilmann.com/2015/09/08/quick-trick-using-template-to-delay-loading-of-images/
    
    // check if template is supported
    // browsers without it wouldn't need to
    // do the content shifting
    if ('content' in document.createElement('template')) {
      // get the template
      var t = document.querySelector('template');
      // get its parent element
      var list = t.parentNode;
      // cache the template content
      var contents = t.innerHTML;
      // kill the template
      list.removeChild(t);
      // add the cached content to the parent
      list.innerHTML += contents;
    }
  }

  function addClass( el, className ) {
    if (el.classList) {
      el.classList.add( className );
    }
    else {
      el.className += ' ' + className;
    }
  }
})();
