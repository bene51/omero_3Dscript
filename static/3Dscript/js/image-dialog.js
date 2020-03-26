var ImageView = Backbone.View.extend({

    el: $("#dialog-newimage"),

    initialize: function() {
        var self = this;
        this.model.on('change:imageId change:imageName', this.render, this);
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
                    self.form[0].reset();
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
        var id = this.model.get('imageId');
        var name = this.model.get('imageName');
        this.imageId.val(id);
        this.headertxt.text(name);
        return this;
    },

    showDialog: function() {
        this.dialog.dialog("open");
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
            updateTips(n + " must be a whole number >= " + min);
        }
        return valid;
    },

    verify: function() {
        this.allFields.removeClass("ui-state-error");

        var valid = this.checkInteger(this.imageId, "Image ID", 0);
        if(!valid)
            return false;

        var self = this;

        $.ajax({
            url: '/omero_3dscript/getName',
            data: {
              image: self.imageId.val()
            },
            async: false,
            dataType: 'json',
            success: function(data) {
              if(data.error) {
                console.debug("error in verify: " + data.error);
                self.updateTips(data.error);
                valid = false;
              }
              else {
                console.debug("success in verify");
                self.headertxt.text(data.name);
              }
            },
            error: function(xhr, ajaxOptions, thrownError) {
              console.debug("error in startRendering " + thrownError);
            }
        });

        if(valid) {
            this.model.setImage(this.imageId.val(), this.headertxt.text());
            this.dialog.dialog("close");
        }

        return valid;
    },
});


