# PnnQuant.js
Fast pairwise nearest neighbor based algorithm with javascript

<b>Demo:</b> https://mcychan.github.io/PnnQuant.js/demo/

<b>Usage</b>
Use Chrome, Firefox or IE11+ because HTML5/JS features are used such as Canvas, Typed Arrays, jQuery.

You would call PnnQuant.js as follows:

```javascript
var opts = {
    colors: 256,             // desired palette size
    dithering: true,         // whether to use dithering or not
};

let bestQuality = false;
var quant = bestQuality ? new PnnLABQuant(opts) : new PnnQuant(opts);

// reduce images
var img8 = quant.quantizeImage(img, opts.colors, opts.dithering);
```

