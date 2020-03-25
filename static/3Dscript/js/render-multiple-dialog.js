render_multiple_dialog = (function() {
    var dialog, form,
    imagelink = $("#imagelinks"),
    // button = $("#render-multiple-button"),
    onOK = function() {},

    allFields = $( [] ).
        add(imagelink);
    tips = $( ".validateTipsRenderMultiple" );

    function updateTips( t ) {
        tips
            .text( t )
            .addClass( "ui-state-highlight" );
        setTimeout(function() {
            tips.removeClass( "ui-state-highlight", 1500 );
        }, 500 );
    }

    function checkValidLink(o, n) {
        if(!new RegExp("^https://.*?\\?show=(image-\\d+\\|?)+").test(o.val())) {
            o.addClass("ui-state-error");
            updateTips(n + " must be a link in the form \"https://xxx?show=image-12|image-20");
            return false;
	}
        return true;
    }

    function verify() {
        allFields.removeClass( "ui-state-error" );

        var valid = checkValidLink(imagelink, "Link");
        if(!valid)
            return false;

        console.debug("verify");

        dialog.dialog("close");
        var imageIds = imagelink.val().replace(/\|/g, "").split('image-').slice(1).map(Number);
        onOK(imageIds);
        return true;
    }

    dialog = $( "#dialog-render-multiple" ).dialog({
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

//    button.on( "click", function() {
//        dialog.dialog( "open" );
//    });

    form = dialog.find("form").on("submit", function(event) {
        event.preventDefault();
        verify();
    });

    function open(okHandler) {
        onOK = okHandler;
        dialog.dialog("open");
    }

    return {
        open: open
    };
})();

