/*
 * Copyright (c) 2020 - 2025 the ThorVG project. All rights reserved.

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
var filetype;
var filename;
var filedata;
var size = 800;
var renderer = 'sw';

//console output
const ConsoleLogTypes = { None : '', Inner : 'console-type-inner', Error : 'console-type-error', Warning : 'console-type-warning' };

(function () {
    var baseConsole = console.log;
    console.log = (...args) => {
        if (args[0] && typeof args[0] === 'string') {
            //slice at the log reset color: "\033[0m"
            if (filetype === "svg" && args[0].indexOf("SVG") > 0) consoleLog(args[0].slice(args[0].lastIndexOf("[0m") + 4), ConsoleLogTypes.Warning);
            else if ((filetype === "json" || filetype === "lot") && args[0].indexOf("LOTTIE") > 0) consoleLog(args[0].slice(args[0].lastIndexOf("[0m") + 4), ConsoleLogTypes.Warning);
        }
        baseConsole(...args);
    };
})();

//renderer support check
function isWebGLAvailable() {
    try {
        var canvas = document.createElement('canvas');
        return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
}

function isWebGPUAvailable() {
    return typeof navigator.gpu !== 'undefined';
}

function checkRendererSupport() {
    const rendererDropdown = document.getElementById('renderer-dropdown');
    const rendererOptions = rendererDropdown.querySelectorAll('option');
    rendererOptions.forEach(option => {
        const shouldDisable = (option.value === 'gl' && !isWebGLAvailable()) || (option.value === 'wg' && !isWebGPUAvailable());
        option.disabled = shouldDisable;
    });
}

//initialization
window.onload = () => {
    initialize();
    checkRendererSupport();
    filesList = new Array();
    loadFromWindowURL();

  consoleLog("ThorVG module loaded correctly", ConsoleLogTypes.Inner);
}

function createTabs() {
    // File tab
    var size = player.size;
    var sizeText = ((size[0] % 1 === 0) && (size[1] % 1 === 0)) ?
        size[0].toFixed(0) + " x " + size[1].toFixed(0) :
        size[0].toFixed(2) + " x " + size[1].toFixed(2);

    var file = document.getElementById("file-detail");
    file.textContent = '';
    file.appendChild(createTitleLine("File Name", filename));
    file.appendChild(createTitleLine("Resolution", sizeText));

    async function handleExportPngClick() {
        try {
            await player.save2png();
        } catch (err) {
            let message = "Unable to save the Png data.";
            consoleLog(message, ConsoleLogTypes.Error);
            alert(message);
        }
    }
    document.getElementById("export-png").addEventListener("click", handleExportPngClick);

    async function handleExportGifClick() {
        try {
            if (!filedata) {
                throw new Error("File data is not defined. Please upload a valid file before exporting.");
            }
            player.save2gif(filedata);
        } catch (err) {
            let message = err.message || "Unable to save the Gif data.";
            consoleLog(message, ConsoleLogTypes.Error);
            alert(message);
        }
    }
    document.getElementById("export-gif").addEventListener("click", handleExportGifClick);
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
    window.addEventListener('drop', (evt)=> {
        fileDropOrBrowseHandle(evt.dataTransfer.files);
    }, false);

    document.getElementById("image-placeholder").addEventListener("click", openFileBrowse, false);
    document.getElementById("image-file-selector").addEventListener("change", (evt)=> {
        fileDropOrBrowseHandle(document.getElementById('image-file-selector').files);
        evt.target.value = '';
    }, false);

    document.getElementById("nav-dark-mode").addEventListener("change", onDarkMode, false);
    document.getElementById("nav-stats-mode").addEventListener("change", onStatsMode, false);
    document.getElementById("nav-history").addEventListener("click", onConsoleWindow, false);
    document.getElementById("renderer-dropdown").addEventListener("change", onRendererMode, false);
    document.querySelector('.button-stats').addEventListener('click', () => {
    const checkbox = document.querySelector('#nav-stats-mode input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        console.log('Stats checkbox is now', checkbox.checked ? 'checked' : 'unchecked');
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
    document.querySelector('.button-dark').addEventListener('click', () => {
    const checkbox = document.querySelector('#nav-dark-mode input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        console.log('Stats checkbox is now', checkbox.checked ? 'checked' : 'unchecked');
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    document.getElementById("zoom-slider").addEventListener("input", onZoomSlider, false);
    document.getElementById("zoom-value").addEventListener("keydown", onZoomValue, false);

    document.getElementById("progress-slider").addEventListener("input", onProgressSlider, false);
    document.getElementById("progress-play").addEventListener("click", onProgressPlay, false);
    document.getElementById("progress-pause").addEventListener("click", onProgressPause, false);
    document.getElementById("progress-stop").addEventListener("click", onProgressStop, false);

    document.getElementById("add-file-local").addEventListener("click", openFileBrowse, false);
    document.getElementById("add-file-url").addEventListener("click", onAddFileUrl, false);

    document.getElementById('drawer-toggle').addEventListener('click', openDrawer, true);
    document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer, false);
    document.querySelector('.ctrl-button.close').addEventListener("click", closeDrawer, false);
    document.querySelector('.ctrl-button.dark').addEventListener("click", onDarkMode, false);
    document.querySelector('.ctrl-button.stats').addEventListener('click', function () {
        const toggle = document.getElementById('nav-stats-mode');
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'))
    });
    document.querySelector('.ctrl-button.history').addEventListener("click", onConsoleWindow, false);
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            // Inline style removed => CSS media query reapplied
            actions.style.right = '';
        }
    });
}

function openFileBrowse() {
    document.getElementById('image-file-selector').click();
}

const allowedExtensionList = ['svg', 'json', 'png', 'jpg', 'jpeg', 'lot', 'webp'];

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

function loadData(data, fileExtension) {
    filedata = data;

    // Cleanup any existing lottie-player elements
    const existingPlayers = document.querySelectorAll('lottie-player');
    existingPlayers.forEach(player => {
        player.destroy();
        player.remove();
    });

    player = document.createElement('lottie-player');
    player.autoPlay = true;
    player.loop = true;
    player.wasmUrl = 'thorvg-wasm.wasm';
    player.renderConfig = { renderer };
    attachAllEventListeners();
    document.querySelector('#image-area').appendChild(player);

    // FIXME: delay should be removed
    setTimeout(async () => {
        await player.load(data, fileExtension);
        resize(size, size);
        createTabs();
        showImageCanvas();
        createFilesListTab();
        enableZoomContainer();
        enableProgressContainer();
    }, 100);
}

function loadFile(file) {
    filename = file.name;
    const fileExtension = filename.split('.').pop().toLowerCase();
    const isLottie = fileExtension.endsWith('json') || fileExtension.endsWith('lot');
    var reader = new FileReader();

    reader.onload = async function(e) {
        const data = isLottie ? JSON.parse(e.target.result) : e.target.result;
        loadData(data, fileExtension);
    };

    if (isLottie) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

function loadUrl(url) {
    const fileExtension = url.split('.').pop().toLowerCase();
    player.load(url, fileExtension);

    showImageCanvas();
    enableZoomContainer();
    enableProgressContainer();
}

function createFilesListTab() {
    var container = document.getElementById("files-list").children[0];
    container.textContent = '';
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

// Main image section
function showImageCanvas() {
    var placeholder = document.getElementById("image-placeholder");
    player.classList.remove("hidden");
    placeholder.classList.add("hidden");
}

// Zoom slider
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

function onDarkMode(event) {
    document.body.classList.toggle("dark-mode", event.target.checked);
}

function onStatsMode(event) {
    if (event.target.checked) {
        // Create and inject script element for stats.js
        const statsScript = document.createElement('script');
        statsScript.src = 'https://mrdoob.github.io/stats.js/build/stats.min.js';
        statsScript.onload = () => {
            // Initialize FPS panel
            const statsFPS = new Stats();
            statsFPS.showPanel(0);
            statsFPS.dom.classList.add("stats");
            statsFPS.dom.style.cssText = "position:fixed;top:16px;left:20px;cursor:pointer;opacity:0.9;z-index:200";
            document.body.appendChild(statsFPS.dom);

            // Initialize MS panel
            const statsMS = new Stats();
            statsMS.showPanel(1);
            statsMS.dom.classList.add("stats");
            statsMS.dom.style.cssText = "position:fixed;top:16px;left:100px;cursor:pointer;opacity:0.9;z-index:200";
            document.body.appendChild(statsMS.dom);

            // Initialize MB panel if supported
            let statsMB;
            if (self.performance && self.performance.memory) {
                statsMB = new Stats();
                statsMB.showPanel(2);
                statsMB.dom.classList.add("stats");
                statsMB.dom.style.cssText = "position:fixed;top:16px;left:180px;cursor:pointer;opacity:0.9;z-index:200";
                document.body.appendChild(statsMB.dom);
            }

            // Start animation loop
            function animate() {
                statsFPS.begin();
                statsMS.begin();
                if (statsMB) statsMB.begin();

                statsFPS.end();
                statsMS.end();
                if (statsMB) statsMB.end();

                requestAnimationFrame(animate);
            }

            requestAnimationFrame(animate);
        };
        document.head.appendChild(statsScript);
        return;
    }

    // Remove stats.js panels and script when benchmark mode is disabled
    const statsPanels = document.querySelectorAll('div[class="stats"]');
    statsPanels.forEach(panel => panel.remove());

    const statsScript = document.querySelector('script[src*="stats.js"]');
    if (statsScript) {
        statsScript.remove();
    }
}

function onRendererMode(event) {
  const versionEl = document.getElementById('version');
  switch (event.target.value) {
    case 'sw':
      renderer = 'sw';
      versionEl.textContent = versionEl.textContent.split('·')[0] + '· Software';
      break;
    case 'wg':
      renderer = 'wg';
      versionEl.textContent = versionEl.textContent.split('·')[0] + '· WebGPU';
      break;
    case 'gl':
      renderer = 'gl';
      versionEl.textContent = versionEl.textContent.split('·')[0] + '· WebGL';
      break;
    default:
      return;
  }
  if (!filedata) {
    return;
  }
  loadData(filedata, filetype);
}

function onConsoleWindow(event) {
    document.getElementById("console-area").classList.toggle("hidden");
}

/*
function onConsoleBottom(event) {
    var consoleWindow = document.getElementById("console-area");
    consoleWindow.scrollTop = consoleWindow.scrollHeight;
}
*/

function onZoomSlider(event) {
    var value = event.target.value;
    size = Math.floor(512 * (value / 100 + 0.25));

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
    popup.innerHTML = '<div><header>Add file by URL</header><div class="input-group"><span>https://</span><input type="text" id="url-field" placeholder="raw.githubusercontent.com/thorvg/thorvg/main/src/examples/images/tiger.svg" /></div><div class="posttext"><a href="https://github.com/thorvg/thorvg.viewer" target="_blank">Thorvg Viewer</a> can load graphics from an outside source. To load a resource at startup, enter its link through the url parameter s (?s=[link]). Such url can be easily shared online. Live example: <a href="https://thorvg.github.io/thorvg.viewer/?s=https://raw.githubusercontent.com/thorvg/thorvg/main/src/examples/images/tiger.svg" target="_blank" id="url-example">https://thorvg.github.io/thorvg.viewer/?s=https://raw.githubusercontent.com/thorvg/thorvg/main/src/examples/images/tiger.svg</a></div><footer><a class="popup-button" id="popup-cancel">Cancel</a><a class="popup-button" id="popup-ok">Add</a></footer></div>';
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
    textLine.setAttribute('class', 'line-content');
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

function createDropDown(text) {
    var dropdown = document.createElement("div");
    dropdown.setAttribute('class', 'dropdown');
    dropdown.innerHTML = text;
    return dropdown;
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

    var trash = document.createElement("button");
    trash.setAttribute('class', 'ctrl-button trash');
    trash.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0L284.2 0c12.1 0 23.2 6.8 28.6 17.7L320 32l96 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 7.2-14.3zM32 128l384 0 0 320c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-320zm96 64c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16z"/></svg>';
    trash.addEventListener("click", (event) => {
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

function openDrawer() {
    const drawer = document.querySelector('.drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const actions = document.querySelector('.actions');
    drawer.classList.add('open');
    backdrop.classList.add('show');
    if (window.innerWidth <= 1023) {
        actions.style.right = '340px';
    }
}

function closeDrawer() {
    const drawer = document.querySelector('.drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const actions = document.querySelector('.actions');
    drawer.classList.remove('open');
    backdrop.classList.remove('show');
    if (window.innerWidth <= 1023) {
        actions.style.right = '80px';
    }
}