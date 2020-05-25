var cfg_edited = false;

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

function quantizeImage(result, width) {				
	var $redu = $("#redu");
	$redu.html("<h4>Quantized</h4>");	

	var	ican = drawPixels(result.img8, width);
	$redu.append(ican);
	$("#redu h4").css("width", ($redu[0].scrollWidth - 10) + "px");
	
	var pal = new Uint32Array(result.pal8);
	var $palt = $("#palt");
	var maxWidth = $palt.width();
	var cols = 32;
	
	var colorCells = drawPixels(pal, pal.length, maxWidth, $palt.height(), cols);	
	$palt.html(colorCells);
}

function doProcess(ti, opts) {	
	if(typeof Worker !== "undefined") {			
		var w = new Worker("./js/worker.js");
		w.postMessage(opts);
		w.onmessage = function(e) {
			ti.mark("reduced -> DOM", function() {
				quantizeImage(e.data, opts.width);
				
				$("#btn_upd").prop("disabled", false).text("Update");
			});
		}
	}
	else {
		setTimeout(function(){
			ti.mark("reduced -> DOM", function() {
				var	quant = opts.isHQ ? new PnnLABQuant(opts) : new PnnQuant(opts);
				quantizeImage({ img8: quant.quantizeImage(), pal8: quant.getPalette() }, opts.width);
				
				$("#btn_upd").prop("disabled", false).text("Update");
			});
		}, 0);
	}
}

function readImageData(img, opts) {
	var can = document.createElement("canvas");
	can.width = img.naturalWidth | img.width;
	can.height = img.naturalHeight | img.height;
	var ctx = can.getContext('2d');
	ctx.drawImage(img, 0, 0);
				
	try {
		var imgd = ctx.getImageData(0,0, can.width, can.height);
		opts.pixels = new Uint32Array(imgd.data.buffer);
		opts.width = can.width;
		opts.height = can.height;		
	} catch(err) {
		alert(err);
		throw err;
	}	
}

function process(imgUrl) {		
	$("#btn_upd").prop("disabled", true).text("Please wait...");
	var ti = new Timer();
	ti.start();	
	ti.mark("image(s) loaded");
	var $orig = $("#orig");
	$orig.html("<h4>Original</h4>");
	
	var img = document.createElement("img");
	img.addEventListener("load", function() {
		var opts = getOpts(id);
		opts.isHQ = $("#radHQ").is(":checked");
		
		ti.start();
		
		$("#orig h4").css("width", ($orig[0].scrollWidth - 10) + "px").show();
		readImageData(img, opts);
		doProcess(ti, opts);
	}, false);
	
	var id = baseName(imgUrl)[0];
	img.src = imgUrl;
	ti.mark("'" + id + "' -> DOM", function() {
		$orig.append(img);			
		img.crossOrigin = '';			
	});	
}

function dragLeave(ev) {
	$(ev.target).css("border", "");
}

function allowDrop(ev) {
	ev.stopPropagation();
	ev.preventDefault();
	
	$(ev.target).css("border", "4px dashed silver");
}

function createImage(id, imgUrl, ev) {
	var ti = new Timer();
	ti.start();	
	ti.mark("image(s) loaded");
	var $orig = $("#orig");
	$orig.html("<h4>Original</h4>");	
	
	var opts = getOpts(id);
	opts.isHQ = $("#radHQ").is(":checked");
	
	ti.start();			
	var img = document.createElement("img");	
	
	ti.mark("'" + id + "' -> DOM", function() {
		img.crossOrigin = '';
		$orig.append(img);
		img.addEventListener("load", function() {
			$("#orig h4").css("width", ($orig[0].scrollWidth - 10) + "px").show();		
			readImageData(img, opts);
			doProcess(ti, opts);
		}, false);
		
		// convert image file to base64 string
		img.src = imgUrl;		
		
		if(ev)
			dragLeave(ev);
	});
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
		var imgUrl = srcSet.length > 0 ? srcSet.attr("srcset").split(",").pop().trim().split(" ")[0] : imgSrc;
		process(imgUrl);
		dragLeave(ev);
		return;
	}	

	imgUrl = imgUrl.replace("http:", location.protocol);	
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
		$("#btn_upd").prop("disabled", true).text("Please wait...");
		loadImage(file.name, file, ev);
	}
}

/**
 * This handler retrieves the images from the clipboard as a base64 string
 * 
 * @param pasteEvent 
 */
function retrieveImageFromClipboardAsBase64(pasteEvent){
	var clipboardData = pasteEvent.clipboardData || window.clipboardData || pasteEvent.originalEvent.clipboardData;
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

        items[i].getAsString(function(imgUrl) {
			if(/<.+>/g.exec(imgUrl)) {
				var domContext = $('<div>').append(imgUrl);
				var hyperlink = $(domContext).find("img");
				if(hyperlink)
					imgUrl = hyperlink.attr("srcset") ? hyperlink.attr("srcset").split(",").pop().trim().split(" ")[0] : hyperlink.prop("src");
				else {
					hyperlink = $(domContext).find("a");
					imgUrl = hyperlink.prop("href");
				}
			}
			
			if(imgUrl.trim() != "")
				download(imgUrl, null);				
		});
    }
}

$(document).on("click", "img.th", function() {
	if(!$("#btn_upd").is(":disabled")) {
		var id = baseName(this.src)[0];

		var imgUrl = $(this).attr("srcset").split(",").pop().trim().split(" ")[0];

		process(imgUrl);
	}
}).on("click", "#btn_upd", function(){
	
	$("#redu").empty();
	var imgUrl = $("#orig img").prop("src");
	process(imgUrl);

}).on("change", "input, textarea, select", function() {
	cfg_edited = true;
}).ready(function(){
	$("body").on("paste", retrieveImageFromClipboardAsBase64);
	$("img.th").on("dragstart", dragStart);
	process("img/SE5x9.jpg");
});