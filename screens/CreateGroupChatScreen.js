import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, View, Text, TextInput, Pressable, FlatList, StyleSheet, ToastAndroid } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, TitilliumWeb_400Regular, TitilliumWeb_600SemiBold } from '@expo-google-fonts/titillium-web';
import { SearchBar } from '@rneui/themed';
import { Avatar, Button } from 'react-native-elements';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { app } from '../firebaseConfig';
import { RSA } from 'react-native-rsa-native';
import CryptoJS from 'react-native-crypto-js';
import * as ImagePicker from 'expo-image-picker';
import { getPushTokenForUser } from './Notifications';

const Item = ({ user, onPress, isSelected }) => (
  <Pressable
    onPress={() => onPress(user)}
  >
    <View
      onPress={() => onPress(user)}
      style={
        {
          backgroundColor: isSelected ? '#fff' : 'transparent',
          borderColor: '#fff',
          borderWidth: 2,
          paddingHorizontal: 10,
          paddingVertical: 5,
          marginVertical: 10,
          marginHorizontal: 10,
          borderRadius: 10,
        }
      }
    >
      <View style={{
        flexDirection: 'row',
        paddingVertical: 2.5,
        paddingHorizontal: 5,
      }}>
        <View>
          <Avatar size={48} rounded source={user.profilePicture ? { uri: user.profilePicture } : require('../assets/profilepic.jpg')} />
        </View>
        <View>
          <Text style={{
            fontFamily: isSelected ? 'TitilliumWeb_400Regular' : 'TitilliumWeb_600SemiBold',
            fontSize: 20,
            paddingLeft: 10,
            paddingVertical: 10,
            textAlignVertical: 'center',
            color: isSelected ? '#000' : '#fff',
          }}>{user.username}</Text>
        </View>
      </View>
    </View>
  </Pressable>
);

const CreateGroupScreen = ({ navigation }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [showCreateButton, setShowCreateButton] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [profilePicture, setProfilePicture] = useState('');
  const [groupPhotoUri, setGroupPhotoUri] = useState('');
  const auth = getAuth(app);
  const [users, setUsers] = useState([]); // Fetch the list of users from Firestore

  const firestore = getFirestore(app);

  const createGroup = async () => {
    if (!groupName || selectedUsers.length === 0) {
      ToastAndroid.show('Group name and participants are required!', ToastAndroid.SHORT);
      console.log('Photo selected:', result.uri); // Add this line to check if the photo is selected
      return; // Handle validation
    }

    let photoURL = '';
    if (groupPhotoUri) {
      // ToastAndroid.show('Uploading photo...', ToastAndroid.SHORT); // ADDED
      setIsLoading(true);
      const filename = groupPhotoUri.substring(groupPhotoUri.lastIndexOf('/') + 1);
      const response = await fetch(groupPhotoUri);
      const blob = await response.blob();

      const storage = getStorage(app);
      const storageRef = ref(storage, `group-photos/${filename}`);

      try {
        await uploadBytes(storageRef, blob);
        photoURL = await getDownloadURL(storageRef);
        console.log('Photo uploaded:', photoURL); // Add this line to check if the photo is uploaded
        ToastAndroid.show('Photo uploaded successfully!', ToastAndroid.SHORT);
      } catch (e) {
        console.error('Error uploading photo: ', e);

        ToastAndroid.show('Error uploading photo!', ToastAndroid.SHORT);
      } finally {
        setIsLoading(false);
      }
    }

    try {
      const aesKey = CryptoJS.lib.WordArray.random(16).toString();
      const encryptedKeys = {};
      const pushTokens = {};

      for (const userId of selectedUsers) {
        const userDoc = await getDoc(doc(firestore, "users", userId));
        const publicKey = userDoc.data().publicKey;
        const encryptedAesKey = await RSA.encrypt(aesKey, publicKey);
        encryptedKeys[userId] = encryptedAesKey;

        const pushToken = await getPushTokenForUser(userId);
        if (pushToken) {
          pushTokens[userId] = pushToken;
        }
      }

      const groupDocRef = await addDoc(collection(firestore, 'groups'), {
        name: groupName,
        participants: selectedUsers,
        createdAt: new Date(),
        photoURL: photoURL,
        encryptedKeys: encryptedKeys,
        pushToken: pushTokens,
      });
      
      navigation.navigate('GroupChats', { groupId: groupDocRef.id, groupName, photoURL }); // Navigate to the chat screen or group chat list
    } catch (error) {
      console.error('Error creating group:', error);
      ToastAndroid.show('Error creating group!', ToastAndroid.SHORT);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersCollection = collection(firestore, 'users');
      const userSnapshot = await getDocs(usersCollection);
      const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
      setFilteredUsers(userList);
    } catch (error) {
      console.error('Error fetching users: ', error);
    }
  };

  const fetchProfilePicture = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userDoc);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setProfilePicture(userData.profilePicture || '')
        } else {
          console.log('No such document!');
        }
      }
    } catch (error) {
      console.error('Error fetching profile picture: ', error);
    }
  };

  useEffect(() => {
    setShowCreateButton(groupName.length > 0);
  }, [groupName]);

  useEffect(() => {
    fetchProfilePicture();
    fetchUsers();
    const backAction = () => {
      navigation.navigate("SearchChat");
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    setFilteredUsers(
      users.filter(user => user.username.toLowerCase().includes(userInput.toLowerCase()))
    );
  }, [userInput, users]);

  const handleUserPress = (user) => {
    if (selectedUsers.includes(user.id)) {
      setSelectedUsers(selectedUsers.filter(id => id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user.id]);
    }
  };

  const uploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.error('Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    })

    console.log(result);

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      console.log('Photo selected:', uri); // Add this line to check if the photo is selected
      setGroupPhotoUri(uri);
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
        style={styles.linearGradient}
        start={[0.5, 0.5]}
      >
        <View style={styles.content}>
          <View>
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 5,
                alignItems: 'center',
              }}>
              <TextInput
                placeholder="Enter group name (required)"
                placeholderTextColor={'#fff'}
                underlineColorAndroid={'#fff'}
                value={groupName}
                onChangeText={setGroupName}
                style={{
                  flex: 1,
                  fontFamily: 'TitilliumWeb_400Regular',
                  fontSize: 16,
                  padding: 10,
                  borderRadius: 5,
                  marginBottom: 10,
                  marginRight: 10,
                  marginVertical: 10,
                }}
                cursorColor={'#fff'}
                color={'#fff'}
                autoCapitalize={'words'}
                autoFocus={true}
              />
              <Pressable
                onPress={uploadPhoto}
              >
                {({ pressed }) => (
                  <Text style={{
                    fontFamily: 'TitilliumWeb_600SemiBold',
                    fontSize: 14,
                    backgroundColor: pressed ? "#005f99" : "#007acc",
                    color: '#fff',
                    textAlign: 'center',
                    padding: 13,
                    borderRadius: 5,
                  }}>Upload Group Photo</Text>
                )}
              </Pressable>
            </View>
            {showCreateButton && (
              <Pressable
                onPress={createGroup}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#f0ceff' : '#fff',
                  borderRadius: 5,
                  marginHorizontal: 10,
                })}>
                {isLoading ? (
                  <ActivityIndicator size="large" color="#000"  style={{ padding: 10 }} />
                ) : (
                  <Text
                    style={{
                      fontFamily: 'TitilliumWeb_600SemiBold',
                      fontSize: 14,
                      color: '#000',
                      padding: 13,
                      borderRadius: 5,
                      textAlign: 'center',
                    }}>Create Group</Text>
                )}
              </Pressable>
            )}
          </View>
          <SearchBar
            round={true}
            platform='default'
            searchIcon={{ size: 24 }}
            placeholder=" Search"
            onChangeText={(text) => setUserInput(text)}
            value={userInput}
            containerStyle={{
              backgroundColor: 'transparent',
              borderBottomWidth: 0,
              borderTopWidth: 0,
            }}
            inputStyle={{
              color: '#fff',
              fontFamily: 'TitilliumWeb_400Regular',
            }}
            underlineColorAndroid={'transparent'}
            cursorColor={'#fff'}
          />
          {filteredUsers.length === 0 ? (
            <View style={{
              flex: 1,
              marginTop: 125,
            }}>
              <Text style={styles.temp_text}>No Results Available. </Text>
            </View>
          ) : (
            <FlatList
              showsVerticalScrollIndicator={false}
              data={filteredUsers}
              renderItem={({ item }) => <Item
                user={item}
                onPress={handleUserPress}
                isSelected={selectedUsers.includes(item.id)}
              />}
              keyExtractor={item => item.id}
              style={{ marginTop: 10, paddingBottom: 10 }}
            />
          )}
          {/* <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => setSelectedUsers([...selectedUsers, item.id])}>
                <Text>{item.username}</Text>
              </TouchableOpacity>
            )}
          /> */}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 0,
    padding: 10,
  },
  linearGradient: {
    flex: 1,
  },
  temp_text: {
    fontFamily: 'TitilliumWeb_600SemiBold',
    fontSize: 25,
    color: '#fff',
    textAlign: 'center',
  },
  loadingIndicator: {
    position: 'absolute',
    top: "50%",
    left: "50%",
    transform: [{ translateX: -25 }, { translateY: -25 }],
  },
});

export default CreateGroupScreen;
