import setuptools

with open("README.md", "r") as fh:
	long_description = fh.read()

setuptools.setup(
    name="OMERO-3Dscript",
    version="0.0.9",
    author="Benjamin Schmid",
    author_email="bene.schmid@gmail.com",
    description="OMERO.web app to animate multi-dimensional microscopy using 3Dscript, directly from within the OMERO environment.",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/bene51/omero_3Dscript",
    keywords=['OMERO.web', '3Dscript', 'animation', '3D'],
    license="AGPL-3.0",
    install_requires=['omero-web>=5.6.0', 'pid'],
    packages=setuptools.find_packages(),
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Environment :: GPU',
        'Environment :: Web Environment',
        'Framework :: Django',
        'Intended Audience :: End Users/Desktop',
        'Intended Audience :: Science/Research',
        'Natural Language :: English',
        'Operating System :: OS Independent',
        'Programming Language :: JavaScript',
        'Programming Language :: Python :: 3',
        'Topic :: Internet :: WWW/HTTP',
        'Topic :: Internet :: WWW/HTTP :: Dynamic Content',
        'Topic :: Internet :: WWW/HTTP :: WSGI',
        'Topic :: Multimedia :: Graphics :: 3D Rendering',
        'Topic :: Multimedia :: Video',
        'Topic :: Scientific/Engineering :: Visualization'
    ],
    python_requires='>=3',
    include_package_data=True,
)
