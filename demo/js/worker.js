importScripts('gilbertCurve.min.js');
importScripts('blueNoise.min.js');
importScripts('pnnquant.min.js');
importScripts('pnnLABquant.min.js');

var _quant;

function quantizeImage(opts) {
	_quant = opts.isHQ ? new PnnLABQuant(opts) : new PnnQuant(opts);

	return _quant.getResult().then(function(result) {
		if (opts.dithering || opts.colors <= 32)
			return Promise.all([result, new GilbertCurve(opts).getResult()]);

		return new GilbertCurve(opts).getResult().then(function(gc) {
			return Promise.all([result, new BlueNoise(opts).getResult()]);
		});
	});
}

onmessage = function(e) {
	quantizeImage(e.data).then(function(result) {
		_quant.clear();
		postMessage(Object.assign.apply(Object, result));
	});	
}