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

var appversion=1.02;

var vidId; //current YT video ID or file name + size
var lstId; //current YT playlist ID
var searchStr; //url parameters
var timeA, timeB, dtAB; // s
var isTimeASet=false;
var isTimeBSet=false;
var scrubTimer=[];
var knownIDs=[];
var knownMedia=[];
const timePattern='(?:\\d+:[0-5]\\d|[0-5]?\\d):[0-5]\\d(?:\\.\\d{1,3})?';
var URL=window.URL;

var touchStartHandled=false, touchEndHandled=false;

var crossmark='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" version="1.1">'
  +'<path stroke="red" stroke-width="2" stroke-linecap="butt" d="M1 1L9 9M1 9L9 1"/></svg>';
var crossMarkUrl="url('data:image/svg+xml;base64,"+window.btoa(crossmark)+"')";

try{
  var storage=window.localStorage;
}
catch(e){
  alert("Cookies must be enabled for this page to work.");
}

//function returning ref to bookmarks array and beat length
//for given id, if present in local storage or in optional array argument
var queryBmksAndBn = function(id, where=null) {
  let entry;
  if(id && where) {
    if(JSON.parse(where["ab."+id])) entry=JSON.parse(where["ab."+id]);
  }
  else if(id && JSON.parse(storage.getItem("ab."+id))) {
    entry=JSON.parse(storage.getItem("ab."+id));
  }
  if(id && entry){
    return [
      (Array.isArray(entry.bmks) && entry.bmks.length ? entry.bmks : null),
      (!isNaN(Number(entry.bn)) && Number(entry.bn)>0 ? Number(entry.bn) : null)
    ];
  }
  return [null,null];
}

// triggered when another player instance writes to storage
window.onstorage = () => {
  if(storage.getItem("ab.knownIDs"))
    knownIDs=JSON.parse(storage.getItem("ab.knownIDs"));
  if(storage.getItem("ab.knownMedia"))
    knownMedia=JSON.parse(storage.getItem("ab.knownMedia"));
  let bmks, bn;
  [bmks, bn]=queryBmksAndBn(vidId);
  if(bmks) bookmarksUpdate(bmks,-1);
  if(bn){
    beatNormal=bn;
    tapButton.innerHTML=Math.round(60/beatNormal*rate).toString();
  }
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
var YTids, introTextBr, inputYT, inputVT, ytPlayer, help, searchButtonYT,
  aonly, intro, myTimeA, myTimeB, myBmkSpanInner, myBookmarks, loopButton, bmkAddButton,
  loopBackwardsButton, loopHalveButton, loopDoubleButton, loopForwardsButton,
  annotButton, trashButton, tapButton, importButton, exportButton, shareButton,
  quant, handleA, handleB;

var tooltipOpts={position:{
  my: "left bottom",
  at: "right+5px bottom",
  collision: "none"
}};

var tooltipOptsBmk={
  position: {
    my: "left bottom",
    at: "right+5px bottom",
    collision: "none"
  },
  classes: {"ui-tooltip": "ui-tooltip-bmk ui-corner-all ui-widget-shadow"}
};

var myBmkSpanInnerTitleBak;

$(document).ready(function(){
  $("#introText").width($("#widthA").width()+1);
  //if we are online, asynchronously load YT player api
  if(navigator.onLine){
    let scripts=document.getElementsByTagName("script");
    let scriptTag1=scripts[scripts.length-1];
    let scriptTag2=document.createElement("script");
    scriptTag2.src="https://www.youtube.com/iframe_api";
    scriptTag1.parentNode.insertBefore(scriptTag2, null);
  }
  introTextBr=document.getElementById("introTextBr");
  inputYT=document.getElementById("inputYT");
  YTids=document.getElementById("YTids");
  help=document.getElementById("help");
  searchButtonYT=document.getElementById("searchButtonYT");
  searchButtonYT.focus();
  inputVT=document.getElementById("inputVT");
  aonly=document.getElementById("aonly");
  intro=document.getElementById("intro");
  myTimeA=document.getElementById("myTimeA");
  myTimeB=document.getElementById("myTimeB");
  loopButton=document.getElementById("loopButton");
  myBmkSpanInner=document.getElementById("myBmkSpanInner");
  myBookmarks=document.getElementById("myBookmarks");
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
  bmkAddButton=document.getElementById("bmkAddButton");
  inputVT.addEventListener("change", function(e){
    blur();
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
  inputYT.value=knownIDs.length ? knownIDs[0] : "https://youtu.be/2kotK9FNEYU";
  $("#scrub").slider({
    min: 0, step: 0.001, range: "min",
    slide: function(e,ui){
      loopMeas.splice(0);
      setCurrentTime(ui.value);
    },
  })
  $("#slider").slider({
    min: 0,
    step: 0.005,
    range: true,
    start: function(e,ui){onSliderStart(e,ui);},
    slide: function(e,ui){onSliderSlide(e,ui);},
    change: function(e,ui){onSliderChange(e,ui);},
  });
  $("#slider .ui-slider-handle").first().html(
    '<span id="handleA" class="abhandle" style="margin-left: -16px;">'+'A'+'</span>'
  ).on("focus",()=>{handleA.style.backgroundColor="#fcc";})
   .on("blur",()=>{handleA.style.background="none";});
  $("#slider .ui-slider-handle").last().html(
    '<span id="handleB" class="abhandle" style="margin-right: -16px;">'+'B'+'</span>'
  ).on("focus",()=>{handleB.style.backgroundColor="#fcc";})
   .on("blur",()=>{handleB.style.background="none";});
  handleA=document.getElementById("handleA");
  handleB=document.getElementById("handleB");
  if(storage.getItem("ab.help")!="unchecked") help.checked=true;
  contextHelp(help);
  if(storage.getItem("ab.aonly")=="checked") aonly.checked=true;
  else {aonly.checked=false; storageWriteKeyVal("ab.aonly", "unchecked");}
  if(help.checked){
    aonly.title=aonly.checked ? aonlyTitleChecked : aonlyTitleUnChecked;
  }
  if(storage.getItem("ab.intro")!="unchecked") intro.checked=true;
  toggleIntro(intro, help);
  let speedHandle = $("#speed .ui-slider-handle");
  speedHandle.on("dblclick", function() {setPlaybackRate(1.0);});
  $("#speed").slider({
    min: 0.25, max: 2.0, step: 0.05, value: 1,
    create: function() {speedHandle.text($(this).slider("value"));},
    change: function(e,ui) {speedHandle.text(getPlaybackRate());},
    slide: function(e,ui) {speedHandle.text(ui.value);},
    stop: function(e,ui){setPlaybackRate(ui.value);},
  });
  bmkAddButton.addEventListener("mouseup", function(e){bmkAdd();});
  $("#myBookmarks").selectmenu({
    width: null, //allow sizing via css
    position: { my: "left top", at: "left bottom", collision: "flip" },
    change: function(e,ui) {
      myBmkSpanInner.title=myBmkSpanInnerTitleBak;
      if($("#myBmkSpanInner").tooltip("instance")) $("#myBmkSpanInner").tooltip("destroy");
      onBmkSelect(ui.item.index);
    },
    close: ()=>{blur();}
  }).selectmenu("menuWidget")
    .addClass("bookmarklist")
    .tooltip(tooltipOptsBmk);
  $("#myBookmarks-button").on("mouseenter",
    function(){
      myBmkSpanInner.title=myBmkSpanInnerTitleBak;
      if($("#myBmkSpanInner").tooltip("instance")) $("#myBmkSpanInner").tooltip("destroy");
      let bmk=document.getElementById("bmk"+$("#myBookmarks").prop("selectedIndex"));
      if(bmk && bmk.title) {
         myBmkSpanInner.title=bmk.title;
         $("#myBmkSpanInner").tooltip(tooltipOpts).tooltip("open");
      }
    }
  );
  $("#mainDiv").show();
  playSelectedFile("");
});

//reset rewind latency measurement when tab visibility has changed (from and to
//background, minimising or maximising window, lock screen [de]activation)
document.addEventListener("visibilitychange", () => {loopMeas.splice(0);});

//add some hotkeys
window.addEventListener("keydown", function(e){
  e.stopPropagation();
  if($("input").is(":focus")) return;
  else e.preventDefault();
  if (e.which==27 || e.which==76 //"Esc" or "L"
    && !loopButton.disabled
  ) onLoopDown();
  else if (e.which==36
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("#speed .ui-slider-handle").is(":focus")
    && !$("select").is(":focus")
  ){try{
    setCurrentTime(0);
    loopMeas.splice(0);
  }catch(err){}}
  else if (e.which==35
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("#speed .ui-slider-handle").is(":focus")
    && !$("select").is(":focus")
  ){try{
    if(isPlaying() && isTimeBSet){
      pauseVideo();
      setCurrentTime(timeA);
      doAfterSeek(playVideo, timeA);
    }
    else{
      setCurrentTime(getDuration());
      loopMeas.splice(0);
    }
  }catch(err){}}
  else if (e.which==37
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("#speed .ui-slider-handle").is(":focus")
    && !$("select").is(":focus")
  ){try{
    setCurrentTime(getCurrentTime()-5);
    loopMeas.splice(0);
  }catch(err){}}
  else if (e.which==39
    && !$("#slider .ui-slider-handle").is(":focus")
    && !$("#speed .ui-slider-handle").is(":focus")
    && !$("select").is(":focus")
  ){try{
    let t=getCurrentTime()+5;
    if(isPlaying() && isTimeBSet && t>=timeB){
      pauseVideo();
      setCurrentTime(timeA);
      doAfterSeek(playVideo, timeA);
    }
    else{
      setCurrentTime(t);
      loopMeas.splice(0);
    }
  }catch(err){}}
  else if (e.which==32) {try{playPause();}catch(err){}}
  else if (e.which==84 && !tapButton.disabled) onTap(tapButton); // "t"
  else if (e.which==81 && !quant.disabled) { // "q"
    quant.checked = !quant.checked;
    toggleQuant(quant, help);
  }
  else if (e.which==65 && isTimeASet && isTimeBSet) onJumpToA(); //"a"
});

window.addEventListener("keyup", function(e){
  e.stopPropagation();
  if($("input").is(":focus")) return;
  else e.preventDefault();
  if (e.which==65 && isTimeASet && isTimeBSet) playVideo(); //"a"
});

// a modal prompt dialog based on jQuery
// Usage: promptDialog( <callback>(ret), <title>, <text> [, <default input>] );
var promptDialog=function(onclose, title, text, placeholder, input){
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
    classes: {"ui-dialog": title ? "" : "noTitlebar"},
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
// Usage: confirmDialog(  <message text>, <callback>(<ret>) );
//   <callback> must accept one arg which gets either "true" or "false"
//   depending on the result of the user interaction
var confirmDialog=function(msg, onclose){
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
// Usage: messageBox( <title>, <message text> );
var messageBox=function(title, msg){
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
  dtAB=toNearest5ms(timeB-timeA);
}

var onSliderChange=function(e,ui){
  if(ui.handleIndex==0){
    timeA=Math.min(ui.values[0],ui.values[1]-0.005);
  }
  else{
    timeB=Math.max(ui.values[1],ui.values[0]+0.005);
  }
  loopMeas.splice(0);
  updateLoopUI(false);
}

var onSliderSlide=function(e,ui){
  e.preventDefault();
  if(e.ctrlKey){
    if(ui.handleIndex==0){
      timeA=Math.min(getDuration()-dtAB,ui.values[0]);
      timeB=timeA+dtAB;
    }else{
      timeB=Math.max(dtAB,ui.values[1]);
      timeA=timeB-dtAB;
    }
  }
  else{
    if(ui.handleIndex==0){
      timeA=Math.min(ui.values[0],ui.values[1]-0.005);
    }
    else{
      timeB=Math.max(ui.values[1],ui.values[0]+0.005);
    }
    dtAB=timeB-timeA;
  }
  loopMeas.splice(0);
  updateLoopUI();
}

var onLoopDown=function(){
  if(isTimeBSet){
    $("#timeInputs").hide();
    annotButton.disabled=true;
    //$("#myBookmarks").val("").selectmenu("refresh");
    $("#myBookmarks").prop("selectedIndex",0).selectmenu("refresh");
    cancelABLoop();
  }else{
    let cur=toNearest5ms(Math.min(getCurrentTime(),getDuration()));
    if(isTimeASet){
      if(cur!=timeA){
        if(cur<timeA){
          timeB=timeA;
          timeA=cur;
        }else{
          timeB=cur;
        }
        isTimeBSet=true;
        loopButton.innerHTML="&emsp;";
        loopButton.style.backgroundImage=crossMarkUrl;
        updateLoopUI();
        quant.disabled=beatNormal ? false : true;
        $("#timeInputs").show();
      }
    }else{
      timeA=cur;
      isTimeASet=true;
      loopButton.innerHTML="B";
      loopButton.style.backgroundImage="none";
    }
  }
}

var loopMeas=[];
var tLavg=0;
var tLcount=0;
var winSize=7; //window size for sliding average of rewind latency

var onScrubTimerUpdate=function(){
  let tMedia=getCurrentTime();
  $("#scrub").slider("option", "value", tMedia);//update the scrubbar
  if(!isTimeASet||!isTimeBSet) return;
  //loop control and latency measurement
  if(tMedia<timeA) loopMeas.splice(0);
  if(tMedia<timeA && !intro.checked || tMedia>=timeB){
    let curTime=performance.now()/1000; //[s]
    let dtw=(timeB-timeA)/rate; //loop interval in walltime seceonds
    if(
      document.visibilityState=="visible" && tMedia>=timeB && dtw>0.2
      && (!loopMeas.length || curTime-loopMeas.at(-1)>=dtw)
    ){
      loopMeas.push(curTime);
      if(loopMeas.length>1){
        loopMeas.splice(0,loopMeas.length-2);
        //media rewind latency
        let tL=(loopMeas[1]-loopMeas[0])*rate + timeA-timeB;
        tLavg=(tLavg*tLcount + tL)/++tLcount; // sliding avg
        if(tLcount>winSize) tLcount=winSize;
        //console.log(tLavg, tL);
        //quantise loop based on tapped tempo and latency
        if(quant.checked) {
          let n=Math.max(2,Math.round((loopMeas[1]-loopMeas[0])*rate/beatNormal));//no less than two beats
          let tBOld=timeB;
          timeB=toNearest5ms(timeA+n*beatNormal-tLavg);
          if(timeB-tBOld!=0) updateLoopUI();
        }
      }
    }
    setCurrentTime(timeA);
  }
  //don't allow tapping while looping
  if(tMedia>=timeA && !tapButton.disabled) tapButton.disabled=true;
  else if(tMedia<timeA && tapButton.disabled) tapButton.disabled=false;
}

var onJumpToA=function(){
  pauseVideo();
  setCurrentTime(timeA);
  doAfterSeek((t)=>{$("#scrub").slider("option", "value", t);},timeA,timeA);
}

const timeRegExp=new RegExp('^\\s*'+timePattern+'\\s*$');
var onInputTime=function(user, sliderIdx){
  let time=user.value.match(timeRegExp);  //validate user input
  if(time){
    let sec=toNearest5ms(timeStringToSec(time[0]));
    if(sliderIdx==0){
      timeA=Math.min(sec,timeB-0.005);
    }else{
      timeB=Math.max(Math.min(sec,getDuration()),timeA+0.005);
    }
  }
  updateLoopUI();
}

var updateLoopUI=function(updateSlider=true){
  myTimeA.value=secToTimeString(Math.max(timeA,0));
  myTimeB.value=secToTimeString(Math.min(timeB,getDuration()));
  if(updateSlider){
    $("#slider").slider("option", "max", getDuration());
    $("#slider").slider("option", "values", [ timeA, timeB ]);
  }
}

var compDeltaByBeat=function(d, b){
  return b*Math.round(d/b);
}

var onLoopBackwards=function(){
  let dt=timeB-timeA;
  if(beatNormal) {
    dt=compDeltaByBeat(dt, beatNormal);
  }
  if(timeA-dt<0) return;
  timeA-=dt;
  timeB-=dt;
  loopMeas.splice(0);
  updateLoopUI();
}

var onLoopHalve=function(){
  let dt=timeB-timeA;
  if(beatNormal) {
    dt=compDeltaByBeat(dt, beatNormal);
  }
  timeB-=dt/2;
  loopMeas.splice(0);
  updateLoopUI();
}

var onLoopDouble=function(){
  let dt=timeB-timeA;
  if(beatNormal) {
    dt=compDeltaByBeat(dt, beatNormal);
  }
  if(timeB+dt>getDuration()) return;
  timeB+=dt;
  loopMeas.splice(0);
  updateLoopUI();
}

var onLoopForwards=function(){
  let dt=timeB-timeA;
  if(beatNormal) {
    dt=compDeltaByBeat(dt, beatNormal);
  }
  if(timeB+dt>getDuration()) return;
  timeA+=dt;
  timeB+=dt;
  loopMeas.splice(0);
  updateLoopUI();
}

var rate; //current playback rate (speed)
var beatNormal; //beat length at normal speed in s
var beatsArr = [];
var tapTimeout;
var onTap=function(ui,button=0) {
  if(button>0) return;
  beatsArr.push(performance.now()/1000);
  if(beatsArr.length>2) {
    let change=(beatsArr.at(-1)-beatsArr.at(-2))/(beatsArr.at(-2)-beatsArr.at(-3));
    if(change>=2||change<=0.5) { beatsArr.splice(0,beatsArr.length-1); }
  }
  if (beatsArr.length>1) {
    let beat=(beatsArr.at(-1)-beatsArr[0])/(beatsArr.length-1);
    beatNormal=beat*rate;
    ui.innerHTML=Math.round(60/beat).toString();
    //save beat to storage
    if(tapTimeout) clearTimeout(tapTimeout);
    tapTimeout=setTimeout((id,bn)=>{
      if(id) {
         let entry={};
         if(storage.getItem("ab."+id)) entry=JSON.parse(storage.getItem("ab."+id));
         entry.bn=bn;
         storageWriteKeyVal("ab."+id,JSON.stringify(entry));
      }
    },4000,vidId,beatNormal);
  }
}

var onContextTap=function(e){
  e.preventDefault();
  let curTempo;
  if(beatNormal){curTempo=60/beatNormal*rate;}
  promptDialog(
    tempo => {
      if(!isNaN(Number(tempo))&&Number(tempo)>0){
        beatNormal=60*rate/tempo;
        e.target.innerHTML=Math.round(tempo).toString();
        if(vidId) {
           let entry={};
           if(storage.getItem("ab."+vidId)) entry=JSON.parse(storage.getItem("ab."+vidId));
           entry.bn=beatNormal;
           storageWriteKeyVal("ab."+vidId,JSON.stringify(entry));
        }
      }
    },
    null, "Enter tempo (BPM):", (beatNormal ? null : "<a number, e. g. 120.345>"), curTempo
  );
}

var bmkAdd=function(note=undefined,idx=undefined){
  let bmks, bn;
  [bmks, bn]=queryBmksAndBn(vidId);
  if(idx===undefined){ //new bookmark
    if(!bmks) bmks=[];
    let bmk={ta: timeA, tb: timeB};
    idx=bmks.findIndex(bm => bmk.ta==bm.ta && bmk.tb==bm.tb);
    if(idx==-1) idx=insertBmk(bmk, bmks);
  }
  else{ //add note to existing
    bmks[idx]={ta: bmks[idx].ta, tb: bmks[idx].tb};
    if(note.trim()) bmks[idx].note=note.trim();
  }
  let entry={bmks: bmks};
  if(bn) entry.bn=bn;
  if(beatNormal) entry.bn=beatNormal; //update
  storageWriteKeyVal("ab."+vidId,JSON.stringify(entry));
  bookmarksUpdate(bmks,idx);
}

//insert a bookmark at its correct position (sorted by time)
//into a bookmarks array
var insertBmk=function(sbm, tbmArr){
  let idx=tbmArr.findIndex(tbm => sbm.ta==tbm.ta && sbm.tb==tbm.tb);
  if(idx>-1) { //update existing
    tbmArr.splice(idx, 1, sbm);
    return idx;
  }
  idx=tbmArr.findIndex(tbm => sbm.ta<tbm.ta || sbm.ta==tbm.ta && sbm.tb<tbm.tb);
  if(idx>-1){ //insert as new
    tbmArr.splice(idx, 0, sbm);
    return idx;
  }
  idx=tbmArr.length; //append as new
  tbmArr.push(sbm);
  return idx;
}

const toNearest5ms = t => Math.round(t*200)/200;

var bookmarksUpdate=function(bmkArr,idx){//selected idx
  while(myBookmarks.options.length>1)
    myBookmarks.remove(myBookmarks.options.length-1);
  bmkArr.forEach((bmk,i) => {
    let c=document.createElement("OPTION");
    c.text=secToTimeString(bmk.ta)+"--"+secToTimeString(bmk.tb);
    c.value=JSON.stringify([bmk.ta,bmk.tb]);
    c.title=bmk.note ? bmk.note : "";
    c.id="bmk"+(i+1).toString();
    myBookmarks.add(c);
    if(i==idx){
      c.selected=true;
      onBmkSelect(c.index);
    }
  });
  if(idx<0) myBookmarks.options[0].selected=true;
  if(myBookmarks.options.length>1) $("#myBmkSpan").show();
  else $("#myBmkSpan").hide();
  $("#myBookmarks").selectmenu("refresh");
}

var bmkDelete=function(idx){
  let bmks, bn;
  [bmks, bn]=queryBmksAndBn(vidId);
  if(idx==0){
    if(!bn && !beatNormal) storage.removeItem("ab."+vidId);
    else {
      let entry={};
      if(bn) entry.bn=bn;
      if(beatNormal) entry.bn=beatNormal; //overwrite
      storageWriteKeyVal("ab."+vidId,JSON.stringify(entry));
    }
    bookmarksUpdate([],-1);
  }
  else{
    let a,b;
    [a,b]=JSON.parse(myBookmarks.options[idx].value);
    if(!bmks) bmks=[];
    let i = bmks.findIndex(bmk => a==bmk.ta && b==bmk.tb);
    if(i>-1) {
      bmks.splice(i,1);
      let entry={};
      if(bmks.length) entry.bmks=bmks;
      if(bn) entry.bn=bn;
      if(beatNormal) entry.bn=beatNormal;
      if(bmks.length || bn || beatNormal) storageWriteKeyVal("ab."+vidId,JSON.stringify(entry));
      else storage.removeItem("ab."+vidId);
      bookmarksUpdate(bmks,Math.min(i,bmks.length-1));
    }
    else{
      bookmarksUpdate(bmks,Math.min(idx-1,bmks.length-1));
    }
  }
}

var onClickTrash=function(idx){
  blur();
  if(idx==0){ //all items
    confirmDialog(
      "Really delete <b>ALL</b> bookmarked loops?",
      function(res){
        if(res) bmkDelete(0);
      }
    );
  }else{ //selected item
    confirmDialog(
      "Delete this loop?",
      function(res){
        if(res) bmkDelete(idx);
      }
    );
  }
}

var onClickAddNote=function(idx){
  blur();
  let currentNote=myBookmarks.options[idx].title;
  promptDialog(
    note => bmkAdd(note,idx-1),
    null, "Enter description:", (currentNote ? null : "<Add note here>"), currentNote
  );
}

var textFile=null;
var onClickExport=function(){
  blur();
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
  blur();
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
        messageBox("Import", "Loop data and app settings successfully imported.");
        let bmks, bn;
        [bmks, bn]=queryBmksAndBn(vidId);
        if(bmks) bookmarksUpdate(bmks,-1);
        if(bn){
          beatNormal=bn;
          tapButton.innerHTML=Math.round(60/beatNormal*rate).toString();
        }
      }catch(err){
        messageBox("Error",
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
      + "Tempo (BPM) needs to be tapped or entered via the tap button's context menu beforehand.";

var contextHelp=function(t){
  blur();
  if(t.checked){
    storageWriteKeyVal("ab.help", "checked");
    t.title="Uncheck to disable context-sensitive help.";
    aonly.title=aonly.checked ? aonlyTitleChecked : aonlyTitleUnChecked;
    intro.title=intro.checked ? introTitleChecked : introTitleUnChecked;
    quant.title=quant.checked ? quantTitleChecked : quantTitleUnChecked;
    inputYT.title="Paste a valid YouTube URL, video or playlist ID.";
    searchButtonYT.title="Play video.";
    inputVT.title="Browse the hard disk for media files (mp4/H.264, webm, ogg, mp3, wav, ...).";
    loopButton.title="Click twice to mark loop range. Third click cancels current loop."
      + " Hotkeys: [Esc], [L]";
    myBmkSpanInner.title=myBmkSpanInnerTitleBak="Choose from previously saved loops.";
    bmkAddButton.title="Save current loop to the list of bookmarks.";
    loopBackwardsButton.title="Shift loop window backwards by one loop duration.";
    loopHalveButton.title="Halve the loop duration.";
    loopDoubleButton.title="Double the loop duration.";
    loopForwardsButton.title="Shift loop window forwards by one loop duration.";
    jumpToA.title="Jump to \"A\". Hotkey: [A]";
    myTimeA.title=myTimeB.title="Fine-tune the loop. Input format: [hh:]mm:ss[.sss]";
    annotButton.title="Add a note to the currently selected bookmark.";
    trashButton.title="Delete currently selected / delete all bookmarked loops.";
    $("#speed").attr("title", "Select playback rate. Reset to \"1\" with double click.");
    shareButton.title="Share player link with the current YouTube video or playlist, loop settings and playback rate.";
    exportButton.title="Export loop database and player settings to file \"ABLoopPlayer.json\". "
      + "Check your \"Downloads\" folder.";
    importButton.title="Import file \"ABLoopPlayer.json\" with loop database and player settings "
      + "from another computer or browser.";
    $("#slider").attr("title", "Move slider handles to adjust the loop. "
      + "Press [Ctrl] while moving a handle to shift the entire loop window. "
      + "Also, the handle that currently has keyboard focus can be moved with the arrow keys [←] , [→].");
    tapButton.title="Tap tempo, or enter a number via mouse right-click. Hotkey: [T]";
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
    myBmkSpanInner.title=myBmkSpanInnerTitleBak=
    jumpToA.title=
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
  isTimeASet=isTimeBSet=false;
  loopButton.innerHTML="A";
  loopButton.style.backgroundImage="none";
  tapButton.disabled=false;
  quant.disabled=true;
  quant.checked=false;
  loopMeas.splice(0);
  toggleQuant(quant, help);
}

var resetUI=function(){
  vidId=undefined;
  lstId=undefined;
  $("#timeInputs").hide();
  cancelABLoop();
  while(scrubTimer.length) clearInterval(scrubTimer.pop());
  $("#scrub").slider("option", "value", 0).hide();
  loopButton.disabled=true;
  $("#speed").slider("option", "disabled", true);
  $("#speed").slider("option", "step", 0.05);
  shareButton.disabled=true;
  bookmarksUpdate([],-1);
  tapButton.innerHTML="tap";
  tapButton.disabled=true;
  beatNormal=0;
  rate=1.0;
  aonly.disabled=false;
  tLavg=tLcount=0;
}

var onRateChange=function(e){
  rate=getPlaybackRate();
  $("#speed").slider("value",rate);
  $("#speed .ui-slider-handle").text(rate);
  loopMeas.splice(0);
  tLavg=tLcount=0;
  if (beatNormal) {
    tapButton.innerHTML=Math.round(60/beatNormal*rate).toString();
  }
}

var blur=function(){document.activeElement.blur();}

//loop & app data conversion to current format
var convertData=function(data){
  let storageFormat=Number(data["ab.version"]);
  if(storageFormat==appversion) return data;
  let ytubeids=[];//YouTube data
  let mediaids=[];//media files >= 100 Bytes
  if(data["ab.knownIDs"]) ytubeids=JSON.parse(data["ab.knownIDs"]);
  if(data["ab.knownMedia"]) mediaids=JSON.parse(data["ab.knownMedia"]);
  if(storageFormat==1.0){
    //fix (create) list of known media files
    Object.entries(data).forEach(([k,v])=>{
      let id=k.match(/^ab\.(.+\.[a-zA-Z0-9]{3,4}-\d{3,})$/);
      if(id&&id[1]) mediaids.push(id[1]);
    });
  }
  if(data["ab.knownMedia"]) delete data["ab.knownMedia"];
  if(mediaids.length) data["ab.knownMedia"]=JSON.stringify(mediaids);
  //now, process both lists
  [ytubeids, mediaids].forEach(ids=>{
    if(ids.length){
      ids.forEach(id => {
        if(data["ab."+id] && JSON.parse(data["ab."+id]).length){
          let bmks=JSON.parse(data["ab."+id]);
          bmks=bmks.map(bmk=>{
            if(bmk.note) return {ta: Number(bmk.ta), tb: Number(bmk.tb), note: bmk.note};
            else return {ta: Number(bmk.ta), tb: Number(bmk.tb)};
          });
          data["ab."+id]=JSON.stringify({bmks: bmks});
        }
      });
    }
  });
  data["ab.version"]=appversion;
  return data;
}

//merge converted/imported data into localStorage
var mergeData=function(data){
  let ytSrcIds=[], mmSrcIds=[];
  if(data["ab.knownIDs"]){
    ytSrcIds=JSON.parse(data["ab.knownIDs"]);
    let idx;// remove erroneous `null' entries
    while((idx=ytSrcIds.indexOf(null))>-1) ytSrcIds.splice(idx,1);
  }
  if(data["ab.knownMedia"]) mmSrcIds=JSON.parse(data["ab.knownMedia"]);
  [[ytSrcIds, knownIDs], [mmSrcIds, knownMedia]].forEach(([src,trg]) => {
    src.reverse().forEach(id => {
      if(trg.indexOf(id)==-1) trg.unshift(id);
      if(data["ab."+id]) {
        let entry={}; //entry with merged data (bmks array and beat length)
        let trgBmks, trgBn;
        [trgBmks, trgBn]=queryBmksAndBn(id); //local storage
        if(trgBn) entry.bn=trgBn;
        if(!trgBmks) trgBmks=[];
        let srcBmks, srcBn;
        [srcBmks, srcBn]=queryBmksAndBn(id, data); //data arg
        if(srcBn) entry.bn=srcBn; //overwrite with imported
        if(srcBmks){
          srcBmks.forEach(sbm=>{ //import with some sanity checks applied
            sbm.ta=Number(sbm.ta);
            sbm.tb=Number(sbm.tb);
            if(!isNaN(sbm.ta) && !isNaN(sbm.tb)){
              let ta=toNearest5ms(Math.min(Math.abs(sbm.ta),Math.abs(sbm.tb)));
              let tb=toNearest5ms(Math.max(Math.abs(sbm.ta),Math.abs(sbm.tb)));
              sbm.ta=ta;
              sbm.tb = ta==tb ? toNearest5ms(tb+0.005) : tb;
              insertBmk(sbm,trgBmks);
            }
          });
        }
        if(trgBmks.length) entry.bmks=trgBmks;
        storageWriteKeyVal("ab."+id,JSON.stringify(entry));
      }
    });
  });
  if(knownIDs.length) storageWriteKeyVal("ab.knownIDs",JSON.stringify(knownIDs));
  else storage.removeItem("ab.knownIDs");
  if(knownMedia.length) storageWriteKeyVal("ab.knownMedia",JSON.stringify(knownMedia));
  else storage.removeItem("ab.knownMedia");
  if(data["ab.help"]){
    storageWriteKeyVal("ab.help", data["ab.help"]);
    help.checked=(data["ab.help"]=="checked");
    contextHelp(help);
  }
  if(data["ab.aonly"]){
    storageWriteKeyVal("ab.aonly", data["ab.aonly"]);
    aonly.checked=(data["ab.aonly"]=="checked");
  }
  if(data["ab.intro"]){
    storageWriteKeyVal("ab.intro", data["ab.intro"]);
    intro.checked=(data["ab.intro"]=="checked");
    toggleIntro(intro, help);
  }
  if(data["ab.version"]) storageWriteKeyVal("ab.version", data["ab.version"]);
}

var doAfterSeek=function(callback,t,arg=null){
  if(t!=toNearest5ms(getCurrentTime())) setTimeout(doAfterSeek,1,callback,t,arg);
  else arg ? callback(arg) : callback();
}

var onBmkSelect=function(idx){
  if(idx==0) return;
  $("#slider").slider("option", "max", getDuration());
  let a,b;
  [a,b]=JSON.parse(myBookmarks.options[idx].value);
  $("#slider").slider("option", "values", [a, b]);
  quant.disabled=beatNormal ? false : true;
  $("#timeInputs").show();
  loopButton.innerHTML="&emsp;";
  loopButton.style.backgroundImage=crossMarkUrl;
  annotButton.disabled=false;
  isTimeASet=isTimeBSet=true;
  if(isPlaying()){
    pauseVideo();
    setCurrentTime(a);
    doAfterSeek(playVideo, a);
  }
  else setCurrentTime(a);
}

var toggleIntro=function(t,h){
  blur();
  if(t.checked){
    storageWriteKeyVal("ab.intro", "checked");
    if(h.checked) t.title=introTitleChecked;
  }else{
    storageWriteKeyVal("ab.intro", "unchecked");
    if(h.checked) t.title=introTitleUnChecked;
  }
}

var toggleQuant=function(t,h){
  blur();
  if(t.checked){
    if(h.checked) t.title=quantTitleChecked;
  }else{
    if(h.checked) t.title=quantTitleUnChecked;
  }
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
var loadYT=function(vid,plist,lid,ta,tb,r,lType="playlist"){
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
    videoId: vid && vid.substring(0,4)==="vid:" ? vid.substring(4) : vid,
    width: playerWidth,
    height: $("#myResizable").height(),
    playerVars: {
      index: vid && vid.substring(0,4)==="idx:" ? vid.substring(4) : null,
      list: lid,
      listType: lType,
      playlist: plist,
      //loop: 1, //loop over playlist
      //playlist: vid && !plist && !lid ? vid.substring(4) : plist, //loop single video
      autoplay: 1,
      modestbranding: 1,
      fs: 0,  //no fullscreen button
      rel: 0, //no related videos at the end
    },
    events: {
      "onReady": function(e){
        if(searchStr){
          inputYT.value=searchStr;
          searchStr=undefined;
        }
        if(e.target.getPlaylist()&&lid){
          let l=lType==="user_uploads" ? "@"+lid : lid;
          saveId(l);
          lstId=l;
          if(lType==="user_uploads"){
            if(vid && vid.substring(0,4)==="vid:"){
              let i=e.target.getPlaylist().indexOf(vid.substring(4))+1;
              if(i>0) loadYT("idx:"+i,null,lid,ta,tb,r,lType);
            }
          }
        }
        aonly.disabled=true;
      },
      "onStateChange": function(e){
        let v;
        if(e.target.getPlaylist()) v=e.target.getPlaylist()[e.target.getPlaylistIndex()].toString();
        else v=vid.substring(4);
        onPlayerStateChange(e,v,ta,tb,r);
      },
      "onPlaybackRateChange": onRateChange,
      "onError": function(e){
        console.log("Error: " + e.data);
        resetUI();
        if(lid && lType==="playlist") loadYT(vid,null,lid,ta,tb,r,"user_uploads");
        else loadYT(null,null,null,null,null,null);
      }
    }
  });
  blur();
}

var onYouTubeIframeAPIReady=function(){
  inputYT.disabled=searchButtonYT.disabled=false;
  if(document.location.search) {
    searchStr=document.location.search.substring(1); //remove leading `?'
    queryYT(searchStr);
  }
}

var onPlayerStateChange=function(e, id, ta, tb, s){ //event object, video id loop start & end time, rate
  if(e.data==YT.PlayerState.PLAYING){
    if(id!=vidId){//the video has changed
      $("#scrub").slider("option", "max", getDuration()).show();
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
      setPlaybackRate(s); //custom rate via url parameter
      $("#speed").slider("option", "disabled", false);
      tapButton.disabled=false;
      shareButton.disabled=false;
      //populate bookmark list with saved items for the current video ID
      //and set bpm, if known
      let bmks, bn;
      [bmks, bn]=queryBmksAndBn(id);
      bookmarksUpdate(bmks ? bmks : [],-1);
      if(bn){
        beatNormal=bn;
        tapButton.innerHTML=Math.round(60/beatNormal*rate).toString();
      }
      annotButton.disabled=true;
      saveId(id);
      //set ab loop from ta, tb args only upon new player instantiation
      if((ta||tb)&&!vidId){
        $("#slider").slider("option", "max", getDuration());
        let a=0,b=getDuration();
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
        setCurrentTime(a);
        $("#slider").slider("option", "values", [a, b]);
        isTimeASet=isTimeBSet=true;
        quant.disabled=beatNormal ? false : true;
        $("#timeInputs").show();
        loopButton.innerHTML="&emsp;";
        loopButton.style.backgroundImage=crossMarkUrl;
      }
      vidId=id;
    }
    if (!scrubTimer.length) scrubTimer.push(setInterval(onScrubTimerUpdate,1));
  }
  else if(e.data==YT.PlayerState.PAUSED||e.data==YT.PlayerState.ENDED){
    while(scrubTimer.length) clearInterval(scrubTimer.pop());
    loopMeas.splice(0);
  }
  else if (e.data==YT.PlayerState.UNSTARTED){
    cancelABLoop();
    setCurrentTime(0);
  }
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
  let vid,plist,lid,lType="playlist";
  if(
    !qu.match(/videoid|listid|playlist|index/)
    && !qu.match(/youtu\.be\/|youtube(?:-nocookie)?\..*/)
  ){//plain video id, list id, handle, playlist (comma or space separated video ids)
    vid=qu.trim().match(/^[0-9a-zA-Z_-]{11}$/);
    if(vid) vid="vid:"+vid[0];
    lid=qu.trim().match(/^[0-9A-Za-z_-]{12,}$/);
    if(!lid){
      lid=qu.trim().match(/(?<=^@)[0-9A-Za-z_.-]{3,30}$/); //handle?
      if(lid) lType="user_uploads";
    }
    plist=qu.trim().replace(/\s*,\s*/g,',').replace(/\s+/g,',').match(/^[0-9a-zA-Z_-]{11}(?:,[0-9a-zA-Z_-]{11})+$/);
  }
  else if(qu.match(/youtu\.be\/|youtube(?:-nocookie)?\..*/)){
    //regular YT url with video id and/or list id or playlist
    vid=qu.match(/(?<=youtu\.be\/|\/embed\/|\/v\/|[?&]v=)[0-9a-zA-Z_-]{11}/);
    if(vid) vid="vid:"+vid[0];
    else{//try with index into list
      vid=qu.match(/(?<=[?&]index=)[0-9]+/);
      if(vid) vid="idx:"+vid[0];
    }
    lid=qu.match(/(?<=[?&]list=)[0-9A-Za-z_.-]{3,}/);
    if(!lid){
      lid=qu.match(/(?<=\/@)[0-9A-Za-z_.-]{3,30}/);
      if(lid) lType="user_uploads";
    }
    plist=qu.match(/(?<=[?&]playlist=)[0-9a-zA-Z_-]{11}(?:,[0-9a-zA-Z_-]{11})*/);
  }
  else{//ABLoopPlayer share link
    let q="?"+qu;
    vid=q.match(/(?<=[?&]videoid=)[0-9a-zA-Z_-]{11}/);
    if(vid) vid="vid:"+vid[0];
    else{
      vid=q.match(/(?<=[?&]index=)[0-9]+/);
      if(vid) vid="idx:"+vid[0];
    }
    lid=q.match(/(?<=[?&]listid=)[0-9A-Za-z_-]{12,}/);
    if(!lid){
      lid=q.match(/(?<=[?&]listid=@)[0-9A-Za-z_.-]{3,30}/);
      if(lid) lType="user_uploads";
    }
    plist=q.match(/(?<=[?&]playlist=)[0-9a-zA-Z_-]{11}(?:,[0-9a-zA-Z_-]{11})*/);
  }
  if(!(vid||lid||plist)) return;
  let ta=qu.match(/(?<=[?&](?:star)?t=)[0-9]+(?:\.[0-9]*)?/);
  let tb=qu.match(/(?<=[?&]end=)[0-9]+(?:\.[0-9]*)?/);
  let r=qu.match(/(?<=[?&]rate=)[0-9]+(?:\.[0-9]*)?/);
  r=r ? Math.min(Math.max(r[0],0.25),2.0) : 1;
  loadYT(
    vid ? vid : null,
    plist ? plist[0] : null,
    lid ? lid[0] : null,
    ta ? ta[0] : null,
    tb ? tb[0] : null,
    r, lType
  );
}

var initResizableYT=function(){
  $("#myResizable" ).resizable({
    aspectRatio: false,
    minWidth: 160,
    minHeight: 90,
    create: function(e,ui){
      $("#scrub").width($("#myResizable").width()-2);
      $("#slider").width($("#myResizable").width()-2);
    },
    start: function(e,ui){
      $(ytDiv).hide();
    },
    stop: function(e,ui){
      ytPlayer.setSize(ui.size.width,ui.size.height);
      $(ytDiv).show();
    },
    resize: function(e,ui){
      $("#scrub").width(ui.size.width-2);
      $("#slider").width(ui.size.width-2);
      $("#introText").width(Math.max(ui.size.width,$("#widthA").width()+1));
      introTextBr.style.display=ui.size.width > $("#widthB").width()+1 ? "none" : "block";
    }
  });
}

var onClickShare=function(){
  blur();
  let sharelink=document.URL;
  let idx=sharelink.indexOf("?");
  if(idx>-1) sharelink=sharelink.substring(0,idx);
  let playlist=ytPlayer.getPlaylist();
  if(playlist){
    if(lstId) sharelink+="?listid="+lstId;
    else sharelink+="?playlist="+playlist.join();
    sharelink+="&videoid="+ytPlayer.getPlaylist()[ytPlayer.getPlaylistIndex()];
  }
  else{
    sharelink+="?videoid="+vidId;
  }
  if(isTimeASet) sharelink+="&start="+timeA.toString();
  if(isTimeBSet) sharelink+="&end="+timeB.toString();
  if(rate!=1.0) sharelink+="&rate="+rate;
  navigator.clipboard.writeText(sharelink);
  messageBox("Link copied to the clipboard:", sharelink);
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
  myVideo=document.createElement(aonly.checked ? "audio" : "video");
  myVideo.id="myVideo";
  myVideo.autoplay=false;
  myVideo.controls=true;
  myVideo.width=$("#myResizable").width();
  myVideo.addEventListener("durationchange", function(e){
    while(scrubTimer.length) clearInterval(scrubTimer.pop());
    loopMeas.splice(0);
    if (isFinite(e.target.duration)){
      $("#slider").slider("option", "max", getDuration());
      $("#scrub").slider("option", "max", getDuration()).show();
      $("#speed").slider("option", "min", 0.25);
      $("#speed").slider("option", "max", 2);
      $("#speed").slider("option", "value", 1);
      $("#speed").slider("option", "step", 0.01);
      $("#speed").slider("option", "disabled", false);
      tapButton.disabled=false;
    }else{
      //repeat setting media source until duration property is properly set;
      //this is a workaround of a bug in FFox on Windows
      e.target.src=e.target.currentSrc;
    }
  });
  myVideo.addEventListener("loadeddata", onLoadedData);
  myVideo.addEventListener("play", function(){
    loopMeas.splice(0);
    setPlaybackRate(Number($("#speed").slider("value")));
    this.removeEventListener("timeupdate", onTimeUpdateVT);
    if (!scrubTimer.length) scrubTimer.push(setInterval(onScrubTimerUpdate,1));
  });
  myVideo.addEventListener("pause", function(e){
    this.addEventListener("timeupdate", onTimeUpdateVT);
    while(scrubTimer.length) clearInterval(scrubTimer.pop());
    loopMeas.splice(0);
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

var onTimeUpdateVT=function(e){$("#scrub").slider("option", "value", e.target.currentTime);};

var onLoadedData=function(e){
  if(!aonly.checked){
    e.target.addEventListener("mouseover", function(e){e.target.controls=true;});
    e.target.addEventListener("mouseout", function(e){e.target.controls=false;});
  }
  e.target.addEventListener("timeupdate", onTimeUpdateVT);
  loopButton.disabled=false;
  $("#scrub").slider("option", "value", getCurrentTime());
  initResizableVT();
  //look for bookmark items with the current video ID
  let bmks, bn;
  [bmks, bn]=queryBmksAndBn(vidId);
  bookmarksUpdate(bmks ? bmks : [],-1);
  if(bn){
    beatNormal=bn;
    tapButton.innerHTML=Math.round(60/beatNormal*rate).toString();
  }
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

var initHeight;
var initResizableVT=function(){
  $("#myResizable").resizable({
    aspectRatio: !aonly.checked,
    minWidth: aonly.checked ? $("#myResizable").width() : 160,
    create: function(e,ui){
      myVideo.width=$("#myResizable").width();
      initHeight=$("#myResizable").height();
      $("#scrub").width($("#myResizable").width()-2);
      $("#slider").width($("#myResizable").width()-2);
    },
    resize: function(e,ui){
      myVideo.width=ui.size.width;
      if(aonly.checked){
        ui.size.height=initHeight;
      } else {
        myVideo.height=ui.size.height;
      }
      $("#scrub").width(ui.size.width-2);
      $("#slider").width(ui.size.width-2);
      $("#introText").width(Math.max(ui.size.width,$("#widthA").width()+1));
      introTextBr.style.display=ui.size.width > $("#widthB").width()+1 ? "none" : "block";
    }
  });
};

var toggleAudio=function(t,h){
  blur();
  playSelectedFile(inputVT.files[0]);
  if(h.checked){
    t.title=t.checked ? aonlyTitleChecked : aonlyTitleUnChecked;
  }
  if(t.checked) storageWriteKeyVal("ab.aonly", "checked");
  else storageWriteKeyVal("ab.aonly", "unchecked");
}

//functions with player specific implementation
var getCurrentTime;
var setCurrentTime;
var getDuration;
var getPlaybackRate;
var setPlaybackRate;
var playPause;
var pauseVideo;
var playVideo;
var isPlaying;

//initialization functions
var initYT=function(){ // YT
  getCurrentTime=function(){return ytPlayer.getCurrentTime();};
  setCurrentTime=function(t){ytPlayer.seekTo(t,true);};
  getDuration=function(){return Math.floor(ytPlayer.getDuration()*200)/200;};
  getPlaybackRate=function(){return ytPlayer.getPlaybackRate();};
  setPlaybackRate=function(r){ytPlayer.setPlaybackRate(r);};
  playPause=function(){
    if(ytPlayer.getPlayerState()==YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
    else ytPlayer.playVideo();
  }
  pauseVideo=function(){ytPlayer.pauseVideo();}
  playVideo=function(){ytPlayer.playVideo();}
  isPlaying=function(){return (ytPlayer.getPlayerState()==YT.PlayerState.PLAYING);}
}

var initVT=function(){ // <video> tag
  getCurrentTime=function(){return myVideo.currentTime;};
  setCurrentTime=function(t){myVideo.currentTime=t;};
  getDuration=function(){return Math.floor(myVideo.duration*200)/200;};
  getPlaybackRate=function(){return myVideo.playbackRate;};
  setPlaybackRate=function(r){myVideo.playbackRate=r;};
  playPause=function(){
    if(myVideo.paused) myVideo.play(); else myVideo.pause();
  }
  pauseVideo=function(){myVideo.pause();}
  playVideo=function(){myVideo.play();}
  isPlaying=function(){return !myVideo.paused&&!myVideo.ended;}
}
