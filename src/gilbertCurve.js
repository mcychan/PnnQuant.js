/* Generalized Hilbert ("gilbert") space-filling curve for rectangular domains of arbitrary (non-power of two) sizes.
Copyright (c) 2022 - 2025 Miller Cy Chan
* A general rectangle with a known orientation is split into three regions ("up", "right", "down"), for which the function calls itself recursively, until a trivial path can be produced. */

(function(){
	if(!Math.tanh) {
		Math.tanh = function(x){
			var a = Math.exp(+x), b = Math.exp(-x);
			return a == Infinity ? 1 : b == Infinity ? -1 : (a - b) / (a + b);
		};
	}
	
	function GilbertCurve(opts) {
		this.opts = opts;
		this.qPixels = [];
	}
	
	function gammaToLinear(channel)
	{
		var c = channel / 255.0;
		return c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	}

	function Y_Diff(R, G, B, R2, G2, B2)
	{
		function color2Y(R, G, B) {
			var sr = gammaToLinear(R);
			var sg = gammaToLinear(G);
			var sb = gammaToLinear(B);
			return sr * 0.2126 + sg * 0.7152 + sb * 0.0722;
		}

		var y = color2Y(R, G, B);
		var y2 = color2Y(R2, G2, B2);
		return Math.abs(y2 - y) * 100;
	}

	function U_Diff(R, G, B, R2, G2, B2)
	{
		function color2U(R, G, B) {
			return -0.09991 * R - 0.33609 * G + 0.436 * B;
		}

		var u = color2U(R, G, B);
		var u2 = color2U(R2, G2, B2);
		return Math.abs(u2 - u);
	}

	function ErrorBox(pixel) {
		var r = (pixel & 0xff),
			g = (pixel >>> 8) & 0xff,
			b = (pixel >>> 16) & 0xff,
			a = (pixel >>> 24) & 0xff;
		this.yDiff = 0;
		this.p = [r, g, b, a];
	}

	var ditherFn, getColorIndex, width, height, weight, pixels, palette, saliencies, nMaxColors, beta;
	
	var qPixels;
	var errorq = [];
	var weights = [];
	var lookup;

	var DITHER_MAX = 9, ditherMax, dither, sortedByYDiff, margin, thresold;
	var BLOCK_SIZE = 343.0;

	function ditherPixel(x, y, c2, beta)
	{
		var bidx = x + y * width;
		var pixel = pixels[bidx];
		var r0 = (pixel & 0xff),
			g0 = (pixel >>> 8) & 0xff,
			b0 = (pixel >>> 16) & 0xff;

		var r_pix = (c2 & 0xff),
			g_pix = (c2 >>> 8) & 0xff,
			b_pix = (c2 >>> 16) & 0xff,
			a_pix = (c2 >>> 24) & 0xff;

		var qPixel = palette[qPixels[bidx]];
		var strength = 1 / 3.0;
		var acceptedDiff = Math.max(2, nMaxColors - margin);
		if (nMaxColors <= 4 && saliencies[bidx] > .2 && saliencies[bidx] < .25)
			c2 = new BlueNoise({weightB: beta * 2 / saliencies[bidx]}).diffuse(pixel, qPixel, strength, x, y);
		else if (nMaxColors <= 4 || Y_Diff(r0, g0, b0, r_pix, g_pix, b_pix) < (2 * acceptedDiff)) {
			if (nMaxColors <= 128 || TELL_BLUE_NOISE[bidx & 4095] > 0)
				c2 = new BlueNoise({weightB: beta * .5 / saliencies[bidx]}).diffuse(pixel, qPixel, strength, x, y);
			var r1 = (c2 & 0xff),
				g1 = (c2 >>> 8) & 0xff,
				b1 = (c2 >>> 16) & 0xff;

			if (U_Diff(r0, g0, b0, r1, g1, b1) > (margin * acceptedDiff))
				c2 = new BlueNoise({weightB: beta / saliencies[bidx]}).diffuse(pixel, qPixel, strength, x, y);
			r1 = (c2 & 0xff);
			g1 = (c2 >>> 8) & 0xff;
			b1 = (c2 >>> 16) & 0xff;
		}

		var r1 = (c2 & 0xff),
			g1 = (c2 >>> 8) & 0xff,
			b1 = (c2 >>> 16) & 0xff;
		if (nMaxColors < 3 || margin > 6) {
			var delta = (weight > .0015 && weight < .0025) ? beta : Math.PI;
			if (nMaxColors > 4 && Y_Diff(r0, g0, b0, r1, g1, b1) > (delta * acceptedDiff)) {
				var kappa = saliencies[bidx] < .4 ? beta * .4 * saliencies[bidx] : beta * .4 / saliencies[bidx];
				var c1 = saliencies[bidx] < .6 ? pixel : (a_pix << 24) | (b_pix << 16) | (g_pix << 8) | r_pix;
				c2 = new BlueNoise({weightB: kappa}).diffuse(c1, qPixel, strength, x, y);
				r1 = (c2 & 0xff);
				g1 = (c2 >>> 8) & 0xff;
				b1 = (c2 >>> 16) & 0xff;
			}
		}
		else if (nMaxColors > 4 && (Y_Diff(r0, g0, b0, r1, g1, b1) > (beta * acceptedDiff) || U_Diff(r0, g0, b0, r1, g1, b1) > acceptedDiff)) {
			if (beta < .4 && (nMaxColors <= 32 || saliencies[bidx] < beta))
				c2 = new BlueNoise({weightB: beta * .4 * saliencies[bidx]}).diffuse(c2, qPixel, strength, x, y);
			else
				c2 = (a_pix << 24) | (b_pix << 16) | (g_pix << 8) | r_pix;
			r1 = (c2 & 0xff);
			g1 = (c2 >>> 8) & 0xff;
			b1 = (c2 >>> 16) & 0xff;
		}

		if (DITHER_MAX < 16 && nMaxColors > 4 && saliencies[bidx] < .6 && Y_Diff(r0, g0, b0, r1, g1, b1) > margin - 1) {
			c2 = (a_pix << 24) | (b_pix << 16) | (g_pix << 8) | r_pix;
			r1 = r_pix;
			g1 = g_pix;
			b1 = b_pix;
		}
		if (beta > 1 && Y_Diff(r0, g0, b0, r1, g1, b1) > DITHER_MAX) {
			c2 = (a_pix << 24) | (b_pix << 16) | (g_pix << 8) | r_pix;
			r1 = r_pix;
			g1 = g_pix;
			b1 = b_pix;
		}

		var offset = getColorIndex(a_pix, r1, g1, b1);
		if (lookup[offset] == 0)
			lookup[offset] = ditherFn(palette, c2, bidx) + 1;
		return lookup[offset] - 1;
	}

	function diffusePixel(x, y)
	{
		var bidx = x + y * width;
		var pixel = pixels[bidx];
		var error = new ErrorBox(pixel);
		var i = sortedByYDiff ? weights.length - 1 : 0;
		var maxErr = DITHER_MAX - 1;
		for (var c = 0; c < errorq.length; ++c) {
			var eb = errorq[c];
			if(i < 0 || i >= weights.length)
				break;

			for(var j = 0; j < eb.p.length; ++j) {
				error.p[j] += eb.p[j] * weights[i];
				if(error.p[j] > maxErr)
					maxErr = error.p[j];
			}
			i += sortedByYDiff ? -1 : 1;
		}

		var r_pix = Math.clamp(error.p[0], 0, 0xff) | 0;
		var g_pix = Math.clamp(error.p[1], 0, 0xff) | 0;
		var b_pix = Math.clamp(error.p[2], 0, 0xff) | 0;
		var a_pix = Math.clamp(error.p[3], 0, 0xff) | 0;

		var r0 = (pixel & 0xff),
			g0 = (pixel >>> 8) & 0xff,
			b0 = (pixel >>> 16) & 0xff,
			a0 = (pixel >>> 24) & 0xff;

		var c2 = (a_pix << 24) | (b_pix << 16) | (g_pix << 8) | r_pix;
		if (saliencies != null && dither && !sortedByYDiff && a0 > 240 && a0 < a_pix)
			qPixels[bidx] = ditherPixel(x, y, c2, beta);
		else if (nMaxColors <= 32 && a_pix > 0xF0) {
			var offset = getColorIndex(a_pix, r_pix, g_pix, b_pix);
			if (lookup[offset] == 0)
				lookup[offset] = ditherFn(palette, c2, bidx) + 1;
			qPixels[bidx] = lookup[offset] - 1;
			
			var acceptedDiff = Math.max(2, nMaxColors - margin);
			if (saliencies != null && (Y_Diff(r0, g0, b0, r_pix, g_pix, b_pix) > acceptedDiff || U_Diff(r0, g0, b0, r_pix, g_pix, b_pix) > (2 * acceptedDiff))) {
				var strength = 1 / 3.0;
				c2 = new BlueNoise({weightB: 1 / saliencies[bidx]}).diffuse(pixel, palette[qPixels[bidx]], strength, x, y);
				qPixels[bidx] = ditherFn(palette, c2, bidx);
			}
		}
		else
			qPixels[bidx] = ditherFn(palette, c2, bidx);

		if (errorq.length >= DITHER_MAX)
			errorq.shift();
		else if (errorq.length > 0)
			initWeights(errorq.length);

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
		error.yDiff = sortedByYDiff ? Y_Diff(r0, g0, b0, r2, g2, b2) : 1;
		var illusion = !diffuse && TELL_BLUE_NOISE[((error.yDiff * 4096) | 0) & 4095] > thresold;

		var unaccepted = false;
		var errLength = denoise ? error.p.length - 1 : 0;
		for(var j = 0; j < errLength; ++j) {
			if (Math.abs(error.p[j]) >= ditherMax) {
				if (sortedByYDiff && saliencies != null)
					unaccepted = a0 < a_pix;

				if (diffuse)
					error.p[j] = Math.fround(Math.tanh(error.p[j] / maxErr * 20)) * (ditherMax - 1);
				else if (illusion)
					error.p[j] = Math.fround(error.p[j] / maxErr * error.yDiff) * (ditherMax - 1);
				else
					error.p[j] /= Math.fround(1 + Math.sqrt(ditherMax));
			}

			if (sortedByYDiff && saliencies == null && Math.abs(error.p[j]) >= DITHER_MAX)
				unaccepted = a0 < a_pix;
		}

		if (unaccepted) {
			if (saliencies != null)
				qPixels[bidx] = ditherPixel(x, y, c2, 1.25);
			else if (Y_Diff(r0, g0, b0, r_pix, g_pix, b_pix) > 3 && U_Diff(r0, g0, b0, r_pix, g_pix, b_pix) > 3) {
				var strength = 1 / 3.0;
				c2 = new BlueNoise({weightB: strength}).diffuse(pixel, palette[qPixels[bidx]], strength, x, y);
				qPixels[bidx] = ditherFn(palette, c2, bidx);
			}
		}

		errorq.push(error);
		if (sortedByYDiff)
			errorq.sort(function(o1, o2) {
				if (o2.yDiff < o1.yDiff)
					return -1;
				if (o2.yDiff > o1.yDiff)
					return 1;
				return 0;
			});
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
				diffusePixel(x, y);
				x += dax;
				y += day;
			}
			return;
		}

		if (w == 1) {
			for (var i = 0; i < h; ++i){
				diffusePixel(x, y);
				x += dbx;
				y += dby;
			}
			return;
		}

		var ax2 = ax >> 1;
		var ay2 = ay >> 1;
		var bx2 = bx >> 1;
		var by2 = by >> 1;

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

	function initWeights(size)
	{
		/* Dithers all pixels of the image in sequence using
		* the Gilbert path, and distributes the error in
		* a sequence of pixels size.
		*/
		var weightRatio = Math.fround(Math.pow(BLOCK_SIZE + 1.0, 1.0 / (size - 1.0)));
		var weight = 1.0, sumweight = 0.0;
		weights = new Array(size);
		for (var c = 0; c < size; ++c) {
			errorq.push(new ErrorBox(0));
			sumweight += (weights[size - c - 1] = weight);
			weight /= weightRatio;
		}

		weight = 0.0; /* Normalize */
		for (var c = 0; c < size; ++c) {
			weights[c] = Math.fround(weights[c] / sumweight);
			weight += weights[c];
		}
		weights[0] += Math.fround(1.0 - weight);
	}

	GilbertCurve.prototype.dither = function()
	{
		errorq = [];
		var hasAlpha = this.opts.weight < 0;
		this.opts.weight = weight = Math.abs(this.opts.weight);
		margin = weight < .0025 ? 12 : weight < .004 ? 8 : 6;
		sortedByYDiff = this.opts.palette.length >= 128 && weight >= .02 && (!hasAlpha || weight < .18);

		DITHER_MAX = weight < .015 ? (weight > .0025) ? 25 : 16 : 9;
		var edge = hasAlpha ? 1 : Math.exp(weight) - .25;
		var deviation = !hasAlpha && weight > .002 ? -.25 : 1;
		ditherMax = (hasAlpha || DITHER_MAX > 9) ? Math.pow((Math.sqrt(DITHER_MAX) + edge * deviation), 2) : (DITHER_MAX * (saliencies != null ? 2 : Math.E));
		var density = this.opts.palette.length > 16 ? 3200 : 1500;
		if(this.opts.palette.length / weight > 5000 && (weight > .045 || (weight > .01 && this.opts.palette.length < 64)))
			ditherMax = Math.pow(5 + edge, 2);
		else if(weight < .03 && this.opts.palette.length / weight < density && this.opts.palette.length >= 16 && this.opts.palette.length < 256)
			ditherMax = Math.pow(5 + edge, 2);
		ditherMax |= 0;
		thresold = DITHER_MAX > 9 ? -112 : -64;
		weights = [];
		lookup = new Uint32Array(65536);

		ditherFn = this.opts.ditherFn;
		getColorIndex = this.opts.getColorIndex;
		width = this.opts.width;
		height = this.opts.height;
		pixels = this.opts.pixels;
		palette = this.opts.palette;
		saliencies = this.opts.saliencies;
		dither = this.opts.dithering;
		nMaxColors = palette.length;
		beta = nMaxColors > 4 ? (.6 - .00625 * nMaxColors) : 1;
		if (nMaxColors > 4) {
			var boundary = .005 - .0000625 * nMaxColors;
			beta = Math.fround(weight > boundary ? .25 : Math.min(1.5, beta + nMaxColors * weight));
			if (nMaxColors > 16 && nMaxColors <= 32 && weight < .003)
				beta += .075;
			else if (nMaxColors > 32 && nMaxColors < 256)
				beta += .1;
			if (nMaxColors >= 64 && (weight > .012 && weight < .0125) || (weight > .025 && weight < .03))
				beta *= 2;
		}
		else
			beta *= .95;
		
		if (nMaxColors > 64 || (nMaxColors > 4 && weight > .02))
			beta *= .4;
		if (nMaxColors > 64 && weight < .02)
			beta = .2;
		qPixels = nMaxColors > 256 ? new Uint16Array(pixels.length) : new Uint8Array(pixels.length);

		if (!sortedByYDiff)
			initWeights(DITHER_MAX);

		if (width >= height)
			generate2d(0, 0, width, 0, 0, height);
		else
			generate2d(0, 0, 0, height, width, 0);
		
		this.opts.indexedPixels = this.qPixels = qPixels;

		if (!this.opts.dithering)
			return qPixels;
		
		return processImagePixels();
	}
	
	GilbertCurve.prototype.getIndexedPixels = function getIndexedPixels() {
		return this.qPixels;
	};
	
	GilbertCurve.prototype.getResult = function getResult() {
		var hc = this;
		return new Promise(function(resolve, reject) {
			if(hc.opts.dithering || hc.opts.colors <= 32)
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




