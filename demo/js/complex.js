function Complex(x, y) {
    this.re = x;
    this.im = y;
		 
    Complex.prototype.toString = function(){
		if(this.im == 0)
			return this.re;
		return this.re + ((this.im > 0) ? ' + ' + this.im : ' - ' + Math.abs(this.im)) + 'i';
    }

    Complex.prototype.magnitude = function(){
		return Math.sqrt(this.re * this.re + this.im * this.im);
	}
    Complex.prototype.add = function(c1){
		if (!(c1 instanceof Complex))
			return new Complex(this.re + c1, this.im);
		if(this.im == 0 && c1.im == 0)
			return new Complex(this.re + c1.re, 0);
		return new Complex(this.re + c1.re,this.im + c1.im);
	}
    Complex.prototype.sub = function(c1){
		if (!(c1 instanceof Complex))
			return new Complex(this.re - c1, this.im);
		if(this.im == 0 && c1.im == 0)
			return new Complex(this.re - c1.re, 0);
		return new Complex(this.re - c1.re,this.im - c1.im);
	}
    Complex.prototype.mult = function(c1){
		if (!(c1 instanceof Complex))
			c1 = new Complex(c1, 0);
		if(this.im == 0 && c1.im == 0)
			return new Complex(this.re * c1.re, 0);
		return new Complex(this.re * c1.re - this.im * c1.im, this.re * c1.im + this.im * c1.re);
	}
    Complex.prototype.div = function(c1){
		if (!(c1 instanceof Complex))
			c1 = new Complex(c1, 0);
		if(this.im == 0 && c1.im == 0)
			return new Complex(this.re / c1.re, 0);
        var squares = this.re * this.re - this.im * this.im;
        return new Complex(this.re / squares, -this.im / squares);
    }
}