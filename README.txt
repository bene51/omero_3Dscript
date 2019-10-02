Requirements:
=============
OpenCL capable graphics card
Updated drivers


Install Fiji:
=============
- cd /usr/local/share/
- wget https://downloads.imagej.net/fiji/latest/fiji-linux64.zip
- unzip fiji-linux64.zip
- rm fiji-linux64.zip
- cd Fiji.app
- ./ImageJ-linux64 --update update
- ./ImageJ-linux64 --update add-update-site 3Dscript "https://romulus.oice.uni-erlangen.de/updatesite/"
- ./ImageJ-linux64 --update update

- omero config append omero.web.apps '"omero_3dscript"'
- omero config append omero.web.ui.top_links '["3Dscript", "3Dscript_index", {"title": "Open 3Dscript in a new tab", "target": "_blank"}]'
- omero config append omero.web.open_with '["3Dscript", "3Dscript_index", {"supported_objects":["image"], "target": "_blank", "label": "3Dscript"}]'
- omero web restart
