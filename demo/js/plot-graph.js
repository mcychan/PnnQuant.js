function funGraph(ctx, axes, func, color, thick) {
	var xx, yy, dx = 1, x0 = axes.x0, y0 = axes.y0, scale = axes.scale;
	var iMax = Math.round((ctx.canvas.width - x0) / dx);
	var iMin = axes.doNegativeX ? Math.round(-x0 / dx) : 0;
	ctx.beginPath();
	ctx.lineWidth = thick;
	ctx.strokeStyle = color;

	for (var i=iMin; i<=iMax; ++i) {		
		xx = dx * i;
		yy = scale * func(xx / scale);
		if (i == iMin)
			ctx.moveTo(x0 + xx, y0 - yy);
		else
			ctx.lineTo(x0 + xx, y0 - yy);
	}
	ctx.stroke();
}

function invFunGraph(ctx, axes, func, color, thick) {
	var xx, yy, dy = 1, x0 = axes.x0, y0 = axes.y0, scale = axes.scale;
	var iMax = Math.round((ctx.canvas.height - y0) / dy);
	var iMin = axes.doNegativeX ? Math.round(-y0 / dy) : 0;
	ctx.beginPath();
	ctx.lineWidth = thick;
	ctx.strokeStyle = color;

	for (var i=iMin; i<=iMax; ++i) {		
		yy = dy * i;
		xx = scale * func(yy / scale);
		if (i == iMin)
			ctx.moveTo(x0 + xx, y0 - yy);
		else
			ctx.lineTo(x0 + xx, y0 - yy);
	}
	ctx.stroke();
}

function showAxes(ctx, axes) {
	var x0 = axes.x0, w = ctx.canvas.width;
	var y0 = axes.y0, h = ctx.canvas.height;
	var xmin = axes.doNegativeX ? 0 : x0;	

	ctx.beginPath();
	ctx.strokeStyle = "rgb(128,128,128)"; 
	ctx.moveTo(xmin, y0);
	ctx.lineTo(w, y0);  // X axis
	ctx.moveTo(x0, 0);
	ctx.lineTo(x0, h);  // Y axis
	ctx.stroke();
	
	// Draw the Y value texts
    for(var i = 0, j = 200; i < h; i += 50, j-= 50) {
		if(j == 0)
			continue;
		ctx.fillText(j / 10, x0 + 8, i - 18);
	}
	
	// Draw the X value texts	
	for(var i = 0; i < w; i += 50) {
		var left = i - 20;
		if(i == 200)
			left += 9;
		ctx.fillText((i - 200) / 10, left, y0 + 9);
	}
}

function draw() {
	var canvas = document.getElementById("canvas");
	if (null == canvas || !canvas.getContext)
		return;

	axes = {};
	ctx = canvas.getContext("2d");
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	axes.x0 = .5 + .5 * canvas.width;  // x0 pixels from left to x=0
	axes.y0 = .5 + .5 * canvas.height; // y0 pixels from top to y=0
	axes.scale = 10;                 // 10 pixels from x=0 to x=1
	axes.doNegativeX = true;

	showAxes(ctx, axes);
}
