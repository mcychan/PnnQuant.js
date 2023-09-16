importScripts('gilbertCurve.min.js');
importScripts('blueNoise.min.js');
importScripts('pnnquant.min.js');
importScripts('pnnLABquant.min.js');

function quantizeImage(opts) {				
	var quant = opts.isHQ ? new PnnLABQuant(opts) : new PnnQuant(opts);
	opts.paletteOnly = true;
	
	return quant.getResult().then(function(result) {		
		if(opts.dithering)
			return Promise.all([result, new GilbertCurve(opts).getResult()]);
		
		return new GilbertCurve(opts).getResult().then(function(gc) {
			return Promise.all([result, new BlueNoise(opts).getResult()]);
		});				
	});	
}

onmessage = function(e) {	
	quantizeImage(e.data).then(function(result) {
		postMessage(Object.assign.apply(Object, result));
	});	
}