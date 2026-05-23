import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/RoomJoin.css';

const RoomJoin = ({ onJoinRoom, onCreateRoom }) => {
    const { profile } = useAuth();
    const [roomId, setRoomId] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (isCreating) {
            onCreateRoom();
        } else {
            const finalRoomId = roomId.trim();
            if (!finalRoomId) {
                alert('Please enter a Room ID to join');
                return;
            }
            console.log('Joining room:', { roomId: finalRoomId });
            onJoinRoom(finalRoomId);
        }
    };

    return (
        <div className="room-join-container">
            <div className="room-join-card">
                <h2>{isCreating ? 'Create Room' : 'Join Room'}</h2>
                {profile ? (
                    <p className="room-join-signed-in">
                        Signed in as <strong>{profile.displayName}</strong>
                    </p>
                ) : null}
                <form onSubmit={handleSubmit}>
                    {!isCreating && (
                        <div className="input-group">
                            <label htmlFor="room-id">Room ID</label>
                            <input
                                id="room-id"
                                type="text"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                placeholder="Enter Room ID"
                                required={!isCreating}
                            />
                        </div>
                    )}
                    <button type="submit" className="brutalist-button">
                        {isCreating ? 'Create Room' : 'Join Room'}
                    </button>
                </form>
                <button 
                    className="toggle-mode brutalist-button" 
                    onClick={() => setIsCreating(!isCreating)}
                >
                    {isCreating ? 'Join Existing Room' : 'Create New Room'}
                </button>
            </div>
        </div>
    );
};

export default RoomJoin; 