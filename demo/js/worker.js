importScripts('../../src/pnnquant.js');
importScripts('../../src/pnnLABquant.js');

function quantizeImage(opts) {				
	var	quant = opts.isHQ ? new PnnLABQuant(opts) : new PnnQuant(opts);
	return { img8: quant.quantizeImage(), pal8: quant.getPalette() };
}

onmessage = function(e) {	
	var result = quantizeImage(e.data);
	postMessage(result);
}