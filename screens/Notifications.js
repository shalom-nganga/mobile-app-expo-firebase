import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { app } from '../firebaseConfig';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

const firestore = getFirestore(app);

// Configure how notifications are handled
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function handleRegistrationError(errorMessage) {
  alert(errorMessage);
  throw new Error(errorMessage);
}

// Register a user for push notifications
export const registerForPushNotificationsAsync = async (userId) => {
  console.log('Registering for notifications...');
  if (!Device.isDevice) {
    console.warn('Must use a physical device for push notifications.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  // let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    console.log('Updated notification permissions status:', status);
    if (status !== 'granted') {
      handleRegistrationError('Failed to get push token for push notifications!');
      console.warn('Failed to get push token for push notifications!');
      return null;
    }
  }

  // if (finalStatus !== 'granted') {
  //   console.warn('Failed to get push token for push notifications!');
  //   return null;
  // }

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  console.log('Project ID:', projectId);
  if (!projectId) {
    handleRegistrationError('Failed to get project ID for push notifications!');
  }

  try {
    const token = (
      await Notifications.getExpoPushTokenAsync(
        {
          projectId,
        }
      )
    ).data;
    console.log("Token:", token);
    return token;
  } catch (e) {
    handleRegistrationError(`${e}`);
    console.error(e);
    throw e;
    // return null;
  }
}

// Retrieve the token for a user from Firestore
export const getPushTokenForUser = async (userId) => {
  if (!userId) {
    console.warn('User ID is required to fetch push token.');
    return null;
  }

  const userDoc = doc(firestore, 'users', userId);
  const docSnapshot = await getDoc(userDoc);

  if (docSnapshot.exists()) {
    const data = docSnapshot.data();
    return data.expoPushToken || null;
  } else {
    console.warn('No document found for the specified user ID.');
    return null;
  }
};

// Send a push notification
export const sendPushNotification = async (expoPushToken, message) => {
  if (!expoPushToken) {
    console.warn('Expo push token is required to send notifications.');
    return;
  }

  const messagePayload = {
    to: expoPushToken,
    sound: './assets/notif-sound/notif.wav',
    title: message.title || 'Notification',
    body: message.body || 'You have a new message.',
    data: message.data,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const result = await response.json();
    console.log('Push notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};

export const sendVideoCallNotification = async (expoPushToken, callerInfo) => {
  if (!expoPushToken) {
    console.warn('Expo push token is required to send notifications.');
    return;
  }

  const messagePayload = {
    to: expoPushToken,
    sound: './assets/notif-sound/notif.wav',
    title: 'Incoming Video Call',
    body: `You have an incoming video call.`,
    data: {
      type: 'videocall',
      callerInfo,
    },
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const result = await response.json();
    console.log('Push notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

export const sendAudioCallNotification = async (expoPushToken, callerInfo) => {
  if (!expoPushToken) {
    console.warn('Expo push token is required to send notifications.');
    return;
  }

  const messagePayload = {
    to: expoPushToken,
    sound: './assets/notif-sound/notif.wav',
    title: 'Incoming Audio Call',
    body: `You have an incoming audio call.`,
    data: {
      type: 'audiocall',
      callerInfo,
    },
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const result = await response.json();
    console.log('Push notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}