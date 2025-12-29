/* Fast pairwise nearest neighbor based algorithm for multilevel thresholding
Copyright (C) 2004-2019 Mark Tyler and Dmitry Groshev
Copyright (c) 2018-2025 Miller Cy Chan
* error measure; time used is proportional to number of bins squared - WJ */

(function(){
	var alphaThreshold = 0xF, hasAlpha = false, hasSemiTransparency = false, transparentColor;
	var PR = 0.299, PG = 0.587, PB = 0.114, PA = .3333;
	var ratio = .5, weight;
	var closestMap = new Map(), nearestMap = new Map();
	
	var coeffs = [
		[0.299, 0.587, 0.114],
		[-0.14713, -0.28886, 0.436],
		[0.615, -0.51499, -0.10001]
	];
	
	if (!Math.clamp) {
		Math.clamp = function (a,b,c) {
			return this.max(b, this.min(c, a));
		};
	}
	
	function sqr(value) {
		return value * value;
	}
	
	function getARGBIndex(a, r, g, b, hasSemiTransparency, hasTransparency) {
		if (hasSemiTransparency)
			return (a & 0xF0) << 8 | (r & 0xF0) << 4 | (g & 0xF0) | (b >> 4);
		if (hasTransparency)
			return (a & 0x80) << 8 | (r & 0xF8) << 7 | (g & 0xF8) << 2 | (b >> 3);
		return (r & 0xF8) << 8 | (g & 0xFC) << 3 | (b >> 3);
	}
	
	function find_nn(bins, idx) {
		var nn = 0;
		var err = 1e100;
	
		var bin1 = bins[idx];
		var n1 = bin1.cnt;
		var wa = bin1.ac;
		var wr = bin1.rc;
		var wg = bin1.gc;
		var wb = bin1.bc;
	
		var start = 0;
		if (BlueNoise.TELL_BLUE_NOISE[idx & 4095] > 0)
			start = (PG < coeffs[0][1]) ? coeffs.length : 1;
		
		for (var i = bin1.fw; i != 0; i = bins[i].fw)
		{
			var n2 = bins[i].cnt, nerr2 = (n1 * n2) / (n1 + n2);
			if (nerr2 >= err)
				continue;
			
			var nerr = 0.0;
			if (hasSemiTransparency) {
				nerr += nerr2 * PA * sqr(bins[i].ac - wa);
				if (nerr >= err)
					continue;
			}
			
			nerr += nerr2 * (1 - ratio) * PR * sqr(bins[i].rc - wr);
			if (nerr >= err)
				continue;
	
			nerr += nerr2 * (1 - ratio) * PG * sqr(bins[i].gc - wg);
			if (nerr >= err)
				continue;
	
			nerr += nerr2 * (1 - ratio) * PB * sqr(bins[i].bc - wb);
			if (nerr >= err)
				continue;
			
			for (var j = start; j < coeffs.length; ++j) {
				nerr += nerr2 * ratio * sqr(coeffs[j][0] * (bins[i].rc - wr));
				if (nerr >= err)
					break;
				
				nerr += nerr2 * ratio * sqr(coeffs[j][1] * (bins[i].gc - wg));
				if (nerr >= err)
					break;
				
				nerr += nerr2 * ratio * sqr(coeffs[j][2] * (bins[i].bc - wb));
				if (nerr >= err)
					break;
			}
			
			err = nerr;
			nn = i;
		}
		bin1.err = Math.fround(err);
		bin1.nn = nn;
	}
	
	function getQuanFn(nMaxColors, quan_rt) {
		if (quan_rt > 0) {
			if (nMaxColors < 64)
				return function (cnt) { return Math.fround(Math.sqrt(cnt)); };
			return function (cnt) { return Math.sqrt(cnt) | 0; };
		}
		if (quan_rt < 0)
			return function (cnt) { return Math.cbrt(cnt) | 0; };
		return function (cnt) { return cnt; };
	}
	
	function nearestColorIndex(palette, pixel, pos) {
		var k = 0;
		var a = (pixel >>> 24) & 0xff;
		if (a <= alphaThreshold) {
			pixel = transparentColor;
			a = (pixel >>> 24) & 0xff;
		}

		var nearest = nearestMap.get(pixel);
		if (nearestMap.has(pixel))
			return nearest;

		if (palette.length > 2 && hasAlpha && a > alphaThreshold)
			k = 1;

		var r = (pixel & 0xff),
		g = (pixel >>> 8) & 0xff,
		b = (pixel >>> 16) & 0xff;

		var pr = PR, pg = PG, pb = PB;
		if (palette.length > 2 && BlueNoise.TELL_BLUE_NOISE[pos & 4095] > -88) {
			pr = coeffs[0][0]; pg = coeffs[0][1]; pb = coeffs[0][2];
		}

		var mindist = 1e100;
		for (var i = k; i < palette.length; i++)
		{
			var r2 = (palette[i] & 0xff),
			g2 = (palette[i] >>> 8) & 0xff,
			b2 = (palette[i] >>> 16) & 0xff,
			a2 = (palette[i] >>> 24) & 0xff;
			var curdist = PA * sqr(a2 - a);
			if (curdist > mindist)
				continue;
			
			curdist += pr * sqr(r2 - r);
			if (curdist > mindist)
				continue;

			curdist += pg * sqr(g2 - g);
			if (curdist > mindist)
				continue;

			curdist += pb * sqr(b2 - b);
			if (curdist > mindist)
				continue;

			mindist = curdist;
			k = i;
		}
		nearestMap.set(pixel, k);
		return k;
	}

	function closestColorIndex(palette, pixel, pos) {
		var a = (pixel >>> 24) & 0xff;
		if (a <= alphaThreshold)
			return nearestColorIndex(palette, pixel, pos);
		
		var r = (pixel & 0xff),
		g = (pixel >>> 8) & 0xff,
		b = (pixel >>> 16) & 0xff;

		var closest = closestMap.get(pixel);
		if (!closestMap.has(pixel))
		{
			closest = new Uint32Array(4);
			closest[2] = closest[3] = 0xFFFF;
			
			var pr = PR, pg = PG, pb = PB;
			if (BlueNoise.TELL_BLUE_NOISE[pos & 4095] > -88) {
				pr = coeffs[0][0]; pg = coeffs[0][1]; pb = coeffs[0][2];
			}

			for (var k = 0; k < palette.length; ++k)
			{
				var r2 = (palette[k] & 0xff),
				g2 = (palette[k] >>> 8) & 0xff,
				b2 = (palette[k] >>> 16) & 0xff,
				a2 = (palette[k] >>> 24) & 0xff;
				
				var err = pr * sqr(r2 - r);
				if (err >= closest[3])
					continue;
				
				err += pg * sqr(g2 - g);
				if (err >= closest[3])
					continue;
				
				err += pb * sqr(b2 - b);
				if (err >= closest[3])
					continue;
				
				if (hasSemiTransparency)
					err += PA * sqr(a2 - a);
				
				if (err < closest[2])
				{
					closest[1] = closest[0];
					closest[3] = closest[2];
					closest[0] = k;
					closest[2] = err | 0;
				}
				else if (err < closest[3])
				{
					closest[1] = k;
					closest[3] = err | 0;
				}
			}

			if (closest[3] == 0xFFFF)
				closest[1] = closest[0];
			
			closestMap.set(pixel, closest);
		}

		var MAX_ERR = palette.length << 2;
		var idx = (pos + 1) % 2;
		if (closest[3] * .67 < (closest[3] - closest[2]))
			idx = 0;
		else if (closest[0] > closest[1])
			idx = pos % 2;
			
		if (closest[idx + 2] >= MAX_ERR || (hasAlpha && closest[idx + 2] == 0))
			return nearestColorIndex(palette, pixel, pos);
		return closest[idx];
	}
		
	class PnnQuant {
		#hasSemiTransparency = false; #palette = [];
		#transparentPixelIndex = -1; #transparentColor = 0xffffff;

		constructor(opts) {
			this.opts = opts;
		}
	
		static PnnBin = class PnnBin {
		    constructor() {
				this.ac = this.rc = this.gc = this.bc = 0;
				this.cnt = this.err = 0.0;
				this.nn = this.fw = this.bk = this.tm = this.mtm = 0;
			}
		};
	
		#pnnquan(pixels, nMaxColors) {
			var quan_rt = 1;
			var bins = new Array(65536);
	
			/* Build histogram */
			for (var i = 0; i < pixels.length; ++i)
			{
				var r = pixels[i] & 0xff,
				g = (pixels[i] >>> 8) & 0xff,
				b = (pixels[i] >>> 16) & 0xff,
				a = (pixels[i] >>> 24) & 0xff;
				
				if (a <= alphaThreshold) {
					r = this.#transparentColor & 0xff;
					g = (this.#transparentColor >>> 8) & 0xff;
					b = (this.#transparentColor >>> 16) & 0xff;
					a = (this.#transparentColor >>> 24) & 0xff;
				}
				
				var index = getARGBIndex(a, r, g, b, this.#hasSemiTransparency, nMaxColors < 64 || this.#transparentPixelIndex >= 0);
				if (bins[index] == null)
					bins[index] = new PnnQuant.PnnBin();
				var tb = bins[index];
				tb.ac += a;
				tb.rc += r;
				tb.gc += g;
				tb.bc += b;
				tb.cnt += 1.0;
			}
	
			/* Cluster nonempty bins at one end of array */
			var maxbins = 0;
			for (var i = 0; i < bins.length; ++i)
			{
				if (bins[i] == null)
					continue;
	
				var d = 1.0 / bins[i].cnt;
				bins[i].ac *= d;
				bins[i].rc *= d;
				bins[i].gc *= d;
				bins[i].bc *= d;
	
				bins[maxbins++] = bins[i];
			}
			
			if (nMaxColors < 16)
				quan_rt = -1;
			
			weight = Math.min(0.9, nMaxColors * 1.0 / maxbins);
			if (weight > .003 && weight < .005)
				quan_rt = 0;
			if (weight < .04 && PG >= coeffs[0][1]) {
				PR = PG = PB = PA = 1;
				if (nMaxColors >= 64)
					quan_rt = 0;
			}
			
			var quanFn = getQuanFn(nMaxColors, quan_rt);
			
			var j = 0;
			for (; j < maxbins - 1; ++j)
			{
				bins[j].fw = j + 1;
				bins[j + 1].bk = j;
				bins[j].cnt = quanFn(bins[j].cnt);
			}
			bins[j].cnt = quanFn(bins[j].cnt);
	
			var h, l, l2;
			/* Initialize nearest neighbors and build heap of them */
			var heap = new Uint32Array(bins.length + 1);
			for (var i = 0; i < maxbins; ++i)
			{
				find_nn(bins, i);
				/* Push slot on heap */
				var err = bins[i].err;
				for (l = ++heap[0]; l > 1; l = l2)
				{
					l2 = l >> 1;
					if (bins[h = heap[l2]].err <= err)
						break;
					heap[l] = h;
				}
				heap[l] = i;
			}
	
			/* Merge bins which increase error the least */
			var extbins = maxbins - nMaxColors;
			for (var i = 0; i < extbins;)
			{
				var tb;
				/* Use heap to find which bins to merge */
				for (; ; )
				{
					var b1 = heap[1];
					tb = bins[b1]; /* One with least error */
					/* Is stored error up to date? */
					if ((tb.tm >= tb.mtm) && (bins[tb.nn].mtm <= tb.tm))
						break;
					if (tb.mtm == 0xFFFF) /* Deleted node */
						b1 = heap[1] = heap[heap[0]--];
					else /* Too old error value */
					{
						find_nn(bins, b1);
						tb.tm = i;
					}
					/* Push slot down */
					var err = bins[b1].err;
					for (l = 1; (l2 = l + l) <= heap[0]; l = l2)
					{
						if ((l2 < heap[0]) && (bins[heap[l2]].err > bins[heap[l2 + 1]].err))
							++l2;
						if (err <= bins[h = heap[l2]].err)
							break;
						heap[l] = h;
					}
					heap[l] = b1;
				}
	
				/* Do a merge */
				var nb = bins[tb.nn];
				var n1 = tb.cnt;
				var n2 = nb.cnt;
				var d = Math.fround(1.0 / (n1 + n2));
				tb.ac = d * Math.round(n1 * tb.ac + n2 * nb.ac);
				tb.rc = d * Math.round(n1 * tb.rc + n2 * nb.rc);
				tb.gc = d * Math.round(n1 * tb.gc + n2 * nb.gc);
				tb.bc = d * Math.round(n1 * tb.bc + n2 * nb.bc);
				tb.cnt += n2;
				tb.mtm = ++i;
	
				/* Unchain deleted bin */
				bins[nb.bk].fw = nb.fw;
				bins[nb.fw].bk = nb.bk;
				nb.mtm = 0xFFFF;
			}
	
			/* Fill palette */
			this.#palette = new Uint32Array(extbins > 0 ? nMaxColors : maxbins);
			var k = 0;
			for (var i = 0; k < this.#palette.length; ++k)
			{
				var a = Math.clamp(bins[i].ac, 0, 0xff) | 0,
				r = Math.clamp(bins[i].rc, 0, 0xff) | 0,
				g = Math.clamp(bins[i].gc, 0, 0xff) | 0,
				b = Math.clamp(bins[i].bc, 0, 0xff) | 0;
	
				this.#palette[k] = (a << 24) | (b << 16) | (g << 8) | r;
				if (this.#transparentPixelIndex >= 0 && a == 0) {
					var temp = this.#palette[0];
					this.#palette[0] = this.#transparentColor;
					this.#palette[k] = temp;
				}
	
				i = bins[i].fw;
			}
		}		
	
		quantizeImage() {
			var pixels = this.opts.pixels, width = this.opts.width, height = this.opts.height,
				nMaxColors = this.opts.colors, dither = this.opts.dithering;
			if (this.opts.alphaThreshold)
				alphaThreshold = this.opts.alphaThreshold;
	
			this.clear();
	
			hasAlpha = false;
			var semiTransCount = 0;
			for (var i = 0; i < pixels.length; ++i) {
				var a = (pixels[i] >>> 24) & 0xff;
				
				if (a < 0xE0)
				{
					if (a == 0) {
						this.#transparentPixelIndex = i;
						hasAlpha = true;
						if (nMaxColors > 2)
							this.#transparentColor = pixels[i];
						else
							pixels[i] = this.#transparentColor;
					}
					else if (a > alphaThreshold)
						++semiTransCount;
				}
			}
			
			this.#hasSemiTransparency = hasSemiTransparency = semiTransCount > 0;
	
			if (nMaxColors <= 32)
				PR = PG = PB = PA = 1;
			else {
				PR = coeffs[0][0]; PG = coeffs[0][1]; PB = coeffs[0][2];
			}
	
			transparentColor = this.#transparentColor;
			
			this.#palette = new Uint32Array(nMaxColors);
			if (nMaxColors > 2)
				this.#pnnquan(pixels, nMaxColors);
			else {
				if (this.#transparentPixelIndex >= 0)
				{
					this.#palette[0] = this.#transparentColor;
					this.#palette[1] = (0xff << 24);
				}
				else
				{
					this.#palette[0] = (0xff << 24);
					this.#palette[1] = 0xffffffff;
				}
			}
	
			if (hasSemiTransparency)
				weight *= -1;
	
			if (this.#transparentPixelIndex >= 0 && this.#palette.length > 2)
			{
				var k = this.getDitherFn()(this.#palette, pixels[this.#transparentPixelIndex], this.#transparentPixelIndex);
				this.#palette[k] = this.#transparentColor;
			}
			
			return { getColorIndex: this.getColorIndex, ditherFn: this.getDitherFn(), pal8: this.getPalette(), transparent: this.getTransparentIndex(), type: this.getImgType(), weight: weight, weightB: 1.0 };
		}
	
		getPalette() {
			return this.#palette.buffer;
		};
		
		getImgType() {
			return this.opts.colors > 256 || this.#hasSemiTransparency ? "image/png" : "image/gif";
		}
		
		getTransparentIndex() {
			return this.#transparentPixelIndex > -1 ? 0 : -1;
		}
		
		getDitherFn() {
			return this.opts.dithering ? nearestColorIndex : closestColorIndex;
		}
		
		getColorIndex(a, r, g, b) {
			return getARGBIndex(a, r, g, b, hasSemiTransparency, hasAlpha);
		}
		
		getResult() {
			var quant = this;
			return new Promise(function (resolve, reject) {
				resolve(quant.quantizeImage());
			});
		}
	
		clear() {
			closestMap = new Map();
			nearestMap = new Map();
		}
	}
	
	// expose
	this.PnnQuant = PnnQuant;
	
	// expose to commonJS
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = PnnQuant;
	}

}).call(this);
