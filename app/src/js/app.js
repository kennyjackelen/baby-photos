;(function(){
  'use strict';

  if ( document.readyState !== 'loading' ) {
    initialize();
  }
  else {
    document.addEventListener( 'DOMContentLoaded', initialize );
  }

  function initialize() {
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

  function addClass( el, className ) {
    if (el.classList) {
      el.classList.add( className );
    }
    else {
      el.className += ' ' + className;
    }
  }
})();
