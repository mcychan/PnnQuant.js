importScripts('gilbertCurve.min.js');
importScripts('blueNoise.min.js');
importScripts('pnnquant.min.js');
importScripts('pnnLABquant.min.js');

if(!Math.cbrt) {
	Math.cbrt = function(value){
		return this.exp((1/3) * this.log(value));
	};
}

if (!Math.fround) {
	Math.fround = (function() {
		var temp = new Float32Array(1);
		return function fround(x) {
			temp[0] = +x;
			return temp[0];
		}
	})();
}

if (!Math.sign) {
	Math.sign = function(x) {
		return ((x > 0) - (x < 0)) || +x;
	};
}

var _quant;

function quantizeImage(opts) {
	_quant = opts.isHQ ? new PnnLABQuant(opts) : new PnnQuant(opts);

	var pal8;
	opts.ditherFn = _quant.getDitherFn();
	opts.getColorIndex = _quant.getColorIndex;

	var result = _quant.quantizeImage();
	var hc = new GilbertCurve(opts, result);
	if(opts.dithering || opts.colors <= 32)
		return { img8: hc.dither(), pal8: _quant.getPalette(), indexedPixels: hc.getIndexedPixels(), transparent: _quant.getTransparentIndex(), type: _quant.getImgType() };
	opts.indexedPixels = hc.dither();

	var bn = new BlueNoise(opts, result);
	return { img8: bn.dither(), pal8: _quant.getPalette(), indexedPixels: bn.getIndexedPixels(), transparent: _quant.getTransparentIndex(), type: _quant.getImgType() };
}

onmessage = function(e) {
	var result = quantizeImage(e.data);
	_quant.clear();
	postMessage(result);
}