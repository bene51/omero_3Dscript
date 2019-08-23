from django.conf.urls import url, patterns
from . import views

urlpatterns = patterns('django.views.generic.simple',
	url(r'^$', views.index, name='3Dscript_index'),
	url(r'^render$', views.render3D, name='3Dscript_render'),
	url(r'^startRendering$', views.startRendering, name='3Dscript_startRendering'),
	url(r'^getProgress$', views.getProgress, name='3Dscript_getProgress'),
)
