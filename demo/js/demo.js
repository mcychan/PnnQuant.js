var cfg_edited = false;
var worker = (typeof Worker !== "undefined") ? new Worker("./js/worker.js") : null;

var dflt_opts = {
	colors: 256,
	dithering: true,
};

function baseName(src) {
	return src.split("/").pop().split(".");
}

function getOpts(id) {
	if (cfg_edited) {
		var opts = {};

		for (var i in dflt_opts) {
			var $el = $("#" + i),
				typ = $el.attr("type"),
				val = $el.val(),
				num = parseFloat(val);

			opts[i] = typ == "checkbox" ? $el.prop("checked") : isNaN(num) ? val : num;
		}

		return $.extend({}, dflt_opts, opts);
	}
	else
		var opts = dflt_opts;

	for (var i in dflt_opts) {
		var el = $("#" + i).val(opts[i])[0];
		el && (el.size = el.value.length);
	}

	return opts;
}

if(!Uint8Array.prototype.slice){
	Uint8Array.prototype.slice = function(){
		return new Uint8Array(this).subarray(this.arguments);
	}
};

function toRGBPalette(palette) {
	var rgbPalette = [];
	for(var k=0; k < palette.length; ++k) {
		var r = (palette[k] & 0xff),
			g = (palette[k] >>> 8) & 0xff,
			b = (palette[k] >>> 16) & 0xff;
		rgbPalette.push(r << 16 | g << 8 | b);
	}
	return rgbPalette;
}

function quantizeImage(gl, result, width) {				
	var $redu = $("#redu");
	var img = $redu.find("img")[0];
	if(!img) {
		$redu.html("<h4>Quantized</h4>");	
		
		var img = document.createElement("img");
		img.onload = function() {			
			$("#redu h4").css("width", ((img.naturalWidth | img.width) - 10) + "px");
		};
		$redu.append(img);
	}	
	img.width = width, img.height = Math.ceil(result.img8.length / width);	
		
	var pal = new Uint32Array(result.pal8);
	var can = document.createElement("canvas"),
	ctx = can.getContext("2d");

	can.width = width;
	can.height = img.height;

	ctx.imageSmoothingEnabled = ctx.imageSmoothingEnabled = ctx.webkitImageSmoothingEnabled = ctx.msImageSmoothingEnabled = false;

	var imgd = ctx.createImageData(can.width, can.height);
	var buf8 = new Uint8ClampedArray(result.img8.buffer);
	imgd.data.set(buf8);

	ctx.putImageData(imgd, 0, 0);
	img.src = can.toDataURL(result.type);
	
	var $palt = $("#palt");	
	var colorCells = drawPalette(pal, pal.length, $palt.width(), $palt.height(), 32);	
	$palt.html(colorCells);
		
	if("image/gif" == result.type) {
		try {
			var buf = new Uint8Array(width * img.height + 1000);
			var gf = new GifWriter(buf, width, img.height);
			var opts = {palette: toRGBPalette(pal)};
			if(result.transparent > -1)
				opts.transparent = result.transparent;
			gf.addFrame(0, 0, width, img.height, result.indexedPixels, opts);
			var data = buf.slice(0, gf.end());
			var reader = new FileReader();
			reader.onloadend = function() {					
				img.src = reader.result;
			};

			reader.readAsDataURL(new Blob([data], {type: result.type}));
			img.onerror = function () { 
				img.src = can.toDataURL(result.type);
			};
		}
		catch(err) {
			console.error(err);
		}
	}	
}

function doProcess(gl, ti, opts) {	
	if(worker != null)			
		worker.postMessage(opts);		
	else {
		setTimeout(function(){
			ti.mark("reduced -> DOM", function() {
				var	quant = opts.isHQ ? new PnnLABQuant(opts) : new PnnQuant(opts);
				quantizeImage(gl, { img8: quant.quantizeImage(), pal8: quant.getPalette(), indexedPixels: quant.getIndexedPixels(),
					transparent: quant.getTransparentIndex(), type: quant.getImgType() }, opts.width);
				
				$("#btn_upd").removeAttr("disabled").text("Update");
				$("#orig").removeAttr("disabled");
			});
		}, 0);
	}
}

function webgl_detect() {
    var canvas = document.createElement("canvas");
	if(canvas && canvas.getContext) {
        return canvas.getContext('webgl2') || canvas.getContext('webgl') ||
			canvas.getContext('webkit-3d') ||
			canvas.getContext('experimenal-webgl') ||
			canvas.getContext('moz-3d');
    }

    // WebGL not supported
    return false;
}

function readImageData(img, gl, opts) {
	var can = document.createElement("canvas");
	can.width = img.naturalWidth | img.width;
	can.height = img.naturalHeight | img.height;
	if(can.width == 0 || can.height == 0)
		return;
	
	var ctx = can.getContext('2d');	
	
	try {
		if (gl) {			
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);			
			var pixels = new Uint8Array(can.width * can.height * 4);
			gl.readPixels(0, 0, can.width, can.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			opts.pixels = new Uint32Array(pixels.buffer);
		}
		else {
			ctx.drawImage(img, 0, 0);
			var imgd = ctx.getImageData(0,0, can.width, can.height);
			ctx.setTransform(1, 0, 0, 1, 0.49, 0.49); // offset 0.49 pixel to handle sub pixeling
			opts.pixels = new Uint32Array(imgd.data.buffer);
		}	
		
		opts.width = can.width;
		opts.height = can.height;		
	} catch(err) {
		alert(err);
		throw err;
	}	
}

function dragLeave(ev) {
	if(ev)
		$(ev.target).css("border", "");
	else
		$("#orig img").css("border", "");
}

function allowDrop(ev) {
	ev.stopPropagation();
	ev.preventDefault();
	
	$(ev.target).css("border", "4px dashed silver");
}

function createImage(id, imgUrl, ev) {	
	var $orig = $("#orig");
	var img = $orig.find("img")[0];
	if(!img) {
		var ti = new Timer();
		ti.start();
		
		$orig.html("<h4>Original</h4>");
		var gl = webgl_detect();
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
		
		if(worker != null) {			
			worker.onmessage = function(e) {
				ti.mark("reduced -> DOM", function() {
					var img = $("#orig").find("img")[0];
					quantizeImage(gl, e.data, img.naturalWidth | img.width);
					
					$("#btn_upd").removeAttr("disabled").text("Update");
					$("#orig").removeAttr("disabled");
				});
			}
		}
		
		img = document.createElement("img");
		img.onload = function() {
			if(!$orig.attr("disabled")) {	
				ti.mark("image loaded");
				$orig.attr("disabled", true);
				var id = this.name;
				var opts = getOpts(id);
				opts.isHQ = $("#radHQ").is(":checked");
				
				ti.start();			
				$("#orig h4").css("width", ((img.naturalWidth | img.width) - 10) + "px");
				ti.mark("'" + id + "' -> DOM", function() {
					$orig.append(img);			
					img.crossOrigin = '';			
				});	
		
				readImageData(img, gl, opts);
				doProcess(gl, ti, opts);
				dragLeave(ev);				
			}			
		};
	}
	
	img.name = id;
	img.src = imgUrl;	
}

function process(imgUrl) {		
	$("#btn_upd").attr("disabled", true).text("Please wait...");
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

function download(imgUrl, ev) {
	if(!isExternal(imgUrl)) {
		var rootUrl = location.href.substr(0, location.href.lastIndexOf("/") + 1);
		var imgSrc = imgUrl.replace(rootUrl, "");
		var srcSet = $("img[srcset][src$='" + imgSrc + "']");
		imgUrl = srcSet.length > 0 ? srcSet.attr("srcset").split(",").pop().trim().split(" ")[0] : imgSrc;
		process(imgUrl);
		dragLeave(ev);
		return;
	}

	imgUrl = imgUrl.replace("http:", location.protocol);
	
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

	var xhr = new XMLHttpRequest();	
	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4) {
			if(xhr.status == 200)
				loadImage(id, new Blob([xhr.response]), ev);					
			else {
				dragLeave(ev);
				if($("#wrapfabtest").height() <= 0)
					alert("AdBlock Detected");
			}					
		}				
	};
	xhr.open('GET', imgUrl);
	xhr.responseType = "arraybuffer";
	xhr.send();
}

function dragStart(evt) {
	var ev = evt.originalEvent;
	ev.dataTransfer.files = [];
	ev.dataTransfer.setData("text", ev.target.src);
}

function drop(ev) {
	if($("#btn_upd").is(":disabled"))
		return;
	
	ev.stopPropagation();
	ev.preventDefault();

	var dt = ev.dataTransfer;
	
	if(dt.files.length <= 0) {
		var imgUrl = dt.getData("text");
		try {
			var dropContext = $("<div>").append(dt.getData("text/html"));
			var img = $(dropContext).find("img")[0];
			if(img instanceof HTMLImageElement)
				imgUrl = img.srcset ? img.srcset.split(",").pop().trim().split(" ")[0] : img.src;
		}
		catch(err) {
		}
		
		download(imgUrl, ev);
		return;
	}
	
	var file = dt.files[0];
	var imageType = /image.*/;

	if (file.type.match(imageType)) {
		$("#btn_upd").attr("disabled", true).text("Please wait...");
		loadImage(file.name, file, ev);
	}
}

function pasteUrl(imgUrl) {
	if(/<.+>/g.exec(imgUrl)) {
		var domContext = $('<div>').append(imgUrl);
		var hyperlink = $(domContext).find("img");
		if(hyperlink.length > 0)
			imgUrl = hyperlink.attr("srcset") ? hyperlink.attr("srcset").split(",").pop().trim().split(" ")[0] : hyperlink.prop("src");
		else {
			hyperlink = $(domContext).find("a");
			if(hyperlink.length > 0)
				imgUrl = hyperlink.prop("href");
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
	if(!clipboardData || $("#btn_upd").is(":disabled"))
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
	if($("#btn_upd").is(":disabled"))
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

$(document).on("click", "img.th", function() {
	if(!$("#btn_upd").is(":disabled")) {
		var id = baseName(this.src)[0];

		var imgUrl = $(this).attr("srcset").split(",").pop().trim().split(" ")[0];

		process(imgUrl);
	}
}).on("click", "#btn_upd", function(){	
	var imgUrl = $("#orig img").prop("src");
	process(imgUrl);
}).on("change", "input, textarea, select", function() {
	cfg_edited = true;
}).ready(function(){
	if(window.clipboardData)
		document.body.addEventListener("keyup", keyBoardListener);
	else
		$("body").on("paste", retrieveImageFromClipboardAsBase64);
	$("#orig").click(function() {
		$(this).next().change(function(ev) {
			$("#btn_upd").attr("disabled", true).text("Please wait...");
			var id = baseName(this.files[0].name)[0];
			loadImage(id, this.files[0], ev);
		}).trigger("click");
	});
	$("img.th").css("z-index", "2").on("dragstart", dragStart)
	$("img.th, #readme").hover(function() {
		$("#footer").css("z-index", $("#btn_upd").is(":disabled") ? "1" : "-1");
	}, function() {
		$("#footer").css("z-index", "1");
	});
	process("img/SE5x9.jpg");
});