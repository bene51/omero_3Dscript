import sys
import socket
import time
from subprocess import Popen, PIPE

FIJI_DIR = "/usr/local/share/Fiji.app/"
FIJI_BIN = FIJI_DIR + "ImageJ-linux64"

def startFiji():
	print("startFiji")
	cmd = [FIJI_BIN, '--console', '--headless', '-eval', 'run("3Dscript Server", "");']
	print(cmd[4])
	p = Popen(cmd, stdout=PIPE)
	for line in iter(p.stdout.readline, b''):
		print(line)
		if line.startswith('Waiting for connection...'):
			break;
    

def send(msg):
	s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	try:
		s.connect(('localhost', 3333))
	except socket.error as e:
		if e.errno == 111:
			startFiji()
			return send(msg)
	s.sendall(msg)
	data = None
	while not data:
		data = s.recv(1024)
	print 'Received', repr(data)
	return data

def run(basename, imageid, w, h):
	send('render ' + basename + ' ' + str(imageid) + ' ' + str(w) + ' ' + str(h) + '\n')
	while True:
		resp = send('getstate ' + basename + '\n')
		if resp and resp.startswith('FINISHED'):
			break
		time.sleep(0.1)

basename = '/tmp/bschmid-2019-08-23-09-28-56'
run(basename, 1, 256, 256)
