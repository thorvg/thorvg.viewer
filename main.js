/*
 * Copyright (c) 2020 - 2023 the ThorVG project. All rights reserved.

 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

var player;
var filesList;

//initialization
(function () {
	window.onload = initialize();

	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = 'thorvg-wasm.js';
	document.head.appendChild(script);

	script.onload = _ => {
		Module.onRuntimeInitialized = _ => {
			filesList = new Array();
			player = new Player();
			loadFromWindowURL();
		};
	};
})();

//console output
const ConsoleLogTypes = { None : '', Inner : 'console-type-inner', Error : 'console-type-error', Warning : 'console-type-warning' };

(function () {
	var baseConsole = console.log;
	console.log = (...args) => {
		if (args[0] && typeof args[0] === 'string') {
			//slice at the log reset color: "\033[0m"
			if (player.filetype === "svg" && args[0].indexOf("SVG") > 0) consoleLog(args[0].slice(args[0].lastIndexOf("[0m") + 4), ConsoleLogTypes.Warning);
			else if (player.filetype === "tvg" && args[0].indexOf("TVG") > 0) consoleLog(args[0].slice(args[0].lastIndexOf("[0m") + 4), ConsoleLogTypes.Warning);
			else if (player.filetype === "json" && args[0].indexOf("LOTTIE") > 0) consoleLog(args[0].slice(args[0].lastIndexOf("[0m") + 4), ConsoleLogTypes.Warning);
		}
		//baseConsole(...args);
	};
})();

//console message
function consoleLog(message, type = ConsoleLogTypes.None) {
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

//for playing animations
function animLoop() {
	if (!player) return;
	if (player.update()) {
		player.render();
		refreshProgressValue()
		window.requestAnimationFrame(animLoop);
	}
}

class Player {

	filetype = "unknown";		//current file format: (tvg, svg, json)
	curFrame = 0;
	beginTime = 0;
	totalFrame = 0;
	repeat = true;
	playing = false;

	flush() {
		var context = this.canvas.getContext('2d');

		//draw the content image first
		context.putImageData(this.imageData, 0, 0);
	}

	render() {
		this.tvg.resize(this.canvas.width, this.canvas.height);
		if (this.tvg.update() === true) {
			var buffer = this.tvg.render();
			var clampedBuffer = Uint8ClampedArray.from(buffer);
			if (clampedBuffer.length == 0) return;
			this.imageData = new ImageData(clampedBuffer, this.canvas.width, this.canvas.height);

			this.flush();
		}
	}

	update() {
		if (!this.playing) return false;

		this.curFrame = ((Date.now() / 1000) - this.beginTime) / this.tvg.duration() * this.totalFrame;

		//finished
		if (this.curFrame >= this.totalFrame) {
			if (this.repeat) {
				this.play();
				return true;
			} else {
				this.playing = false;
				return false;
			}
		}
		return this.tvg.frame(this.curFrame);
	}

	stop() {
		player.playing = false;
		this.curFrame = 0;
		this.tvg.frame(0);
	}

	frame(curFrame) {
		this.pause();
		this.curFrame = curFrame;
		this.tvg.frame(this.curFrame);
	}

	pause() {
		player.playing = false;
	}

	play() {
		this.totalFrame = this.tvg.totalFrame();
		if (this.totalFrame === 0) return;
		this.beginTime = (Date.now() / 1000);
		if (!this.playing) {
			this.playing = true;
			window.requestAnimationFrame(animLoop);
		}
	}

	loadData(data, filename) {
		consoleLog("Loading file " + filename, ConsoleLogTypes.Inner);
		var ext = filename.split('.').pop();
		if (ext == "json") ext = "lottie";
		if (this.tvg.load(new Int8Array(data), ext, this.canvas.width, this.canvas.height)) {
			this.filename = filename;
			this.render();
			this.play();
			refreshZoomValue();
		} else {
			alert("Unable to load an image (" + filename + "). Error: " + this.tvg.error());
		}
	}

	loadFile(file) {
		let read = new FileReader();
		read.readAsArrayBuffer(file);
		read.onloadend = _ => {
			this.loadData(read.result, file.name);
			this.createTabs();
			showImageCanvas();
			enableZoomContainer();
			enableProgressContainer();
		}
	}

	loadUrl(url) {
		let request = new XMLHttpRequest();
		request.open('GET', url, true);
		request.responseType = 'arraybuffer';
		request.onloadend = _ => {
			if (request.status !== 200) {
				alert("Unable to load an image from url " + url);
				return;
			}
			let name = url.split('/').pop();
			this.loadData(request.response, name);
			this.createTabs();
			showImageCanvas();
			enableZoomContainer();
			deletePopup();
		};
	}

	createTabs() {
		//file tab
		var size = Float32Array.from(this.tvg.size());
		var sizeText = ((size[0] % 1 === 0) && (size[1] % 1 === 0)) ?
			size[0].toFixed(0) + " x " + size[1].toFixed(0) :
			size[0].toFixed(2) + " x " + size[1].toFixed(2);

		var file = document.getElementById("file");
		file.textContent = '';
		file.appendChild(createHeader("Details"));
		file.appendChild(createTitleLine("Filename", this.filename));
		file.appendChild(createTitleLine("Resolution", sizeText));
		file.appendChild(createHeader("Export"));
		var lineExportCompressedTvg = createPropertyLine("Export .tvg file (compression)");
		lineExportCompressedTvg.addEventListener("click", () => {player.save(true)}, false);
		file.appendChild(lineExportCompressedTvg);
		var lineExportNotCompressedTvg = createPropertyLine("Export .tvg file (no compression)");
		lineExportNotCompressedTvg.addEventListener("click", () => {player.save(false)}, false);
		file.appendChild(lineExportNotCompressedTvg);
		var lineExportPng = createPropertyLine("Export .png file");
		lineExportPng.addEventListener("click", exportCanvasToPng, false);
		file.appendChild(lineExportPng);

		//switch to file list in default.
		onShowFilesList();
	}

	save(compress) {
		if (this.tvg.save(compress)) {
			let data = FS.readFile('output.tvg');
			if (data.length < 33) {
				alert("Unable to save the TVG data. The generated file size is invalid.");
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
			let message = "Unable to save the TVG data. Error: " + this.tvg.error();
			consoleLog(message, ConsoleLogTypes.Error);
			alert(message);
		}
	}

	constructor() {
		this.tvg = new Module.TvgWasm();
		this.canvas = document.getElementById("image-canvas");
		consoleLog("ThorVG module loaded correctly", ConsoleLogTypes.Inner);
	}
}

function initialize() {
	window.addEventListener('drop', (evt)=>{
		fileDropOrBrowseHandle(evt.dataTransfer.files);
	}, false);

	document.getElementById("image-placeholder").addEventListener("click", openFileBrowse, false);
	document.getElementById("image-file-selector").addEventListener("change", (evt)=>{
		fileDropOrBrowseHandle(document.getElementById('image-file-selector').files);
		evt.target.value = '';
	}, false);

	document.getElementById("nav-toggle-aside").addEventListener("click", onToggleAside, false);
	document.getElementById("nav-progress").addEventListener("click", onShowProgress, false);
	document.getElementById("nav-file").addEventListener("click", onShowFile, false);
	document.getElementById("nav-files-list").addEventListener("click", onShowFilesList, false);
	document.getElementById("nav-dark-mode").addEventListener("change", onDarkMode, false);
	document.getElementById("nav-console").addEventListener("click", onConsoleWindow, false);

	document.getElementById("console-bottom-scroll").addEventListener("click", onConsoleBottom, false);

	document.getElementById("zoom-slider").addEventListener("input", onZoomSlider, false);
	document.getElementById("zoom-value").addEventListener("keydown", onZoomValue, false);

	document.getElementById("progress-slider").addEventListener("input", onProgressSlider, false);
	document.getElementById("progress-play").addEventListener("click", onProgressPlay, false);
	document.getElementById("progress-pause").addEventListener("click", onProgressPause, false);
	document.getElementById("progress-stop").addEventListener("click", onProgressStop, false);

	document.getElementById("add-file-local").addEventListener("click", openFileBrowse, false);
	document.getElementById("add-file-url").addEventListener("click", onAddFileUrl, false);
}

function openFileBrowse() {
	document.getElementById('image-file-selector').click();
}

function allowedFileExtension(filename) {
	player.filetype = filename.split('.').pop();
	return (player.filetype === "tvg") || (player.filetype === "svg") || (player.filetype === "json") || (player.filetype === "png") || (player.filetype === "jpg")
}

function fileDropOrBrowseHandle(files) {
	if (!player) return;

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

	player.loadFile(filesList[filesList.length - 1]);
	createFilesListTab();
	return false;
}

function createFilesListTab() {
	if (!player) return;

	var container = document.getElementById("files-list").children[0];
	container.textContent = '';
	container.appendChild(createHeader("List of files"));
	for (let i = 0; i < filesList.length; ++i) {
		let file = filesList[i];
		var lineFile = createFilesListLine(file);
		lineFile.addEventListener("dblclick", (event)=>{
			for (var el = event.target; !el.classList.contains('line'); el = el.parentNode) {
				if (el.tagName === "A") return;
			}
			player.loadFile(file);
		}, false);
		container.appendChild(lineFile);
	}
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

//progress slider
function enableProgressContainer(enable = true) {
	var slider = document.getElementById("progress-slider");
	slider.disabled = !enable;
	slider.value = 0;

	var value = document.getElementById("progress-value");
	value.innerHTML = 0 + " / " + player.totalFrame;
}

function onToggleAside() {
	var aside = document.getElementsByTagName("aside")[0];
	aside.classList.toggle("hidden");
}

function onShowProgress() {
	showPage("progress");
}

function onShowFile() {
	showPage("file");
}

function onShowFilesList() {
	showPage("files-list");
}

function onDarkMode(event) {
	document.body.classList.toggle("dark-mode", event.target.checked);
}

function onConsoleWindow(event) {
	document.getElementById("console-area").classList.toggle("hidden");
}

function onConsoleBottom(event) {
	var consoleWindow = document.getElementById("console-area");
	consoleWindow.scrollTop = consoleWindow.scrollHeight;
}

function onZoomSlider(event) {
	var value = event.target.value;
	var size = 512 * (value / 100 + 0.25);

	player.canvas.width = size;
	player.canvas.height = size;
	if (!player.playing) player.render();

	refreshZoomValue();
}

function onZoomValue(event) {
	if (event.code === 'Enter') {
		var value = event.srcElement.innerHTML;
		var matched = value.match(/^(\d{1,5})\s*x\s*(\d{1,5})$/);
		if (matched) {
			player.canvas.width = matched[1];
			player.canvas.height = matched[2];
			if (!player.playing) player.render();
			refreshZoomValue();
		} else {
			event.srcElement.classList.add("incorrect");
		}
		event.preventDefault();
	}
}

function onProgressSlider(event) {
	player.frame((event.target.value / 100) * player.totalFrame);
	player.render();
	refreshProgressValue();
}

function onProgressPlay() {
	player.play();
}

function onProgressPause() {
	player.pause();
}

function onProgressStop() {
	player.stop();
	player.render();

	//reset progress slider
	var slider = document.getElementById("progress-slider");
	slider.value = 0;

	var value = document.getElementById("progress-value");
	value.innerHTML = 0 + " / " + player.totalFrame;
}

function onAddFileUrl() {
	var popup = document.createElement("div");
	popup.innerHTML = '<div><header>Add file by URL</header><div class="input-group"><span>https://</span><input type="text" id="url-field" placeholder="raw.githubusercontent.com/thorvg/thorvg/main/src/examples/images/tiger.svg" /></div><div class="posttext"><a href="https://github.com/thorvg/thorvg.viewer" target="_blank">Thorvg Viewer</a> can load graphics from an outside source. To load a resource at startup, enter its link through the url parameter s (?s=[link]). Such url can be easily shared online. Live example: <a href="https://thorvg.github.io/thorvg.viewer/?s=https://raw.githubusercontent.com/thorvg/thorvg/main/src/examples/images/tiger.svg" target="_blank" id="url-example">https://thorvg.github.io/thorvg.viewer/?s=https://raw.githubusercontent.com/thorvg/thorvg/main/src/examples/images/tiger.svg</a></div><footer><a class="button" id="popup-cancel">Cancel</a><a class="button" id="popup-ok">Add</a></footer></div>';
	popup.setAttribute('class', 'popup');
	document.body.appendChild(popup);

	requestAnimationFrame(() => {
		popup.children[0].setAttribute('class', 'faded');
	});

	document.getElementById("url-field").addEventListener("input", (evt)=>{
		var example = document.getElementById("url-example");
		var exampleUrl = "https://thorvg.github.io/thorvg.viewer/?s=" + encodeURIComponent(evt.target.value);
		example.href = exampleUrl;
		example.innerHTML = exampleUrl;
	}, false);

	document.getElementById("popup-cancel").addEventListener("click", deletePopup, false);
	document.getElementById("popup-ok").addEventListener("click", addByUrl, false);
}

function loadFromWindowURL() {
	const urlParams = new URLSearchParams(window.location.search);
	const imageUrl = urlParams.get('s');
	if (!imageUrl) return;
	if (!allowedFileExtension(imageUrl)) {
		alert("Applied a file in an unsupported format.");
		return;
	}
	player.loadUrl(imageUrl);
}

function createPropertyLine(text) {
	var line = document.createElement("a");
	line.setAttribute('class', 'line');
	line.innerHTML = text;
	return line;
}

function createTitleLine(title, text) {
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

function createHeader(text) {
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

function createFilesListLine(file) {
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
	player.loadUrl(url);
}

function refreshProgressValue() {
	var slider = document.getElementById("progress-slider");
	slider.value = (player.curFrame / player.totalFrame) * 100;
	var value = document.getElementById("progress-value");
	value.innerHTML = Math.round(player.curFrame) + " / " + player.totalFrame;

}

function refreshZoomValue() {
	var canvas = document.getElementById("image-canvas");
	var value = document.getElementById("zoom-value");
	value.innerHTML = canvas.width + " x " + canvas.height;
	value.classList.remove("incorrect");
}