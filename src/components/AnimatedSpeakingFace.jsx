import { useState, useEffect } from 'react';

const SpeakingFace = ({isRunning = false}) => {
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
        console.log('isRunning:', isRunning);
        if( isRunning ) {
            const interval = setInterval(() => {
                setIsSpeaking((prev) => !prev);
            }, 100);

            return () => clearInterval(interval);
        } else {
            setIsSpeaking(false);
        }
    }, [isRunning]);

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-6">
                    <div className="face bg-light rounded-circle p-5 shadow">
                        <div className="eyes d-flex justify-content-around mb-4">
                            <div className="eye bg-dark rounded-circle"></div>
                            <div className="eye bg-dark rounded-circle"></div>
                        </div>
                        <div className={`mouth bg-danger rounded ${isSpeaking ? 'speaking' : ''}`}></div>
                    </div>
                </div>
            </div>
            {/*<div className="mt-3">*/}
            {/*    <p>This face is currently {isSpeaking ? 'speaking' : 'silent'}!</p>*/}
            {/*</div>*/}
        </div>
    );
};

export default SpeakingFace;
