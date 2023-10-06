from django.urls import re_path
from . import views

urlpatterns = [
	re_path(r'^$', views.index, name='3Dscript_index'),
	re_path(r'^startRendering$', views.startRendering, name='3Dscript_startRendering'),
	re_path(r'^getImages$', views.getImages, name='3Dscript_getImages'),
	re_path(r'^getStateAndProgress$', views.getStateAndProgress, name='3Dscript_getStateAndProgress'),
	re_path(r'^cancelRendering$', views.cancelRendering, name='3Dscript_cancelRendering'),
	re_path(r'^getVideo$', views.getVideo, name='3Dscript_getVideo'),
]
