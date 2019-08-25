from omeroweb.webclient.decorators import login_required
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
import tempfile
import os
import datetime
import shutil
from pytiff import PyTiff
import traceback

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
def getProgress(request, conn=None, **kwargs):
     """ Shows a subset of Z-planes for an image """
     return JsonResponse({'progress': 50})

@login_required()
def startRendering(request, conn=None, **kwargs):
     """ Shows a subset of Z-planes for an image """
     try:
          image_id = 1
          image = conn.getObject("Image", image_id)
          image_name = image.getName()
          user = conn.getUser().getName();
          basename = os.path.join(tempfile.gettempdir(), user + "-" + datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S"))
          basename = "/tmp/" + user + "-" + datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
          imagepath = extract_image(conn, image)
          s = request.GET['script']
          # s = conn
          writeAnimationFile(s, basename)
          # avifile = basename + ".avi"
          # mp4file = convertToMP4(avifile);
          # namespace = "oice/3Dscript"
          # gid = image.getDetails().getGroup().getId()
          # conn.SERVICE_OPTS.setOmeroGroup(gid)
          # file_ann = conn.createFileAnnfromLocalFile(animationfile, mimetype="text/plain", ns=namespace, desc=None)
          # image.linkAnnotation(file_ann)
          # file_ann = conn.createFileAnnfromLocalFile(mp4file, mimetype="video/mp4", ns=namespace, desc=None)
          # image.linkAnnotation(file_ann)
          # aId = file_ann.getId()
          # # os.remove(avifile)
          # # os.remove(mp4file)
          # # os.remove(animationfile)
          # # os.remove(macrofile)
          # # aId = 107 # for now put manually, because we need an mp4
          # return render(request, '3Dscript/index.html',
          #       {'imageId': image_id, 'image_name': image_name,
          #        'z_indexes': z_indexes, 's': s, 'annotationId' : aId, 'macro' : macrofile, 'outfile' : mp4file})
          # TODO dont return progress here
     except Exception as exc:
          log = open("/tmp/errorlog.txt", "w")
          traceback.print_exc(file=log)
          log.close()
     return JsonResponse({'progress': 50})

@login_required()
def render3D(request, conn=None, **kwargs):
     """ Shows a subset of Z-planes for an image """
     image_id = 1
     image = conn.getObject("Image", image_id)
     image_name = image.getName()
     user = conn.getUser().getName();
     basename = os.path.join(tempfile.gettempdir(), user + "-" + datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S"))
     size_z = image.getSizeZ()
     z_indexes = [0, int(size_z*0.25), int(size_z*0.5),
          int(size_z*0.75), size_z-1]
     imagepath = extract_image(conn, image)
     s = request.GET['script']
     macrofile = makeMacro(s, basename, imagepath, image.getSizeC(), image.getSizeZ(), image.getSizeT())
     avifile = basename + ".avi"
     animationfile = basename + ".animation.txt"
     run3Dscript(macrofile, avifile)
     mp4file = convertToMP4(avifile);
     namespace = "oice/3Dscript"
     gid = image.getDetails().getGroup().getId()
     conn.SERVICE_OPTS.setOmeroGroup(gid)
     file_ann = conn.createFileAnnfromLocalFile(macrofile, mimetype="text/plain", ns=namespace, desc=None)
     image.linkAnnotation(file_ann)
     file_ann = conn.createFileAnnfromLocalFile(animationfile, mimetype="text/plain", ns=namespace, desc=None)
     image.linkAnnotation(file_ann)
     file_ann = conn.createFileAnnfromLocalFile(mp4file, mimetype="video/mp4", ns=namespace, desc=None)
     image.linkAnnotation(file_ann)
     aId = file_ann.getId()
     # os.remove(avifile)
     # os.remove(mp4file)
     # os.remove(animationfile)
     # os.remove(macrofile)
     # aId = 107 # for now put manually, because we need an mp4
     return render(request, '3Dscript/index.html',
           {'imageId': image_id, 'image_name': image_name,
            'z_indexes': z_indexes, 's': s, 'annotationId' : aId, 'macro' : macrofile, 'outfile' : mp4file})

def extract_image(conn, image):
     image_id = image.getId()
     tmp_folder = '/tmp/3Dscript.%s/' % (image_id)
     if os.path.exists(tmp_folder):
          shutil.rmtree(tmp_folder)
     os.mkdir(tmp_folder)
     w = image.getSizeX()
     h = image.getSizeY()
     channels = image.getSizeC()
     slices = image.getSizeZ()
     frames = image.getSizeT()
     size_x_obj = image.getPixelSizeX(units=True)
     size_y_obj = image.getPixelSizeY(units=True)
     size_z_obj = image.getPixelSizeZ(units=True)
     pw = 1
     ph = 1
     pd = 1
     if not size_x_obj == None:
          pw = size_x_obj.getValue()
     if not size_y_obj == None:
          ph = size_y_obj.getValue()
     if not size_z_obj == None:
          pd = size_z_obj.getValue()
     units = "pixel"
     if not size_x_obj == None:
         units = size_x_obj.getSymbol()
     units = units.replace('\xc2\xb5', 'u') # microns
     pixels = image.getPrimaryPixels()
     dtype = image.getPixelsType() # either 'uint8' or 'uint16'
     # TODO raise error if not 'uint8' or 'uint16'
     is16 = dtype == 'uint16'
     tiffHdr = PyTiff.get_tiff_header(w, h, channels, slices, frames, pw, ph, pd, units, is16)
     for t in range(frames):
          impath = "%s/%04d.tif" % (tmp_folder, t)
          fid = open(impath, "wb")
          fid.write(tiffHdr)
          for z in range(slices):
               for c in range(channels):
                    plane = pixels.getPlane(z, c, t)
                    fid.write(plane.tobytes())
          fid.close()

     return tmp_folder

def convertToMP4(avifile):
     from subprocess import Popen, PIPE
     mp4file = avifile.replace(".avi", ".mp4")
     cmd = ['ffmpeg', '-i', avifile, '-vcodec', 'libx264', '-an', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', mp4file]
     out = open("/tmp/ffmpegout.txt", "w")
     err = open("/tmp/ffmpegerr.txt", "w")
     p = Popen(cmd, stdout=out, stderr=err)
     p.wait()
     out.close()
     err.close()
     return mp4file

def run3Dscript(macrofile, outfile):
     from subprocess import Popen, PIPE
     cmd = [FIJI_BIN, '--console', '-macro', macrofile, outfile]
     out = open("/tmp/fijiout.txt", "w")
     err = open("/tmp/fijierr.txt", "w")
     p = Popen(cmd, stdout=out, stderr=err)
     p.wait()
     out.close()
     err.close()

def writeAnimationFile(script, basename):
     animationFile = basename + ".animation.txt"
     with open(animationFile, 'w') as f:
          f.write(script)

def makeMacro(script, basename, path, nChannels, nSlices, nFrames):
     s = '''
outfile = "''' + basename + '''.avi";
setBatchMode(true);

function makeAnimation() {
        return "" +
''';
     for line in script.splitlines(False):
          s = s + '	"' + line + '\\n" +\n';

     s = s + '''"\\n";
}

function getAnimationFileName() {
	return "''' + basename + '''.animation.txt";
}

// run("T1 Head (2.4M, 16-bits)");
// open("''' + path + '''");
run("Image Sequence...", "open=[''' + path + '''] file=tif sort use");
run("Stack to Hyperstack...", "order=xyczt(default) channels=''' + str(nChannels) + ''' slices=''' + str(nSlices) + ''' frames=''' + str(nFrames) + ''' display=Composite");
title = getTitle();


path = getAnimationFileName();
File.saveString(makeAnimation(), path);
run("Batch Animation",
        "animation=" + path + " " +
        "output_width=256 output_height=256 scalebar=100.0 rendering_algorithm=[Independent transparency] bounding_box");

selectWindow(title + ".avi");
// run("AVI... ", "compression=JPEG frame=20 save=" + getDirectory("temp") + title + ".avi");
run("AVI... ", "compression=JPEG frame=20 save=" + outfile);

run("Quit");
eval("script", "System.exit(0);");
'''
     macrofile = basename + ".ijm"
     f = open(macrofile, 'w')
     f.write(s)
     f.close()
     return macrofile

