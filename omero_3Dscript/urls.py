from django.conf.urls import url
from . import views

urlpatterns = [
	url(r'^$', views.index, name='3Dscript_index'),
	url(r'^startRendering$', views.startRendering, name='3Dscript_startRendering'),
	url(r'^getImages$', views.getImages, name='3Dscript_getImages'),
	url(r'^getStateAndProgress$', views.getStateAndProgress, name='3Dscript_getStateAndProgress'),
	url(r'^cancelRendering$', views.cancelRendering, name='3Dscript_cancelRendering'),
	url(r'^getVideo$', views.getVideo, name='3Dscript_getVideo'),
]
