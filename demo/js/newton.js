	/**
	 * Number.isFinite
	 * Copyright (c) 2014 marlun78
	 * MIT License, https://gist.github.com/marlun78/bd0800cf5e8053ba9f83
	 * 
	 * Spec: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.isfinite
	 */
	if (typeof Number.isFinite !== 'function') {
		Number.isFinite = function isFinite(value) {
			// 1. If Type(number) is not Number, return false.
			if (typeof value !== 'number') {
				return false;
			}
			// 2. If number is NaN, +∞, or −∞, return false.
			if (value !== value || value === Infinity || value === -Infinity) {
				return false;
			}
			// 3. Otherwise, return true.
			return true;
		};
	}
	
	if (typeof Math.log2 !== 'function') {
		Math.log2 = function log2(value) {
			return Math.log(value) * Math.LOG2E;
		};
	}
	
	if (typeof Object.assign !== 'function') {
	  // Must be writable: true, enumerable: false, configurable: true
	  Object.defineProperty(Object, "assign", {
		value: function assign(target, varArgs) { // .length of function is 2
		  'use strict';
		  if (target === null || target === undefined) {
			throw new TypeError('Cannot convert undefined or null to object');
		  }

		  var to = Object(target);

		  for (var index = 1; index < arguments.length; index++) {
			var nextSource = arguments[index];

			if (nextSource !== null && nextSource !== undefined) {
			  for (var nextKey in nextSource) {
				// Avoid bugs when hasOwnProperty is shadowed
				if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
				  to[nextKey] = nextSource[nextKey];
				}
			  }
			}
		  }
		  return to;
		},
		writable: true,
		configurable: true
	  });
	}
	
	Math.power = function power(a, b) {
		if(a >= 0)
			return Math.pow(a, b);
			
		if(a instanceof Complex) {
			if(b > 1 && b % 1 == 0) {
				var c1 = new Complex(a.re, a.im);
				for(var i=1; i<b; ++i)
					c1 = c1.mult(a);
				return c1;
			}
		}
		var sign = (b % 2) == 0 ? 1 : -1;
		return sign * Math.pow(-a, b);
	};
	
	function x_xpa_b(x, a, b, y) {
		return x * Math.power(x + a, b) - y;
	}
	
	function d_x_xpa_b(x, a, b) {
		return Math.power(x + a, b) + b * x * Math.power(x + a, b - 1);
	}
	
	function xpa_b(x, a, b, y) {
		return Math.power(x + a, b) - y;
	}
	
	function d_xpa_b(x, a, b) {
		return b * Math.power(x + a, b - 1);
	}
	
	function newtonRoot(xn, a, b, y, f, df) {			
		var xn2;
		var maxRetryCount = 9999;
		for(var i=0; i<maxRetryCount; ++i) {
			var dy = df(xn, a, b);
			if(Math.abs(dy) < 0.00000001)
				return NaN; // give up with this seed if derivative is too low
			xn2 = xn - f(xn, a, b, y) / dy;
			if(!Number.isFinite(xn2))
				return NaN; // give up with this seed if reached NaN
			if(Math.abs(xn2 - xn) < 0.00000001)
				break;
			xn = xn2;
		}
		return (i < maxRetryCount) ? xn2 : NaN;
	}
	
	function newton(a, b, neg, y, f, df) {		
		var roots = [];
		var seeds = [-100000, -100, -1, 1, 100, 100000]; // set initial guesses here
		for(var i=0; i<seeds.length; ++i) {
			var xn = seeds[i];
			var root = newtonRoot(xn, a, b, y, f, df);
			if(!Number.isFinite(root))
				continue;
				
			if(neg) {
				var iRoot = new Complex(-a, root + a);
				if(!roots.hasOwnProperty(iRoot.toString()))
					roots[iRoot.toString()] = iRoot;
				continue;
			}
				
			if(!roots.hasOwnProperty(root.toFixed(8)))
				roots[root.toFixed(8)] = root;
		}
		return roots;
	}
	
	function show_xpa_b(a, b, y) {
		a -= 0, b-= 0, y-= 0;
		var result = "No solution.<br/>";
		rows = [];
	
		var sign = (a < 0) ? " - " : " + ";
		color = "rgb(72, " + Math.floor(Math.random() * 200) + ", 40)";
		var roots = newton(a, b, false, y, xpa_b, d_xpa_b);
		var findIRoots = (b % 2 == 0 && y != 0);
		if(findIRoots)
			roots = Object.assign({}, roots, newton(a, b, true, -y, xpa_b, d_xpa_b));
		if(Object.keys(roots).length > 0) {
			var rendered = false;
			var iRoots = {};
			for(var root in roots) {
				var xn2 = roots[root];					
				var y1 = (xn2 instanceof Complex) ? Math.power(xn2.add(a), b) : Math.power(xn2 + a, b);
							
				result = "(x" + sign + Math.abs(a) + ")";
				if(b != 1)
					result += "<sup>" + b + "</sup>";
					
				result += " = " + y + ", x = " + root;
				if(findIRoots) {
					var y2 = Math.power(-(xn2 + a), b);
					if(Math.abs(y2 - y1) < 0.00000001) {
						var iRoot = new Complex(-a, xn2 + a);	
						if(!iRoots.hasOwnProperty(iRoot.toString())) {
							var y3 = Math.power(iRoot.add(a), b);
							if(Math.abs(y3 - y) < 0.00000001) {
								iRoots[iRoot.toString()] = iRoot;
								result += " or " + iRoot;
							}
						}
					}
				}				
				result += "<br/>";
				result += "y = (" + root + sign + Math.abs(a) + ")";
				if(b != 1)
					result += "<sup>" + b + "</sup>";
				if(Math.abs(y - y1) < 0.00000001)
					y1 = y
				result += "<br/>y = " + y1 + "<br/>";
				
				if(!rendered) {
					funGraph(ctx, axes, function(x) {
						return Math.power(x + a, b);
					}, color, 1);
					rendered = true;
				}			

				rows.unshift({color: color, answer: result});
			}
			roots = Object.assign({}, roots, iRoots);
		}
		else {
			result += "(x" + sign + Math.abs(a) + ")<sup>" + b + "</sup> = " + y + "<br/>";
			rows.unshift({color: color, answer: result});
		}		
		return roots;
	}
	
	function show_x_xpa_b(a, b, y) {
		a -= 0, b-= 0, y-= 0;
		var result = "No solution.<br/>";
		rows = [];
	
		var sign = (a < 0) ? " - " : " + ";
		color = "rgb(" + Math.floor(Math.random() * 200) + ", 38, 67)";
		var roots = newton(a, b, false, y, x_xpa_b, d_x_xpa_b);
		if(Object.keys(roots).length > 0) {
			var rendered = false;
			for(var root in roots) {
				var xn2 = roots[root];
				var y1 = xn2 * Math.power(xn2 + a, b);
							
				result = "x(x" + sign + Math.abs(a) + ")";
				if(b != 1)
					result += "<sup>" + b + "</sup>";
				result += " = " + y + ", x = " + root;
				result += "<br/>";
				result += "y = " + root + " * (" + root + sign + Math.abs(a) + ")";
				if(b != 1)
					result += "<sup>" + b + "</sup>";
				if(Math.abs(y - y1) < 0.00000001)
					y1 = y
				result += "<br/>y = " + y1 + "<br/>";
				
				if(!rendered) {
					funGraph(ctx, axes, function(x) {
						return x * Math.power(x + a, b);
					}, color, 1);
					rendered = true;
				}			

				rows.unshift({color: color, answer: result});
			}
		}
		else {
			result += "x(x" + sign + Math.abs(a) + ")<sup>" + b + "</sup> = " + y + "<br/>";
			rows.unshift({color: color, answer: result});
		}
		return roots;
	}
	
	var ctx, color, axes, rows;

const React = preactCompat, ReactDOM = preactCompat;
const {useContext, useEffect, useReducer, useState} = React;

const WorkbookContext = React.createContext();

const initialState = { a: 1, b: 2, y: 48};
	
function EquationEditor() {	
	const {setWorkouts} = useContext(WorkbookContext);
		
	useEffect(() => {
		if(rows && rows.length == 0)
			draw();
	});
	
	const reducer = (state, action) => {
		switch (action.type) {
			case 'b1':
				show_xpa_b(state.a, state.b, state.y);
				setWorkouts({workouts: rows});
				return { ...state };
			case 'b2':
				show_x_xpa_b(state.a, state.b, state.y);
				setWorkouts({workouts: rows});
				return { ...state };
			case 'change':
				return { ...state, [action.id] : action.value - 0 };
			case 'clear':
				rows = [];
				setWorkouts({workouts: rows});
				return { ...state };
			default:
				throw new Error();
		}
	};

	const [state, dispatch] = useReducer(reducer, initialState);

	const onB1Click = e => dispatch({ type: 'b1' });

	const onB2Click = e => dispatch({ type: 'b2' });

	const onChange = e => {
		const {id, value} = e.currentTarget;
		dispatch({ type: 'change', id: id, value: value });
	};
	
	const onClear = e => dispatch({ type: 'clear' });

	const onKeyUp = e => {
		if(e.key === 'Enter')
			e.currentTarget.blur();
	};
	
	return React.createElement("form", {key: "form", novalidate: ""},
	[
		React.createElement("div", {style: {float: "left", width: "100%"} },
			Object.keys(state).map(key => {
				return React.createElement("div", {style: {float: "left", paddingLeft: "2ex", maxWidth: "33%"} }, 
					[
						React.createElement("span", {}, `${key}: `),
						React.createElement("input", {key: key, id: key, type: "number", step: "any", value: state[key], onChange: onChange, onKeyUp: this.onKeyUp, style: {width: "6em"} })
					]
				)
			})
		),
		React.createElement("div", {style: {clear: "both", paddingTop: "0.5em", paddingBottom: "0.5em"}},
			[
				React.createElement("button", {key: "btn1", onClick: onB1Click, "data-superscript": "b", type: "button", style: {marginRight: "0.5em"}}, "y = (x + a)"),
				React.createElement("button", {key: "btn2", onClick: onB2Click, "data-superscript": "b", type: "button", style: {marginRight: "0.5em"}}, "y = x(x + a)"),
				React.createElement("button", {key: "btnClear", onClick: onClear, type: "button" }, "C")
			]
		)
	]);
}

class GraphPaper extends React.Component {
	componentDidMount() {
		draw();
	}
	render() {
		return React.createElement("div", {style: {position: "absolute", top: "15vw", right: "65vw"}},
			React.createElement("canvas", {key: "canvas", id: "canvas", width: 360, height: 360})
		);
	}
}

function Workbook() {
	const {state} = useContext(WorkbookContext);
	return React.createElement("table", {id: "tbl_showcase", key: "tbl_showcase"},
		React.createElement("tbody", {key: "tb_showcase"},
			state.workouts.map((workout, index) => {
				return React.createElement("tr", {key: `q_${index}`}, 
					React.createElement("td", {key: `td_${index}`, style: {color: workout.color},  
						dangerouslySetInnerHTML: { __html:  workout.answer} })
				)
			})
		)
	);
}
	
function Footer() {  
	const childrenData = [
		{tag: "div", attrs: {id: "wrapfabtest"}, children: (React.createElement("div", {key: "adBanner", className: "adBanner"}, "ImgV64 Copyright \u00a9 2016-2021"))}
	];

	return React.createElement("div", {key: "footer"},
		childrenData.map((item, index) => {
			return React.createElement(item["tag"], {key: `i${index}`, ...item["attrs"]}, item["children"])
		})
	);
}
	
class App extends React.Component {
	constructor(props) {
		super(props);
		this.state = { workouts: []};
	}	
	
	componentDidCatch(error, info) {
		console.error(`Error: ${error.message}`);
	}
	
	setWorkouts = data => {
		const row = data.workouts;
		if(row.length)
			this.setState(prevState => {
				return {
					...prevState,
					workouts : row.concat(prevState.workouts)
				}
			});
		else
			this.setState(data);
	};	
	
	render() {
		const [state, setState] = useState(initialState);
		return [
			React.createElement(WorkbookContext.Provider, {value: {state: this.state, setWorkouts: this.setWorkouts} }, 			
			[
				React.createElement(EquationEditor, {key: "equationEditor"}),
				React.createElement(Workbook, {key: "workbook"})
			]),
			React.createElement(GraphPaper, {key: "graphPaper"}),
			React.createElement(Footer, {key: "footer"})
		];
	}
}

// render
ReactDOM.render(React.createElement(App, {}), document.querySelector('#app'));
