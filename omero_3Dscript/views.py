from omeroweb.webclient.decorators import login_required
from django.views.decorators.http import require_POST
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

@require_POST
@login_required()
def cancelRendering(request, conn=None, **kwargs):
     logger.info("cancelRendering")
     basenames = request.POST.getlist('basename[]')
     fiji.cancelRendering(basenames)
     return JsonResponse({})

@require_POST
@login_required()
def startRendering(request, conn=None, **kwargs):
     """ Shows a subset of Z-planes for an image """
     try:
          basename = None
          image_ids = request.POST.getlist('imageId[]')
          # image_id = request.GET['imageId']
          image_names = []
          for image_id in image_ids:
              image = conn.getObject("Image", image_id)
              if image is None:
                   raise Exception("Cannot retrieve image with id " + str(image_id))
              image_names.append(image.getName())

          user = conn.getUser().getName();
          s = request.POST['script']
          sessionId = conn.c.getSessionId()
          tgtWidth = request.POST['targetWidth']
          tgtHeight = request.POST['targetHeight']
          # do not check the fiji path because we might use
          # the fiji on a different computer
          # fiji.checkFijiPath()
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

