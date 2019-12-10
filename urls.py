from django.conf.urls import url
from . import views

urlpatterns = [
	url(r'^$', views.index, name='3Dscript_index'),
	url(r'^startRendering$', views.startRendering, name='3Dscript_startRendering'),
	url(r'^getName$', views.getName, name='3Dscript_getName'),
	url(r'^getStateAndProgress$', views.getStateAndProgress, name='3Dscript_getStateAndProgress'),
	url(r'^createAnnotation$', views.createAnnotation, name='3Dscript_createAnnotation'),
	url(r'^cancelRendering$', views.cancelRendering, name='3Dscript_cancelRendering'),
]
