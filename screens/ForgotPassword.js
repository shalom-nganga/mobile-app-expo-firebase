import React, { useEffect, useState } from "react";
import {
  Alert,
  BackHandler,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFonts, TitilliumWeb_400Regular, TitilliumWeb_600SemiBold } from '@expo-google-fonts/titillium-web';
import { useNavigation } from "@react-navigation/native";
import { app } from "../firebaseConfig";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { LinearGradient } from 'expo-linear-gradient';

function ForgotPassword() {
  const auth = getAuth(app);
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [isEmailsent, setIsEmailsent] = useState("Send Email");

  const handdleForgotPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, email);
      setIsEmailsent(true);
      Alert.alert(
        "PASSWORD RESET",
        "A password reset email has been sent to your email address."
      );
    } catch (error) {
      const errorsCode = error.code;
      const errorsMessage = error.message;

      switch (errorsCode) {
        case "auth/missing-email":
          Alert.alert("Forgot Password", "Input email for password reset.");
          break;
        case "auth/user-not-found":
          Alert.alert("Forgot Password", "User not found.");
          break;
        case "auth/invalid-email":
          Alert.alert("Forgot Password", "The email address is not valid.");
          break;
        default:
          Alert.alert(
            "Forgot Password",
            `Account creation error: ${errorsMessage} (Error Code: ${errorsCode})`
          );
          break;
      }
    }
  };

  useEffect(() => {
    const backAction = () => {
      navigation.navigate("Login");
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, []);

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
        style={
          styles.linearg
        }
        start={[0.5, 0.5]}
      >
        <View style={styles.content}>
          <Text
            style={{
              fontFamily: "TitilliumWeb_400Regular",
              fontSize: 15,
              marginTop: 50,
              marginBottom: 10,
              padding: 10,
              color: "#fff",
              lineHeight: 25,
            }}
          >
            Enter your email address below and we'll send you a link to reset your
            password.
          </Text>
          <TextInput
            style={{
              height: 40,
              width: 300,
              fontFamily: "TitilliumWeb_400Regular",
              borderColor: "gray",
              borderWidth: 1,
              borderRadius: 10,
              padding: 10,
              backgroundColor: "#fff",
              marginTop: 10,
              marginBottom: 10,
            }}
            placeholder="Email"
            placeholderTextColor={"#999"}
            onChangeText={(text) => setEmail(text)}
          />
          <TouchableOpacity
            onPress={handdleForgotPassword}
            style={{
              backgroundColor: "#000",
              borderWidth: 1,
              borderColor: "#ffffff",
              paddingLeft: 10,
              paddingRight: 10,
              borderRadius: 10,
              marginTop: 10,
              marginBottom: 10,
              opacity: isEmailsent ? 1 : 0.5,
            }}
            disabled={!isEmailsent}
          >
            <Text
              style={{
                fontFamily: "TitilliumWeb_600SemiBold",
                fontSize: 20,
                marginTop: 10,
                marginBottom: 10,
                padding: 5,
                color: "#fff",
              }}
            >
              {isEmailsent ? "Send" : "Sent"}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  linearg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
  },
  content: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
});
export default ForgotPassword;