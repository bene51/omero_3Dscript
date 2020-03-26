var SettingsView = Backbone.View.extend({

    el: $("#dialog-settings"),

    initialize: function() {
        var self = this;
        this.model.on('change:outputWidth change:outputHeight', this.render, this);
        this.tgtWidth = $("#tgtWidth");
        this.tgtHeight = $("#tgtHeight");
        this.allFields = $([]).
            add(this.tgtWidth).
            add(this.tgtHeight);
        this.tips = $(".validateTips");
        this.dialog = $("#dialog-settings").dialog({
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
        console.debug("render()");
        var w = this.model.get('outputWidth');
        var h = this.model.get('outputHeight');
        console.debug("w = " + w);
        this.tgtWidth.val(w);
        this.tgtHeight.val(h);
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

    checkNumber: function(o, n, min) {
        var v = 0;
        var valid = true;
        try {
            v = parseFloat(o.val());
        } catch(error) {
            valid = false;
        }
        valid = valid && v >= min;

        if(!valid) {
            o.addClass("ui-state-error");
            this.updateTips(n + " must be a number >= " + min);
        }
        return valid;
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

    verify: function() {
        var valid = true;
        this.allFields.removeClass("ui-state-error");

        valid = valid && this.checkInteger(this.tgtWidth, "Output width", 50);
        valid = valid && this.checkInteger(this.tgtHeight, "Output height", 50);


        if(valid) {
            this.model.setOutputSize(this.tgtWidth.val(), this.tgtHeight.val());
            this.dialog.dialog("close");
        }

        return valid;
    },
});

