import React, { useEffect, useRef, useState } from 'react';
import { Image, BackHandler, View, Text, TextInput, Pressable, FlatList, StyleSheet, Linking } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPaperPlane, faPaperclip, faImage, faVideo, faPhone } from '@fortawesome/free-solid-svg-icons';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, collection, query, where, orderBy, onSnapshot, addDoc, Timestamp, getDoc } from 'firebase/firestore';
import { getStorage, uploadBytes, getDownloadURL, ref as sRef } from 'firebase/storage';
import { useFonts, TitilliumWeb_400Regular, TitilliumWeb_600SemiBold } from '@expo-google-fonts/titillium-web';
import * as ScreenCapture from "expo-screen-capture";
import { app } from '../firebaseConfig';
import { Avatar, Divider } from 'react-native-elements';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { RSA } from 'react-native-rsa-native';
import { getPushTokenForUser, sendPushNotification } from './Notifications';
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import CryptoJS from 'react-native-crypto-js';

const GroupChatScreen = ({ route, navigation }) => {
  const isFocused = useIsFocused();
  const { groupId, groupName, photoURL } = route.params; // Pass groupId and groupName through route params
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const flatlistRef = useRef(null);
  const [aesKey, setAesKey] = useState('');

  useEffect(() => {
    const activateScreenCapture = async () => {
      await ScreenCapture.preventScreenCaptureAsync();
    };
    const deactivateScreenCapture = async () => {
      await ScreenCapture.allowScreenCaptureAsync();
    };

    if (isFocused) {
      activateScreenCapture();
    } else {
      deactivateScreenCapture();
    }
  }, [isFocused]);

  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        // <Avatar rounded title={groupName[0]} size={40} containerStyle={{
        //   backgroundColor: getRandomColor(),
        //   marginRight: 15,
        // }} />
        <Avatar
          rounded
          source={photoURL ? { uri: photoURL } : null}
          title={groupName[0]}
          size={40}
          containerStyle={{
            backgroundColor: photoURL ? 'transparent' : getRandomColor(),
            marginRight: 15,
          }}
        />
      ),
      headerTitle: groupName,
      headerBackVisible: false,
    })
  }, [navigation, groupName, photoURL]);

  useEffect(() => {
    const backAction = () => {
      navigation.navigate("GroupChats");
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const fetchMessagesWithUsernames = async () => {
      const messagesRef = collection(firestore, 'groups', groupId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'));

      const groupDoc = await getDoc(doc(firestore, 'groups', groupId));

      const encryptedAesKey = groupDoc.data().encryptedKeys[auth.currentUser.uid];
      console.log('Encrypted AES key:', encryptedAesKey);
      const privateKey = await SecureStore.getItemAsync('privateKey');
      console.log('Private key:', privateKey);
      const aesKey = await RSA.decrypt(encryptedAesKey, privateKey);
      console.log('AES key:', aesKey);
      setAesKey(aesKey);

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const messagesList = await Promise.all(snapshot.docs.map(async (msgDoc) => {
          const messageData = msgDoc.data();
          const userRef = doc(firestore, 'users', messageData.senderId);
          const userSnap = await getDoc(userRef);
          const username = userSnap.data().username;

          const decryptedTextBytes = CryptoJS.AES.decrypt(messageData.text, aesKey);
          console.log('Decrypted text bytes:', decryptedTextBytes);
          const decryptedText = decryptedTextBytes.toString(CryptoJS.enc.Utf8);
          console.log('Decrypted text:', decryptedText);
          console.log('Decryption successful');

          return {
            id: msgDoc.id,
            ...messageData,
            text: decryptedText,
            username: username,
          }
        }));
        setMessages(messagesList);
        flatlistRef.current?.scrollToEnd({ animated: true });
      });

      return () => unsubscribe();
    }
    fetchMessagesWithUsernames();
  }, [groupId]);

  const sendMessage = async (messageData = {}) => {
    if (!messageText.trim() && !messageData.file) return;

    try {
      const userRef = doc(firestore, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.error('User not found');
        return;
      }

      const username = userSnap.data().username;

      const groupDoc = await getDoc(doc(firestore, 'groups', groupId));

      const groupData = groupDoc.data();
      const encryptedAesKey = groupDoc.data().encryptedKeys[auth.currentUser.uid];
      console.log('Encrypted AES key:', encryptedAesKey);
      const privateKey = await SecureStore.getItemAsync('privateKey');
      console.log('Private key:', privateKey);
      const aesKey = await RSA.decrypt(encryptedAesKey, privateKey);
      console.log('AES key:', aesKey);

      const encryptedText = messageText ? CryptoJS.AES.encrypt(messageText, aesKey).toString() : "";
      console.log('Encrypted text:', encryptedText);

      const encryptedFileName = messageData.fileName ? CryptoJS.AES.encrypt(messageData.fileName, aesKey).toString() : '';
      console.log('Encrypted file name:', encryptedFileName);

      const messagesRef = collection(firestore, 'groups', groupId, 'messages');
      console.log('Sending message:', encryptedText);
      console.log('Sender ID:', auth.currentUser.uid);
      console.log('Username:', username);
      console.log('Created at:', Timestamp.now());
      console.log('Message data:', messageData);

      await addDoc(messagesRef, {
        text: encryptedText,
        senderId: auth.currentUser.uid,
        username: username,
        createdAt: Timestamp.now(),
        file: messageData.file || '',
        // fileName: messageData.fileName || '',
        fileName: encryptedFileName,
        fileType: messageData.fileType || '',
      });

      const pushTokens = groupData.pushToken;
      if (pushTokens) {
        for (const memberId in pushTokens) {
          const recipientToken = pushTokens[memberId];
          if (recipientToken) {
            console.log('Sending push notification to:', memberId + " with token " + recipientToken);
            const response = await sendPushNotification(recipientToken, {
              title: `New messages in ${groupName}`,
              body: messageText || `Sent an attachment in ${groupName}`,
              data: { 
                screen: 'GroupChatScreen', 
                sender: auth.currentUser.uid, 
                groupId: groupId, 
                groupName: groupName,
              },
            });
            console.log('Push notification sent:', response);
          } else {
            console.log('No push token found for:', memberId);
          }
        }
      } else {
        console.log('No push tokens found');
      }

      setMessageText('');
      console.log('Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        const fileName = result.assets[0].fileName || 'image.jpg';

        try {
          const fileURL = await uploadFile(imageUri, "images");
          const encryptedFileURL = CryptoJS.AES.encrypt(fileURL, aesKey).toString();
          const message = {
            text: '',
            file: encryptedFileURL,
            fileName: fileName,
            fileType: 'image',
          };
          sendMessage(message);
        } catch (uploadError) {
          console.log(aesKey);
          console.error('Error uploading image:', uploadError);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  }

  const pickDocument = async () => {
    console.log('Picking document');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      console.log('Document result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const fileName = result.assets[0].name;
        console.log('Document URI:', fileUri);
        console.log('Document name:', fileName);

        try {
          const fileURL = await uploadFile(fileUri, 'documents');
          const encryptedFileURL = CryptoJS.AES.encrypt(fileURL, aesKey).toString();
          console.log('Encrypted document URL:', encryptedFileURL);
          const message = {
            text: '',
            file: encryptedFileURL,
            fileName: fileName,
            fileType: 'document',
          };
          sendMessage(message);
        } catch (uploadError) {
          console.error('Error uploading document:', uploadError);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const uploadFile = async (uri, fileType) => {
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Fetch failed with status: ${response.status}`);
      }

      const blob = await response.blob();
      const storage = getStorage(app);
      const fileRef = sRef(storage, `${fileType}/${new Date().getTime()}_${auth.currentUser.uid}`);

      await uploadBytes(fileRef, blob);
      const downloadURL = await getDownloadURL(fileRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  }

  let [fontsLoaded, fontError] = useFonts({
    TitilliumWeb_400Regular,
    TitilliumWeb_600SemiBold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4c669f', '#f0ceff']}
        style={{ flex: 1 }}
        start={[0.5, 0.5]}
      >
        <FlatList
          ref={flatlistRef}
          data={messages}
          renderItem={({ item }) => {

            let decryptedFileName = '';
            if (item.fileName) {
              try {
                decryptedFileName = CryptoJS.AES.decrypt(item.fileName, aesKey).toString(CryptoJS.enc.Utf8);
                console.log("Decrypted file name: ", decryptedFileName);
              } catch (error) {
                console.error("Decryption failed for fileName: ", error);
              }
            }

            return (
              <View style={[
                styles.messageContainer,
                item.senderId === auth.currentUser.uid ? styles.currentUserMessage : styles.otherUserMessage
              ]}>
                <Text style={{
                  fontSize: 16,
                  fontFamily: 'TitilliumWeb_400Regular',
                  alignSelf: item.senderId === auth.currentUser.uid ? 'flex-end' : 'flex-start',
                }}>{item.text}</Text>
                {item.file && (
                  item.fileType === 'image' ? (
                    <ImageComponent file={item.file} aesKey={aesKey} />
                  ) : (
                    <Text
                      style={{
                        color: "#4c669f",
                        marginVertical: 10,
                        backgroundColor: "#fff",
                        textDecorationLine: "underline",
                        border: 1,
                        borderColor: "#000",
                        borderRadius: 22,
                        paddingHorizontal: 15,
                        paddingBottom: 5,
                        paddingTop: 5,
                        fontSize: 16,
                        fontFamily: 'TitilliumWeb_400Regular',
                      }}
                      onPress={() => Linking.openURL(CryptoJS.AES.decrypt(item.file, aesKey).toString(CryptoJS.enc.Utf8))}
                    >
                      {/* {item.fileName || "View Document"} */}
                      {decryptedFileName || "View Document"}
                    </Text>
                  ))}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 5,
                  }}
                >
                  <Text style={styles.messageText}>{item.username}</Text>
                  <Divider
                    orientation="vertical"
                    width={1}
                    style={{ backgroundColor: 'grey', marginHorizontal: 3 }}
                  />
                  <Text style={styles.messageTime}>{new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
            )
          }}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatlistRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={styles.inputContainer}>
          <Pressable
            onPress={pickImage}
            style={styles.sendButton}
          >
            <FontAwesomeIcon icon={faImage} size={20} style={{ color: '#000' }} />
          </Pressable>
          <Pressable
            onPress={pickDocument}
            style={styles.sendButton}
          >
            <FontAwesomeIcon icon={faPaperclip} size={20} style={{ color: '#000' }} />
          </Pressable>
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            style={styles.input}
            placeholder="Type a message"
          />
          <Pressable onPress={sendMessage} style={styles.sendButton}>
            <FontAwesomeIcon icon={faPaperPlane} size={20} style={{ color: '#000' }} />
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
};

const ImageComponent = ({ file, aesKey }) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const MAX_WIDTH = 300;
  const MAX_HEIGHT = 300;

  const decryptedUri = CryptoJS.AES.decrypt(file, aesKey).toString(CryptoJS.enc.Utf8);

  useEffect(() => {
    Image.getSize(decryptedUri, (width, height) => {
      let newWidth = width;
      let newHeight = height;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const aspectRatio = width / height;

        if (width > height) {
          newWidth = MAX_WIDTH;
          newHeight = MAX_WIDTH / aspectRatio;
        } else {
          newHeight = MAX_HEIGHT;
          newWidth = MAX_HEIGHT * aspectRatio;
        }

      }
      setDimensions({ width: newWidth, height: newHeight });
    });
  }, [decryptedUri]);

  return (
    <Image
      source={{ uri: decryptedUri }}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        // marginVertical: 10,
        borderRadius: 10,
      }}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  groupName: {
    fontSize: 20,
    fontFamily: 'TitilliumWeb_600SemiBold',
    textAlign: 'center',
    marginVertical: 10,
  },
  messagesList: {
    flex: 1,
  },
  messageContainer: {
    flexDirection: 'column',
    marginVertical: 5,
    marginHorizontal: 10,
    padding: 10,
    borderRadius: 20,
  },
  messageText: {
    color: '#666',
    fontSize: 12.5,
    fontFamily: 'TitilliumWeb_400Regular',
  },
  messageTime: {
    fontSize: 12,
    fontFamily: 'TitilliumWeb_400Regular',
    textAlign: 'right',
    color: 'grey',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    backgroundColor: '#fff',
    borderColor: '#ddd',
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  input: {
    flex: 1,
    padding: 5,
    borderWidth: 0.5,
    borderColor: '#ccc',
    borderRadius: 5,
    fontFamily: 'TitilliumWeb_400Regular',
  },
  sendButton: {
    padding: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderRadius: 5,
    marginLeft: 5,
    marginRight: 5,
    marginVertical: 5,
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#dcf8c6',
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
});

export default GroupChatScreen;
