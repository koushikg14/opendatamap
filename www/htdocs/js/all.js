var map;
var version;
var mcOptions = {gridSize: 50, maxZoom: 15};
var markers = new Object();
var infowindows = new Object();
var pmarkers = new Object();
var pinfowindows = new Object();
var polygons = new Object();
var polygoninfowindows = new Object();
var clusterMarkers = new Object();
var clusterInfowindows = new Object();
var hashfields = new Object();
var firstAtPos = new Object();
var tempInfowindow = undefined;

var DEFAULT_SEARCH_ICON = "http://www.picol.org/images/icons/files/png/32/search_32.png";
var CLEAR_SEARCH_ICON = "img/nt-left.png";

var oldString = null;
var xmlhttp = undefined;

var selecteddate = null;

var t;
var selectIndex = -1;
var limit = 0;

var zoomuri;
var clickuri;
var uri;

var addControl = function(elementID, position) {
	var element = document.getElementById(elementID);
	map.controls[position].push(element);
}

var initcredits = function() {
	addControl('credits', google.maps.ControlPosition.RIGHT_BOTTOM);
	addControl('credits-small', google.maps.ControlPosition.RIGHT_BOTTOM);
}

var geoloc = function() {
	_gaq.push(['_trackEvent', 'Geolocation', 'Request']);
	navigator.geolocation.getCurrentPosition(
		function(position) {        
			if( position.coords.accuracy < 5000 ) {
				map.setCenter(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
			} else {
				alert('Sorry, geo location wildly inaccurate ('+ position.coords.accuracy+" meters)"); 
			}
			_gaq.push(['_trackEvent', 'Geolocation', 'Response', null, position.coords.accuracy]);
		},        
		function(e) {
			alert('Sorry, geo location failed'); 
			_gaq.push(['_trackEvent', 'Geolocation', 'Failed']);
		}
	);                                                                  
}

var initgeoloc = function() {
	if (navigator.geolocation) {
		addControl('geobutton', google.maps.ControlPosition.TOP_RIGHT);
	} else {
		$('#geobutton').get(0).style.display = 'none';
	}
}

var reset_search_icon = function() {
	var val = $("#inputbox").val();
	if (val.length > 0) {
		$("#clear").attr("src", CLEAR_SEARCH_ICON);
	} else {
		$("#clear").attr("src", DEFAULT_SEARCH_ICON);
	}
}

// someone's clicked on something, you need to load the real data into it
var loadWindow = function(j, dest, hide, reload) {
	_gaq.push(['_trackEvent', 'InfoWindow', 'Single', j]);
	if(dest === undefined && polygonlls[j] !== undefined)
	{
		return;
	}
	$.get("info.php?v="+version+"&date="+selecteddate+"&uri="+encodeURIComponent(j), function(data) {
		var ll = markers[j].getPosition().toString();
		if(polygonnames[ll] !==undefined)
		{
			clusterTitle = '<h1>'+polygonnames[ll]+'</h1><hr />';
		}
		else
		{
			clusterTitle = '';
		}
		if(dest === undefined)
		{
			infowindows[j].setContent(clusterTitle+data);
		}
		else
		{
			tempInfowindow = new google.maps.InfoWindow({content:clusterTitle+data+'<a href="#" class="back" onclick="return goBack(\''+reload+'\')\">Back to list</a>'});
			tempInfowindow.setPosition(clusterInfowindows[reload].getPosition());
			tempInfowindow.open(map);
			clusterInfowindows[reload].close();
		}
	});
}

var goBack = function(reload) {
	tempInfowindow.close();
	clusterInfowindows[reload].open(map);
	return false;
}

var closeAll = function() {
	for(var i in markers) {
		infowindows[i].close();
	}
	for(var i in clusterMarkers) {
		if(typeof(clusterInfowindows[i]) == "object")
			clusterInfowindows[i].close();
	}
	for(var i in polygons) {
		polygoninfowindows[i].close();
	}
	if(tempInfowindow !== undefined) {
		tempInfowindow.close();
	}
}

var initmarkerevents = function() {
	for(var i in markers) {
		with({i: i})
		{
			google.maps.event.addListener(markers[i], 'click', function() {
				closeAll();
				infowindows[i].open(map,markers[i]);
				loadWindow(i);
			});
		}
	}
}

var refreshSubjectChoice = function() {
	var str = getHash('subject');
	if(str == '')
	{
		$('.General').hide();
		$('.InformationStand').hide();
		$('.Subject').show();
		$('.Subject h2').show();
		$('.Subject li').hide();
		$('#selectedsubject').html("Choose a subject:");
	}
	else
	{
		$('.General').show();
		$('.InformationStand').show();
		$('.Subject').hide();
		$('.Subject h2').hide();
		$('.Subject.subj_'+str).show();
		$('.Subject.subj_'+str+' li').show();
	}
}

var chooseSubject = function(name) {
	$('#selectedsubject').html(name+'<br/><span style="font-size:0.8em">(click to change subject)</span>');
	$('#selectedsubject').addClass('clickable');
	$('#selectedsubject').attr('title', 'Click to change subject');
	$('#selectedsubject').css('background-color', '#007C92');
	$('#selectedsubject').css('color', 'white');
	$('#selectedsubject').click(changeSubject);
	refreshSubjectChoice();
}

var changeSubject = function() {
	$('#inputbox').val('/'+getHash('day'));
	$('#selectedsubject').removeClass('clickable');
	$('#selectedsubject').attr('title', null);
	$('#selectedsubject').css('background-color', 'inherit');
	$('#selectedsubject').css('color', 'inherit');
	$('#selectedsubject').click(null);
	refreshSubjectChoice();
	updateFunc();
	updateHash('subject', '');
}

var updateFunc = function(force) {

	if(force !== true) force = false;
	var enabledCategories = getSelectedCategories();
	reset_search_icon();
	var inputbox = $("#inputbox").get(0);
	var list = $("#list").get(0);
	if(!force && inputbox.value == oldString) return;
	oldString = inputbox.value;

	if(xmlhttp !== undefined) xmlhttp.abort();
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open("GET","matches.php?v="+version+"&q="+inputbox.value+'&ec='+enabledCategories,true);
	_gaq.push(['_trackEvent', 'Search', 'Request', inputbox.value]);
	xmlhttp.send();
	xmlhttp.onreadystatechange=function() {
		if (xmlhttp.readyState==4 && xmlhttp.status==200) {
			var response_data = JSON.parse(xmlhttp.responseText);
			var matches = [], labelmatches = [];
			if (response_data !== undefined) {
				matches = response_data[0];
				labelmatches = response_data[1];
			}
			
			var matchesd = {};
			matches.map(function(x) { if (x !== undefined) { matchesd[x] = true; } });
			
			for (var uri in markers) {
				markers[uri].setVisible(matchesd[uri] !== undefined);
			}

			selectIndex = -1;
			list.innerHTML = "";
			
			var re = new RegExp('('+$.trim(inputbox.value)+')',"gi");
			limit = 0;
			for(var m in labelmatches) {
				// if it's the special last element, continue
				if (m === undefined) continue;
				var dispStr;
				if (labelmatches[m][0] === undefined) {
					continue;	
				}
				
				if(inputbox.value != "") {
					dispStr = new String(labelmatches[m][0]).replace(re, "<span style='background-color:#FFFF66'>$1</span>");
				} else {
					dispStr = labelmatches[m][0];
				}
				if(labelmatches[m][2] !== undefined) {
					if(labelmatches[m][3] !== undefined) {
						list.innerHTML += '<li id="li'+limit+'" onclick="zoomTo(\''+labelmatches[m][2]+'\'); setInputBox(\'\'); updateFunc();"><img class="icon" src="'+labelmatches[m][3]+'" style="width:15px" />'+dispStr+'</li>';
					} else {
						list.innerHTML += '<li id="li'+limit+'" onclick="zoomTo(\''+labelmatches[m][2]+'\'); setInputBox(\'\'); updateFunc();"><span style="font-size:0.5em">'+labelmatches[m][1]+': </span>'+dispStr+'</li>';
					}
				} else {
					list.innerHTML += '<li id="li'+limit+'" onclick="setInputBox(\'^'+labelmatches[m][0].replace('(', '\\\\(').replace(')', '\\\\)')+'$\'); updateFunc();">'+dispStr+'</li>';
				} 
				limit++;
			}
			if(limit == 0)
				list.innerHTML += '<li><i>No results found</i></li>';
			cluster();
			
			if ($("#spinner").is(":visible")) {
			  $("#spinner").fadeOut();
			}
			// end of initialize
		}
	}
}

var keypress = function(e) {
	if(e.keyCode == 40) return moveDown();
	else if(e.keyCode == 38) return moveUp();
	else if(e.keyCode == 13) return select();
	else if(e.keyCode == 27) return blursearch();
}

var removepmarker = function(pc) {
	pmarkers[pc].setMap(null);
}

var zoomTo = function(uri, cl, pan) {
	cl = typeof(cl) != 'undefined' ? cl : true;
	pan = typeof(pan) != 'undefined' ? pan : true;
	var bounds = new google.maps.LatLngBounds();
	if(uri.substring(0,9) == 'postcode:') {
		var pdata = uri.substring(9).split(',');
		var latlng = new google.maps.LatLng(pdata[1], pdata[2]);
		pmarkers[pdata[0]] = new google.maps.Marker({position:latlng, map:map, title:pdata[0], icon:'http://opendatamap.ecs.soton.ac.uk/resources/postcodeicon.php?pc='+pdata[0]});
		pinfowindows[pdata[0]] = new google.maps.InfoWindow({content:'<div id="content"><h2 id="title">'+pdata[0]+'</h2><a class="odl" href="'+pdata[3]+'">Visit page</a><br /><a class="odl" href="javascript:removepmarker(\''+pdata[0]+'\')">Remove this marker</a></div>'});
		with({pc: pdata[0]})
		{
			google.maps.event.addListener(pmarkers[pc], 'click', function() {
				pinfowindows[pc].open(map,pmarkers[pc]);
			});
		}
		_gaq.push(['_trackEvent', 'JumpTo', 'Postcode', pdata[0]]);
		if(pan)map.panTo(latlng);
	}
	else if(polygons[uri] !== undefined) {
		if(polygons[uri].length !== undefined) {
			_gaq.push(['_trackEvent', 'JumpTo', 'Polygon', uri]);
			for(var i = 0; i<polygons[uri].length; i++) {
				polygons[uri][i].getPath().forEach(function(el, i) {
					bounds.extend(el);
				});
			}
			if(pan)map.fitBounds(bounds);
			if(cl)google.maps.event.trigger(polygons[uri][0], 'click', bounds.getCenter());
		} else {
			_gaq.push(['_trackEvent', 'JumpTo', 'Point', uri]);
			if(pan)map.panTo(polygons[uri].getPosition());
			if(cl)google.maps.event.trigger(polygons[uri], 'click');
		}
	} else if(markers[uri] !== undefined) {
		_gaq.push(['_trackEvent', 'JumpTo', 'Point', uri]);
		if(pan)map.panTo(markers[uri].getPosition());
		if(cl)google.maps.event.trigger(markers[uri], 'click');
	} else if(uri == 'southampton-overview') {
		bounds.extend(new google.maps.LatLng(50.9667011,-1.4444580));
		bounds.extend(new google.maps.LatLng(50.9326431,-1.4438220));
		bounds.extend(new google.maps.LatLng(50.8887047,-1.3935115));
		bounds.extend(new google.maps.LatLng(50.9554826,-1.3560130));
		bounds.extend(new google.maps.LatLng(50.9667013,-1.4178855));
		if(pan)map.fitBounds(bounds);
	} else if(uri == 'southampton-centre') {
		bounds.extend(new google.maps.LatLng(50.9072471,-1.4186829));
		bounds.extend(new google.maps.LatLng(50.9111925,-1.4029262));
		bounds.extend(new google.maps.LatLng(50.9079644,-1.3979205));
		bounds.extend(new google.maps.LatLng(50.8930407,-1.4004233));
		if(pan)map.fitBounds(bounds);
	}
}

var getLiveInfo = function(i) {
	return "";//" <span class='live'>[" + i + "]</span>";
}

var renderClusterItem = function(uri, ll) {
	if(polygonlls[uri] == undefined)
	{
		//return '<div class="clusteritem" onclick="infowindows[\''+uri+'\'].open(map, clusterMarkers[\''+ll+'\']); loadWindow(\''+uri+'\')"><img class="icon" src="'+markers[uri].getIcon()+'" />'+markers[uri].getTitle().replace('\\\'', '\'') +getLiveInfo(uri)+'</div>';
		return '<div class="clusteritem" onclick="loadWindow(\''+uri+'\', $(\'#'+ll.replace(/[^0-9]/g, '_')+'-content\'), $(\'#'+ll.replace(/[^0-9]/g, '_')+'-listcontent\'), \''+ll+'\')"><img class="icon" src="'+markers[uri].getIcon()+'" />'+markers[uri].getTitle().replace('\\\'', '\'') +getLiveInfo(uri)+'</div>';
	}
	else
	{
		return '';
	}
}

var cluster = function() {
	closeAll();
	for(var i in clusterMarkers) {
		if(typeof(clusterMarkers[i]) == "object")
			clusterMarkers[i].setMap(null);
	}
	clusterMarkers = new Object();
	clusterInfowindows = new Object();
	var positions = new Object();
	firstAtPos = new Object();
	var str = "";
	var count = 0;
	var count2 = 0;
	for(var i in markers) {
		if(markers[i].getVisible() === true) {
			count ++;
			str += markers[i].getTitle();
			str += markers[i].getPosition().toString();
			var ll = markers[i].getPosition().toString();
			if(positions[ll] !== undefined) {
				positions[ll] ++;
				markers[i].setVisible(false);
				if(clusterMarkers[ll] === undefined) {
					clusterMarkers[ll] = new google.maps.Marker({
						position: markers[i].getPosition(),
						title: '2',
						map: map,
						visible: true
					});
					clusterInfowindows[ll] = new google.maps.InfoWindow({
						content: renderClusterItem(firstAtPos[ll], ll)+renderClusterItem(i, ll)
					});
					clusterMarkers[ll].setIcon('resources/clustericon.php?i[]='+markers[firstAtPos[ll]].getIcon()+'&i[]='+markers[i].getIcon());
					markers[firstAtPos[ll]].setVisible(false);
				} else {
					clusterInfowindows[ll].setContent(clusterInfowindows[ll].getContent()+
						renderClusterItem(i, ll));
					if(markers[i].getIcon() != clusterMarkers[ll].getIcon())
					{
						clusterMarkers[ll].setIcon(clusterMarkers[ll].getIcon()+'&i[]='+markers[i].getIcon());
					}
					var oldc = parseInt(clusterMarkers[ll].getTitle());
					clusterMarkers[ll].setTitle('' + (oldc + 1));
				}
				count2 ++;
			} else {
				positions[ll] = 1;
				firstAtPos[ll] = i;
			}
		}
	}
	for(var i in clusterInfowindows) {
		with({i: i})
		{
			if(polygonnames[i] !==undefined)
			{
				clusterTitle = '<h1>'+polygonnames[i]+'</h1><hr />';
			}
			else
			{
				clusterTitle = '';
			}
			clusterInfowindows[i].setContent(clusterTitle+'<div id="'+i.replace(/[^0-9]/g, '_')+'-listcontent">'+clusterInfowindows[i].getContent()+'<div style="font-size:0.8em; padding-top:15px; font-style:italic">click icon for more information</div></div><div id="'+i.replace(/[^0-9]/g, '_')+'-content"></div>');
		}
	}
	for(var i in infowindows) {
		with({i: i})
		{
			var ll = markers[i].getPosition().toString();
			if(polygonnames[ll] !== undefined)
			{
				clusterTitle = '<h1>'+polygonnames[ll]+'</h1><hr />';
			}
			else
			{
				clusterTitle = '';
			}
			if(polygonlls[i] === undefined)
			{
				infowindows[i].setContent(clusterTitle+infowindows[i].getContent());
			}
			else
			{
				infowindows[i].setContent(clusterTitle);
			}
		}
	}
	for(var i in clusterMarkers) {
		with({i: i})
		{
			clusterMarkers[i].setTitle(clusterMarkers[i].getTitle() + ' items');
			google.maps.event.addListener(clusterMarkers[i], 'click', function() {
				closeAll();
				_gaq.push(['_trackEvent', 'InfoWindow', 'Cluster', i]);
				clusterInfowindows[i].open(map,clusterMarkers[i]);
/*
				console.log(clusterInfowindows[i].content);
				if(xmlhttp !== undefined) xmlhttp.abort();
				xmlhttp = new XMLHttpRequest();
				xmlhttp.open("GET","process.php?v="+version+"&q="+inputbox.value+'&ec='+enabledCategories,true);
//	_gaq.push(['_trackEvent', 'Search', 'Request', inputbox.value]);
				xmlhttp.send();
				xmlhttp.onreadystatechange=function() {
					if (xmlhttp.readyState==4 && xmlhttp.status==200) {
						var response_data = JSON.parse(xmlhttp.responseText);
					}
				}
*/
			});
		}
	}
}

var initsearch = function() {
	$('#search').index = 2;
	addControl('search', google.maps.ControlPosition.TOP_RIGHT);
	$('#search-small').index = 2;
	addControl('search-small', google.maps.ControlPosition.TOP_RIGHT);
}

var setInputBox = function(str) {
	$('#inputbox').get(0).value = str;
}

var show = function(id) {
	selectIndex = -1;
	clearTimeout(t);
	$('#'+id).get(0).style.display = "block";
	if(id == 'list')
	{
		$('#toggleicons').get(0).style.zIndex = 5;
	}
}

var hide = function(id) {
	$('#'+id).get(0).style.display = "none";
}

var moveUp = function() {
	removeHighlight();
	if(selectIndex >= 0) selectIndex--;
	updateHighlight();
	return false;
}

var moveDown = function() {
	removeHighlight();
	if(selectIndex < limit - 1) selectIndex++;
	updateHighlight();
	return false;
}

var select = function() {
	if(selectIndex >= 0) $('#li'+selectIndex).get(0).onclick();
	blursearch();
}

var blursearch = function() {
	removeHighlight();
	$('#inputbox').blur();
}

var removeHighlight = function() {
	if(selectIndex >= 0) $('#li'+selectIndex).get(0).style.backgroundColor = 'inherit';
}

var updateHighlight = function() {
	if(selectIndex >= 0) $('#li'+selectIndex).get(0).style.backgroundColor = '#CCCCFF';
}

var delayHide = function(id, delay) {
	t = setTimeout("hide('"+id+"');", delay);
}

var contcount = 0;

var cont = function() {
	contcount++;
	if(contcount != 2) return;
	initmarkerevents();
	initgeoloc();
	inittoggle();
	initbookmarks();
	initcredits();
	initsearch();
	//var georssLayer = new google.maps.KmlLayer('http://opendatamap.ecs.soton.ac.uk/dev/colin/uni-link-routes.kml');
	//georssLayer.setMap(map);
	//var pathLayer = new google.maps.KmlLayer('http://opendatamap.ecs.soton.ac.uk/dev/colin/paths.kml');
	//pathLayer.setMap(map);
	
	$('#inputbox').keydown(keypress);
	$('#inputbox').keyup(updateFunc);
	var hashstring = location.hash.replace( /^#/, '' );
	location.hash = location.hash.replace(/\/.*/, '');
	hashstring = hashstring.split('/');
	if(hashstring.length > 1)
	{
		hashstring = hashstring[1];
		$('#subj_'+hashstring).click();
	}
	else
		hashstring = '';
	updateFunc();
	if(uri != '') zoomTo(uri, true, true);
	if(zoomuri != '')
	{
		zoomTo(zoomuri, false, true);
	}
	if(clickuri != '')
	{
		zoomTo(clickuri, true, false);
	}
}

var initmarkers = function() {
	$.get('alldata.php?v='+version, function(data,textstatus,xhr) {
		window.markers = {};
		window.infowindows = {};
		data.map(function(markpt) {
			if (markpt.length == 0) return;
			var pos = markpt[0];
			var lat = markpt[1];
			var lon = markpt[2];
			var poslabel = markpt[3];
			var icon = markpt[4];
			markers[pos] = new google.maps.Marker({
				position: new google.maps.LatLng(lat, lon), 
				title: poslabel.replace('\\\'', '\''),
				map: window.map,
				icon: icon,
				visible: false
			});
			infowindows[pos] = new google.maps.InfoWindow({ content: '<div id="content"><h2 id="title"><img class="icon" style="width:20px;" src="'+icon+'" />'+poslabel+'</h2><a class="odl" href="'+pos+'">Visit page</a><div id="bodyContent">Loading...</div></div>'});
		});
		cont();
	},'json');
	$.get('polygons.php?v='+version, function(data,textstatus,xhr) {
		window.polygons = {};
		window.polygoninfowindows = {};
		window.polygonnames = {};
		window.polygonlls = {};
		var buildingIcon = new google.maps.MarkerImage('img/building.png',
			new google.maps.Size(20, 20),
			new google.maps.Point(0, 0),
			new google.maps.Point(10, 10)
		);
		data.map(function(markpt) {
			if (markpt.length == 0) return;
			var pos = markpt[0];
			var poslabel = markpt[1];
			var zindex = markpt[2];
			var points = markpt[3];
			var ll = new google.maps.LatLng(markpt[5][1], markpt[5][0]).toString();
			polygonnames[ll] = poslabel;
			polygonlls[pos] = ll;
			var paths = new Array();
			var i;
			for(i=0; i < points.length-1; i++) {
				paths.push(new google.maps.LatLng(points[i][1], points[i][0])); 
			}
			if(paths.length == 0) {
				if(polygons[pos] === undefined) polygons[pos] = new Array();
				polygons[pos] = new google.maps.Marker({
					position: new google.maps.LatLng(points[i][1], points[i][0]),
					icon: buildingIcon,
					map: window.map,
					visible: true
				});
			}
			else
			{
				var fc = '#BF9375';
				var sc = '#BF9375';
				var fc = '#694B28';
				var sc = '#694B28';
				var pType = 'Building';
				if(zindex == -10)
				{
					fc = '#B9DDAD';
					sc = '#B9DDAD';
					fc = '#2B7413';
					sc = '#2B7413';
					var pType = 'Site';
				}
				
				if(markpt[4] != '')
				{
					fc = markpt[4];
					sc = markpt[4];
				}

				if(polygons[pos] === undefined) polygons[pos] = new Array();
				polygons[pos].push(new google.maps.Polygon({
					paths: paths,
					title: poslabel,
					map: window.map,
					zIndex: zindex,
					fillColor: fc,
					fillOpacity: 0.2,
					strokeColor: sc,
					strokeOpacity: 1.0,
					strokeWeight: 2.0,
					visible: true
				}));
			}
			polygoninfowindows[pos] = new google.maps.InfoWindow({ content: '<div id="content"><h2 id="title">'+poslabel+'</h2></div>'});
			
			var listener;
			var position;
			if(paths.length == 0) {
				listener = polygons[pos];
				position = listener.getPosition();
			} else {
				listener = polygons[pos][polygons[pos].length-1];
				var bounds = new google.maps.LatLngBounds();
					
				listener.getPath().forEach(function(el, i) {
					bounds.extend(el);
				});
				position = bounds.getCenter();
			}
			google.maps.event.addListener(listener, 'click', function(event) {
				closeAll();
				_gaq.push(['_trackEvent', 'InfoWindow', pType, pos]);
				var infowindow = polygoninfowindows[pos];
				var requireload = false;
				if(polygonlls[pos] !== undefined && clusterInfowindows[polygonlls[pos]] !== undefined)
				{
					infowindow = clusterInfowindows[polygonlls[pos]];
				}
				else if(firstAtPos[polygonlls[pos]] && infowindows[firstAtPos[polygonlls[pos]]] !== undefined)
				{
					infowindow = infowindows[firstAtPos[polygonlls[pos]]];
					requireload = firstAtPos[polygonlls[pos]];
				}
				if(event !== undefined) {
					if(event.latLng !== undefined) {
						infowindow.setPosition(event.latLng);
					} else {
						infowindow.setPosition(position);
					}
					infowindow.open(window.map);
				} else {
					infowindow.open(window.map, listener);
				}
				if(requireload)
				{
					loadWindow(requireload);
				}
			});
		});
		cont();
	},'json');
};

var updateHash = function(key, value) {
	if(key != undefined && value != undefined)
		hashfields[key] = value;
	var hashstring = '';
	for(var i in hashfields)
	{
		if(hashfields[i] != '' && hashfields[i] != undefined)
		{
			hashstring += ','+i+'='+hashfields[i];
		}
	}
	location.hash = '#'+hashstring.substring(1);
}

var getHash = function(key) {
	if(hashfields[key] == undefined)
		return '';
	else
		return hashfields[key];
}

var initialize = function(lat, long, zoom, puri, pzoomuri, pclickuri, pversion, defaultMap) {
	zoomuri = pzoomuri;
	clickuri = pclickuri;
	uri = puri;
	version = pversion;
	map = new google.maps.Map($('#map_canvas').get(0), {
		zoom: zoom,
		center: new google.maps.LatLng(lat, long),
		mapTypeControlOptions: {
			mapTypeIds: ['Map2', google.maps.MapTypeId.SATELLITE],
		        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
		        position: google.maps.ControlPosition.TOP_LEFT
		},
		
		mapTypeId: defaultMap
	});

	var styledMapType = new google.maps.StyledMapType([
  {
    featureType: "poi",
    elementType: "all",
    stylers: [
      { visibility: "off" }
    ]
  },{
    featureType: "landscape.man_made",
    elementType: "all",
    stylers: [
      { visibility: "off" }
    ]
  },{
    featureType: "transit.station",
    elementType: "all",
    stylers: [
      { visibility: "off" }
    ]
  }
], {name: 'Map'});
	map.mapTypes.set('Map2', styledMapType);

	initmarkers();

	var hcf = function() {
		var hashstring = location.hash.replace( /^#/, '' );
		var hashstringparts = hashstring.split(',');
		hashfields = new Object();
		for(var i in hashstringparts)
		{
			var hashfield = hashstringparts[i].split('=');
			hashfields[hashfield[0]] = hashfield[1];
		}

		if(document.title.replace( / \| .*/, '' ) != 'University of Southampton Open Day Map')
			return;
		var dates = new Object();
		var fulldates = new Object();
		$('#day a').each(function(i, v) {
			var d = v.id.substring(5, 15);
			dates[v.innerHTML.toLowerCase()] = d;
			fulldates[v.innerHTML.toLowerCase()] = v.title.replace('Show ', '').replace('\'s events (', ' ').replace(')', '');
			$('._'+d).hide();
		});
		$('#day a').each(function(i, v) {
			var d = v.id.substring(5, 15);
			$('#link_'+d).removeClass('selected');
		});
		document.title = document.title.replace( / \| .*/, '' );

		var d = getHash('day');
		var fulldate;
		if(d == '') {
			d = Object.keys(dates)[0];
			hashfields['day'] = d;
			updateHash();
		}
		if(dates[d] == undefined) {
			return;
		} else {
			selecteddate = dates[d];
			fulldate = fulldates[d];
		}

		document.title += ' | '+fulldate;
		$('._'+selecteddate).show();
		$('#link_'+selecteddate).addClass('selected');

		var s = getHash('subject');
		if($('#subj_'+s).get(0) != undefined) {
			chooseSubject($('#subj_'+s).get(0).innerHTML);
		}
	
		var hashvals = '';
		if(hashfields['subject'] != undefined)
			hashvals += hashfields['subject'];
		hashvals += '/';
		if(hashfields['day'] != undefined)
			hashvals += hashfields['day'];
		$('#inputbox').val(hashvals);
		updateFunc();
	};

	$(window).bind('hashchange', hcf);

	hcf();

}

var toggle = function(category) {
	var cEl = $('#'+category).get(0);
	if(cEl.checked) {
		cEl.checked = false;
		_gaq.push(['_trackEvent', 'Categories', 'Toggle', category, 0]);
	} else {
		cEl.checked = true;
		_gaq.push(['_trackEvent', 'Categories', 'Toggle', category, 1]);
	}
	updateFunc(true);
}

var getSelectedCategories = function() {
	var boxes = $('.togglebox');
	var selected = "";
	for(var i in boxes) {
		if(boxes[i] !== null && boxes[i].checked)
			selected += boxes[i].id + ",";
	}
	return selected;
}

var inittoggle = function() {
	addControl('toggleicons', google.maps.ControlPosition.RIGHT_TOP);
}

var initbookmarks = function() {
	if($('#bookmarks')==null)
		return;
	addControl('bookmarks', google.maps.ControlPosition.TOP_RIGHT);
	$('#bookmarks').show();
}
