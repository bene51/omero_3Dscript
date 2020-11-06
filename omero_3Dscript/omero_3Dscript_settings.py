"""Settings for the omero-3Dscript app."""

import sys
from omeroweb.settings import process_custom_settings, report_settings

OMERO_3DSCRIPT_SETTINGS_MAPPING = {
    "omero.web.omero_3Dscript.processing_server":
        ["OMERO_3DSCRIPT_PROCESSING_SERVER",
         "localhost",
         str,
         "IP/hostname of the machine running the Fiji 3Dscript server"],

    "omero.web.omero_3Dscript.fiji_bin":
        ["OMERO_3DSCRIPT_FIJI_BIN",
         "",
         str,
         "Path to the Fiji/ImageJ executable"],

    "omero.web.omero_3Dscript.omero_server_external_ip":
        ["OMERO_3DSCRIPT_OMERO_SERVER_EXTERNAL_IP",
         "",
         str,
         "IP/hostname of the omero server, to be used from the processing machine to download data. Normally, this might not need to be set, but in case OMERO.web accesses OMERO.server with an internal IP (e.g. when run inside a container), it is required to set this variable."],
}

process_custom_settings(sys.modules[__name__], 'OMERO_3DSCRIPT_SETTINGS_MAPPING')
report_settings(sys.modules[__name__])

