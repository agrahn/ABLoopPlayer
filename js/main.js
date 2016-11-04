/*
  main.js

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

var vidId;  // YT ID or file name + size
var YTids;
var help;
var inputVT, aonly;
var timeA, timeB;
var isTimeASet=false;
var isTimeBSet=false;
var myTimeA, myTimeB;
var loopButton, mySpeed;
var myBookmarks;
var bmkAddButton;
var annotButton, trashButton;
var menuItem0, menuItem1;
var ctrlPressed=false;
var bmkHash;
var bmkArr;
var loopTimer=[];
var scrubTimer=[];

$(document).ready(function() {
  $("#introText").width($("#test").width()+1);
  //if we are online, asynchronously load YT player api
  if(navigator.onLine) {
    var scripts = document.getElementsByTagName('script');
    var scriptTag1 = scripts[scripts.length-1];
    var scriptTag2 = document.createElement('script');
    scriptTag2.src = "https://www.youtube.com/iframe_api";
    scriptTag1.parentNode.insertBefore(scriptTag2, null);
  }

  inputYT = document.getElementById("inputYT");
  YTids = document.getElementById("YTids");
  help = document.getElementById("help");
  searchButtonYT = document.getElementById("searchButtonYT");
  inputVT = document.getElementById("inputVT");
  aonly = document.getElementById("aonly");
  myTimeA = document.getElementById("myTimeA");
  myTimeB = document.getElementById("myTimeB");
  loopButton = document.getElementById("loopButton");
  mySpeed = document.getElementById("mySpeed");
  myBookmarks = document.getElementById("myBookmarks");
  bmkAddButton = document.getElementById("bmkAddButton");
  annotButton = document.getElementById("annotButton");
  trashButton = document.getElementById("trashButton");
  menuItem0 = document.getElementById("menuItem0");
  menuItem1 = document.getElementById("menuItem1");

  inputYT.disabled = searchButtonYT.disabled = true;

  //get already watched YT IDs
  if(localStorage.getItem('knownIDs')){
    knownIDs = localStorage.getItem('knownIDs').split(',');
    for(var i=0; i<knownIDs.length; i++){
      var z = document.createElement('OPTION');
      z.setAttribute('value', knownIDs[i]);
      YTids.appendChild(z);
      knownIDsHash[knownIDs[i].toString()]='';
    }
  }

  $("#scrub").slider({
    min: 0, step: 0.001, range: "min",
    slide: function(e, ui) {
      mySetCurrentTime(ui.value);
    },
  })
  $("#scrub").css("height", "6px").hide();

  $("#slider").slider({
    min: 0,
    step: 0.025,
    range: true,
    change: function(e, ui) {onSliderChange(e, ui);},
    slide: function(e, ui) {onSliderSlide(e, ui);},
  });
  $("#slider").css("height", "1em");
  $("#slider .ui-slider-handle").first().css("margin-left", "-1em").text("A");
  $("#slider .ui-slider-handle").last().css("margin-left", "0em").text("B");

  if(localStorage.getItem(help)!="unchecked") help.checked=true;
  contextHelp(help);

  playSelectedFile("");
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
    '</p><input value="'+txt+'" size="40" onfocus="this.select();"></input></div>'
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
//   <callback> must accept one arg, which gets either "true" or "false",
//   depending on the result of the user interaction
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

//pretty printing the media time
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

var onTimeUpdate = function () {
  if(myGetCurrentTime()<timeA || myGetCurrentTime()>=timeB)
    mySetCurrentTime(timeA);
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
  var time=whichInput.value.match(  //validate user input
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
    $("#myBmkSpan").show();
    annotButton.disabled=false;
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
    $("#myBmkSpan").hide();
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
          //then delete the bookmarked loops altogether
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
  if(t.checked) {
    localStorage.setItem(help, "checked");

    t.title = "Uncheck to disable context-sensitive help.";
    if(aonly.checked)
      aonly.title = "Uncheck to enable video display.";
    else
      aonly.title = "Suppress video display.";
    inputYT.title = "Enter a valid YT video ID or one or more search terms. " +
      "To get a particular video ID, open the video on youtube.com and get its ID " +
      "from the browser's address bar.";
    searchButtonYT.title = "Look up matching videos on YouTube.";
    inputVT.title = "Browse the hard disk for media files (mp4/H.264, webm, ogg, mp3, wav, ...).";
    loopButton.title = "Click twice to mark loop range / click to cancel current loop.";
    myBookmarks.title = "Choose from previously saved loops.";
    bmkAddButton.title = "Save current loop range to the list of bookmarks.";
    myTimeA.title = myTimeB.title = "Fine-tune loop range. Input format: [hh:]mm:ss[.sss]";
    annotButton.title = "Add a note to the currently selected bookmark.";
    trashButton.title = "Delete currently selected / delete all bookmarked loops.";
    mySpeed.title = "Select playback rate.";
    $("#slider").attr("title", "Move slider handles to adjust the loop range. "
        + "Press [Ctrl] while moving a handle to shift the entire loop window. "
        + "Also, handles can be moved with the arrow keys [←] , [→].");
  } else {
    localStorage.setItem(help, "unchecked");

    t.title="Enable context-sensitive help.";
    aonly.title =
    inputYT.title =
    searchButtonYT.title =
    inputVT.title =
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

var cancelABLoop = function () {
  while(loopTimer.length) clearInterval(loopTimer.pop());
  isTimeASet=isTimeBSet=false;
  loopButton.value="A";
}

var resetUI = function() {
  vidId = "undefined";

  $("#timeInputs").hide();
  cancelABLoop();
  while(scrubTimer.length) clearInterval(scrubTimer.pop());
  $("#scrub").slider("option", "value", 0).hide();

  loopButton.disabled = true;

  while(mySpeed.options.length) mySpeed.remove(mySpeed.options.length-1);
  mySpeed.disabled=true;

  bmkDelete(0);//clear current bookmark list
}

///////////////////////////
// YT player specific code
///////////////////////////
var inputYT;
var singleId;
var ytPlayer;
var knownIDs=[];
var knownIDsHash=[];

//function for loading YT player
//arg 1: input (video id | query string), arg 2: type ("singleId" | "search")
var loadYT = function (input, type) {
  initYT(); //initialize player-specific functions
  resetUI();

  //remove previous player, if there is one
  try{ytPlayer.destroy();}catch(e){}

  //replace #myResizable container
  var myResizable = document.getElementById("myResizable");
  var parent = myResizable.parentNode;
  var myResizableOld=myResizable;
  myResizable = document.createElement("div");
  myResizable.id="myResizable";
  myResizable.style.backgroundColor = '#ddd';
  parent.replaceChild(myResizable, myResizableOld);
  var playerWidth=$("#myResizable").width();
  $("#myResizable").height(playerWidth*9/16);
  initResizableYT();

  //create and append <div> as a container for YT iframe
  var ytDiv = document.createElement("div");
  ytDiv.id = "ytDiv";
  myResizable.appendChild(ytDiv);

  //create new YT player iframe, replacing ytDiv
  if(type=="singleid") {  //play a single video ID
    singleId = input;
    ytPlayer = new YT.Player('ytDiv', {
      videoId: input,
      width: playerWidth,
      height: $("#myResizable").height(),
      playerVars: {
        autoplay: 1,
        autohide: 2, //controls
        rel: 0,      //no related videos at the end
        showinfo: 1, //displaying current video info might be useful
      },
      events: {
        onStateChange: function(e) {
          onPlayerStateChange(e, singleId);
        },
        onError: onError
      }
    });
  } else { //video search resulting in a playlist
    ytPlayer = new YT.Player('ytDiv', {
      width: playerWidth,
      height: $("#myResizable").height(),
      playerVars: {
        listType: "search",
        list: input,
        autoplay: 0,
        autohide: 2,
        rel: 0,
        showinfo: 1,
      },
      events: {
        onStateChange: function(e) {
          //empty playlist, but user clicks red play btn
          if(!e.target.getPlaylist()) {
            searchYT("");
            return;
          }
          onPlayerStateChange(e,
            e.target.getPlaylist()[e.target.getPlaylistIndex()]);
        },
        onError: onError
      }
    });
  }
}

var onYouTubeIframeAPIReady = function() {
  inputYT.disabled = searchButtonYT.disabled = false;
}

var onError = function(e){
  console.log("Error: " + e.data);
  resetUI();
}

var onPlayerStateChange = function(e, id){ //event object, video id
  //restart player if playlist contains only one ID
  if(e.target.getPlaylist() && e.target.getPlaylist().length==1 && e.data==-1) {
    loadYT(e.target.getPlaylist()[0], "singleid");
    return;
  }

  //prepend search terms to the list of valid and already visited video IDs
  //if the playlist has multiple items
  var query = inputYT.value.trim().replace(/\s+/g, ' ');
  if(
    e.target.getPlaylist() && e.target.getPlaylist().length>1 &&
    e.data==-1 && query.length && typeof knownIDsHash[query]==='undefined'
  ) {
    knownIDsHash[query]='';
    knownIDs.unshift(query);

    var z = document.createElement('OPTION');
    z.setAttribute('value', query);
    YTids.insertBefore(z, YTids.firstChild);

    while(knownIDs.length>100) {
      knownIDs.pop();
      YTids.removeChild(YTids.lastChild);
    }

    localStorage.setItem('knownIDs', knownIDs.join());
  }

  //the video has changed by selecting a video from the playlist
  if(id != vidId && e.data==YT.PlayerState.PLAYING) {
    $("#scrub").slider("option", "max", myGetDuration()).show();
    scrubTimer.push(setInterval(
      function(e){
        $("#scrub").slider("option", "value", myGetCurrentTimeYT());
      } , 25
    ));

    loopButton.disabled=false;

    vidId = id;

    $("#timeInputs").hide();
    cancelABLoop();

    //clear list of playback rates
    while(mySpeed.options.length) mySpeed.remove(mySpeed.options.length-1);
    mySpeed.disabled=true;

    //clear current bookmark list
    bmkDelete(0);

    //determine available playback rates and populate the #mySpeed element
    var rates = e.target.getAvailablePlaybackRates();
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

    //populate bookmark list with saved items for the current video ID
    if(localStorage.getItem(id)){
      var bmks = localStorage.getItem(id).split(',');
      for(var i=0; i<bmks.length; i++){
        bmkAdd(bmks[i]);
        myBookmarks.options[0].selected=true;
      }
      annotButton.disabled=true;
    }

    //prepend ID to the list of valid and already visited video IDs
    if(typeof knownIDsHash[id]==='undefined'){
      knownIDsHash[id]='';
      knownIDs.unshift(id);

      var z = document.createElement('OPTION');
      z.setAttribute('value', id);
      YTids.insertBefore(z, YTids.firstChild);

      while(knownIDs.length>100) {
        knownIDs.pop();
        YTids.removeChild(YTids.lastChild);
      }

      localStorage.setItem('knownIDs', knownIDs.join());
    }

  }

  while(loopTimer.length) clearInterval(loopTimer.pop());
  if (isTimeASet && isTimeBSet && e.data==YT.PlayerState.PLAYING)
    loopTimer.push(setInterval(onTimeUpdate,25));
}

var searchYT = function(qu) {
  loadYT(qu.trim(), "search");
}

var mySetPlaybackRateYT = function(r){
  ytPlayer.setPlaybackRate(r);
}

var myGetDurationYT = function(){
  return ytPlayer.getDuration();
}

var myGetCurrentTimeYT = function(){
  return ytPlayer.getCurrentTime();
}

var mySetCurrentTimeYT = function(t){
  ytPlayer.seekTo(t,true);
}

var initResizableYT = function(){
  $("#myResizable" ).resizable({
    aspectRatio: false,
    minWidth: 160,
    minHeight: 90,
    create: function(event, ui){
      $("#slider").width($("#myResizable" ).width());
      $("#scrub").width($("#myResizable" ).width());
    },
    start: function(event,ui){
      $(ytDiv).hide();
    },
    stop: function(event,ui){
      ytPlayer.setSize(ui.size.width,ui.size.height);
      $(ytDiv).show();
    },
    resize: function(event,ui){
      $("#slider").width(ui.size.width);
      $("#scrub").width(ui.size.width);
    }
  });
}

var onBmkSelectYT = function(i){
  cancelABLoop();

  //needs to be reset for some reason
  if(help.checked) myBookmarks.title = "Choose from previously saved loops.";

  if(i==0) return;

  var a=timeStringToSec(myBookmarks.options[i].text.split('--')[0]);
  var b=timeStringToSec(myBookmarks.options[i].text.split('--')[1]);
  $("#slider").slider("option", "values", [ a, b ]);
  $("#slider").slider("option", "max", myGetDuration());
  isTimeASet=isTimeBSet=true;
  $("#timeInputs").show();
  loopButton.value="Cancel";
  annotButton.disabled=false;
  if(ytPlayer.getPlayerState()==YT.PlayerState.PLAYING)
    loopTimer.push(setInterval(onTimeUpdate,25));
}

var onLoopDownYT = function () {
  if(isTimeBSet){
    cancelABLoop();
    $("#timeInputs").hide();
    annotButton.disabled=true;
    myBookmarks.options[0].selected=true;
  }else{
    if(isTimeASet){
      if(myGetCurrentTimeYT()!=timeA){
        if(myGetCurrentTimeYT()<timeA){
          timeB=timeA;
          timeA=myGetCurrentTimeYT();
        }else{
          timeB=myGetCurrentTimeYT();
        }
        isTimeBSet=true;
        loopButton.value="Cancel";
        $("#slider").slider("option", "values", [ timeA, timeB ]);
        $("#slider").slider("option", "max", myGetDuration());
        $("#timeInputs").show();

        if(ytPlayer.getPlayerState()==YT.PlayerState.PLAYING)
          loopTimer.push(setInterval(onTimeUpdate,25));
      }
    }else{
      timeA=myGetCurrentTimeYT();
      isTimeASet=true;
      loopButton.value="B";
    }
  }
}

/////////////////////////
// <video> specific code
/////////////////////////
var URL = window.URL || window.webkitURL;
var myVideo;

var playSelectedFile = function (f) {
  initVT(); //initialize player-specific functions
  resetUI();

  //replace #myResizable container and its #myVideo child
  var myResizable = document.getElementById("myResizable");
  var parent = myResizable.parentNode;
  var myResizableOld=myResizable;
  myResizable = document.createElement("div");
  myResizable.id="myResizable";
  parent.replaceChild(myResizable, myResizableOld);

  if(aonly.checked)
    myVideo = document.createElement("audio");
  else
    myVideo = document.createElement("video");

  myVideo.id="myVideo";
  myVideo.controls="controls";
  myVideo.width=$("#myResizable").width();
  myVideo.addEventListener("durationchange", function(e){
    $("#slider").slider("option", "max", myGetDuration());
    $("#scrub").slider("option", "max", myGetDuration()).show();
  });
  myVideo.addEventListener("loadeddata", onLoadedData);
  myVideo.addEventListener("play", function(){
    mySetPlaybackRate(mySpeed.value);
    if (isTimeASet && isTimeBSet) loopTimer.push(setInterval(onTimeUpdate,25));
  });
  myVideo.addEventListener("pause", function(){
    while(loopTimer.length) clearInterval(loopTimer.pop());
  });
  myVideo.addEventListener("error", function(e){
    console.log("Error: " + e.target);
    resetUI();
  });

  myResizable.appendChild(myVideo);

  if(f) { //a media file was selected
    myVideo.autoplay = "autoplay";

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
    mySpeed.options.namedItem("normalSpeed").selected=true;

    //set video source
    vidId = f.name+'-'+f.size; //some checksum would be better
    var fileURL = URL.createObjectURL(f);
    myVideo.src=fileURL;
  }
}

var onLoadedData = function (e) {
  if(!aonly.checked) {
    e.target.addEventListener("mouseover", function(e){e.target.controls=true;});
    e.target.addEventListener("mouseout", function(e){e.target.controls=false;});
  }
  loopButton.disabled=false;

  scrubTimer.push(setInterval(
    function(){
      $("#scrub").slider("option", "value", myGetCurrentTimeVT());
    } , 0.025
  ));

  initResizableVT();

  //look for bookmark items with the current video ID
  if(localStorage.getItem(vidId)){
    var bmks = localStorage.getItem(vidId).split(',');
    for(var i=0; i<bmks.length; i++){
      bmkAdd(bmks[i]);
      myBookmarks.options[0].selected=true;
    }
    annotButton.disabled=true;
  }
}

var myGetPlaybackRate = function(){
  return myVideo.playbackRate;
}

var mySetPlaybackRateVT = function(r){
  myVideo.playbackRate=r;
}

var onBmkSelectVT = function(i){
  cancelABLoop();

  //needs to be reset for some reason
  if(help.checked) myBookmarks.title = "Choose from previously saved loops.";

  if(i==0) return;

  var a=timeStringToSec(myBookmarks.options[i].text.split('--')[0]);
  var b=timeStringToSec(myBookmarks.options[i].text.split('--')[1]);
  $("#slider").slider("option", "values", [ a, b ]);
  isTimeASet=isTimeBSet=true;
  $("#timeInputs").show();
  loopButton.value="Cancel";
  annotButton.disabled=false;
  if(!myVideo.paused)
    loopTimer.push(setInterval(onTimeUpdate,25));
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

var initHeight;
var initResizableVT = function(){
  $("#myResizable").resizable({
    aspectRatio: (aonly.checked ? false : true),
    minWidth: (aonly.checked ? $("#myResizable").width() : 160),
    create: function(e,ui){
      myVideo.width = $("#myResizable").width();
      initHeight = $("#myResizable").height();
      $("#slider").width($("#myResizable").width());
      $("#scrub").width($("#myResizable").width());
    },
    resize: function(event,ui){
      myVideo.width=ui.size.width;
      if(aonly.checked) {
        ui.size.height = initHeight;
      } else {
        myVideo.height=ui.size.height;
      }
      $("#slider").width(ui.size.width);
      $("#scrub").width(ui.size.width);
    }
  });
};

var onLoopDownVT = function () {
  if(isTimeBSet){
    cancelABLoop();
    $("#timeInputs").hide();
    annotButton.disabled=true;
    myBookmarks.options[0].selected=true;
  }else{
    if(isTimeASet){
      if(myGetCurrentTimeVT()!=timeA){
        if(myGetCurrentTimeVT()<timeA){
          timeB=timeA;
          timeA=myGetCurrentTimeVT();
        }else{
          timeB=myGetCurrentTimeVT();
        }
        isTimeBSet=true;
        loopButton.value="Cancel";
        $("#slider").slider("option", "values", [ timeA, timeB ]);
        $("#timeInputs").show();

        if(!myVideo.paused)
          loopTimer.push(setInterval(onTimeUpdate,25));
      }
    }else{
      timeA=myGetCurrentTimeVT();
      isTimeASet=true;
      loopButton.value="B";
    }
  }
}

var toggleAudio = function(t,h) {
  if(myVideo.readyState) playSelectedFile(inputVT.files[0]);
  if(h.checked) {
    if(t.checked)
      aonly.title = "Uncheck to enable video display.";
    else
      aonly.title = "Suppress video display.";
  }
}

//functions with player specific implementation
var onBmkSelect;
var myGetCurrentTime;
var mySetCurrentTime;
var myGetDuration;
var mySetPlaybackRate;
var onLoopDown;

//initialization functions
var initYT = function () { // YT
  onBmkSelect = onBmkSelectYT;
  myGetCurrentTime = myGetCurrentTimeYT;
  mySetCurrentTime = mySetCurrentTimeYT;
  myGetDuration = myGetDurationYT;
  mySetPlaybackRate = mySetPlaybackRateYT;
  onLoopDown = onLoopDownYT;
}

var initVT = function () { // <video> tag
  onBmkSelect = onBmkSelectVT;
  myGetCurrentTime = myGetCurrentTimeVT;
  mySetCurrentTime = mySetCurrentTimeVT;
  myGetDuration = myGetDurationVT;
  mySetPlaybackRate = mySetPlaybackRateVT;
  onLoopDown = onLoopDownVT;
}
