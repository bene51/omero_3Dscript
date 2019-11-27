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
import base64

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
     state, progress, position = fiji.getStateAndProgress(basename)
     logger.info("got state from fiji: " + state)
     exc = ''
     if state.startswith('ERROR'):
          with open(basename + ".err") as f:
               exc = f.read()
     logger.info("return state: " + state)
     return JsonResponse({'state': state, 'progress': progress, 'position': position, 'stacktrace': exc})

@login_required()
def cancelRendering(request, conn=None, **kwargs):
     logger.info("cancelRendering")
     basename = request.GET['basename']
     fiji.cancelRendering(basename)
     return JsonResponse({})

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
          s = request.GET['script']
          sessionId = conn.c.getSessionId()
          tgtWidth = request.GET['targetWidth']
          tgtHeight = request.GET['targetHeight']
          fiji.checkFijiPath()
          proc = os.getpid()
          logger.info("proc id = " + str(proc))
          host = conn.host;
          logger.info("host = " + str(host))
          #TODO do not try forever
          while True:
               try:
                    with pid.PidFile('3Dscript', force_tmpdir=True) as p:
                         basename = fiji.startRendering(host, \
                              sessionId, \
                              base64.urlsafe_b64encode(s), \
                              # basename, \
                              image_id, \
                              tgtWidth, \
                              tgtHeight)
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

