/*
  main.js

  Copyright (C) 2016--2023 Alexander Grahn

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

var appversion=1.01;

var vidId; //current YT video ID or file name + size
var timeA, timeB, delta; // s
var isTimeASet=false;
var isTimeBSet=false;
var loopTimer=[];
var scrubTimer=[];
var knownIDs=[];
var knownMedia=[];
const timePattern='(?:\\d+:[0-5]\\d|[0-5]?\\d):[0-5]\\d(?:\\.\\d{1,3})?';
var URL=window.URL;

try{
  var storage=window.localStorage;
}
catch(e){
  alert("Cookies must be enabled for this page to work.");
}
// triggered when another player instance writes to storage
window.onstorage = () => {
  if(storage.getItem("ab.knownIDs"))
    knownIDs=JSON.parse(storage.getItem("ab.knownIDs"));
  if(storage.getItem("ab.knownMedia"))
    knownMedia=JSON.parse(storage.getItem("ab.knownMedia"));
};

var storageWriteKeyVal=function(k,v){
  try{
    storage.setItem(k,v);
  }
  catch(e){
    // test for storage full and delete old entries
    if(
      e instanceof DOMException && (
        e.code === 22 ||   // everything except Firefox
        e.name === "QuotaExceededError" ||
        e.code === 1014 || // Firefox
        e.name === "NS_ERROR_DOM_QUOTA_REACHED"
      ) && storage && storage.length!==0
    ){
      if(knownIDs.length>knownMedia.length){
        storage.removeItem("ab."+knownIDs.pop());
        storageWriteKeyVal("ab.knownIDs", JSON.stringify(knownIDs));
      }
      else{
        storage.removeItem("ab."+knownMedia.pop());
        storageWriteKeyVal("ab.knownMedia", JSON.stringify(knownMedia));
      }
      storageWriteKeyVal(k,v); //try again
    }
  }
}

//HTML elements
var YTids, inputYT, inputVT, ytPlayer, help, aonly, intro, myTimeA,
  myTimeB, myBookmarks, loopButton, bmkAddButton, loopBackwardsButton,
  loopHalveButton, loopDoubleButton, loopForwardsButton, annotButton,
  trashButton, tapButton;

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
  myBookmarks=document.getElementById("myBookmarks");
  bmkAddButton=document.getElementById("bmkAddButton");
  loopBackwardsButton=document.getElementById("loopBackwardsButton");
  loopHalveButton=document.getElementById("loopHalveButton");
  loopDoubleButton=document.getElementById("loopDoubleButton");
  loopForwardsButton=document.getElementById("loopForwardsButton");
  annotButton=document.getElementById("annotButton");
  trashButton=document.getElementById("trashButton");
  importButton=document.getElementById("importButton");
  exportButton=document.getElementById("exportButton");
  shareButton=document.getElementById("shareButton");
  tapButton=document.getElementById("tapButton");
  quant=document.getElementById("quant");
  inputVT.addEventListener("change", function(e){
    myBlur();
    playSelectedFile(e.target.files[0]);
  });
  inputYT.disabled=searchButtonYT.disabled=true;
  //initialise storage or convert it from previous versions
  if(
    !storage.getItem("ab.version") || Number(storage.getItem("ab.version"))!=appversion
  ){
    let appData=convertData(JSON.parse(JSON.stringify(storage)));
    storage.clear();
    mergeData(appData);
  }
  //get already watched media files and YT IDs
  if(storage.getItem("ab.knownMedia"))
    knownMedia=JSON.parse(storage.getItem("ab.knownMedia"));
  if(storage.getItem("ab.knownIDs")){
    knownIDs=JSON.parse(storage.getItem("ab.knownIDs"));
    let items=knownIDs.length; let idx;// remove erroneous `null' entries
    while(knownIDs.length&&(idx=knownIDs.indexOf(null))>-1) knownIDs.splice(idx,1);
    if(items!=knownIDs.length) storageWriteKeyVal("ab.knownIDs",JSON.stringify(knownIDs));
    for(let i=0; i<knownIDs.length && i<100; i++){
      let z=document.createElement("OPTION");
      z.setAttribute("value", knownIDs[i]);
      YTids.appendChild(z);
    }
  }
  if(knownIDs.length) inputYT.value=knownIDs[0];
  else inputYT.value="https://youtu.be/2kotK9FNEYU";
  $("#scrub").slider({
    min: 0, step: 0.001, range: "min",
    slide: function(e,ui){
      mySetCurrentTime(ui.value);
    },
  })
  $("#scrub").css("height", "6px").hide();
  $("#slider").slider({
    min: 0,
    step: 0.005,
    range: true,
    start: function(e,ui){onSliderStart(e,ui);},
    slide: function(e,ui){onSliderSlide(e,ui);},
    change: function(e,ui){onSliderChange(e,ui);},
  });
  $("#slider").css("height", "1em");
  $("#slider .ui-slider-handle").first().css("margin-left", "-1em").text("A");
  $("#slider .ui-slider-handle").last().css("margin-left", "0em").text("B");
  if(storage.getItem("ab.help")!="unchecked") help.checked=true;
  contextHelp(help);
  if(storage.getItem("ab.aonly")=="checked") aonly.checked=true;
  else {aonly.checked=false; storageWriteKeyVal("ab.aonly", "unchecked");}
  if(help.checked){
    if(aonly.checked) aonly.title=aonlyTitleChecked;
    else aonly.title=aonlyTitleUnChecked;
  }
  if(storage.getItem("ab.intro")!="unchecked") intro.checked=true;
  toggleIntro(intro, help);
  let speedHandle = $("#speed .ui-slider-handle");
  $("#speed").slider({
    min: 0.25, max: 2.0, step: 0.05, value: 1,
    create: function() {speedHandle.text($(this).slider("value"));},
    change: function(e,ui) {speedHandle.text(myGetPlaybackRate());},
    slide: function(e,ui) {speedHandle.text(ui.value);},
    stop: function(e,ui){mySetPlaybackRate(ui.value);},
  });
  bmkAddButton.addEventListener("mouseup", function(e){bmkAdd();});
  playSelectedFile("");
});

//add some hotkeys
window.addEventListener("keydown", function(e){
  e.stopPropagation();
  if(!$("input").is(":focus")) { e.preventDefault(); }
  if (e.which==27
    && !loopButton.disabled
    && !$("input").is(":focus")
  ) onLoopDown();
  else if (e.which==36
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("#speed .ui-slider-handle").is(":focus")
    && !$("input").is(":focus")
    && !$("select").is(":focus")
  ){ try{mySetCurrentTime(0);}catch(err){} }
  else if (e.which==35
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("#speed .ui-slider-handle").is(":focus")
    && !$("input").is(":focus")
    && !$("select").is(":focus")
  ){ try{mySetCurrentTime(myGetDuration());}catch(err){} }
  else if (e.which==37
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("#speed .ui-slider-handle").is(":focus")
    && !$("input").is(":focus")
    && !$("select").is(":focus")
  ){ try{mySetCurrentTime(myGetCurrentTime()-15);}catch(err){} }
  else if (e.which==39
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("#speed .ui-slider-handle").is(":focus")
    && !$("input").is(":focus")
    && !$("select").is(":focus")
  ){ try{mySetCurrentTime(myGetCurrentTime()+15);}catch(err){} }
  else if (e.which==32
    && !$("input").is(":focus")
  ){ try{myPlayPause();}catch(err){} }
  else if (e.which==84 // "t"
    && !tapButton.disabled
    && !$("input").is(":focus")
  ){ onTap(tapButton); }
  else if (e.which==81 // "q"
    && !quant.disabled
    && !$("input").is(":focus")
  ){
    if(quant.checked) quant.checked=false;
    else quant.checked=true;
    toggleQuant(quant, help);
  }
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
          ret=input;
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
// Usage: myConfirm(  <message text>, <callback>(<ret>) );
//   <callback> must accept one arg which gets either "true" or "false"
//   depending on the result of the user interaction
var myConfirm=function(msg, onclose){
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
var secToString=function(t){ // S[.sss] (sss == millseconds)
  let s=Math.floor(t);
  let ms=t-s;
  ms=ms > 0.0 ? ms.toFixed(3).substring(1) : "";
  return s.toString() + ms;
}
var secToTimeString=function(t){ // H:MM:SS.sss or M:SS.sss
  let h=Math.floor(t/3600);
  let m=Math.floor((t-h*3600)/60).toString();
  let s=Math.floor(t%60).toString();
  let ms=(t-Math.floor(t)).toFixed(3).substring(1);
  return (h>0 ? h.toString()+":"+strPadLeft(m,"0",2) : m)
    + ":" + strPadLeft(s,"0",2) + ms;
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

var onSliderStart=function(e,ui){
  delta=Math.round((timeB-timeA)*1000)/1000;
}

var onSliderChange=function(e,ui){
  timeA=ui.values[0];
  timeB=ui.values[1];
  myTimeA.value=secToTimeString(Math.max(timeA,0));
  myTimeB.value=secToTimeString(Math.min(timeB,myGetDuration()));
}

var onSliderSlide=function(e,ui){
  if(e.ctrlKey){
    if(ui.handleIndex==0){
      if(timeB>=myGetDuration()-0.005) {
        e.preventDefault();
        timeA=myGetDuration()-delta;
        timeB=myGetDuration();
      }else{
        timeA=ui.values[0];
        timeB=timeA+delta;
      }
    }else{
      if(timeA<=0.005) {
        e.preventDefault();
        timeA=0;
        timeB=delta;
      }else{
        timeB=ui.values[1];
        timeA=timeB-delta;
      }
    }
  }else{
    timeA=ui.values[0];
    timeB=ui.values[1];
  }
  updateLoopUI();
}

var loopArr=[];
var onTimeUpdate=function(){
  let tMedia=myGetCurrentTime();
  if(tMedia<timeA && !intro.checked || tMedia>=timeB) {
    //quantise loop based on tapped tempo
    let delay=0.0;
    if(tMedia>=timeB && beatsArr.length>1 && quant.checked){
      loopArr.push(Date.now());
      if(loopArr.length>2) {
        loopArr.splice(0,loopArr.length-2);
        let loopMeas=loopArr[1]-loopArr[0];
        delay=loopMeas-Math.round(loopMeas/beat)*beat;
        delay=toNearest5ms(0.0005*delay*myGetPlaybackRate());//relax with 0.5
        timeB-=delay;
      }
    }
    mySetCurrentTime(timeA);
    if(delay) updateLoopUI();
  }
}

const timeRegExp=new RegExp('^\\s*'+timePattern+'\\s*$');
var onInputTime=function(whichInput, sliderIdx){
  let time=whichInput.value.match(timeRegExp);  //validate user input
  if(!time){
    if(sliderIdx==0){
      $("#slider").slider("values", 0, timeA);
    }else{
      $("#slider").slider("values", 1, timeB);
    }
    return;
  }
  let sec=timeStringToSec(time[0]);
  if(sliderIdx==0){
    sec=Math.min(sec,timeB);
    $("#slider").slider("values", 0, sec);
  }else{
    sec=Math.min(sec,myGetDuration()); sec=Math.max(sec,timeA);
    $("#slider").slider("values", 1, sec);
  }
}

var updateLoopUI=function(){
  myTimeA.value=secToTimeString(Math.max(timeA,0));
  myTimeB.value=secToTimeString(Math.min(timeB,myGetDuration()));
  $("#slider").slider("option", "max", myGetDuration());
  $("#slider").slider("option", "values", [ timeA, timeB ]);
}

var compDeltaByBeat=function(d, b){//d in s, b in ms!
  return b/1000.0*Math.round(d*1000/b);
}

var onLoopBackwards=function(){
  let delta=timeB-timeA;
  if(beatNormal) {
    delta=compDeltaByBeat(delta, beatNormal);
  }
  if(timeA-delta<0) return;
  timeA-=delta;
  timeB-=delta;
  updateLoopUI();
}

var onLoopHalve=function(){
  let delta=timeB-timeA;
  if(beatNormal) {
    delta=compDeltaByBeat(delta, beatNormal);
  }
  timeB-=delta/2;
  updateLoopUI();
}

var onLoopDouble=function(){
  let delta=timeB-timeA;
  if(beatNormal) {
    delta=compDeltaByBeat(delta, beatNormal);
  }
  if(timeB+delta>myGetDuration()) return;
  timeB+=delta;
  updateLoopUI();
}

var onLoopForwards=function(){
  let delta=timeB-timeA;
  if(beatNormal) {
    delta=compDeltaByBeat(delta, beatNormal);
  }
  if(timeB+delta>myGetDuration()) return;
  timeA+=delta;
  timeB+=delta;
  updateLoopUI();
}

var bpm;
var bpmNormal;
var beat; //beat length in ms
var beatNormal; //beat length at normal speed in ms
var beatsArr = [];
var onTap=function(ui) {
  beatsArr.push(Date.now());
  if(beatsArr.length>2) {
    let change=(beatsArr.at(-1)-beatsArr.at(-2))/(beatsArr.at(-2)-beatsArr.at(-3));
    if(change>1.25||change<0.75) { beatsArr.splice(0,beatsArr.length-1); }
  }
  if (beatsArr.length>1) {
    beat=(beatsArr.at(-1)-beatsArr[0])/(beatsArr.length-1);
    beatNormal=beat*myGetPlaybackRate();
    bpm=60000.0/beat;
    bpmNormal=60000.0/beatNormal;
    ui.innerHTML=Math.round(bpm).toString();
  }
}

var bmkAdd=function(note=null){
  let bmk={ta: secToString(timeA), tb: secToString(timeB)};
  let bmkArr=[];
  if(storage.getItem("ab."+vidId))
    bmkArr=JSON.parse(storage.getItem("ab."+vidId));
  let idx=bmkArr.findIndex(bm =>
    toNearest5ms(Number(bmk.ta))==toNearest5ms(Number(bm.ta)) &&
    toNearest5ms(Number(bmk.tb))==toNearest5ms(Number(bm.tb))
  );
  if(note && note.trim()) bmk.note=note.trim();
  if(idx>-1 && bmkArr[idx].note && note===null) bmk.note=bmkArr[idx].note;
  idx=insertBmk(bmk, bmkArr);
  if(bmkArr.length) storageWriteKeyVal("ab."+vidId,JSON.stringify(bmkArr));
  myBookmarksUpdate(bmkArr,idx);
}

//insert a bookmark at its correct position (sorted by time)
//into a bookmarks array
var insertBmk=function(sbm, tbmArr){
  let idx=tbmArr.findIndex(tbm =>
    toNearest5ms(Number(sbm.ta))==toNearest5ms(Number(tbm.ta)) &&
    toNearest5ms(Number(sbm.tb))==toNearest5ms(Number(tbm.tb))
  );
  if(idx>-1) { //update existing
    tbmArr.splice(idx, 1, sbm);
    return idx;
  }
  idx=tbmArr.findIndex(tbm =>
    toNearest5ms(Number(sbm.ta))< toNearest5ms(Number(tbm.ta)) ||
    toNearest5ms(Number(sbm.ta))==toNearest5ms(Number(tbm.ta)) &&
    toNearest5ms(Number(sbm.tb))< toNearest5ms(Number(tbm.tb))
  );
  if(idx>-1){ //insert as new
    tbmArr.splice(idx, 0, sbm);
    return idx;
  }
  idx=tbmArr.length; //append as new
  tbmArr.push(sbm);
  return idx;
}

const toNearest5ms = t => Math.round(t*200)/200;

var showNote=function(o){// option ref
  try{$(o).tooltip("open");}catch(e){}
};
var hideNote=function(o){// option ref
  try{$(o).tooltip("close");}catch(e){}
};

var myBookmarksUpdate=function(bmkArr,idx){//selected idx
  while(myBookmarks.options.length>1)
    myBookmarks.remove(myBookmarks.options.length-1);
  bmkArr.forEach((bmk,i) => {
    let c=document.createElement("OPTION");
    c.text=secToTimeString(Number(bmk.ta))+"--"+secToTimeString(Number(bmk.tb));
    c.addEventListener("mouseover", e => e.target.selected=true);
    c.addEventListener("mouseup", e => {
      onBmkSelect(e.target.index);
      e.target.parentNode.size=1;
    });
    c.addEventListener("touchstart", e => {showNote(e.target)});
    c.addEventListener("touchend", e => {hideNote(e.target)});
    c.addEventListener("touchcancel", e => {hideNote(e.target)});
    c.title="";
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
    let a,b;
    [a,b]=myBookmarks.options[idx].text.split("--").map(t => timeStringToSec(t));
    let bmkArr=JSON.parse(storage.getItem("ab."+vidId));
    if(!bmkArr) bmkArr=[];
    let i = bmkArr.findIndex(bmk =>
      toNearest5ms(a)==toNearest5ms(Number(bmk.ta)) &&
      toNearest5ms(b)==toNearest5ms(Number(bmk.tb))
    );
    if(i>-1) {
      bmkArr.splice(i,1);
      if(bmkArr.length>0) storageWriteKeyVal("ab."+vidId,JSON.stringify(bmkArr));
      else storage.removeItem("ab."+vidId);
      myBookmarksUpdate(bmkArr,Math.min(i,bmkArr.length-1));
    }
    else{
      myBookmarksUpdate(bmkArr,Math.min(idx-1,bmkArr.length-1));
    }
  }
}

var onClickTrash=function(idx){
  myBlur();
  if(idx==0){ //all items
    myConfirm(
      "Really delete <b>ALL</b> bookmarked loops?",
      function(res){
        if(res) bmkDelete(0);
      }
    );
  }else{ //selected item
    myConfirm(
      "Delete this loop?",
      function(res){
        if(res) bmkDelete(idx);
      }
    );
  }
}

var onClickAddNote=function(idx){
  myBlur();
  let currentNote=myBookmarks.options[idx].title;
  myPrompt(
    note => bmkAdd(note),
    null, "Enter description:", (currentNote ? null : "<Add note here>"), currentNote
  );
}

var textFile=null;
var onClickExport=function(){
  myBlur();
  let appData={};
  Object.entries(JSON.parse(JSON.stringify(storage))).forEach(([k,v])=>{
    if(k.match(/^ab\./)) appData[k]=v;
  });
  let data = new Blob([JSON.stringify(appData,null,2)], {type: "application/json"});
  if (textFile !== null) URL.revokeObjectURL(textFile);
  textFile = URL.createObjectURL(data);
  let link = document.createElement("a");
  link.href = textFile;
  link.setAttribute("download", "ABLoopPlayer.json");
  link.click();
}

var onClickImport=function(){
  myBlur();
  let input = document.createElement("input");
  input.type = "file";
  input.accept="application/json";
  input.multiple=false;
  input.onchange = e => {
    let file = e.target.files[0];
    let reader = new FileReader();
    reader.onload = e => {
      try{
        mergeData(convertData(JSON.parse(e.target.result)));
        myMessage("Import",
          "Loop data and app settings successfully imported.");
      }catch(err){
        myMessage("Error",
          "<p>Loop data and app settings could not be imported.</p>"+
          err.name+": "+err.message);
      }
    }
    reader.readAsText(file,"UTF-8");
  }
  input.click();
}

var aonlyTitleChecked="Uncheck to enable video display.";
var aonlyTitleUnChecked="Suppress video display.";
var introTitleChecked="Uncheck to always skip media section up to \"A\".";
var introTitleUnChecked="If checked, media section up to \"A\""
              + " is played before starting the loop.";
var quantTitleChecked="Uncheck to stop loop quantisation. Hotkey: [Q]";
var quantTitleUnChecked="Start loop quantisation (auto-adjustment). Hotkey: [Q]\n"
          + "Tempo (BPM) needs to be tapped beforehand.";

var contextHelp=function(t){
  myBlur();
  if(t.checked){
    storageWriteKeyVal("ab.help", "checked");
    t.title="Uncheck to disable context-sensitive help.";
    if(aonly.checked) aonly.title=aonlyTitleChecked;
    else aonly.title=aonlyTitleUnChecked;
    if(intro.checked) intro.title=introTitleChecked;
    else intro.title=introTitleUnChecked;
    if(quant.checked) quant.title=quantTitleChecked;
    else quant.title=quantTitleUnChecked;
    inputYT.title="Paste a valid YouTube URL, video or playlist ID.";
    searchButtonYT.title="Look up matching video on YouTube.";
    inputVT.title="Browse the hard disk for media files (mp4/H.264, webm, ogg, mp3, wav, ...).";
    loopButton.title="Click twice to mark loop range / click to cancel current loop."
                     + " Hotkey: [Esc]";
    myBookmarks.title="Choose from previously saved loops.";
    bmkAddButton.title="Save current loop to the list of bookmarks.";
    loopBackwardsButton.title="Shift loop window backwards by one loop duration.";
    loopHalveButton.title="Halve the loop duration.";
    loopDoubleButton.title="Double the loop duration.";
    loopForwardsButton.title="Shift loop window forwards by one loop duration.";
    myTimeA.title=myTimeB.title="Fine-tune the loop. Input format: [hh:]mm:ss[.sss]";
    annotButton.title="Add a note to the currently selected bookmark.";
    trashButton.title="Delete currently selected / delete all bookmarked loops.";
    $("#speed").attr("title", "Select playback rate.");
    shareButton.title="Share player link with the current YouTube video or playlist, loop settings and playback rate.";
    exportButton.title="Export loop data and player settings to file \"ABLoopPlayer.json\". "
        + "Check your \"Downloads\" folder.";
    importButton.title="Import file \"ABLoopPlayer.json\" with loop data and player settings "
        + "from another computer or browser.";
    $("#slider").attr("title", "Move slider handles to adjust the loop. "
        + "Press [Ctrl] while moving a handle to shift the entire loop window. "
        + "Also, the handle that currently has keyboard focus can be moved with the arrow keys [←] , [→].");
    tapButton.title="Tap tempo. Hotkey: [T]";
  } else {
    storageWriteKeyVal("ab.help", "unchecked");
    t.title="Enable context-sensitive help.";
    $("#speed").attr("title", "");
    $("#slider").attr("title", "");
    aonly.title=
    intro.title=
    inputYT.title=
    searchButtonYT.title=
    inputVT.title=
    loopButton.title=
    myBookmarks.title=
    myTimeA.title=myTimeB.title=
    bmkAddButton.title=
    loopBackwardsButton.title=
    loopHalveButton.title=
    loopDoubleButton.title=
    loopForwardsButton.title=
    quant.title=
    annotButton.title=
    trashButton.title=
    shareButton.title=
    exportButton.title=
    importButton.title=
    tapButton.title=
    "";
  }
}

var cancelABLoop=function(){
  while(loopTimer.length) clearInterval(loopTimer.pop());
  isTimeASet=isTimeBSet=false;
  loopButton.innerHTML="A";
  quant.disabled=true;
  quant.checked=false;
  toggleQuant(quant, help);
}

var resetUI=function(){
  vidId=undefined;
  $("#timeInputs").hide();
  cancelABLoop();
  while(scrubTimer.length) clearInterval(scrubTimer.pop());
  $("#scrub").slider("option", "value", 0).hide();
  loopButton.disabled=true;
  $("#speed").slider("option", "disabled", true);
  $("#speed").slider("option", "step", 0.05);
  shareButton.disabled=true;
  myBookmarksUpdate([],-1);
  beatsArr.length=0;
  loopArr.length=0;
  tapButton.innerHTML="tap";
  tapButton.disabled=true;
  bpm=bpmNormal=beat=beatNormal=0;
  quant.disabled=true;
  quant.checked=false;
  toggleQuant(quant, help);
}

var onRateChange=function(e){
  let r=myGetPlaybackRate();
  $("#speed").slider("value",r);
  $("#speed .ui-slider-handle").text(r);
  loopArr.length=0;
  if (beatsArr.length>1) {
    bpm=bpmNormal*r;
    beat=beatNormal/r;
    tapButton.innerHTML=Math.round(bpm).toString();
  }
}

var myBlur=function(){document.activeElement.blur();}

//loop & app data conversion to current format
const timeRangePattern=timePattern+'--'+timePattern;
const timeRangeRegExp=new RegExp('^'+timeRangePattern+'(?:,'+timeRangePattern+')*$');
var convertData=function(data){
  let storageFormat=Number(data["ab.version"]);
  if(storageFormat==appversion) return data;
  if(storageFormat==1.0){
    //fix list of known media files
    let mediaids=[];
    Object.entries(data).forEach(([k,v])=>{
      let id=k.match(/^ab\.(.+\.[a-zA-Z0-9]{3,4}-\d{3,})$/);
      if(id&&id[1]) mediaids.push(id[1]);
    });
    delete data["ab.knownMedia"];
    if(mediaids.length) data["ab.knownMedia"]=JSON.stringify(mediaids);
    data["ab.version"]=appversion;
    return data;
  }
  //YouTube data
  let ytubeids=[];
  if(data.knownIDs){
    ytubeids=data.knownIDs.split(',');
    delete data.knownIDs;
  }
  else{
    Object.entries(data).forEach(([k,v])=>{
      let id=k.match(/^[0-9a-zA-Z_-]{11}$/);
      if(id&&id[0]) ytubeids.push(id[0]);
    });
  }
  //media files >= 100 Bytes
  let mediaids=[];
  delete data.knownMedia;
  Object.entries(data).forEach(([k,v])=>{
    let id=k.match(/^.+\.[a-zA-Z0-9]{3,4}-\d{3,}$/);
    if(id&&id[0]) mediaids.push(id[0]);
  });
  //now, process both lists
  let knownIDs, knownMedia;
  [knownIDs, knownMedia] = [ytubeids, mediaids].map(ids => {
    let known=[];
    if(ids.length){
      ids.forEach(id => {
        let bmks=data[id];
        delete data[id];
        if(
          bmks && typeof(bmks)==='string' &&
          bmks.match(timeRangeRegExp)
        ){
          if(known.indexOf(id)<0) known.push(id);
          let bmkArr=[];
          bmks.split(",").forEach(bmk => {
            let sbm={};
            [sbm.ta,sbm.tb]=bmk.split("--").map(t => timeStringToSec(t));
            let note=data[id+"-"+bmk];
            delete data[id+"-"+bmk];
            if(note && typeof(note)==='string') sbm.note=note;
            insertBmk(sbm, bmkArr);
          });
          data["ab."+id]=JSON.stringify(bmkArr);
        }
      });
    }
    return known;
  });
  if(knownIDs.length); data["ab.knownIDs"]=JSON.stringify(knownIDs);
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
  let ytSrcIds=[], mmSrcIds=[];
  if(data["ab.knownIDs"]){
    let tmp=JSON.parse(data["ab.knownIDs"]);
    if(Array.isArray(tmp)){
      let idx;// remove erroneous `null' entries
      while((idx=tmp.indexOf(null))>-1) tmp.splice(idx,1);
      tmp.forEach(id=>{
        let iid=id.match(/^[0-9a-zA-Z_-]{11,}$/); //videos/playlists
        if(iid&&iid[0]) ytSrcIds.push(iid[0]);
      });
    }
  }
  if(data["ab.knownMedia"]){
    let tmp=JSON.parse(data["ab.knownMedia"]);
    if(Array.isArray(tmp)){
      tmp.forEach(id=>{
        let iid=id.match(/^.+\.[a-zA-Z0-9]{3,4}-\d{3,}$/);
        if(iid&&iid[0]) mmSrcIds.push(iid[0]);
      });
    }
  }
  [[ytSrcIds, knownIDs], [mmSrcIds, knownMedia]].forEach(([src,trg]) => {
    src.reverse().forEach(id => {
      if(trg.indexOf(id)==-1) trg.unshift(id);
      if(data["ab."+id]) {
        let trgBmks=[];
        if(storage.getItem("ab."+id))
          trgBmks=JSON.parse(storage.getItem("ab."+id));
        let srcBmks=JSON.parse(data["ab."+id]);
        if(Array.isArray(srcBmks)){
          srcBmks.forEach(sbm=>{
            if(
              sbm.ta && !isNaN(Number(sbm.ta)) && Number(sbm.ta)>0 &&
              sbm.tb && !isNaN(Number(sbm.tb)) && Number(sbm.tb)>0 &&
              Number(sbm.ta)<=Number(sbm.tb) && (!sbm.note || typeof(sbm.note)==='string')
            ) insertBmk(sbm, trgBmks);
          });
        }
        if(trgBmks.length) storageWriteKeyVal("ab."+id,JSON.stringify(trgBmks));
      }
    });
  });
  if(knownIDs.length) storageWriteKeyVal("ab.knownIDs",JSON.stringify(knownIDs));
  else storage.removeItem("ab.knownIDs");
  if(knownMedia.length) storageWriteKeyVal("ab.knownMedia",JSON.stringify(knownMedia));
  else storage.removeItem("ab.knownMedia");
  if(data["ab.help"]){
    storageWriteKeyVal("ab.help", data["ab.help"]);
    if(data["ab.help"]=="checked") help.checked=true; else help.checked=false;
    contextHelp(help);
  }
  if(data["ab.aonly"]){
    storageWriteKeyVal("ab.aonly", data["ab.aonly"]);
    if(data["ab.aonly"]=="checked") aonly.checked=true; else aonly.checked=false;
  }
  if(data["ab.intro"]){
    storageWriteKeyVal("ab.intro", data["ab.intro"]);
    if(data["ab.intro"]=="checked") intro.checked=true; else intro.checked=false;
    toggleIntro(intro, help);
  }
  if(data["ab.version"]) storageWriteKeyVal("ab.version", data["ab.version"]);
}

///////////////////////////
// YT player specific code
///////////////////////////

//function for loading YT player
//arg 1: video id,
//arg 2: playlist (comma-separated v ids),
//arg 3: list id,
//arg 4: loop start, arg 4: loop end time
//arg 5: playback speed
var loadYT=function(vid,plist,lid,ta,tb,r){
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
      playlist: plist,
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
          onPlayerStateChange(
            e,
            e.target.getPlaylist()[e.target.getPlaylistIndex()].toString(),
            ta,tb,r
          );
        } else {
          onPlayerStateChange(e,vid,ta,tb,r);
        }
      },
      "onError": function(e){
        console.log("Error: " + e.data);
        resetUI();
        loadYT(null,null,null,null,null,null);
      }
    }
  });
  ytPlayer.addEventListener("onPlaybackRateChange", onRateChange);
  myBlur();
}

var onYouTubeIframeAPIReady=function(){
  inputYT.disabled=searchButtonYT.disabled=false;
  queryYT(document.location.search);
}

var onPlayerStateChange=function(e, id, ta, tb, s){ //event object, video id
  //the video has changed                        //loop start & end time, rate
  if(id!=vidId && e.data==YT.PlayerState.PLAYING){
    $("#scrub").slider("option", "max", myGetDuration()).show();
    scrubTimer.push(setInterval(
      function(e){
        $("#scrub").slider("option", "value", myGetCurrentTimeYT());
      } , 05
    ));
    loopButton.disabled=false;
    $("#timeInputs").hide();
    cancelABLoop();
    let rates=e.target.getAvailablePlaybackRates();
    let min=rates[0];
    let max=rates[rates.length-1];
    $("#speed").slider("option", "disabled", true);
    $("#speed").slider("option", "min", min);
    $("#speed").slider("option", "max", max);
    $("#speed").slider("option", "step", 0.05);
    $("#speed").slider("option", "value", s);
    mySetPlaybackRate(s); //custom rate via url parameter
    $("#speed").slider("option", "disabled", false);
    tapButton.disabled=false;
    shareButton.disabled=false;
    //populate bookmark list with saved items for the current video ID
    let bmkArr=JSON.parse(storage.getItem("ab."+id));
    myBookmarksUpdate((bmkArr ? bmkArr : []),-1);
    annotButton.disabled=true;
    saveId(id);
    //set ab loop from ta, tb args only upon new player instantiation
    if((ta||tb)&&!vidId){
      $("#slider").slider("option", "max", myGetDuration());
      let a=0,b=myGetDuration();
      if(ta!=null&&tb!=null){
        a=Math.max(0,Math.min(ta,tb));
        b=Math.min(b,Math.max(ta,tb));
      }
      else if(ta!=null){
        a=Math.max(0,Math.min(ta,b));
      }
      else{
        b=Math.min(b,Math.max(0,tb));
      }
      mySetCurrentTime(a);
      $("#slider").slider("option", "values", [a, b]);
      isTimeASet=isTimeBSet=true;
      $("#timeInputs").show();
      loopButton.innerHTML="Cancel";
      if(beatsArr.length>1) quant.disabled=false;
    }
    vidId=id;
  }
  while(loopTimer.length) clearInterval(loopTimer.pop());
  if (isTimeASet && isTimeBSet && e.data==YT.PlayerState.PLAYING)
    loopTimer.push(setInterval(onTimeUpdate,05));
}

var saveId=function(id){
  if(!id) return; //prevent erroneous `null' entry
  //prepend ID to/move ID to front of the list of valid and already
  //visited video/playlist IDs and of the datalist object
  //at first, remove all occurrences
  let idx;
  while(knownIDs.length&&(idx=knownIDs.indexOf(id))>-1) knownIDs.splice(idx,1);
  for(let i=0;i<YTids.childNodes.length;i++){
    if(YTids.childNodes[i].getAttribute("value")==id)
      YTids.removeChild(YTids.childNodes[i]);
  }
  //now add to the head
  knownIDs.unshift(id);
  let z=document.createElement("OPTION");
  z.setAttribute("value", id);
  YTids.insertBefore(z, YTids.firstChild);
  //truncate input list to 100 elements
  while(YTids.childNodes.length>100)
    YTids.removeChild(YTids.lastChild);
  storageWriteKeyVal("ab.knownIDs",JSON.stringify(knownIDs));
}

var queryYT=function(qu){
  let vid, plist, lid;
  // share-link url: video id and/or playlist (comma-separated video ids)
  vid=qu.match(/(?<=[?&]videoid=)[0-9a-zA-Z_-]{11}/);
  plist=qu.match(/(?<=[?&]playlist=)[0-9a-zA-Z_-]{11}(?:,[0-9a-zA-Z_-]{11})*/);
  // regular YT url with video id and/or list id
  if(!(vid||plist)){
    vid=qu.match(/(?<=youtu\.be\/|\/embed\/|\/v\/|[?&]v=)[0-9a-zA-Z_-]{11}/);
    lid=qu.match(/(?<=[?&]list=)[0-9a-zA-Z_-]{12,}/);
  }
  // plain video id or list id
  if(!(vid||plist||lid)){
    vid=qu.trim().match(/^[0-9a-zA-Z_-]{11}$/);
    lid=qu.trim().match(/^[0-9a-zA-Z_-]{12,}$/);
  }
  if(!(vid||plist||lid)) return;
  let ta=qu.match(/(?<=[?&](?:star)?t=)[0-9]+(?:\.[0-9]*)?/);
  let tb=qu.match(/(?<=[?&]end=)[0-9]+(?:\.[0-9]*)?/);
  let rate=qu.match(/(?<=[?&]rate=)[0-9]+(?:\.[0-9]*)?/);
  if(rate) rate=Math.min(Math.max(rate[0],0.25),2.0);
  else rate=1;
  loadYT(
    vid ? vid[0] : null,
    plist ? plist[0] : null,
    lid ? lid[0] : null,
    ta ? ta[0] : null, tb ? tb[0] : null, rate
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
    create: function(e,ui){
      $("#slider").width($("#myResizable" ).width());
      $("#scrub").width($("#myResizable" ).width());
    },
    start: function(e,ui){
      $(ytDiv).hide();
    },
    stop: function(e,ui){
      ytPlayer.setSize(ui.size.width,ui.size.height);
      $(ytDiv).show();
    },
    resize: function(e,ui){
      $("#slider").width(ui.size.width);
      $("#scrub").width(ui.size.width);
    }
  });
}

var onBmkSelectYT=function(i){
  myBlur();
  cancelABLoop();
  if(i==0) return;
  $("#slider").slider("option", "max", myGetDuration());
  let a,b;
  [a,b]=myBookmarks.options[i].text.split("--").map(t => timeStringToSec(t));
  $("#slider").slider("option", "values", [a, b]);
  isTimeASet=isTimeBSet=true;
  $("#timeInputs").show();
  loopButton.innerHTML="Cancel";
  if(beatsArr.length>1) quant.disabled=false;
  annotButton.disabled=false;
  if(ytPlayer.getPlayerState()==YT.PlayerState.PLAYING)
    loopTimer.push(setInterval(onTimeUpdate,05));
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
        loopButton.innerHTML="Cancel";
        updateLoopUI();
        $("#timeInputs").show();
        if(beatsArr.length>1) quant.disabled=false;
        if(ytPlayer.getPlayerState()==YT.PlayerState.PLAYING)
          loopTimer.push(setInterval(onTimeUpdate,05));
      }
    }else{
      timeA=myGetCurrentTimeYT();
      isTimeASet=true;
      loopButton.innerHTML="B";
    }
  }
}

var onClickShare=function(){
  myBlur();
  let sharelink=document.URL;
  let idx=sharelink.indexOf("?");
  if(idx>-1) sharelink=sharelink.substring(0,idx);
  let playlist=ytPlayer.getPlaylist();
  if(playlist){
    sharelink+="?videoid="+playlist[ytPlayer.getPlaylistIndex()];
    sharelink+="&playlist="+playlist.join();
  }
  else{
    sharelink+="?videoid="+vidId;
  }
  if(isTimeASet) sharelink+="&start="+secToString(timeA);
  if(isTimeBSet) sharelink+="&end="+secToString(timeB);
  let rate=myGetPlaybackRate();
  if(rate!=1.0) sharelink+="&rate="+rate;
  myMessage("Share Link", sharelink);
}

/////////////////////////
// <video> specific code
/////////////////////////
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
      $("#speed").slider("option", "min", 0.25);
      $("#speed").slider("option", "max", 2);
      $("#speed").slider("option", "value", 1);
      $("#speed").slider("option", "step", 0.01);
      $("#speed").slider("option", "disabled", false);
      tapButton.disabled=false;
      loopArr.length=0;
    }else{
      //repeat setting media source until duration property is properly set;
      //this is a workaround of a bug in FFox on Windows
      e.target.src=e.target.currentSrc;
    }
  });
  myVideo.addEventListener("loadeddata", onLoadedData);
  myVideo.addEventListener("play", function(){
    loopArr.length=0;
    mySetPlaybackRate(Number($("#speed").slider("value")));
    if (isTimeASet && isTimeBSet) loopTimer.push(setInterval(onTimeUpdate,05));
  });
  myVideo.addEventListener("pause", function(){
    loopArr.length=0; // reset quantisation
    while(loopTimer.length) clearInterval(loopTimer.pop());
  });
  myVideo.addEventListener("error", function(e){
    console.log("Error: " + e.target);
    resetUI();
  });
  myVideo.addEventListener("ratechange", onRateChange);
  myResizable.appendChild(myVideo);
  if(f){ //a media file was selected
    $("#speed").slider("option", "disabled", true);
    tapButton.disabled=true;
    //set video source
    vidId=f.name+"-"+f.size; //some checksum would be better
    try {
      //Modern browsers should support File object as value for HTMLMediaElement.srcObject, see
      //https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/srcObject#value,
      //but currently, only Safari does.
      myVideo.srcObject = f;
    }catch(e){
      myVideo.src = URL.createObjectURL(f);
    }
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
    }, 0.025
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
  let idx;
  while(knownMedia.length&&(idx=knownMedia.indexOf(id))>-1) knownMedia.splice(idx,1);
  //now add to the head
  knownMedia.unshift(id);
  storageWriteKeyVal("ab.knownMedia",JSON.stringify(knownMedia));
}

var myGetPlaybackRateVT=function(){
  return myVideo.playbackRate;
}

var mySetPlaybackRateVT=function(r){
  myVideo.playbackRate=r;
}

var onBmkSelectVT=function(i){
  myBlur();
  cancelABLoop();
  if(i==0) return;
  let a,b;
  [a,b]=myBookmarks.options[i].text.split("--").map(t => timeStringToSec(t));
  $("#slider").slider("option", "values", [a, b]);
  isTimeASet=isTimeBSet=true;
  $("#timeInputs").show();
  loopButton.innerHTML="Cancel";
  if(beatsArr.length>1) quant.disabled=false;
  annotButton.disabled=false;
  if(!myVideo.paused)
    loopTimer.push(setInterval(onTimeUpdate,05));
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
    resize: function(e,ui){
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
        loopButton.innerHTML="Cancel";
        updateLoopUI();
        $("#timeInputs").show();
        if(beatsArr.length>1) quant.disabled=false;
        if(!myVideo.paused)
          loopTimer.push(setInterval(onTimeUpdate,05));
      }
    }else{
      timeA=myGetCurrentTimeVT();
      isTimeASet=true;
      loopButton.innerHTML="B";
    }
  }
}

var toggleAudio=function(t,h){
  myBlur();
  playSelectedFile(inputVT.files[0]);
  if(h.checked){
    if(t.checked) t.title=aonlyTitleChecked;
    else t.title=aonlyTitleUnChecked;
  }
  if(t.checked) storageWriteKeyVal("ab.aonly", "checked");
  else storageWriteKeyVal("ab.aonly", "unchecked");
}

var toggleIntro=function(t,h){
  myBlur();
  if(t.checked){
    storageWriteKeyVal("ab.intro", "checked");
    if(h.checked) t.title=introTitleChecked;
  }else{
    storageWriteKeyVal("ab.intro", "unchecked");
    if(h.checked) t.title=introTitleUnChecked;
  }
}

var toggleQuant=function(t,h){
  myBlur();
  if(t.checked){
    if(h.checked) t.title=quantTitleChecked;
  }else{
    if(h.checked) t.title=quantTitleUnChecked;
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
