/**
 * Copyright © 2013 Matt Diamond
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom
 * the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Recorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

module.exports = require("./recorder").Recorder;

},{"./recorder":2}],2:[function(require,module,exports){
'use strict';

var _createClass = (function () {
    function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
        }
    }return function (Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
    };
})();

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Recorder = undefined;

var _inlineWorker = require('inline-worker');

var _inlineWorker2 = _interopRequireDefault(_inlineWorker);

function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
}

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

var Recorder = exports.Recorder = (function () {
    function Recorder(source, cfg) {
        var _this = this;

        _classCallCheck(this, Recorder);

        this.config = {
            bufferLen: 4096,
            numChannels: 2,
            mimeType: 'audio/wav'
        };
        this.recording = false;
        this.callbacks = {
            getBuffer: [],
            exportWAV: []
        };

        Object.assign(this.config, cfg);
        this.context = source.context;
        this.node = (this.context.createScriptProcessor || this.context.createJavaScriptNode).call(this.context, this.config.bufferLen, this.config.numChannels, this.config.numChannels);

        this.node.onaudioprocess = function (e) {
            if (!_this.recording) return;

            var buffer = [];
            for (var channel = 0; channel < _this.config.numChannels; channel++) {
                buffer.push(e.inputBuffer.getChannelData(channel));
            }
            _this.worker.postMessage({
                command: 'record',
                buffer: buffer
            });
        };

        source.connect(this.node);
        this.node.connect(this.context.destination); //this should not be necessary

        var self = {};
        this.worker = new _inlineWorker2.default(function () {
            var recLength = 0,
                recBuffers = [],
                sampleRate = undefined,
                numChannels = undefined;

            self.onmessage = function (e) {
                switch (e.data.command) {
                    case 'init':
                        init(e.data.config);
                        break;
                    case 'record':
                        record(e.data.buffer);
                        break;
                    case 'exportWAV':
                        exportWAV(e.data.type);
                        break;
                    case 'getBuffer':
                        getBuffer();
                        break;
                    case 'clear':
                        clear();
                        break;
                }
            };

            function init(config) {
                sampleRate = config.sampleRate;
                numChannels = config.numChannels;
                initBuffers();
            }

            function record(inputBuffer) {
                for (var channel = 0; channel < numChannels; channel++) {
                    recBuffers[channel].push(inputBuffer[channel]);
                }
                recLength += inputBuffer[0].length;
            }

            function exportWAV(type) {
                var buffers = [];
                for (var channel = 0; channel < numChannels; channel++) {
                    buffers.push(mergeBuffers(recBuffers[channel], recLength));
                }
                var interleaved = undefined;
                if (numChannels === 2) {
                    interleaved = interleave(buffers[0], buffers[1]);
                } else {
                    interleaved = buffers[0];
                }
                var dataview = encodeWAV(interleaved);
                var audioBlob = new Blob([dataview], { type: type });

                self.postMessage({ command: 'exportWAV', data: audioBlob });
            }

            function getBuffer() {
                var buffers = [];
                for (var channel = 0; channel < numChannels; channel++) {
                    buffers.push(mergeBuffers(recBuffers[channel], recLength));
                }
                self.postMessage({ command: 'getBuffer', data: buffers });
            }

            function clear() {
                recLength = 0;
                recBuffers = [];
                initBuffers();
            }

            function initBuffers() {
                for (var channel = 0; channel < numChannels; channel++) {
                    recBuffers[channel] = [];
                }
            }

            function mergeBuffers(recBuffers, recLength) {
                var result = new Float32Array(recLength);
                var offset = 0;
                for (var i = 0; i < recBuffers.length; i++) {
                    result.set(recBuffers[i], offset);
                    offset += recBuffers[i].length;
                }
                return result;
            }

            function interleave(inputL, inputR) {
                var length = inputL.length + inputR.length;
                var result = new Float32Array(length);

                var index = 0,
                    inputIndex = 0;

                while (index < length) {
                    result[index++] = inputL[inputIndex];
                    result[index++] = inputR[inputIndex];
                    inputIndex++;
                }
                return result;
            }

            function floatTo16BitPCM(output, offset, input) {
                for (var i = 0; i < input.length; i++, offset += 2) {
                    var s = Math.max(-1, Math.min(1, input[i]));
                    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
            }

            function writeString(view, offset, string) {
                for (var i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }

            /****************************** RESAMPLER *********************************/

            //JavaScript Audio Resampler (c) 2011 - Grant Galitz (public domain)

            function Resampler(fromSampleRate, toSampleRate, channels, outputBufferSize, noReturn) {
            	this.fromSampleRate = fromSampleRate;
            	this.toSampleRate = toSampleRate;
            	this.channels = channels | 0;
            	this.outputBufferSize = outputBufferSize;
            	this.noReturn = !!noReturn;
            	this.initialize();
            }
            Resampler.prototype.initialize = function () {
            	//Perform some checks:
            	if (this.fromSampleRate > 0 && this.toSampleRate > 0 && this.channels > 0) {
            		if (this.fromSampleRate == this.toSampleRate) {
            			//Setup a resampler bypass:
            			this.resampler = this.bypassResampler;		//Resampler just returns what was passed through.
                        this.ratioWeight = 1;
            		}
            		else {
                        this.ratioWeight = this.fromSampleRate / this.toSampleRate;
            			if (this.fromSampleRate < this.toSampleRate) {
            				/*
            					Use generic linear interpolation if upsampling,
            					as linear interpolation produces a gradient that we want
            					and works fine with two input sample points per output in this case.
            				*/
            				this.compileLinearInterpolationFunction();
            				this.lastWeight = 1;
            			}
            			else {
            				/*
            					Custom resampler I wrote that doesn't skip samples
            					like standard linear interpolation in high downsampling.
            					This is more accurate than linear interpolation on downsampling.
            				*/
            				this.compileMultiTapFunction();
            				this.tailExists = false;
            				this.lastWeight = 0;
            			}
            			this.initializeBuffers();
            		}
            	}
            	else {
            		throw(new Error("Invalid settings specified for the resampler."));
            	}
            }
            Resampler.prototype.compileLinearInterpolationFunction = function () {
            	var toCompile = "var bufferLength = buffer.length;\
            	var outLength = this.outputBufferSize;\
            	if ((bufferLength % " + this.channels + ") == 0) {\
            		if (bufferLength > 0) {\
            			var weight = this.lastWeight;\
            			var firstWeight = 0;\
            			var secondWeight = 0;\
            			var sourceOffset = 0;\
            			var outputOffset = 0;\
            			var outputBuffer = this.outputBuffer;\
            			for (; weight < 1; weight += " + this.ratioWeight + ") {\
            				secondWeight = weight % 1;\
            				firstWeight = 1 - secondWeight;";
            	for (var channel = 0; channel < this.channels; ++channel) {
            		toCompile += "outputBuffer[outputOffset++] = (this.lastOutput[" + channel + "] * firstWeight) + (buffer[" + channel + "] * secondWeight);";
            	}
            	toCompile += "}\
            			weight -= 1;\
            			for (bufferLength -= " + this.channels + ", sourceOffset = Math.floor(weight) * " + this.channels + "; outputOffset < outLength && sourceOffset < bufferLength;) {\
            				secondWeight = weight % 1;\
            				firstWeight = 1 - secondWeight;";
            	for (var channel = 0; channel < this.channels; ++channel) {
            		toCompile += "outputBuffer[outputOffset++] = (buffer[sourceOffset" + ((channel > 0) ? (" + " + channel) : "") + "] * firstWeight) + (buffer[sourceOffset + " + (this.channels + channel) + "] * secondWeight);";
            	}
            	toCompile += "weight += " + this.ratioWeight + ";\
            				sourceOffset = Math.floor(weight) * " + this.channels + ";\
            			}";
            	for (var channel = 0; channel < this.channels; ++channel) {
            		toCompile += "this.lastOutput[" + channel + "] = buffer[sourceOffset++];";
            	}
            	toCompile += "this.lastWeight = weight % 1;\
            			return this.bufferSlice(outputOffset);\
            		}\
            		else {\
            			return (this.noReturn) ? 0 : [];\
            		}\
            	}\
            	else {\
            		throw(new Error(\"Buffer was of incorrect sample length.\"));\
            	}";
            	this.resampler = Function("buffer", toCompile);
            }
            Resampler.prototype.compileMultiTapFunction = function () {
            	var toCompile = "var bufferLength = buffer.length;\
            	var outLength = this.outputBufferSize;\
            	if ((bufferLength % " + this.channels + ") == 0) {\
            		if (bufferLength > 0) {\
            			var weight = 0;";
            	for (var channel = 0; channel < this.channels; ++channel) {
            		toCompile += "var output" + channel + " = 0;"
            	}
            	toCompile += "var actualPosition = 0;\
            			var amountToNext = 0;\
            			var alreadyProcessedTail = !this.tailExists;\
            			this.tailExists = false;\
            			var outputBuffer = this.outputBuffer;\
            			var outputOffset = 0;\
            			var currentPosition = 0;\
            			do {\
            				if (alreadyProcessedTail) {\
            					weight = " + this.ratioWeight + ";";
            	for (channel = 0; channel < this.channels; ++channel) {
            		toCompile += "output" + channel + " = 0;"
            	}
            	toCompile += "}\
            				else {\
            					weight = this.lastWeight;";
            	for (channel = 0; channel < this.channels; ++channel) {
            		toCompile += "output" + channel + " = this.lastOutput[" + channel + "];"
            	}
            	toCompile += "alreadyProcessedTail = true;\
            				}\
            				while (weight > 0 && actualPosition < bufferLength) {\
            					amountToNext = 1 + actualPosition - currentPosition;\
            					if (weight >= amountToNext) {";
            	for (channel = 0; channel < this.channels; ++channel) {
            		toCompile += "output" + channel + " += buffer[actualPosition++] * amountToNext;"
            	}
            	toCompile += "currentPosition = actualPosition;\
            						weight -= amountToNext;\
            					}\
            					else {";
            	for (channel = 0; channel < this.channels; ++channel) {
            		toCompile += "output" + channel + " += buffer[actualPosition" + ((channel > 0) ? (" + " + channel) : "") + "] * weight;"
            	}
            	toCompile += "currentPosition += weight;\
            						weight = 0;\
            						break;\
            					}\
            				}\
            				if (weight <= 0) {";
            	for (channel = 0; channel < this.channels; ++channel) {
            		toCompile += "outputBuffer[outputOffset++] = output" + channel + " / " + this.ratioWeight + ";"
            	}
            	toCompile += "}\
            				else {\
            					this.lastWeight = weight;";
            	for (channel = 0; channel < this.channels; ++channel) {
            		toCompile += "this.lastOutput[" + channel + "] = output" + channel + ";"
            	}
            	toCompile += "this.tailExists = true;\
            					break;\
            				}\
            			} while (actualPosition < bufferLength && outputOffset < outLength);\
            			return this.bufferSlice(outputOffset);\
            		}\
            		else {\
            			return (this.noReturn) ? 0 : [];\
            		}\
            	}\
            	else {\
            		throw(new Error(\"Buffer was of incorrect sample length.\"));\
            	}";
            	this.resampler = Function("buffer", toCompile);
            }
            Resampler.prototype.bypassResampler = function (buffer) {
            	if (this.noReturn) {
            		//Set the buffer passed as our own, as we don't need to resample it:
            		this.outputBuffer = buffer;
            		return buffer.length;
            	}
            	else {
            		//Just return the buffer passsed:
            		return buffer;
            	}
            }
            Resampler.prototype.bufferSlice = function (sliceAmount) {
            	if (this.noReturn) {
            		//If we're going to access the properties directly from this object:
            		return sliceAmount;
            	}
            	else {
            		//Typed array and normal array buffer section referencing:
            		try {
            			return this.outputBuffer.subarray(0, sliceAmount);
            		}
            		catch (error) {
            			try {
            				//Regular array pass:
            				this.outputBuffer.length = sliceAmount;
            				return this.outputBuffer;
            			}
            			catch (error) {
            				//Nightly Firefox 4 used to have the subarray function named as slice:
            				return this.outputBuffer.slice(0, sliceAmount);
            			}
            		}
            	}
            }
            Resampler.prototype.initializeBuffers = function () {
            	//Initialize the internal buffer:
            	try {
            		this.outputBuffer = new Float32Array(this.outputBufferSize);
            		this.lastOutput = new Float32Array(this.channels);
            	}
            	catch (error) {
            		this.outputBuffer = [];
            		this.lastOutput = [];
            	}
            }

            /*****/

            function encodeWAV(samples) {
                var outputSampleRate = 16000;
                var resampler = new Resampler(sampleRate, outputSampleRate, 1, outputSampleRate/sampleRate * samples.length);
                samples = resampler.resampler(samples);

                var buffer = new ArrayBuffer(44 + samples.length * 2);
                var view = new DataView(buffer);

                /* RIFF identifier */
                writeString(view, 0, 'RIFF');
                /* RIFF chunk length */
                view.setUint32(4, 36 + samples.length * 2, true);
                /* RIFF type */
                writeString(view, 8, 'WAVE');
                /* format chunk identifier */
                writeString(view, 12, 'fmt ');
                /* format chunk length */
                view.setUint32(16, 16, true);
                /* sample format (raw) */
                view.setUint16(20, 1, true);
                /* channel count */
                view.setUint16(22, numChannels, true);
                /* sample rate */
                view.setUint32(24, outputSampleRate, true);
                /* byte rate (sample rate * block align) */
                view.setUint32(28, outputSampleRate * 4, true);
                /* block align (channel count * bytes per sample) */
                view.setUint16(32, numChannels * 2, true);
                /* bits per sample */
                view.setUint16(34, 16, true);
                /* data chunk identifier */
                writeString(view, 36, 'data');
                /* data chunk length */
                view.setUint32(40, samples.length * 2, true);

                floatTo16BitPCM(view, 44, samples);

                return view;
            }
        }, self);


        this.worker.postMessage({
            command: 'init',
            config: {
                sampleRate: this.context.sampleRate,
                numChannels: this.config.numChannels
            }
        });

        this.worker.onmessage = function (e) {
            var cb = _this.callbacks[e.data.command].pop();
            if (typeof cb == 'function') {
                cb(e.data.data);
            }
        };
    }

    _createClass(Recorder, [{
        key: 'record',
        value: function record() {
            this.recording = true;
        }
    }, {
        key: 'stop',
        value: function stop() {
            this.recording = false;
        }
    }, {
        key: 'clear',
        value: function clear() {
            this.worker.postMessage({ command: 'clear' });
        }
    }, {
        key: 'getBuffer',
        value: function getBuffer(cb) {
            cb = cb || this.config.callback;
            if (!cb) throw new Error('Callback not set');

            this.callbacks.getBuffer.push(cb);

            this.worker.postMessage({ command: 'getBuffer' });
        }
    }, {
        key: 'exportWAV',
        value: function exportWAV(cb, mimeType) {
            mimeType = mimeType || this.config.mimeType;
            cb = cb || this.config.callback;
            if (!cb) throw new Error('Callback not set');

            this.callbacks.exportWAV.push(cb);

            this.worker.postMessage({
                command: 'exportWAV',
                type: mimeType
            });
        }
    }], [{
        key: 'forceDownload',
        value: function forceDownload(blob, filename) {
            var url = (window.URL || window.webkitURL).createObjectURL(blob);
            var link = window.document.createElement('a');
            link.href = url;
            link.download = filename || 'output.wav';
            var click = document.createEvent("Event");
            click.initEvent("click", true, true);
            link.dispatchEvent(click);
        }
    }]);

    return Recorder;
})();

exports.default = Recorder;

},{"inline-worker":3}],3:[function(require,module,exports){
"use strict";

module.exports = require("./inline-worker");
},{"./inline-worker":4}],4:[function(require,module,exports){
(function (global){
"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var WORKER_ENABLED = !!(global === global.window && global.URL && global.Blob && global.Worker);

var InlineWorker = (function () {
  function InlineWorker(func, self) {
    var _this = this;

    _classCallCheck(this, InlineWorker);

    if (WORKER_ENABLED) {
      var functionBody = func.toString().trim().match(/^function\s*\w*\s*\([\w\s,]*\)\s*{([\w\W]*?)}$/)[1];
      var url = global.URL.createObjectURL(new global.Blob([functionBody], { type: "text/javascript" }));

      return new global.Worker(url);
    }

    this.self = self;
    this.self.postMessage = function (data) {
      setTimeout(function () {
        _this.onmessage({ data: data });
      }, 0);
    };

    setTimeout(function () {
      func.call(self);
    }, 0);
  }

  _createClass(InlineWorker, {
    postMessage: {
      value: function postMessage(data) {
        var _this = this;

        setTimeout(function () {
          _this.self.onmessage({ data: data });
        }, 0);
      }
    }
  });

  return InlineWorker;
})();

module.exports = InlineWorker;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1])(1)
});