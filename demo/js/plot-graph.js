function funGraph(ctx, axes, func, color, thick) {
	var xx, yy, dx = 10, x0 = axes.x0, y0 = axes.y0, scale = axes.scale;
	var iMax = Math.round((ctx.canvas.width-x0)/dx);
	var iMin = axes.doNegativeX ? Math.round(-x0/dx) : 0;
	ctx.beginPath();
	ctx.lineWidth = thick;
	ctx.strokeStyle = color;

	for (var i=iMin; i<=iMax; ++i) {
		xx = dx * i;
		yy = scale * func(xx / scale);
		if (i==iMin)
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
}

function draw() {
	var canvas = document.getElementById("canvas");
	if (null==canvas || !canvas.getContext)
		return;

	axes = {};
	ctx = canvas.getContext("2d");
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	axes.x0 = .5 + .5 * canvas.width;  // x0 pixels from left to x=0
	axes.y0 = .5 + .5 * canvas.height; // y0 pixels from top to y=0
	axes.scale = 100;                 // 10 pixels from x=0 to x=1
	axes.doNegativeX = true;

	showAxes(ctx, axes);
}
