import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Image, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { RTCView, mediaDevices, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import io from 'socket.io-client';
import { app } from '../firebaseConfig';
import { getFirestore, addDoc, collection } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPhoneSlash, faPhone, faSync, faMicrophone, faMicrophoneSlash, faVideo, faVideoSlash } from '@fortawesome/free-solid-svg-icons';
import { sendVideoCallNotification, getPushTokenForUser } from './Notifications';
import { useFocusEffect } from '@react-navigation/native';

const VideoCallScreen = ({ route, navigation }) => {
  const { user, profilePicture, callerInfo } = route.params;
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [callStarted, setCallStarted] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isUsingFrontCamera, setIsUsingFrontCamera] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isCameraOff, setIcCameraOff] = useState(false);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const firestore = getFirestore(app);

  useFocusEffect(
    useCallback(() => {
      if (callerInfo) {
        initializeSocket();
      }
    }, [callerInfo])
  );

  const AnimatedPressable = ({ onPress, style, children }) => {
    const animatedScale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(animatedScale, {
        toValue: 0.9,
        useNativeDriver: true,
      }).start();
    }

    const handlePressOut = () => {
      Animated.spring(animatedScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }).start();

    }
    return (
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <Animated.View style={[style, { transform: [{ scale: animatedScale }] }]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  }

  const initializeSocket = () => {
    const socket = io('https://soc-thesis.onrender.com'); //! Change this to your server URL
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to signaling server');
      setIsConnected(true);
    });

    socket.on('offer', async (offer) => {
      console.log('Received offer:', offer);
      if (!pcRef.current) {
        pcRef.current = createPeerConnection();
      }
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('answer', answer);
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    socket.on('answer', async (answer) => {
      console.log('Received answer:', answer);
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error('Error setting remote description:', error);
        }
      }
    });

    socket.on('ice-candidate', async (candidate) => {
      console.log('Received ICE candidate:', candidate);
      if (pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  };

  // useEffect(() => {
  //   initializeSocket();
  // }, []);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        //? Google's public STUN server
        {
          urls: 'stun:stun.l.google.com:19302'
        },
        //? Metered TURN server
        {
          urls: "turn:asia.relay.metered.ca:80",
          username: "c1a44fd70f84e2d8ef05b4ac",
          credential: "XO88wG9Y0hTvj0XD",
        },
        {
          urls: "turn:asia.relay.metered.ca:80?transport=tcp",
          username: "c1a44fd70f84e2d8ef05b4ac",
          credential: "XO88wG9Y0hTvj0XD",
        },
        {
          urls: "turn:asia.relay.metered.ca:443",
          username: "c1a44fd70f84e2d8ef05b4ac",
          credential: "XO88wG9Y0hTvj0XD",
        },
        {
          urls: "turns:asia.relay.metered.ca:443?transport=tcp",
          username: "c1a44fd70f84e2d8ef05b4ac",
          credential: "XO88wG9Y0hTvj0XD",
        },
        //? Express TURN server
        // {
        //   urls: "turn:relay1.expressturn.com:3478",
        //   username: "efTZHTNKL6IGGB989F",
        //   credential: "m6nSI98eCzbyLtnL",
        // },
      ],
      //? Xirsys TURN & STUN server
      // iceServers: [{
      //   urls: ["stun:hk-turn1.xirsys.com"]
      // }, {
      //   username: "bGHJYjqlmBUTCMW8ozG0CX53OGOdiBlM2Lp5LCxKQyE-jqN8z53w1Z5Ba1PcVwRRAAAAAGeEc8JodW50ZXJ4eGlp",
      //   credential: "2d0185fa-d152-11ef-91de-0242ac120004",
      //   urls: [
      //     "turn:hk-turn1.xirsys.com:80?transport=udp",
      //     "turn:hk-turn1.xirsys.com:3478?transport=udp",
      //     "turn:hk-turn1.xirsys.com:80?transport=tcp",
      //     "turn:hk-turn1.xirsys.com:3478?transport=tcp",
      //     "turns:hk-turn1.xirsys.com:443?transport=tcp",
      //     "turns:hk-turn1.xirsys.com:5349?transport=tcp"
      //   ]
      // }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state changed:', pc.connectionState);
      if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        console.log('Peer connection is closed');
        endCall();
      }
    };

    return pc;
  };

  const startLocalStream = async () => {
    if (!socketRef.current) {
      initializeSocket();
    }

    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: isUsingFrontCamera ? 'user' : 'environment',
        },
      });
      setLocalStream(stream);
      if (!pcRef.current) {
        pcRef.current = createPeerConnection();
      }
      stream.getTracks().forEach(track => {
        pcRef.current.addTrack(track, stream);
      });
      setCallStarted(true);
      await saveCallDetails();

      const recipientPushToken = await getPushTokenForUser(user.uid);
      if (recipientPushToken) {
        await sendVideoCallNotification(recipientPushToken, user);
      }
    } catch (error) {
      console.error('Error starting local stream:', error);
    }
  };

  const saveCallDetails = async () => {
    try {
      const callDetails = {
        username: user.username,
        profilePicture: user.profilePicture,
        timestamp: new Date(),
        uid: user.uid,
      };
      await addDoc(collection(firestore, 'calls'), callDetails);
    } catch (error) {
      console.error('Error saving call details:', error);
    }
  };

  const createOffer = async () => {
    if (!pcRef.current || pcRef.current.connectionState === 'closed') {
      console.warn('Peer connection is not available or closed');
      return;
    }

    if (!socketRef.current) {
      console.warn('Socket connection is not available');
      return;
    }

    try {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      socketRef.current.emit('offer', offer);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const endCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
    setCallStarted(false);
    setIsMicOn(true);
    setIsUsingFrontCamera(true);
    setIsCameraOn(true);
    setIcCameraOff(false);
  };

  useEffect(() => {
    return () => {
      endCall();
    }
  }, []);

  const toggleMicrophone = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMicOn(track.enabled);
      });
    }
  };

  const toggleCameraOnOff = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsCameraOn(track.enabled);
        setIcCameraOff(!track.enabled);
        console.log('Camera is on:', track.enabled);
        if (socketRef.current) {
          socketRef.current.emit('toggle-camera', { isCameraOn: track.enabled });
        }
      });
    }
  };

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on('toggle-camera', ({ isCameraOn }) => {
        console.log('Received camera toggle:', isCameraOn);
        setIsCameraOn(isCameraOn);
        setIcCameraOff(!isCameraOn);
      })
    }
  }, []);

  const switchCamera = async () => {
    setIsUsingFrontCamera(prevState => !prevState);
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: isUsingFrontCamera ? 'user' : 'environment',
        },
      });
      setLocalStream(stream);

      if (pcRef.current) {
        const videoTrack = stream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        } else {
          pcRef.current.addTrack(videoTrack, stream);
        }
      }
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  return (
    <View style={styles.container}>
      {localStream && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.rtcView}
          objectFit="cover"
        />
      )}
      {isCameraOff && (
        <View style={styles.blackScreen} />
      )}
      {remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.rtcView}
          objectFit="cover"
        />
      )}
      {isCameraOff && (
        <View style={styles.blackScreen} />
      )}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 20,
        width: '70%',
      }}>
        {!callStarted ? (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 50,
            }}
          >
            <Image
              source={{ uri: profilePicture }}
              style={{
                width: 150,
                height: 150,
                borderRadius: 75,
                marginBottom: 10,
              }}
            />
            <Pressable style={styles.button} onPress={startLocalStream}>
              <Text style={styles.buttonText}>Start Call</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <AnimatedPressable style={{
              ...styles.button,
              backgroundColor: isMicOn ? '#fff' : '#f44336',
              marginRight: 20,
            }}
              onPress={toggleMicrophone}
            >
              <FontAwesomeIcon icon={isMicOn ? faMicrophone : faMicrophoneSlash} size={35} color={isMicOn ? '#f44336' : "#fff"} />
            </AnimatedPressable>
            <AnimatedPressable style={{
              ...styles.button,
              backgroundColor: '#fff',
              marginRight: 20,
            }} onPress={createOffer}>
              <FontAwesomeIcon icon={faPhone} size={35} color="#00ff66" />
            </AnimatedPressable>
            <AnimatedPressable style={{
              ...styles.button,
              backgroundColor: '#fff',
              marginRight: 20,
            }} onPress={endCall}>
              <FontAwesomeIcon icon={faPhoneSlash} size={35} color="#f44336" />
            </AnimatedPressable>
            <AnimatedPressable style={{
              ...styles.button,
              backgroundColor: isCameraOn ? '#fff' : '#f44336',
              marginRight: 20,
            }}
              onPress={toggleCameraOnOff}
            >
              <FontAwesomeIcon icon={isCameraOn ? faVideo : faVideoSlash} size={35} color={isCameraOn ? "#f44336" : "#fff"} />
            </AnimatedPressable>
            <AnimatedPressable style={{
              ...styles.button,
              backgroundColor: '#fff',
            }} onPress={switchCamera}>
              <FontAwesomeIcon icon={faSync} size={35} color="#f44336" />
            </AnimatedPressable>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#4c669f',
    position: 'relative',
  },
  rtcView: {
    width: '100%',
    height: '43%',
    backgroundColor: '#000',
    zIndex: 0,
  },
  blackScreen: {
    position: 'absolute',
    width: '100%',
    height: '43%',
    backgroundColor: '#000',
    zIndex: 1,
  },
  buttonContainer: {
    margin: 10,
  },
  button: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#f0ceff',
    marginTop: 10,
  },
  buttonText: {
    color: '#000',
    fontSize: 20,
    fontFamily: 'TitilliumWeb_600SemiBold',
  },
});

export default VideoCallScreen;