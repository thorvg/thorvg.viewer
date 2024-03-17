/*
 * Copyright (c) 2020 - 2024 the ThorVG project. All rights reserved.

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

import { getManifest , getAnimation , loadFromArrayBuffer, loadFromURL } from "https://esm.sh/@dotlottie/dotlottie-js@0.7.1?bundle-deps"

async function extractLottie(dotLottie) {
	const manifest = await getManifest(dotLottie);
	const animationId = manifest.activeAnimationId || manifest.animations[0]?.id || '';
	if (!animationId) throw new Error('No animation found');

	const data = await getAnimation(dotLottie, animationId, {
	  inlineAssets: true,
	});
  
	return data;
}
  
async function loadDotLottieFromArrayBuffer(arrayBuffer) {
	const dotLottie = await loadFromArrayBuffer(arrayBuffer);
	return extractLottie(dotLottie);
}
  
async function loadDotLottieFromUrl(url) {
	const dotLottie = await loadFromURL(url);
	return extractLottie(dotLottie);
}

var player;
var filesList;
var filetype;
var filename;

//console output
const ConsoleLogTypes = { None : '', Inner : 'console-type-inner', Error : 'console-type-error', Warning : 'console-type-warning' };

(function () {
	var baseConsole = console.log;
	console.log = (...args) => {
		if (args[0] && typeof args[0] === 'string') {
			//slice at the log reset color: "\033[0m"
			if (filetype === "svg" && args[0].indexOf("SVG") > 0) consoleLog(args[0].slice(args[0].lastIndexOf("[0m") + 4), ConsoleLogTypes.Warning);
			else if (filetype === "tvg" && args[0].indexOf("TVG") > 0) consoleLog(args[0].slice(args[0].lastIndexOf("[0m") + 4), ConsoleLogTypes.Warning);
			else if (filetype === "json" && args[0].indexOf("LOTTIE") > 0) consoleLog(args[0].slice(args[0].lastIndexOf("[0m") + 4), ConsoleLogTypes.Warning);
		}
		//baseConsole(...args);
	};
})();

//initialization
window.onload = () => {
	player = document.querySelector('lottie-player');
	attachAllEventListeners();

	initialize();
	filesList = new Array();
	loadFromWindowURL();

  consoleLog("ThorVG module loaded correctly", ConsoleLogTypes.Inner);
}

function createTabs() {
	//file tab
	var size = player.size;
	var sizeText = ((size[0] % 1 === 0) && (size[1] % 1 === 0)) ?
		size[0].toFixed(0) + " x " + size[1].toFixed(0) :
		size[0].toFixed(2) + " x " + size[1].toFixed(2);

	var file = document.getElementById("file");
	file.textContent = '';
	file.appendChild(createHeader("Details"));
	file.appendChild(createTitleLine("Filename", filename));
	file.appendChild(createTitleLine("Resolution", sizeText));
	file.appendChild(createHeader("Export"));
	
	var lineExportTvg = createPropertyLine("Export .tvg file");
	lineExportTvg.addEventListener("click", async () => {
		try {
			await player.save('tvg');
		} catch (err) {
			let message = "Unable to save the TVG data.";
			consoleLog(message, ConsoleLogTypes.Error);
			alert(message);
		}
	}, false);
	file.appendChild(lineExportTvg);

	var lineExportPng = createPropertyLine("Export .png file");
	lineExportPng.addEventListener("click", async () => {
		try {
			await player.save('png');
		} catch (err) {
			let message = "Unable to save the Png data.";
			consoleLog(message, ConsoleLogTypes.Error);
			alert(message);
		}
	}, false);
	file.appendChild(lineExportPng);

	var lineExportGif = createPropertyLine("Export .gif file");
	lineExportGif.addEventListener("click", async () => {
		try {
			await player.save('gif');
		} catch (err) {
			let message = "Unable to save the Gif data.";
			consoleLog(message, ConsoleLogTypes.Error);
			alert(message);
		}
    }, false);
	file.appendChild(lineExportGif);

	//switch to file list in default.
	onShowFilesList();
}

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


function initialize() {
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

const allowedExtensionList = ['tvg', 'svg', 'json', 'png', 'jpg', 'jpeg', 'webp', 'lottie'];

function allowedFileExtension(filename) {
	filetype = filename.split('.').pop().toLowerCase();
	return allowedExtensionList.includes(filetype);
}

function fileDropHighlight(event) {
	event.preventDefault();
	event.stopPropagation();
	event.dataTransfer.dropEffect = 'copy';
}

function fileDropUnhighlight(event) {
	event.preventDefault();
	event.stopPropagation();
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

	const targetFile = filesList[filesList.length - 1];
	loadFile(targetFile);
	return false;
}

function frameCallback() {
	refreshProgressValue();
}

function loadCallback() {
	consoleLog("Loading file " + filename, ConsoleLogTypes.Inner);
}

function errorCallback() {
	consoleLog("Loading file " + filename, ConsoleLogTypes.Inner);
}

function attachAllEventListeners() {
	player.addEventListener('frame', frameCallback);
	player.addEventListener('load', loadCallback);
	player.addEventListener('error', errorCallback);
}

function loadFile(file) {
	filename = file.name;
	const fileExtension = filename.split('.').pop().toLowerCase();
	const isLottie = fileExtension.endsWith('json');
	const isDotLottie = fileExtension.endsWith('lottie');
	var reader = new FileReader();

	reader.onload = async function(e) {
		let data;
		let extension = fileExtension;

		if (isLottie){
			data = JSON.parse(e.target.result);
		} else if (isDotLottie){
			data = await loadDotLottieFromArrayBuffer(e.target.result);
			extension = 'json';
		} else {
			data = e.target.result;
		}

		await player.load(data, extension);

		showAside();
		createTabs();
		showImageCanvas();
		createFilesListTab();
		enableZoomContainer();
		enableProgressContainer();
	};

	if (isLottie) {
		reader.readAsText(file);
	} else {
		reader.readAsArrayBuffer(file);
	}
}

async function loadUrl(url) {
	const fileExtension = url.split('.').pop().toLowerCase();
	const isDotLottie = fileExtension.endsWith('lottie');

	if(isDotLottie){
		const data = await loadDotLottieFromUrl(url);

		await player.load(data, 'json');
	} else {
		await player.load(url, fileExtension);
	}

	showImageCanvas();
	enableZoomContainer();
	enableProgressContainer();
	showPage("progress");
}

function createFilesListTab() {
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

			loadFile(file);
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
	var placeholder = document.getElementById("image-placeholder");
	player.classList.remove("hidden");
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

function resize(width, height) {
	player.style.width = `${width}px`;
	player.style.height = `${height}px`;
	player.resize(width, height);
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
	var size = Math.floor(512 * (value / 100 + 0.25));

	resize(size, size);
	refreshZoomValue();
}

function onZoomValue(event) {
	if (event.code === 'Enter') {
		var value = event.srcElement.innerHTML;
		var matched = value.match(/^(\d{1,5})\s*x\s*(\d{1,5})$/);
		if (matched) {
			resize(matched[1], matched[2]);
			refreshZoomValue();
		} else {
			event.srcElement.classList.add("incorrect");
		}
		event.preventDefault();
	}
}

function onProgressSlider(event) {
	player.seek((event.target.value / 100) * player.totalFrame);
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

  loadUrl(imageUrl);
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
	
	loadUrl(url);
}

function refreshProgressValue() {
	var slider = document.getElementById("progress-slider");
	slider.value = (player.currentFrame / player.totalFrame) * 100;
	var value = document.getElementById("progress-value");
	value.innerHTML = Math.round(player.currentFrame) + " / " + Math.floor(player.totalFrame);
}

function refreshZoomValue() {
	var value = document.getElementById("zoom-value");
	value.innerHTML = player.offsetWidth + " x " + player.offsetHeight;
	value.classList.remove("incorrect");
}

