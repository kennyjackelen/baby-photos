;(function(){
  'use strict';

  if ( document.readyState === 'complete' ) {
    lazyload();
  }
  else {
    window.addEventListener( 'load', lazyload );
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
  
})();
