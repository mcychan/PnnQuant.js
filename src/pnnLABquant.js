/* Fast pairwise nearest neighbor based algorithm for multilevel thresholding
Copyright (C) 2004-2019 Mark Tyler and Dmitry Groshev
Copyright (c) 2018-2025 Miller Cy Chan
* error measure; time used is proportional to number of bins squared - WJ */

(function () {
	"use strict";

	var alphaThreshold = 0xF, hasAlpha = false, hasSemiTransparency = false, transparentColor;
	var PR = 0.299, PG = 0.587, PB = 0.114, PA = .3333;
	var random = new Random(), ratio = 1.0, weight;
	var closestMap = new Map(), pixelMap = new Map(), nearestMap = new Map();

	var XYZ_WHITE_REFERENCE_X = 95.047, XYZ_WHITE_REFERENCE_Y = 100, XYZ_WHITE_REFERENCE_Z = 108.883;
	var XYZ_EPSILON = 0.008856, XYZ_KAPPA = 903.3;

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
	
	function Lab() {
		this.alpha = 255;
		this.A = this.B = this.L = 0;
	}
		
	function Pnnbin() {
		this.ac = this.Lc = this.Ac = this.Bc = 0;
		this.cnt = 0;
		this.nn = this.fw = this.bk = this.tm = this.mtm = 0;
		this.err = 0.0;
	}

	function Random() {
		this.nextInt = function (max) {
			return Math.floor(Math.random() * (max + 1));
		};
	}

	function sqr(value) {
		return value * value;
	}

	function pivotXyzComponent(component) {
		return component > XYZ_EPSILON
			? Math.fround(Math.cbrt(component))
			: Math.fround((XYZ_KAPPA * component + 16) / 116.0);
	}

	function RGB2LAB(A, R, G, B)
	{
		var sr = R / 255.0;
		sr = sr < 0.04045 ? sr / 12.92 : Math.pow((sr + 0.055) / 1.055, 2.4);
		var sg = G / 255.0;
		sg = sg < 0.04045 ? sg / 12.92 : Math.pow((sg + 0.055) / 1.055, 2.4);
		var sb = B / 255.0;
		sb = sb < 0.04045 ? sb / 12.92 : Math.pow((sb + 0.055) / 1.055, 2.4);
		var x = pivotXyzComponent(100 * (sr * 0.4124 + sg * 0.3576 + sb * 0.1805) / XYZ_WHITE_REFERENCE_X);
		var y = pivotXyzComponent(100 * (sr * 0.2126 + sg * 0.7152 + sb * 0.0722) / XYZ_WHITE_REFERENCE_Y);
		var z = pivotXyzComponent(100 * (sr * 0.0193 + sg * 0.1192 + sb * 0.9505) / XYZ_WHITE_REFERENCE_Z); 

		var lab = new Lab();
		lab.alpha = A;
		lab.L = Math.max(0, 116 * y - 16);
		lab.A = 500 * (x - y);
		lab.B = 200 * (y - z);
		return lab;
	}

	function LAB2RGB(lab)
	{
		var fy = (lab.L + 16.0) / 116.0;
		var fx = lab.A / 500 + fy;
		var fz = fy - lab.B / 200.0;
		var tmp = fx * fx * fx;
		var xr = tmp > XYZ_EPSILON ? tmp : (116.0 * fx - 16) / XYZ_KAPPA;
		var yr = lab.L > XYZ_KAPPA * XYZ_EPSILON ? fy * fy * fy : lab.L / XYZ_KAPPA;
		tmp = fz * fz * fz;
		var zr = tmp > XYZ_EPSILON ? tmp : (116.0 * fz - 16) / XYZ_KAPPA;
		var x = xr * XYZ_WHITE_REFERENCE_X;
		var y = yr * XYZ_WHITE_REFERENCE_Y;
		var z = zr * XYZ_WHITE_REFERENCE_Z;
		
		var r = (x * 3.2406 + y * -1.5372 + z * -0.4986) / 100.0;
		var g = (x * -0.9689 + y * 1.8758 + z * 0.0415) / 100.0;
		var b = (x * 0.0557 + y * -0.2040 + z * 1.0570) / 100.0;
		r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
		g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
		b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

		var a = Math.clamp(Math.round(lab.alpha), 0, 0xff) | 0;
		r = Math.clamp(Math.round(r * 0xff), 0, 0xff) | 0,
		g = Math.clamp(Math.round(g * 0xff), 0, 0xff) | 0,
		b = Math.clamp(Math.round(b * 0xff), 0, 0xff) | 0;
		return (a << 24) | (b << 16) | (g << 8) | r;
	}

	function deg2Rad(deg)
	{
		return Math.fround(deg * (Math.PI / 180.0));
	}

	function L_prime_div_k_L_S_L(lab1, lab2)
	{
		var k_L = 1.0;
		var deltaLPrime = lab2.L - lab1.L;
		var barLPrime = (lab1.L + lab2.L) / 2.0;
		var S_L = 1 + ((0.015 * sqr(barLPrime - 50.0)) / Math.sqrt(20 + sqr(barLPrime - 50.0)));
		return Math.fround(deltaLPrime / (k_L * S_L));
	}

	function C_prime_div_k_L_S_L(lab1, lab2, a1Prime, a2Prime, CPrime1, CPrime2)
	{
		var k_C = 1.0;
		var pow25To7 = 6103515625.0; /* pow(25, 7) */
		var C1 = Math.sqrt((lab1.A * lab1.A) + (lab1.B * lab1.B));
		var C2 = Math.sqrt((lab2.A * lab2.A) + (lab2.B * lab2.B));
		var barC = (C1 + C2) / 2.0;
		var G = 0.5 * (1 - Math.sqrt(Math.pow(barC, 7) / (Math.pow(barC, 7) + pow25To7)));
		a1Prime.value = (1.0 + G) * lab1.A;
		a2Prime.value = (1.0 + G) * lab2.A;

		CPrime1.value = Math.sqrt((a1Prime.value * a1Prime.value) + (lab1.B * lab1.B));
		CPrime2.value = Math.sqrt((a2Prime.value * a2Prime.value) + (lab2.B * lab2.B));
		var deltaCPrime = CPrime2.value - CPrime1.value;
		var barCPrime = (CPrime1.value + CPrime2.value) / 2.0;

		var S_C = 1 + (0.045 * barCPrime);
		return Math.fround(deltaCPrime / (k_C * S_C));
	}

	function H_prime_div_k_L_S_L(lab1, lab2, a1Prime, a2Prime, CPrime1, CPrime2, barCPrime, barhPrime)
	{
		const k_H = 1.0;
		var deg360InRad = deg2Rad(360.0);
		var deg180InRad = deg2Rad(180.0);
		var CPrimeProduct = CPrime1 * CPrime2;
		var hPrime1;
		if (lab1.B == 0.0 && a1Prime == 0.0)
			hPrime1 = 0.0;
		else {
			hPrime1 = Math.atan2(lab1.B, a1Prime);
			/*
			* This must be converted to a hue angle in degrees between 0
			* and 360 by addition of 2π to negative hue angles.
			*/
			if (hPrime1 < 0)
				hPrime1 += deg360InRad;
		}
		var hPrime2;
		if (lab2.B == 0.0 && a2Prime == 0.0)
			hPrime2 = 0.0;
		else {
			hPrime2 = Math.atan2(lab2.B, a2Prime);
			/*
			* This must be converted to a hue angle in degrees between 0
			* and 360 by addition of 2π to negative hue angles.
			*/
			if (hPrime2 < 0)
				hPrime2 += deg360InRad;
		}
		var deltahPrime;
		if (CPrimeProduct == 0.0)
			deltahPrime = 0;
		else {
			/* Avoid the Math.abs() call */
			deltahPrime = hPrime2 - hPrime1;
			if (deltahPrime < -deg180InRad)
				deltahPrime += deg360InRad;
			else if (deltahPrime > deg180InRad)
				deltahPrime -= deg360InRad;
		}

		var deltaHPrime = 2.0 * Math.sqrt(CPrimeProduct) * Math.sin(deltahPrime / 2.0);
		var hPrimeSum = hPrime1 + hPrime2;
		if ((CPrime1 * CPrime2) == 0.0) {
			barhPrime.value = hPrimeSum;
		}
		else {
			if (Math.abs(hPrime1 - hPrime2) <= deg180InRad)
				barhPrime.value = (hPrimeSum / 2.0);
			else {
				if (hPrimeSum < deg360InRad)
					barhPrime.value = (hPrimeSum + deg360InRad) / 2.0;
				else
					barhPrime.value = (hPrimeSum - deg360InRad) / 2.0;
			}
		}

		barCPrime.value = (CPrime1 + CPrime2) / 2.0;
		var T = 1.0 - (0.17 * Math.cos(barhPrime.value - deg2Rad(30.0))) +
			(0.24 * Math.cos(2.0 * barhPrime.value)) +
			(0.32 * Math.cos((3.0 * barhPrime.value) + deg2Rad(6.0))) -
			(0.20 * Math.cos((4.0 * barhPrime.value) - deg2Rad(63.0)));
		var S_H = 1 + (0.015 * barCPrime.value * T);
		return Math.fround(deltaHPrime / (k_H * S_H));
	}

	function R_T(barCPrime, barhPrime, C_prime_div_k_L_S_L, H_prime_div_k_L_S_L)
	{
		var pow25To7 = 6103515625.0; /* Math.pow(25, 7) */
		var deltaTheta = deg2Rad(30.0) * Math.exp(-Math.pow((barhPrime - deg2Rad(275.0)) / deg2Rad(25.0), 2.0));
		var R_C = 2.0 * Math.sqrt(Math.pow(barCPrime, 7.0) / (Math.pow(barCPrime, 7.0) + pow25To7));
		var R_T = (-Math.sin(2.0 * deltaTheta)) * R_C;
		return Math.fround(R_T * C_prime_div_k_L_S_L * H_prime_div_k_L_S_L);
	}

	/* From the paper "The CIEDE2000 Color-Difference Formula: Implementation Notes, */
	/* Supplementary Test Data, and Mathematical Observations", by */
	/* Gaurav Sharma, Wencheng Wu and Edul N. Dalal, */
	/* Color Res. Appl., vol. 30, no. 1, pp. 21-30, Feb. 2005. */
	/* Return the CIEDE2000 Delta E color difference measure squared, for two Lab values */
	function CIEDE2000(lab1, lab2)
	{
		var deltaL_prime_div_k_L_S_L = L_prime_div_k_L_S_L(lab1, lab2);
		var a1Prime = {}, a2Prime = {}, CPrime1 = {}, CPrime2 = {};
		var deltaC_prime_div_k_L_S_L = C_prime_div_k_L_S_L(lab1, lab2, a1Prime, a2Prime, CPrime1, CPrime2);
		var barCPrime = {}, barhPrime = {};
		var deltaH_prime_div_k_L_S_L = H_prime_div_k_L_S_L(lab1, lab2, a1Prime.value, a2Prime.value, CPrime1.value, CPrime2.value, barCPrime, barhPrime);
		var deltaR_T = R_T(barCPrime.value, barhPrime.value, deltaC_prime_div_k_L_S_L, deltaH_prime_div_k_L_S_L);
		return sqr(deltaL_prime_div_k_L_S_L) + sqr(deltaC_prime_div_k_L_S_L) + sqr(deltaH_prime_div_k_L_S_L) + deltaR_T;
	}

	function getARGBIndex(a, r, g, b, hasSemiTransparency, hasTransparency) {
		if (hasSemiTransparency)
			return (a & 0xF0) << 8 | (r & 0xF0) << 4 | (g & 0xF0) | (b >> 4);
		if (hasTransparency)
			return (a & 0x80) << 8 | (r & 0xF8) << 7 | (g & 0xF8) << 2 | (b >> 3);
		return (r & 0xF8) << 8 | (g & 0xFC) << 3 | (b >> 3);
	}

	function getLab(a, r, g, b)
	{
		var argb = (a << 24) | (b << 16) | (g << 8) | r;
		var lab1 = pixelMap.get(argb);
		if (!pixelMap.has(argb))
		{
			lab1 = RGB2LAB(a, r, g, b);
			pixelMap.set(argb, lab1);
		}
		return lab1;
	}	

	function getQuanFn(nMaxColors, quan_rt) {
		if (quan_rt > 0) {
			if (quan_rt > 1)
				return function (cnt) { return Math.fround(Math.pow(cnt, 0.75)); };
			if (nMaxColors < 64)
				return function (cnt) {
					return Math.sqrt(cnt) | 0;
				};
			return function (cnt) {
				return Math.fround(Math.sqrt(cnt));
			};
		}
		return function (cnt) { return cnt; };
	}
	
	function nearestColorIndex(palette, pixel, pos) {
		var nearest = nearestMap.get(pixel);
		if (nearestMap.has(pixel))
			return nearest;

		var k = 0;
		var a = (pixel >>> 24) & 0xff;
		if (a <= alphaThreshold) {
			pixel = transparentColor;
			a = 0;
		}

		if (palette.length > 2 && hasAlpha && a > alphaThreshold)
			k = 1;

		var r = (pixel & 0xff),
		g = (pixel >>> 8) & 0xff,
		b = (pixel >>> 16) & 0xff;

		var mindist = 1e100;
		var lab1 = getLab(a, r, g, b);
		for (var i = k; i < palette.length; ++i) {
			var r2 = (palette[i] & 0xff),
			g2 = (palette[i] >>> 8) & 0xff,
			b2 = (palette[i] >>> 16) & 0xff,
			a2 = (palette[i] >>> 24) & 0xff;
			var curdist = hasSemiTransparency ? sqr(a2 - a) / Math.exp(1.5) : 0;
			if (curdist > mindist)
				continue;
			
			var lab2 = getLab(a2, r2, g2, b2);
			if (palette.length <= 4) {
				curdist = sqr(r2 - r) + sqr(g2 - g) + sqr(b2 - b);
				if (hasSemiTransparency)
					curdist += sqr(a2 - a);
			}
			else if (hasSemiTransparency || palette.length < 16) {
				curdist += sqr(lab2.L - lab1.L);
				if (curdist > mindist)
					continue;
				
				curdist += sqr(lab2.A - lab1.A);
				if (curdist > mindist)
					continue;
				
				curdist += sqr(lab2.B - lab1.B);
			}
			else if (palette.length > 32) {
				curdist += Math.abs(lab2.L - lab1.L);
				if (curdist > mindist)
					continue;
				
				curdist += Math.sqrt(sqr(lab2.A - lab1.A) + sqr(lab2.B - lab1.B));
			}
			else {
				var deltaL_prime_div_k_L_S_L = L_prime_div_k_L_S_L(lab1, lab2);
				curdist += sqr(deltaL_prime_div_k_L_S_L);
				if (curdist > mindist)
					continue;

				var a1Prime = {}, a2Prime = {}, CPrime1 = {}, CPrime2 = {};
				var deltaC_prime_div_k_L_S_L = C_prime_div_k_L_S_L(lab1, lab2, a1Prime, a2Prime, CPrime1, CPrime2);
				curdist += sqr(deltaC_prime_div_k_L_S_L);
				if (curdist > mindist)
					continue;

				var barCPrime = {}, barhPrime = {};
				var deltaH_prime_div_k_L_S_L = H_prime_div_k_L_S_L(lab1, lab2, a1Prime.value, a2Prime.value, CPrime1.value, CPrime2.value, barCPrime, barhPrime);
				curdist += sqr(deltaH_prime_div_k_L_S_L);
				if (curdist > mindist)
					continue;

				curdist += R_T(barCPrime.value, barhPrime.value, deltaC_prime_div_k_L_S_L, deltaH_prime_div_k_L_S_L);
			}
			
			if (curdist > mindist)
				continue;
			mindist = curdist;
			k = i;
		}
		nearestMap.set(pixel, k);
		return k;
	}

	function closestColorIndex(palette, pixel, pos) {
		if (PG < coeffs[0][1] && BlueNoise.TELL_BLUE_NOISE[pos & 4095] > -88)
			return nearestColorIndex(palette, pixel, pos);

		var a = (pixel >>> 24) & 0xff;
		if (a <= alphaThreshold)
			return nearestColorIndex(palette, pixel, pos);

		var closest = closestMap.get(pixel);
		if (!closestMap.has(pixel)) {
			closest = new Uint32Array(4);
			closest[2] = closest[3] = 0xffffffff;

			var r = (pixel & 0xff),
			g = (pixel >>> 8) & 0xff,
			b = (pixel >>> 16) & 0xff;

			for (var k = 0; k < palette.length; ++k) {
				var r2 = (palette[k] & 0xff),
				g2 = (palette[k] >>> 8) & 0xff,
				b2 = (palette[k] >>> 16) & 0xff,
				a2 = (palette[k] >>> 24) & 0xff;

				var err = PR * (1 - ratio) * sqr(r2 - r);
				if (err >= closest[3])
					continue;

				err += PG * (1 - ratio) * sqr(g2 - g);
				if (err >= closest[3])
					continue;

				err += PB * (1 - ratio) * sqr(b2 - b);
				if (err >= closest[3])
					continue;

				if (hasSemiTransparency)
					err += PA * sqr(a2 - a);

				for (var i = 0; i < coeffs.length; ++i) {
					err += ratio * sqr(coeffs[i][0] * (r2 - r));
					if (err >= closest[3])
						break;

					err += ratio * sqr(coeffs[i][1] * (g2 - g));
					if (err >= closest[3])
						break;

					err += ratio * sqr(coeffs[i][2] * (b2 - b));
					if (err >= closest[3])
						break;
				}
				
				if (err < closest[2]) {
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

			if (closest[3] == 0xffffffff)
				closest[1] = closest[0];
			
			closestMap.set(pixel, closest);
		}

		var idx = 1;
		if (closest[2] == 0 || (random.nextInt(closest[3] + closest[2])) <= closest[3])
			idx = 0;

		var MAX_ERR = palette.length;
		if (closest[idx + 2] >= MAX_ERR || (hasAlpha && closest[idx] == 0))
			return nearestColorIndex(palette, pixel, pos);
		return closest[idx];
	}
			
	class PnnLABQuant {
		#hasSemiTransparency = false; #palette = []; #saliencies = null;
		#transparentPixelIndex = -1; #transparentColor = 0xffffff;

		constructor(opts) {
			this.opts = opts;
		}
		
		#find_nn(bins, idx, texicab) {
			var nn = 0;
			var err = 1e100;

			var bin1 = bins[idx];
			var n1 = bin1.cnt;
			var lab1 = new Lab();
			lab1.alpha = bin1.ac; lab1.L = bin1.Lc; lab1.A = bin1.Ac; lab1.B = bin1.Bc;
			for (var i = bin1.fw; i != 0; i = bins[i].fw) {
				var n2 = bins[i].cnt, nerr2 = (n1 * n2) / (n1 + n2);
				if (nerr2 >= err)
					continue;

				var lab2 = new Lab();
				lab2.alpha = bins[i].ac; lab2.L = bins[i].Lc; lab2.A = bins[i].Ac; lab2.B = bins[i].Bc;
				var alphaDiff = hasSemiTransparency ? sqr(lab2.alpha - lab1.alpha) / Math.exp(1.5) : 0;
				var nerr = nerr2 * alphaDiff;
				if (nerr >= err)
					continue;
				
				if (!texicab) {
					nerr += (1 - ratio) * nerr2 * sqr(lab2.L - lab1.L);
					if (nerr >= err)
						continue;

					nerr += (1 - ratio) * nerr2 * sqr(lab2.A - lab1.A);
					if (nerr >= err)
						continue;

					nerr += (1 - ratio) * nerr2 * sqr(lab2.B - lab1.B);
				}
				else {
					nerr += (1 - ratio) * nerr2 * Math.abs(lab2.L - lab1.L);
					if (nerr >= err)
						continue;

					nerr += (1 - ratio) * nerr2 * Math.sqrt(sqr(lab2.A - lab1.A) + sqr(lab2.B - lab1.B));
				}

				if (nerr >= err)
					continue;

				var deltaL_prime_div_k_L_S_L = L_prime_div_k_L_S_L(lab1, lab2);
				nerr += ratio * nerr2 * sqr(deltaL_prime_div_k_L_S_L);
				if (nerr >= err)
					continue;

				var a1Prime = {}, a2Prime = {}, CPrime1 = {}, CPrime2 = {};
				var deltaC_prime_div_k_L_S_L = C_prime_div_k_L_S_L(lab1, lab2, a1Prime, a2Prime, CPrime1, CPrime2);
				nerr += ratio * nerr2 * sqr(deltaC_prime_div_k_L_S_L);
				if (nerr >= err)
					continue;

				var barCPrime = {}, barhPrime = {};
				var deltaH_prime_div_k_L_S_L = H_prime_div_k_L_S_L(lab1, lab2, a1Prime.value, a2Prime.value, CPrime1.value, CPrime2.value, barCPrime, barhPrime);
				nerr += ratio * nerr2 * sqr(deltaH_prime_div_k_L_S_L);
				if (nerr >= err)
					continue;

				nerr += ratio * nerr2 * R_T(barCPrime.value, barhPrime.value, deltaC_prime_div_k_L_S_L, deltaH_prime_div_k_L_S_L);
				if (nerr >= err)
					continue;

				err = nerr;
				nn = i;
			}
			bin1.err = Math.fround(err);
			bin1.nn = nn;
		}
		
		#pnnquan(pixels, nMaxColors) {
			var quan_rt = 1;
			var bins = new Array(65536);
			var saliencies = nMaxColors >= 128 ? null : new Float32Array(pixels.length);
			var saliencyBase = .1;

			/* Build histogram */
			for (var i = 0; i < pixels.length; ++i) {
				// !!! Can throw gamma correction in here, but what to do about perceptual
				// !!! nonuniformity then?
				var r = (pixels[i] & 0xff),
				g = (pixels[i] >>> 8) & 0xff,
				b = (pixels[i] >>> 16) & 0xff,
				a = (pixels[i] >>> 24) & 0xff;

				if (a <= alphaThreshold) {
					r = this.#transparentColor & 0xff;
					g = (this.#transparentColor >>> 8) & 0xff;
					b = (this.#transparentColor >>> 16) & 0xff;
					a = (this.#transparentColor >>> 24) & 0xff;
				}
				
				var index = getARGBIndex(a, r, g, b, this.#hasSemiTransparency, this.#transparentPixelIndex >= 0);
				var lab1 = getLab(a, r, g, b);
				
				if (bins[index] == null)
					bins[index] = new Pnnbin();
				var tb = bins[index];
				tb.ac += a;
				tb.Lc += lab1.L;
				tb.Ac += lab1.A;
				tb.Bc += lab1.B;
				tb.cnt += 1.0;
				if (saliencies != null)
					saliencies[i] = saliencyBase + (1 - saliencyBase) * lab1.L / 100 * a / 255;
			}
			this.#saliencies = saliencies;

			/* Cluster nonempty bins at one end of array */
			var maxbins = 0;
			for (var i = 0; i < bins.length; ++i) {
				if (bins[i] == null)
					continue;

				var d = 1.0 / bins[i].cnt;
				bins[i].ac *= d;
				bins[i].Lc *= d;
				bins[i].Ac *= d;
				bins[i].Bc *= d;

				bins[maxbins++] = bins[i];
			}
			
			var proportional = sqr(nMaxColors) / maxbins;
			if ((this.#transparentPixelIndex >= 0 || this.#hasSemiTransparency) && nMaxColors < 32)
				quan_rt = -1;
			
			weight = Math.min(0.9, nMaxColors * 1.0 / maxbins);
			if ((nMaxColors < 16 && weight < .0075) || weight < .001 || (weight > .0015 && weight < .0022))
				quan_rt = 2;
			if (weight < .04 && PG < 1 && PG >= coeffs[0][1]) {
				if (nMaxColors >= 64)
					quan_rt = 0;
			}
			if (nMaxColors > 16 && nMaxColors < 64) {
				var weightB = nMaxColors / 8000.0;
				if (Math.abs(weightB - weight) < .001)
					quan_rt = 2;
			}
			
			if (pixelMap.size <= nMaxColors) {
				/* Fill palette */
				var palette = new Uint32Array(pixelMap.size);
				var k = 0;
				pixelMap.forEach(function (value, pixel) {
					palette[k++] = pixel;

					if (k > 1 && ((pixel >>> 24) & 0xff) == 0) {
						palette[k - 1] = palette[0]; palette[0] = pixel;
					}
				});

				this.#palette = palette;
				return;
			}
			
			var quanFn = getQuanFn(nMaxColors, quan_rt);
			
			var j = 0;
			for (; j < maxbins - 1; ++j) {
				bins[j].fw = j + 1;
				bins[j + 1].bk = j;
				
				bins[j].cnt = quanFn(bins[j].cnt);
			}	
			bins[j].cnt = quanFn(bins[j].cnt);
			
			var texicab = proportional > .0225 && !this.#hasSemiTransparency;
			
			if (this.#hasSemiTransparency)
				ratio = .5;
			else if (quan_rt != 0 && nMaxColors < 64) {
				if (proportional > .018 && proportional < .022)
					ratio = Math.min(1.0, proportional + weight * Math.exp(3.13));
				else if (proportional > .1)
					ratio = Math.min(1.0, 1.0 - weight);
				else if (proportional > .04)
					ratio = Math.min(1.0, weight * Math.exp(1.56));
				else if (proportional > .025 && (weight < .002 || weight > .0022))
					ratio = Math.min(1.0, proportional + weight * Math.exp(3.66));
				else
					ratio = Math.min(1.0, proportional + weight * Math.exp(1.718));
			}
			else if (nMaxColors > 256)
				ratio = Math.min(1.0, 1 - 1.0 / proportional);
			else
				ratio = Math.min(1.0, 1 - weight * .7);
			
			if (!this.#hasSemiTransparency && quan_rt < 0)
				ratio = Math.min(1.0, weight * Math.exp(3.13));
			
			var h, l, l2;
			/* Initialize nearest neighbors and build heap of them */
			var heap = new Uint32Array(bins.length + 1);
			for (var i = 0; i < maxbins; ++i) {
				this.#find_nn(bins, i, texicab);
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
			
			if (quan_rt > 0 && nMaxColors < 64 && proportional > .035 && proportional < .1) {
				var dir = proportional > .04 ? 1 : -1;
				var margin = dir > 0 ? .002 : .0025;
				var delta = weight > margin && weight < .003 ? 1.872 : 1.632;
				ratio = Math.min(1.0, proportional + dir * weight * Math.exp(delta));
			}

			/* Merge bins which increase error the least */
			var extbins = maxbins - nMaxColors;
			for (var i = 0; i < extbins;) {
				var tb;
				/* Use heap to find which bins to merge */
				for (; ; ) {
					var b1 = heap[1];
					tb = bins[b1]; /* One with least error */
					/* Is stored error up to date? */
					if ((tb.tm >= tb.mtm) && (bins[tb.nn].mtm <= tb.tm))
						break;
					if (tb.mtm == 0xFFFF) /* Deleted node */
						b1 = heap[1] = heap[heap[0]--];
					else /* Too old error value */
					{
						this.#find_nn(bins, b1, texicab);
						tb.tm = i;
					}
					/* Push slot down */
					var err = bins[b1].err;
					for (l = 1; (l2 = l + l) <= heap[0]; l = l2) {
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
				var d = 1.0 / (n1 + n2);
				tb.ac = Math.fround(d * (n1 * tb.ac + n2 * nb.ac));
				tb.Lc = Math.fround(d * (n1 * tb.Lc + n2 * nb.Lc));
				tb.Ac = Math.fround(d * (n1 * tb.Ac + n2 * nb.Ac));
				tb.Bc = Math.fround(d * (n1 * tb.Bc + n2 * nb.Bc));
				tb.cnt += n2;
				tb.mtm = ++i;

				/* Unchain deleted bin */
				bins[nb.bk].fw = nb.fw;
				bins[nb.fw].bk = nb.bk;
				nb.mtm = 0xFFFF;
			}

			/* Fill palette */
			if (extbins < 0)
				this.#palette = new Uint32Array(maxbins);
			
			var k = 0;
			for (var i = 0; k < this.#palette.length; ++k) {
				var lab1 = new Lab();
				lab1.alpha = (this.#hasSemiTransparency || this.#transparentPixelIndex >= 0) ? 
					(Math.clamp(Math.round(bins[i].ac), 0, 0xff) | 0) : 0xff,
				lab1.L = bins[i].Lc; lab1.A = bins[i].Ac; lab1.B = bins[i].Bc;

				this.#palette[k] = LAB2RGB(lab1);

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
				if (this.#transparentPixelIndex > -1 && a == 0)
					pixels[i] = this.#transparentColor;

				if (a < 0xE0) {
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
				weight = 1;
				if (this.#transparentPixelIndex >= 0) {
					this.#palette[0] = this.#transparentColor;
					this.#palette[1] = (0xff << 24);
				}
				else {
					this.#palette[0] = (0xff << 24);
					this.#palette[1] = 0xffffffff;
				}
			}

			if (hasSemiTransparency)
				weight *= -1;

			if (this.opts.dithering && this.#saliencies == null && (nMaxColors <= 256 || weight > .99)) {
				var saliencies = new Float32Array(pixels.length);
				var saliencyBase = .1;

				for (var i = 0; i < pixels.length; ++i) {
					var r = (pixels[i] & 0xff),
					g = (pixels[i] >>> 8) & 0xff,
					b = (pixels[i] >>> 16) & 0xff,
					a = (pixels[i] >>> 24) & 0xff;

					var lab1 = getLab(a, r, g, b);

					saliencies[i] = saliencyBase + (1 - saliencyBase) * lab1.L / 100 * a / 255;
				}
				this.#saliencies = saliencies;
			}

			if (this.#transparentPixelIndex >= 0 && this.#palette.length > 2) {
				var k = nearestColorIndex(this.#palette, pixels[this.#transparentPixelIndex], this.#transparentPixelIndex);
				this.#palette[k] = this.#transparentColor;
			}
			
			if (this.opts.dithering)
				return { getColorIndex: this.getColorIndex, ditherFn: this.getDitherFn(), pal8: this.getPalette(), saliencies: this.#saliencies, transparent: this.getTransparentIndex(), type: this.getImgType(), weight: weight, weightB: 1.0 };
			
			var delta = sqr(nMaxColors) / pixelMap.size;
			var weightB = delta > 0.023 ? 1.0 : Math.fround(37.013 * delta + 0.906);
			return { getColorIndex: this.getColorIndex, ditherFn: this.getDitherFn(), pal8: this.getPalette(), saliencies: this.#saliencies, transparent: this.getTransparentIndex(), type: this.getImgType(), weight: weight, weightB: weightB };
		}
		
		getPalette() {
			return this.#palette.buffer;
		}
		
		getImgType() {
			return this.opts.colors > 256 || this.#hasSemiTransparency ? "image/png" : "image/gif";
		}
		
		getTransparentIndex() {
			return this.#transparentPixelIndex > -1 ? 0 : -1;
		}
		
		getDitherFn() {
			if (this.#transparentPixelIndex > -1 || this.#palette.length < 4)
				return nearestColorIndex;
			return closestColorIndex;
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
			pixelMap = new Map();
			nearestMap = new Map();
			random = new Random();
		}
	}

	// expose
	this.PnnLABQuant = PnnLABQuant;

	// expose to commonJS
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = PnnLABQuant;
	}

}).call(this);
