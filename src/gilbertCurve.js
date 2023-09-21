/* Generalized Hilbert ("gilbert") space-filling curve for rectangular domains of arbitrary (non-power of two) sizes.
Copyright (c) 2022 - 2023 Miller Cy Chan
* A general rectangle with a known orientation is split into three regions ("up", "right", "down"), for which the function calls itself recursively, until a trivial path can be produced. */

(function(){
	function GilbertCurve(opts) {
		this.opts = opts;
		this.qPixels = [];
	}
	
	function gammaToLinear(channel)
	{
		var c = channel / 255.0;
		return c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	}

	function ErrorBox(pixel) {
		var r = (pixel & 0xff),
			g = (pixel >>> 8) & 0xff,
			b = (pixel >>> 16) & 0xff,
			a = (pixel >>> 24) & 0xff;
		this.p = [r, g, b, a];
	}
	
	var ditherFn, getColorIndex, width, height, pixels, palette, saliencies, nMaxColors;
	
	var qPixels;
	var errorq = [];
	var weights = [];
	var lookup;

	var DITHER_MAX = 9, ditherMax, thresold;
	var BLOCK_SIZE = 343.0;	
	
	function ditherPixel(x, y)
	{
		var bidx = x + y * width;
		var pixel = pixels[bidx];
		var error = new ErrorBox(pixel);
		var maxErr = DITHER_MAX - 1;
		for(var c = 0; c < DITHER_MAX; ++c) {
			var eb = errorq[c];
			for(var j = 0; j < eb.p.length; ++j) {
				error.p[j] += eb.p[j] * weights[c];
				if(error.p[j] > maxErr)
					maxErr = error.p[j];
			}
		}

		var r_pix = Math.clamp(error.p[0], 0, 0xff) | 0;
		var g_pix = Math.clamp(error.p[1], 0, 0xff) | 0;
		var b_pix = Math.clamp(error.p[2], 0, 0xff) | 0;
		var a_pix = Math.clamp(error.p[3], 0, 0xff) | 0;

		
		var c2 = (a_pix << 24) | (b_pix << 16) | (g_pix <<  8) | r_pix;
		if(nMaxColors <= 32 && a_pix > 0xF0) {
			var offset = getColorIndex(a_pix, r_pix, g_pix, b_pix);
			if (lookup[offset] == 0)
				lookup[offset] = ditherFn(palette, c2, bidx) + 1;
			qPixels[bidx] = lookup[offset] - 1;
			
			if(saliencies != null && saliencies[bidx] > .65 && saliencies[bidx] < .75) {
				var strength = 1 / 3.0;
				c2 = new BlueNoise({weight: 1 / saliencies[bidx]}).diffuse(pixel, palette[qPixels[bidx]], strength, x, y);
				qPixels[bidx] = ditherFn(palette, c2, bidx);
			}
		}
		else
			qPixels[bidx] = ditherFn(palette, c2, bidx);

		errorq.shift();
		var r0 = (pixel & 0xff),
			g0 = (pixel >>> 8) & 0xff,
			b0 = (pixel >>> 16) & 0xff;
			
		c2 = palette[qPixels[bidx]];
		var r2 = (c2 & 0xff),
			g2 = (c2 >>> 8) & 0xff,
			b2 = (c2 >>> 16) & 0xff,
			a2 = (c2 >>> 24) & 0xff;

		error.p[0] = r_pix - r2;
		error.p[1] = g_pix - g2;
		error.p[2] = b_pix - b2;
		error.p[3] = a_pix - a2;

		var denoise = palette.length > 2;
		var diffuse = TELL_BLUE_NOISE[bidx & 4095] > thresold;

		var errLength = denoise ? error.p.length - 1 : 0;
		for(var j = 0; j < errLength; ++j) {
			if(Math.abs(error.p[j]) >= ditherMax) {
				if (diffuse)
					error.p[j] = Math.fround(Math.tanh(error.p[j] / maxErr * 20)) * (ditherMax - 1);
				else
					error.p[j] /= Math.fround(1 + Math.sqrt(ditherMax));
			}
		}

		errorq.push(error);
	}

	function generate2d(x, y, ax, ay, bx, by) {
		var w = Math.abs(ax + ay);
		var h = Math.abs(bx + by);
		var dax = Math.sign(ax);
		var day = Math.sign(ay);
		var dbx = Math.sign(bx);
		var dby = Math.sign(by);

		if (h == 1) {
			for (var i = 0; i < w; ++i){
				ditherPixel(x, y);
				x += dax;
				y += day;
			}
			return;
		}

		if (w == 1) {
			for (var i = 0; i < h; ++i){
				ditherPixel(x, y);
				x += dbx;
				y += dby;
			}
			return;
		}

		var ax2 = (ax / 2) | 0;
		var ay2 = (ay / 2) | 0;
		var bx2 = (bx / 2) | 0;
		var by2 = (by / 2) | 0;

		var w2 = Math.abs(ax2 + ay2);
		var h2 = Math.abs(bx2 + by2);

		if (2 * w > 3 * h) {
			if ((w2 % 2) != 0 && w > 2) {
				ax2 += dax;
				ay2 += day;
			}
			generate2d(x, y, ax2, ay2, bx, by);
			generate2d(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by);
			return;
		}

		if ((h2 % 2) != 0 && h > 2) {
			bx2 += dbx;
			by2 += dby;
		}

		generate2d(x, y, bx2, by2, ax2, ay2);
		generate2d(x + bx2, y + by2, ax, ay, bx - bx2, by - by2);
		generate2d(x + (ax - dax) + (bx2 - dbx), y + (ay - day) + (by2 - dby), -bx2, -by2, -(ax - ax2), -(ay - ay2));
	}
	
	function processImagePixels() {
		var qPixel32s = new Uint32Array(qPixels.length);
		for (var i = 0; i < qPixels.length; ++i)
			qPixel32s[i] = palette[qPixels[i]];

		return qPixel32s;
	}

	GilbertCurve.prototype.dither = function()
	{
		/* Dithers all pixels of the image in sequence using
		* the Gilbert path, and distributes the error in
		* a sequence of DITHER_MAX pixels.
		*/
		errorq = [];
		var hasAlpha = this.opts.weight < 0;
		this.opts.weight = Math.abs(this.opts.weight);
		DITHER_MAX = this.opts.weight < .01 ? (this.opts.weight > .0025) ? 25 : 16 : 9;
		var edge = hasAlpha ? 1 : Math.exp(this.opts.weight) - .25;
		ditherMax = (hasAlpha || DITHER_MAX > 9) ? Math.pow((Math.sqrt(DITHER_MAX) + edge), 2) : DITHER_MAX;
		if(this.opts.palette.length / this.opts.weight > 5000 && (this.opts.weight > .045 || (this.opts.weight > .01 && this.opts.palette.length <= 64)))
			ditherMax = Math.pow((5 + edge), 2);
		if(this.opts.palette.length / this.opts.weight < 3200 && this.opts.palette.length > 16 && this.opts.palette.length < 256)
			ditherMax = Math.max(ditherMax, this.opts.palette.length - DITHER_MAX);
		thresold = DITHER_MAX > 9 ? -112 : -64;
		weights = new Array(DITHER_MAX);
		lookup = new Uint32Array(65536);
		var weightRatio = Math.pow(BLOCK_SIZE + 1.0,  1.0 / (DITHER_MAX - 1.0));
		var weight = 1.0, sumweight = 0.0;
		for(var c = 0; c < DITHER_MAX; ++c)
		{
			errorq.push(new ErrorBox(0));
			var d = Math.fround(1.0 / weight);
			sumweight += (weights[DITHER_MAX - c - 1] = d);
			weight *= weightRatio;
		}

		weight = 0.0; /* Normalize */
		for(var c = 0; c < DITHER_MAX; ++c) {
			weights[c] = Math.fround(weights[c] / sumweight);
			weight += weights[c];
		}
		weights[0] += Math.fround(1.0 - weight);

		ditherFn = this.opts.ditherFn;
		getColorIndex = this.opts.getColorIndex;
		width = this.opts.width;
		height = this.opts.height;
		pixels = this.opts.pixels;
		palette = this.opts.palette;
		saliencies = this.opts.saliencies;
		nMaxColors = palette.length;
		qPixels = nMaxColors > 256 ? new Uint16Array(pixels.length) : new Uint8Array(pixels.length);

		if (width >= height)
			generate2d(0, 0, width, 0, 0, height);
		else
			generate2d(0, 0, 0, height, width, 0);
		
		this.opts.indexedPixels = this.qPixels = qPixels;

		if(!this.opts.dithering)
			return qPixels;
		
		return processImagePixels();
	}
	
	GilbertCurve.prototype.getIndexedPixels = function getIndexedPixels() {
		return this.qPixels;
	};
	
	GilbertCurve.prototype.getResult = function getResult() {
		var hc = this;
		return new Promise(function(resolve, reject) {
			if(hc.opts.dithering)
				resolve({ img8: hc.dither(), indexedPixels: hc.getIndexedPixels() });
			else
				resolve({ indexedPixels: hc.dither() });
		});
	};

	// expose
	this.GilbertCurve = GilbertCurve;

	// expose to commonJS
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = GilbertCurve;
	}

}).call(this);
