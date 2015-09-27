/* adapted from http://photoswipe.com/documentation/getting-started.html */

var initPhotoSwipeFromDOM = function(gallerySelector) {

    // This should stay in sync with the constant in the server-side JS.
    var PHOTO_CACHE_VERSION = '2';
    
    // There are 5 image sizes for each image: full size, 75%, 50%, 25%, 15%
    var ratios = [ 0.75, 0.5, 0.25, 0.15 ];

    // parse slide data (url, title, size ...) from DOM elements 
    // (children of gallerySelector)
    var parseThumbnailElements = function(el) {
        var thumbElements = el.childNodes,
            numNodes = thumbElements.length,
            items = [],
            figureEl,
            linkEl,
            size,
            item;

        for(var i = 0; i < numNodes; i++) {

            figureEl = thumbElements[i]; // <figure> element

            // include only element nodes 
            if(figureEl.nodeType !== 1) {
                continue;
            }

            linkEl = figureEl.children[0]; // <a> element

            size = linkEl.getAttribute('data-size').split('x');

            // create slide object
            item = {
                originalImage:
                {
                    src: linkEl.getAttribute('href'),
                    id: linkEl.getAttribute('data-id'),
                    w: parseInt(size[0], 10),
                    h: parseInt(size[1], 10)
                },
                title: linkEl.getAttribute('data-caption')
            };

            // Use the smallest available size for the "thumbnail" that
            // photoswipe shows while waiting for the big one to load over it.
            // This does mean we can end up loading three versions of the image...
            // (square thumbnail, smallest image, optimal image)
            // I might want to make this better by making the thumbnail image have
            // the same aspect ratio as the original and use some css to shift it
            // into a square thumbnail
            var smallestRatio = ratios[ ratios.length - 1 ];
            var smallW = Math.floor( smallestRatio * item.originalImage.w );
            var smallH = Math.floor( smallestRatio * item.originalImage.h );
            item.msrc = 'photo/v2/' + item.originalImage.id + '/' + smallW + '/' + smallH;

            item.el = figureEl; // save link to element for getThumbBoundsFn
            items.push(item);
        }

        return items;
    };

    // find nearest parent element
    var closest = function closest(el, fn) {
        return el && ( fn(el) ? el : closest(el.parentNode, fn) );
    };

    // triggers when user clicks on thumbnail
    var onThumbnailsClick = function(e) {
        e = e || window.event;
        e.preventDefault ? e.preventDefault() : e.returnValue = false;

        var eTarget = e.target || e.srcElement;

        // find root element of slide
        var clickedListItem = closest(eTarget, function(el) {
            return (el.tagName && el.tagName.toUpperCase() === 'FIGURE');
        });

        if(!clickedListItem) {
            return;
        }

        // find index of clicked item by looping through all child nodes
        // alternatively, you may define index via data- attribute
        var clickedGallery = clickedListItem.parentNode,
            childNodes = clickedListItem.parentNode.childNodes,
            numChildNodes = childNodes.length,
            nodeIndex = 0,
            index;

        for (var i = 0; i < numChildNodes; i++) {
            if(childNodes[i].nodeType !== 1) { 
                continue; 
            }

            if(childNodes[i] === clickedListItem) {
                index = nodeIndex;
                break;
            }
            nodeIndex++;
        }



        if(index >= 0) {
            // open PhotoSwipe if valid index found
            openPhotoSwipe( index, clickedGallery );
        }
        return false;
    };

    // parse picture index and gallery index from URL (#&pid=1&gid=2)
    var photoswipeParseHash = function() {
        var hash = window.location.hash.substring(1),
        params = {};

        if(hash.length < 5) {
            return params;
        }

        var vars = hash.split('&');
        for (var i = 0; i < vars.length; i++) {
            if(!vars[i]) {
                continue;
            }
            var pair = vars[i].split('=');  
            if(pair.length < 2) {
                continue;
            }           
            params[pair[0]] = pair[1];
        }

        if(params.gid) {
            params.gid = parseInt(params.gid, 10);
        }

        return params;
    };

    var openPhotoSwipe = function(index, galleryElement, disableAnimation, fromURL) {
        var pswpElement = document.querySelectorAll('.pswp')[0],
            gallery,
            options,
            items;

        items = parseThumbnailElements(galleryElement);

        // define options (if needed)
        options = {

            // define gallery index (for URL)
            galleryUID: galleryElement.getAttribute('data-pswp-uid'),

            getThumbBoundsFn: function(index) {
                // See Options -> getThumbBoundsFn section of documentation for more info
                var thumbnail = items[index].el.getElementsByTagName('img')[0], // find thumbnail
                    pageYScroll = window.pageYOffset || document.documentElement.scrollTop,
                    rect = thumbnail.getBoundingClientRect(); 

                return {x:rect.left, y:rect.top + pageYScroll, w:rect.width};
            }

        };

        // PhotoSwipe opened from URL
        if(fromURL) {
            if(options.galleryPIDs) {
                // parse real index when custom PIDs are used 
                // http://photoswipe.com/documentation/faq.html#custom-pid-in-url
                for(var j = 0; j < items.length; j++) {
                    if(items[j].pid == index) {
                        options.index = j;
                        break;
                    }
                }
            } else {
                // in URL indexes start from 1
                options.index = parseInt(index, 10) - 1;
            }
        } else {
            options.index = parseInt(index, 10);
        }

        // exit if index not found
        if( isNaN(options.index) ) {
            return;
        }

        if(disableAnimation) {
            options.showAnimationDuration = 0;
        }

        // Pass data to PhotoSwipe and initialize it
        gallery = new PhotoSwipe( pswpElement, PhotoSwipeUI_Default, items, options);

        // create variable that will store real size of viewport
        var realViewportWidth,
            firstResize = true;

        gallery.listen('beforeResize', function() {
            // gallery.viewportSize.x - width of PhotoSwipe viewport
            // gallery.viewportSize.y - height of PhotoSwipe viewport
            // window.devicePixelRatio - ratio between physical pixels and device independent pixels (Number)
            //                          1 (regular display), 2 (@2x, retina) ...

            var prevViewportWidth = realViewportWidth;

            // calculate real pixels when size changes
            realViewportWidth = gallery.viewportSize.x * window.devicePixelRatio;

            // Invalidate items only when source is changed and when it's not the first update
            if( prevViewportWidth !== realViewportWidth && !firstResize ) {
                // invalidateCurrItems sets a flag on slides that are in DOM,
                // which will force update of content (image) on window.resize.
                gallery.invalidateCurrItems();
            }

            if(firstResize) {
                firstResize = false;
            }

        });

        gallery.listen('gettingData', function(index, item) {

            // I added this to handle responsive images.
            var ratio = 1;
            for ( var i = 0; i < ratios.length; i++ ) {
                if ( realViewportWidth > ratios[ i ] * item.originalImage.w ) {
                    break;
                }
                ratio = ratios[ i ];
            }

            if ( ratio === 1 ) {
                item.src = item.originalImage.src;
                item.w = item.originalImage.w;
                item.h = item.originalImage.h;
            }
            else {
                item.w = Math.floor( ratio * item.originalImage.w );
                item.h = Math.floor( ratio * item.originalImage.h );
                item.src = 'photo/v' + PHOTO_CACHE_VERSION + '/' + item.originalImage.id + '/' + item.w + '/' + item.h;
            }
        });

        gallery.init();
    };

    // loop through all gallery elements and bind events
    var galleryElements = document.querySelectorAll( gallerySelector );

    for(var i = 0, l = galleryElements.length; i < l; i++) {
        galleryElements[i].setAttribute('data-pswp-uid', i+1);
        galleryElements[i].onclick = onThumbnailsClick;
    }

    // Parse URL and open gallery if it contains #&pid=3&gid=1
    var hashData = photoswipeParseHash();
    if(hashData.pid && hashData.gid) {
        openPhotoSwipe( hashData.pid ,  galleryElements[ hashData.gid - 1 ], true, true );
    }
};

// execute above function
initPhotoSwipeFromDOM('.my-gallery');