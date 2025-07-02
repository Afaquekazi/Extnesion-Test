// firebase-init.js

// Initialize Firebase only once
let firebaseInitialized = false;

function initializeFirebase() {
 if (firebaseInitialized) return;
 
 const firebaseConfig = {
  apiKey: "AIzaSyC0FQVDM18zv87yGHURd9HpOZkSjT4zBSg",
  authDomain: "solthron.firebaseapp.com",
  projectId: "solthron",
  storageBucket: "solthron.firebasestorage.app",
  messagingSenderId: "1039667200648",
  appId: "1:1039667200648:web:200da50ffeae7f9601d53d"
}
 
 // Initialize Firebase if not already initialized
 if (!firebase.apps.length) {
   firebase.initializeApp(firebaseConfig);
 }
 
 firebaseInitialized = true;
 console.log("Firebase initialized successfully");
}

// Initialize immediately
try {
 initializeFirebase();
} catch (error) {
 console.error("Firebase initialization error:", error);
}

// Credit system functions
async function deductCredits(creditsToDeduct = 3) {
 // Make sure Firebase is initialized
 if (!firebaseInitialized) {
   try {
     initializeFirebase();
   } catch (error) {
     console.error("Firebase initialization error:", error);
     return { success: false, message: "Authentication service unavailable" };
   }
 }
 
 // Check user auth
 const currentUser = firebase.auth().currentUser;
 if (!currentUser) {
   console.log("No user logged in");
   return { success: false, message: "Not logged in" };
 }
 
 const userId = currentUser.uid;
 const userRef = firebase.firestore().collection('users').doc(userId);
 
 try {
   const result = await firebase.firestore().runTransaction(async (transaction) => {
     const userDoc = await transaction.get(userRef);
     
     if (!userDoc.exists) {
       console.log("User document not found");
       return { success: false, message: "User account not found" };
     }
     
     const userData = userDoc.data();
     const currentCredits = userData?.credits || 0;
     console.log("Current credits:", currentCredits);
     
     if (currentCredits < creditsToDeduct) {
       console.log("Insufficient credits:", currentCredits);
       return { success: false, message: "Insufficient credits" };
     }
     
     // Deduct credits
     transaction.update(userRef, {
       credits: currentCredits - creditsToDeduct,
       lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
     });
     
     console.log("Credits deducted successfully");
     return { 
       success: true, 
       remaining: currentCredits - creditsToDeduct 
     };
   });
   
   return result;
 } catch (error) {
   console.error("Credit deduction error:", error);
   return { success: false, message: error.message };
 }
}

async function getUserCredits() {
 // Make sure Firebase is initialized
 if (!firebaseInitialized) {
   try {
     initializeFirebase();
   } catch (error) {
     console.error("Firebase initialization error:", error);
     return 0;
   }
 }
 
 const currentUser = firebase.auth().currentUser;
 if (!currentUser) return 0;
 
 try {
   const userId = currentUser.uid;
   const userDoc = await firebase.firestore().collection('users').doc(userId).get();
   
   if (!userDoc.exists) return 0;
   return userDoc.data()?.credits || 0;
 } catch (error) {
   console.error("Error getting user credits:", error);
   return 0;
 }
}

// Auth functions
function loginWithGoogle() {
 // Make sure Firebase is initialized
 if (!firebaseInitialized) {
   try {
     initializeFirebase();
   } catch (error) {
     console.error("Firebase initialization error:", error);
     return Promise.reject(error);
   }
 }
 
 const provider = new firebase.auth.GoogleAuthProvider();
 return firebase.auth().signInWithPopup(provider);
}

function logout() {
 // Make sure Firebase is initialized
 if (!firebaseInitialized) {
   try {
     initializeFirebase();
   } catch (error) {
     console.error("Firebase initialization error:", error);
     return Promise.reject(error);
   }
 }
 
 return firebase.auth().signOut();
}

// Export functions for use in other modules
window.solthronFirebase = {
 initializeFirebase,
 deductCredits,
 getUserCredits,
 loginWithGoogle,
 logout
};
