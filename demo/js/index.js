if(typeof eventBus === 'undefined') {
	eventBus = {
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
}

class Scene extends preact.Component {
	constructor(props) {
		super(props);
		this.state = { background: "none", transparent: -1,
			display: "none", imgName: "", imgBase64: "", imgUrl: ""
		};
		this.orig = preact.createRef();
	}
	
	componentDidMount() {
		eventBus.on("scene", data => {
			if(data.imgUrl == this.state.imgUrl) {
				eventBus.dispatch("app", {enabled: true});
				return;
			}
			requestAnimationFrame(() => this.setState(data));
		});
		eventBus.on("process", data => {
			var imgUrl = this.orig.current.src;
			process(imgUrl);
			(async () => await origLoad(data))();
		});
	}
	componentWillUnmount() {
		eventBus.remove("scene");
		eventBus.remove("process");
	}

	onChange = ev => {
		eventBus.dispatch("app", {enabled: false});
		const imgPath = ev.target.files[0];
		var id = baseName(imgPath.name)[0];
		loadImage(id, imgPath, ev);
	}
	onClick = ev => {
		ev.target.parentNode.nextSibling.click();
	}	
	onDragOver = ev => {
		ev.stopPropagation();
		ev.preventDefault();
		
		ev.target.style.border = "4px dashed silver";
	}
	onDragLeave = ev => {
		if(ev)
			ev.target.style.border = "";
		else
			this.orig.current.style.border = "";
	}
	onDrop = ev => {
		ev.stopPropagation();
		ev.preventDefault();
		
		const enabled = this.props.isEnabled();
		if(!enabled) {
			this.onDragLeave(ev);
			return;
		}

		var dt = ev.dataTransfer;
		if(dt.files == null || dt.files.length <= 0) {
			var imgUrl = dt.getData("text");
			if(imgUrl == ev.target.src) {
				this.onDragLeave(ev);
				return;
			}
			
			const mineType = "text/html";
			try {
				var dropContext = new DOMParser().parseFromString(dt.getData(mineType), mineType);
				var img = dropContext.querySelector("img");
				if(img instanceof HTMLImageElement)
					imgUrl = img.srcset ? img.srcset.split(",").pop().trim().split(" ")[0] : img.src;
			}
			catch(err) {
				console.error(err);
			}

			download(imgUrl, ev);
			this.onDragLeave(ev);
			return;
		}
		
		var file = dt.files[0];
		var imageType = /image.*/;

		if (file.type.match(imageType)) {
			eventBus.dispatch("app", {enabled: false});
			loadImage(file.name, file, ev);
		}
		this.onDragLeave(ev);
	}
	onError = ev => {
		var $orig = this.orig.current;
		allowChange($orig);
	}
	onLoad = ev => {
		eventBus.dispatch("origLoad", {});
	}

	render() {
		const {background, display, imgName, imgUrl, imgBase64} = this.state;
		const opacity = display ? 1 : 0;
		const reduOpacity = this.props.isEnabled() ? opacity : .5;
		const imgB64 = this.props.isEnabled() ? imgBase64 : 'data:image/svg+xml;base64,PHN2ZyBmaWxsPSJoc2woMjI4LCA5NyUsIDQyJSkiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjMiIHI9IjAiPjxhbmltYXRlIGlkPSJzcGlubmVyXzMxOGwiIGJlZ2luPSIwO3NwaW5uZXJfY3ZrVS5lbmQtMC41cyIgYXR0cmlidXRlTmFtZT0iciIgY2FsY01vZGU9InNwbGluZSIgZHVyPSIwLjZzIiB2YWx1ZXM9IjA7MjswIiBrZXlUaW1lcz0iMDsuMjsxIiBrZXlTcGxpbmVzPSIwLDEsMCwxOy41MywwLC42MSwuNzMiIGZpbGw9ImZyZWV6ZSIvPjwvY2lyY2xlPjxjaXJjbGUgY3g9IjE2LjUwIiBjeT0iNC4yMSIgcj0iMCI+PGFuaW1hdGUgaWQ9InNwaW5uZXJfZzVHaiIgYmVnaW49InNwaW5uZXJfMzE4bC5iZWdpbiswLjFzIiBhdHRyaWJ1dGVOYW1lPSJyIiBjYWxjTW9kZT0ic3BsaW5lIiBkdXI9IjAuNnMiIHZhbHVlcz0iMDsyOzAiIGtleVRpbWVzPSIwOy4yOzEiIGtleVNwbGluZXM9IjAsMSwwLDE7LjUzLDAsLjYxLC43MyIgZmlsbD0iZnJlZXplIi8+PC9jaXJjbGU+PGNpcmNsZSBjeD0iNy41MCIgY3k9IjQuMjEiIHI9IjAiPjxhbmltYXRlIGlkPSJzcGlubmVyX2N2a1UiIGJlZ2luPSJzcGlubmVyX1V1azAuYmVnaW4rMC4xcyIgYXR0cmlidXRlTmFtZT0iciIgY2FsY01vZGU9InNwbGluZSIgZHVyPSIwLjZzIiB2YWx1ZXM9IjA7MjswIiBrZXlUaW1lcz0iMDsuMjsxIiBrZXlTcGxpbmVzPSIwLDEsMCwxOy41MywwLC42MSwuNzMiIGZpbGw9ImZyZWV6ZSIvPjwvY2lyY2xlPjxjaXJjbGUgY3g9IjE5Ljc5IiBjeT0iNy41MCIgcj0iMCI+PGFuaW1hdGUgaWQ9InNwaW5uZXJfZThyTSIgYmVnaW49InNwaW5uZXJfZzVHai5iZWdpbiswLjFzIiBhdHRyaWJ1dGVOYW1lPSJyIiBjYWxjTW9kZT0ic3BsaW5lIiBkdXI9IjAuNnMiIHZhbHVlcz0iMDsyOzAiIGtleVRpbWVzPSIwOy4yOzEiIGtleVNwbGluZXM9IjAsMSwwLDE7LjUzLDAsLjYxLC43MyIgZmlsbD0iZnJlZXplIi8+PC9jaXJjbGU+PGNpcmNsZSBjeD0iNC4yMSIgY3k9IjcuNTAiIHI9IjAiPjxhbmltYXRlIGlkPSJzcGlubmVyX1V1azAiIGJlZ2luPSJzcGlubmVyX3o3b2wuYmVnaW4rMC4xcyIgYXR0cmlidXRlTmFtZT0iciIgY2FsY01vZGU9InNwbGluZSIgZHVyPSIwLjZzIiB2YWx1ZXM9IjA7MjswIiBrZXlUaW1lcz0iMDsuMjsxIiBrZXlTcGxpbmVzPSIwLDEsMCwxOy41MywwLC42MSwuNzMiIGZpbGw9ImZyZWV6ZSIvPjwvY2lyY2xlPjxjaXJjbGUgY3g9IjIxLjAwIiBjeT0iMTIuMDAiIHI9IjAiPjxhbmltYXRlIGlkPSJzcGlubmVyX01vb0wiIGJlZ2luPSJzcGlubmVyX2U4ck0uYmVnaW4rMC4xcyIgYXR0cmlidXRlTmFtZT0iciIgY2FsY01vZGU9InNwbGluZSIgZHVyPSIwLjZzIiB2YWx1ZXM9IjA7MjswIiBrZXlUaW1lcz0iMDsuMjsxIiBrZXlTcGxpbmVzPSIwLDEsMCwxOy41MywwLC42MSwuNzMiIGZpbGw9ImZyZWV6ZSIvPjwvY2lyY2xlPjxjaXJjbGUgY3g9IjMuMDAiIGN5PSIxMi4wMCIgcj0iMCI+PGFuaW1hdGUgaWQ9InNwaW5uZXJfejdvbCIgYmVnaW49InNwaW5uZXJfS0Vvby5iZWdpbiswLjFzIiBhdHRyaWJ1dGVOYW1lPSJyIiBjYWxjTW9kZT0ic3BsaW5lIiBkdXI9IjAuNnMiIHZhbHVlcz0iMDsyOzAiIGtleVRpbWVzPSIwOy4yOzEiIGtleVNwbGluZXM9IjAsMSwwLDE7LjUzLDAsLjYxLC43MyIgZmlsbD0iZnJlZXplIi8+PC9jaXJjbGU+PGNpcmNsZSBjeD0iMTkuNzkiIGN5PSIxNi41MCIgcj0iMCI+PGFuaW1hdGUgaWQ9InNwaW5uZXJfYnR5ViIgYmVnaW49InNwaW5uZXJfTW9vTC5iZWdpbiswLjFzIiBhdHRyaWJ1dGVOYW1lPSJyIiBjYWxjTW9kZT0ic3BsaW5lIiBkdXI9IjAuNnMiIHZhbHVlcz0iMDsyOzAiIGtleVRpbWVzPSIwOy4yOzEiIGtleVNwbGluZXM9IjAsMSwwLDE7LjUzLDAsLjYxLC43MyIgZmlsbD0iZnJlZXplIi8+PC9jaXJjbGU+PGNpcmNsZSBjeD0iNC4yMSIgY3k9IjE2LjUwIiByPSIwIj48YW5pbWF0ZSBpZD0ic3Bpbm5lcl9LRW9vIiBiZWdpbj0ic3Bpbm5lcl8xSVlELmJlZ2luKzAuMXMiIGF0dHJpYnV0ZU5hbWU9InIiIGNhbGNNb2RlPSJzcGxpbmUiIGR1cj0iMC42cyIgdmFsdWVzPSIwOzI7MCIga2V5VGltZXM9IjA7LjI7MSIga2V5U3BsaW5lcz0iMCwxLDAsMTsuNTMsMCwuNjEsLjczIiBmaWxsPSJmcmVlemUiLz48L2NpcmNsZT48Y2lyY2xlIGN4PSIxNi41MCIgY3k9IjE5Ljc5IiByPSIwIj48YW5pbWF0ZSBpZD0ic3Bpbm5lcl8xc0lTIiBiZWdpbj0ic3Bpbm5lcl9idHlWLmJlZ2luKzAuMXMiIGF0dHJpYnV0ZU5hbWU9InIiIGNhbGNNb2RlPSJzcGxpbmUiIGR1cj0iMC42cyIgdmFsdWVzPSIwOzI7MCIga2V5VGltZXM9IjA7LjI7MSIga2V5U3BsaW5lcz0iMCwxLDAsMTsuNTMsMCwuNjEsLjczIiBmaWxsPSJmcmVlemUiLz48L2NpcmNsZT48Y2lyY2xlIGN4PSI3LjUwIiBjeT0iMTkuNzkiIHI9IjAiPjxhbmltYXRlIGlkPSJzcGlubmVyXzFJWUQiIGJlZ2luPSJzcGlubmVyX05XaGguYmVnaW4rMC4xcyIgYXR0cmlidXRlTmFtZT0iciIgY2FsY01vZGU9InNwbGluZSIgZHVyPSIwLjZzIiB2YWx1ZXM9IjA7MjswIiBrZXlUaW1lcz0iMDsuMjsxIiBrZXlTcGxpbmVzPSIwLDEsMCwxOy41MywwLC42MSwuNzMiIGZpbGw9ImZyZWV6ZSIvPjwvY2lyY2xlPjxjaXJjbGUgY3g9IjEyIiBjeT0iMjEiIHI9IjAiPjxhbmltYXRlIGlkPSJzcGlubmVyX05XaGgiIGJlZ2luPSJzcGlubmVyXzFzSVMuYmVnaW4rMC4xcyIgYXR0cmlidXRlTmFtZT0iciIgY2FsY01vZGU9InNwbGluZSIgZHVyPSIwLjZzIiB2YWx1ZXM9IjA7MjswIiBrZXlUaW1lcz0iMDsuMjsxIiBrZXlTcGxpbmVzPSIwLDEsMCwxOy41MywwLC42MSwuNzMiIGZpbGw9ImZyZWV6ZSIvPjwvY2lyY2xlPjwvc3ZnPg==';
			return preact.createElement("div", {id: "scene", style: {overflow: "auto"}},
			[
				preact.createElement("div", {key: "box1", className: "box", style: {background: background, margin: "0 auto", maxWidth: "49%", maxHeight: "35%"}}, 
					[
						preact.createElement("h4", {}, "Original"),
						preact.createElement("div", {key: "orig", id: "orig", style: {display: display, overflow: "auto"},
							onClick: this.onClick, onDrop: this.onDrop, 
							onDragOver: this.onDragOver, onDragLeave: this.onDragLeave },
							[
								preact.createElement("div", {style: {width: "100%"} }),
								preact.createElement("img", {key: "origImg", crossOrigin: "Anonymous", ref: this.orig, 
									name: imgName, src: imgUrl, 
									onError: this.onError, onLoad: this.onLoad
								})
							]),
						preact.createElement("input", {key: "file", type: "file", style: {display: "none", width: 0},
							onChange: this.onChange
						})
					]
				),
				preact.createElement("div", {key: "box2", className: "box", style: {background: background, margin: "0 auto", maxWidth: "49%", maxHeight: "35%", 
				  transition: "opacity 1s", opacity: reduOpacity}}, 
					preact.createElement("h4", {}, "Quantized"),
					preact.createElement("div", {key: "redu", id: "redu", style: {overflow: "auto"} },
						[
							preact.createElement("div", {style: {width: "100%"} }),
							preact.createElement("img", {key: "reducedImg", src: imgB64})
						])
				)
			]
		);
	}
}

class Readme extends preact.Component {
	constructor(props) {
		super(props);
		this.state = { cols: 32, dimensions: null, pal: []};
	}
	
	componentDidMount() {
		this.setState({
			dimensions: {
				width: this.container.offsetWidth,
				height: this.container.offsetHeight,
			},
		});
		eventBus.on("palt", data => {
			requestAnimationFrame(() => this.setState(data));
		});
	}
	componentWillUnmount() {
		eventBus.remove("palt");
	}
	
	drawPalette = () => {
		const { dimensions } = this.state;
		if(!dimensions)
			return null;

		let {pal} = this.state;
		const maxWidth = dimensions.width;
		const maxHeight = dimensions.height;
		if(!maxWidth || pal.length == 0)
			return null;
		
		let divContent = [];
		pal.map((pixel, k) => {
			const r = (pixel & 0xff),
				g = (pixel >>> 8) & 0xff,
				b = (pixel >>> 16) & 0xff,
				a = ((pixel >>> 24) & 0xff) / 255.0;
			const div = preact.createElement("div", {key: `pal${k}`, style: {backgroundColor: `rgba(${r}, ${g}, ${b}, ${a})`, 
				}, title: rgbToHex(r, g, b) });
			divContent.push(div);
		});
		return divContent;
	}

	render() {
		const childrenData = [
			preact.createElement("b", {}, "Click an image to quantize it."),
			preact.createElement("b", {}, "Please input number of colors wanted."),
			preact.createElement("span", {},
				[
					preact.createElement("b", {}, "Config"),
					preact.createElement("span", {}, " values can be edited & re-processed via "),
					preact.createElement("b", {}, "update")
				]),
			preact.createElement("span", {}, "If your browser can't load an image fully, just try again."),
		];
		const cols = Math.min(this.state.cols, this.state.pal.length);
		
		return preact.createElement("div", {key: "help", id: "help", className: "box", style: {paddingRight: "1em", maxWidth: "100vw"}},
			[
				preact.createElement("ul", {key: "readme", id: "readme"}, 
					childrenData.map((ele, index) => {
						return preact.createElement("li", {key: `li_${index}`, style: {mixBlendMode: "hard-light"}}, ele)
					})
				),
				preact.createElement("div", {key: "palt", id: "palt", className: "grid", ref: el => (this.container = el),
				style: {gridTemplateColumns: `repeat(${cols}, 1fr)`}}, this.drawPalette())
			]
		);
	}
}

class Config extends preact.Component {
	constructor(props) {
		super(props);
	}
	
	componentDidMount() {
		eventBus.on("origLoad", data => (async () => await origLoad(this.props.getData()))());
	}
	componentWillUnmount() {
		eventBus.remove("config");
		eventBus.remove("origLoad");
	}	
	
	colorsChange = e => {
		this.props.updateState({colors: e.target.value});
	}
	ditheringChange = e => {
		this.props.updateState({dithering: e.target.checked});
	}
	qualityChange = e => {
		this.props.updateState({isHQ: e.target.value == "H"});
	}
	onKeyUp = e => {
		if(e.key === 'Enter')
			e.currentTarget.blur();
	}
	onSubmit = async (e) => {
		eventBus.dispatch("submit");
	}
	
	render() {
		const {enabled, colors, dithering, isHQ} = this.props.getData();
		const btnText = enabled ? "Update" : "Please wait...";
		return preact.createElement("div", {className: "box", style: {top: 0, zIndex: 999, minWidth: "100px"}},
			[
				preact.createElement("h5", {key: "h5_config"}, "Config"),
				preact.createElement("div", {key: "pre_config", id: "config", style: {paddingLeft: "1em", right: 0}}, 
					[
						preact.createElement("span", {style: {mixBlendMode: "hard-light"}}, 'var opts = {\n'),
						preact.createElement("div", {style: {paddingLeft: "4em"}}, 
							[
								preact.createElement("span", {style: {mixBlendMode: "hard-light"}}, 'colors: '),
								preact.createElement("input", {key: "colors", id: "colors", type: "number", min: 2, max: 65536, size: 6, className: "autosize",
								value: colors, onChange: this.colorsChange, onKeyUp: this.onKeyUp })
							]
						),
						preact.createElement("div", {style: {paddingLeft: "4em"}}, 
							[
								preact.createElement("input", {key: "dithering", id: "dithering", type: "checkbox",
									checked: dithering, onChange: this.ditheringChange }),
								preact.createElement("span", {style: {mixBlendMode: "hard-light"}}, 'dithering,')
							]
						),
						preact.createElement("span", {style: {mixBlendMode: "hard-light"}}, '};')
					]
				),
				preact.createElement("span", {key: "input_config", style: {paddingLeft: "1em", paddingBottom: "1em"}},
					[
						preact.createElement("span", {style: {mixBlendMode: "hard-light"}}, 'Quality: '),
						preact.createElement("input", {key: "radNQ", name: "quality", type: "radio", value: "N",
							checked: !isHQ, onChange: this.qualityChange }),
						preact.createElement("span", {style: {mixBlendMode: "hard-light"}}, 'Normal '),
						preact.createElement("input", {key: "radHQ", id: "radHQ", name: "quality", type: "radio", value: "H",
							checked: isHQ, onChange: this.qualityChange }),
						preact.createElement("span", {style: {mixBlendMode: "hard-light"}}, ' High')
					]
				),
				preact.createElement("div", {key: "btn_config", style: {padding: "0.5em 1em 0.5em 11em"}}, 
					preact.createElement("button", {key: "btn_upd", id: "btn_upd", type: "button",
					disabled: !enabled, onClick: this.onSubmit }, btnText)
				)
			]
		);
	}
}

function Footer(props) {  
	return preact.createElement("div", {key: "footer", id: "footer", style: {maxWidth: "70vw"}},
		[
			preact.createElement(Readme, {key: "readme", ...props}),
			preact.createElement(Config, {key: "config", ...props})
		]
	);
}

function ImageSet(props) {
	const onClick = e => {
		if(!document.querySelector("#btn_upd").disabled) {
			var id = e.target.name;
			var imgUrl = e.target.srcset.split(",").pop().trim().split(" ")[0];
			process(imgUrl);
		}
	}
	const onDrop = e => {
		if(!document.querySelector("#btn_upd").disabled) {
			e.stopPropagation();
			e.preventDefault();
			var imageUrl = e.dataTransfer.getData('text/html');
			var rex = /src="?([^"\s]+)"?\s*/;
			var url = rex.exec(imageUrl);
			e.dataTransfer.dropEffect = "copy";
			e.dataTransfer.setData("text", url[1]);
		}
	}
	
	const imgType = props.pngOnly ? ".png" : ".jpg";
	return props.images.map(imgName => {
		const selected = props.selected == imgName ? " selected" : "";
		return preact.createElement("img", {key: `img_${imgName}`, className: `lazyload th${selected}`, name: imgName, style: {zIndex : 2}, 
			"data-sizes": "auto", "data-src": `img/${imgName}_th${imgType}`, "data-srcset": `img/${imgName}_th${imgType} 1x, img/${imgName}${imgType} 4x`,
			draggable: true, onClick: onClick, onDrop: onDrop })
	});
}

function Category(props) {
	const key = props.images[0];
	const th = preact.createElement("th", {key: `th_${key}`}, props.text);
	const pngOnly = props.text.indexOf("Transparent") > -1;
	const imgSet = preact.createElement(ImageSet, {key: `imgs_${key}`, images: props.images, pngOnly: pngOnly, selected: props.selected});
	const td = preact.createElement("td", {key: `td_${key}`}, imgSet);
	return preact.createElement("tr", {key: `tr_${key}`}, [th, td]);
}

function Gallery() {  
	const categories = [
		{images: ["baseball", "brokenBayer", "caps", "compcube", "house", "island", "legend",  "museum",
			"old-HK", "peppers", "scream", "venus"], text: "Art"}, 
		{images: ["airline", "araras", "bluff", "climb",
			"constitucion-chile", "f16", "goldhill", "HKView", "pool",
			"quantfrog", "sailing_2020", "sky_sea", "tree", "talia-ryder", "wooden"], text: "Photos"},
		{images: ["bacaro", "canal", "fruit-market", "g-fruit", "motocross", "pills", "rainbow-illusions",
			"SE5x9", "venice", "wildflowers"], selected: "SE5x9", text: "Colorful"},
		{images: ["color-wheel", "cup", "rainbow-shadow"],
			text: "Partial Transparent"}
	];
	return preact.createElement("table", {id: "tbl_showcase", key: "tbl_showcase"},
		preact.createElement("tbody", {key: "tb_showcase"},
			categories.map(category => {
				return preact.createElement(Category, {key: `cat_${category["images"][0]}`, images: category["images"], selected: category["selected"], text: category["text"]})
			})
		)
	);
}

function ForkMe() {  
	const childrenData = [
		{tag: "a", attrs: {href: "https://github.com/mcychan/PnnQuant.js"}},
		{tag: "img", attrs: {src: "img/forkme_right_red_aa0000.svg", style: {position: "absolute", top: 0, right: 0}, alt: "Fork me on GitHub"}},
		{tag: "div", attrs: {id: "wrapfabtest"}, children: (preact.createElement("div", {key: "adBanner", className: "adBanner"}, "ImgV64 Copyright \u00a9 2016-2021"))}
	];

	return preact.createElement("div", {key: "forkme"},
		childrenData.map((item, index) => {
			return preact.createElement(item["tag"], {key: `i${index}`, ...item["attrs"]}, item["children"])
		})
	);
}

class App extends preact.Component {
	constructor(props) {
		super(props);
		this.clickedSubmit = false;
		this.hasChanged = [];
		this.state = { enabled: true, colors: 256, dithering: true, isHQ: false};
	}
	
	componentDidMount() {
		eventBus.on("app", data => this.setState(data));
		eventBus.on("submit", () => {
			if(this.hasChanged.length > 0)
				this.clickedSubmit = true;
			else
				eventBus.dispatch("process", this.state);
		});
	}
	componentWillUnmount() {
		eventBus.remove("app");
		eventBus.remove("submit");
	}
	componentDidCatch(error, info) {
		console.error(`Error: ${error.message}`);
	}
	
	isEnabled = () => this.state.enabled;

	
	getData = () => this.state;
	
	updateState = data => {
		const key = Object.keys(data)[0];
		this.hasChanged.push(key);
		this.setState(data, () => {
			this.hasChanged = this.hasChanged.filter(e => e !== key);
			if(this.clickedSubmit && this.hasChanged.length == 0) {
				eventBus.dispatch("process", this.state);
				this.clickedSubmit = false;
			}
		});
	}
	
	render() {
		return [
			preact.createElement(Scene, {key: "scene", isEnabled: this.isEnabled}),
			preact.createElement(Footer, {key: "footer", getData: this.getData, updateState: this.updateState}),
			preact.createElement(Gallery, {key: "gallery"}),
			preact.createElement(ForkMe, {key: "forkMe"})
		];
	}
}

// render
preact.render(preact.createElement(App, {}), document.querySelector('#app'));
