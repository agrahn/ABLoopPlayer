/*
  common.js

  functions used by players

  Copyright (C) 2016  Alexander Grahn

  This file is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This file is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

// a modal prompt dialog based on jQuery
// Usage: myPrompt( <receiving object>, <obj property to be set>, <dialog title> [, <default text>] );
function myPrompt(onclose, title, txt=""){
  var z=$(
    '<div style="width: fit-content; display: inline-block;"><p>'
    +title+
    '</p><input value="'+txt+'" size="40"></input></div>"'
  );
  $(document.body).append(z);
  var ret=null;
  $(z).dialog({
    autoOpen: true,
    modal: true,
    dialogClass: "noTitlebar",
    closeOnEscape: false,
    closeText: "hide",
    width: "auto",
    minHeight: 0,
    buttons: [
      {
        text: "Cancel",
        click: function() {
          $(this).dialog( "close" );
        }
      },
      {
        text: "Ok",
        click: function() {
          ret=$(this).find("input").prop("value");
          $(this).dialog( "close" );
        }
      },
    ],
    close: function(e,ui) {
      onclose(ret);
//      obj[prop] = ret;
      this.parentNode.removeChild(this);
    }
  }).focus();
}

// a modal confirm dialog using jQuery
// Usage: myConfirm( <receiving object>, <its property to be set>, <dialog title> [, <default text>] );
function myConfirm(obj, prop, msg){
  var z=$("<div>"+msg+"</div>");
  $(document.body).append(z);
  var ret=false;
  $(z).dialog({
    autoOpen: true,
    modal: true,
    dialogClass: "noTitlebar",
    closeOnEscape: false,
    minHeight: 0,
    width: "auto",
    buttons: [
      {
        text: "Cancel",
        click: function() {
          $(this).dialog( "close" );
        }
      },
      {
        text: "Ok",
        click: function() {
          ret=true;
          $(this).dialog( "close" );
        }
      },
    ],
    close: function(e,ui) {
      obj[prop] = ret;
      this.parentNode.removeChild(this);
    }
  })
}

//pretty printing the current media time
function secToTimeString(t) {
  var h=Math.floor(t/3600);
  var s=t % 3600;
  var m=Math.floor(s/60);
  s = s % 60;
  var ms = String(s % 1).substring(2,5);
  s = Math.floor(s);
  return ((h>0 ? h+':'+strPadLeft(m,0,2) : m) + ':' + strPadLeft(s,0,2)
      + (ms.length>0 ? '.'+ms :''));
}
function strPadLeft(string,pad,length) {
  return (new Array(length+1).join(pad)+string).slice(-length);
}

//time string to seconds
var timeStringToSec=function(ts) {
  var ta=ts.trim().split(':');
  var s=Number(ta[ta.length-1]);
  s+=60*Number(ta[ta.length-2]);
  if(ta.length==3) s+=3600*Number(ta[0]);
  return s;
}

/*

var onSliderChange = function(event, ui) {
  timeA=ui.values[0];
  timeB=ui.values[1];
  myTimeA.value=secToTimeString(timeA);
  myTimeB.value=secToTimeString(timeB);
}

var onSliderSlide = function(e, ui) {
  if(ctrlPressed){
    var delta=timeB-timeA;
    if(ui.handleIndex==0){
      timeA=ui.values[0];
      timeB=timeA+delta;
      $("#slider" ).slider("values", 1, timeB);
    }else{
      timeB=ui.values[1];
      timeA=timeB-delta;
      $("#slider" ).slider("values", 0, timeA);
    }
    myTimeA.value=secToTimeString(Math.max(timeA,0));
    myTimeB.value=secToTimeString(Math.min(timeB, myGetDuration()));
  }else{
    onSliderChange(e, ui);
  }
}

var ctrlPressed=false;
$(document).keydown(function(e) {
  if (e.which == 17) ctrlPressed=true;
});
$(document).keyup(function(e) {
  if (e.which == 17) ctrlPressed=false;
});

var onInputTime = function(whichInput, sliderIdx) {
  var time=whichInput.value.match(
        /^\s*(?:\d+:[0-5][0-9]|[0-5]?[0-9]):[0-5][0-9](?:\.\d+)?\s*$/
      );
  if(!time){
    if(sliderIdx==0){
      $("#slider" ).slider("values", 0, timeA);
    }else{
      $("#slider" ).slider("values", 1, timeB);
    }
    return;
  }

  var sec=timeStringToSec(time[0]);
  if(sliderIdx==0){
    sec=Math.min(sec,timeB);
    $("#slider" ).slider("values", 0, sec);
  }else{
    sec=Math.min(sec,myGetDuration());
    sec=Math.max(sec,timeA);
    $("#slider" ).slider("values", 1, sec);
  }
}

var bmkAdd = function(bmkItem) {
   var ta = timeStringToSec(bmkItem.split('--')[0]);
   var tb = timeStringToSec(bmkItem.split('--')[1]);
   var insIdx=-1;
   //insert current loop into bookmarks select object, sorted in ascending
   //order w.r.t. timeA & timeB
   if(typeof bmkHash[bmkItem]==='undefined'){
     for(var i=1; i<myBookmarks.options.length && insIdx<0; i++) {
       var a=timeStringToSec(myBookmarks.options[i].text.split('--')[0]);
       var b=timeStringToSec(myBookmarks.options[i].text.split('--')[1]);
       if(ta<a || ta==a && tb<b) insIdx=i;
     }
     if(insIdx<0) insIdx=myBookmarks.options.length;

     var c = document.createElement('OPTION');
     c.title = "";
     if(localStorage.getItem(vidId+'-'+bmkItem)){
       c.title = localStorage.getItem(vidId+'-'+bmkItem);
     }  
     c.text = bmkItem;
     bmkHash[c.text]='';
     myBookmarks.add(c,insIdx); //append as a child to selector
     //refresh enabling tooltips for all appended <option> elements
     $("OPTION").tooltip();
     bmkArr.splice(insIdx, 0, bmkItem);
     localStorage.setItem(vidId, bmkArr.join());
     myBmkSpan.hidden=annotButton.disabled=false;
     myBookmarks.options[insIdx].selected=true;
     myBookmarks.options[0].hidden=true;
   }
}

var bmkDelete = function(idx) {
  if(idx==0){
    while(myBookmarks.options.length>1)
      myBookmarks.remove(myBookmarks.options.length-1);
    bmkHash=[];
    bmkArr=[];
  }else{
    bmkArr.splice(idx-1,1);
    bmkHash[myBookmarks.options[idx].text]=undefined;
    myBookmarks.remove(idx);
  }
  if(myBookmarks.options.length==1){
    myBmkSpan.hidden=true;
    myBookmarks.options[0].hidden=false;
    myBookmarks.options[0].selected=true;
  }
}

var onBmkSelect = function(i){
  cancelABLoop();
  if(i==0) return;

  var a=timeStringToSec(myBookmarks.options[i].text.split('--')[0]);
  var b=timeStringToSec(myBookmarks.options[i].text.split('--')[1]);
  $("#slider").slider("option", "max", myGetDuration());
  $("#slider").slider("option", "values", [a, b]);
  isTimeASet=isTimeBSet=true;
  timeInputs.hidden=false;
  loopButton.value="Cancel";
  myBookmarks.options[0].hidden=true;
  annotButton.disabled=false;
  myVideo.addEventListener('timeupdate',onTimeUpdate);
}

var onClickMenuitem = function(idx){
  if(idx==0){
    if(confirm("Really delete ALL bookmarked loops?")){
      //first remove any note associated with bookmarked loops
      for(var i=1; i<myBookmarks.options.length; i++){
        localStorage.removeItem(vidId+'-'+myBookmarks.options[i].text);
      }
      //then delete the bookmarked loop itself
      bmkDelete(0);
      localStorage.removeItem(vidId);
    }
  }else{
    if(confirm("Delete this loop?")){
      localStorage.removeItem(vidId+'-'+myBookmarks.options[idx].text);
      bmkDelete(idx);
      localStorage.setItem(vidId, bmkArr.join());
    }
  }
}

var onClickAddNote = function(idx){
  var defaultNote = (localStorage.getItem(vidId+'-'+myBookmarks.options[idx].text) || "example text");
  var note = prompt("Enter short description", defaultNote);
  if(note && note.trim().length) {
    myBookmarks.options[idx].title = note;
    localStorage.setItem(vidId+'-'+myBookmarks.options[idx].text, note);
  }
}

*/
