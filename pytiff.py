import struct

class PyTiff:
	# some constants:

	SHORT                   = 3

	HDR_SIZE		= 8
	SCALE_DATA_SIZE		= 16

	PHOTO_INTERP		= 1
	SAMPLES_PER_PIXEL	= 1

	TAG_NEW_SUBFILE_TYPE	= 254
	TAG_IMAGE_WIDTH		= 256
	TAG_IMAGE_LENGTH	= 257
	TAG_BITS_PER_SAMPLE	= 258
	TAG_PHOTO_INTERP	= 262
	TAG_IMAGE_DESCRIPTION	= 270
	TAG_STRIP_OFFSETS	= 273
	TAG_SAMPLES_PER_PIXEL	= 277
	TAG_ROWS_PER_STRIP	= 278
	TAG_STRIP_BYTE_COUNT	= 279
	TAG_X_RESOLUTION	= 282
	TAG_Y_RESOLUTION	= 283
	TAG_RESOLUTION_UNIT	= 296

	N_ENTRIES		= 13
	# 2 + N_ENTRIES * 12 + 4 = 162
	IFD_SIZE		= 162

	imageSize = 0
	imageOffset = 0
	description = ''
	nImages = 0
	nChannels = 0
	nSlices = 0
	nFrames = 0
	width = 0
	height = 0
	pw = 0.0
	ph = 0.0
	pd = 0.0
	unit = ''
	bitsPerSample = 8
	bytesPerPixel = 1


	def __init__(self, description, nChannels, nSlices, nFrames, width, height, pw, ph, pd, unit, is16Bit=False):
		if is16Bit:
			self.bitsPerSample = 16
			self.bytesPerPixel = 2
		self.description = description
		self.nChannels = nChannels
		self.nSlices = nSlices
		self.nFrames = nFrames
		self.nImages = nChannels * nSlices * nFrames
		self.width = width
		self.height = height
		self.pw = pw
		self.ph = ph
		self.pd = pd
		self.unit = unit
		self.imageSize = width * height * self.bytesPerPixel
		self.imageOffset = self.HDR_SIZE + self.nImages * self.IFD_SIZE + len(description) + self.SCALE_DATA_SIZE


	@staticmethod
	def makeDescription(nChannels, nSlices, nFrames, pd, unit):
		nImages = nChannels * nSlices * nFrames
		unitstr = unit
		if unitstr == None or not unitstr:
			unitstr = "pixels"

		return ("ImageJ=1.50e\n" + 
			"images=%s\n" +
			"channels=%s\n" +
			"slices=%s\n" +
			"frames=%s\n" +
			"hyperstack=true\n" +
			"mode=composite\n" +
			"unit=%s\n" +
			"spacing=%s\n" +
			"loop=false\n" +
			"min=0\n" +
			"max=0\n") % \
			(nImages, nChannels, nSlices, nFrames, unitstr, pd)


	@staticmethod
	def writeByte(buf, offset, value):
		struct.pack_into('<B', buf, offset, value)
		return 1


	@staticmethod
	def writeShort(buf, offset, value):
		struct.pack_into('<H', buf, offset, value)
		return 2


	@staticmethod
	def writeInt(buf, offset, value):
		struct.pack_into('<I', buf, offset, value)
		return 4


	@staticmethod
	def writeChars(buf, offset, value):
		l = len(value)
		struct.pack_into('<' + str(l) + 's', buf, offset, value.encode('UTF-8'))
		return l


	def writeDescription(self, buf, offset):
		'''Writes the variable length ImageDescription string.'''
		print(self.description)
		return PyTiff.writeChars(buf, offset, self.description)


	def writeScale(self, buf, offset):
		'''Writes the 16 bytes of data required by the XResolution and YResolution tags.'''
		xscale = 1.0 / self.pw
		yscale = 1.0 / self.ph
		scale = 1000000.0
		ret = 0
		ret += PyTiff.writeInt(buf, offset + ret, int(xscale * scale))
		ret += PyTiff.writeInt(buf, offset + ret, int(scale))
		ret += PyTiff.writeInt(buf, offset + ret, int(yscale * scale))
		ret += PyTiff.writeInt(buf, offset + ret, int(scale))
		return ret


	def writeEntry(self, buf, offset, tag, fieldType, count, value):
		'''Writes one 12-byte IFD entry.'''
		ret = 0
		ret += PyTiff.writeShort(buf, offset + ret, tag)
		ret += PyTiff.writeShort(buf, offset + ret, fieldType)
		ret += PyTiff.writeInt(buf, offset + ret, count)
		if count == 1 and fieldType == self.SHORT:
			ret += PyTiff.writeShort(buf, offset + ret, value)
			ret += PyTiff.writeShort(buf, offset + ret, 0)
		else:
			ret += PyTiff.writeInt(buf, offset + ret, value); # may be an offset
		return ret


	def writeIFD(self, buf, offset, planeOffset, nextIFD):
		''' Writes one IFD (Image File Directory).'''
		tagDataOffset = self.HDR_SIZE + self.nImages * self.IFD_SIZE
		ret = 0
		ret += PyTiff.writeShort(buf, offset + ret, self.N_ENTRIES)
		ret += self.writeEntry(buf, offset + ret, self.TAG_NEW_SUBFILE_TYPE,  4, 1, 0)
		ret += self.writeEntry(buf, offset + ret, self.TAG_IMAGE_WIDTH,       4, 1, self.width)
		ret += self.writeEntry(buf, offset + ret, self.TAG_IMAGE_LENGTH,      4, 1, self.height)
		ret += self.writeEntry(buf, offset + ret, self.TAG_BITS_PER_SAMPLE,   3, 1, self.bitsPerSample)
		ret += self.writeEntry(buf, offset + ret, self.TAG_PHOTO_INTERP,      3, 1, self.PHOTO_INTERP)
		ret += self.writeEntry(buf, offset + ret, self.TAG_IMAGE_DESCRIPTION, 2, len(self.description), tagDataOffset)
		tagDataOffset += len(self.description)

		ret += self.writeEntry(buf, offset + ret, self.TAG_STRIP_OFFSETS,     4, 1, planeOffset)
		ret += self.writeEntry(buf, offset + ret, self.TAG_SAMPLES_PER_PIXEL, 3, 1, self.SAMPLES_PER_PIXEL)
		ret += self.writeEntry(buf, offset + ret, self.TAG_ROWS_PER_STRIP,    3, 1, self.height)
		ret += self.writeEntry(buf, offset + ret, self.TAG_STRIP_BYTE_COUNT,  4, 1, self.imageSize)
		ret += self.writeEntry(buf, offset + ret, self.TAG_X_RESOLUTION,      5, 1, tagDataOffset)
		ret += self.writeEntry(buf, offset + ret, self.TAG_Y_RESOLUTION,      5, 1, tagDataOffset + 8)
		tagDataOffset += self.SCALE_DATA_SIZE;

		iunit = 1
		if self.unit == None:
			iunit = 1
		elif self.unit == "inch":
			iunit = 2
		elif self.unit == "cm":
			iunit = 3
		ret += self.writeEntry(buf, offset + ret, self.TAG_RESOLUTION_UNIT,   3, 1, iunit)

		ret += self.writeInt(buf, offset + ret, nextIFD)
		return ret


	def writeHeader(self, buf, offset):
		'''Writes the 8-byte image file header.'''
		buf[offset + 0] = 73; # "II" (Intel byte order)
		buf[offset + 1] = 73;
		buf[offset + 2] = 42; # 42 (magic number)
		buf[offset + 3] = 0;
		buf[offset + 4] = 8;  # 8 (offset to first IFD)
		buf[offset + 5] = 0;
		buf[offset + 6] = 0;
		buf[offset + 7] = 0;
		return 8;


	@staticmethod
	def get_tiff_header(w, h, channels, slices, frames, pw, ph, pd, unit, is16Bit=False):
		desc = PyTiff.makeDescription(channels, slices, frames, pd, unit)
		print(desc)

		pt = PyTiff(desc, channels, slices, frames, w, h, pw, ph, pd, unit, is16Bit)
		buf = bytearray(pt.imageOffset)
		pos = 0

		pos += pt.writeHeader(buf, pos)

		planeOffset = pt.imageOffset;
		for i in range(pt.nImages):
			nextIFD = pt.HDR_SIZE + (i + 1) * pt.IFD_SIZE
			if i == pt.nImages - 1:
				nextIFD = 0
			pos += pt.writeIFD(buf, pos, planeOffset, nextIFD)
			planeOffset += pt.imageSize

		pos += pt.writeDescription(buf, pos)
		pos += pt.writeScale(buf, pos)
		return buf;


def test():
	w = 20
	h = 20
	channels = 1
	slices = 10
	frames = 1
	pw = 0.65
	ph = 0.65
	pd = 2.0

	unit = "um"
	slice_size = w * h * 2  # sizeof(unsigned short)

	header = PyTiff.get_tiff_header(w, h, channels, slices, frames, pw, ph, pd, unit, True)
	f = open("C:/Users/bschmid/pytif.tif", "wb")
	f.write(header)

	plane = bytearray(slice_size)
	v = 0
	d = channels * slices * frames
	for z in range(d):
		offset = 0
		for y in range(h):
			for x in range(w):
				offset += PyTiff.writeShort(plane, offset, v)
				# offset += PyTiff.writeByte(plane, offset, v)
			v += 1;
		f.write(plane)

	f.close()


if __name__ == "__main__":
	test()


