#!/bin/python

from subprocess import Popen, PIPE

command = ['ls', '-l']

p = Popen(command, stdout=PIPE);

for line in p.stdout:
	print line.rstrip("\n")

p.wait()
print('done');
