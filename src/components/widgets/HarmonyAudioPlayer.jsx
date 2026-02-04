import React from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import './HarmonyAudioPlayer.css'

const HarmonyAudioPlayer = ({ src }) => {
    return (
        <div className="w-full">
            <AudioPlayer
                src={src}
                // Styling is handled in HarmonyAudioPlayer.css with theme-aware classes
                style={{
                    borderRadius: '0',
                }}
                layout="horizontal"
                showJumpControls={false}
                customAdditionalControls={[]}
                customVolumeControls={[]}
            />
        </div>
    );
};

export default HarmonyAudioPlayer;
