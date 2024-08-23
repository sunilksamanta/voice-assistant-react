import { useState, useRef, useCallback, useEffect } from 'react';
import { Container, Button, Alert } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faStop, faPlay, faPause, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import SpeakingFace from "./AnimatedSpeakingFace.jsx";

const VoiceAssistant = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [responseAudio, setResponseAudio] = useState(null);
    const [isPlayingResponse, setIsPlayingResponse] = useState(false);
    const [isPausedResponse, setIsPausedResponse] = useState(false);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);
    const streamRef = useRef(null);
    const audioRef = useRef(new Audio());
    const responseAudioRef = useRef(new Audio());
    const [apiLoading, setApiLoading] = useState(false);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            audioChunks.current = [];

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            const sampleRate = 16000;
            let resampledBuffer = new Float32Array(0);

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const ratio = audioContext.sampleRate / sampleRate;
                const newLength = Math.round(inputData.length / ratio);
                const result = new Float32Array(newLength);
                let index = 0;
                let inputIndex = 0;
                while (index < result.length) {
                    result[index] = inputData[Math.floor(inputIndex)];
                    inputIndex += ratio;
                    index++;
                }
                resampledBuffer = appendBuffer(resampledBuffer, result);
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            const appendBuffer = (buffer1, buffer2) => {
                const tmp = new Float32Array(buffer1.length + buffer2.length);
                tmp.set(buffer1, 0);
                tmp.set(buffer2, buffer1.length);
                return tmp;
            };

            const encodeWAV = (samples) => {
                const buffer = new ArrayBuffer(44 + samples.length * 2);
                const view = new DataView(buffer);

                const writeString = (view, offset, string) => {
                    for (let i = 0; i < string.length; i++) {
                        view.setUint8(offset + i, string.charCodeAt(i));
                    }
                };

                // RIFF chunk descriptor
                writeString(view, 0, 'RIFF');
                view.setUint32(4, 36 + samples.length * 2, true);
                writeString(view, 8, 'WAVE');

                // FMT sub-chunk
                writeString(view, 12, 'fmt ');
                view.setUint32(16, 16, true);
                view.setUint16(20, 1, true);
                view.setUint16(22, 1, true);
                view.setUint32(24, sampleRate, true);
                view.setUint32(28, sampleRate * 2, true);
                view.setUint16(32, 2, true);
                view.setUint16(34, 16, true);

                // Data sub-chunk
                writeString(view, 36, 'data');
                view.setUint32(40, samples.length * 2, true);

                const volume = 1;
                let index = 44;
                for (let i = 0; i < samples.length; i++) {
                    view.setInt16(index, samples[i] * (0x7FFF * volume), true);
                    index += 2;
                }

                return view;
            };

            mediaRecorder.current = {
                start: () => {},
                stop: () => {
                    source.disconnect();
                    processor.disconnect();
                    const wavData = encodeWAV(resampledBuffer);
                    const audioBlob = new Blob([wavData], { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    setAudioUrl(audioUrl);
                    setIsRecording(false);
                }
            };

            mediaRecorder.current.start();
            setIsRecording(true);
            setError(null);
            setAudioUrl(null);
            setResponseAudio(null);
        } catch (err) {
            setError("Failed to access the microphone. Please check your browser settings.");
        }
    }, []);

    const sendAudioToAPI = useCallback(async () => {
        setApiLoading(true);
        if (!audioUrl) {
            setError("No audio recorded. Please record audio before sending.");
            setApiLoading(false);
            return;
        }

        const response = await fetch(audioUrl);
        const audioBlob = await response.blob();
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.wav');

        try {
            const response = await axios.post('http://localhost:8000/process_audio/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                responseType: 'blob'
            });
            const responseAudioUrl = URL.createObjectURL(response.data);
            setResponseAudio(responseAudioUrl);
            playResponseAudio(responseAudioUrl);
        } catch (err) {
            setError("Failed to send audio to the API. Please try again.");
        } finally {
            setApiLoading(false);
        }
    }, [audioUrl]);

    const stopRecording = useCallback(() => {
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.stop();
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    }, [isRecording]);

    const handleButtonClick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const togglePlayPause = () => {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const playResponseAudio = (audioUrl) => {
        responseAudioRef.current.src = audioUrl;
        responseAudioRef.current.play();
        setIsPlayingResponse(true);
        setIsPausedResponse(false);
    };

    const toggleResponsePlayPause = () => {
        if (isPlayingResponse) {
            responseAudioRef.current.pause();
            setIsPlayingResponse(false);
            setIsPausedResponse(true);
        } else {
            responseAudioRef.current.play();
            setIsPlayingResponse(true);
            setIsPausedResponse(false);
        }
    };

    useEffect(() => {
        if (audioUrl) {
            audioRef.current.src = audioUrl;
            audioRef.current.onended = () => setIsPlaying(false);
            console.log(audioRef.current.src);
            sendAudioToAPI();
        }

        responseAudioRef.current.onended = () => {
            setIsPlayingResponse(false);
            setIsPausedResponse(false);
        };
    }, [audioUrl, sendAudioToAPI]);

    return (
        <Container className="d-flex flex-column align-items-center justify-content-center vh-100 bg-dark text-light">
            <h1 className="mb-5">Voice Assistant</h1>
            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
            <div className="d-flex flex-column align-items-center">
                <Button
                    variant={isRecording ? "danger" : "primary"}
                    size="lg"
                    className="rounded-circle p-4 mb-3 main-button"
                    onClick={handleButtonClick}
                    disabled={isPlayingResponse}
                >
                    <FontAwesomeIcon
                        icon={isRecording ? faStop : faMicrophone}
                        size="3x"
                        className={`${isRecording ? '' : 'pulse'}`}
                    />
                </Button>
                {isRecording && (
                    <div className="wave-container">
                        <div className="wave"></div>
                        <div className="wave"></div>
                        <div className="wave"></div>
                    </div>
                )}

                {apiLoading && (
                    <div className="wave-container">
                        <div className="wave"></div>
                        <div className="wave"></div>
                        <div className="wave"></div>
                    </div>
                )}
                {!apiLoading && (
                    <p className="mt-4">
                        {isRecording ? "Listening... Click to stop" : "Click to start speaking"}
                    </p>
                )}
                {audioUrl && !isRecording && (
                    <div className="mt-4 d-flex justify-content-center align-items-center">
                        <Button
                            variant="outline-light"
                            className="rounded-circle play-button me-3"
                            onClick={togglePlayPause}
                        >
                            <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} size="2x" />
                        </Button>
                        <span className="play-text">{isPlaying ? "Playing" : "Play Recording"}</span>
                        <Button
                            variant="outline-info"
                            className="rounded-circle send-button ms-4"
                            onClick={sendAudioToAPI}
                        >
                            <FontAwesomeIcon icon={faPaperPlane} size="2x" />
                        </Button>
                    </div>
                )}


            </div>


            {apiLoading && (<p className="mt-4">Thinking...</p>)}

            {(isPlayingResponse || isPausedResponse) && (
                <>
                    <SpeakingFace isRunning={isPlayingResponse} />
                    <div className="mt-4 d-flex flex-column align-items-center">
                        <Button
                            variant="outline-light"
                            className="rounded-circle play-button mb-2"
                            onClick={toggleResponsePlayPause}
                        >
                            <FontAwesomeIcon icon={isPlayingResponse ? faPause : faPlay} size="2x" />
                        </Button>
                        <span className="play-text">
                            {isPlayingResponse ? "Pause Response" : "Resume Response"}
                        </span>
                        {/*{isPlayingResponse && (*/}
                        {/*    // <div className="mt-2 playing-animation">*/}
                        {/*    //     <div className="bar"></div>*/}
                        {/*    //     <div className="bar"></div>*/}
                        {/*    //     <div className="bar"></div>*/}
                        {/*    //     <div className="bar"></div>*/}
                        {/*    //     <div className="bar"></div>*/}
                        {/*    // </div>*/}
                        {/*    */}
                        {/*)}*/}

                    </div>
                </>

            )}

        </Container>
    );
};

export default VoiceAssistant;
