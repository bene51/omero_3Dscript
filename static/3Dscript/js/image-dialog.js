$(function() {
    var dialog, form,
    imageId = $("#imageId"),

    allFields = $( [] ).
        add(imageId);
    tips = $( ".validateTipsNewImage" );

    function updateTips( t ) {
        tips
            .text( t )
            .addClass( "ui-state-highlight" );
        setTimeout(function() {
            tips.removeClass( "ui-state-highlight", 1500 );
        }, 500 );
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
        allFields.removeClass( "ui-state-error" );

        var valid = checkInteger(imageId, "Image ID", 0);
        if(!valid)
            return false;

	//TODO set title (name of image)
        $.ajax({
            url: '/omero_3dscript/getName',
            data: {
              image: imageId.val()
            },
            async: false,
            dataType: 'json',
            success: function(data) {
              if(data.error) {
                console.debug("error in verify: " + data.error);
                updateTips(data.error);
                valid = false;
              }
              else {
                console.debug("success in verify");
                $('#headertxt')[0].innerHTML = data.name;
              }
            },
            error: function(xhr, ajaxOptions, thrownError) {
              console.debug("error in startRendering " + thrownError);
            }
        });

        if(!valid)
            return false;

        dialog.dialog("close");
        return true;
    }

    dialog = $( "#dialog-newimage" ).dialog({
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

    $("#imagebutton").on( "click", function() {
        dialog.dialog( "open" );
    });

    form = dialog.find("form").on("submit", function(event) {
        event.preventDefault();
        verify();
    });

    if($("#imageId")[0].value < 0) {
        $("#imageId")[0].value = '';
        dialog.dialog( "open" );
    }
});

