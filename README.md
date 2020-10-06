Usage:
======
* Open OMERO.web in the browser
* Open OMERO.3Dscript:
    * by clicking on '3Dscript' on the top links
    * right-click an image in the explorer and select 'Open with' -> '3Dscript'
* Enter the animation text (see https://bene51.github.io/3Dscript/ for more details)
* Click on 'Render'

Requirements:
=============
* OpenCL capable graphics card
* Updated drivers


Installation:
=============
OMERO.3Dscript needs to be installed on the machine that runs OMERO.web.

* Install Fiji and the 3Dscript and 3Dscript.server plugins.
```bash
    FIJI_HOME=/usr/local/share/Fiji.app
    mkdir $FIJI_HOME
    cd `dirname $FIJI_HOME`
    wget https://downloads.imagej.net/fiji/latest/fiji-linux64.zip
    unzip fiji-linux64.zip
    cd Fiji.app
    ./ImageJ-linux64 --update add-update-site 3Dscript "https://romulus.oice.uni-erlangen.de/updatesite/"
    ./ImageJ-linux64 --update add-update-site 3Dscript-server "https://romulus.oice.uni-erlangen.de/imagej/updatesites/3Dscript-server/"
    ./ImageJ-linux64 --update update
    apt-get update && apt-get install -y -qq ffmpeg git vim > /dev/null
```
* Install OMERO.3Dscript
```bash
    pip install omero-3Dscript
```
* Add it to the OMERO.web UI:
```bash
    omero config append omero.web.apps '"omero_3Dscript"'
    omero config append omero.web.ui.top_links '["3Dscript", "3Dscript_index", {"title": "Open 3Dscript in a new tab", "target": "_blank"}]'
    omero config append omero.web.open_with '["3Dscript", "3Dscript_index", {"supported_objects": ["image"], "target": "_blank", "label": "3Dscript"}]'
```

* Restart OMERO.web as normal

