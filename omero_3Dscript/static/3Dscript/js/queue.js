var QueueView = Backbone.View.extend({

    bx: [171, 260, 319, 364, 401, 433, 462, 487, 510, 531,
        551, 569, 587, 603, 619, 634, 648, 662, 675, 688, 700],
    by: [66, 87, 100, 111, 119, 127, 133, 139, 144, 149,
        154, 158, 162, 166, 169, 173, 176, 179, 182, 185, 188],
    bw: [72, 61, 54, 49, 45, 41, 38, 35, 32, 30,
        27, 25, 23, 21, 19, 18, 16, 14, 13, 11, 10],
    bh: [45, 38, 34, 31, 28, 26, 24, 22, 20, 19,
        17, 16, 14, 13, 12, 11, 10, 9, 8, 7, 6],

    el: $("#dialog-queue"),

    job: null,

    initialize: function() {
        this.model.jobs.on('reset', this.updateJob, this);
        this.dialog = $("#dialog-queue").dialog({
            autoOpen: false,
            resizable: false,
            draggable: false,
            height: 'auto',
            width: 'auto',
            hide: false,
            position: {my: "center", at: "center", of: window},
            modal: true
        });
    },

    updateJob: function() {
        if(this.job != null)
            this.job.off('change:position');
        this.job = null;
        if(this.model.jobs.length > 0) {
            this.job = this.model.jobs.at(0);
            this.job.on('change:position', this.render, this);
            console.debug("job is now " + this.job.basename);
        }
    },

    render: function() {
        if(this.job == null)
            return this;
        var pos = this.job.get('position') - 1;
        var dialog = this.$el;
        if(pos < 0 && dialog.dialog("isOpen")) {
            dialog.dialog("close");
            pos = this.bx.length - 1;
            SVG('#bgroup').center(this.bx[pos], this.by[pos])
                .size(this.bw[pos], this.bh[pos]);
            return this;
        }
	if(pos < 0)
            return this;
        if(pos > 0 && !dialog.dialog("isOpen"))
            dialog.dialog("open");

        var idx = Math.min(this.bx.length - 1, pos);
        let bgroup = SVG('#bgroup');
        bgroup.timeline().finish();
        bgroup.animate()
            .center(this.bx[idx], this.by[idx])
            .size(this.bw[idx], this.bh[idx]);
        console.debug("bubble size = " + this.bw[idx] + " x " + this.bh[idx]);
        $('#blabel')[0].textContent = (pos + 1).toString();
        $('#imageoverlay')[0].innerHTML = "You are number " + (pos + 1) + " in line";
    }
});

