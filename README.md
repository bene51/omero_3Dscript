OMERO.3Dscript
==============

Usage
-----
* Open OMERO.web in the browser
* Open OMERO.3Dscript:
    * by clicking on '3Dscript' on the top links
    * right-click an image in the explorer and select 'Open with' -> '3Dscript'
* Enter the animation text (see https://bene51.github.io/3Dscript/ for more details)
* Click on 'Render'

Requirements for the server
---------------------------
* OpenCL capable graphics card
* Updated graphics drivers


Installation
------------
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
    apt-get update && apt-get install -y -qq ffmpeg > /dev/null
    ```
* Install OMERO.3Dscript
    ```bash
    pip install omero-3Dscript
    ```
* Tell OMERO.3Dscript where to find Fiji
    ```bash
    omero config set omero.web.omero_3Dscript.fiji_bin "/usr/local/share/Fiji.app/ImageJ-linux64"
    ```
    :warning: On Mac OS X, you need to replace `ImageJ-linux64` with `Contents/MacOS/ImageJ-macosx` 

* Add it to the OMERO.web UI:
    ```bash
    omero config append omero.web.apps '"omero_3Dscript"'
    omero config append omero.web.ui.top_links '["3Dscript", "3Dscript_index", {"title": "Open 3Dscript in a new tab", "target": "_blank"}]'
    omero config append omero.web.open_with '["3Dscript", "3Dscript_index", {"supported_objects": ["image"], "target": "_blank", "label": "3Dscript"}]'
    ```

* Restart OMERO.web as normal

Enabling the public user
------------------------
If you want to grant the 'public user' the permission to render 3D animations using 3Dscript, you need to enable it as described [here](https://docs.openmicroscopy.org/omero/5.6.3/sysadmins/public.html):

```bash
omero config set omero.web.public.enabled True
omero config set omero.web.public.user '<username>'
omero config set omero.web.public.password '<password>'
omero config set omero.web.public.url_filter '^/(webadmin/myphoto/|webclient/(?!(script_ui|ome_tiff|figure_script))|webgateway/(?!(archived_files|download_as))|iviewer|api|3Dscript)'
omero config set omero.web.public.get_only false
```
    
Pay attention to the last two lines.

See also
--------
* https://github.com/bene51/3Dscript
* https://github.com/bene51/3Dscript.server

Publication
-----------
Schmid B., Tripal P., Fraass T. & Palmisano R. (2019), "[3Dscript: animating 3D/4D microscopy data using a natural-language-based syntax](https://www.nature.com/articles/s41592-019-0359-1)", _Nature methods_ **16(4)**: 278-280, PMID 30886414.

Schmid B., Tripal P., Winter Z. & Palmisano R. (2021), "[3Dscript.server: true server-side 3D animation of microscopy images using a natural language-based syntax](https://academic.oup.com/bioinformatics/article/37/24/4901/6307261)", _Bioinformatics_ **37(24)**: 4901-4902, PMID 34152405.
