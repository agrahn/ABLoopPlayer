/*
  common.js

  common code used by the players

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

var vidId;
var myVideo;
var timeA, timeB;
var isTimeASet=false;
var isTimeBSet=false;
var myTimeA, myTimeB;
var loopButton, mySpeed;
var myBookmarks;
var menuItem0, menuItem1;
var ctrlPressed=false;
var bmkHash;
var bmkArr;

window.addEventListener( "load", function(){
  myTimeA = document.getElementById("myTimeA");
  myTimeB = document.getElementById("myTimeB");
  loopButton = document.getElementById("loopButton");
  mySpeed = document.getElementById("mySpeed");
  myBookmarks = document.getElementById("myBookmarks");
  menuItem0 = document.getElementById("menuItem0");
  menuItem1 = document.getElementById("menuItem1");
  loopButton.disabled=true;
  mySpeed.disabled=true;

  $("#slider").slider({ //initialisation
    min: 0,
    step: 0.025,
    range: true,
    change: function(e, ui) {onSliderChange(e, ui);},
    slide: function(e, ui) {onSliderSlide(e, ui);},
    classes: {"ui-slider-handle": "custom-slider-handle","ui-slider-range": "custom-slider-range" },
  });
  $(".ui-slider-handle").first().text("A");
  $(".ui-slider-handle").last().text("B");

  contextHelp(document.getElementById("help"));
  onLoadWindow(); //run player specific code
});

window.addEventListener( "keydown", function(e) {
  if (e.which == 17) ctrlPressed=true;
});

window.addEventListener( "keyup", function(e) {
  if (e.which == 17) ctrlPressed=false;
});

// a modal prompt dialog based on jQuery
// Usage: myPrompt( <callback>(ret), <dialog title> [, <default text>] );
var myPrompt = function(onclose, title, txt){
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
      this.parentNode.removeChild(this);
    }
  }).focus();
}

// a modal confirm dialog
// Usage: myConfirm( <callback>(<ret>), <message text> );
//   <callback> must accept one arg, which is passed to either "true" or "false", depending
//   on the result of the user interaction
var myConfirm = function(onclose, msg) {
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
      onclose(ret);
      this.parentNode.removeChild(this);
    }
  })
}

//pretty printing the current media time
var secToTimeString = function(t) {
  var h=Math.floor(t/3600);
  var s=t % 3600;
  var m=Math.floor(s/60);
  s = s % 60;
  var ms = String(s % 1).substring(2,5);
  s = Math.floor(s);
  return ((h>0 ? h+':'+strPadLeft(m,0,2) : m) + ':' + strPadLeft(s,0,2)
      + (ms.length>0 ? '.'+ms :''));
}
var strPadLeft = function strPadLeft(string,pad,length) {
  return (new Array(length+1).join(pad)+string).slice(-length);
}

// time string to seconds
var timeStringToSec = function(ts) {
  var ta=ts.trim().split(':');
  var s=Number(ta[ta.length-1]);
  s+=60*Number(ta[ta.length-2]);
  if(ta.length==3) s+=3600*Number(ta[0]);
  return s;
}

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
    sec=Math.min(sec,myGetDuration()); sec=Math.max(sec,timeA);
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
    c.addEventListener("mouseover", function(e){e.target.selected=true;});
    c.addEventListener("mouseup", function(e){
      onBmkSelect(e.target.index); e.target.parentNode.size=1;
    });
    myBookmarks.add(c,insIdx); //append as a child to selector
    c.selected=true;
    //enable tooltip for current <option> element
    $(c).tooltip({
      position: {
        my: "left bottom",
        at: "right+5px bottom",
        collision: "none"
      }
    });
    bmkHash[c.text]='';
    bmkArr.splice(insIdx, 0, bmkItem);
    localStorage.setItem(vidId, bmkArr.join());
    myBmkSpan.hidden=annotButton.disabled=false;
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
    myBookmarks.options[0].selected=true;
  }else{
    onBmkSelect(1);
  }
}

var onClickTrash = function(idx){
  if(idx==0){ //all items
    myConfirm(
      function(res){
        if(res){
          //first remove any note associated with bookmarked loops
          for(var i=1; i<myBookmarks.options.length; i++){
            localStorage.removeItem(vidId+'-'+myBookmarks.options[i].text);
          }
          //then delete the bookmarked loops themselves
          bmkDelete(0);
          localStorage.removeItem(vidId);
        }
      },
      "Really delete ALL bookmarked loops?"
    );
  }else{ //selected item
    myConfirm(
      function(res){
        if(res){
          localStorage.removeItem(vidId+'-'+myBookmarks.options[idx].text);
          bmkDelete(idx);
          localStorage.setItem(vidId, bmkArr.join());
        }
      },
      "Delete this loop?"
    );
  }
}

var onClickAddNote = function(idx){
  var defaultNote = (localStorage.getItem(vidId+'-'+myBookmarks.options[idx].text) || "example text")

  myPrompt(
    function(note){
      if(note && note.trim().length) {
        myBookmarks.options[idx].title = note;
        localStorage.setItem(vidId+'-'+myBookmarks.options[idx].text, note);
      }
    },
    "Enter description", defaultNote
  );
}

var contextHelp = function(t) {
  contextHelpLoadVideo(t);
  if(t.checked) {
    t.title = "Disable context-sensitive help.";
    loopButton.title = "Click twice to mark loop range / click to cancel current loop.";
    myBookmarks.title = "Choose from previously saved loops.";
    bmkAddButton.title = "Save current loop range to the list of bookmarks.";
    myTimeA.title = myTimeB.title = "Fine-tune loop range. Input format: [hh:]mm:ss[.sss]";
    annotButton.title = "Add a note to currently selected bookmark.";
    trashButton.title = "Delete currently selected / delete all bookmarked loops.";
    mySpeed.title = "Select playback rate.";
    $("#slider").attr("title", "Move slider handles to adjust the loop range. "
        +"Press <Ctrl> while moving a handle to shift the entire loop window.");
  } else {
    t.title="Enable context-sensitive help.";
    loopButton.title =
    myBookmarks.title =
    myTimeA.title = myTimeB.title =
    bmkAddButton.title =
    annotButton.title =
    trashButton.title =
    mySpeed.title =
    "";
    $("#slider").attr("title", "");
  }
}

///////////////////////////
// YT player specific code
///////////////////////////
var timer=[];
var knownIDs=new Array();
var knownIDsHash=new Array();

//This function creates an <iframe> (and YouTube player)
//after the API code has been downloaded.
var player;
var onYouTubeIframeAPIReady = function() {
  var playerWidth=$("#myResizable").width();
  initResizable();

  player = new YT.Player('ytplayer', {
    width: playerWidth,
    height: 9/16*playerWidth,
    playerVars: {
      autohide: 2,
      rel: 0,  // no related videos at the end
      showinfo: 0,
    },
    events: {
      onStateChange : onPlayerStateChange,
      onReady: onPlayerReady,
    }
  });
}

var onPlayerStateChange = function(e){
  if (isTimeASet && isTimeBSet && e.data==YT.PlayerState.PLAYING)
    timer.push(setInterval(onTimeUpdate,25));
  else
    while(timer.length) clearInterval(timer.pop());

  if (e.data == -1){
    cancelABLoop();
  }else if(e.data==YT.PlayerState.CUED){
    //determine available playback rates and fill the #mySpeed select element
    var rates = player.getAvailablePlaybackRates();
    for(var i=0; i<rates.length; i++) {
      var c = document.createElement('OPTION');
      mySpeed.add(c); //append as a child to selector

      c.value = c.text = rates[i];
      if(rates[i] == 1.0) {
        c.text = "Normal";
        c.selected=true;
        mySetPlaybackRate(1);
      }
    }
    mySpeed.disabled=false;
    loopButton.disabled=false;
    e.target.playVideo();
  }
}

var onPlayerReady = function(e){
  document.getElementById("loadButton").disabled=false;
}

var loadVideo = function() {
  loopButton.disabled=true;
  vidId = document.getElementById("myVidId").value.toString().trim();

  if(vidId.length!==0 && typeof knownIDsHash[vidId]==='undefined'){
    knownIDsHash[vidId]='';
    knownIDs.unshift(vidId);

    var z = document.createElement('OPTION');
    z.setAttribute('value', vidId);
    document.getElementById('videoids').insertBefore(
        z, document.getElementById('videoids').firstChild);

    if(knownIDs.length>30) {
      knownIDs.pop();
      document.getElementById('videoids').removeChild(
          document.getElementById('videoids').lastChild);
    }

    localStorage.setItem('knownIDs', knownIDs.join());
  }

  player.cueVideoById({ videoId: vidId });

  //remove all bookmark items from previous video
  bmkDelete(0);

  //look for bookmark items with this video ID
  if(localStorage.getItem(vidId)){
    var bmks = localStorage.getItem(vidId).split(',');
    for(var i=0; i<bmks.length; i++){
      bmkAdd(bmks[i]);
      myBookmarks.options[0].selected=true;
    }
    annotButton.disabled=true;
  }

  //remove all speed options
  mySpeed.disabled=true;
  while(mySpeed.options.length) mySpeed.remove(mySpeed.options.length-1);
}

var mySetPlaybackRateYT = function(r){
  player.setPlaybackRate(r);
}

var myGetDurationYT = function(){
  return player.getDuration();
}

var myGetCurrentTimeYT = function(){
  return player.getCurrentTime();
}

var mySetCurrentTimeYT = function(t){
  player.seekTo(t,true);
}

var initResizableYT = function(){
  $("#myResizable" ).resizable({
    aspectRatio: false,
    minWidth: 352,
    minHeight: 198,
    start: function(event,ui){
      document.getElementById("ytplayer").hidden=true;
    },
    stop: function(event,ui){
      player.setSize(ui.size.width,ui.size.height);
      document.getElementById("ytplayer").hidden=false;
    },
    resize: function(event,ui){
      $("#slider").width(ui.size.width);
    }
  });
}

var onBmkSelectYT = function(i){
  cancelABLoop();

  //needs to reset for some reason
  if(document.getElementById("help").checked)
    myBookmarks.title = "Choose from previously saved loops.";

  if(i==0) return;

  var a=timeStringToSec(myBookmarks.options[i].text.split('--')[0]);
  var b=timeStringToSec(myBookmarks.options[i].text.split('--')[1]);
  $("#slider").slider("option", "values", [ a, b ]);
  $("#slider").slider("option", "max", myGetDuration());
  isTimeASet=isTimeBSet=true;
  timeInputs.hidden=false;
  loopButton.value="Cancel";
  annotButton.disabled=false;
  if(player.getPlayerState()==YT.PlayerState.PLAYING)
    timer.push(setInterval(onTimeUpdate,25));
}

var cancelABLoopYT = function () {
  while(timer.length) clearInterval(timer.pop());
  isTimeASet=isTimeBSet=false;
  loopButton.value="A";
  timeInputs.hidden=true;
}

var onTimeUpdateYT = function () {
  if(myGetCurrentTime()<timeA||myGetCurrentTime()>=timeB)
    mySetCurrentTime(timeA);
}

var onLoopDownYT = function () {
  if(isTimeBSet){
    cancelABLoop();
    annotButton.disabled=true;
    myBookmarks.options[0].selected=true;
  }else{
    if(isTimeASet){
      if(myGetCurrentTime()!=timeA){
        if(myGetCurrentTime()<timeA){
          timeB=timeA;
          timeA=myGetCurrentTime();
        }else{
          timeB=myGetCurrentTime();
        }
        isTimeBSet=true;
        loopButton.value="Cancel";
        $("#slider").slider("option", "values", [ timeA, timeB ]);
        $("#slider").slider("option", "max", myGetDuration());
        timeInputs.hidden=false;

        if(player.getPlayerState()==YT.PlayerState.PLAYING)
          timer.push(setInterval(onTimeUpdate,25));
      }
    }else{
      timeA=myGetCurrentTime();
      isTimeASet=true;
      loopButton.value="B";
    }
  }
}

var onLoadWindowYT = function() {
  //get already watched IDs
  if(localStorage.getItem('knownIDs')){
    knownIDs = localStorage.getItem('knownIDs').split(',');
    for(var i=0; i<knownIDs.length; i++){
      var z = document.createElement('OPTION');
      z.setAttribute('value', knownIDs[i]);
      document.getElementById('videoids').appendChild(z);
      knownIDsHash[knownIDs[i].toString()]='';
    }
  }
}

var contextHelpLoadVideoYT = function(t) {
  if(t.checked) {
    myVidId.title = "Open video on youtube.com and "
      + "get its ID from the browser's address bar.";
  } else {
    myVidId.title = "";
  }
}

/////////////////////////
// <video> specific code
/////////////////////////
var URL = window.URL || window.webkitURL;

var playSelectedFile = function (f) {
  cancelABLoop();

  mySpeed.options.namedItem("normalSpeed").selected=true;
  mySetPlaybackRate(mySpeed.value);

  loopButton.disabled=true;

  //remove all bookmark items from previous video
  bmkDelete(0);

  //replace #myResizable container and its #myVideo child
  myResizable = document.getElementById("myResizable");
  var parent = myResizable.parentNode;
  var myResizableOld=myResizable;
  myResizable = document.createElement("div");
  myResizable.id="myResizable";
  parent.replaceChild(myResizable, myResizableOld);
  myVideo = document.createElement("video");
  myVideo.id="myVideo";
  myVideo.addEventListener("mouseover", function(e){e.target.controls=true;});
  myVideo.addEventListener("mouseout", function(e){e.target.controls=false;});
  myVideo.controls=null;
  myResizable.appendChild(myVideo);

  //set video source and add event listeners
  vidId = f.name+'-'+f.size; //some checksum would be better
  var fileURL = URL.createObjectURL(f);
  myVideo.addEventListener("canplay", onCanPlay);
  myVideo.addEventListener("play", function(e){mySetPlaybackRate(mySpeed.value);});
  myVideo.src=fileURL;

  //look for bookmark items with this video ID
  if(localStorage.getItem(vidId)){
    var bmks = localStorage.getItem(vidId).split(',');
    for(var i=0; i<bmks.length; i++){
      bmkAdd(bmks[i]);
      myBookmarks.options[0].selected=true;
    }
    annotButton.disabled=true;
  }
}

var onCanPlay = function () {
  loopButton.disabled=false;
  $("#slider").slider("option", "max", myGetDuration());
  initResizable();
}

var myGetPlaybackRate = function(){
  return myVideo.playbackRate;
}

var mySetPlaybackRateVT = function(r){
  console.log("set rate : " + r);
  myVideo.playbackRate=r;
}

var onBmkSelectVT = function(i){
  cancelABLoop();

  //needs to reset for some reason
  if(document.getElementById("help").checked)
    myBookmarks.title = "Choose from previously saved loops.";

  if(i==0) return;

  var a=timeStringToSec(myBookmarks.options[i].text.split('--')[0]);
  var b=timeStringToSec(myBookmarks.options[i].text.split('--')[1]);
  $("#slider").slider("option", "values", [ a, b ]);
  isTimeASet=isTimeBSet=true;
  timeInputs.hidden=false;
  loopButton.value="Cancel";
  annotButton.disabled=false;
  myVideo.addEventListener('timeupdate',onTimeUpdate);
}

var myGetDurationVT = function(){
  return myVideo.duration;
}

var myGetCurrentTimeVT = function(){
  return myVideo.currentTime;
}

var mySetCurrentTimeVT = function(t){
  myVideo.currentTime=t;
}

var initResizableVT = function(){
  $("#myResizable" ).resizable({
    alsoResize: "#myVideo",
    aspectRatio: true,
    minWidth: 352,
    create: function(e,ui){
      myVideo.width=$("#myResizable").width();
      $("#slider").width(myVideo.width);
    },
    resize: function(event,ui){
      $("#slider").width(ui.size.width);
    }
  });
};

var cancelABLoopVT = function () {
  myVideo.removeEventListener('timeupdate',onTimeUpdate);
  isTimeASet=isTimeBSet=false;
  loopButton.value="A";
  timeInputs.hidden=true;
}

var onTimeUpdateVT = function () {
  if(myVideo.paused) return;
  if(myGetCurrentTime()<timeA || myGetCurrentTime()>=timeB)
    mySetCurrentTime(timeA);
}

var onLoopDownVT = function () {
  if(isTimeBSet){
    cancelABLoop();
    annotButton.disabled=true;
    myBookmarks.options[0].selected=true;
  }else{
    if(isTimeASet){
      if(myGetCurrentTime()!=timeA){
        if(myGetCurrentTime()<timeA){
          timeB=timeA;
          timeA=myGetCurrentTime();
        }else{
          timeB=myGetCurrentTime();
        }
        isTimeBSet=true;
        loopButton.value="Cancel";
        $("#slider").slider("option", "values", [ timeA, timeB ]);
        timeInputs.hidden=false;

        myVideo.addEventListener('timeupdate',onTimeUpdate);
      }
    }else{
      timeA=myGetCurrentTime();
      isTimeASet=true;
      loopButton.value="B";
    }
  }
}

var onLoadWindowVT = function() {
  //add speed options
  var rates = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  for(var i=0; i<rates.length; i++) {
    var c = document.createElement('OPTION');
    mySpeed.add(c); //append as a child to selector

    c.value = c.text = rates[i];
    if(rates[i] == 1.0) {
      c.id = "normalSpeed";
      c.text = "Normal";
      c.selected=true;
    }
  }
  mySpeed.disabled=false;

  //just to show it's a video player ;)
  myVideo = document.createElement("video");
  myVideo.id="myVideo";
  myVideo.controls=true;
  myVideo.width=$("#myResizable").width();
  myVideo.disabled=true;

  var myResizable = document.getElementById("myResizable");
  myResizable.appendChild(myVideo);
}

var contextHelpLoadVideoVT = function(t) {
  if(t.checked) {
    myInput.title = "Browse the hard disk for video files.";
  } else {
    myInput.title = "";
  }
}

//functions with player specific implementation
var onBmkSelect;
var myGetDuration;
var myGetCurrentTime;
var mySetCurrentTime;
var mySetPlaybackRate;
var initResizable;
var cancelABLoop;
var onTimeUpdate;
var onLoopDown;
var contextHelpLoadVideo;
var onLoadWindow;

//initialization functions
var initYT = function () { // YT
  onBmkSelect = onBmkSelectYT;
  myGetDuration = myGetDurationYT;
  myGetCurrentTime = myGetCurrentTimeYT;
  mySetCurrentTime = mySetCurrentTimeYT;
  mySetPlaybackRate = mySetPlaybackRateYT;
  initResizable = initResizableYT;
  cancelABLoop = cancelABLoopYT;
  onTimeUpdate = onTimeUpdateYT;
  onLoopDown = onLoopDownYT;
  onLoadWindow = onLoadWindowYT;
  contextHelpLoadVideo = contextHelpLoadVideoYT;
}

var initVT = function () { // <video> tag
  onBmkSelect = onBmkSelectVT;
  myGetDuration = myGetDurationVT;
  myGetCurrentTime = myGetCurrentTimeVT;
  mySetCurrentTime = mySetCurrentTimeVT;
  mySetPlaybackRate = mySetPlaybackRateVT;
  initResizable = initResizableVT;
  cancelABLoop = cancelABLoopVT;
  onTimeUpdate = onTimeUpdateVT;
  onLoopDown = onLoopDownVT;
  onLoadWindow = onLoadWindowVT;
  contextHelpLoadVideo = contextHelpLoadVideoVT;
}
