/*
  main.js

  Copyright (C) 2016--2021 Alexander Grahn

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

var appversion="1.0";

var storage=window.localStorage;
var vidId; //current YT video ID or file name + size
var timeA, timeB;
var isTimeASet=false;
var isTimeBSet=false;
var currentRate=1.0;
var loopTimer=[];
var scrubTimer=[];
var ctrlPressed=false;

//HTML elements
var YTids;
var inputYT, inputVT;
var ytPlayer;
var help, aonly, intro;
var myTimeA, myTimeB, mySpeed, myBookmarks;
var loopButton, bmkAddButton, annotButton, trashButton;

$(document).ready(function(){
  $("#introText").width($("#test").width()+1);
  //if we are online, asynchronously load YT player api
  if(navigator.onLine){
    let scripts=document.getElementsByTagName("script");
    let scriptTag1=scripts[scripts.length-1];
    let scriptTag2=document.createElement("script");
    scriptTag2.src="https://www.youtube.com/iframe_api";
    scriptTag1.parentNode.insertBefore(scriptTag2, null);
  }
  inputYT=document.getElementById("inputYT");
  YTids=document.getElementById("YTids");
  help=document.getElementById("help");
  searchButtonYT=document.getElementById("searchButtonYT");
  inputVT=document.getElementById("inputVT");
  aonly=document.getElementById("aonly");
  intro=document.getElementById("intro");
  myTimeA=document.getElementById("myTimeA");
  myTimeB=document.getElementById("myTimeB");
  loopButton=document.getElementById("loopButton");
  mySpeed=document.getElementById("mySpeed");
  myBookmarks=document.getElementById("myBookmarks");
  bmkAddButton=document.getElementById("bmkAddButton");
  annotButton=document.getElementById("annotButton");
  trashButton=document.getElementById("trashButton");
  inputVT.addEventListener("change", function(e){
    myBlur();
    playSelectedFile(e.target.files[0]);
  });
  inputYT.disabled=searchButtonYT.disabled=true;
  //convert saved bookmarks from previous version
  if(storage.getItem("knownIDs")){
    let appData=convertData(JSON.parse(JSON.stringify(storage)));
    storage.clear();
    mergeData(appData);
  }
  mergeData({"ab.version": appversion});
  //get already watched YT IDs
  let knownIds=[];
  if(storage.getItem("ab.knownIDs")){
    knownIds=JSON.parse(storage.getItem("ab.knownIDs"));
    for(let i=0; i<knownIds.length && i<100; i++){
      let z=document.createElement("OPTION");
      z.setAttribute("value", knownIds[i]);
      YTids.appendChild(z);
    }
  }
  if(knownIds.length) inputYT.value=knownIds[0];
  else inputYT.value="https://youtu.be/2kotK9FNEYU";
  $("#scrub").slider({
    min: 0, step: 0.001, range: "min",
    slide: function(e, ui){
      mySetCurrentTime(ui.value);
    },
  })
  $("#scrub").css("height", "6px").hide();
  $("#slider").slider({
    min: 0,
    step: 0.020,
    range: true,
    change: function(e, ui){onSliderChange(e, ui);},
    slide: function(e, ui){onSliderSlide(e, ui);},
  });
  $("#slider").css("height", "1em");
  $("#slider .ui-slider-handle").first().css("margin-left", "-1em").text("A");
  $("#slider .ui-slider-handle").last().css("margin-left", "0em").text("B");
  if(storage.getItem("ab.help")!="unchecked") help.checked=true;
  contextHelp(help);
  if(storage.getItem("ab.aonly")=="checked") aonly.checked=true;
  else aonly.checked=false;
  if(help.checked){
    if(aonly.checked) aonly.title=aonlyTitleChecked;
    else aonly.title=aonlyTitleUnChecked;
  }
  if(storage.getItem("ab.intro")!="unchecked") intro.checked=true;
  toggleIntro(intro, help);
  mySpeed.addEventListener("change", onSpeedSelectChange);
  bmkAddButton.addEventListener("mouseup", function(e){bmkAdd();});
  playSelectedFile("");
});

//add some hotkeys
window.addEventListener("keydown", function(e){
  if (e.which==17) ctrlPressed=true;
  else if (e.which==27
    && !loopButton.disabled
    && !$("input").is(":focus")
  ) onLoopDown();
  else if (e.which==36
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("input").is(":focus")
    && !$("select").is(":focus")
  ){ try{mySetCurrentTime(0);}catch(err){} }
  else if (e.which==35
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("input").is(":focus")
    && !$("select").is(":focus")
  ){ try{mySetCurrentTime(myGetDuration());}catch(err){} }
  else if (e.which==37
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("input").is(":focus")
    && !$("select").is(":focus")
  ){ try{mySetCurrentTime(myGetCurrentTime()-15);}catch(err){} }
  else if (e.which==39
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("input").is(":focus")
    && !$("select").is(":focus")
  ){ try{mySetCurrentTime(myGetCurrentTime()+15);}catch(err){} }
  else if (e.which==32
    && !$("input").is(":focus")
  ){ try{myPlayPause();}catch(err){} }
});

window.addEventListener("keyup", function(e){
  if (e.which==17) ctrlPressed=false;
});

// a modal prompt dialog based on jQuery
// Usage: myPrompt( <callback>(ret), <title>, <text> [, <default input>] );
var myPrompt=function(onclose, title, text, placeholder, input){
  let z=$(
    '<div style="width: fit-content; display: inline-block;"><p>'
    +text+
    '</p><input '+
    (placeholder ? ' placeholder="'+placeholder+'"' : "") +
    (input ? ' value="'+input+'"' : "") +
    '" size="50" onfocus="this.select();"></input></div>'
  );
  $(document.body).append(z);
  let ret=null;
  $(z).dialog({
    autoOpen: true,
    modal: true,
    classes: {"ui-dialog": (title ? "" : "noTitlebar")},
    title: title,
    closeOnEscape: false,
    closeText: "hide",
    width: "auto",
    minHeight: 0,
    buttons: [
      {
        text: "Cancel",
        click: function(){
          $(this).dialog( "close" );
        }
      },
      {
        text: "Ok",
        click: function(){
          ret=$(this).find("input").prop("value");
          $(this).dialog( "close" );
        }
      },
    ],
    close: function(e,ui){
      onclose(ret);
      this.parentNode.removeChild(this);
    }
  }).focus();
}

// a modal confirm dialog
// Usage: myConfirm( <callback>(<ret>), <message text> );
//   <callback> must accept one arg, which gets either "true" or "false",
//   depending on the result of the user interaction
var myConfirm=function(onclose, msg){
  let z=$("<div>"+msg+"</div>");
  $(document.body).append(z);
  let ret=false;
  $(z).dialog({
    autoOpen: true,
    modal: true,
    classes: {"ui-dialog": "noTitlebar"},
    closeOnEscape: false,
    minHeight: 0,
    width: "auto",
    buttons: [
      {
        text: "Cancel",
        click: function(){
          $(this).dialog( "close" );
        }
      },
      {
        text: "Ok",
        click: function(){
          ret=true;
          $(this).dialog( "close" );
        }
      },
    ],
    close: function(e,ui){
      onclose(ret);
      this.parentNode.removeChild(this);
    }
  })
}

// a modal message box
// Usage: myMessage( <title>, <message text> );
var myMessage=function(title, msg){
  let z=$("<div>"+msg+"</div>");
  $(document.body).append(z);
  $(z).dialog({
    title: title,
    autoOpen: true,
    modal: true,
    buttons: {
      Ok: function() {
        $( this ).dialog( "close" );
      }
    },
    close: function(e,ui){
      this.parentNode.removeChild(this);
    }
  })
}

//pretty printing the media time
var secToTimeString=function(t){
  let h=Math.floor(t/3600);
  let s=t % 3600;
  let m=Math.floor(s/60);
  s=s % 60;
  let ms=String(s % 1).substring(2,5);
  s=Math.floor(s);
  return ((h>0 ? h+":"+strPadLeft(m,0,2) : m) + ":" + strPadLeft(s,0,2)
      + (ms.length>0 ? "."+ms :''));
}
var strPadLeft=function strPadLeft(string,pad,length){
  return (new Array(length+1).join(pad)+string).slice(-length);
}

// time string to seconds
var timeStringToSec=function(ts){
  let ta=ts.trim().split(":");
  let s=Number(ta[ta.length-1]);
  s+=60*Number(ta[ta.length-2]);
  if(ta.length==3) s+=3600*Number(ta[0]);
  return s;
}

var onSliderChange=function(event, ui){
  timeA=ui.values[0];
  timeB=ui.values[1];
  myTimeA.value=secToTimeString(timeA);
  myTimeB.value=secToTimeString(timeB);
}

var onTimeUpdate=function(){
  if(myGetCurrentTime()<timeA && !intro.checked || myGetCurrentTime()>=timeB)
    mySetCurrentTime(timeA);
}

var onSliderSlide=function(e, ui){
  if(ctrlPressed){
    let delta=timeB-timeA;
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

var onInputTime=function(whichInput, sliderIdx){
  let time=whichInput.value.match(  //validate user input
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
  let sec=timeStringToSec(time[0]);
  if(sliderIdx==0){
    sec=Math.min(sec,timeB);
    $("#slider" ).slider("values", 0, sec);
  }else{
    sec=Math.min(sec,myGetDuration()); sec=Math.max(sec,timeA);
    $("#slider" ).slider("values", 1, sec);
  }
}

var bmkAdd=function(note=null){
  let bmk={ta: timeA, tb: timeB};
  if(note) bmk.note=note;
  let bmkArr=[];
  if(storage.getItem("ab."+vidId))
    bmkArr=JSON.parse(storage.getItem("ab."+vidId));
  let idx=insertBmk(bmk, bmkArr);
  if(bmkArr.length) storage.setItem("ab."+vidId,JSON.stringify(bmkArr));
  myBookmarksUpdate(bmkArr,idx);
}

//insert a bookmark at its correct position into a bookmarks array
var insertBmk=function(sbm, tbmArr){
  let idx=tbmArr.findIndex(tbm => (sbm.ta==tbm.ta && sbm.tb==tbm.tb));
  if(idx>-1) { //update existing
    tbmArr.splice(idx, 1, sbm);
    return idx;
  }
  idx=tbmArr.findIndex(tbm =>
    (sbm.ta<tbm.ta || sbm.ta==tbm.ta && sbm.tb<tbm.tb));
  if(idx>-1){ //insert as new
    tbmArr.splice(idx, 0, sbm);
    return idx;
  }
  idx=tbmArr.length; //append as new
  tbmArr.push(sbm);
  return idx;
}

var myBookmarksUpdate=function(bmkArr,idx){//selected idx
  while(myBookmarks.options.length>1)
    myBookmarks.remove(myBookmarks.options.length-1);
  bmkArr.forEach((bmk,i) => {
    let c=document.createElement("OPTION");
    c.text=secToTimeString(bmk.ta)+"--"+secToTimeString(bmk.tb);
    c.addEventListener("mouseover", e => e.target.selected=true);
    c.addEventListener("mouseup", e => {
      onBmkSelect(e.target.index);
      e.target.parentNode.size=1;
    });
    if(bmk.note){
      c.title=bmk.note;
      //enable tooltip for current <option> element
      $(c).tooltip({
        position: {
          my: "left bottom",
          at: "right+5px bottom",
          collision: "none"
        }
      });
    }
    myBookmarks.appendChild(c);
    if(i==idx){
      c.selected=true;
      onBmkSelect(c.index);
    }
  });
  if(idx<0) myBookmarks.options[0].selected=true;
  if(myBookmarks.options.length>1) $("#myBmkSpan").show();
  else $("#myBmkSpan").hide();
}

var bmkDelete=function(idx){
  if(idx==0){
    storage.removeItem("ab."+vidId);
    myBookmarksUpdate([],-1);
  }
  else{
    let bmkArr=JSON.parse(storage.getItem("ab."+vidId));
    if(!bmkArr) bmkArr=[];
    let i = bmkArr.findIndex(bmk => (timeA==bmk.ta && timeB==bmk.tb));
    if(i>-1) {
      bmkArr.splice(i,1);
      if(bmkArr.length>0) storage.setItem("ab."+vidId,JSON.stringify(bmkArr));
      else storage.removeItem("ab."+vidId);
      myBookmarksUpdate(bmkArr,Math.min(i,bmkArr.length-1));
    }
    else{
      myBookmarksUpdate(bmkArr,Math.min(idx-1,bmkArr.length-1));
    }
  }
}

var onClickTrash=function(idx){
  if(idx==0){ //all items
    myConfirm(
      function(res){
        if(res) bmkDelete(0);
      },
      "Really delete <b>ALL</b> bookmarked loops?"
    );
  }else{ //selected item
    myConfirm(
      function(res){
        if(res) bmkDelete(idx);
      },
      "Delete this loop?"
    );
  }
}

var onClickAddNote=function(idx){
  let currentNote=myBookmarks.options[idx].title;
  myPrompt(
    note => bmkAdd(note),
    null, "Enter description", (currentNote ? null : "example text"), currentNote
  );
}

var onClickExport=function(){
  let appData=JSON.parse(JSON.stringify(storage));
  navigator.clipboard.writeText(JSON.stringify(appData)).then(function() {
    myMessage("Export",
      "<p>Loop data and player settings successfully copied to the <b>clipboard</b>.</p><p>"+
      "<span style='content:url(png/import.png);float:left;margin:0px 10px 30px 0px'></span>"+
      "Use the Player's <b>Import</b> dialog on another computer or in a different browser to transfer loop data and app settings.</p>"
    );
  }, function(err) {
    myMessage("Error",
      "<p>Loop data and app settings could not be copied to the clipboard.</p>"+
      err.name+": "+err.message);
  });
}

var onClickImport=function(){
  myPrompt(
    function(data){
      if(data==null||data.trim()=="") return;
      try{
        mergeData(convertData(JSON.parse(data)));
        myMessage("Import",
          "Loop data and app settings successfully imported.");
      }catch(err){
        myMessage("Error",
          "<p>Loop data and app settings could not be imported.</p>"+
          err.name+": "+err.message);
      }
    },
    "Import", "Paste exported loop data and app settings in the text field:",
    "<Paste here>", null
  );
}

var aonlyTitleChecked="Uncheck to enable video display.";
var aonlyTitleUnChecked="Suppress video display.";

var contextHelp=function(t){
  myBlur();
  if(t.checked){
    storage.setItem("ab.help", "checked");
    t.title="Uncheck to disable context-sensitive help.";
    if(aonly.checked) aonly.title=aonlyTitleChecked;
    else aonly.title=aonlyTitleUnChecked;
    if(intro.checked)
      intro.title="Uncheck to always skip media section up to \"A\".";
    else
      intro.title="If checked, media section up to \"A\""
              + " is played before starting the loop.";
    inputYT.title="Paste a valid YouTube URL, video or playlist ID.";
    searchButtonYT.title="Look up matching video on YouTube.";
    inputVT.title="Browse the hard disk for media files (mp4/H.264, webm, ogg, mp3, wav, ...).";
    loopButton.title="Click twice to mark loop range / click to cancel current loop."
                     + " Hotkey: [Esc]";
    myBookmarks.title="Choose from previously saved loops.";
    bmkAddButton.title="Save current loop range to the list of bookmarks.";
    myTimeA.title=myTimeB.title="Fine-tune loop range. Input format: [hh:]mm:ss[.sss]";
    annotButton.title="Add a note to the currently selected bookmark.";
    trashButton.title="Delete currently selected / delete all bookmarked loops.";
    mySpeed.title="Select playback rate.";
    exportButton.title="Export loop data and player settings.";
    importButton.title="Import loop data and player settings from another computer or browser.";
    $("#slider").attr("title", "Move slider handles to adjust the loop range. "
        + "Press [Ctrl] while moving a handle to shift the entire loop window. "
        + "Also, handles can be moved with the arrow keys [←] , [→].");
  } else {
    storage.setItem("ab.help", "unchecked");
    t.title="Enable context-sensitive help.";
    aonly.title=
    intro.title=
    inputYT.title=
    searchButtonYT.title=
    inputVT.title=
    loopButton.title=
    myBookmarks.title=
    myTimeA.title=myTimeB.title=
    bmkAddButton.title=
    annotButton.title=
    trashButton.title=
    mySpeed.title=
    exportButton.title=
    importButton.title=
    "";
    $("#slider").attr("title", "");
  }
}

var cancelABLoop=function(){
  while(loopTimer.length) clearInterval(loopTimer.pop());
  isTimeASet=isTimeBSet=false;
  loopButton.value="A";
}

var resetUI=function(){
  vidId=undefined;
  $("#timeInputs").hide();
  cancelABLoop();
  while(scrubTimer.length) clearInterval(scrubTimer.pop());
  $("#scrub").slider("option", "value", 0).hide();
  loopButton.disabled=true;
  currentRate=1;
  while(mySpeed.options.length) mySpeed.remove(mySpeed.options.length-1);
  mySpeed.disabled=true;
  myBookmarksUpdate([],-1);
}

var onSpeedSelectChange=function(e){
  e.target.blur();
  let newRate=Number(e.target.value);
  if(newRate==currentRate) return;
  //temporarily reset <select> to old value
  //new value set by onRateChange only on success
  for(let i=0; i<e.target.length; i++){
    if(Number(e.target.options[i].value)==currentRate){
      e.target.options[i].selected=true;
      break;
    }
  }
  mySetPlaybackRate(newRate);
}

var onRateChange=function(e){
  myBlur();
  let newRate=myGetPlaybackRate();
  for(let i=0; i<mySpeed.length; i++){
    if(Number(mySpeed.options[i].value)==newRate){
      mySpeed.options[i].selected=true;
      currentRate=newRate;
      break;
    } else if (i+1<mySpeed.length && newRate < mySpeed.options[i+1].value){
      let c=document.createElement("OPTION");
      mySpeed.add(c,i+1); //append as a child to selector
      c.text=c.value=currentRate=newRate;
      c.selected=true;
      break;
    }
  }
  if(newRate!=currentRate) mySetPlaybackRate(currentRate);
}

var myBlur=function(){
  document.activeElement.focus();
  while(document.activeElement.tagName!="BODY"){
    document.activeElement.blur();
  }
}

//loop & app data conversion to new format "1.0"
var convertData=function(data){
  let storageFormat=data["ab.version"];
  if(storageFormat==="1.0") return data;
  //YouTube data
  let ytubeids=[];
  if(data.knownIDs){
    ytubeids=data.knownIDs.split(',');
    delete data.knownIDs;
  }
  else{
    Object.entries(data).forEach(([k,v])=>{
      let id=k.match(/^[0-9a-zA-Z_-]{11}$/);
      if(id) ytubeids.push(id[0]);
    });
  }
  //media files >= 100 Bytes
  let mediaids=[];
  delete data.knownMedia;
  Object.entries(data).forEach(([k,v])=>{
    let id=k.match(/^.+\.[a-zA-Z0-9]{3,4}-\d{3,}$/);
    if(id) mediaids.push(id[0]);
  });
  //now, process both lists
  let knownIds, knownMedia;
  [knownIds, knownMedia] = [ytubeids, mediaids].map(ids => {
    let known=[];
    if(ids.length){
      ids.forEach(id => {
        known.push(id);
        let bmks=data[id];
        delete data[id];
        if(bmks && bmks.match(/--/)){
          let bmkArr=[];
          bmks=bmks.split(",");
          bmks.forEach(bmk => {
            let ta,tb;
            [ta,tb]=bmk.split("--").map(t => timeStringToSec(t));
            let note=data[id+"-"+bmk];
            delete data[id+"-"+bmk];
            let idx=bmkArr.findIndex(
              bm => ta<bm.ta || ta==bm.ta && tb<bm.tb
            )
            if(idx<0) idx=bmkArr.length; //append bookmark
            bmkArr.splice(idx, 0, {ta: ta, tb: tb});
            if(note) bmkArr[idx].note=note;
          });
          data["ab."+id]=JSON.stringify(bmkArr);
        }
      });
    }
    return known;
  });
  if(knownIds.length); data["ab.knownIDs"]=JSON.stringify(knownIds);
  if(knownMedia.length); data["ab.knownMedia"]=JSON.stringify(knownMedia);
  if(data.help)  data["ab.help"] =data.help;
  if(data.aonly) data["ab.aonly"]=data.aonly;
  if(data.intro) data["ab.intro"]=data.intro;
  delete data.help;
  delete data.aonly;
  delete data.intro;
  data["ab.version"]=appversion;
  return data;
}

//merge converted/imported data into localStorage
var mergeData=function(data){
  let ytSrcIds=[], mmSrcIds=[], knownIds=[], knownMedia=[];
  if(data["ab.knownIDs"]) ytSrcIds=JSON.parse(data["ab.knownIDs"]);
  if(data["ab.knownMedia"]) mmSrcIds=JSON.parse(data["ab.knownMedia"]);
  if(storage.getItem("ab.knownIDs"))
    knownIds=JSON.parse(storage.getItem("ab.knownIDs"));
  if(storage.getItem("ab.knownMedia"))
    knownMedia=JSON.parse(storage.getItem("ab.knownMedia"));
  [[ytSrcIds, knownIds], [mmSrcIds, knownMedia]].forEach(([src,trg]) => {
    src.forEach(id => {
      if(trg.indexOf(id)==-1) trg.push(id);
      let srcBmks=[], trgBmks=[];
      if(data["ab."+id]) srcBmks=JSON.parse(data["ab."+id]);
      if(storage.getItem("ab."+id))
        trgBmks=JSON.parse(storage.getItem("ab."+id));
      srcBmks.forEach(sbm => insertBmk(sbm, trgBmks));
      if(trgBmks.length) storage.setItem("ab."+id,JSON.stringify(trgBmks));
    });
  });
  if(knownIds.length) storage.setItem("ab.knownIDs",JSON.stringify(knownIds));
  else storage.removeItem("ab.knownIDs");
  if(knownMedia.length) storage.setItem("ab.knownMedia",JSON.stringify(knownMedia));
  else storage.removeItem("ab.knownMedia");
  if(data["ab.help"]) storage.setItem("ab.help", data["ab.help"]);
  if(data["ab.aonly"]) storage.setItem("ab.aonly", data["ab.aonly"]);
  if(data["ab.intro"]) storage.setItem("ab.intro", data["ab.intro"]);
  if(data["ab.version"]) storage.setItem("ab.version", data["ab.version"]);
}

///////////////////////////
// YT player specific code
///////////////////////////

//function for loading YT player
//arg 1: video id, arg 2:  list id
var loadYT=function(vid,lid){
  initYT(); //initialize player-specific functions
  resetUI();
  //remove previous player, if there is one
  try{ytPlayer.destroy();}catch(e){}
  //replace #myResizable container
  let myResizable=document.getElementById("myResizable");
  let parent=myResizable.parentNode;
  let myResizableOld=myResizable;
  myResizable=document.createElement("div");
  myResizable.id="myResizable";
  myResizable.style.backgroundColor="#ddd";
  parent.replaceChild(myResizable, myResizableOld);
  let playerWidth=$("#myResizable").width();
  $("#myResizable").height(playerWidth*9/16);
  initResizableYT();
  //create and append <div> as a container for YT iframe
  let ytDiv=document.createElement("div");
  ytDiv.id="ytDiv";
  myResizable.appendChild(ytDiv);
  //create new YT player iframe, replacing ytDiv
  ytPlayer=new YT.Player("ytDiv", {
    videoId: vid,
    width: playerWidth,
    height: $("#myResizable").height(),
    playerVars: {
      listType: "playlist",
      list: lid,
      autoplay: (vid ? 1 : 0),
      fs: 0,  //no fullscreen button
      modestbranding: 1,
      rel: 0, //no related videos at the end
    },
    events: {
      "onReady": function(e){if(e.target.getPlaylist()){saveId(lid);}},
      "onStateChange": function(e){
        if(e.target.getPlaylist()){
          onPlayerStateChange(e,
            e.target.getPlaylist()[e.target.getPlaylistIndex()].toString());
        } else {
          onPlayerStateChange(e,vid);
        }
      },
      "onError": function(e){
        console.log("Error: " + e.data);
        resetUI();
        loadYT(null,null);
      }
    }
  });
  ytPlayer.addEventListener("onPlaybackRateChange", onRateChange);
  myBlur();
}

var onYouTubeIframeAPIReady=function(){
  inputYT.disabled=searchButtonYT.disabled=false;
}

var onPlayerStateChange=function(e, id){ //event object, video id
  //the video has changed
  if(id!=vidId && e.data==YT.PlayerState.PLAYING){
    $("#scrub").slider("option", "max", myGetDuration()).show();
    scrubTimer.push(setInterval(
      function(e){
        $("#scrub").slider("option", "value", myGetCurrentTimeYT());
      } , 20
    ));
    loopButton.disabled=false;
    vidId=id;
    $("#timeInputs").hide();
    cancelABLoop();
    //clear list of playback rates
    while(mySpeed.options.length) mySpeed.remove(mySpeed.options.length-1);
    mySpeed.disabled=true;
    //determine available playback rates and populate the #mySpeed element
    let rates=e.target.getAvailablePlaybackRates();
    rates.forEach(r => {
      let c=document.createElement("OPTION");
      mySpeed.add(c); //append as a child to selector
      c.text=c.value=r;
      if(r==1.0){
        c.text="Normal";
        c.selected=true;
        mySetPlaybackRate(1);
      }
    });
    mySpeed.disabled=false;
    //populate bookmark list with saved items for the current video ID
    let bmkArr=JSON.parse(storage.getItem("ab."+vidId));
    myBookmarksUpdate((bmkArr ? bmkArr : []),-1);
    annotButton.disabled=true;
    saveId(id);
  }
  while(loopTimer.length) clearInterval(loopTimer.pop());
  if (isTimeASet && isTimeBSet && e.data==YT.PlayerState.PLAYING)
    loopTimer.push(setInterval(onTimeUpdate,20));
}

var saveId=function(id){
  //prepend ID to/move ID to front of the list of valid and already
  //visited video/playlist IDs and of the datalist object
  //at first, remove all occurrences
  let knownIds=[];
  if(storage.getItem("ab.knownIDs")){
    knownIds=JSON.parse(storage.getItem("ab.knownIDs"));
    let idx=knownIds.indexOf(id);
    while(idx>=0){
      knownIds.splice(idx,1);
      idx=knownIds.indexOf(id);
    }
  }
  for(let i=0;i<YTids.childNodes.length;i++){
    if(YTids.childNodes[i].getAttribute("value")==id)
      YTids.removeChild(YTids.childNodes[i]);
  }
  //now add to the head
  knownIds.unshift(id);
  let z=document.createElement("OPTION");
  z.setAttribute("value", id);
  YTids.insertBefore(z, YTids.firstChild);
  //truncate input list to 100 elements
  while(YTids.childNodes.length>100)
    YTids.removeChild(YTids.lastChild);
  storage.setItem("ab.knownIDs",JSON.stringify(knownIds));
}

var queryYT=function(qu){
  let vid=qu.match(/(?<=youtu\.be\/|\/embed\/|\/v\/|[?&]v=)[0-9a-zA-Z_-]{11}/);
  let lid=qu.match(/(?<=[?&]list=)[0-9a-zA-Z_-]{12,}/);
  if(!(vid||lid)){
    vid=qu.trim().match(/^[0-9a-zA-Z_-]{11}$/);
    lid=qu.trim().match(/^[0-9a-zA-Z_-]{12,}$/);
  }
  if(!(vid||lid)) return;
  loadYT(
    vid ? vid[0] : null , lid ? lid[0] : null
  );
}

var mySetPlaybackRateYT=function(r){
  ytPlayer.setPlaybackRate(r);
}

var myGetPlaybackRateYT=function(){
  return ytPlayer.getPlaybackRate();
}

var myGetDurationYT=function(){
  return ytPlayer.getDuration();
}

var myGetCurrentTimeYT=function(){
  return ytPlayer.getCurrentTime();
}

var mySetCurrentTimeYT=function(t){
  ytPlayer.seekTo(t,true);
}

var initResizableYT=function(){
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

var onBmkSelectYT=function(i){
  cancelABLoop();
  //needs to be reset for some reason
  if(help.checked) myBookmarks.title="Choose from previously saved loops.";
  if(i==0) return;
  $("#slider").slider("option", "max", myGetDuration());
  let a,b;
  [a,b]=myBookmarks.options[i].text.split("--").map(t => timeStringToSec(t));
  $("#slider").slider("option", "values", [a, b]);
  isTimeASet=isTimeBSet=true;
  $("#timeInputs").show();
  loopButton.value="Cancel";
  annotButton.disabled=false;
  if(ytPlayer.getPlayerState()==YT.PlayerState.PLAYING)
    loopTimer.push(setInterval(onTimeUpdate,20));
}

var onLoopDownYT=function(){
  if(isTimeBSet){
    $("#timeInputs").hide();
    annotButton.disabled=true;
    myBookmarks.options[0].selected=true;
    cancelABLoop();
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
        $("#slider").slider("option", "max", myGetDuration());
        $("#slider").slider("option", "values", [ timeA, timeB ]);
        $("#timeInputs").show();
        if(ytPlayer.getPlayerState()==YT.PlayerState.PLAYING)
          loopTimer.push(setInterval(onTimeUpdate,20));
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
var URL=window.URL || window.webkitURL;
var myVideo;

var playSelectedFile=function(f){
  initVT(); //initialize player-specific functions
  resetUI();
  //replace #myResizable container and its #myVideo child
  let myResizable=document.getElementById("myResizable");
  let parent=myResizable.parentNode;
  let myResizableOld=myResizable;
  myResizable=document.createElement("div");
  myResizable.id="myResizable";
  parent.replaceChild(myResizable, myResizableOld);
  if(aonly.checked)
    myVideo=document.createElement("audio");
  else
    myVideo=document.createElement("video");
  myVideo.id="myVideo";
  myVideo.autoplay=false;
  myVideo.controls=true;
  myVideo.width=$("#myResizable").width();
  myVideo.addEventListener("durationchange", function(e){
    if (isFinite(e.target.duration)){
      $("#slider").slider("option", "max", myGetDuration());
      $("#scrub").slider("option", "max", myGetDuration()).show();
      aonly.disabled=false;
      mySpeed.disabled=false;
    }else{
      //repeat setting media source until duration property is properly set;
      //this is a workaround of a bug in FFox on Windows
      e.target.src=e.target.currentSrc;
    }
  });
  myVideo.addEventListener("loadeddata", onLoadedData);
  myVideo.addEventListener("play", function(){
    mySetPlaybackRate(Number(mySpeed.value));
    if (isTimeASet && isTimeBSet) loopTimer.push(setInterval(onTimeUpdate,20));
  });
  myVideo.addEventListener("pause", function(){
    while(loopTimer.length) clearInterval(loopTimer.pop());
  });
  myVideo.addEventListener("error", function(e){
    console.log("Error: " + e.target);
    resetUI();
  });
  myVideo.addEventListener("ratechange", onRateChange);
  myResizable.appendChild(myVideo);
  if(f){ //a media file was selected
    //add speed options
    mySpeed.disabled=true;
    [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0].forEach(r => {
      let c=document.createElement("OPTION");
      mySpeed.add(c); //append as a child to selector
      c.text=c.value=r;
      if(r==1.0){
        c.id="normalSpeed";
        c.text="Normal";
        c.selected=true;
      }
    });
    aonly.disabled=true;
    //set video source
    vidId=f.name+"-"+f.size; //some checksum would be better
    myVideo.src=URL.createObjectURL(f);
  }
}

var onLoadedData=function(e){
  if(!aonly.checked){
    e.target.addEventListener("mouseover", function(e){e.target.controls=true;});
    e.target.addEventListener("mouseout", function(e){e.target.controls=false;});
  }
  loopButton.disabled=false;
  scrubTimer.push(setInterval(
    function(){
      $("#scrub").slider("option", "value", myGetCurrentTimeVT());
    }, 0.020
  ));
  initResizableVT();
  //look for bookmark items with the current video ID
  let bmkArr=JSON.parse(storage.getItem("ab."+vidId));
  myBookmarksUpdate((bmkArr ? bmkArr : []),-1);
  annotButton.disabled=true;
  saveMediaId(vidId);
}

var saveMediaId=function(id){
  //prepend ID to/move ID to front of the visited media files list
  //at first, remove all occurrences
  let knownIds=[];
  if(storage.getItem("ab.knownMedia")){
    knownIds=JSON.parse(storage.getItem("ab.knownMedia"));
    let idx=knownIds.indexOf(id);
    while(idx>=0){
      knownIds.splice(idx,1);
      idx=knownIds.indexOf(id);
    }
  }
  //now add to the head
  knownIds.unshift(id);
  storage.setItem("ab.knownMedia",JSON.stringify(knownIds));
}

var myGetPlaybackRateVT=function(){
  return myVideo.playbackRate;
}

var mySetPlaybackRateVT=function(r){
  myVideo.playbackRate=r;
}

var onBmkSelectVT=function(i){
  cancelABLoop();
  //needs to be reset for some reason
  if(help.checked) myBookmarks.title="Choose from previously saved loops.";
  if(i==0) return;
  let a,b;
  [a,b]=myBookmarks.options[i].text.split("--").map(t => timeStringToSec(t));
  $("#slider").slider("option", "values", [a, b]);
  isTimeASet=isTimeBSet=true;
  $("#timeInputs").show();
  loopButton.value="Cancel";
  annotButton.disabled=false;
  if(!myVideo.paused)
    loopTimer.push(setInterval(onTimeUpdate,20));
}

var myGetDurationVT=function(){
  return myVideo.duration;
}

var myGetCurrentTimeVT=function(){
  return myVideo.currentTime;
}

var mySetCurrentTimeVT=function(t){
  myVideo.currentTime=t;
}

var initHeight;
var initResizableVT=function(){
  $("#myResizable").resizable({
    aspectRatio: (aonly.checked ? false : true),
    minWidth: (aonly.checked ? $("#myResizable").width() : 160),
    create: function(e,ui){
      myVideo.width=$("#myResizable").width();
      initHeight=$("#myResizable").height();
      $("#slider").width($("#myResizable").width());
      $("#scrub").width($("#myResizable").width());
    },
    resize: function(event,ui){
      myVideo.width=ui.size.width;
      if(aonly.checked){
        ui.size.height=initHeight;
      } else {
        myVideo.height=ui.size.height;
      }
      $("#slider").width(ui.size.width);
      $("#scrub").width(ui.size.width);
    }
  });
};

var onLoopDownVT=function(){
  if(isTimeBSet){
    $("#timeInputs").hide();
    annotButton.disabled=true;
    myBookmarks.options[0].selected=true;
    cancelABLoop();
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
        $("#slider").slider("option", "max", myGetDuration());
        $("#slider").slider("option", "values", [ timeA, timeB ]);
        $("#timeInputs").show();
        if(!myVideo.paused)
          loopTimer.push(setInterval(onTimeUpdate,20));
      }
    }else{
      timeA=myGetCurrentTimeVT();
      isTimeASet=true;
      loopButton.value="B";
    }
  }
}

var toggleAudio=function(t,h){
  myBlur();
  if(myVideo.readyState) playSelectedFile(inputVT.files[0]);
  if(h.checked){
    if(t.checked) t.title=aonlyTitleChecked;
    else t.title=aonlyTitleUnChecked;
  }
  if(t.checked) storage.setItem("ab.aonly", "checked");
  else storage.setItem("ab.aonly", "unchecked");
}

var toggleIntro=function(t,h){
  myBlur();
  if(t.checked){
    storage.setItem("ab.intro", "checked");
    if(h.checked)
        t.title="Uncheck to always skip media section up to \"A\".";
  }else{
    storage.setItem("ab.intro", "unchecked");
    if(h.checked)
        t.title="If checked, media section up to \"A\""
                + " is played before starting the loop.";
  }
}

//functions with player specific implementation
var onBmkSelect;
var myGetCurrentTime;
var mySetCurrentTime;
var myGetDuration;
var mySetPlaybackRate;
var onLoopDown;
var myPlayPause;

//initialization functions
var initYT=function(){ // YT
  onBmkSelect=onBmkSelectYT;
  myGetCurrentTime=myGetCurrentTimeYT;
  mySetCurrentTime=mySetCurrentTimeYT;
  myGetDuration=myGetDurationYT;
  mySetPlaybackRate=mySetPlaybackRateYT;
  myGetPlaybackRate=myGetPlaybackRateYT;
  onLoopDown=onLoopDownYT;
  myPlayPause=function(){
    if(ytPlayer.getPlayerState()==YT.PlayerState.PLAYING)
      ytPlayer.pauseVideo();
    else
      ytPlayer.playVideo();
  }
}

var initVT=function(){ // <video> tag
  onBmkSelect=onBmkSelectVT;
  myGetCurrentTime=myGetCurrentTimeVT;
  mySetCurrentTime=mySetCurrentTimeVT;
  myGetDuration=myGetDurationVT;
  mySetPlaybackRate=mySetPlaybackRateVT;
  myGetPlaybackRate=myGetPlaybackRateVT;
  onLoopDown=onLoopDownVT;
  myPlayPause=function(){
    if(myVideo.paused) myVideo.play(); else myVideo.pause();
  }
}
