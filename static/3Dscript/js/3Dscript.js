(function() {
    function resizeit() {
        var targetVideoWidth = $("#videoContainer")[0].clientWidth;
        var targetVideoHeight = $("#videoContainer")[0].clientHeight;
        console.log("tgtw = " + targetVideoWidth + " tgth = " + targetVideoHeight);
        var targetAspect = targetVideoWidth / targetVideoHeight;
        console.debug("targetAspect = "  + targetAspect);

        var previews = $("#preview");
        if(previews.length > 0) {
            var preview = previews[0];
            if(preview.tagName == "VIDEO") {
                preview.addEventListener("loadedmetadata", function(e) {
                    var videoWidth = this.videoWidth;
                    var videoHeight = this.videoHeight;
                    var aspect = videoWidth / videoHeight;
                    if(aspect > targetAspect) {
                        // keep width and let hight be adjusted automatically
                        preview.width = targetVideoWidth;
                    }
                    else {
                        // keep height and let width be adjusted automatically
                        preview.height = targetVideoHeight;
                    }
                    console.log("videoWidth = " + videoWidth);
                    console.log("videoHeight = " + videoHeight);
                    console.log("videoWidth/videoHeight = " + (videoWidth / videoHeight));
                });
            }
            else if(preview.tagName == "IMG") {
                preview.onload = function() {
                    console.debug(previews);
                    var videoWidth = preview.clientWidth;
                    console.debug("videoWidth = "  + videoWidth);
                    var videoHeight = preview.clientHeight;
                    console.debug("videoHeight = "  + videoHeight);
                    var aspect = videoWidth / videoHeight;
                    console.debug("aspect = " + aspect);
                    if(aspect > targetAspect) {
                        // keep width and let hight be adjusted automatically
                        preview.width = targetVideoWidth;
                        console.debug("targetVideoWidth = " + targetVideoWidth);
                    }
                    else {
                        // keep height and let width be adjusted automatically
                        preview.height = targetVideoHeight;
                    }
                };
            }
        }
    }

    function startRendering() {
        enableRenderingButton(false);
        $("#backtrace")[0].innerHTML = "";
        accordion.accordion("refresh");
        accordion.accordion("option", "active", false);
        var imageId = $("#imageId")[0].value;
        var script = $("#script")[0].value;
        var targetWidth = $("#tgtWidth")[0].value;
        var targetHeight = $("#tgtHeight")[0].value;
        var bbVisible = $("#bbswitch")[0].checked;
        var bbColor = $("#bbcolor")[0].value;
        var bbLinewidth = $("#bblinewidth")[0].value;
        var sbVisible = $("#sbswitch")[0].checked;
        var sbColor = $("#sbcolor")[0].value;
        var sbLinewidth = $("#sblinewidth")[0].value;
        var sbPosition = $("#sbposition")[0].value;
        var sbOffset = $("#sboffset")[0].value;
        var sbLength = $("#sblength")[0].value;
        console.debug("startRendering");
        $.ajax({
            url: '/omero_3dscript/startRendering',
            data: {
                imageId: imageId,
                script: script,
                targetWidth: targetWidth,
                targetHeight: targetHeight,
                bbVisible: bbVisible,
                bbColor: bbColor,
                bbLinewidth: bbLinewidth,
                sbVisible: sbVisible,
                sbColor: sbColor,
                sbLinewidth: sbLinewidth,
                sbPosition: sbPosition,
                sbOffset: sbOffset,
                sbLength: sbLength
            },
            dataType: 'json',
            success: function(data) {
                if(data.error) {
                    console.debug("error startRendering");
                    setStateAndProgress('ERROR: ' + data.error.trim(), -1, data.stacktrace);
                    enableRenderingButton(true);
                }
                else {
                    console.debug("success startRendering");
                    var basename = data.basename;
                    $('#bar').width(1 + '%');
                    updateState(basename);
                }
            },
            error: function(xhr, ajaxOptions, thrownError) {
                console.debug("error in startRendering " + thrownError);
            }
        });
    }

    function setStateAndProgress(state, progress, stacktrace=null) {
        var pbar = $('#bar');
        var label = $('#barlabel');
        if(progress >= 0)
            // pbar.width(progress + '%');
            pbar.stop().animate({"width": progress + '%'}, 100); // .queue(function(){});
        if(state != null) {
            label[0].innerHTML = state;
            if(state.startsWith('ERROR')) {
                pbar.css({"background-color":"red"});
                label.css({"color":"black"});
                if(stacktrace)
                    $("#backtrace")[0].innerHTML = "<pre>" + stacktrace + "</pre>";
                accordion.accordion("refresh");
                accordion.accordion("option", "active", 0);
            }
            else {
                pbar.css({"background-color":"#4caf50"});
                label.css({"color":"white"});
                $("#backtrace")[0].innerHTML = "";
                accordion.accordion("refresh");
                accordion.accordion("option", "active", false);
            }
        }
    }

    function enableRenderingButton(state) {
        $('#startRendering').prop("disabled", !state);
    }

    function updateState(basename) {
        setTimeout(function myTimer() {
            console.debug("updateState");
            $.ajax({
                url: '/omero_3dscript/getStateAndProgress',
                data: {
                    basename: basename
                },
                dataType: 'json',
                success: function(data) {
                    if(data.state.startsWith('ERROR')) {
                        console.debug("error updateState");
                        setStateAndProgress('ERROR', 100 * data.progress, data.stacktrace);
                        enableRenderingButton(true);
                    }
                    else if (data.state.startsWith('FINISHED')) {
                        console.debug("finished updateState");
                        createAnnotation(basename);
                        enableRenderingButton(true);
                    }
                    else {
                        console.debug("before setStateAndProgress");
                        setStateAndProgress(data.state, 100 * data.progress);
                        console.debug("about to call updateState again");
                        updateState(basename);
                    }
                },
                error: function(xhr, ajaxOptions, thrownError) {
                    console.debug("error in updateState " + thrownError);
                }
            });
        }, 500);
    }

    function createAnnotation(basename) {
        setStateAndProgress('CREATE ATTACHMENT', 95);
        $.ajax({
            url: '/omero_3dscript/createAnnotation',
            data: {
                basename: basename,
                imageId: $("#imageId")[0].value
            },
            dataType: 'json',
            success: function(data) {
                if(data.error) {
                    setStateAndProgress('ERROR: ' + data.error.trim(), -1);
                    enableRenderingButton(true);
                }
                else {
                    annotationId = data.annotationId;
                    console.debug('annotationId = ' + annotationId);
                    if(data.isVideo) {
                        $('#videoContainer')[0].innerHTML = `
    <video id="preview" style="margin-left: auto; margin-right: auto; display: block; position: relative; top: 50%; transform: translateY(-50%);" controls>
      <source src="/webclient/annotation/${annotationId}" type="video/mp4">
      Your browser doesn't support this video.
    </video>`.trim();
                    }
                    else {
                        $('#videoContainer')[0].innerHTML = `
    <img id="preview" style="margin-left: auto; margin-right: auto; display: block; position: relative; top: 50%; transform: translateY(-50%);" src="/webclient/annotation/${annotationId}" type="image/png">
    </img>`.trim();
                    }
                    resizeit();
                    setStateAndProgress('FINISHED', 100);
                }
            }
        });
    }

    function onresize() {
        left = ($(window).width() - 600) / 2.0;
        // devide the left space into 5 parts,
        // 4 will be covered by the logo, the 5th
        // is gap
        gap = left / 5.0;
        logow = gap * 4;
        if(logow > 150)
            logow = 150;
        if(logow < 50)
            logow = 0;
        $("#logo").width(logow + 'px');
        $("#logo").height(logow + 'px');
        $("#header").css({"padding-left": left + "px"});
    }

    function main() {
        accordion = $("#accordion").accordion({
            collapsible: true,
            active: false,
            animate: 200,
        });
    
        $(window).resize(function() {
            onresize();
        });
    
        $(window).scroll(function() {
            et = $("#logo").offset().top;
            wt = $(window).scrollTop();
            absY = et - wt;
            if(wt > 65) {
                $("#logo").css({'top': wt + 5});
            }
            else {
                $("#logo").css({'top': 60});
            }
        });
    
        onresize();
        console.debug("bla");
    }

    main();
})();
