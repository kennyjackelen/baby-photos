;(function(){
  'use strict';
  
  function ready(fn) {
    if (document.readyState !== 'loading'){
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  ready( function() {
    var cacheNowButton = document.querySelector('#cacheNow');
    if ( cacheNowButton !== null ) {
      cacheNowButton.addEventListener('click', function(){
        document.querySelector('#cacheForm').submit();
      });
    }
  });

})();
