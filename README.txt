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

