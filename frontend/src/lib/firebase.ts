import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "interview-os-c9ba6.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "interview-os-c9ba6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "interview-os-c9ba6.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1092085262832",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1092085262832:web:2901ff54b443ca654ed535"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);

export async function uploadResumeToFirebaseStorage(file: File, userId: string, resumeHash: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const storagePath = `resumes/${userId}/${resumeHash}.${ext}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    console.log("[InterviewOS Firebase] Resume binary uploaded to Firebase Storage:", storagePath);
    return downloadUrl;
  } catch (err: any) {
    console.info("[InterviewOS Firebase] Storage upload note:", err?.message || err);
    return null;
  }
}

export async function saveResumeToFirestore(profileData: any) {
  try {
    const docId = profileData.resumeHash || profileData.profileId || profileData.id || `resume_${Date.now()}`;
    const docRef = doc(db, "resumes", docId);
    await setDoc(docRef, {
      ...profileData,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log("[InterviewOS Firebase] Resume profile saved to Cloud Firestore:", docId);
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('permission-denied')) {
      console.info("[InterviewOS Firebase] Cloud Firestore security rule note: Update database rules in Firebase Console to 'allow read, write: if true;'. Local storage active.");
    } else {
      console.info("[InterviewOS Firebase] Resume save note:", err?.message || err);
    }
  }
}

export default app;

