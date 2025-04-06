/**
 * This file contains the configuration for firebase
 * It exports a firebase auth object which will allow users
 * to access any firebase services. For this project we will use
 * firebase to for authentication.
 */
import * as firebase from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

import env from "@/utils/env";

let serviceAccountKey: firebase.ServiceAccount;

if (!env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error("Missing service account key");
} else {
    serviceAccountKey = JSON.parse(
        env.FIREBASE_SERVICE_ACCOUNT_KEY
    ) as firebase.ServiceAccount;
}

firebase.initializeApp({
    credential: firebase.cert(serviceAccountKey),
});

const storage = getStorage();

export { storage };
