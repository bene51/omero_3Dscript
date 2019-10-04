from omeroweb.webclient.decorators import login_required
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
import tempfile
import os
import datetime
import shutil
import traceback
import fiji
import logging
import pid

# FIJI_DIR = "/usr/local/share/Fiji.app/"
# FIJI_BIN = FIJI_DIR + "ImageJ-linux64"

FIJI_DIR = "/Users/bene/Fiji.app/"
FIJI_BIN = FIJI_DIR + "Contents/MacOS/ImageJ-macosx"

logger = logging.getLogger(__name__)

@login_required()
def getName(request, conn=None, **kwargs):
     image_id = request.GET['image']
     image = conn.getObject("Image", image_id)
     if image is None:
          return JsonResponse({'error': "Image " + image_id + " cannot be accessed"})
     image_name = image.getName();
     return JsonResponse({'name': image_name})

@login_required()
def index(request, conn=None, **kwargs):
     """ Shows a subset of Z-planes for an image """
     image_id = request.GET.get('image', -1)
     logger.info("image id = " + str(image_id))
     image_name = ""
     if image_id != -1:
          image = conn.getObject("Image", image_id)
          image_name = image.getName()
     return render(request, '3Dscript/index.html',
           {'imageId': image_id, 'image_name': image_name})

@login_required()
def getStateAndProgress(request, conn=None, **kwargs):
     basename = request.GET['basename']
     logger.info("getting state from fiji: ")
     state, progress = fiji.getStateAndProgress(basename)
     logger.info("got state from fiji: " + state)
     exc = ''
     if state.startswith('ERROR'):
          with open(basename + ".err") as f:
               exc = f.read()
     logger.info("return state: " + state)
     return JsonResponse({'state': state, 'progress': progress, 'stacktrace': exc})

@login_required()
def createAnnotation(request, conn=None, **kwargs):
     try:
          # raise Exception("Cannot create Annotation")
          basename = request.GET['basename']
          imageid = request.GET['imageId']
          image = conn.getObject("Image", imageid)
          animationfile = basename + '.animation.txt'
          namespace = "oice/3Dscript"
          gid = image.getDetails().getGroup().getId()
          conn.SERVICE_OPTS.setOmeroGroup(gid)
          file_ann = conn.createFileAnnfromLocalFile(animationfile, mimetype="text/plain", ns=namespace, desc=None)
          image.linkAnnotation(file_ann)
          file_ann = None
          isVideo = False
          mp4file = basename + '.mp4'
          if os.path.isfile(mp4file):
               file_ann = conn.createFileAnnfromLocalFile(mp4file, mimetype="video/mp4", ns=namespace, desc=None)
               isVideo = True
          else:
               pngfile = basename + '.png'
               file_ann = conn.createFileAnnfromLocalFile(pngfile, mimetype="image/png", ns=namespace, desc=None)
          image.linkAnnotation(file_ann)
          aId = file_ann.getId()
          # os.remove(avifile)
          # os.remove(mp4file)
          # os.remove(animationfile)
          # os.remove(macrofile)
          return JsonResponse({'annotationId': aId, 'isVideo': isVideo})
     except Exception as exc:
          log = open("/tmp/errorlog.txt", "w")
          traceback.print_exc(file=log)
          log.close()
          stacktrace = traceback.format_exc()
          return JsonResponse({'error': str(exc), 'stacktrace': stacktrace})



@login_required()
def startRendering(request, conn=None, **kwargs):
     """ Shows a subset of Z-planes for an image """
     try:
          basename = None
          image_id = request.GET['imageId']
          image = conn.getObject("Image", image_id)
          if image is None:
               raise Exception("Cannot retrieve image with id " + str(image_id))
          image_name = image.getName()
          user = conn.getUser().getName();
          basename = os.path.join(tempfile.gettempdir(), user + "-" + datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S"))
          basename = "/tmp/" + user + "-" + datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
          s = request.GET['script']
          writeAnimationFile(s, basename)
          sessionId = conn.c.getSessionId()
          tgtWidth = request.GET['targetWidth']
          tgtHeight = request.GET['targetHeight']
          bbVisible = request.GET['bbVisible']
          bbColor = request.GET['bbColor']
          bbLinewidth = request.GET['bbLinewidth']
          sbVisible = request.GET['sbVisible']
          sbColor = request.GET['sbColor']
          sbLinewidth = request.GET['sbLinewidth']
          sbPosition = request.GET['sbPosition']
          sbOffset = request.GET['sbOffset']
          sbLength = request.GET['sbLength']
          fiji.checkFijiPath()
          proc = os.getpid()
          logger.info("proc id = " + str(proc))
          #TODO do not try forever
          while True:
               try:
                    with pid.PidFile('3Dscript', force_tmpdir=True) as p:
                         fiji.startRendering('localhost', \
                              sessionId, \
                              basename, \
                              image_id, \
                              tgtWidth, \
                              tgtHeight, \
                              bbVisible, \
                              bbColor, \
                              bbLinewidth, \
                              sbVisible, \
                              sbColor, \
                              sbLinewidth, \
                              sbPosition, \
                              sbOffset, \
                              sbLength)
                         break
               except pid.PidFileAlreadyLockedError:
                         print("already locked");
          return JsonResponse({'basename': basename})
     except Exception as exc:
          log = open("/tmp/errorlog.txt", "w")
          traceback.print_exc(file=log)
          log.close()
          stacktrace = traceback.format_exc()
          return JsonResponse({'error': str(exc), 'stacktrace': stacktrace})




def writeAnimationFile(script, basename):
     animationFile = basename + ".animation.txt"
     with open(animationFile, 'w') as f:
          f.write(script)

