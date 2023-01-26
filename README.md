# ThorVG Viewer

ThorVG Viewer is a verification tool for ThorVG Engine. It does immediate rendering via web browser running on ThorVG web-assembly binary and allows real-time editing vector elements on it. Loader works locally and it does not upload the resources to any server outside, protecting the designer resource copyright.

https://user-images.githubusercontent.com/71131832/130445967-fb8f7d81-9c89-4598-b7e4-2c046d5d7438.mp4

## Usage
Click to use [ThorVG Viewer](https://thorvg.github.io/thorvg.viewer/) via github pages

## Other
[ThorVG github page](https://github.com/thorvg/thorvg)

[Guide to ThorVG Viewer development](https://github.com/thorvg/thorvg/wiki/ThorVG-Viewer-Development-Guide)

## Tricks
### Loading image from outside source
You can load a graphic from an outside source by entering its link through the url parameter `s` (`?s=[link]`). Such url can be easily shared online. Examples:

https://thorvg.github.io/thorvg.viewer/?s=https://raw.githubusercontent.com/thorvg/thorvg/master/src/examples/images/tiger.svg

https://thorvg.github.io/thorvg.viewer/?s=https://raw.githubusercontent.com/thorvg/thorvg/master/src/examples/images/test.tvg
