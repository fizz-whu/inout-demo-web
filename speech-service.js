// Web Speech API Service for Speech Recognition and Text-to-Speech

class SpeechService {
    constructor() {
        // Speech Recognition setup
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech recognition not supported in this browser');
            this.recognition = null;
        } else {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;
        }

        // Text-to-Speech setup
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;

        // State
        this.isListening = false;
        this.isSpeaking = false;
        this.isPaused = false;

        // Callbacks
        this.onPartialCallback = null;
        this.onFinalCallback = null;
        this.onErrorCallback = null;
        this.onAudioLevelCallback = null;
        this.onSpeechDetectedCallback = null;

        // Audio level simulation (Web Speech API doesn't provide audio levels)
        this.audioLevelInterval = null;
        this.simulatedAudioLevel = 0;
    }

    // Check if speech recognition is supported
    isSupported() {
        return this.recognition !== null && this.synth !== null;
    }

    // Start continuous listening
    startContinuousListening(callbacks) {
        if (!this.recognition) {
            if (callbacks.onError) {
                callbacks.onError(new Error('Speech recognition not supported'));
            }
            return;
        }

        this.onPartialCallback = callbacks.onPartial;
        this.onFinalCallback = callbacks.onFinal;
        this.onErrorCallback = callbacks.onError;
        this.onAudioLevelCallback = callbacks.onAudioLevel;
        this.onSpeechDetectedCallback = callbacks.onSpeechDetected;

        // Setup event handlers
        this.recognition.onstart = () => {
            console.log('Speech recognition started');
            this.isListening = true;
            this.startAudioLevelSimulation();
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Call speech detected on first interim result
            if (interimTranscript && this.onSpeechDetectedCallback) {
                this.onSpeechDetectedCallback();
            }

            // Send partial transcripts
            if (interimTranscript && this.onPartialCallback) {
                this.onPartialCallback(interimTranscript);
            }

            // Send final transcript
            if (finalTranscript && this.onFinalCallback) {
                console.log('Final transcript:', finalTranscript);
                this.onFinalCallback(finalTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);

            // Ignore 'no-speech' errors in continuous mode
            if (event.error === 'no-speech') {
                console.log('No speech detected, continuing to listen...');
                return;
            }

            // Handle other errors
            if (this.onErrorCallback && event.error !== 'aborted') {
                this.onErrorCallback(new Error(`Speech recognition error: ${event.error}`));
            }
        };

        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            this.stopAudioLevelSimulation();

            // Restart if we're supposed to be listening continuously
            if (this.isListening && !this.isPaused) {
                console.log('Restarting continuous listening...');
                setTimeout(() => {
                    if (this.isListening && !this.isPaused) {
                        try {
                            this.recognition.start();
                        } catch (error) {
                            console.error('Error restarting recognition:', error);
                        }
                    }
                }, 100);
            }
        };

        // Start recognition
        try {
            this.recognition.start();
            console.log('Starting continuous speech recognition...');
        } catch (error) {
            console.error('Error starting recognition:', error);
            if (this.onErrorCallback) {
                this.onErrorCallback(error);
            }
        }
    }

    // Pause listening (without destroying the recognition instance)
    pauseListening() {
        console.log('Pausing speech recognition...');
        this.isPaused = true;
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error pausing recognition:', error);
            }
        }
        this.stopAudioLevelSimulation();
    }

    // Resume listening
    resumeListening() {
        console.log('Resuming speech recognition...');
        this.isPaused = false;
        if (this.recognition && this.isListening) {
            try {
                this.recognition.start();
                this.startAudioLevelSimulation();
            } catch (error) {
                console.error('Error resuming recognition:', error);
            }
        }
    }

    // Stop listening completely
    stopListening() {
        console.log('Stopping speech recognition...');
        this.isListening = false;
        this.isPaused = false;
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping recognition:', error);
            }
        }
        this.stopAudioLevelSimulation();
    }

    // Simulate audio level (since Web Speech API doesn't provide this)
    startAudioLevelSimulation() {
        this.stopAudioLevelSimulation();
        this.audioLevelInterval = setInterval(() => {
            // Random fluctuation between 0.3 and 0.7
            this.simulatedAudioLevel = 0.3 + Math.random() * 0.4;
            if (this.onAudioLevelCallback) {
                this.onAudioLevelCallback(this.simulatedAudioLevel);
            }
        }, 100);
    }

    stopAudioLevelSimulation() {
        if (this.audioLevelInterval) {
            clearInterval(this.audioLevelInterval);
            this.audioLevelInterval = null;
        }
        this.simulatedAudioLevel = 0;
        if (this.onAudioLevelCallback) {
            this.onAudioLevelCallback(0);
        }
    }

    // Text-to-Speech: Speak text
    speak(text, callbacks = {}) {
        if (!this.synth) {
            console.error('Speech synthesis not supported');
            if (callbacks.onError) {
                callbacks.onError(new Error('Speech synthesis not supported'));
            }
            return;
        }

        // Cancel any ongoing speech
        this.stopSpeaking();

        this.currentUtterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance.lang = 'en-US';
        this.currentUtterance.rate = 1.0;
        this.currentUtterance.pitch = 1.0;
        this.currentUtterance.volume = 1.0;

        // Get the best available voice (prefer Google US English if available)
        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(voice =>
            voice.lang === 'en-US' && voice.name.includes('Google')
        ) || voices.find(voice => voice.lang === 'en-US');

        if (preferredVoice) {
            this.currentUtterance.voice = preferredVoice;
        }

        this.currentUtterance.onstart = () => {
            console.log('Started speaking');
            this.isSpeaking = true;
            if (callbacks.onStart) {
                callbacks.onStart();
            }
        };

        this.currentUtterance.onend = () => {
            console.log('Finished speaking');
            this.isSpeaking = false;
            this.currentUtterance = null;
            if (callbacks.onCompletion) {
                callbacks.onCompletion();
            }
        };

        this.currentUtterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
            this.isSpeaking = false;
            this.currentUtterance = null;
            if (callbacks.onError) {
                callbacks.onError(new Error(`Speech synthesis error: ${event.error}`));
            }
        };

        this.synth.speak(this.currentUtterance);
    }

    // Stop speaking
    stopSpeaking() {
        if (this.synth) {
            this.synth.cancel();
        }
        this.isSpeaking = false;
        this.currentUtterance = null;
    }
}

// Export SpeechService
window.SpeechService = SpeechService;
