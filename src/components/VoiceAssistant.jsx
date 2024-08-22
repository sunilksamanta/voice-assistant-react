import { useState, useRef, useCallback, useEffect } from 'react';
import { Container, Button, Alert, Modal } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faStop, faPlay, faPause, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';

const VoiceAssistant = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState(null);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);
    const streamRef = useRef(null);
    const audioRef = useRef(new Audio());

    const requestPermission = async () => {
        setShowPermissionModal(true);
    };

    const handlePermissionResponse = async (granted) => {
        setShowPermissionModal(false);
        if (granted) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
                setPermissionGranted(true);
            } catch (err) {
                setError("Failed to access the microphone. Please check your browser settings.");
            }
        } else {
            setError("Microphone access is required to use the voice assistant.");
        }
    };

    const startRecording = useCallback(() => {
        if (!streamRef.current) {
            setError("No active audio stream. Please grant permission first.");
            return;
        }

        audioChunks.current = [];
        mediaRecorder.current = new MediaRecorder(streamRef.current);

        mediaRecorder.current.ondataavailable = (event) => {
            audioChunks.current.push(event.data);
        };

        mediaRecorder.current.onstop = () => {
            const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            setAudioUrl(audioUrl);
            setIsRecording(false);
        };

        mediaRecorder.current.start();
        setIsRecording(true);
        setError(null);
        setAudioUrl(null); // Remove the previous audio when starting a new recording
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.stop();
        }
    }, [isRecording]);

    const sendAudioToAPI = async () => {
        if (!audioUrl) {
            setError("No audio recorded. Please record audio before sending.");
            return;
        }

        const response = await fetch(audioUrl);
        const audioBlob = await response.blob();
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');

        try {
            const response = await axios.post('YOUR_API_ENDPOINT', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            console.log('API response:', response.data);
            // Handle the API response here
        } catch (err) {
            setError("Failed to send audio to the API. Please try again.");
        }
    };

    const handleButtonClick = () => {
        if (isRecording) {
            stopRecording();
        } else if (permissionGranted) {
            startRecording();
        } else {
            requestPermission();
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

    useEffect(() => {
        if (audioUrl) {
            audioRef.current.src = audioUrl;
            audioRef.current.onended = () => setIsPlaying(false);
        }
    }, [audioUrl]);

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
            <p className="mt-4">
                {isRecording ? "Listening... Click to stop" : "Click to start speaking"}
            </p>

            <Modal show={showPermissionModal} onHide={() => setShowPermissionModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Microphone Permission</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>This app needs access to your microphone to record audio. Do you want to allow microphone access?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => handlePermissionResponse(false)}>
                        Deny
                    </Button>
                    <Button variant="primary" onClick={() => handlePermissionResponse(true)}>
                        Allow
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default VoiceAssistant;
