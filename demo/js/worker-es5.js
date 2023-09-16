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
	Math.sign = function (x) {
		return ((x > 0) - (x < 0)) || +x;
	};
}

if(!Map) {
	function Map(init) {
	  this.clear();
	  if(init)
		for(var i=0;i<init.length;i++)
		  this.set(init[i][0],init[i][1]);
	}

	Map.prototype.clear=function(){
	  this._map={};
	  this._keys=[];
	  this.size=0;
	};

	Map.prototype.get=function(key){
	  return this._map["map_"+key];
	};

	Map.prototype.set=function(key,value){
	  this._map["map_"+key]=value;
	  if(this._keys.indexOf(key)<0)this._keys.push(key);
	  this.size=this._keys.length;
	  return this;
	};
}

function quantizeImage(opts) {				
	var quant = opts.isHQ ? new PnnLABQuant(opts) : new PnnQuant(opts);	
	
	var pal8;
	opts.ditherFn = quant.getDitherFn();
	opts.getColorIndex = quant.getColorIndex;
	
	if(opts.colors < 64 && opts.colors > 32) {
		if(opts.dithering)
			return { img8: quant.quantizeImage(), pal8: quant.getPalette(), indexedPixels: quant.getIndexedPixels(), transparent: quant.getTransparentIndex(), type: quant.getImgType() };
		
		quant.quantizeImage();
		pal8 = quant.getPalette();
		opts.palette = new Uint32Array(pal8);
		opts.indexedPixels = quant.getIndexedPixels();
	}
	else {
		opts.paletteOnly = true;
		opts.palette = pal8 = quant.quantizeImage();
		var hc = new GilbertCurve(opts);
		if(opts.dithering)
			return { img8: hc.dither(), pal8: pal8, indexedPixels: hc.getIndexedPixels(), transparent: quant.getTransparentIndex(), type: quant.getImgType() };
		opts.indexedPixels = hc.dither();
	}
	
	var bn = new BlueNoise(opts);
	return { img8: bn.dither(), pal8: pal8, indexedPixels: bn.getIndexedPixels(), transparent: quant.getTransparentIndex(), type: quant.getImgType() };
}

onmessage = function(e) {	
	var result = quantizeImage(e.data);
	postMessage(result);
}