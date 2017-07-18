#voicepin-recording-web

## Sound recording module for the web using webRTC

This is a module containing tools for sound recording that may help you integrate your web application with VoicePIN much faster.

Provided library is supplied with methods performing audio recording in suitable format for VoicePIN.com services.
  
___

It uses recorder.js and should have it already imported to work.

The recorder supports all browsers that implement:
             
              * getUserMedia
              * FormData
              
This currently (as of Jul 2015) boils down to current Firefox and Chrome

##Usage instructions:

Import in HTML file in the following sequence:

1. recorder.js
2. audiomanager.js

First, initialize the recorder with recording time and completion:

    initializeRecorder(5.0 , function (success, errorCode)
              {
                if(!success) console.log(errorCode);
              });
              
error codes are as follows:

           1 - incompatible browser
           2 - microphone access denied

Now, to start recording, use: 

    startRecording(function(progress, power) 
                {
                   // Code for handling UI updates here, called every 50 ms. 
                   // Power is measured in dB where -160 is silence and 0 is max.
                   // Progress goes from 0 to max length.
                
                }, function(formData) 
                {
                   // Code for saving recorded file (it already sits in the formData) 
                   
                
                });

To stop recording and save data use stopRecording:

    stopRecording();  
                
You can check if recording is taking place by checking 'isRecording' variable