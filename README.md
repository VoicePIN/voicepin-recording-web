# voicepin-recording-web

## Sound recording module for the web using webRTC

This is a module containing tools for sound recording that may help you to integrate your web application with VoicePIN.

Provided library supplies methods for audio recording in a format suitable for VoicePIN.com services.

___

It uses [Recorder.js](https://github.com/mattdiamond/Recorderjs) and should have it already imported in order to work.

The recorder supports all browsers that implement:             
* getUserMedia
* FormData

## Usage instructions:

Library is available as NPM and WebJar on [https://nexus.voicepin.com](https://nexus.voicepin.com/#browse/search=keyword%3D%22voicepin-recording-web%22).

First, initialize the recorder with recording time (in seconds) and completion handler:

    voicepinRecordingWeb.initializeRecorder(5.0 , function (success, errorCode)
    {
        if(!success) console.log(errorCode);
    });
              
Error codes are as follows:
* 1 - incompatible browser
* 2 - microphone access denied

To start recording: 

    voicepinRecordingWeb.startRecording(function(progress, power) 
        {
            // Code for handling UI updates here, called every 50 ms. 
            // Power is measured in dB where -160 is silence and 0 is max.
            // Progress goes from 0 to recording time defined during initialization.
        }, function(formData) 
        {
            var recordingData = formData.get("recording-file")
            // Take actions with recorded data
        });

To stop recording:

    voicepinRecordingWeb.stopRecording();  
    
## Examples

[Display progress and save file on disk](example/index.html)
