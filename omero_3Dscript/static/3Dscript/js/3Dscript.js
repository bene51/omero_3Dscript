var ModelJob = Backbone.Model.extend({
    defaults: function() {
        return {
            'imageId': -1,          // the OMERO image id of the image to render
            'imageName': '',        // the OMERO image name (to be displayed in the headeer)
            'basename': '',         // identifies the rendering job. TODO
            'resultType': 'none',   // output type, either 'image' or 'video'
            'resultVideoURL': '',   // URL of the output video
            'resultImageURL': '',   // URL of the output image
            'state': 'READY',       // state of the rendering job, read from Fiji
            'progress': 0,          // progress of the rendering job [0;1], read from Fiji
            'position': 0,          // position of this job in the queue, 0 means this job is currently processed
            'stacktrace': '',       // stacktrace in case an error occurred
            'nextToRender': false,  // true if this job is the next one to render
        }
    },

    resetResult: function() {
        this.set({'resultType': 'none', 'resultVideoURL': '', 'resultImageURL': ''});
    },

    setResult: function(resultType, resultVideoURL, resultImageURL) {
        this.set({'resultType': resultType, 'resultVideoURL': resultVideoURL, 'resultImageURL': resultImageURL});
    },

    setStateAndProgress: function(state, progress, stacktrace, position) {
        this.set('state', state);
        if(progress >= 0)
            this.set('progress', progress);
        if(position >= 0)
            this.set('position', position);
        this.set('stacktrace', stacktrace);
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

    // The specified parameter must be a list of [{'id': x, 'name': 'n'}, ...]
    setImages: function(images) {
        var newJobs = [];
        for(var i = 0; i < images.length; i++) {
            newJobs.push(new ModelJob({
                'imageId': images[i].id,
                'imageName': images[i].name,
            }));
        }
        // remove and clean up old jobs
        for(var i = this.jobs.length - 1; i >= 0; i--)
	    this.jobs.at(i).destroy();
        // set new jobs
        this.jobs.reset(newJobs);
        // make sure the value changes so that the views get notified
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
        this.resetResults();
        this.set('processing', true);
        this.getJob(0).setStateAndProgress("STARTING", 2, null, -1);
        var targetWidth = this.get('outputWidth');
        var targetHeight = this.get('outputHeight');
        var imageIds = this.jobs.map(function(s){return s.get('imageId')});
        console.debug(imageIds);
        $.ajax({
            url: BASE_3DSCRIPT_URL + 'startRendering',
            method: 'POST',
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
                    that.getJob(0).setStateAndProgress('ERROR: ' + err, -1, st, 0); // needs to be called for a job
                }
                else {
                    var basenames = data.basename;
                    console.debug("basenames = " + data.basename);
                    for(var i = 0; i < imageIds.length; i++) {
                        that.getJob(i).set('basename', basenames[i]);
                    }
                    console.debug("before calling updateState");
                    console.debug(that);
                    // call updateState(), which calls itself until the
                    // rendering job has finished
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
                var basenames = that.jobs.map(function(s){return s.get('basename')});
                that.cancelRendering(basenames);
                return;
            }
            $.ajax({
                url: BASE_3DSCRIPT_URL + 'getStateAndProgress',
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
                        job.setStateAndProgress('ERROR', progress, st, 0);
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
                        // var vurl = "/webclient/annotation/" + data.videoAnnotationId + "/";
                        var vurl = BASE_3DSCRIPT_URL + "getVideo?basename=" + encodeURIComponent(basename);
                        var iurl = "/webclient/annotation/" + data.imageAnnotationId + "/";
                        job.setResult(type, vurl, iurl);
                        job.setStateAndProgress('FINISHED', 100, null, 0);
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

    cancelRendering: function(basenames) {
        var that = this;
        $.ajax({
            url: BASE_3DSCRIPT_URL + 'cancelRendering',
            method: 'POST',
            data: {
                basename: basenames
            },
            dataType: 'json',
            success: function(data) {
                console.debug("cancelled");
                that.jobs.each(function(job) {
                    job.setStateAndProgress("CANCELLED", -1, null, -1);
                });
                that.set('processing', false);
            },
            error: function(xhr, ajaxOptions, thrownError) {
                console.debug("error in updateState " + thrownError);
            }
        });
    },
});

var AppView = Backbone.View.extend({
    el: $("#content"),

    events: {
        "click #render-button": "handleRenderButton",
        "click #cancel-button": "handleCancelButton",
        "click #playall": "handlePlayallButton",
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

    handlePlayallButton: function(event) {
        $("video").trigger('play');
    },

    render: function() {
        var renderbutton = $("#render-button");
        var cancelbutton = $("#cancel-button");
        var playallbutton = $("#playall");
        var processing = this.model.get('processing');
        if(!processing) {
            cancelbutton.prop("disabled", true);
            renderbutton.prop("disabled", false);
            if(this.model.jobs.length > 1)
                playallbutton.show();
            $("#roundprogress", "#videoContainer").hide();
            $("#placeholdertext", "#videoContainer").show();
        } else {
            cancelbutton.prop("disabled", false);
            renderbutton.prop("disabled", true);
            playallbutton.hide();
            $("#roundprogress", "#videoContainer").show();
            $("#placeholdertext", "#videoContainer").hide();
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
            heightStyle: "content",
        });
    },

    render: function() {
        var state = this.model.get('state');
        var progress = this.model.get('progress');
        var stacktrace = this.model.get('stacktrace');
        console.debug("ProgressView.render(" + state + ", " + progress + ", " + stacktrace + ")");
        var pbar = $('#bar');
        var label = $('#barlabel');
        if(progress >= 0) {
            // pbar.stop().animate({"width": progress + '%'}, 100);
            pbar.css("width", progress + '%');
	}
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
                    $("#backtrace").empty().append($("<pre></pre>").text(""));
                this.$el.accordion("refresh");
                this.$el.accordion("option", "active", 0);
            }
            else {
                pbar.css({"background-color":"#4caf50"});
                label.css({"color":"white"});
                $("#backtrace").empty().append($("<pre></pre>").text(""));
                this.$el.accordion("refresh");
                this.$el.accordion("option", "active", false);
            }
        }
    },
});

var ResultView = Backbone.View.extend({

    tagName: "div",

    className: "preview",

    initialize: function() {
        this.model.on('change:resultImageURL', this.render, this);
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
        var vurl = this.model.get('resultVideoURL');
        var iurl = this.model.get('resultImageURL');
        var imageName = this.model.get('imageName');
        var nChilds = this.model.collection.length;
        var multiple = nChilds > 1;
        console.debug(this.el);
        var title = $("<div>")
            .addClass("title")
            .text(imageName);

        if(type == 'video') {
            var src = $("<source>").attr({
                'src': vurl,
                'type': 'video/mp4'});
            var video = $("<video></video>")
                .attr("controls", true)
                .attr("preload", "none")
                .attr("poster", iurl)
                .append(src);
            this.$el.empty();
            if(multiple)
                this.$el.append(title)
            this.$el.append(video);
            // var bodyHeight = $("body").height();
            // var scriptTop = $("#script").offset().top;
            // $("html").animate({scrollTop: scriptTop - bodyHeight}, 300);
            // $('html, body').animate({scrollTop: $(document).height()}, 500);
        }
        else if(type == 'image') {
            var img = $("<img>")
                .attr({'src': iurl, 'type': 'image/png'})
            this.$el.empty();
            if(multiple)
                this.$el.append(title)
            this.$el.append(img);
            // var bodyHeight = $("body").height();
            // var scriptTop = $("#script").offset().top;
            // $("html").animate({scrollTop: scriptTop - bodyHeight}, 300);
            // $('html, body').animate({scrollTop: $(document).height()}, 500);
        }
        else if(type == 'none') {
            var ph = $("<div>");
            if(this.model.get('nextToRender')) {
                ph.addClass("placeholder")
                    .css("border", "1px solid #4caf50");
                ph.html(
                    '<svg id="roundprogress" viewbox="0 0 100 100">\n' +
                    // '    <circle cx="50" cy="50" r="45" fill="#4caf50"/>\n' +
                    '    <path fill="none" stroke-linecap="round" stroke-width="6" stroke="#444"\n' +
                    '        d="M50 20' +
                    '           a 30 30 0 0 1 0 60' +
                    '           a 30 30 0 0 1 0 -60"/>\n' +
                    // '    <path id="path" fill="none" stroke-linecap="round" stroke-width="10" stroke="#fff"\n' +
                    '    <path id="path" fill="none" stroke-linecap="round" stroke-width="6" stroke="#4caf50"\n' +
                    '        stroke-dasharray="2,250"\n' +
                    '        d="M50 20' +
                    '           a 30 30 0 0 1 0 60' +
                    '           a 30 30 0 0 1 0 -60"/>\n' +
                    '</svg>\n');
                var largeSize = 4.2 / nChilds;
                var smallSize = nChilds == 1 ? 1 : 0.7;
                var phtext = $("<div>")
                    .attr("id", "placeholdertext")
                    .css("text-align", "center")
                    .css("position", "absolute")
                    .css("bottom", "40%")
                    .css("width", "100%")
                    .css("font-family", "Helvetica")
                    .css("color", "wheat")
                    .append(
                        $("<p>")
                            .css("font-size", largeSize + "em")
                            .css("margin-block-start", "0")
                            .css("margin-block-end", "0")
                            .text("Coming soon"))
                    .append(
                        $("<p>")
                            .css("font-size", smallSize + "em")
                            .text("Please click the <Render> button."));
                ph.append(phtext);
                if(this.$el.index() > 0)
                    phtext.hide(); // hide by default and only show it upon button press (render/cancel)
                this.$el.empty();
                if(multiple)
                    this.$el.append(title)
                this.$el.append(ph);
                // var bodyHeight = $("body").height();
                // var scriptTop = $("#script").offset().top;
                // $("html").animate({scrollTop: scriptTop - bodyHeight}, 300);
                // $('html, body').animate({scrollTop: $(document).height()}, 500);
            }
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

    var heightSetByAutogrow = 0;


    /**
     * - Align the header text with the video and textarea
     * - Adjust the number of columns in case there are
     *   multiple renderings.
     */
    function onresize() {
        var left = ($(window).width() - 600) / 2.0;
        $("#header").css({"padding-left": left + "px"});
        appView.renderColumns();
        initializeScriptAreaSize();
    }

    /**
     * Set the initial height of the script textarea so that it fills
     * all the available (vertical) space.
     */
    function initializeScriptAreaSize() {
        var scriptY = $("#script").position().top;
        var bodyHeight = $("body").height();
        var buttonsHeight = $("#buttons").outerHeight(true) + 40; /* margin-bottom of content */
        var footerHeight = $("#footer").outerHeight(true) + 5 /* bottom */ + 10 /* top */;

        var scriptHeight = bodyHeight - scriptY - buttonsHeight - footerHeight;
        var minHeight = 150;
        if(scriptHeight < minHeight)
            scriptHeight = minHeight;
        $("#script").data('autogrow-start-height', scriptHeight);
        if(heightSetByAutogrow > minHeight)
            scriptHeight = heightSetByAutogrow;

        $("#script").height(scriptHeight)
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

        /*
	 * If imageId < 0 (which is the case when opening OMERO.3Dscript
	 * via the OMERO.web top link), display the new image dialog.
	 */
        var imageId = $("#imageId").val();
        if(imageId < 0) {
            $("#imageId").val('');
            imageView.showDialog();
        }
        else {
	    // list of [{'id': x, 'name': 'n'}, ...]
            var imageName = $("#headertxt").text();
            model.setImages([{'id': imageId, 'name': imageName}]);
        }

        /*
	 * For autocompletion
	 */
        $("#script").bind("keydown", function(event) {
            console.debug("*" + $(this).data("ui-autocomplete").menu.element.is(":visible"));
            if(event.keyCode === $.ui.keyCode.TAB && $(this).data("ui-autocomplete").menu.element.is(":visible")) {
                event.preventDefault();
            }
            if(event.keyCode === $.ui.keyCode.ENTER && !$(this).data("ui-autocomplete").menu.element.is(":visible")) {
              var caret = $("#script")[0].selectionStart;
              var text = $("#script").val();
              if(caret > 0) {
                var lastChar = text.charAt(caret - 1);
                var textBefore = text.substring(0, caret);
                var textAfter = text.substring(caret);
                var lines = textBefore.split("\n");
                var lastLineStartsWithDash = lines.length > 0 && lines[lines.length - 1].startsWith("- ");
                if(lastChar === ":" || lastLineStartsWithDash) {
                  let newtext = textBefore + "\n- " + textAfter;
                  $("#script")[0].value = newtext;
                  event.preventDefault();
                  caret = textBefore.length + 3;
                  $("#script")[0].selectionStart = caret;
                  $("#script")[0].selectionEnd = caret;
                  var e = $.Event('keydown', {keyCode: 32 });
                  $('#script').trigger(e);
                } else {
                  var lines = textBefore.split("\n");
                  console.debug("lines = " + lines);
		}
              }
            }
        });

        // https://stackoverflow.com/questions/5643767/jquery-ui-autocomplete-width-not-set-correctly
        jQuery.ui.autocomplete.prototype._resizeMenu = function() {
            var ul = this.menu.element;
            ul.css("width: 100%;");
        }

        /*
	 * Make the script's textarea grow automatically to fill
	 * the available (vertical) space.
	 */
        var script = $("#script");
        $("#script").autogrow({
            animate: false
        });
        $(document).on('autogrow:grow', function(e) {
            console.debug("autogrow: " + script.height());
            heightSetByAutogrow = script.height();
            window.scrollTo(0,document.body.scrollHeight);
        });
        $(document).on('autogrow:shrink', function(e) {
            console.debug("autogrow: " + script.height());
            heightSetByAutogrow = script.height();
            window.scrollTo(0,document.body.scrollHeight);
        });

        /*
	 * The remainder deals with autocompletion.
	 */
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
                console.debug("Selected: *" + ui.item.value + "*");
                if(!ui.item.value)
                    return false;
                var txt = this.value;
                console.debug(txt);
                var insertPos = this.selectionEnd - this.alreadyEnteredLength;
                console.debug("insertPos = "  + insertPos);
                console.debug("left = *" + txt.substring(0, insertPos) + "*");
                var repl = txt.substring(0, insertPos) + ui.item.value + " " + txt.substring(insertPos + this.alreadyEnteredLength, txt.length);
                console.debug("replace: *" + repl + "*");
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
