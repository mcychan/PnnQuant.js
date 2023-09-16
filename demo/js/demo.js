var worker = (typeof Worker !== "undefined") ? new Worker("./js/worker.js") : null;
var gl = webgl_detect();
var pngOnly = location.search.toLowerCase().indexOf('png') > -1;

const eventBus = {
	on(event, callback) {
		document.addEventListener(event, (e) => callback(e.detail));
	},
	dispatch(event, data) {
		document.dispatchEvent(new CustomEvent(event, { detail: data }));
	},
	remove(event, callback) {
		document.removeEventListener(event, callback);
	},
};

function baseName(src) {
	return src.split("/").pop().split(".");
}

if(!Uint8Array.prototype.slice){
	Uint8Array.prototype.slice = function(){
		return new Uint8Array(this).subarray(this.arguments);
	}
};

function isPowerOf2(value)
{
	return value && !(value & (value - 1));
}

function pow2ceil(v) {
	var p = 2;
	while (v >>= 1) {
		p <<= 1;
	}
	return p;
}

function toRGBPalette(palette) {
	var rgbPalette = [];
	var k = 0;
	for(; k < palette.length; ++k) {
		var r = (palette[k] & 0xff),
			g = (palette[k] >>> 8) & 0xff,
			b = (palette[k] >>> 16) & 0xff;
		rgbPalette.push(r << 16 | g << 8 | b);
	}
	
	if(!isPowerOf2(palette.length)) {
		const ub = pow2ceil(palette.length);
		for(; k < ub; ++k)
			rgbPalette.push(0);
	}
	return rgbPalette;
}

function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function getCanvas(width, height, isSupported = true) {
	if(isSupported && typeof OffscreenCanvasRenderingContext2D === "function")
		return new OffscreenCanvas(width, height);
	
	var can = document.createElement("canvas");
	can.width = width;
	can.height = height;
	return can;
}

async function getPngUrl(width, height, pixel32s, can = null) {
	if(can == null) {
		can = getCanvas(width, height, true);
		var ctx = can.getContext("2d");
		ctx.imageSmoothingEnabled = false;
	
		var imgd = ctx.createImageData(can.width, can.height);
		imgd.data.set(new Uint8Array(pixel32s.buffer));

		ctx.putImageData(imgd, 0, 0);
	}
	if(can.toDataURL)
		return can.toDataURL();
	
	const blob = await can[can.convertToBlob ? 'convertToBlob' : 'toBlob']();
		
	return new Promise((resolve, reject) => {
		var reader = new FileReader();
		reader.onloadend = () => {
			resolve(reader.result);
		};

		reader.onerror = reject;
		reader.readAsDataURL(blob, {type: "image/png"});
	});
}

function quantizeImage(gl, result, width) {
	console.timeEnd("reduced -> DOM");
	var pal = new Uint32Array(result.pal8);	

	var height = Math.ceil(result.img8.length / width);
	
	console.time("palette");
	eventBus.dispatch("scene", {boxWidth: (width - 10) + "px", background: result.transparent < 0 ? "none" : ""});
	eventBus.dispatch("palt", {pal: pal});
		
	if(!pngOnly && "image/gif" == result.type) {
		try {
			var buf = new Uint8Array(width * height * 1.1 + 1000);
			var gf = new GifWriter(buf, width, height);
			var opts = {palette: toRGBPalette(pal)};
			if(result.transparent > -1)
				opts.transparent = result.transparent;
			gf.addFrame(0, 0, width, height, result.indexedPixels, opts);
			var data = buf.slice(0, gf.end());
			var reader = new FileReader();
			reader.onloadend = () => {
				eventBus.dispatch("scene", {imgBase64: reader.result, width: width, height: height});
			};

			reader.readAsDataURL(new Blob([data], {type: result.type}));
			document.querySelector("#redu img").onerror = () => {
				getPngUrl(width, height, result.img8).then(pngUrl => {
					eventBus.dispatch("scene", {imgBase64: pngUrl, width: width, height: height});
				});
			};
		}
		catch(err) {
			getPngUrl(width, height, result.img8).then(pngUrl => {
				eventBus.dispatch("scene", {imgBase64: pngUrl, width: width, height: height});
			});
			console.error(err);
		}
	}
	else
		getPngUrl(width, height, result.img8).then(pngUrl => {
			eventBus.dispatch("scene", {imgBase64: pngUrl, width: width, height: height});
		});
	console.timeEnd("palette");
}

function allowChange($orig) {
	eventBus.dispatch("app", {enabled: true});
	$orig.style.pointerEvents = "";
	document.querySelector("#palt").style.opacity = 1;
}

async function getResult(opts) {
	var quant = opts.isHQ ? new PnnLABQuant(opts) : new PnnQuant(opts);	
	opts.paletteOnly = true;

	const result = await quant.getResult();
	if(opts.dithering)
		return Promise.all([result, new GilbertCurve(opts).getResult()]);

	const gc = await new GilbertCurve(opts).getResult();
	return Promise.all([result, new BlueNoise(opts).getResult()]);
}

function doProcess(gl, opts) {
	if(worker != null)
		worker.postMessage(opts);
	else {
		setTimeout(async function(){
			const result = await getResult(opts);
			quantizeImage(gl, Object.assign.apply(Object, result), opts.width);
			allowChange(document.querySelector("#orig"));
		}, 0);
	}
}

function webgl_detect() {
	var canvas = getCanvas(0, 0);
	if(canvas && canvas.getContext) {
		return canvas.getContext('webgl2', {antialias: false}) || canvas.getContext('webgl', {antialias: false}) ||
			canvas.getContext('webkit-3d') ||
			canvas.getContext('experimenal-webgl') ||
			canvas.getContext('moz-3d');
	}

	// WebGL not supported
	return false;
}

function readImageData(img, gl, opts) {
	if(opts.width == 0 || opts.height == 0)
		return false;

	try {
		if (gl) {
			if (isPowerOf2(opts.width) && isPowerOf2(opts.height))
				gl.generateMipmap(gl.TEXTURE_2D);
			else {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			}
			
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			var picBuf = new ArrayBuffer(opts.width * opts.height * 4);
			gl.readPixels(0, 0, opts.width, opts.height, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(picBuf));
			opts.pixels = new Uint32Array(picBuf);
		}
		else {
			var can = getCanvas(opts.width, opts.height);
			var ctx = can.getContext('2d');

			ctx.drawImage(img, 0, 0);
			var imgd = ctx.getImageData(0,0, can.width, can.height);
			ctx.setTransform(1, 0, 0, 1, 0.49, 0.49); // offset 0.49 pixel to handle sub pixeling
			opts.pixels = new Uint32Array(imgd.data.buffer);
		}
		return true;
	} catch(err) {
		alert(err);
		throw err;
	}
	return false;
}

function drawImageScaled(img){
	if(!isExternal(img.src))
		return null;

	var maxWidth = 640, maxHeight = 512;
	var width = img.naturalWidth | img.width;
	var height = img.naturalHeight | img.height;
	if(width <= maxWidth && height <= maxHeight)
		return null;

	var ratio = Math.min(maxWidth / width, maxHeight / height);	
	var can = getCanvas(width * ratio, height * ratio, navigator.userAgent.indexOf("Firefox") < 0);
	var ctx = can.getContext('2d');

	var oc = getCanvas(can.width, can.height, navigator.userAgent.indexOf("Firefox") < 0);
	var octx = oc.getContext('2d');

	var cur = {
		width: Math.floor(width * 0.5),
		height: Math.floor(height * 0.5)
	}

	oc.width = cur.width;
	oc.height = cur.height;

	octx.drawImage(img, 0, 0, cur.width, cur.height);

	while (cur.width * 0.5 > width) {
		cur = {
			width: Math.floor(cur.width * 0.5),
			height: Math.floor(cur.height * 0.5)
		};
		octx.drawImage(oc, 0, 0, cur.width * 2, cur.height * 2, 0, 0, cur.width, cur.height);
	}

	ctx.drawImage(oc, 0, 0, cur.width, cur.height, 0, 0, can.width, can.height);
	return getPngUrl(can.width, can.height, null, can);
}

async function origLoad(opts) {
	var $orig = document.querySelector("#orig");
	if($orig.style.pointerEvents != "none") {
		eventBus.dispatch("app", {enabled: false});
		document.querySelector("#palt").style.opacity = 0;
		
		var srcImg = $orig.querySelector("img");
		var id = srcImg.name;
		console.time("'" + id + "' -> DOM");
		var srcUrl = await drawImageScaled(srcImg);
		if(srcUrl != null) {
			eventBus.dispatch("scene", {display: "none", imgUrl: srcUrl});
			return;
		}

		srcImg.style.border = "";
		$orig.style.pointerEvents = "none";
		opts.width = srcImg.naturalWidth | srcImg.width;
		opts.height = srcImg.naturalHeight | srcImg.height;
		eventBus.dispatch("scene", {boxWidth: (opts.width - 10) + "px", display: "block"});

		console.time("reduced -> DOM");
		if(worker != null) {
			worker.onmessage = function(e) {
				quantizeImage(gl, e.data, opts.width);
				allowChange(document.querySelector("#orig"));
			}
		}

		if(readImageData(srcImg, gl, opts)) {
			console.timeEnd("'" + id + "' -> DOM");
			doProcess(gl, opts);
		}
		else {
			console.timeEnd("'" + id + "' -> DOM");
			allowChange($orig);
		}
	}
}

function createImage(id, imgUrl, ev) {
	eventBus.dispatch("scene", {imgName: id, imgUrl: imgUrl});
}

function process(imgUrl) {
	eventBus.dispatch("app", {enabled: false});
	var id = baseName(imgUrl)[0];
	createImage(id, imgUrl, null);
}

function loadImage(id, blob, ev) {
	var reader = new FileReader();
	reader.onloadend = function() {
		createImage(id, reader.result, ev);
	};

	reader.readAsDataURL(blob);
}

function isExternal(url) {
	var match = url.match(/^([^:\/?#]+:)?(?:\/\/([^\/?#]*))?([^?#]+)?(\?[^#]*)?(#.*)?/);
	if (typeof match[1] === "string" && match[1].length > 0 && match[1].toLowerCase() !== location.protocol)
		return true;
	if (typeof match[2] === "string" && match[2].length > 0 && match[2].replace(new RegExp(":("+{"http:":80,"https:":443}[location.protocol]+")?$"), "") !== location.host)
		return true;
	return false;
}

async function download(imgUrl, ev) {
	if(!isExternal(imgUrl)) {
		var rootUrl = location.href.substr(0, location.href.lastIndexOf("/") + 1);
		var imgSrc = imgUrl.replace(rootUrl, "");
		var srcSet = document.querySelector("img[srcset][src$='" + imgSrc + "']");
		imgUrl = srcSet != null ? srcSet.srcset.split(",").pop().trim().split(" ")[0] : imgSrc;
		process(imgUrl);
		document.querySelector("#orig img").style.border = "";
		return;
	}

	const queryChar = imgUrl.indexOf("?") >= 0 ? "&" : "?";
	imgUrl = imgUrl + queryChar + new Date().getTime();
	
	var svgTag = "<svg ";
	var svgIndex = imgUrl.indexOf(svgTag);
	if(svgIndex > -1) {
		var svg = imgUrl.substring(svgIndex).split("\"").join("'");
		if(svg.indexOf(" xmlns=") < 0)
			svg = svg.replace(svgTag, svgTag + "xmlns='http://www.w3.org/2000/svg' ");
		imgUrl = "data:image/svg+xml;utf8," + svg;
	}	
	if(imgUrl.indexOf("data:") == 0) {
		createImage(new Date().getTime(), imgUrl, ev);
		return;
	}
	
	var id = baseName(imgUrl)[0];
	try {
		const response = await fetch(imgUrl);
		const blob = await response.blob();	
		loadImage(id, blob, ev);
	} catch (error) {
		document.querySelector("#orig img").style.border = "";
		if(document.querySelector("#wrapfabtest").offsetHeight <= 0)
			alert("AdBlock Detected");
	}
}

function pasteUrl(imgUrl) {
	if(/<.+>/g.exec(imgUrl)) {
		var domContext = document.createElement("div");
		domContext.innerHTML = imgUrl;
		var hyperlink = domContext.querySelector("img");
		if(hyperlink != null)
			imgUrl = hyperlink.srcset ? hyperlink.srcset.split(",").pop().trim().split(" ")[0] : hyperlink.src;
		else {
			hyperlink = domContext.querySelector("a");
			if(hyperlink != null)
				imgUrl = hyperlink.href;
		}
	}
	
	if(imgUrl.trim() != "")
		download(imgUrl, null);
}

/**
 * This handler retrieves the images from the clipboard as a base64 string
 * 
 * @param pasteEvent 
 */
function retrieveImageFromClipboardAsBase64(pasteEvent){
	var clipboardData = pasteEvent.clipboardData || pasteEvent.originalEvent.clipboardData;
	if(!clipboardData || document.querySelector("#btn_upd").disabled)
		return;
	
	var items = clipboardData.items;
	if(items == undefined)
		return;

	for (var i = 0; i < items.length; ++i) {
		// Skip content if not image
		if (items[i].type.indexOf("image") == -1)
			continue;
		// Retrieve image on clipboard as blob
		var blob = items[i].getAsFile();

		loadImage(new Date().getTime(), blob, null);
		return;
	}
	
	for (var i = 0; i < items.length; ++i) {
		// Skip content if not image
		if (items[i].kind != "string")
			continue;

		items[i].getAsString(pasteUrl);
	}
}

function keyBoardListener(evt) {
	if (evt.ctrlKey) {
		switch(evt.keyCode) {
			case 86: // v
				handlePaste();
				break;
		}
	}
}

function handlePaste(){
	if(document.querySelector("#btn_upd").disabled)
		return;

	var items = window.clipboardData.files;
	if (!items.length) {
		var imgUrl = window.clipboardData.getData('Text');
		pasteUrl(imgUrl);
		return;
	}

	for (var i = 0; i < items.length; ++i) {
		// Skip content if not image
		if (items[i].type.indexOf("image") == -1)
			continue;
		// Retrieve image on clipboard as blob
		var blob = items[i].getAsFile();

		loadImage(new Date().getTime(), blob, null);
		return;
	}	
}

document.addEventListener("DOMContentLoaded", function(){
	if (gl) {
		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
		
		// Make a framebuffer
		var fb = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

		var tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		// Attach the texture to the framebuffer
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
	}

	if(window.clipboardData)
		document.body.addEventListener("keyup", keyBoardListener);
	else
		document.body.onpaste = retrieveImageFromClipboardAsBase64;	
	
	document.querySelectorAll("img.th, #readme").forEach(element => {
		element.onmouseenter = function() {
			const disabled = document.querySelector("#btn_upd").disabled;
			document.querySelector("#footer").style.zIndex = disabled ? "1" : "-1";
		};
		element.onmouseleave = function() {
			document.querySelector("#footer").style.zIndex = "1";
		};
	});

	process("img/SE5x9.jpg");
});
