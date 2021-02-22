jQuery.getImgs = function(srcs, fn) {
	var jqry = this,
		dfds = [],
		prms = [];

	jqry.each(srcs, function(i, src) {
		var img = new Image(),
			dfd = jqry.Deferred();

		dfds.push(dfd);
		prms.push(dfd.promise());

		img.onload = function() {
			dfd.resolve(this);
		};

		img.src = src;
	});

	jqry.when.apply(jqry, prms).done(fn);
};

function typeOf(val) {
	return Object.prototype.toString.call(val).slice(8,-1);
}

function drawPalette(idxi32, width, maxWidth, maxHeight, cols) {
	if(!maxWidth)
		maxWidth = width;

	if(cols > idxi32.length)
		cols = idxi32.length;
	var rows = Math.floor(idxi32.length / cols);
	var ratioX = Math.floor(100.0 / cols);
	var ratioY = Math.floor(100.0 / rows);
	if((ratioY * maxHeight) > (ratioX * maxWidth))
		ratioY = ratioX * maxWidth / maxHeight;
	
	var divContent = "";
	for(var k = 0; k < idxi32.length; ++k) {
		var r = (idxi32[k] & 0xff),
			g = (idxi32[k] >>> 8) & 0xff,
			b = (idxi32[k] >>> 16) & 0xff,
			a = (idxi32[k] >>> 24) & 0xff;
		divContent += "<div style='background-color:rgba(" + r + ", " + g + ", " + b + ", " + a / 255.0 + "); float: left; ";
		divContent += "width: " + ratioX + "%; height: " + ratioY + "%;'></div>";		
	}
	return divContent;
}

(function() {
	var clas = "autosize";

	function updSize() {this.size = this.value.length;}

	// use for keydown/keyup NOT keypress
	function isCharKey(keycode) {
		var k = keycode;
		// ref1: http://www.javascripter.net/faq/keycodes.htm
		// ref2: http://www.asquare.net/javascript/tests/KeyCode.html
		// in order of frequency
		return (
			(k >= 65 && k <= 90) ||		// 65-90 (alpha)
			(k == 32) ||				// space
			(k >= 48 && k <= 61) ||		// 48-57 (nums) + 58 (unused?) + 59 (FF/Opera ; :) + 60 (unused?) + 61 (Opera = +)
			(k >= 186 && k <= 192) ||	// 186-192 (webkit/ie ; : = + - _) overlaps 188-192
			(k >= 219 && k <= 222) ||	// 219-222 (symb)
			(k >= 96 && k <= 111) ||	// 96-111 (numpad * + - . /) all but opera + (FF 107 = + and 109 - _)
			(window.opera && (k == 42 || k == 43 || k == 45 || k == 47))    // (Opera numpad * + - /) (78 . is covered by other checks)
		);
	}

	var sel = ":text." + clas;

	$(document).on("keydown", sel, function(e) {
		var rng = this.selectionEnd - this.selectionStart,
			k = e.keyCode,
			len = this.value.length;

		if (!isCharKey(k)) {
			if ((k == 8 && (this.selectionStart > 0 || rng)) || (k == 46 && this.selectionStart < len))
				this.size = Math.max(1, len - (rng || 1));
		}
		else {
			var sz = len - rng;

			if (!e.ctrlKey/* && !e.altKey*/)
				this.size = sz + 1;
			else if (k == 88)										// x cut
				this.size = sz;
			else if (k == 86 || k == 86 || k == 89 || k == 90)		// v paste, y redo, z undo
				$(this).one("keyup", updSize);
		}
	}).on("change", sel, updSize);;

	$(function(){
		$(sel).each(updSize);
	});
})();