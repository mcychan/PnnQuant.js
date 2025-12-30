importScripts('gilbertCurve.min.js');
importScripts('blueNoise.min.js');
importScripts('pnnquant.min.js', 'pnnLABquant.min.js');

var _quant;

function quantizeImage(opts) {
	_quant = opts.isHQ ? new PnnLABQuant(opts) : new PnnQuant(opts);

	return _quant.getResult().then(function(result) {
		if (opts.dithering || opts.colors <= 32)
			return Promise.all([new GilbertCurve(opts, result).getResult()]);

		return new GilbertCurve(opts, result).getResult().then(function(gc) {
			result.indexedPixels = gc.indexedPixels;
			return Promise.all([new BlueNoise(opts, result).getResult()]);
		});
	});
}

onmessage = function(e) {
	quantizeImage(e.data).then(function(result) {
		_quant.clear();
		postMessage(Object.assign.apply(Object, result));
	});	
}