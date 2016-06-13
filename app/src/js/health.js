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
    document.querySelector('#cacheNow').addEventListener('click', function(){
      document.querySelector('#cacheForm').submit();
    });
  });

})();
