from omeroweb.webclient.decorators import login_required
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
import tempfile
import os
import datetime
import shutil
from pytiff import PyTiff
import traceback
import fiji

# FIJI_DIR = "/usr/local/share/Fiji.app/"
# FIJI_BIN = FIJI_DIR + "ImageJ-linux64"

FIJI_DIR = "/Users/bene/Fiji.app/"
FIJI_BIN = FIJI_DIR + "Contents/MacOS/ImageJ-macosx"



@login_required()
def index(request, conn=None, **kwargs):
     """ Shows a subset of Z-planes for an image """
     image_id = 1
     image = conn.getObject("Image", image_id)
     image_name = image.getName()
     size_z = image.getSizeZ()
     z_indexes = [0, int(size_z*0.25), int(size_z*0.5),
          int(size_z*0.75), size_z-1]
     return render(request, '3Dscript/index.html',
           {'imageId': image_id, 'image_name': image_name,
            'z_indexes': z_indexes})

@login_required()
def getStateAndProgress(request, conn=None, **kwargs):
     basename = request.GET['basename']
     state, progress = fiji.getStateAndProgress(basename)
     return JsonResponse({'state': state, 'progress': progress})

@login_required()
def createAnnotation(request, conn=None, **kwargs):
     try:
          # raise Exception("Cannot create Annotation")
          basename = request.GET['basename']
          imageid = request.GET['imageId']
          image = conn.getObject("Image", imageid)
          mp4file = basename + '.mp4'
          animationfile = basename + '.animation.txt'
          namespace = "oice/3Dscript"
          gid = image.getDetails().getGroup().getId()
          conn.SERVICE_OPTS.setOmeroGroup(gid)
          file_ann = conn.createFileAnnfromLocalFile(animationfile, mimetype="text/plain", ns=namespace, desc=None)
          image.linkAnnotation(file_ann)
          file_ann = conn.createFileAnnfromLocalFile(mp4file, mimetype="video/mp4", ns=namespace, desc=None)
          image.linkAnnotation(file_ann)
          aId = file_ann.getId()
          # os.remove(avifile)
          # os.remove(mp4file)
          # os.remove(animationfile)
          # os.remove(macrofile)
          return JsonResponse({'annotationId': aId})
     except Exception as exc:
          log = open("/tmp/errorlog.txt", "w")
          traceback.print_exc(file=log)
          log.close()
          return JsonResponse({'error': str(exc)})


@login_required()
def startRendering(request, conn=None, **kwargs):
     """ Shows a subset of Z-planes for an image """
     try:
          basename = None
          image_id = 1
          image = conn.getObject("Image", image_id)
          image_name = image.getName()
          user = conn.getUser().getName();
          basename = os.path.join(tempfile.gettempdir(), user + "-" + datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S"))
          basename = "/tmp/" + user + "-" + datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
          s = request.GET['script']
          writeAnimationFile(s, basename)
          sessionId = conn.c.getSessionId()
          tgtWidth = request.GET['targetWidth']
          tgtHeight = request.GET['targetHeight']
          fiji.startRendering('10.210.16.80', sessionId, basename, image_id, tgtWidth, tgtHeight)
          return JsonResponse({'basename': basename, 'sessionId': sessionId}) #TODO remove session id
     except Exception as exc:
          log = open("/tmp/errorlog.txt", "w")
          traceback.print_exc(file=log)
          log.close()
          return JsonResponse({'error': str(exc)}) #TODO remove session id




def writeAnimationFile(script, basename):
     animationFile = basename + ".animation.txt"
     with open(animationFile, 'w') as f:
          f.write(script)

