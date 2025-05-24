import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// 🔧 Replace with your Firebase config:
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "XXXXXX",
  appId: "XXXXXX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

let localStream;
let roomRef;

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  localVideo.srcObject = stream;
  localStream = stream;
  stream.getTracks().forEach(track => peer.addTrack(track, stream));
});

peer.ontrack = event => {
  remoteVideo.srcObject = event.streams[0];
};

peer.onicecandidate = async (e) => {
  if (e.candidate) {
    await setDoc(doc(roomRef, 'callerCandidates', e.candidate.candidate), {
      candidate: e.candidate.candidate
    });
  }
};

async function startCall() {
  // Create a random room ID
  const roomId = Math.random().toString(36).substring(2, 10);
  roomRef = collection(db, 'rooms', roomId, 'candidates');

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);

  await setDoc(doc(db, 'rooms', roomId), {
    offer: {
      type: offer.type,
      sdp: offer.sdp
    }
  });

  const unsub = onSnapshot(doc(db, 'rooms', roomId), async (docSnap) => {
    const data = docSnap.data();
    if (!peer.currentRemoteDescription && data?.answer) {
      const remoteDesc = new RTCSessionDescription(data.answer);
      await peer.setRemoteDescription(remoteDesc);
    }
  });

  onSnapshot(roomRef, async (snap) => {
    snap.docChanges().forEach(async (change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        if (data.candidate) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate({ candidate: data.candidate }));
          } catch (e) {
            console.error('Error adding remote candidate', e);
          }
        }
      }
    });
  });
}
