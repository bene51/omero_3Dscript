from omeroweb.webclient.decorators import login_required
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
import tempfile
import os
import datetime
import shutil
import traceback
from . import fiji
import logging
import pid

logger = logging.getLogger(__name__)

@login_required()
def getImages(request, conn=None, **kwargs):
     dataset_ids = request.GET.getlist('dataset_id[]')
     image_ids = request.GET.getlist('image_id[]')

     images = []
     for datasetId in dataset_ids:
          for image in conn.getObjects('Image', opts={'dataset': datasetId}):
               images.append({'id': image.getId(), 'name': image.getName()})

     for image_id in image_ids:
         image = conn.getObject("Image", image_id)
         if image is None:
              return JsonResponse({'error': "Image " + image_id + " cannot be accessed"})
         images.append({'id': image_id, 'name': image.getName()})

     return JsonResponse({'images': images})

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
     outputtype = ''
     aId = -1
     resp = {'state': state, 'progress': progress, 'position': position}
     if state.startswith('ERROR'):
          exc = fiji.getStacktrace(basename)
          resp['stacktrace'] = exc
     elif state.startswith('FINISHED'):
          outputtype, vaId, iaId = fiji.getTypeAndAttachmentId(basename)
          resp['type'] = outputtype
          resp['videoAnnotationId'] = vaId
          resp['imageAnnotationId'] = iaId
     logger.info("return state: " + state)
     return JsonResponse(resp)

@login_required()
def cancelRendering(request, conn=None, **kwargs):
     logger.info("cancelRendering")
     basenames = request.GET.getlist('basename[]')
     fiji.cancelRendering(basenames)
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
          image_ids = request.GET.getlist('imageId[]')
          # image_id = request.GET['imageId']
          image_names = []
          for image_id in image_ids:
              image = conn.getObject("Image", image_id)
              if image is None:
                   raise Exception("Cannot retrieve image with id " + str(image_id))
              image_names.append(image.getName())

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
          idString = "+".join([str(i) for i in image_ids])
          #TODO do not try forever
          while True:
               try:
                    with pid.PidFile('3Dscript', force_tmpdir=True) as p:
                         basename = fiji.startRendering(host, \
                              sessionId, \
                              s, \
                              idString, \
                              tgtWidth, \
                              tgtHeight)
                         break
               except pid.PidFileError:
                         print("already locked");
          return JsonResponse({'basename': basename.split("+")})
     except Exception as exc:
          log = open("/tmp/errorlog.txt", "w")
          traceback.print_exc(file=log)
          log.close()
          stacktrace = traceback.format_exc()
          return JsonResponse({'error': str(exc), 'stacktrace': stacktrace})

