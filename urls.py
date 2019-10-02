from django.conf.urls import url, patterns
from . import views

urlpatterns = patterns('django.views.generic.simple',
	url(r'^$', views.index, name='3Dscript_index'),
	url(r'^startRendering$', views.startRendering, name='3Dscript_startRendering'),
	url(r'^getName$', views.getName, name='3Dscript_getName'),
	url(r'^getStateAndProgress$', views.getStateAndProgress, name='3Dscript_getStateAndProgress'),
	url(r'^createAnnotation$', views.createAnnotation, name='3Dscript_createAnnotation'),
)
