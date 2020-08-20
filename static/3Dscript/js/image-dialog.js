var ImageView = Backbone.View.extend({

    el: $("#dialog-newimage"),

    oldvalue: null,

    initialize: function() {
        var self = this;
        this.model.jobs.on('reset', this.render, this);
        this.model.jobs.on('update', this.render, this);
        this.headertxt = $("#headertxt");
        this.imageId = $("#imageId");
        this.allFields = $([]).add(this.imageId);
        this.tips = $(".validateTipsNewImage");
        this.dialog = $("#dialog-newimage").dialog({
            autoOpen: false,
            height: 'auto',
            width: 'auto',
            modal: true,
            show: {
                effect: "fade",
                duration: 500
            },
            hide: {
                effect: "fade",
                duration: 500
            },
            buttons: {
                "OK": function() {
                    self.verify();
                },
                Cancel: function() {
                    self.imageId.val(self.oldvalue);
                    self.dialog.dialog("close");
                }
            },
            close: function() {
                self.updateTips("");
                self.allFields.removeClass("ui-state-error");
            },
            position: {
                my: "center",
                at: "center",
                of: window
            }
        });
        this.form = this.dialog.find("form").on("submit", function(event) {
            event.preventDefault();
            self.verify();
        });
    },

    render: function() {
        var l = this.model.jobs.length;
        var name = "";
        if(l > 0)
            name = this.model.getJob(0).get('imageName');
        if(l > 1)
            name += ", ...";
        this.headertxt.text(name);
        return this;
    },

    showDialog: function() {
        this.dialog.dialog("open");
        this.oldvalue = this.imageId.val();
    },

    updateTips: function(t) {
        this.tips.text(t)
            .addClass("ui-state-highlight");
        var self = this;
        setTimeout(function() {
            self.tips.removeClass("ui-state-highlight", 1500);
        }, 500);
    },

    checkInteger: function(o, n, min) {
        var v = 0;
        var valid = true;
        try {
            v = parseInt(o.val());
        } catch(error) {
            valid = false;
        }
        valid = valid && v >= min;

        if(!valid) {
            o.addClass("ui-state-error");
            this.updateTips(n + " must be a whole number >= " + min);
        }
        return valid;
    },

    string2IntegersFromCSV: function(s, min) {
        return s.split(',').map(Number).filter(val => val >= min);
    },

    string2IntegersFromLink: function(s, min) {
        return s.replace(/\|/g, "").split('image-').slice(1).map(Number).filter(val => val >= min);
    },

    string2Images: function(s, min) {
        if(s.startsWith("http"))
            return this.string2IntegersFromLink(s, min);
        else
            return this.string2IntegersFromCSV(s, min);
    },

    string2Datasets: function(s, min) {
        return s.replace(/\|/g, "").split('dataset-').slice(1).map(Number).filter(val => val >= min);
    },

    checkIntegers: function(o, n, min) {
        var valid = true;
        var s = o.val();
        try {
            // if it's datasets
            if(s.startsWith("http") && s.indexOf("dataset") != -1) {
                var datasets = this.string2Datasets(s, min);
                if(datasets.length > 0)
                    return {'datasets': datasets};
            }
            // else assume it's images
            else {
                var images = this.string2Images(s, min);
                if(images.length > 0)
                    return {'images': images};
            }
            valid = false;
        } catch(error) {
            console.debug(error);
            valid = false;
        }
        if(!valid) {
            o.addClass("ui-state-error");
            this.updateTips(n + " must be a list of whole numbers >= " + min);
        }
        return valid;
    },

    verify: function() {
        this.allFields.removeClass("ui-state-error");

        var imagesOrDatasets = this.checkIntegers(this.imageId, "Image ID", 0);
        if(imagesOrDatasets === false)
            return false;

        var self = this;
        var images = [];

        var valid = true;

        $.ajax({
            url: BASE_3DSCRIPT_URL + 'getImages',
            data: {
                image_id: imagesOrDatasets.images,
                dataset_id: imagesOrDatasets.datasets,
            },
            async: false,
            dataType: 'json',
            success: function(data) {
                if(data.error) {
                    self.updateTips(data.error);
                    valid = false;
                }
                else {
                    console.debug("success in verify");
                    // list of [{'id': x, 'name': 'n'}, ...]
                    images = data.images;
                    console.debug(images);
                }
            },
            error: function(xhr, ajaxOptions, thrownError) {
                console.debug("error in getImages " + thrownError);
                self.updateTips(thrownError);
                valid = false;
            }
        });

        if(valid) {
            this.model.setImages(images);
            this.dialog.dialog("close");
        }

        return valid;
    },
});


