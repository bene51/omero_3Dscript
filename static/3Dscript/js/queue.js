var QueueDialog = (function() {

  var bx = [171, 260, 319, 364, 401, 433, 462, 487, 510, 531, 551, 569, 587, 603, 619, 634, 648, 662, 675, 688, 700];
  var by = [66, 87, 100, 111, 119, 127, 133, 139, 144, 149, 154, 158, 162, 166, 169, 173, 176, 179, 182, 185, 188];
  var bw = [72, 61, 54, 49, 45, 41, 38, 35, 32, 30, 27, 25, 23, 21, 19, 18, 16, 14, 13, 11, 10];
  var bh = [45, 38, 34, 31, 28, 26, 24, 22, 20, 19, 17, 16, 14, 13, 12, 11, 10, 9, 8, 7, 6];

  var dialog = $( "#dialog-queue" ).dialog({
    autoOpen: false,
    resizable: false,
    draggable: false,
    height: 'auto',
    width: 'auto',
    hide: false, // {effect: "clip", duration: 500},
    position: {my: "center", at: "center", of: window},
    modal: true
  });

  let currentpos = bx.length - 1;
  // SVG('#bgroup').animate(0).center(bx[currentpos], by[currentpos]).size(bw[currentpos], bh[currentpos]);

  return {
    setPosition: function(pos) {
      currentpos = pos;
      console.debug("setPosition: " + pos + " dialog = ");
      console.debug(dialog);
      if(pos > 0 && !dialog.dialog("isOpen"))
        dialog.dialog("open");

      let idx = Math.min(bx.length - 1, pos);
      let bgroup = SVG('#bgroup');
      bgroup.timeline().finish();
      bgroup.animate().center(bx[idx], by[idx]).size(bw[idx], bh[idx]);
      console.debug("bubble size = " + bw[idx] + " x " + bh[idx]);
      $('#blabel')[0].textContent=(pos + 1).toString();
      $('#imageoverlay')[0].innerHTML = "You are number " + (pos + 1) + " in line";
    },
    close: function() {
      if(dialog.dialog("isOpen")) {
	  // dialog.dialog("close");
          currentpos = bx.length - 1;
          SVG('#bgroup').center(bx[currentpos], by[currentpos]).size(bw[currentpos], bh[currentpos]);
      }
    },
  };
})();

