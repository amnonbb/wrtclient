// PacketServo browser endpoint
// Author: Packetservo
var server = null;
if(window.location.protocol === 'http:')
	server = "ws://" + window.location.hostname + ":8080/ws";
else
	server = "https://" + window.location.hostname + ":8080/ws";

var gstsink = null;
var spinner = null;
var bandwidth = 1024 * 1024;

var localPlaying = false;
var remotePlaying = false;

function StopRemote () {
	$('#remoteVideo').hide();
	$('#remoteButton').html("Start").click(StartRemote);
}

function StartRemote () {
	$('#remoteVideo').show();
	if(remotePlaying)
		return;
	
	janus = new Janus({
		server: server,
		error: function(error) {
			Janus.error(error);
			bootbox.alert(error, function(){window.location.reload();});
		},
		destroyed: function() {
			Janus.log("Destroyed!!");
			remotePlaying = false;
			window.location.reload();
		}
	});
	
	$('#remoteButton').html("Stop").click(StopRemote);
}

function StopLocal() {
	$('#mycanvas').hide()
	gstsink.send({'message': {'request':'stop'}});
	$('#localButton').html("Start").click(StartLocal);
	localPlaying = false;
}

function StartLocal() {
	$('#mycanvas').show()
	if(localPlaying)
		return;
	
	janus = new Janus({
		server: server,
		success: function() {
			janus.attach({
				plugin: "ps.plugin.gstsink",
				success: function(pluginHandle) {
					gstsink = pluginHandle;
					Janus.log("Plugin attached! (" + gstsink.getPlugin() + ", id=" + gstsink.getId() + ")");
					$('#localButton').removeAttr('disabled').html("Stop").click(StopLocal);
					gstsink.send({
						'message': {
							'request': 'configure',
							'video-bitrate-max': bandwidth,
							'video-keyframe-interval': 15000
						}
					});
					//prepareStream(mycanvas); 
					start_cloth(mycanvas);
					vstream = canvas.captureStream(10);
					gstsink.createOffer({
						stream: vstream,
						success: function(jsep) {
							Janus.debug("Got SDP!");
							Janus.debug(jsep);
							var body = {"request": "start"};
							gstsink.send({"message": body, "jsep": jsep});
						},
						error: function(error) {
							Janus.error("WebRTC error...", error);
							bootbox.alert("WebRTC error..." + error);
							gstsink.hangup();
						}
					});
				},
				error: function(error) {
					Janus.error(" -- Error attaching plugin --", error);
					bootbox.alert(" -- Error attaching plugin --" + error);
				},
				onmessage: function (msg, jsep){
					Janus.debug(" ::: Got a message :::");
					Janus.debug(JSON.stringify(msg));
					var result = msg["result"];
					if(result !== null && result !== undefined) {
						if(result["status"] !== undefined && result["status"] !== null) {
							var event = result["status"];
							if (event === "recording") {
								if (jsep !== null & jsep !== undefined) {
									gstsink.handleRemoteJsep({jsep: jsep});
								}
								var id = result["id"];
								if(id !== null && id !== undefined){
									Janus.log("The ID is "+id);
								}
							} else if (event === "stopped") {
								vstream.getTracks().forEach(function(track){track.stop();});
								//vstream = null;
								localPlaying = false;
								gstsink.hangup();
								janus.destroy();
							}
						}
					} else {
						var error = msg["error"];
						bootbox.alert(error);
					}
				},
				onlocalstream: function(stream) {
					if (localPlaying === true) {return;}
					localPlaying = true;
					Janus.debug(" ::: Got a local stream :::");
					//attachMediaStream($('#local').get(0), stream);
				},
				oncleanup: function() {
					Janus.log(" ::: Got a cleanup notification :::");
					localPlaying = false;
				},
				consentDialog: function(on) {
					Janus.debug("Consent dialog should be " + (on ? "on": "off") + " now");
					if (on) {
						$.blockUI({
							message: '<div>See up</div>',
							css: {
								border: 'none',
								padding: '15px',
								backgroundColor: 'transparent',
								color: '#aaa',
								top: '10px',
								left: (navigator.mozGetUserMedia ? '-100px' : '300px')
							}
						});
					} else {
						$.unblockUI();
					}
				}
			});			
		},
		error: function(error) {
			Janus.error(error);
			bootbox.alert(error, function() {window.location.reload();});
		},
		destroyed: function() {
			Janus.log("Destroyed!!");
			localPlaying = false;
			window.location.reload();
		}
	});
}

$(document).ready(function() {
	
	if(!Janus.isWebrtcSupported()){
		bootbox.alert("No WebRTC supported");
	}
	
	var mycanvas = document.getElementById("mycanvas");
	$('#mycanvas').hide();
	$('#remoteVideo').hide();
	Janus.init({debug: "all"});
	$('#localButton').click(StartLocal);
	$('#remoteButton').click(StartRemote);
});
