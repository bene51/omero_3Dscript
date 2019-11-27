import sys
import socket
import time
import threading
import os
import logging
from subprocess import Popen, PIPE
import base64

logger = logging.getLogger(__name__)

def getFijiBin():
	fijibin = os.getenv('FIJI_BIN')
	if fijibin is not None and os.path.isfile(fijibin):
		return fijibin;
	fijihome = os.getenv('FIJI_HOME')
	if fijihome is not None and os.path.isdir(fijihome):
		fijibin = fijihome + "/ImageJ-linux64"
		if os.path.isfile(fijibin):
			return fijibin
		fijibin = fijihome + "/ImageJ-win64"
		if os.path.isfile(fijibin):
			return fijibin
		fijibin = fijihome + "/Contents/MacOS/ImageJ-macosx"
		if os.path.isfile(fijibin):
			return fijibin
	return None

def startFiji(co):
	print("startFiji")
	stdoutput = ""
	try:
		log = open("/tmp/fiji.out", 'w')
		err = open("/tmp/fiji.err", 'w')
		fijibin = getFijiBin()
		cmd = [fijibin, '--console', '--headless', '-eval', 'run("3Dscript Server", "");']
		print(cmd[4])
		p = Popen(cmd, stdout=PIPE, stderr=err)
		for line in iter(p.stdout.readline, b''):
			stdoutput = stdoutput + line
			log.write(line)
			log.flush()
			if line.startswith('Waiting for connection...'):
				co.set()
				#with co:
				#	co.notifyAll()
	finally:
		log.close()
		err.close()


def send(msg):
	s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	try:
		s.connect(('localhost', 3333))
	except socket.error as e:
		co = threading.Event()
		threading.Thread(name='startFiji', target=startFiji, args=(co,)).start()
		# startFiji(co)
		# with co:
		co.wait(15.0) #seconds
		if not co.is_set(): #timeout
			raise Exception("Unable to start Fiji"); #TODO kill fiji
		return send(msg)
	s.sendall(msg)
	data = None
	while not data:
		data = s.recv(1024)
	print 'Received', repr(data)
	return data

def checkFijiPath():
	if getFijiBin() is None:
		raise Exception("Fiji binary could not be found, please set the FIJI_BIN environment variable")


def startRendering(host, sessionid, script, imageid, w, h):
	return send("render %s %s %s %s %s %s\n" % (host, sessionid, base64.urlsafe_b64encode(script), imageid, w, h)).strip()


def getStateAndProgress(basename):
        positionProgressState = send('getstate ' + basename + '\n')
        toks = positionProgressState.split(" ")
        position = int(toks[0])
        progress = float(toks[1])
        state = toks[2]
	return state, progress, position

def cancelRendering(basename):
	send('cancel ' + basename + '\n')

def run(host, sessionid, basename, imageid, w, h):
	startRendering(host, sessionid, basename, imageid, w, h)
	while True:
		resp, prog, position = getStateAndProgress(basename)
		if resp and resp.startswith('FINISHED'):
			break
		if resp and resp.startswith('ERROR'):
			break
		time.sleep(0.1)

