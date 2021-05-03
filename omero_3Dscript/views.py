from omeroweb.webclient.decorators import login_required
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie
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

@ensure_csrf_cookie
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

# https://stackoverflow.com/questions/33208849/python-django-streaming-video-mp4-file-using-httpresponse/41289535#41289535

import re
import mimetypes
from wsgiref.util import FileWrapper

from django.http import StreamingHttpResponse


range_re = re.compile(r'bytes\s*=\s*(\d+)\s*-\s*(\d*)', re.I)


class RangeFileWrapper(object):
    def __init__(self, filelike, blksize=8192, offset=0, length=None):
        self.filelike = filelike
        self.filelike.seek(offset, os.SEEK_SET)
        self.remaining = length
        self.blksize = blksize

    def close(self):
        if hasattr(self.filelike, 'close'):
            self.filelike.close()

    def __iter__(self):
        return self

    def __next__(self):
        if self.remaining is None:
            # If remaining is None, we're reading the entire file.
            data = self.filelike.read(self.blksize)
            if data:
                return data
            raise StopIteration()
        else:
            if self.remaining <= 0:
                raise StopIteration()
            data = self.filelike.read(min(self.remaining, self.blksize))
            if not data:
                raise StopIteration()
            self.remaining -= len(data)
            return data

import yaml

@login_required()
def getVideo(request, conn=None, **kwargs):
    basename = request.GET['basename']
    logger.info("basename: " + basename)
    # check that the current session is still the same which wrote the video
    currentSessionId = conn.c.getSessionId()
    infofile = basename + '.info'
    sessionId = None
    with open(infofile, 'r') as ifile:
        text = ifile.read()
        sessionId = yaml.safe_load(text.replace("\t", "    "))['sessionId']
    if currentSessionId != sessionId:
        logger.error("invalid session id")
        logger.error("current session: " + currentSessionId + " but found " + sessionId)
        return None

    path = basename + ".mp4"
    filename = os.path.basename(path)
    range_header = request.META.get('HTTP_RANGE', '').strip()
    range_match = range_re.match(range_header)
    size = os.path.getsize(path)
    content_type, encoding = mimetypes.guess_type(path)
    content_type = content_type or 'application/octet-stream'
    if range_match:
        first_byte, last_byte = range_match.groups()
        first_byte = int(first_byte) if first_byte else 0
        last_byte = int(last_byte) if last_byte else size - 1
        if last_byte >= size:
            last_byte = size - 1
        length = last_byte - first_byte + 1
        resp = StreamingHttpResponse(RangeFileWrapper(open(path, 'rb'), offset=first_byte, length=length), status=206, content_type=content_type)
        resp['Content-Length'] = str(length)
        resp['Content-Range'] = 'bytes %s-%s/%s' % (first_byte, last_byte, size)
    else:
        resp = StreamingHttpResponse(FileWrapper(open(path, 'rb')), content_type=content_type)
        resp['Content-Length'] = str(size)
    resp['Content-Disposition'] = 'attachment; filename=' + filename
    resp['Accept-Ranges'] = 'bytes'
    return resp

# https://medium.com/@flouss/streaming-a-file-through-django-a6dcff21e046
# import requests
#
# @login_required()
# def getVideo(request, conn=None, **kwargs):
#     basename = request.GET['basename']
#     logger.info("basename: " + basename)
#     url = "file://" + basename + ".mp4"
#     filename = os.path.basename(url)
#     r = requests.get(url, stream=True)
#     response = StreamingHttpResponse(streaming_content=r)
#     response['Content-Disposition'] = f'attachement; filename="{filename}"'
#     response['Accept-Ranges'] = 'bytes'
#     return response
#
