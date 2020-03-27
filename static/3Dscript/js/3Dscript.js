var Model3Dscript = Backbone.Model.extend({

    cancelled: false,

    defaults: function() {
        return {
            'outputWidth': 600,
            'outputHeight': 450,
            'imageId': -1,
            'imageName': '',
            'resultType': 'image', // either 'image' or 'video'
            'resultURL': '',
            'state': 'READY',
            'progress': 0,
            'position': 0,
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

    setStateAndProgress: function(state, progress, stacktrace, position) {
        this.set('state', state);
        if(progress >= 0)
            this.set('progress', progress);
        if(stacktrace != null)
            this.set('stacktrace', stacktrace);
        if(position >= 0)
            this.set('position', position);
    },

    startRendering: function(imageId, script) {
        var that = this;
        this.cancelled = false;
        this.setStateAndProgress("STARTING", 2, null, -1);
        var targetWidth = this.get('outputWidth');
        var targetHeight = this.get('outputHeight');
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
                    var err = data.error.trim();
                    var st = data.stacktrace;
                    that.setStateAndProgress('ERROR: ' + err, -1, st, -1);
                }
                else {
                    var basename = data.basename;
                    that.updateState(basename);
                }
            },
            error: function(xhr, ajaxOptions, thrownError) {
                console.debug("error in startRendering " + thrownError);
            }
        });
    },

    updateState: function(basename) {
        var that = this;
        setTimeout(function myTimer() {
            if(that.cancelled) {
                that.cancelRendering(basename);
                return;
            }
            $.ajax({
                url: '/omero_3dscript/getStateAndProgress',
                data: {
                    basename: basename
                },
                dataType: 'json',
                success: function(data) {
                    // get the position in the queue:
                    // 0 means it's currently processed,
                    // 1 means it's the first in the queue (after the currently processed)
                    // etc.
                    var pos = data.position;
                    var progress = 100 * data.progress;
                    var state = data.state;

                    if(state.startsWith('ERROR')) {
                        var st = data.stacktrace;
                        that.setStateAndProgress('ERROR', progress, st, -1);
                    }
                    else if (state.startsWith('FINISHED')) {
                        that.createAnnotation(basename, $("#imageId").val());
                    }
                    else if (state.startsWith('QUEUED')) {
                        that.setStateAndProgress(state, progress, null, pos);
                        that.updateState(basename);
                    }
                    else {
                        that.setStateAndProgress(state, progress, null, pos);
                        that.updateState(basename);
                    }
                },
                error: function(xhr, ajaxOptions, thrownError) {
                    console.debug("error in updateState " + thrownError);
                }
            });
        }, 500);
    },

    cancelRendering: function(basename) {
        var that = this;
        $.ajax({
            url: '/omero_3dscript/cancelRendering',
            data: {
                basename: basename
            },
            dataType: 'json',
            success: function(data) {
                console.debug("cancelled");
                that.setStateAndProgress("CANCELLED", -1, null, -1);
            },
            error: function(xhr, ajaxOptions, thrownError) {
                console.debug("error in updateState " + thrownError);
            }
        });
    },

    createAnnotation: function(basename, imageId) {
        this.setStateAndProgress('CREATE ATTACHMENT', 95, null, 0);
        var that = this;
        $.ajax({
            url: '/omero_3dscript/createAnnotation',
            data: {
                basename: basename,
                imageId: imageId
            },
            dataType: 'json',
            success: function(data) {
                if(data.error) {
                    var err = data.error.trim();
                    var st = data.stacktrace();
                    that.setStateAndProgress('ERROR: ' + err, -1, st, -1);
                }
                else {
                    var type = data.isVideo ? 'video' : 'image';
                    var url = "/webclient/annotation/" + data.annotationId + "/";
                    that.setResult(type, url);
                    that.setStateAndProgress('FINISHED', 100, null, -1);
                }
            },
            error: function(xhr, ajaxOptions, thrownError) {
                console.debug("error in createAnnotation " + thrownError);
            },
        });
    },
});

var AppView = Backbone.View.extend({
    el: $("#content"),

    initialize: function() {
        this.model.on('change:state', this.render, this);
    },

    render: function() {
        var renderbutton = $("#render-button");
        var cancelbutton = $("#cancel-button");
        var state = this.model.get('state');
        if(state.startsWith('CANCELLED') ||
            state.startsWith('ERROR') ||
            state.startsWith('FINISHED')) {
            cancelbutton.prop("disabled", true);
            renderbutton.prop("disabled", false);
        } else {
            cancelbutton.prop("disabled", false);
            renderbutton.prop("disabled", true);
        }
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
    var queueView = new QueueView({model: model});
    var appView = new AppView({model: model});

    var renderbutton = $("#render-button");
    var cancelbutton = $("#cancel-button");
    var settingsbutton = $("#settings");
    var imagebutton = $("#imagebutton");


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
            var imageId = $("#imageId").val();
            var script = $("#script").val();
            model.startRendering(imageId, script);
        });

        cancelbutton.on("click", function() {
            model.cancelled = true;
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
