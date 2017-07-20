/*          
 *  Copyright (c) 2015 VoicePIN sp. z o.o. All rights reserved.
 *  
 */

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();
var realAudioInput = null;
var audioInput = null;
var inputPoint = null;

var audioRecorder = null;
var isRecording = false;
var startTime = 0.0; 
var timeToRecord = 0.0;
var recordedBlob = null;
var analyserNode = null;

var recordingCompletion = null;

function progressUpdate(progress) 
{
    var lambda = function()
    {
        if(!isRecording) return;
        var t = new Date().getTime()/1000.0;
        if((t - startTime) > timeToRecord)
        {
            stopRecording();
            return;
        }
        var bufferLength = analyserNode.fftSize;
        var dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);

        var magnitude = 0.0;
        for(i=0;i<bufferLength;i++)
        {
            realAmplitude = (dataArray[i]-128);
            magnitude+=realAmplitude*realAmplitude; //
        }
        magnitude /= bufferLength; // Normalization
        var decibel = 10 * Math.log(magnitude/(128*128))/Math.log(10);

        progress(t - startTime, decibel);
        setTimeout(lambda, 50);
    };
	lambda();
	setTimeout(lambda, 50);
};


var startRecording = function(progress, completion)
{
    if(isRecording)
    {
        console.log("Already recording!");
        return;
    }
    // start recording
    if (!audioRecorder)
        return;
    isRecording = true;
    startTime = new Date().getTime()/1000.0;
    audioRecorder.clear();
    audioRecorder.record();
    progressUpdate(progress);
    recordingCompletion = completion;
};


var stopRecording = function()
{
    if(!isRecording)
    {
        return;
    }

    // stop recording
    audioRecorder.stop();
    isRecording = false;
    audioRecorder.getBuffer( function( buffers )
    {
        audioRecorder.exportWAV( function (blob)
            {
                recordedBlob = blob;
                var formData = new FormData();
                formData.append("recording-file", new Blob([blob],
                {
                    type: "audio/wav",
                    filename: "recording.wav"
                }));
                recordingCompletion(formData);
            }
        );
    });
};


var initializeRecorder = function (timeToRecordE, completion)
{
    function hasGetUserMedia()
    {
        return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia);
    }

    if (!hasGetUserMedia())
    {
        console.log("No getUserMedia in the browser")
        completion(false, 1);
        return;
    }
    timeToRecord = timeToRecordE;
    navigator.getUserMedia  = navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia;

    var constraints = {video: false, audio: true};

    navigator.getUserMedia(constraints,
        function(localMediaStream)
        {
            inputPoint = audioContext.createGain();

        // Create an AudioNode from the stream.
            realAudioInput = audioContext.createMediaStreamSource(localMediaStream);
            audioInput = realAudioInput;
            audioInput.connect(inputPoint);

            var desiredFFTSize = 0.05 /*s*/ * 16000 /*Hz */;
            var powerOfTwo = -1;
            while(Math.pow(2,++powerOfTwo) < desiredFFTSize);
            var actualFFTSize = Math.pow(2, powerOfTwo);

            console.log("Initializing with FFT size "+actualFFTSize);
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = actualFFTSize;
            inputPoint.connect( analyserNode );

            audioRecorder = new Recorder( inputPoint, {
                                                        numChannels : 1
                                                      });

            zeroGain = audioContext.createGain();
            zeroGain.gain.value = 0.0;
            inputPoint.connect( zeroGain );
            zeroGain.connect( audioContext.destination );
            completion(true, 0)
        },
        function(error)
        {
            console.log("User denied microphone " + error)
            completion(false, 2)
        });
};
