# PnnQuant.js
Fast pairwise nearest neighbor based algorithm with javascript. PnnQuant.js is a port of <a href="https://github.com/mcychan/nQuantCpp">nQuantCpp lib</a> in js. PnnQuant.js can reduce your images right in your browser without any server requirements. PNG is useful because it's the only widely supported format which can store partially transparent images. The format uses compression, but the files can still be large. Use PnnQuant.js to shrink images for your apps and sites.  Based on the quality options you chosen, an optimal strategy is executed. The result is a quality image which use less bandwidth and load faster.

If the photo has a gradient background, you'd better set the Quality to High.

<b>Demo:</b> https://mcychan.github.io/PnnQuant.js/demo/ <br />
You can click on any small images, or drag an image from file explorer or browser then drop to the area under Original, or copy bitmap or public url to clipboard then paste on the demo page.

<b>Usage</b>
Use Chrome, Firefox or IE11+ because HTML5/JS features are used such as Canvas, Typed Arrays, jQuery.

You would call PnnQuant.js as follows:

```javascript
var opts = {
    colors: 256,             /*  desired palette size  */
    dithering: true,         /*  whether to use dithering or not  */
    pixels: pixels,         /*  source pixels in RGBA 32 bits  */
    alphaThreshold: 0,    /*  consider as transparent if alpha value <= 0, default is 0  */
    width: _width, height: _height
};

let bestQuality = false;
var quant = bestQuality ? new PnnLABQuant(opts) : new PnnQuant(opts);
var result = quant.quantizeImage();
var gc = new GilbertCurve(opts, result);
if(opts.dithering || opts.colors <= 32)
	return { img8: gc.dither(), pal8: quant.getPalette(), indexedPixels: gc.getIndexedPixels(), transparent: quant.getTransparentIndex(), type: quant.getImgType() };

result.indexedPixels = gc.dither();
var bn = new BlueNoise(opts, result);
return { img8: bn.dither(), pal8: _quant.getPalette(), indexedPixels: bn.getIndexedPixels(), transparent: quant.getTransparentIndex(), type: quant.getImgType() };
```
