/* Generalized Hilbert ("gilbert") space-filling curve for rectangular domains of arbitrary (non-power of two) sizes.
Copyright (c) 2022 - 2026 Miller Cy Chan
* A general rectangle with a known orientation is split into three regions ("up", "right", "down"), for which the function calls itself recursively, until a trivial path can be produced. */

(function(){
	"use strict";
	if (!Math.clamp) {
		Math.clamp = function (a, b, c) {
			return this.max(b, this.min(c, a));
		};
	}
	
	function gammaToLinear(channel)
	{
		var c = channel / 255.0;
		return c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	}
			
	class GilbertCurve {
		#width; #height; #weight; #pixels; #palette; #saliencies; #nMaxColors; #beta = 1;
		#qPixels; #errorq = []; #weights = []; #lookup;
		#BLOCK_SIZE = 343.0; #DITHER_MAX = 9; #ditherMax; #dither; #hasAlpha; #sortedByYDiff; #margin; #thresold;
			
		constructor(opts, args) {
			this.opts = opts;
			this.args = args;
			
			this.ditherFn = this.args.ditherFn;
			this.getColorIndex = this.args.getColorIndex;
			this.#width = this.opts.width;
			this.#height = this.opts.height;
			this.#pixels = this.opts.pixels;
			this.#palette = new Uint32Array(this.args.pal8);
			this.#saliencies = this.args.saliencies;
			this.#dither = this.opts.dithering;
			this.#nMaxColors = this.#palette.length;

			this.#hasAlpha = this.args.weight < 0;
			this.#weight = Math.abs(this.args.weight);
			this.#margin = this.#weight < .0025 ? 12 : this.#weight < .004 ? 8 : 6;
			this.#sortedByYDiff = this.#nMaxColors >= 128 && this.#weight >= .02 && (!this.#hasAlpha || this.#weight < .18);
			this.#ditherMax = this.#DITHER_MAX = this.#weight < .015 ? (this.#weight > .0025) ? 25 : 16 : 9;
			
			this.#thresold = this.#DITHER_MAX > 9 ? -112 : -64;
			this.#lookup = new Uint16Array(65536);
		}

		#Y_Diff(R, G, B, R2, G2, B2)
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

		#U_Diff(R, G, B, R2, G2, B2)
		{
			function color2U(R, G, B) {
				return -0.09991 * R - 0.33609 * G + 0.436 * B;
			}

			var u = color2U(R, G, B);
			var u2 = color2U(R2, G2, B2);
			return Math.abs(u2 - u);
		}

		static ErrorBox = class ErrorBox {
		    constructor(pixel) {
				var r = (pixel & 0xff),
					g = (pixel >>> 8) & 0xff,
					b = (pixel >>> 16) & 0xff,
					a = (pixel >>> 24) & 0xff;
				this.yDiff = 0;
				this.p = [r, g, b, a];
			}
		};
		
		#normalDistribution(x, peak)
		{
			var mean = .5, stdDev = .1;

			// Calculate the probability density function (PDF)
			var exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
			var pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
			var maxPdf = 1 / (stdDev * Math.sqrt(2 * Math.PI)); // Peak at x = mean
			var scaledPdf = (pdf / maxPdf) * peak;
			return Math.fround(Math.max(0, Math.min(peak, scaledPdf)));
		}

		#ditherPixel(x, y, c2, beta)
		{
			const { ditherFn, getColorIndex } = this;
			
			var bidx = x + y * this.#width;
			var pixel = this.#pixels[bidx];
			var r0 = (pixel & 0xff),
				g0 = (pixel >>> 8) & 0xff,
				b0 = (pixel >>> 16) & 0xff;

			var r_pix = (c2 & 0xff),
				g_pix = (c2 >>> 8) & 0xff,
				b_pix = (c2 >>> 16) & 0xff,
				a_pix = (c2 >>> 24) & 0xff;

			var qPixel = this.#palette[this.#qPixels[bidx]];
			var strength = 1 / 3.0;
			var acceptedDiff = Math.max(2, this.#nMaxColors - this.#margin);
			if (this.#nMaxColors <= 4 && this.#saliencies[bidx] > .2 && this.#saliencies[bidx] < .25)
				c2 = new BlueNoise(null, {weightB: beta * 2 / this.#saliencies[bidx]}).diffuse(pixel, qPixel, strength, x, y);
			else if (this.#nMaxColors <= 4 || this.#Y_Diff(r0, g0, b0, r_pix, g_pix, b_pix) < (2 * acceptedDiff)) {
				if (this.#nMaxColors <= 128 || BlueNoise.TELL_BLUE_NOISE[bidx & 4095] > 0)
					c2 = new BlueNoise(null, {weightB: beta * .5 / this.#saliencies[bidx]}).diffuse(pixel, qPixel, strength, x, y);
				var r1 = (c2 & 0xff),
					g1 = (c2 >>> 8) & 0xff,
					b1 = (c2 >>> 16) & 0xff;

				if (this.#U_Diff(r0, g0, b0, r1, g1, b1) > (this.#margin * acceptedDiff))
					c2 = new BlueNoise(null, {weightB: beta / this.#saliencies[bidx]}).diffuse(pixel, qPixel, strength, x, y);
				r1 = (c2 & 0xff);
				g1 = (c2 >>> 8) & 0xff;
				b1 = (c2 >>> 16) & 0xff;
			}

			var r1 = (c2 & 0xff),
				g1 = (c2 >>> 8) & 0xff,
				b1 = (c2 >>> 16) & 0xff,
				a1 = (c2 >>> 24) & 0xff;
			if (this.#margin > 6 || (this.#nMaxColors <= 32 && this.#weight > .007)) {
				if (this.#nMaxColors > 4 && this.#Y_Diff(r0, g0, b0, r1, g1, b1) > (beta * acceptedDiff)) {
					var kappa = this.#saliencies[bidx] < .4 ? beta * .4 * this.#saliencies[bidx] : beta * .4 / this.#saliencies[bidx];
					var c1 = (a_pix << 24) | (b_pix << 16) | (g_pix << 8) | r_pix;
					if (this.#nMaxColors > 32 && this.#saliencies[bidx] < .9)
						kappa = beta * this.#normalDistribution(beta, 2) * this.#saliencies[bidx];
					else {
						if (this.#weight >= .0015 && this.#saliencies[bidx] < .6)
							c1 = pixel;
						if (this.#saliencies[bidx] < .6)
							kappa = beta * this.#normalDistribution(beta, this.#weight < .0008 ? 2.5 : 1.75) * this.#saliencies[bidx];
						else if (this.#nMaxColors >= 32 || this.#Y_Diff(r_pix, g_pix, b_pix, r1, g1, b1) > (beta * Math.PI * acceptedDiff)) {
							if (this.#saliencies[bidx] < .9)
								kappa = beta * (!this.#sortedByYDiff && this.#weight < .0025 ? .55 : .5) / this.#saliencies[bidx];
							else
								kappa = beta * this.#normalDistribution(beta, !this.#sortedByYDiff && this.#weight < .0025 ? .55 : .5) / this.#saliencies[bidx];
						}
					}

					c2 = new BlueNoise(null, {weightB: kappa}).diffuse(c1, qPixel, strength, x, y);
					r1 = (c2 & 0xff);
					g1 = (c2 >>> 8) & 0xff;
					b1 = (c2 >>> 16) & 0xff;
					a1 = (c2 >>> 24) & 0xff;
				}
			}
			else if (this.#nMaxColors > 4 && (this.#Y_Diff(r0, g0, b0, r1, g1, b1) > (beta * acceptedDiff) || this.#U_Diff(r0, g0, b0, r1, g1, b1) > acceptedDiff)) {
				if (beta < .4 && (this.#nMaxColors <= 32 || this.#saliencies[bidx] < beta))
					c2 = new BlueNoise(null, {weightB: beta * .4 * this.#saliencies[bidx]}).diffuse(c2, qPixel, strength, x, y);
				else
					c2 = (a_pix << 24) | (b_pix << 16) | (g_pix << 8) | r_pix;
				r1 = (c2 & 0xff);
				g1 = (c2 >>> 8) & 0xff;
				b1 = (c2 >>> 16) & 0xff;
				a1 = (c2 >>> 24) & 0xff;
			}

			if (this.#DITHER_MAX < 16 && this.#nMaxColors > 4 && this.#saliencies[bidx] < .6 && this.#Y_Diff(r0, g0, b0, r1, g1, b1) > this.#margin - 1) {
				c2 = (a_pix << 24) | (b_pix << 16) | (g_pix << 8) | r_pix;
				r1 = r_pix;
				g1 = g_pix;
				b1 = b_pix;
				a1 = a_pix;
			}
			if (beta > 1 && this.#Y_Diff(r0, g0, b0, r1, g1, b1) > this.#DITHER_MAX) {
				c2 = (a_pix << 24) | (b_pix << 16) | (g_pix << 8) | r_pix;
				r1 = r_pix;
				g1 = g_pix;
				b1 = b_pix;
				a1 = a_pix;
			}

			var offset = getColorIndex(a1, r1, g1, b1);
			if (this.#lookup[offset] == 0)
				this.#lookup[offset] = ditherFn(this.#palette, c2, bidx) + 1;
			return this.#lookup[offset] - 1;
		}

		#diffusePixel(x, y)
		{
			const { ditherFn, getColorIndex } = this;
			
			var bidx = x + y * this.#width;
			var pixel = this.#pixels[bidx];
			var error = new GilbertCurve.ErrorBox(pixel);
			var i = this.#sortedByYDiff ? this.#weights.length - 1 : 0;
			var maxErr = this.#DITHER_MAX - 1;
			for (var c = 0; c < this.#errorq.length; ++c) {
				var eb = this.#errorq[c];
				if(i < 0 || i >= this.#weights.length)
					break;

				for(var j = 0; j < eb.p.length; ++j) {
					error.p[j] += eb.p[j] * this.#weights[i];
					if(error.p[j] > maxErr)
						maxErr = error.p[j];
				}
				i += this.#sortedByYDiff ? -1 : 1;
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
			if (this.#saliencies != null && this.#dither && !this.#sortedByYDiff && (!this.#hasAlpha || a0 < a_pix)) {
				if (this.#nMaxColors > 32 && this.#saliencies[bidx] > .99)
					this.#qPixels[bidx] = ditherFn(this.#palette, c2, bidx);
				else
					this.#qPixels[bidx] = this.#ditherPixel(x, y, c2, this.#beta);
			}
			else if (this.#nMaxColors <= 32 && a_pix > 0xF0) {
				var offset = getColorIndex(a_pix, r_pix, g_pix, b_pix);
				if (this.#lookup[offset] == 0)
					this.#lookup[offset] = ditherFn(this.#palette, c2, bidx) + 1;
				this.#qPixels[bidx] = this.#lookup[offset] - 1;
				
				var acceptedDiff = Math.max(2, this.#nMaxColors - this.#margin);
				if (this.#saliencies != null && (this.#Y_Diff(r0, g0, b0, r_pix, g_pix, b_pix) > acceptedDiff || this.#U_Diff(r0, g0, b0, r_pix, g_pix, b_pix) > (2 * acceptedDiff))) {
					var strength = 1 / 3.0;
					c2 = new BlueNoise(null, {weightB: 1 / this.#saliencies[bidx]}).diffuse(pixel, this.#palette[qPixels[bidx]], strength, x, y);
					this.#qPixels[bidx] = ditherFn(this.#palette, c2, bidx);
				}
			}
			else
				this.#qPixels[bidx] = ditherFn(this.#palette, c2, bidx);

			if (this.#errorq.length >= this.#DITHER_MAX)
				this.#errorq.shift();
			else if (this.#errorq.length > 0)
				this.#initWeights(this.#errorq.length);

			c2 = this.#palette[this.#qPixels[bidx]];
			var r2 = (c2 & 0xff),
				g2 = (c2 >>> 8) & 0xff,
				b2 = (c2 >>> 16) & 0xff,
				a2 = (c2 >>> 24) & 0xff;

			error.p[0] = r_pix - r2;
			error.p[1] = g_pix - g2;
			error.p[2] = b_pix - b2;
			error.p[3] = a_pix - a2;

			var denoise = this.#palette.length > 2;
			var diffuse = BlueNoise.TELL_BLUE_NOISE[bidx & 4095] > this.#thresold;
			error.yDiff = this.#sortedByYDiff ? this.#Y_Diff(r0, g0, b0, r2, g2, b2) : 1;
			var illusion = !diffuse && BlueNoise.TELL_BLUE_NOISE[((error.yDiff * 4096) | 0) & 4095] > this.#thresold;

			var unaccepted = false;
			var errLength = denoise ? error.p.length - 1 : 0;
			for(var j = 0; j < errLength; ++j) {
				if (Math.abs(error.p[j]) >= this.#ditherMax) {
					if (this.#sortedByYDiff && this.#saliencies != null)
						unaccepted = true;

					if (diffuse)
						error.p[j] = Math.fround(Math.tanh(error.p[j] / maxErr * 20)) * (this.#ditherMax - 1);
					else if (illusion)
						error.p[j] = Math.fround(error.p[j] / maxErr * error.yDiff) * (this.#ditherMax - 1);
					else
						error.p[j] /= Math.fround(1 + Math.sqrt(this.#ditherMax));
				}

				if (this.#sortedByYDiff && this.#saliencies == null && Math.abs(error.p[j]) >= this.#DITHER_MAX)
					unaccepted = true;
			}

			if (unaccepted) {
				if (this.#saliencies != null)
					this.#qPixels[bidx] = this.#ditherPixel(x, y, c2, 1.25);
				else if (this.#Y_Diff(r0, g0, b0, r_pix, g_pix, b_pix) > 3 && this.#U_Diff(r0, g0, b0, r_pix, g_pix, b_pix) > 3) {
					var strength = 1 / 3.0;
					c2 = new BlueNoise(null, {weightB: strength}).diffuse(pixel, this.#palette[this.#qPixels[bidx]], strength, x, y);
					this.#qPixels[bidx] = ditherFn(this.#palette, c2, bidx);
				}
			}

			this.#errorq.push(error);
			if (this.#sortedByYDiff)
				this.#errorq.sort(function(o1, o2) {
					if (o2.yDiff < o1.yDiff)
						return -1;
					if (o2.yDiff > o1.yDiff)
						return 1;
					return 0;
				});
		}

		#generate2d(x, y, ax, ay, bx, by) {
			var w = Math.abs(ax + ay);
			var h = Math.abs(bx + by);
			var dax = Math.sign(ax);
			var day = Math.sign(ay);
			var dbx = Math.sign(bx);
			var dby = Math.sign(by);

			if (h == 1) {
				for (var i = 0; i < w; ++i){
					this.#diffusePixel(x, y);
					x += dax;
					y += day;
				}
				return;
			}

			if (w == 1) {
				for (var i = 0; i < h; ++i){
					this.#diffusePixel(x, y);
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
				this.#generate2d(x, y, ax2, ay2, bx, by);
				this.#generate2d(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by);
				return;
			}

			if ((h2 % 2) != 0 && h > 2) {
				bx2 += dbx;
				by2 += dby;
			}

			this.#generate2d(x, y, bx2, by2, ax2, ay2);
			this.#generate2d(x + bx2, y + by2, ax, ay, bx - bx2, by - by2);
			this.#generate2d(x + (ax - dax) + (bx2 - dbx), y + (ay - day) + (by2 - dby), -bx2, -by2, -(ax - ax2), -(ay - ay2));
		}
		
		#processImagePixels() {
			var qPixel32s = new Uint32Array(this.#qPixels.length);
			for (var i = 0; i < this.#qPixels.length; ++i)
				qPixel32s[i] = this.#palette[this.#qPixels[i]];

			return qPixel32s;
		}

		#initWeights(size)
		{
			/* Dithers all pixels of the image in sequence using
			* the Gilbert path, and distributes the error in
			* a sequence of pixels size.
			*/
			var weightRatio = Math.fround(Math.pow(this.#BLOCK_SIZE + 1.0, 1.0 / (size - 1.0)));
			var weight = 1.0, sumweight = 0.0;
			this.#weights = new Array(size);
			for (var c = 0; c < size; ++c) {
				this.#errorq.push(new GilbertCurve.ErrorBox(0));
				sumweight += (this.#weights[size - c - 1] = weight);
				weight /= weightRatio;
			}

			weight = 0.0; /* Normalize */
			for (var c = 0; c < size; ++c) {
				this.#weights[c] = Math.fround(this.#weights[c] / sumweight);
				weight += this.#weights[c];
			}
			this.#weights[0] += Math.fround(1.0 - weight);
		}

		dither()
		{
			var edge = this.#hasAlpha ? 1 : Math.exp(this.#weight) - .25;
			var deviation = !this.#hasAlpha && this.#weight > .002 ? -.25 : 1;
			var ditherMax = (this.#hasAlpha || this.#DITHER_MAX > 9) ? Math.pow((Math.sqrt(this.#DITHER_MAX) + edge * deviation), 2) : (this.#DITHER_MAX * (this.#saliencies != null ? 2 : Math.E));
			var density = this.#nMaxColors > 16 ? 3200 : 1500;
			if (this.#nMaxColors / this.#weight > 5000 && (this.#weight > .045 || (this.#weight > .01 && this.#nMaxColors < 64)))
				ditherMax = Math.pow(5 + edge, 2);
			else if (this.#weight < .03 && this.#palette.length / this.#weight < density && this.#nMaxColors >= 16 && this.#nMaxColors < 256)
				ditherMax = Math.pow(5 + edge, 2);
			this.#ditherMax = ditherMax | 0;

			var beta = this.#nMaxColors > 4 ? (.6 - .00625 * this.#nMaxColors) : 1;
			if (this.#nMaxColors > 4) {
				var boundary = .005 - .0000625 * this.#nMaxColors;
				beta = Math.fround(this.#weight > boundary ? .25 : Math.min(1.5, beta + this.#nMaxColors * this.#weight));
				if (this.#nMaxColors > 16 && this.#nMaxColors <= 32 && this.#weight < .003)
					beta += .075;
				else if (this.#weight < .0015 || (this.#nMaxColors > 32 && this.#nMaxColors < 256))
					beta += .1;
				if (this.#nMaxColors >= 64 && (this.#weight > .012 && this.#weight < .0125) || (this.#weight > .025 && this.#weight < .03))
					beta *= 2;
				else if (this.#nMaxColors > 32 && this.#nMaxColors < 64 && this.#weight < .015)
					beta = .55;
			}
			else
				beta *= .95;
			
			if (this.#nMaxColors > 64 || (this.#nMaxColors > 4 && this.#weight > .02))
				beta *= .4;
			if (this.#nMaxColors > 64 && this.#weight < .02)
				beta = .2;
			
			this.#beta = beta;
			this.#qPixels = this.#nMaxColors > 256 ? new Uint16Array(this.#pixels.length) : new Uint8Array(this.#pixels.length);

			if (!this.#sortedByYDiff)
				this.#initWeights(this.#DITHER_MAX);

			if (this.#width >= this.#height)
				this.#generate2d(0, 0, this.#width, 0, 0, this.#height);
			else
				this.#generate2d(0, 0, 0, this.#height, this.#width, 0);

			if (!this.opts.dithering)
				return this.#qPixels;
			
			return this.#processImagePixels();
		}
		
		getIndexedPixels() {
			return this.#qPixels;
		}
		
		getResult() {
			var gc = this;
			return new Promise(function(resolve, reject) {
				if(gc.opts.dithering || gc.opts.colors <= 32)
					resolve({ img8: gc.dither(), indexedPixels: gc.getIndexedPixels(), pal8: gc.args.pal8, transparent: gc.args.transparent, type: gc.args.type });
				else
					resolve({ indexedPixels: gc.dither(), pal8: gc.args.pal8, transparent: gc.args.transparent, type: gc.args.type });
			});
		}
	}

	// expose
	this.GilbertCurve = GilbertCurve;

	// expose to commonJS
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = GilbertCurve;
	}

}).call(this);
