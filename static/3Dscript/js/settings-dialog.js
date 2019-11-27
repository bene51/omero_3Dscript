$(function() {
    var dialog, form,
    settingsbutton = $("#settings"),
    tgtWidth = $("#tgtWidth"),
    tgtHeight = $("#tgtHeight"),

    allFields = $( [] ).
        add(tgtWidth).
        add(tgtHeight).
    tips = $( ".validateTips" );

    function updateTips( t ) {
        tips
            .text( t )
            .addClass( "ui-state-highlight" );
        setTimeout(function() {
            tips.removeClass( "ui-state-highlight", 1500 );
        }, 500 );
    }

    function checkNumber(o, n, min) {
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
            updateTips(n + " must be a number >= " + min);
        }
        return valid;
    }

    function checkInteger(o, n, min) {
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
    }

    function verify() {
        var valid = true;
        allFields.removeClass( "ui-state-error" );

        valid = valid && checkInteger(tgtWidth, "Output width", 50);
        valid = valid && checkInteger(tgtHeight, "Output height", 50);

        if(valid)
            dialog.dialog("close");

        return valid;
    }

    dialog = $( "#dialog-settings" ).dialog({
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
            "Close": verify,
            Cancel: function() {
                form[ 0 ].reset();
                dialog.dialog( "close" );
            }
        },
        close: function() {
            updateTips("");
            allFields.removeClass( "ui-state-error" );
        },
        position: {
            my: "center",
            at: "center",
            of: window
        }
    });

    form = dialog.find("form").on("submit", function(event) {
        event.preventDefault();
        verify();
    });

    settingsbutton.on("click", function() {
        dialog.dialog("open");
    });
});

