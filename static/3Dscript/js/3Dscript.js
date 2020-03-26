var Model3Dscript = Backbone.Model.extend({
    defaults: function() {
        return {
            'outputWidth': 600,
            'outputHeight': 450,
            'imageId': -1,
            'imageName': '',
            'resultType': 'image', // either 'image' or 'video'
            'resultURL': '',
            'state': '',
            'progress': 0,
            'stacktrace': '',
        }
    },

    setImage: function(imageId, imageName) {
        this.set({'imageId': imageId, 'imageName': imageName});
    },

    setOutputSize: function(outputWidth, outputHeight) {
        this.set({'outputWidth': outputWidth, 'outputHeight': outputHeight});
    },

    setResult: function(resultType, resultURL) {
        this.set({'resultType': resultType, 'resultURL': resultURL});
    },

    setStateAndProgress: function(state, progress, stacktrace) {
        this.set({'state': state, 'progress': progress});
        console.debug
        if(stacktrace)
            this.set({'stacktrace': stacktrace});
    },
});

var ProgressView = Backbone.View.extend({
    el: $("#accordion"),

    initialize: function() {
        this.model.on('change:state change:progress change:stacktrace', this.render, this);
        this.$el.accordion({
            collapsible: true,
            active: false,
            animate: 200,
        });
    },

    render: function() {
        var state = this.model.get('state');
        var progress = this.model.get('progress');
        var stacktrace = this.model.get('stacktrace');
        console.debug("ProgressView.render(" + state + ", " + progress + ", " + stacktrace + ")");
        var pbar = $('#bar');
        var label = $('#barlabel');
        if(progress >= 0)
            pbar.stop().animate({"width": progress + '%'}, 100);
        if(state) {
            label[0].innerHTML = state;
            if(state.startsWith('ERROR')) {
                pbar.css({"background-color":"red"});
                label.css({"color":"black"});
                if(stacktrace != null && stacktrace != '') {
                    // $("#backtrace")[0].innerHTML = "<pre>" + stacktrace + "</pre>";
                    $("#backtrace").empty().append($("<pre></pre>").text(stacktrace));
                    console.debug($("#backtrace"));
                }
                else
                    $("#backtrace").append($("<pre></pre>").text(""));
                this.$el.accordion("option", "active", 0);
                this.$el.accordion("refresh");
            }
            else {
                pbar.css({"background-color":"#4caf50"});
                label.css({"color":"white"});
                $("#backtrace").append($("<pre></pre>").text(""));
                this.$el.accordion("option", "active", false);
                this.$el.accordion("refresh");
            }
        }
    },
});

var ResultView = Backbone.View.extend({
    el: $("#videoContainer"),

    initialize: function() {
        this.model.on('change:resultType change:resultURL', this.render, this);
    },

    render: function() {
        var type = this.model.get('resultType');
        var url = this.model.get('resultURL');
        console.debug(this.el);
        if(type == 'video') {
            var src = $("<source>").attr({
                'src': url,
                'type': 'video/mp4'});
            var video = $("<video></video>")
                .attr("controls", true)
                .addClass("preview")
                .append(src);
            this.$el.empty().append(video);
        }
        else {
            var img = $("<img>")
                .attr({'src': url, 'type': 'image/png'})
                .addClass("preview");
            this.$el.empty().append(img);
        }

        return this;
    },
});

(function() {
    var model = new Model3Dscript();
    var settingsView = new SettingsView({model: model});
    var imageView = new ImageView({model: model});
    var resultView = new ResultView({model: model});
    var progressView = new ProgressView({model: model});

    var renderbutton = $("#render-button");
    var cancelbutton = $("#cancel-button");
    var settingsbutton = $("#settings");
    var imagebutton = $("#imagebutton");
    var basename;
    var cancelled = false;

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
                model.setStateAndProgress("Cancelled", -1);
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
        model.setStateAndProgress("Starting", 2);
        var imageId = $("#imageId")[0].value;
        var script = $("#script")[0].value;
        var targetWidth = model.get('outputWidth');
        var targetHeight = model.get('outputHeight');
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
                    model.setStateAndProgress('ERROR: ' + data.error.trim(), -1, data.stacktrace);
                    enableRenderingButton(true);
                }
                else {
                    basename = data.basename;
                    updateState(basename);
                }
            },
            error: function(xhr, ajaxOptions, thrownError) {
                console.debug("error in startRendering " + thrownError);
            }
        });
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
                        model.setStateAndProgress('ERROR', 100 * data.progress, data.stacktrace);
                        enableRenderingButton(true);
                    }
                    else if (data.state.startsWith('FINISHED')) {
                        createAnnotation(basename);
                        enableRenderingButton(true);
                    }
                    else if (data.state.startsWith('QUEUED')) {
                        model.setStateAndProgress(data.state, 100 * data.progress);
                        QueueDialog.setPosition(position - 1);
                        updateState(basename);
                    }
                    else {
                        QueueDialog.close();
                        model.setStateAndProgress(data.state, 100 * data.progress);
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
        model.setStateAndProgress('CREATE ATTACHMENT', 95);
        $.ajax({
            url: '/omero_3dscript/createAnnotation',
            data: {
                basename: basename,
                imageId: $("#imageId")[0].value
            },
            dataType: 'json',
            success: function(data) {
                if(data.error) {
                    model.setStateAndProgress('ERROR: ' + data.error.trim(), -1);
                    enableRenderingButton(true);
                }
                else {
                    var annotationId = data.annotationId;
                    var type = data.isVideo ? 'video' : 'image';
                    var url = "/webclient/annotation/" + annotationId;
                    model.setResult(type, url);
                    model.setStateAndProgress('FINISHED', 100);
                }
            }
        });
    }

    function onresize() {
        var left = ($(window).width() - 600) / 2.0;
        $("#header").css({"padding-left": left + "px"});
    }

    function main() {
    
        $(window).resize(function() {
            onresize();
        });
    
        onresize();

        settingsbutton.on("click", function() {
            settingsView.showDialog();
        });

        imagebutton.on("click", function() {
            imageView.showDialog();
        });

        renderbutton.on("click", function() {
            startRendering();
        });

        cancelbutton.on("click", function() {
            cancelled = true;
        });

        if($("#imageId").val() < 0) {
            $("#imageId").val('');
            imageView.showDialog();
        }

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
                var textBefore = text.substring(0, caret);
                var textAfter = text.substring(caret);
                if(lastChar === ":") {
                  let newtext = textBefore + "\n- " + textAfter;
                  $("#script")[0].value = newtext;
                  event.preventDefault();
                  caret = textBefore.length + 3;
                  $("#script")[0].selectionStart = caret;
                  $("#script")[0].selectionEnd = caret;
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

        $("#script").autogrow();

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
