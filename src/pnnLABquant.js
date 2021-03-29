/* Fast pairwise nearest neighbor based algorithm for multilevel thresholding
Copyright (C) 2004-2019 Mark Tyler and Dmitry Groshev
Copyright (c) 2018-2021 Miller Cy Chan
* error measure; time used is proportional to number of bins squared - WJ */

(function(){
	function PnnLABQuant(opts) {
		this.opts = opts || {};
		this.hasSemiTransparency = false;
		this.m_transparentPixelIndex = -1;
		this.m_transparentColor = 0;
		this.palette = [];
		this.qPixels = [];
	}
	
	if(!Math.clamp) {
		Math.clamp = function(a,b,c){
			return this.max(b, this.min(c, a));
		};
	}
	
	if(!Math.cbrt) {
		Math.cbrt = function(value){
			return this.exp((1/3) * this.log(value));
		};
	}
	
	var PR = .299, PG = .587, PB = .114;
	var ratio = 1.0;
	var closestMap = [], pixelMap = [], nearestMap = [];
	
	function Lab() {
		this.alpha = this.A = this.B = this.L = 0;
	}
	
	function Pnnbin() {
		this.ac = this.Lc = this.Ac = this.Bc = 0;
		this.cnt = 0;
		this.nn = this.fw = this.bk = this.tm = this.mtm = 0;
		this.err = 0.0;
	}
	
	function RGB2LAB(A, R, G, B)
	{
		var r = R / 255.0, g = G / 255.0, b = B / 255.0;
		var x, y, z;

		r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
		g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
		b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

		x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
		y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
		z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

		x = (x > 0.008856) ? Math.cbrt(x) : (7.787 * x) + 16.0 / 116.0;
		y = (y > 0.008856) ? Math.cbrt(y) : (7.787 * y) + 16.0 / 116.0;
		z = (z > 0.008856) ? Math.cbrt(z) : (7.787 * z) + 16.0 / 116.0;

		var lab = new Lab();
		lab.alpha = A,
			lab.L = ((116 * y) - 16),
			lab.A = (500 * (x - y)),
			lab.B = (200 * (y - z));
		return lab;
	}
	
	function LAB2RGB(lab)
	{
		var y = (lab.L + 16) / 116;
		var x = lab.A / 500 + y;
		var z = y - lab.B / 200;
		var r, g, b;

		x = 0.95047 * ((x * x * x > 0.008856) ? x * x * x : (x - 16.0 / 116.0) / 7.787);
		y = 1.00000 * ((y * y * y > 0.008856) ? y * y * y : (y - 16.0 / 116.0) / 7.787);
		z = 1.08883 * ((z * z * z > 0.008856) ? z * z * z : (z - 16.0 / 116.0) / 7.787);

		r = x *  3.2406 + y * -1.5372 + z * -0.4986;
		g = x * -0.9689 + y *  1.8758 + z *  0.0415;
		b = x *  0.0557 + y * -0.2040 + z *  1.0570;

		r = (r > 0.0031308) ? (1.055 * Math.pow(r, 1.0 / 2.4) - 0.055) : 12.92 * r;
		g = (g > 0.0031308) ? (1.055 * Math.pow(g, 1.0 / 2.4) - 0.055) : 12.92 * g;
		b = (b > 0.0031308) ? (1.055 * Math.pow(b, 1.0 / 2.4) - 0.055) : 12.92 * b;

		var a = Math.clamp(lab.alpha, 0, 255);
		r = Math.clamp(r * 255, 0, 255),
		g = Math.clamp(g * 255, 0, 255),
		b = Math.clamp(b * 255, 0, 255);
		return (a << 24) | (b << 16) | (g << 8) | r;
	}
	
	function deg2Rad(deg)
	{
		return (deg * (Math.PI / 180.0));
	}
	
	function L_prime_div_k_L_S_L(lab1, lab2)
	{
		var k_L = 1.0;
		var deltaLPrime = lab2.L - lab1.L;	
		var barLPrime = (lab1.L + lab2.L) / 2.0;
		var S_L = 1 + ((0.015 * sqr(barLPrime - 50.0)) / Math.sqrt(20 + sqr(barLPrime - 50.0)));
		return deltaLPrime / (k_L * S_L);
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
		return deltaCPrime / (k_C * S_C);
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
		return deltaHPrime / (k_H * S_H);
	}
	
	function R_T(barCPrime, barhPrime, C_prime_div_k_L_S_L, H_prime_div_k_L_S_L)
	{
		var pow25To7 = 6103515625.0; /* Math.pow(25, 7) */
		var deltaTheta = deg2Rad(30.0) * Math.exp(-Math.pow((barhPrime - deg2Rad(275.0)) / deg2Rad(25.0), 2.0));
		var R_C = 2.0 * Math.sqrt(Math.pow(barCPrime, 7.0) / (Math.pow(barCPrime, 7.0) + pow25To7));
		var R_T = (-Math.sin(2.0 * deltaTheta)) * R_C;
		return R_T * C_prime_div_k_L_S_L * H_prime_div_k_L_S_L;
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
		return
			sqr(deltaL_prime_div_k_L_S_L) +
			sqr(deltaC_prime_div_k_L_S_L) +
			sqr(deltaH_prime_div_k_L_S_L) +
			deltaR_T;
	}
	
	function getARGBIndex(a, r, g, b, hasSemiTransparency) {
		if (hasSemiTransparency)
			return (a & 0xF0) << 8 | (r & 0xF0) << 4 | (g & 0xF0) | (b >> 4);
		return (r & 0xF8) << 8 | (g & 0xFC) << 3 | (b >> 3);
	}
	
	function sqr(value) {
		return value * value;
	}
	
	function getLab(a, r, g, b)
	{
		var argb = (a << 24) | (b << 16) | (g << 8) | r;
		var lab1 = pixelMap[argb];		
		if (!lab1)
		{
			lab1 = RGB2LAB(a, r, g, b);
			pixelMap[argb] = lab1;
		}
		return lab1;
	}
	
	function find_nn(bins, idx, nMaxColors) {
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
			var nerr = nerr2 * sqr(lab2.alpha - lab1.alpha) / Math.exp(1.7);
			if (nerr >= err)
				continue;
				
			nerr += (1 - ratio) * nerr2 * sqr(lab2.L - lab1.L);
			if (nerr >= err)
				continue;

			nerr += (1 - ratio) * nerr2 * sqr(lab2.A - lab1.A);
			if (nerr >= err)
				continue;

			nerr += (1 - ratio) * nerr2 * sqr(lab2.B - lab1.B);

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
		bin1.err = err;
		bin1.nn = nn;
	}
	
	PnnLABQuant.prototype.pnnquan = function pnnquan(pixels, nMaxColors, quan_rt) {
		var bins = new Array(65536);

		/* Build histogram */
		for (var i = 0; i < pixels.length; ++i) {
			// !!! Can throw gamma correction in here, but what to do about perceptual
			// !!! nonuniformity then?
			var r = (pixels[i] & 0xff),
			g = (pixels[i] >>> 8) & 0xff,
			b = (pixels[i] >>> 16) & 0xff,
			a = (pixels[i] >>> 24) & 0xff;
			
			var index = getARGBIndex(a, r, g, b, this.hasSemiTransparency);
			var lab1 = getLab(a, r, g, b);
			
			if (bins[index] == null)
				bins[index] = new Pnnbin();
			var tb = bins[index];
			tb.ac += a;
			tb.Lc += lab1.L;
			tb.Ac += lab1.A;
			tb.Bc += lab1.B;
			tb.cnt++;
		}

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
		if(nMaxColors < 16)
			quan_rt = -1;
		else if ((proportional < .022 || proportional > .5) && nMaxColors < 64)
			quan_rt = 0;
		
		if (quan_rt > 0)
			bins[0].cnt = (Math.sqrt(bins[0].cnt) | 0);
		for (var i = 0; i < maxbins - 1; ++i) {
			bins[i].fw = i + 1;
			bins[i + 1].bk = i;
			
			if (quan_rt > 0)
				bins[i + 1].cnt = (Math.sqrt(bins[i + 1].cnt) | 0);
		}		

		var h, l, l2;
		if (quan_rt != 0 && nMaxColors < 64)
			ratio = Math.min(1.0, proportional + nMaxColors * Math.exp(3.845) / Object.keys(pixelMap).length);
		else if (quan_rt > 0)
			ratio = Math.min(1.0, Math.pow(nMaxColors, 1.05) / Object.keys(pixelMap).length);			
		else
			ratio = Math.min(1.0, Math.pow(nMaxColors, 2.31) / maxbins);
		
		if (quan_rt < 0)
			ratio += 0.5;
		
		/* Initialize nearest neighbors and build heap of them */
		var heap = new Uint32Array(bins.length + 1);
		for (var i = 0; i < maxbins; ++i) {
			find_nn(bins, i, nMaxColors);
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
					find_nn(bins, b1, nMaxColors);
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
			tb.ac = d * (n1 * tb.ac + n2 * nb.ac);
			tb.Lc = d * (n1 * tb.Lc + n2 * nb.Lc);
			tb.Ac = d * (n1 * tb.Ac + n2 * nb.Ac);
			tb.Bc = d * (n1 * tb.Bc + n2 * nb.Bc);
			tb.cnt += nb.cnt;
			tb.mtm = ++i;

			/* Unchain deleted bin */
			bins[nb.bk].fw = nb.fw;
			bins[nb.fw].bk = nb.bk;
			nb.mtm = 0xFFFF;
		}
		delete heap;

		/* Fill palette */
		var k = 0;
		for (var i = 0; ; ++k) {
			var lab1 = new Lab();
			lab1.alpha = (Math.clamp(bins[i].ac, 0, 0xff) | 0),
			lab1.L = bins[i].Lc; lab1.A = bins[i].Ac; lab1.B = bins[i].Bc;

			this.palette[k] = LAB2RGB(lab1);
			if (this.m_transparentPixelIndex >= 0 && this.palette[k] == this.m_transparentColor) {
				var temp = this.palette[0];
				this.palette[0] = this.palette[k];
				this.palette[k] = temp;
			}

			if ((i = bins[i].fw) == 0)
				break;
		}
		
		
		if(typeof this.palette.sort !== "undefined")
			this.palette.sort();
	};
	
	function nearestColorIndex(palette, nMaxColors, pixel) {
		var nearest = nearestMap[pixel];
		if (nearest != null)
			return nearest;
			
		var k = 0;
		var r = (pixel & 0xff),
		g = (pixel >>> 8) & 0xff,
		b = (pixel >>> 16) & 0xff,
		a = (pixel >>> 24) & 0xff;

		var mindist = 1e100;
		var lab1 = getLab(a, r, g, b);
		for (var i = 0; i < nMaxColors; ++i) {
			var r2 = (palette[i] & 0xff),
			g2 = (palette[i] >>> 8) & 0xff,
			b2 = (palette[i] >>> 16) & 0xff,
			a2 = (palette[i] >>> 24) & 0xff;
			var curdist = sqr(a2 - a);
			if (curdist > mindist)
				continue;

			var lab2 = getLab(a2, r2, g2, b2);
			if (nMaxColors > 32 || this.hasSemiTransparency) {
				curdist += PR * sqr(r2 - r);
				if (curdist > mindist)
					continue;

				curdist += PG * sqr(g2 - g);
				if (curdist > mindist)
					continue;

				curdist += PB * sqr(b2 - b);
				if (PB < 1) {
					if (curdist > mindist)
						continue;

					curdist += sqr(lab2.B - lab1.B) / 2.0;
				}
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
		nearestMap[pixel] = k;
		return k;
	}
	
	function closestColorIndex(palette, nMaxColors, pixel) {
		var k = 0;
		var r = (pixel & 0xff),
		g = (pixel >>> 8) & 0xff,
		b = (pixel >>> 16) & 0xff,
		a = (pixel >>> 24) & 0xff;

		var closest = closestMap[pixel];
		if (closest == null) {		
			closest = [];
			closest[2] = closest[3] = 1e100;
			var lab1 = getLab(a, r, g, b);

			for (; k < nMaxColors; ++k) {
				var r2 = (palette[k] & 0xff),
				g2 = (palette[k] >>> 8) & 0xff,
				b2 = (palette[k] >>> 16) & 0xff,
				a2 = (palette[k] >>> 24) & 0xff;
				var lab2 = getLab(a2, r2, g2, b2);
					
				closest[4] = Math.abs(lab2.alpha - lab1.alpha) + Math.abs(lab2.L - lab1.L) + Math.abs(lab2.A - lab1.A) + Math.abs(lab2.B - lab1.B);
				if (closest[4] < closest[2]) {
					closest[1] = closest[0];
					closest[3] = closest[2];
					closest[0] = k;
					closest[2] = closest[4];
				}
				else if (closest[4] < closest[3])
				{
					closest[1] = k;
					closest[3] = closest[4];
				}
			}

			if (closest[3] == 1e100)
				closest[2] = 0;
		}

		if (closest[2] == 0 || (Math.floor(Math.random() * 32769) % (closest[3] + closest[2])) <= closest[3])
			k = closest[0];
		else
			k = closest[1];

		closestMap[pixel] = closest;
		return k;
	}
	
	function CalcDitherPixel(a, r, g, b, clamp, rowerr, cursor, noBias)
	{
		var ditherPixel = [];
		if (noBias) {
			ditherPixel[0] = clamp[((rowerr[cursor] + 0x1008) >> 4) + r];
			ditherPixel[1] = clamp[((rowerr[cursor + 1] + 0x1008) >> 4) + g];
			ditherPixel[2] = clamp[((rowerr[cursor + 2] + 0x1008) >> 4) + b];
			ditherPixel[3] = clamp[((rowerr[cursor + 3] + 0x1008) >> 4) + a];
			return ditherPixel;
		}

		ditherPixel[0] = clamp[((rowerr[cursor] + 0x2010) >> 5) + r];
		ditherPixel[1] = clamp[((rowerr[cursor + 1] + 0x1008) >> 4) + g];
		ditherPixel[2] = clamp[((rowerr[cursor + 2] + 0x2010) >> 5) + b];
		ditherPixel[3] = a;
		return ditherPixel;
	}
	
	PnnLABQuant.prototype.quantize_image = function quantize_image(pixels, nMaxColors, width, height, dither) {
		var qPixels = nMaxColors > 256 ? new Uint16Array(pixels.length) : new Uint8Array(pixels.length);
		var pixelIndex = 0;
		if (dither) {
			const DJ = 4, BLOCK_SIZE = 256, DITHER_MAX = 16;
			var err_len = (width + 2) * DJ;
			var clamp = new Uint32Array(DJ * BLOCK_SIZE);
			var limtb = new Uint32Array(2 * BLOCK_SIZE);

			for (var i = 0; i < BLOCK_SIZE; ++i) {
				clamp[i] = 0;
				clamp[i + BLOCK_SIZE] = i;
				clamp[i + BLOCK_SIZE * 2] = 0xff;
				clamp[i + BLOCK_SIZE * 3] = 0xff;

				limtb[i] = -DITHER_MAX;
				limtb[i + BLOCK_SIZE] = DITHER_MAX;
			}
			for (var i = -DITHER_MAX; i <= DITHER_MAX; ++i)
				limtb[i + BLOCK_SIZE] = i;

			var noBias = this.hasSemiTransparency || nMaxColors < 64;
			var dir = 1;
			var row0 = new Uint32Array(err_len);
			var row1 = new Uint32Array(err_len);
			for (var i = 0; i < height; ++i) {
				if (dir < 0)
					pixelIndex += width - 1;					

				var cursor0 = DJ, cursor1 = width * DJ;
				row1[cursor1] = row1[cursor1 + 1] = row1[cursor1 + 2] = row1[cursor1 + 3] = 0;
				for (var j = 0; j < width; ++j) {
					var r = (pixels[pixelIndex] & 0xff),
					g = (pixels[pixelIndex] >>> 8) & 0xff,
					b = (pixels[pixelIndex] >>> 16) & 0xff,
					a = (pixels[pixelIndex] >>> 24) & 0xff;

					var ditherPixel = CalcDitherPixel(a, r, g, b, clamp, row0, cursor0, noBias);
					var r_pix = ditherPixel[0];
					var g_pix = ditherPixel[1];
					var b_pix = ditherPixel[2];
					var a_pix = ditherPixel[3];

					var c1 = (a_pix << 24) | (b_pix << 16) | (g_pix <<  8) | r_pix;
					qPixels[pixelIndex] = noBias ? nearestColorIndex(this.palette, nMaxColors, c1) : closestColorIndex(this.palette, nMaxColors, c1);

					var c2 = this.palette[qPixels[pixelIndex]];
					var r2 = (c2 & 0xff),
					g2 = (c2 >>> 8) & 0xff,
					b2 = (c2 >>> 16) & 0xff,
					a2 = (c2 >>> 24) & 0xff;

					r_pix = limtb[r_pix - r2 + BLOCK_SIZE];
					g_pix = limtb[g_pix - g2 + BLOCK_SIZE];
					b_pix = limtb[b_pix - b2 + BLOCK_SIZE];
					a_pix = limtb[a_pix - a2 + BLOCK_SIZE];

					var k = r_pix * 2;
					row1[cursor1 - DJ] = r_pix;
					row1[cursor1 + DJ] += (r_pix += k);
					row1[cursor1] += (r_pix += k);
					row0[cursor0 + DJ] += (r_pix += k);

					k = g_pix * 2;
					row1[cursor1 + 1 - DJ] = g_pix;
					row1[cursor1 + 1 + DJ] += (g_pix += k);
					row1[cursor1 + 1] += (g_pix += k);
					row0[cursor0 + 1 + DJ] += (g_pix += k);

					k = b_pix * 2;
					row1[cursor1 + 2 - DJ] = b_pix;
					row1[cursor1 + 2 + DJ] += (b_pix += k);
					row1[cursor1 + 2] += (b_pix += k);
					row0[cursor0 + 2 + DJ] += (b_pix += k);

					k = a_pix * 2;
					row1[cursor1 + 3 - DJ] = a_pix;
					row1[cursor1 + 3 + DJ] += (a_pix += k);
					row1[cursor1 + 3] += (a_pix += k);
					row0[cursor0 + 3 + DJ] += (a_pix += k);

					cursor0 += DJ;
					cursor1 -= DJ;
					pixelIndex += dir;
				}
				if ((i % 2) == 1)
					pixelIndex += width + 1;

				dir *= -1;
				var temp = row0; row0 = row1; row1 = temp;
			}
			
			this.qPixels = qPixels;
			return this.qPixels;
		}

		if (this.m_transparentPixelIndex >= 0 || nMaxColors < 64) {
			for (var i = 0; i < qPixels.length; ++i)
				qPixels[i] = nearestColorIndex(this.palette, nMaxColors, pixels[i]);
		}
		else {
			for (var i = 0; i < qPixels.length; ++i)
				qPixels[i] = closestColorIndex(this.palette, nMaxColors, pixels[i]);
		}

		this.qPixels = qPixels;
		return this.qPixels;
	};
	
	function processImagePixels(palette, qPixels) {
		var qPixel32s = new Uint32Array(qPixels.length);
		for (var i = 0; i < qPixels.length; ++i)
			qPixel32s[i] = palette[qPixels[i]];		

		return qPixel32s;
	}
	
	PnnLABQuant.prototype.quantizeImage = function quantizeImage() {	
		var pixels = this.opts.pixels, width = this.opts.width, height = this.opts.height,
			nMaxColors = this.opts.colors, dither = this.opts.dithering;
		
		for (var i = 0; i < pixels.length; ++i) {
			var a = (pixels[i] >>> 24) & 0xff;
			
			if (a < 0xff) {
				this.hasSemiTransparency = true;
				if (a == 0)
				{
					this.m_transparentPixelIndex = i;
					this.m_transparentColor = pixels[i];
				}
			}
		}

		if (this.hasSemiTransparency)
			PR = PG = PB = 1;

		this.palette = new Uint32Array(nMaxColors);
		if (nMaxColors > 2)
			this.pnnquan(pixels, nMaxColors, 1);
		else {
			if (this.m_transparentPixelIndex >= 0) {
				this.palette[0] = 0;
				this.palette[1] = (0xff << 24);
			}
			else {
				this.palette[0] = (0xff << 24);
				this.palette[1] = 0xffffffff;
			}
		}

		this.quantize_image(pixels, nMaxColors, width, height, dither);
		if (this.m_transparentPixelIndex >= 0) {
			var k = this.qPixels[this.m_transparentPixelIndex];
			if (nMaxColors > 2)
				this.palette[k] = this.m_transparentColor;
			else if (this.palette[k] != this.m_transparentColor) {
				var temp = this.palette[0];
				this.palette[0] = this.palette[1];
				this.palette[1] = temp;
			}
		}
		pixelMap = [];
		closestMap = [];
		nearestMap = [];

		return processImagePixels(this.palette, this.qPixels);
	};
	
	PnnLABQuant.prototype.getIndexedPixels = function getIndexedPixels() {
		return this.qPixels;
	};
	
	PnnLABQuant.prototype.getPalette = function getPalette() {
		return this.palette.buffer;
	};
	
	PnnLABQuant.prototype.getImgType = function getImgType() {
		return this.opts.colors > 256 || this.hasSemiTransparency ? "image/png" : "image/gif";
	};
	
	PnnLABQuant.prototype.getTransparentIndex = function getTransparentIndex() {
		return this.m_transparentPixelIndex;
	};

	// expose
	this.PnnLABQuant = PnnLABQuant;

	// expose to commonJS
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = PnnLABQuant;
	}

}).call(this);