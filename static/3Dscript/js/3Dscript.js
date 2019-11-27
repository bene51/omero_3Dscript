(function() {
    var accordion;
    var renderbutton = $("#render-button");
    var cancelbutton = $("#cancel-button");
    var basename;
    var cancelled = false;

    function resizeit() {
        var targetVideoWidth = $("#videoContainer")[0].clientWidth;
        var targetVideoHeight = $("#videoContainer")[0].clientHeight;
        console.log("tgtw = " + targetVideoWidth + " tgth = " + targetVideoHeight);
        var targetAspect = targetVideoWidth / targetVideoHeight;

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
                    var videoWidth = preview.clientWidth;
                    var videoHeight = preview.clientHeight;
                    var aspect = videoWidth / videoHeight;
                    if(aspect > targetAspect) {
                        // keep width and let hight be adjusted automatically
                        preview.width = targetVideoWidth;
                    }
                    else {
                        // keep height and let width be adjusted automatically
                        preview.height = targetVideoHeight;
                    }
                };
            }
        }
    }

    function cancelRendering() {
        enableCancelButton(false);
        $.ajax({
            url: '/omero_3dscript/cancelRendering',
            data: {
                basename: basename
            },
            dataType: 'json',
            success: function(data) {
                console.debug("cancelled");
                setStateAndProgress("Cancelled", -1);
                enableRenderingButton(true);
                enableCancelButton(true);
            },
            error: function(xhr, ajaxOptions, thrownError) {
                console.debug("error in updateState " + thrownError);
            }
        });
    }

    function startRendering() {
        cancelled = false;
        enableRenderingButton(false);
        $("#backtrace")[0].innerHTML = "";
	setStateAndProgress("Starting", 2);
        accordion.accordion("refresh");
        accordion.accordion("option", "active", false);
        var imageId = $("#imageId")[0].value;
        var script = $("#script")[0].value;
        var targetWidth = $("#tgtWidth")[0].value;
        var targetHeight = $("#tgtHeight")[0].value;
        $.ajax({
            url: '/omero_3dscript/startRendering',
            data: {
                imageId: imageId,
                script: script,
                targetWidth: targetWidth,
                targetHeight: targetHeight,
            },
            dataType: 'json',
            success: function(data) {
                if(data.error) {
                    console.debug("error startRendering");
                    setStateAndProgress('ERROR: ' + data.error.trim(), -1, data.stacktrace);
                    enableRenderingButton(true);
                }
                else {
                    basename = data.basename;
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
        renderbutton.prop("disabled", !state);
    }

    function enableCancelButton(state) {
        cancelbutton.prop("disabled", !state);
    }

    function updateState(basename) {
        setTimeout(function myTimer() {
            if(cancelled) {
                cancelRendering();
                return;
            }
            $.ajax({
                url: '/omero_3dscript/getStateAndProgress',
                data: {
                    basename: basename
                },
                dataType: 'json',
                success: function(data) {
                    position = data.position; // TODO show the position visually on the frontend
                    if(data.state.startsWith('ERROR')) {
                        setStateAndProgress('ERROR', 100 * data.progress, data.stacktrace);
                        enableRenderingButton(true);
                    }
                    else if (data.state.startsWith('FINISHED')) {
                        createAnnotation(basename);
                        enableRenderingButton(true);
                    }
                    else {
                        setStateAndProgress(data.state, 100 * data.progress);
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
                    var annotationId = data.annotationId;
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
        var left = ($(window).width() - 600) / 2.0;
        // devide the left space into 5 parts,
        // 4 will be covered by the logo, the 5th
        // is gap
        var gap = left / 5.0;
        var logow = gap * 4;
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
            var et = $("#logo").offset().top;
            var wt = $(window).scrollTop();
            var absY = et - wt;
            if(wt > 65) {
                $("#logo").css({'top': wt + 5});
            }
            else {
                $("#logo").css({'top': 60});
            }
        });
    
        onresize();

        renderbutton.on("click", function() {
            startRendering();
        });

        cancelbutton.on("click", function() {
            cancelled = true;
        });

        $("#script").bind("keydown", function(event) {
            console.debug("*" + $(this).data("ui-autocomplete").menu.visible);
            if(event.keyCode === $.ui.keyCode.TAB && $(this).data("ui-autocomplete").menu.active) {
                event.preventDefault();
            }
            if(event.keyCode === $.ui.keyCode.ENTER) {
              var caret = $("#script")[0].selectionStart;
              var text = $("#script").val();
              if(caret > 0) {
                var lastChar = text.charAt(caret - 1);
                console.debug("lastChar = " + lastChar);
                if(lastChar === ":") {
                  $("#script")[0].value = text + "\n- ";
                  event.preventDefault();
                  var e = $.Event('keydown', {keyCode: 32 });
                  $('#script').trigger(e);
                }
              }
            }
        });

        // https://stackoverflow.com/questions/5643767/jquery-ui-autocomplete-width-not-set-correctly
        jQuery.ui.autocomplete.prototype._resizeMenu = function() {
            var ul = this.menu.element;
            ul.css("width: 100%;");
        }

        $("#script").autocomplete({
            minLength: 0,
            delay: 0,
            
            source: function( request, response ) {
                console.debug("autocompletion: source()");
                var caret = $("#script")[0].selectionStart;
                var text = $("#script").val();
		var data = getCompletions(text, caret);
                var len = data.alreadyEnteredLength;
                var op = data.options;
		$("#script")[0].alreadyEnteredLength = len;
		response(data.options);
            },
            minLength: 0,
            autoFocus: true,
            focus: function() {
                return false;
            },
            select: function( event, ui ) {
                console.debug("Selected: " + ui.item.value);
                var txt = this.value;
                console.debug(txt);
                var insertPos = this.selectionEnd - this.alreadyEnteredLength;
                console.debug("insertPos = "  + insertPos);
                console.debug("left = " + txt.substring(0, insertPos));
                var repl = txt.substring(0, insertPos) + ui.item.value + " " + txt.substring(insertPos + this.alreadyEnteredLength, txt.length);
                console.debug("replace: " + repl);
                this.value = repl;
                this.selectionStart = this.selectionEnd = insertPos + ui.item.value.length + 1;
                var e = $.Event('keydown', {keyCode: 32 });
                $('#script').trigger(e);
                return false;
            },
            open: function(event, ui) {
                console.debug("open");
                var caret = getCaretCoordinates(this, this.selectionEnd - this.alreadyEnteredLength);
                var width = caret.left;
                var height = caret.top;
                var txt = this.value;
                var cursor = this.selectionEnd;
                if(cursor < txt.length)
                  height = height + 15;
                ta = $('#script');
                width > ta.width() ?
                  width = parseInt(ta.position().left + ta.width()) :
                  width = parseInt(ta.position().left + width);

                height > ta.height() ?
                  height = parseInt(ta.position().top + ta.height()) :
                  height = parseInt(ta.position().top + height);

                $('.ui-autocomplete.ui-menu').css('left', width + 'px');
                $('.ui-autocomplete.ui-menu').css('top', height + 'px');
            },
        }).data("ui-autocomplete")._renderItem = function( ul, item ) {
                var alreadyEnteredLen = $("#script")[0].alreadyEnteredLength;
                var div = $("<div>");
                var li = $("<li>").append(div).appendTo(ul);
                // div.append($("<b>").css({'color': '#4caf50'}).text(item.label.substring(0, alreadyEnteredLen)))
                div.append($("<b>").css({'color': 'green'}).text(item.label.substring(0, alreadyEnteredLen)))
                div.append($("<span>").text(item.label.substring(alreadyEnteredLen)));
                div[0].contentEditable='true';
                div[0].selectionStart = 0;
                div[0].selectionEnd = alreadyEnteredLen;
                return li;
        };
    } // main

    main();
})();
