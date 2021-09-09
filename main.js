var player;

(function () {
	window.onload = initialize();
	
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = 'thorvg-wasm.js';
	document.head.appendChild(script);

	script.onload = _ => {
		Module.onRuntimeInitialized = _ => {
			player = new Player();
			loadFromWindowURL();
		};
	};
})();

class Player {
	render(force) {
		if (!this.thorvg.update(this.canvas.width, this.canvas.height, force))
			return false;
		
		var buffer = this.thorvg.render();
		var clampedBuffer = Uint8ClampedArray.from(buffer);
		if (clampedBuffer.length == 0) return false;
		
		var imageData = new ImageData(clampedBuffer, this.canvas.width, this.canvas.height);
		this.imageData = imageData;
		
		var context = this.canvas.getContext('2d');
		context.putImageData(imageData, 0, 0);
		
		document.getElementById("zoom-value").innerHTML = this.canvas.width + " x " + this.canvas.height;
		return true;
	}
	
	load(data, name) {
		var ext = name.split('.').pop();
		return this.thorvg.load(new Int8Array(data), ext, this.canvas.width, this.canvas.height);
	}
	
	loadFile(file) {
		let read = new FileReader();
		read.readAsArrayBuffer(file);
		read.onloadend = _ => {
			if (!this.load(read.result, file.name) || !this.render(true)) {
				alert("Couldn't load an image (" + file.name + "). Error message: " + this.thorvg.getError());
				return;
			}
			
			this.filename = file.name;
			this.createTabs();
			showImageCanvas();
			enableZoomSlider();
		}
	}
	
	loadUrl(url) {
		let request = new XMLHttpRequest();
		request.open('GET', url, true);
		request.responseType = 'arraybuffer';
		request.onloadend = _ => {
			if (request.status !== 200) {
				alert("Couldn't load an image from url " + url);
				return;
			}
			let name = url.split('/').pop();
			if (!this.load(request.response, name) || !this.render(true)) {
				alert("Couldn't load an image (" + name + "). Error message: " + this.thorvg.getError());
				return;
			}
			
			this.filename = name;
			this.createTabs();
			showImageCanvas();
			enableZoomSlider();
		};
		request.send();
	}
	
	createTabs() {
		//layers tab
		var layersMem = this.thorvg.layers();
		var layers = document.getElementById("layers");
		layers.textContent = '';
		var parent = layers;
		var parentDepth = 1;
		for (let i = 0; i < layersMem.length; i += 4) {
			let id = layersMem[i];
			let depth = layersMem[i + 1];
			let type = layersMem[i + 2];
			let compositeMethod = layersMem[i + 3];
			if (depth > parentDepth) {
				var block = layerBlockCreate(depth);
				parent = parent.appendChild(block);
				parentDepth = depth;
			} else if (depth < parentDepth) {
				while (parent.getAttribute('tvg-depth') > depth) {
					parent = parent.parentNode;
				}
				parentDepth = depth;
			}
			parent.appendChild(layerCreate(id, depth, type, compositeMethod));
		}
		
		//preferences tab
		propertiesTabCreate(layers.getElementsByClassName('layer')[0]);
		
		//file tab
		var originalSize = Float32Array.from(this.thorvg.originalSize());
		var originalSizeText = ((originalSize[0] % 1 === 0) && (originalSize[1] % 1 === 0)) ? 
			originalSize[0].toFixed(0) + " x " + originalSize[1].toFixed(0) :
			originalSize[0].toFixed(2) + " x " + originalSize[1].toFixed(2);

		var file = document.getElementById("file");
		file.textContent = '';
		file.appendChild(fileHeaderCreate("Details"));
		file.appendChild(titledLineCreate("Filename", this.filename));
		file.appendChild(titledLineCreate("Canvas size", originalSizeText));
		file.appendChild(fileHeaderCreate("Export"));
		var lineExportTvg = propertiesLineCreate("Export .tvg file");
		lineExportTvg.addEventListener("click", exportCanvasToTvg, false);
		file.appendChild(lineExportTvg);
		var lineExportPng = propertiesLineCreate("Export .png file");
		lineExportPng.addEventListener("click", exportCanvasToPng, false);
		file.appendChild(lineExportPng);

		//switch to layers tab
		showLayers();
	}
	
	saveTvg() {
		if (this.thorvg.saveTvg()) {
			let data = FS.readFile('file.tvg');
			if (data.length < 33) {
				alert("Couldn't save canvas. Invalid size of the generated file.");
				return;
			}

			var blob = new Blob([data], {type: 'application/octet-stream'});
			
			var link = document.createElement("a");
			link.setAttribute('href', URL.createObjectURL(blob));
			link.setAttribute('download', changeExtension(player.filename, "tvg"));
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} else {
			alert("Couldn't save canvas. Error message: " + this.thorvg.getError());
		}
	}
	
	highlightLayer(paintId) {
		var bounds = Float32Array.from(this.thorvg.bounds(paintId));
		if (bounds.length != 4) return;
		
		var context = this.canvas.getContext('2d');
		context.putImageData(this.imageData, 0, 0);
		context.fillStyle = "#5a8be466";
		context.fillRect(bounds[0], bounds[1], bounds[2], bounds[3]);
	}
	
	setPaintOpacity(paintId, opacity) {
		this.thorvg.setOpacity(paintId, opacity);
		this.render(true);
	}
	
	rerender() {
		var context = this.canvas.getContext('2d');
		context.putImageData(this.imageData, 0, 0);
	}
	
	constructor() {
		this.thorvg = new Module.ThorvgWasm();
		this.canvas = document.getElementById("image-canvas");
	}
}

function initialize() {
	document.addEventListener('dragenter', fileDropHighlight, false);
	document.addEventListener('dragleave', fileDropUnhighlight, false);
	document.addEventListener('dragover', fileDropHighlight, false);
	document.addEventListener('drop', fileDropUnhighlight, false);
	document.addEventListener('drop', fileDropOrBrowseHandle, false);
	document.getElementById("image-placeholder").addEventListener("click", openFileBrowse, false);
	document.getElementById("image-file-selector").addEventListener("change", fileDropOrBrowseHandle, false);
	
	document.getElementById("nav-toggle-aside").addEventListener("click", toggleAside, false);
	document.getElementById("nav-layers").addEventListener("click", showLayers, false);
	document.getElementById("nav-properties").addEventListener("click", showProperties, false);
	document.getElementById("nav-file").addEventListener("click", showFile, false);
	document.getElementById("nav-dark-mode").addEventListener("change", darkModeToggle, false);
	
	document.getElementById("zoom-slider").addEventListener("input", onZoomSliderSlide, false);
}

//file upload
function allowedFileExtension(filename) {
	var ext = filename.split('.').pop();
	return (ext === "tvg") || (ext === "svg") || (ext === "jpg") || (ext === "png");
}
function fileDropUnhighlight(event) {
	event.preventDefault();
	event.stopPropagation();
	document.getElementById('drop-area').classList.remove("highlight");
}
function fileDropHighlight(event) {
	event.preventDefault();
	event.stopPropagation();
	event.dataTransfer.dropEffect = 'copy';
	document.getElementById('drop-area').classList.add("highlight");
}
function fileDropOrBrowseHandle(event) {
	var files = this.files || event.dataTransfer.files;
	if (files.length != 1 || !allowedFileExtension(files[0].name)) {
		alert("Please drag and drop a single file of supported format.");
		return false;
	}
	if (!player) return false;
	player.loadFile(files[0]);
	return false;
}

function openFileBrowse() {
	document.getElementById('image-file-selector').click();
}

//aside and nav
function toggleAside() {
	var aside = document.getElementsByTagName("aside")[0];
	aside.classList.toggle("hidden");
}
function showAside() {
	var aside = document.getElementsByTagName("aside")[0];
	aside.classList.remove("hidden");
}
function showPage(name) {
	showAside();
	var aside = document.getElementsByTagName("aside")[0];
	var tabs = aside.getElementsByClassName("tab");
	for (let tab of tabs) {
		tab.classList.toggle("active", tab.id === name);
	}
	var nav = aside.getElementsByTagName("nav")[0];
	var navChilds = nav.childNodes;
	for (let child of navChilds) {
		if (child.tagName === "A")
			child.classList.toggle("active", child.id === "nav-" + name);
	}
}

function showLayers() {
	showPage("layers");
}
function showProperties() {
	showPage("properties");
}
function showFile() {
	showPage("file");
}
function darkModeToggle(event) {
	document.body.classList.toggle("dark-mode", event.target.checked);
}

//main image section
function showImageCanvas() {
	var canvas = document.getElementById("image-canvas");
	var placeholder = document.getElementById("image-placeholder");
	canvas.classList.remove("hidden");
	placeholder.classList.add("hidden");
}

//zoom slider
function enableZoomSlider(enable) {
	var slider = document.getElementById("zoom-slider");
	slider.disabled = enable;
}

function onZoomSliderSlide(event) {
	if (!player) return;
	var value = event.target.value;
	
	var size = 512 * (value / 100 + 0.25);
	player.canvas.width = size;
	player.canvas.height = size;
	player.render(false);
}


function loadFromWindowURL() {
	const urlParams = new URLSearchParams(window.location.search);
	const imageUrl = urlParams.get('s');
	if (!imageUrl) return;
	if (!allowedFileExtension(imageUrl)) {
		alert("Applied a file of unsupported format.");
		return;
	}
	
	if (!player) return false;
	player.loadUrl(imageUrl);
}


const Types = { Shape : 1, Scene : 2, Picture : 3 };
const CompositeMethod = { None : 0, ClipPath : 1, AlphaMask : 2, InvAlphaMask : 3 };

const TypesIcons = [ "", "fa-files-o", "fa-folder", "fa-picture-o" ];
const TypesNames = [ "", "Shape", "Scene", "Picture" ];
const CompositeMethodNames = [ "None", "ClipPath", "AlphaMask", "InvAlphaMask" ];

function toggleSceneChilds() {
	var icon = event.currentTarget.getElementsByTagName("i")[0];
	var block = event.currentTarget.parentElement.nextElementSibling;
	if (!block) return;
	var visible = block.classList.toggle("hidden");
	icon.classList.toggle("fa-caret-right", visible);
	icon.classList.toggle("fa-caret-down", !visible);
}

function togglePaintVisibility() {
	for (var el = this.parentElement; el && !el.getAttribute('tvg-id'); el = el.parentElement);
	var tvgId = el.getAttribute('tvg-id');

	var icon = event.currentTarget.getElementsByTagName("i")[0];
	var visible = !icon.classList.contains("fa-square-o");

	var layers = document.getElementById("layers").getElementsByTagName("div");
	for (var i = 0; i < layers.length; i++) {
		if (layers[i].getAttribute('tvg-id') === tvgId) {
			var icon = layers[i].getElementsByClassName("visibility")[0].getElementsByTagName("i")[0];
			icon.classList.toggle("fa-square-o", visible);
			icon.classList.toggle("fa-minus-square-o", !visible);
			layers[i].setAttribute('tvg-visible', visible);
			break;
		}
	}

	var properties = document.getElementById("properties");
	if (properties.getAttribute('tvg-id') === tvgId) {
		var icon = properties.getElementsByClassName("visibility")[0].getElementsByTagName("i")[0];
		icon.classList.toggle("fa-square-o", visible);
		icon.classList.toggle("fa-minus-square-o", !visible);
	}

	player.setPaintOpacity(parseInt(tvgId), visible ? 255 : 0);
}

function showLayerProperties(event) {
	var el = event.target;
	for (; !el.classList.contains('layer'); el = el.parentNode) {
		if (el.tagName === "A") return;
	}
	propertiesTabCreate(el);
	showProperties();
}

function propertiesTabCreate(layer) {
	var properties = document.getElementById("properties");
	properties.textContent = '';
	properties.setAttribute('tvg-id', layer.getAttribute('tvg-id'));
	var type = layer.getAttribute('tvg-type') || 0;
	var compositeMethod = layer.getAttribute('tvg-comp') || 0;
	var visible = layer.getAttribute('tvg-visible') || true;
	properties.appendChild(propertiesLayerCreate(type, compositeMethod, visible));
	var lineShowOnLayers = propertiesLineCreate("Show on layers list");
	lineShowOnLayers.addEventListener("click", showLayers, false); // TODO
	properties.appendChild(lineShowOnLayers);
}

function layerBlockCreate(depth) {
	var block = document.createElement("div");
	block.setAttribute('class', 'block hidden');
	block.setAttribute('tvg-depth', depth);
	return block;
}

function layerCreate(id, depth, type, compositeMethod) {
	var layer = document.createElement("div");
	layer.setAttribute('class', 'layer');
	layer.setAttribute('tvg-id', id);
	layer.setAttribute('tvg-type', type);
	layer.setAttribute('tvg-comp', compositeMethod);
	layer.style.paddingLeft = Math.min(48 + 16 * depth, 224) + "px";

	if (type == Types.Scene) {
		var caret = document.createElement("a");
		caret.setAttribute('class', 'caret');
		caret.innerHTML = '<i class="fa fa-caret-right"></i>';
		caret.addEventListener("click", toggleSceneChilds, false);
		layer.appendChild(caret);
	}
	
	var icon = document.createElement("i");
	icon.setAttribute('class', 'icon fa ' + TypesIcons[type]);
	layer.appendChild(icon);
	
	var name = document.createElement("span");
	name.innerHTML = TypesNames[type];
	layer.appendChild(name);
	
	var visibility = document.createElement("a");
	visibility.setAttribute('class', 'visibility');
	visibility.innerHTML = '<i class="fa fa-square-o"></i>';
	visibility.addEventListener("click", togglePaintVisibility, false);
	layer.appendChild(visibility);
	
	if (compositeMethod != CompositeMethod.None) {
		layer.classList.add("composite");
		name.innerHTML += " <small>(" + CompositeMethodNames[compositeMethod] + ")</small>";
	}

	if (depth >= 11) {
		var depthSpan = document.createElement("span");
		depthSpan.setAttribute('class', 'depthSpan');
		depthSpan.innerHTML = depth;
		layer.appendChild(depthSpan);
	}
	
	layer.addEventListener("mouseenter", highlightLayer, false);
	layer.addEventListener("mouseleave", unhighlightLayer, false);
	layer.addEventListener("dblclick", showLayerProperties, false);
	
	return layer;
}


function propertiesLayerCreate(type, compositeMethod, visible) {
	var layer = document.createElement("div");
	layer.setAttribute('class', 'layer');
	
	var icon = document.createElement("i");
	icon.setAttribute('class', 'icon fa ' + TypesIcons[type]);
	layer.appendChild(icon);
	
	var name = document.createElement("span");
	name.innerHTML = TypesNames[type];
	layer.appendChild(name);
	
	var visibility = document.createElement("a");
	visibility.setAttribute('class', 'visibility');
	visibility.innerHTML = '<i class="fa ' + ((visible===true)?'fa-square-o':'fa-minus-square-o') + '"></i>';
	visibility.addEventListener("click", togglePaintVisibility, false);
	layer.appendChild(visibility);
	
	return layer;
}

function propertiesLineCreate(text) {
	var line = document.createElement("a");
	line.setAttribute('class', 'line');
	line.innerHTML = text;
	return line;
}

function titledLineCreate(title, text) {
	var titleLine = document.createElement("span");
	titleLine.setAttribute('class', 'line-title');
	titleLine.innerHTML = title;
	var textLine = document.createElement("span");
	textLine.innerHTML = text;
	var line = document.createElement("div");
	line.setAttribute('class', 'line');
	line.appendChild(titleLine);
	line.appendChild(textLine);
	return line;
}

function fileHeaderCreate(text) {
	var header = document.createElement("div");
	header.setAttribute('class', 'header');
	header.innerHTML = text;
	return header;
}

function exportCanvasToTvg() {
	player.saveTvg();
}

function changeExtension(filename, extension) {
	var s = filename.split('.').slice(0, -1);
	s.push(extension);
	return s.join('.');
}
function exportCanvasToPng() {
	player.canvas.toBlob(function(blob){
		var link = document.createElement("a");
		link.setAttribute('href', URL.createObjectURL(blob));
		link.setAttribute('download', changeExtension(player.filename, "png"));
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}, 'image/png');
}

function highlightLayer(event) {
	var paintId = parseInt(this.getAttribute('tvg-id'));
	player.highlightLayer(paintId);
}
function unhighlightLayer(event) {
	player.rerender(); // TODO; dont rerender if will do highlightLayer
}
