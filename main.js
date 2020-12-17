//IIFE setup function.
var player;
var errPrefix = 'SVG:';
var errMessage = '';

(function () {
    var head = document.head;
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'thorvg-wasm.js';
    head.appendChild(script);

    script.onload = _ => {
        Module.onRuntimeInitialized = _ => {
            player = new Player();
        };
    };
})();

(function () {
    var old = console.log;
    var logger = document.getElementById('log');
    console.log = function (message) {
       if (message.substring(0, errPrefix.length) == errPrefix) errMessage += message.replace('SVG: ', '') + '\n';
       old(message);
    }
})();

class Player
{
    file_name;

    printLogHeader()
    {
        document.getElementById("p-log-textarea").value = 'File: ' + this.file_name + '\n';
    }

    render()
    {
        this.thorvg.update(this.canvas.width, this.canvas.height);
        var buffer = this.thorvg.render();

        var clampedBuffer = Uint8ClampedArray.from(buffer);
        var imageData = new ImageData(clampedBuffer, this.canvas.width, this.canvas.height);

        var context = this.canvas.getContext('2d');
        context.putImageData(imageData, 0, 0);

        document.getElementById("p-slider-size").innerHTML = this.canvas.width + " x " + this.canvas.height;
    }

    load(data)
    {
        console.log(data);
        if (data.length == 0) {
            this.file_name = 'thorvg.svg';
            data = this.thorvg.getDefaultData();
        }
        this.printLogHeader();
        document.getElementById("p-data-textarea").value = data;
        this.thorvg.load(data, this.canvas.width, this.canvas.height);
        if (errMessage.length > 0) {
            document.getElementById("p-log-textarea").value += errMessage;
            errMessage = '';
        }
    }

    handleFiles(files)
    {
        for (var i = 0, f; f = files[i]; i++) {
            if (f.type.includes('svg')) {
                var read = new FileReader();
                read.readAsText(f);
                this.file_name = f.name;
                read.onloadend = ()=> {
                    this.load(read.result);
                    this.render();
                }
                break;
            }
        }
    }

    constructor()
    {
        this.canvas = document.getElementById("p-canvas");

        document.getElementById("p-slider").value = 512 / 800 * 100;
        layout(document.getElementById("p-slider").value / 100);

        this.thorvg = new Module.ThorvgWasm();
        this.load("");
        this.render();

        document.getElementById("p-data-btn").addEventListener('click', ()=>{this.load(document.getElementById("p-data-textarea").value);
                                                                             this.render();});
        document.getElementById("p-selector-btn").addEventListener('click', ()=>{document.getElementById("p-selector").click();});
        document.getElementById('p-selector').addEventListener('change', ()=>{this.handleFiles(document.getElementById('p-selector').files);});
        window.addEventListener('dragover', (evt)=>{
                                                evt.stopPropagation();
                                                evt.preventDefault();
                                                evt.dataTransfer.dropEffect = 'copy';
                                            }, false);
        window.addEventListener('drop', (evt)=>{
                                            evt.stopPropagation();
                                            evt.preventDefault();
                                            this.handleFiles(evt.dataTransfer.files);
                                        }, false);
    }
}

function layout(ratio) {
    var size;
    var width = document.getElementById("p-content").clientWidth;
    var height = document.getElementById("p-content").clientHeight;

    if (width < height)
        size = width;
    else
        size = height;

    size = size - 10;
    size = size * ratio;

    if (size < 60 )
      size = 60;

    document.getElementById("p-canvas").width = size;
    document.getElementById("p-canvas").height = size;
}

function onResizeSliderDrag(value) {
    layout(value/100);
    player.render();
}

function showHideEditor(editorBlockID) {
    var editorBlock = document.getElementById(editorBlockID);
    var editorBtn = document.getElementById("p-editor-btn");
    if (!editorBlock) return;
    if (editorBlock.style.display == 'none') {
        editorBlock.style.display = 'block';
        editorBtn.value = "Close Editor";
    } else {
        editorBlock.style.display = 'none';
        editorBtn.value = "Open Editor";
    }
}

var prevSize;
function bodyResized() {
    var width = document.getElementById("p-content").clientWidth;
    var height = document.getElementById("p-content").clientHeight;
    var canvasW = document.getElementById("p-canvas").width;
    var canvasH = document.getElementById("p-canvas").height;

    var size = (width < height) ? width : height;
    var canvasSize = (canvasW < canvasH) ? canvasW : canvasH;

    if (canvasSize > size) {
        layout(1);
        player.render();
    } else if (prevSize < size) {
        document.getElementById("p-slider").value = (canvasSize / size) * 100;
    }

    prevSize = size;
}
