var player;
var filesList = new Array();

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

const consoleLogTypes = { None : '', Inner : 'console-type-inner', Error : 'console-type-error', Warning : 'console-type-warning' };
(function () {
	var baseConsole = console.log;
	console.log = (...args) => {
		if (args[0] && typeof args[0] === 'string') {
			if (args[0].startsWith("SVG:")) consoleLog(args[0], consoleLogTypes.Warning);
			else if (!args[0].startsWith("SW_ENGINE:")) consoleLog(args[0]);
		}
		baseConsole(...args);
	};
})();
function consoleLog(message, type = consoleLogTypes.None) {
	var consoleWindow = document.getElementById("console-area");
	var line = document.createElement("span");
	if (type) line.setAttribute('class', type);
	line.innerHTML = message
		.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
	consoleWindow.appendChild(line);
	//Scrolling to the end makes it significantly slower
	//consoleWindow.scrollTop = consoleWindow.scrollHeight;
}

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

		var zoomvalue = document.getElementById("zoom-value");
		zoomvalue.innerHTML = this.canvas.width + " x " + this.canvas.height;
		zoomvalue.classList.remove("incorrect");
		return true;
	}

	load(data, name) {
		consoleLog("Loading file " + name, consoleLogTypes.Inner);
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
			enableZoomContainer();
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
			enableZoomContainer();
			deletePopup();
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
		for (let i = 0; i < layersMem.length; i += 5) {
			let id = layersMem[i];
			let depth = layersMem[i + 1];
			let type = layersMem[i + 2];
			let compositeMethod = layersMem[i + 3];
			let opacity = layersMem[i + 4];
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
			parent.appendChild(layerCreate(id, depth, type, compositeMethod, opacity));
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
		file.appendChild(headerCreate("Details"));
		file.appendChild(titledLineCreate("Filename", this.filename));
		file.appendChild(titledLineCreate("Canvas size", originalSizeText));
		file.appendChild(headerCreate("Export"));
		var lineExportCompressedTvg = propertiesLineCreate("Export .tvg file (compression)");
		lineExportCompressedTvg.addEventListener("click", () => {player.saveTvg(true)}, false);
		file.appendChild(lineExportCompressedTvg);
		var lineExportNotCompressedTvg = propertiesLineCreate("Export .tvg file (no compression)");
		lineExportNotCompressedTvg.addEventListener("click", () => {player.saveTvg(false)}, false);
		file.appendChild(lineExportNotCompressedTvg);
		var lineExportPng = propertiesLineCreate("Export .png file");
		lineExportPng.addEventListener("click", exportCanvasToPng, false);
		file.appendChild(lineExportPng);

		//switch to layers tab
		showLayers();
	}

	saveTvg(compress) {
		if (this.thorvg.saveTvg(compress)) {
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
			let message = "Couldn't save canvas. Error message: " + this.thorvg.getError();
			consoleLog(message, consoleLogTypes.Error);
			alert(message);
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
		consoleLog("Thorvg module loaded correctly", consoleLogTypes.Inner);
	}
}

function initialize() {
	window.addEventListener('dragenter', fileDropHighlight, false);
	window.addEventListener('dragleave', fileDropUnhighlight, false);
	window.addEventListener('dragover', fileDropHighlight, false);
	window.addEventListener('drop', fileDropUnhighlight, false);
	window.addEventListener('drop', (evt)=>{
		fileDropOrBrowseHandle(evt.dataTransfer.files);
	}, false);

	document.getElementById("image-placeholder").addEventListener("click", openFileBrowse, false);
	document.getElementById("image-file-selector").addEventListener("change", (evt)=>{
		fileDropOrBrowseHandle(document.getElementById('image-file-selector').files);
		evt.target.value = '';
	}, false);

	document.getElementById("add-file-local").addEventListener("click", openFileBrowse, false);
	document.getElementById("add-file-url").addEventListener("click", buildAddByURLPopup, false);

	document.getElementById("nav-toggle-aside").addEventListener("click", toggleAside, false);
	document.getElementById("nav-layers").addEventListener("click", showLayers, false);
	document.getElementById("nav-properties").addEventListener("click", showProperties, false);
	document.getElementById("nav-file").addEventListener("click", showFile, false);
	document.getElementById("nav-files-list").addEventListener("click", showFilesList, false);
	document.getElementById("nav-dark-mode").addEventListener("change", darkModeToggle, false);
	document.getElementById("nav-console").addEventListener("click", consoleWindowToggle, false);

	document.getElementById("console-bottom-scroll").addEventListener("click", consoleScrollBottom, false);

	document.getElementById("zoom-slider").addEventListener("input", onZoomSliderSlide, false);
	document.getElementById("zoom-value").addEventListener("keydown", onZoomValueKeyDown, false);
}

//file upload
function openFileBrowse() {
	document.getElementById('image-file-selector').click();
}

function allowedFileExtension(filename) {
	var ext = filename.split('.').pop();
	return (ext === "tvg") || (ext === "svg");
}
function fileDropHighlight(event) {
	event.preventDefault();
	event.stopPropagation();
	event.dataTransfer.dropEffect = 'copy';
	document.getElementById('image-area').classList.add("highlight");
}
function fileDropUnhighlight(event) {
	event.preventDefault();
	event.stopPropagation();
	document.getElementById('image-area').classList.remove("highlight");
}
function fileDropOrBrowseHandle(files) {
	let supportedFiles = false;
	for (let i = 0, file; file = files[i]; ++i) {
		if (!allowedFileExtension(file.name)) continue;
		filesList.push(file);
		supportedFiles = true;
	}
	if (!supportedFiles) {
		alert("Please use file(s) of a supported format.");
		return false;
	}

	loadFileFromList(filesList[filesList.length - 1]);
	createFilesListTab();
	return false;
}

function createFilesListTab() {
	var container = document.getElementById("files-list").children[0];
	container.textContent = '';
	container.appendChild(headerCreate("List of files"));
	for (let i = 0; i < filesList.length; ++i) {
		let file = filesList[i];
		var lineFile = filesListLineCreate(file);
		lineFile.addEventListener("dblclick", (event)=>{
			for (var el = event.target; !el.classList.contains('line'); el = el.parentNode)
				if (el.tagName === "A") return;
			loadFileFromList(file);
		}, false);
		container.appendChild(lineFile);
	}
}

function loadFileFromList(file) {
	if (!player) {
		alert("Webassembly module is not ready yet. Please try again.");
		return;
	}
	player.loadFile(file);
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
function showFilesList() {
	showPage("files-list");
}
function darkModeToggle(event) {
	document.body.classList.toggle("dark-mode", event.target.checked);
}
function consoleWindowToggle(event) {
	document.getElementById("console-area").classList.toggle("hidden");
}
function consoleScrollBottom(event) {
	var consoleWindow = document.getElementById("console-area");
	consoleWindow.scrollTop = consoleWindow.scrollHeight;
}

//main image section
function showImageCanvas() {
	var canvas = document.getElementById("image-canvas");
	var placeholder = document.getElementById("image-placeholder");
	canvas.classList.remove("hidden");
	placeholder.classList.add("hidden");
}

//zoom slider
function enableZoomContainer(enable = true) {
	var slider = document.getElementById("zoom-slider");
	slider.disabled = !enable;
	var value = document.getElementById("zoom-value");
	value.contentEditable = enable;
}

function onZoomSliderSlide(event) {
	if (!player) return;
	var value = event.target.value;

	var size = 512 * (value / 100 + 0.25);
	player.canvas.width = size;
	player.canvas.height = size;
	player.render(false);
}

function onZoomValueKeyDown(event) {
	if (event.code === 'Enter') {
		var value = event.srcElement.innerHTML;
		var matched = value.match(/^(\d{1,5})\s*x\s*(\d{1,5})$/);
		if (matched) {
			player.canvas.width = matched[1];
			player.canvas.height = matched[2];
			player.render(true);
		} else {
			event.srcElement.classList.add("incorrect");
		}
		event.preventDefault();
	}
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
	if (!block || !block.classList.contains("block")) return;
	var visible = block.classList.toggle("hidden");
	icon.classList.toggle("fa-caret-right", visible);
	icon.classList.toggle("fa-caret-down", !visible);
}

function togglePaintVisibility() {
	for (var el = this.parentElement; el && !el.getAttribute('tvg-id'); el = el.parentElement);
	var tvgId = el.getAttribute('tvg-id');

	var icon = event.currentTarget.getElementsByTagName("i")[0];
	var visible = !icon.classList.contains("fa-square-o");
	var defaultOpacity = 255;

	var layers = document.getElementById("layers").getElementsByTagName("div");
	for (var i = 0; i < layers.length; i++) {
		if (layers[i].getAttribute('tvg-id') === tvgId) {
			var icon = layers[i].getElementsByClassName("visibility")[0].getElementsByTagName("i")[0];
			icon.classList.toggle("fa-square-o", visible);
			icon.classList.toggle("fa-minus-square-o", !visible);
			layers[i].setAttribute('tvg-visible', visible);
			defaultOpacity = parseInt(layers[i].getAttribute('tvg-opacity'));
			break;
		}
	}

	var properties = document.getElementById("properties");
	if (properties.getAttribute('tvg-id') === tvgId) {
		var icon = properties.getElementsByClassName("visibility")[0].getElementsByTagName("i")[0];
		icon.classList.toggle("fa-square-o", visible);
		icon.classList.toggle("fa-minus-square-o", !visible);
	}

	player.setPaintOpacity(parseInt(tvgId), visible ? defaultOpacity : 0);
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

function layerCreate(id, depth, type, compositeMethod, opacity) {
	var layer = document.createElement("div");
	layer.setAttribute('class', 'layer');
	layer.setAttribute('tvg-id', id);
	layer.setAttribute('tvg-type', type);
	layer.setAttribute('tvg-comp', compositeMethod);
	layer.setAttribute('tvg-opacity', opacity);
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

function headerCreate(text) {
	var header = document.createElement("div");
	header.setAttribute('class', 'header');
	header.innerHTML = text;
	return header;
}

function bytesToSize(bytes) {
	if (bytes <= 0) return '0 byte';
	var sizes = ['bytes', 'kB', 'MB'];
	var i = (bytes > 1024) ? ((bytes > 1048576) ? 2 : 1) : 0;
	return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
}
function filesListLineCreate(file) {
	var line = document.createElement("div");
	line.setAttribute('class', 'line');

	var nameLine = document.createElement("span");
	nameLine.setAttribute('class', 'line-name');
	nameLine.innerHTML = file.name;
	line.appendChild(nameLine);
	var detailsLine = document.createElement("span");
	detailsLine.setAttribute('class', 'line-details');
	detailsLine.innerHTML = bytesToSize(file.size);
	line.appendChild(detailsLine);

	var trash = document.createElement("a");
	trash.setAttribute('class', 'trash');
	trash.innerHTML = '<i class="fa fa-trash-o"></i>';
	trash.addEventListener("click", (event)=>{
		var line = event.currentTarget.parentElement;
		line.parentNode.removeChild(line);
		var index = filesList.indexOf(file);
		if (index !== -1) filesList.splice(index, 1);
	}, false);
	line.appendChild(trash);

	return line;
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


function deletePopup() {
	var popup = document.getElementsByClassName("popup")[0];
	if (popup) popup.parentNode.removeChild(popup);
}
function addByUrl() {
	var url = document.getElementById("url-field").value;

	if (!allowedFileExtension(url)) {
		alert("Applied a file of unsupported format.");
		return;
	}

	if (!player) return false;
	player.loadUrl(url);
}
function buildAddByURLPopup() {
	var popup = document.createElement("div");
	popup.innerHTML = '<div><header>Add file by URL</header><div class="input-group"><span>https://</span><input type="text" id="url-field" placeholder="raw.githubusercontent.com/Samsung/thorvg/master/src/examples/images/tiger.svg" /></div><div class="posttext"><a href="https://github.com/Samsung/thorvg.viewer" target="_blank">Thorvg Viewer</a> can load graphics from an outside source. To load a resource at startup, enter its link through the url parameter s (?s=[link]). Such url can be easily shared online. Live example: <a href="https://samsung.github.io/thorvg.viewer/?s=https://raw.githubusercontent.com/Samsung/thorvg/master/src/examples/images/tiger.svg" target="_blank" id="url-example">https://samsung.github.io/thorvg.viewer/?s=https://raw.githubusercontent.com/Samsung/thorvg/master/src/examples/images/tiger.svg</a></div><footer><a class="button" id="popup-cancel">Cancel</a><a class="button" id="popup-ok">Add</a></footer></div>';
	popup.setAttribute('class', 'popup');
	document.body.appendChild(popup);

	requestAnimationFrame(() => {
		popup.children[0].setAttribute('class', 'faded');
	});

	document.getElementById("url-field").addEventListener("input", (evt)=>{
		var example = document.getElementById("url-example");
		var exampleUrl = "https://samsung.github.io/thorvg.viewer/?s=" + encodeURIComponent(evt.target.value);
		example.href = exampleUrl;
		example.innerHTML = exampleUrl;
	}, false);

	document.getElementById("popup-cancel").addEventListener("click", deletePopup, false);
	document.getElementById("popup-ok").addEventListener("click", addByUrl, false);
}
	