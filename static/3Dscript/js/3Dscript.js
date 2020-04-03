var ModelJob = Backbone.Model.extend({
    defaults: function() {
        return {
            'imageId': -1,
            'imageName': '',
            'basename': '',
            'resultType': 'none', // either 'image' or 'video'
            'resultURL': '',
            'state': 'READY',
            'progress': 0,
            'position': 0,
            'stacktrace': '',
            'nextToRender': false,
        }
    },

    resetResult: function() {
        this.set({'resultType': 'none', 'resultURL': ''});
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
});

var JobList = Backbone.Collection.extend({
    model: ModelJob,
});

var Model3Dscript = Backbone.Model.extend({

    cancelled: false,

    defaults: function() {
        return {
            'outputWidth': 600,
            'outputHeight': 450,
            'nextToRender': -1,
            'processing': false,
        }
    },

    initialize: function() {
        this.jobs = new JobList();
        this.jobs.add(new ModelJob());
        this.setNextToRender(0);
    },

    resetResults: function() {
        this.jobs.each(function(job) { job.resetResult(); });
    },

    setNextToRender: function(index) {
        var before = this.get('nextToRender');
        if(before == index)
            return;
        this.set('nextToRender', index);
        if(before >= 0)
            this.getJob(before).set('nextToRender', false);
        if(index >= 0)
            this.getJob(index).set('nextToRender', true);
    },

    setImages: function(imageIds, imageNames) {
        var newJobs = [];
        for(var i = 0; i < imageIds.length; i++) {
            newJobs.push(new ModelJob({
                'imageId': imageIds[i],
                'imageName': imageNames[i],
            }));
        }
        this.jobs.reset(newJobs);
        this.setNextToRender(-1);
        this.setNextToRender(0);
    },

    setOutputSize: function(outputWidth, outputHeight) {
        this.set({'outputWidth': outputWidth, 'outputHeight': outputHeight});
    },

    getCurrentJob: function() {
        var idx = this.get('nextToRender');
        if(idx < 0 || idx >= this.jobs.length)
            return null;
        return this.jobs.at(idx);
    },

    getJob: function(index) {
        return this.jobs.at(index);
    },

    startRendering: function(script) {
        if(this.jobs.length == 0) {
            // TODO show some message/warning: choose images first
            return;
        }
        var that = this;
        this.cancelled = false;
        this.setNextToRender(0);
        this.set('processing', true);
        this.resetResults();
        this.getJob(0).setStateAndProgress("STARTING", 2, null, -1);
        var targetWidth = this.get('outputWidth');
        var targetHeight = this.get('outputHeight');
        var imageIds = this.jobs.map(function(s){return s.get('imageId')});
        console.debug(imageIds);
        $.ajax({
            url: '/omero_3dscript/startRendering',
            data: {
                imageId: imageIds,
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
                    that.getJob(0).setStateAndProgress('ERROR: ' + err, -1, st, -1); // needs to be called for a job
                }
                else {
                    var basenames = data.basename;
                    console.debug("basenames = " + data.basename);
                    for(var i = 0; i < imageIds.length; i++) {
                        that.getJob(i).set('basename', basenames[i]);
                    }
                    console.debug("before calling updateState");
                    console.debug(that);
                    that.updateState();
                }
            },
            error: function(xhr, ajaxOptions, thrownError) {
                console.debug("error in startRendering " + thrownError);
            }
        });
    },

    updateState: function() {
        console.debug("updateState()");
        var that = this;
        var idx = this.get('nextToRender');
        if(idx >= this.jobs.length)
            return;
        var job = this.getJob(idx);
        console.debug("updateState");
        console.debug(idx);
        console.debug(job);
        var basename = job.get('basename');
        setTimeout(function myTimer() {
            if(that.cancelled) {
                that.cancelRendering(basename); // TODO handle cancel for multiple jobs, maybe need to set processing to false?
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

                    console.debug("state = "  + state);
                    if(state.startsWith('ERROR')) {
                        var st = data.stacktrace;
                        job.setStateAndProgress('ERROR', progress, st, -1);
                        if(idx != that.jobs.length - 1) {
                            that.setNextToRender(idx + 1);
                            that.updateState();
                        }
                        else {
                            that.set('processing', false);
                        }
                    }
                    else if (state.startsWith('FINISHED')) {
                        console.debug(job);
                        var type = data.type;
                        var url = "/webclient/annotation/" + data.annotationId + "/";
                        job.setResult(type, url);
                        job.setStateAndProgress('FINISHED', 100, null, -1);
                        if(idx != that.jobs.length - 1) {
                            that.setNextToRender(idx + 1);
                            that.updateState();
                        }
                        else {
                            that.set('processing', false);
                        }
                    }
                    else if (state.startsWith('QUEUED')) {
                        job.setStateAndProgress(state, progress, null, pos);
                        that.updateState();
                    }
                    else {
                        job.setStateAndProgress(state, progress, null, pos);
                        that.updateState();
                    }
                },
                error: function(xhr, ajaxOptions, thrownError) {
                    // TODO show error in gui
                    console.debug("error in updateState " + thrownError);
                }
            });
        }, 500);
    },

    // TODO implement for basenames (plural)
    cancelRendering: function(basenames) {
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

//    createAnnotation: function() {
//        var that = this;
//        var idx = this.get('nextToRender');
//        var job = this.jobs.at(idx);
//        job.setStateAndProgress('CREATE ATTACHMENT', 95, null, 0);
//        var basename = job.get('basename');
//        var imageId = job.get('imageId');
//        $.ajax({
//            url: '/omero_3dscript/createAnnotation',
//            data: {
//                basename: basename,
//                imageId: imageId
//            },
//            dataType: 'json',
//            success: function(data) {
//                if(data.error) {
//                    var err = data.error.trim();
//                    var st = data.stacktrace;
//                    job.setStateAndProgress('ERROR: ' + err, -1, st, -1);
//                    that.set('nextToRender', idx + 1);
//                }
//                else {
//                    var type = data.isVideo ? 'video' : 'image';
//                    var url = "/webclient/annotation/" + data.annotationId + "/";
//                    job.setResult(type, url);
//                    job.setStateAndProgress('FINISHED', 100, null, -1);
//                    that.set('nextToRender', idx + 1);
//                }
//            },
//            error: function(xhr, ajaxOptions, thrownError) {
//                console.debug("error in createAnnotation " + thrownError);
//            },
//        });
//    },
});

var AppView = Backbone.View.extend({
    el: $("#content"),

    events: {
        "click #render-button": "handleRenderButton",
        "click #cancel-button": "handleCancelButton",
    },

    initialize: function() {
        this.model.on('change:processing', this.render, this);
        this.model.on('change:nextToRender', this.jobIndexChanged, this);
        this.model.jobs.on('update', this.jobsReset, this);
        this.model.jobs.on('reset', this.jobsReset, this);
        this.listenTo(this.model.jobs, 'add', this.oneJobAdded);
        this.jobsReset();
    },

    oneJobAdded: function(job) {
        console.debug("oneJobAdded");
        console.debug(job);
        var view = new ResultView({model: job});
        this.$("#videoContainer").append(view.render().el);
    },

    jobsReset: function() {
        console.debug("jobsReset");
        this.$("#videoContainer").empty();
        this.model.jobs.each(this.oneJobAdded, this);
        this.jobIndexChanged();
        this.renderColumns();
    },

    renderColumns: function() {
        var minwidth=200;
        var parentWidth = this.$("#videoContainer").outerWidth();
        var nCols = Math.floor(parentWidth / minwidth);
        if(nCols < 1)
            nCols = 1;
        if(nCols > 5)
            nCols = 5;
        if(nCols > this.model.jobs.length)
            nCols = this.model.jobs.length;
        var lut = ['100%', '50%', '33.3%', '25%', '20%'];
        $(".preview").css("width", lut[nCols - 1]);
    },

    jobIndexChanged: function() {
        console.debug("jobIndexChanged");
        if(this.pv) {
            delete this.pv;
        }
        var job = this.model.getCurrentJob();
        console.debug(job);
        if(job) {
            this.pv = new ProgressView({model: job});
        }
    },

    handleRenderButton: function(event) {
        var imageId = $("#imageId").val();
        var script = $("#script").val();
        this.model.startRendering(script);
    },

    handleCancelButton: function(event) {
        this.model.cancelled = true;
    },

    render: function() {
        var renderbutton = $("#render-button");
        var cancelbutton = $("#cancel-button");
        var processing = this.model.get('processing');
        if(!processing) {
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

    tagName: "div",

    className: "preview",

    initialize: function() {
        this.model.on('change:resultURL', this.render, this);
        this.model.on('change:nextToRender', this.render, this);
        this.model.on('change:progress', this.renderProgress, this);
        this.model.on('destroy', this.doremove, this);
    },

    doremove: function() {
        console.debug("doremove");
        this.remove();
    },

    /*
     * https://stackoverflow.com/questions/11789665/jquery-animate-svg-element
     * https://www.digitaldesignjournal.com/best-circular-progress-bar-html-css/
     * https://codepen.io/web-tiki/pen/qEGvMN
     */
    renderProgress: function() {
        var prog = this.model.get('progress');
        var path = $("#path", this.$el);
        var full = 188.0; // radius = 30, 2 * pi * 30 = 188;
        path.animate(
          {'foo':prog},
          {
            step: function(foo){
              $(this).attr('stroke-dasharray', (full * foo / 100) + ',' + full);
            },
            duration: 100
          }
        );
    },

    render: function() {
        console.debug("ResultView.render");
        console.debug(this.model);
        var type = this.model.get('resultType');
        var url = this.model.get('resultURL');
        console.debug(this.el);
        if(type == 'video') {
            var src = $("<source>").attr({
                'src': url,
                'type': 'video/mp4'});
            var video = $("<video></video>")
                .attr("controls", true)
                .append(src);
            this.$el.empty().append(video);
        }
        else if(type == 'image') {
            var img = $("<img>")
                .attr({'src': url, 'type': 'image/png'})
            this.$el.empty().append(img);
        }
        else if(type == 'none') {
            var ph = $("<div>");
            if(this.model.get('nextToRender')) {
                ph.addClass("placeholder")
                    .css("border", "1px solid #4caf50");
                ph.html(
                    '<svg id="roundprogress" viewbox="0 0 100 100">\n' +
                    '    <circle cx="50" cy="50" r="45" fill="#4caf50"/>\n' +
                    '    <path fill="none" stroke-linecap="round" stroke-width="10" stroke="#888"\n' +
                    '        d="M50 20' +
                    '           a 30 30 0 0 1 0 60' +
                    '           a 30 30 0 0 1 0 -60"/>\n' +
                    '    <path id="path" fill="none" stroke-linecap="round" stroke-width="10" stroke="#fff"\n' +
                    '        stroke-dasharray="2,250"\n' +
                    '        d="M50 20' +
                    '           a 30 30 0 0 1 0 60' +
                    '           a 30 30 0 0 1 0 -60"/>\n' +
                    '</svg>');
            }
            this.$el.empty().append(ph);
        }

        return this;
    },
});

(function() {
    model = new Model3Dscript();
    var settingsView = new SettingsView({model: model});
    var imageView = new ImageView({model: model});
    new QueueView({model: model});
    var appView = new AppView({model: model});

    var settingsbutton = $("#settings");
    var imagebutton = $("#imagebutton");


    function onresize() {
        var left = ($(window).width() - 600) / 2.0;
        $("#header").css({"padding-left": left + "px"});
        appView.renderColumns();
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
