import sys
import socket
import time
import threading
from subprocess import Popen, PIPE

FIJI_DIR = "/usr/local/share/Fiji.app/"
FIJI_BIN = FIJI_DIR + "ImageJ-linux64"


def startFiji(co):
	print("startFiji")
	stdoutput = ""
	try:
		log = open("/tmp/fiji.out", 'w')
		err = open("/tmp/fiji.err", 'w')
		cmd = [FIJI_BIN, '--console', '--headless', '-eval', 'run("3Dscript Server", "");']
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
		if e.errno == 111:
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

def startRendering(host, sessionid, basename, imageid, w, h):
	send('render ' + host + ' ' + sessionid + ' ' + basename + ' ' + str(imageid) + ' ' + str(w) + ' ' + str(h) + '\n')

def getStateAndProgress(basename):
	state = send('getstate ' + basename + '\n')
	progress = float(send('getprogress ' + basename + '\n'))
	return state, progress 

def run(host, sessionid, basename, imageid, w, h):
	startRendering(host, sessionid, basename, imageid, w, h)
	while True:
		resp, prog = getStateAndProgress(basename)
		if resp and resp.startswith('FINISHED'):
			break
		if resp and resp.startswith('ERROR'):
			break
		time.sleep(0.1)

if False:
	host = 'omero'
	sessionid = '9et1v5f8ftzswwqwnkwh5a7630bknk4x'
	basename = '/tmp/bschmid-2019-08-23-15-43-24'
	run(host, sessionid, basename, 1, 256, 256)
